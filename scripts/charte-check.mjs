#!/usr/bin/env node
/**
 * En-Check — charte-check
 * Vérifie les contrôles automatisables de la charte (D-001 à D-020).
 *
 * Usage :
 *   node scripts/charte-check.mjs            # rapport lisible
 *   node scripts/charte-check.mjs --json     # sortie machine (CI)
 *   node scripts/charte-check.mjs --strict   # échoue dès qu'un contrôle échoue
 *
 * Chaque contrôle renvoie : PASS (conforme), FAIL (écart mesuré), MANUEL
 * (non automatisable — exige une revue humaine) ou N/A (pas encore applicable,
 * le kit n'est pas écrit).
 *
 * Le script ne corrige rien. Il mesure. C'est la seule chose qui distingue une
 * charte d'une intention.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname, basename } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')
const JSON_OUT = process.argv.includes('--json')
const STRICT = process.argv.includes('--strict')

/** Les fichiers autorisés à contenir des valeurs de couleur en dur. */
const FICHIERS_TOKENS = ['src/index.css', 'src/styles/charte.css', 'src/styles/tokens.css']
/** Les fichiers autorisés à redéfinir des mesures. */
const FICHIERS_MESURES = ['src/styles/charte.css', 'src/styles/tokens.css']

// ── la charte, en dur : c'est la référence, pas une configuration ───────────
const PALETTE = {
  sable: '#F3E9DA',
  surface: '#FBF4E9',
  surface2: '#EADCC7',
  bordure: '#D8C6AC',
  encre: '#2A1708',
  douce: '#6B4A32',
  aplat: '#A26537',
  texte: '#7E4A26',
  succes: '#3F6B4C',
  alerte: '#8A5A14',
  erreur: '#9B2C2C',
  blanc: '#FFFDF7',
}

/** Les paires texte/fond à tenir au-dessus de 4,5:1 (D-001). */
const PAIRES = [
  ['encre', 'sable'], ['encre', 'surface'], ['encre', 'surface2'],
  ['douce', 'surface'], ['douce', 'sable'],
  ['texte', 'surface'], ['texte', 'sable'], ['texte', 'surface2'],
  ['blanc', 'aplat'],
  ['encre', 'surface2'],
]

/** L'échelle d'espace de D-013, et les rayons de D-016. */
const ECHELLE = new Set(['0', '2', '3', '4', '8', '12', '16', '24', '32', '48'])
const RAYONS = new Set(['6', '8', '11', '12', '999', '0', '1', '2', '3', '4'])

// ── outils ─────────────────────────────────────────────────────────────────
function* fichiers(dossier) {
  for (const nom of readdirSync(dossier)) {
    if (nom === 'node_modules' || nom.startsWith('.')) continue
    const p = join(dossier, nom)
    const st = statSync(p)
    if (st.isDirectory()) yield* fichiers(p)
    else if (['.css', '.jsx', '.js'].includes(extname(nom))) yield p
  }
}

const lire = (p) => readFileSync(p, 'utf8')
const rel = (p) => relative(ROOT, p).replaceAll('\\', '/')
const surTokens = (p) => FICHIERS_TOKENS.includes(rel(p))
const surMesures = (p) => FICHIERS_MESURES.includes(rel(p))

