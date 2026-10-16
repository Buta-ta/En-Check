import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ═══════════════════════════════════════════════════════════════════════════
// CÂBLAGE DES COMPOSANTS DE POINTAGES — « ce que la carte demande, la liste le donne »
// ═══════════════════════════════════════════════════════════════════════════
//  Incident du 16/10, après déploiement de la PR #6 :
//
//    Uncaught ReferenceError: canEditPointages is not defined
//        at qc (index-C1NUtPw8.js:886:7330)
//
//  Les boutons « Valider / Écarter » d'une sortie présumée avaient été écrits dans
//  `PointageCard` en lisant l'ÉTAT DU PARENT (`canEditPointages`) et deux noms que
//  personne ne leur passait (`statuerEstimation`, `estimationEnCours`). `GroupedList`
//  et `FlatList` rendent cette carte sans forwarder ces props : l'enfant référençait
//  des identifiants libres → ReferenceError au rendu → la page entière à blanc, pas
//  seulement la carte.
//
//  Il faut DEUX portes, parce qu'il y a deux façons de casser :
//   · `no-undef` (eslint — voir eslint.gate.config.js, ajouté en CI le même jour)
//     attrape l'identifiant libre ;
//   · RIEN n'attrape la prop déclarée par l'enfant et oubliée par le parent : le nom
//     reste défini quelque part, le composant rend avec `undefined`, les boutons
//     disparaissent en silence et le manager ne peut plus valider. C'est le trou que
//     ferme ce fichier.
//
//  Analyse lexicale, sans React ni jsdom : aucune dépendance ajoutée au projet. Elle
//  ne prouve pas que ça s'affiche bien — elle prouve que le câblage est symétrique,
//  ce qui est précisément la classe de bug vécue.
//
//  Les limites de composant sont prises au niveau 0 d'indentation (`^function`), pas
//  en équilibrant les accolades : ce fichier contient du JSX en français, donc des
//  apostrophes hors chaînes, et tout lexer de portées qui devine les apostrophes
//  tronque le corps d'une fonction au premier « l'entreprise ».

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FICHIER = join(RACINE, 'pages', 'Pointages.jsx')
const source = readFileSync(FICHIER, 'utf8')

// Le trio dont la carte a besoin pour appliquer « on marque, on n'encaisse pas » :
// le drapeau d'édition, l'action de statuer, le verrou d'appel en cours.
const TRIO = ['canEdit', 'statuerEstimation', 'estimationEnCours']

// ── régions de composant ──────────────────────────────────────────────────
const FONCTIONS = [...source.matchAll(/^(?:export default )?function ([A-Za-z0-9_]+)\s*\(/gm)].map((m) => ({
  nom: m[1],
  debut: m.index,
}))

function regionDe(nom) {
  const i = FONCTIONS.findIndex((f) => f.nom === nom)
  if (i < 0) {
    throw new Error(
      `${nom} n'est plus une fonction de premier niveau dans Pointages.jsx. ` +
      `Ce test suit le câblage des composants : s'ils changent de forme (composant extrait ` +
      `dans son propre fichier, passage en flèche), mets à jour ce fichier en même temps — ` +
      `ne le supprime pas.`,
    )
  }
  const fin = i + 1 < FONCTIONS.length ? FONCTIONS[i + 1].debut : source.length
  return source.slice(FONCTIONS[i].debut, fin)
}

// ── signature : ce que le composant déclare ───────────────────────────────
function separesAuxVirgules(t) {
  // découpe sur les virgules de profondeur 0 : `a, b: {c: 1}, d = 2` → 3 morceaux.
  const morceaux = []
  let prof = 0, courant = '', inStr = null
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inStr) {
      courant += c
      if (c === '\\') { courant += t[++i] ?? ''; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; courant += c; continue }
    if (c === '{' || c === '(' || c === '[') prof++
    else if (c === '}' || c === ')' || c === ']') prof--
    if (c === ',' && prof === 0) { morceaux.push(courant); courant = ''; continue }
    courant += c
  }
  if (courant.trim()) morceaux.push(courant)
  return morceaux
}

