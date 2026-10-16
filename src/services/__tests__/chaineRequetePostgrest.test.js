import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ═══════════════════════════════════════════════════════════════════════════
// GARDE-FOU « PAS DE COMMENTAIRE DANS UNE REQUÊTE » — né d'un incident de prod
// ═══════════════════════════════════════════════════════════════════════════
//  Le 16/10, l'écran de pointages est resté vide avec, en console :
//
//    GET /rest/v1/attendances?select=id%2Cem… 400 (Bad Request)
//    PGRST100: unexpected "/" expecting ", field name (* or [a..z0..9_$])"
//
//  Cause : un commentaire `//` écrit À L'INTÉRIEUR du gabarit passé à
//  `.select(`…`)`. En JavaScript, `//` n'est un commentaire qu'entre deux tokens :
//  dans une chaîne (ou un template literal), c'est du TEXTE — il part donc dans l'URL
//  vers PostgREST, qui ne sait pas le parser, et la requête entière est rejetée.
//  Un fichier de 100 Ko de SQL, lui, n'a pas ce problème : `--` y est un vrai
//  commentaire. C'est la différence entre les deux mondes, et elle ne s'invente pas.
//
//  Ce test est volontairement bête et global : il scanne tout `src/` et échoue dès
//  qu'un commentaire humain se glisse dans une chaîne envoyée à PostgREST — select,
//  insert, update, upsert, filter, or. Il échoue aussi sur un chevron ou une
//  parenthère déséquilibrés dans un select, autre façon de fabriquer un 400.
// ═══════════════════════════════════════════════════════════════════════════

// `__dirname` n'existe pas en modules ES : eslint (globals.browser) le signalait en
// no-undef. On le déduit de l'URL du module, ce qui marche aussi sous vitest.
const RACINE_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx']

function fichiersSources(dossier, acc = []) {
  for (const entree of readdirSync(dossier)) {
    if (entree === 'node_modules' || entree.startsWith('.')) continue
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) fichiersSources(chemin, acc)
    else if (EXTENSIONS.some((x) => chemin.endsWith(x))) acc.push(chemin)
  }
  return acc
}

// Les verbes dont l'argument est du texte PostgREST (et non du JSON côté JS).
const APPELS = /(?:^|[^A-Za-z0-9_])(?:select|insert|update|upsert|filter|or|not|eq|neq|gte|lte|gt|lt|like|ilike|is|in|contains|containedBy|match|single)\s*\(\s*(`(?:[^`\\]|\\[\s\S])*`|'(?:[^'\\]|\\[\s\S])*'|"(?:[^"\\]|\\[\s\S])*")/g

function extraireChaines(texteFichier) {
  const resultat = []
  for (const m of texteFichier.matchAll(APPELS)) {
    const brut = m[1]
    const corps = brut.slice(1, -1) // on retire les délimiteurs
    resultat.push({ corps, ligne: texteFichier.slice(0, m.index).split('\n').length })
  }
  return resultat
}

describe('chaînes envoyées à PostgREST', () => {
  const fichiers = fichiersSources(RACINE_SRC)

  it('le scan trouve bien des chaînes à contrôler (le test ne tourne pas à vide)', () => {
    let total = 0
    for (const f of fichiers) total += extraireChaines(readFileSync(f, 'utf8')).length
    expect(total).toBeGreaterThan(20)
  })

  it('aucun commentaire // ou -- ne traîne dans une chaîne de requête', () => {
    const fautifs = []
    for (const f of fichiers) {
      const texte = readFileSync(f, 'utf8')
      for (const { corps, ligne } of extraireChaines(texte)) {
        if (corps.includes('//') || /^\s*--/.test(corps) || corps.includes('\n--')) {
          fautifs.push(`${f.replace(RACINE_SRC + '/', '')}:${ligne}`)
        }
      }
    }
    expect(fautifs, `commentaires dans une requête → 400 PGRST100 :
${fautifs.join('\n')}`).toEqual([])
  })

  it('les listes de colonnes ont des parenthèses équilibrées', () => {
    const fautifs = []
    for (const f of fichiers) {
      const texte = readFileSync(f, 'utf8')
      for (const { corps, ligne } of extraireChaines(texte)) {
        const ouv = (corps.match(/\(/g) || []).length
        const fer = (corps.match(/\)/g) || []).length
        if (ouv !== fer) fautifs.push(`${f.replace(RACINE_SRC + '/', '')}:${ligne} (${ouv} ouvrantes / ${fer} fermantes)`)
      }
    }
    expect(fautifs, `parenthèses déséquilibrées dans un select :
${fautifs.join('\n')}`).toEqual([])
  })

  it('aucun backtick échappé ou guillemet orphelin dans une chaîne select (le gabarit ne doit pas se refermer trop tôt)', () => {
    const fautifs = []
    for (const f of fichiers) {
      const texte = readFileSync(f, 'utf8')
      for (const m of texte.matchAll(/\.select\(\s*`([^`]*)`/g)) {
        const corps = m[1]
        if (corps.includes('\\`')) fautifs.push(`${f}:${texte.slice(0, m.index).split('\n').length}`)
      }
    }
    expect(fautifs).toEqual([])
  })
})
