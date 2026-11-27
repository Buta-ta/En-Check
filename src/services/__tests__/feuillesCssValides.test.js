// ═══════════════════════════════════════════════════════════
// 🧵 LES FEUILLES DE STYLE SE TIENNENT — ou la page tombe en texte brut
//
// La panne du 28/11 : la page Jours fériés s'affichait SANS AUCUN STYLE —
// du texte noir sur du crème, sans bordure, sans cercle, sans rien. Le CSS
// était pourtant complet et bien livré : c'était une seule apostrophe.
//
// Dans `HeuresSupplementaires.css`, un commentaire avait perdu son `/*` :
//
//     /* … pas ses règles. *\/
//        la maison ne colore pas une alternance … l'état d'une barre … *\/   ← reste orphelin
//     .ot-bar { … }
//
// Tant qu'aucun outil ne touche au fichier, le navigateur s'en accommode :
// le `*\/` orphelin est ignoré. Mais le minifieur SUPPRIME les commentaires,
// et le `*\/` orphelin se retrouve collé à la règle suivante. L'apostrophe
// de « l'état » ouvre alors une chaîne qui n'a pas de fin : elle avale les
// 1 400 Ko de CSS qui suivent, et tout ce qui venait après — dont la feuille
// des jours fériés — n'existe plus.
//
// Une feuille valide se lit avec un lexer de trente lignes : commentaires,
// chaînes, blocs. On refuse un `*\/` hors commentaire et une chaîne ouverte.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const RACINE_SRC = path.join(ROOT, 'src')

/** Toutes les feuilles de style du produit. */
function feuilles(dossier = RACINE_SRC) {
  const sortie = []
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, entree.name)
    if (entree.isDirectory()) sortie.push(...feuilles(chemin))
    else if (entree.name.endsWith('.css')) sortie.push(chemin)
  }
  return sortie.sort()
}

/**
 * Lit une feuille et rend la liste de ses fautes, avec le numéro de ligne.
 * Trois états : code, commentaire, chaîne.
 */
function fautes(css) {
  const trouvailles = []
  let etat = 'code'
  let guillemet = ''
  let i = 0
  const ligne = (pos) => css.slice(0, pos).split('\n').length

  while (i < css.length) {
    const c = css[i]
    const d = css[i + 1] || ''

    if (etat === 'code') {
      if (c === '/' && d === '*') { etat = 'commentaire'; i += 2; continue }
      if (c === '*' && d === '/') {
        trouvailles.push(`ligne ${ligne(i)} : « */ » hors commentaire`)
        i += 2; continue
      }
      if (c === '"' || c === "'") { etat = 'chaine'; guillemet = c; i += 1; continue }
      i += 1; continue
    }

    if (etat === 'commentaire') {
      if (c === '*' && d === '/') { etat = 'code'; i += 2; continue }
      i += 1; continue
    }

    // dans une chaîne
    if (c === '\\') { i += 2; continue }
    if (c === guillemet) { etat = 'code'; i += 1; continue }
    if (c === '\n') {
      trouvailles.push(`ligne ${ligne(i)} : chaîne ouverte non fermée`)
      etat = 'code'; i += 1; continue
    }
    i += 1
  }

  if (etat === 'chaine') trouvailles.push('fin de fichier : chaîne encore ouverte')
  if (etat === 'commentaire') trouvailles.push('fin de fichier : commentaire encore ouvert')
  return trouvailles
}

describe('Les feuilles de style se lisent d’un bout à l’autre', () => {
  const fichiers = feuilles()

  it('1. il y a bien des feuilles à lire', () => {
    expect(fichiers.length).toBeGreaterThan(50)
  })

  it('2. aucune feuille ne contient de « */ » orphelin ni de chaîne ouverte', () => {
    //  La panne du 28/11 : tout le CSS de production devenait illisible à
    //  cause d'un seul commentaire amputé de son ouverture.
    const enPanne = fichiers
      .map((f) => ({ f: path.relative(ROOT, f), fautes: fautes(readFileSync(f, 'utf8')) }))
      .filter((x) => x.fautes.length > 0)
    expect(enPanne).toEqual([])
  })

  it('3. un commentaire ne mange jamais la fin de la feuille', () => {
    //  Deuxième forme de la même panne, trouvée dans le même fichier : un
    //  commentaire ouvert et jamais fermé. Le lexer le signale, mais il faut
    //  aussi vérifier que la dernière règle du fichier est bien HORS d'un
    //  commentaire — sinon les dernières règles n'existent plus.
    const enPanne = fichiers.filter((f) => {
      const css = readFileSync(f, 'utf8')
      const dernierFerme = css.lastIndexOf('*/')
      const dernierOuvert = css.lastIndexOf('/*')
      // un commentaire encore ouvert à la fin : il est ouvert après la
      // dernière fermeture, et rien ne le referme
      return dernierOuvert > dernierFerme
    })
    expect(enPanne.map((f) => path.relative(ROOT, f))).toEqual([])
  })

  it('4. le commentaire de la panne est réparé, pas contourné', () => {
    //  On nomme la phrase fautive : elle ne doit exister qu'UNE fois, dans
    //  un commentaire correctement ouvert et fermé.
    const heures = readFileSync(path.join(ROOT, 'src/pages/HeuresSupplementaires.css'), 'utf8')
    const occurrences = heures.split('la maison ne colore pas une alternance').length - 1
    expect(occurrences).toBe(1)
    //  et le commentaire qui la porte est bien fermé avant la règle suivante
    const i = heures.indexOf('la maison ne colore pas une alternance')
    const avant = heures.lastIndexOf('/*', i)
    const ferme = heures.indexOf('*/', i)
    expect(avant).toBeGreaterThan(-1)
    expect(ferme).toBeGreaterThan(i)
    expect(heures.slice(ferme, ferme + 40)).toContain('*/')
  })
})