function signature(nom) {
  // les NOMS de props que le composant déstructure. Un alias (`pointage: p`) compte
  // pour son nom d'entrée (`pointage`), pas pour son petit nom local : c'est lui que
  // le parent doit écrire dans la balise.
  const tete = regionDe(nom)
  const m = tete.match(/^\s*(?:export default )?function\s+\w+\s*\(([\s\S]*?)\)\s*\{/)
  if (!m) throw new Error(`signature de ${nom} illisible : déstructuration modifiée ?`)
  const inner = m[1].trim()
  if (!inner.startsWith('{')) return [] // composant sans props : rien à vérifier
  const corps = inner.slice(inner.indexOf('{') + 1, inner.lastIndexOf('}'))
  return separesAuxVirgules(corps)
    .map((morceau) => {
      const cle = morceau.match(/^\s*(?:\.\.\.)?([A-Za-z][A-Za-z0-9_]*)/)
      return cle ? cle[1] : null
    })
    .filter(Boolean)
    .filter((x) => x !== '...')
}

// ── sites d'appel : ce que le parent passe vraiment ──────────────────────
function sauteLesChaines(t, i) {
  const c = t[i]
  if (c !== '"' && c !== "'" && c !== '`') return -1
  for (let j = i + 1; j < t.length; j++) {
    if (t[j] === '\\') { j++; continue }
    if (t[j] === c) return j
  }
  return t.length
}

function finDeBalise(t, debut) {
  // de `<Tag` au `>` qui ferme la balise : les `>` d'un `=>` dans un attribut ne
  // comptent pas, ils sont entre accolades.
  let prof = 0
  for (let i = debut; i < t.length; i++) {
    const saut = sauteLesChaines(t, i)
    if (saut >= 0) { i = saut; continue }
    const c = t[i]
    if (c === '{' || c === '(' || c === '[') prof++
    else if (c === '}' || c === ')' || c === ']') prof--
    else if (c === '>' && prof <= 0) return i
  }
  return t.length
}

function propsPassees(dans, quoi) {
  // pour chaque `<quoi …>` rendu dans la région de `dans`, la liste de ses attributs
  const region = regionDe(dans)
  const resultat = []
  const re = new RegExp(`<${quoi}(?=[\\s/>])`, 'g')
  let m
  while ((m = re.exec(region))) {
    const balise = region.slice(m.index, finDeBalise(region, m.index))
    resultat.push([...balise.matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*=\s*[{"']/g)].map((x) => x[1]))
  }
  return resultat
}

describe('câblage PointageCard / GroupedList / FlatList', () => {
  it('les quatre composants attendus sont là (le test ne tourne pas dans le vide)', () => {
    for (const c of ['PointageCard', 'GroupedList', 'FlatList', 'Pointages']) {
      expect(() => regionDe(c)).not.toThrow()
    }
  })

  it.each(TRIO)('PointageCard déclare la prop « %s » dont son bandeau a besoin', (prop) => {
    expect(signature('PointageCard')).toContain(prop)
  })

  it.each(TRIO)('les deux listes forwardent « %s » à PointageCard', (prop) => {
    for (const parent of ['GroupedList', 'FlatList']) {
      const sites = propsPassees(parent, 'PointageCard')
      expect(sites.length, `${parent} ne rend plus <PointageCard> ?`).toBeGreaterThan(0)
      for (const attrs of sites) {
        expect(attrs, `« ${prop} » pas passée à <PointageCard> dans ${parent} → undefined dans la carte`).toContain(prop)
      }
    }
  })

  it.each(TRIO)('la page passe « %s » aux deux vues (groupée et plate)', (prop) => {
    for (const vue of ['GroupedList', 'FlatList']) {
      const sites = propsPassees('Pointages', vue)
      expect(sites.length, `la page ne rend plus <${vue}> ?`).toBeGreaterThan(0)
      for (const attrs of sites) expect(attrs, `« ${prop} » manque sur <${vue}>`).toContain(prop)
    }
  })

  it('aucun composant enfant ne lit l\'état de la page par son nom', () => {
    // `canEditPointages` est un useState de la page : dans un enfant, ce nom est LIBRE,
    // et un nom libre au rendu = ReferenceError = page entière à blanc.
    const fautifs = ['PointageCard', 'GroupedList', 'FlatList'].filter(
      (nom) => /\bcanEditPointages\b/.test(regionDe(nom)),
    )
    expect(fautifs, `état de la page lu dans ${fautifs.join(', ')} — la prop s'appelle canEdit`).toEqual([])
  })

  it('le bandeau « sortie présumée » est piloté par la prop canEdit', () => {
    const carte = regionDe('PointageCard')
    const avantActions = carte.slice(0, carte.indexOf('estimationActions'))
    expect(avantActions).toMatch(/\{canEdit && \(/)
  })

  it('les props demandées par la carte ne sont pas seulement déclarées : elles arrivent', () => {
    // contrôle croisé : toute prop que PointageCard lit doit figurer sur AU MOINS un
    // site d'appel, sinon elle vaudra undefined.
    const declarees = signature('PointageCard')
    const recues = new Set([
      ...propsPassees('GroupedList', 'PointageCard').flat(),
      ...propsPassees('FlatList', 'PointageCard').flat(),
    ])
    const manquantes = declarees.filter((p) => p !== 'children' && !p.startsWith('...') && !recues.has(p))
    expect(manquantes, `props déclarées par PointageCard et passées par aucune liste : ${manquantes.join(', ')}`).toEqual([])
  })
})