function luminance(hex) {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contraste(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100
}

const tous = [...fichiers(SRC)]
const css = tous.filter((p) => p.endsWith('.css'))
const code = tous.filter((p) => !p.endsWith('.css'))

const resultats = []
function controle(id, decision, titre, etat, detail, exemples = []) {
  resultats.push({ id, decision, titre, etat, detail, exemples })
}

// ── C1 · aucun #hexadécimal hors des fichiers de tokens ────────────────────
{
  const fautifs = new Map()
  for (const p of tous) {
    if (surTokens(p)) continue
    const n = (lire(p).match(/#[0-9a-fA-F]{3,8}\b/g) || []).length
    if (n) fautifs.set(rel(p), n)
  }
  const total = [...fautifs.values()].reduce((a, b) => a + b, 0)
  controle('C1', 'D-001', 'Aucun #hex hors des tokens', total === 0 ? 'PASS' : 'FAIL',
    `${total} valeurs de couleur en dur dans ${fautifs.size} fichiers`,
    [...fautifs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => `${f} (${n})`))
}

// ── C2 · contraste des paires de la palette ───────────────────────────────
{
  const fautives = PAIRES.map(([a, b]) => ({ a, b, ratio: contraste(PALETTE[a], PALETTE[b]) }))
    .filter((x) => x.ratio < 4.5)
  controle('C2', 'D-001', 'Paires texte/fond ≥ 4,5:1', fautives.length === 0 ? 'PASS' : 'FAIL',
    `${PAIRES.length} paires de référence vérifiées, plancher ${Math.min(...PAIRES.map(([a, b]) => contraste(PALETTE[a], PALETTE[b])))}:1`,
    fautives.map((x) => `${x.a} sur ${x.b} = ${x.ratio}`))
}

// ── C6 · aucune police tierce ─────────────────────────────────────────────
{
  const fautifs = []
  for (const p of tous) {
    const s = lire(p)
    if (/@font-face[\s\S]{0,400}?url\(\s*['"]?https?:/i.test(s)) fautifs.push(rel(p))
    if (/fonts\.(googleapis|gstatic)\.com/i.test(s)) fautifs.push(rel(p))
  }
  const html = join(ROOT, 'index.html')
  try {
    if (/fonts\.(googleapis|gstatic)\.com/i.test(lire(html))) fautifs.push('index.html')
  } catch { /* pas de index.html : rien à vérifier */ }
  controle('C6', 'D-006', 'Aucune police tierce', fautifs.length === 0 ? 'PASS' : 'FAIL',
    `${[...new Set(fautifs)].length} fichier(s) chargeant une police distante`,
    [...new Set(fautifs)].slice(0, 5))
}

// ── C9 · aucune ombre floue (peau D) ──────────────────────────────────────
{
  let total = 0
  const fautifs = []
  for (const p of css) {
    if (surMesures(p)) continue
    const s = lire(p)
    for (const m of s.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
      const valeur = m[1]
      if (/inset/.test(valeur)) continue
      const groupes = valeur.split(/,(?![^(]*\))/)
      for (const groupe of groupes) {
        const nombres = (groupe.match(/-?\d*\.?\d+(?:px)?/g) || [])
          .map((n) => parseFloat(n)).filter((n) => !Number.isNaN(n))
        // offset-x offset-y blur [spread] : le 3e nombre est le flou
        const flou = nombres[2]
        if (flou && flou !== 0) { total++; if (fautifs.length < 5) fautifs.push(`${rel(p)} : ${groupe.trim()}`) }
      }
    }
  }
  controle('C9', 'D-016', 'Aucune ombre floue', total === 0 ? 'PASS' : 'FAIL',
    `${total} ombres avec un flou non nul`, fautifs)
}

// ── C10 · rayons dans la liste blanche ────────────────────────────────────
{
  const horsEchelle = new Map()
  let total = 0
  for (const p of css) {
    if (surMesures(p)) continue
    for (const m of lire(p).matchAll(/border-radius\s*:\s*([^;]+);/g)) {
      for (const v of m[1].matchAll(/(\d*\.?\d+)px/g)) {
        const n = v[1].replace(/\.0+$/, '')
        if (!RAYONS.has(n)) { total++; horsEchelle.set(n, (horsEchelle.get(n) || 0) + 1) }
      }
    }
  }
  controle('C10', 'D-016', 'Rayons dans {6, 8, 11, 12, 999}', total === 0 ? 'PASS' : 'FAIL',
    `${total} rayons hors liste, sur ${horsEchelle.size} valeurs`,
    [...horsEchelle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v, n]) => `${v}px (${n}×)`))
}

// ── les mesures de référence (planche 21) ────────────────────────────────
const mesures = { polices: new Set(), marges: new Set(), rayons: new Set() }
let declarationsPolice = 0, declarationsMarge = 0, declarationsRayon = 0
for (const p of css) {
  const s = lire(p)
  for (const m of s.matchAll(/font-size\s*:\s*([\d.]+)px/g)) { mesures.polices.add(+m[1]); declarationsPolice++ }
  for (const m of s.matchAll(/padding(?:-[a-z]+)?\s*:\s*([\d.]+)px/g)) { mesures.marges.add(+m[1]); declarationsMarge++ }
  for (const m of s.matchAll(/border-radius\s*:\s*([\d.]+)px/g)) { mesures.rayons.add(+m[1]); declarationsRayon++ }
}

// ── les contrôles qui exigent un œil ─────────────────────────────────────
controle('C3', 'D-003', 'Une seule bande de motif par page, hauteur native', 'MANUEL',
  'se vérifie sur la page rendue, pas dans le CSS : une capture + la hauteur du motif')
controle('C4', 'D-003', 'Aucun motif étiré', 'MANUEL',
  'le CSS ne dit pas si l’image est un motif : à vérifier sur la capture')
controle('C5', 'D-004', 'Aucun texte posé sur une bande', 'MANUEL',
  'mesurable sur la capture (zone de texte ∩ zone de motif)')
controle('C7', 'D-009', 'Aucun statut exprimé par la couleur seule', 'MANUEL',
  'il faut lire le composant : un badge sans mot est un échec')
controle('C8', 'D-017', 'Aucun composant hors des dix-huit formes', 'N/A',
  'applicable dès que le kit est écrit — en attendant, la référence est la planche 24')
controle('C11', 'D-016', 'Contour 2 px espresso sur tout objet actif', 'N/A',
  'applicable dès que le kit est écrit')
controle('C12', 'D-016', 'Boutons en capitales 700 / 9,5 px', 'N/A',
  'applicable dès que le kit est écrit')

// ── verdict ─────────────────────────────────────────────────────────────
const compte = { PASS: 0, FAIL: 0, MANUEL: 0, 'N/A': 0 }
for (const r of resultats) compte[r.etat]++
const bloquant = compte.FAIL > 0

if (JSON_OUT) {
  console.log(JSON.stringify({
    date: new Date().toISOString(),
    verdict: bloquant ? 'NON CONFORME' : 'CONFORME',
    compte, resultats,
    mesures: {
      polices: { distinctes: mesures.polices.size, declarations: declarationsPolice },
      marges: { distinctes: mesures.marges.size, declarations: declarationsMarge },
      rayons: { distinctes: mesures.rayons.size, declarations: declarationsRayon },
    },
  }, null, 2))
} else {
  console.log('\n  EN-CHECK — CONTRÔLE DE CHARTE')
  console.log('  ' + '─'.repeat(66))
  for (const r of resultats) {
    const marque = { PASS: '✓', FAIL: '✗', MANUEL: '·', 'N/A': '–' }[r.etat]
    console.log(`  ${marque} ${r.id.padEnd(4)} ${r.decision.padEnd(6)} ${r.titre}`)
    console.log(`      ${r.detail}`)
    for (const ex of r.exemples) console.log(`      → ${ex}`)
  }
  console.log('  ' + '─'.repeat(66))
  console.log(`  Mesures : ${mesures.polices.size} tailles de texte · ${mesures.marges.size} marges · ${mesures.rayons.size} rayons`)
  console.log(`  Cible    : 3 tailles · 7 marges · 4 rayons`)
  console.log('  ' + '─'.repeat(66))
  console.log(`  ${compte.PASS} conformes · ${compte.FAIL} en écart · ${compte.MANUEL} à l'œil · ${compte['N/A']} non applicables`)
  console.log(`  VERDICT : ${bloquant ? 'NON CONFORME' : 'CONFORME'}\n`)
}

if (STRICT && bloquant) process.exit(1)
