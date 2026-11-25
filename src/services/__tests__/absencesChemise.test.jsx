// @vitest-environment jsdom
// Absences · LA CHEMISE — maquette retenue `maquettes/absences-titre-C-chemise.png`
// (28/11/2026) : « je choisis le C. Je veux exactement ce même rendu. »
//
//   Un objet de moins, pas un style de plus ; la pâte de l'onglet ouvert est celle de
//   la feuille ; ce qui se clique se clique ; un chiffre ne se dit pas deux fois.
//
// La figure vaut parce qu'elle SOUDE deux objets qui vivaient séparés : la feuille de
// titre et la rangée des trois onglets de section. Une soudure, ça se mesure — c'est ce
// que fait ce fichier. Le reste (aucun hexadécimal, aucun flou, aucun rayon hors liste,
// aucune graisse qui n'existe pas dans les fichiers de police) se compte, lui, sur la
// plage de la feuille que la chemise occupe.

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import AbsencesChemise from '../../components/AbsencesChemise'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const CSS = lire('src/pages/AbsencesAfroTech.css')
const PAGE = lire('src/pages/Absences.jsx')
const KIT = lire('src/styles/charte.css')

// Toute la plage de la chemise : de son premier sélecteur jusqu'au bloc du rail, qui
// la suit dans la feuille. Rien d'autre n'y a droit.
const DEBUT = CSS.indexOf('.abs-chemise {')
const FIN = CSS.indexOf('/* Même gabarit que la barre de raccourcis')
// Les commentaires sont retirés AVANT toute mesure : la feuille explique la règle, et
// un contrat qui cherche `#[0-9A-F]` ou `50%` dans du texte de commentaires se fait
// avoir par sa propre prose — c'est exactement ce qui est arrivé à ce fichier au premier
// essai (« `border-radius: 50%` est retiré » y est écrit en toutes lettres).
const CHIMISE_CSS = () => {
  expect(DEBUT, 'la chemise n’est pas dans la feuille').toBeGreaterThan(-1)
  expect(FIN, 'la fin de la plage de la chemise est introuvable').toBeGreaterThan(DEBUT)
  return CSS.slice(DEBUT, FIN).replace(/\/\*[\s\S]*?\*\//g, '')
}
const regle = (selecteur) => {
  const i = CHIMISE_CSS().indexOf(selecteur)
  expect(i, `règle manquante : ${selecteur}`).toBeGreaterThan(-1)
  const depart = CHIMISE_CSS().slice(i)
  return depart.slice(0, depart.indexOf('\n}') + 2)
}
const valeur = (bloc, prop) => {
  const m = bloc.match(new RegExp(`${prop}:\\s*([^;]+);`))
  expect(m, `${prop} absent de « ${bloc.slice(0, 32)}… »`).not.toBe(null)
  return m[1].trim()
}

const ONGLETS = [
  { id: 'absences', libelle: 'Absences' },
  { id: 'demandes', libelle: 'Demandes employés', compte: 2, alerte: true },
  { id: 'config_conges', libelle: 'Configuration congés', compte: 5 },
]
const rendre = (surdrets = {}) =>
  renderToStaticMarkup(
    <AbsencesChemise
      titre="En-Check · ABSENCES & CONGÉS"
      sousTitre="Congés, maladies, formations et justificatifs"
      onglets={ONGLETS}
      ongletActif="absences"
      surChoixOnglet={() => {}}
      surRetour={() => {}}
      surExporter={() => {}}
      surDeclarer={() => {}}
      {...surdrets}
    />,
  )

describe('Absences · la chemise (maquette C)', () => {
  it('sude l’onglet ouvert à la feuille — les quatre nombres qui font la soudure', () => {
    const rangee = regle('.abs-chemise-onglets {')
    const onglet = regle('.abs-chemise-onglet {')
    const actif = regle(".abs-chemise-onglet[aria-pressed='true'] {")
    const feuille = regle('.abs-chemise-feuille {')
    // 1 · la rangée plonge dans la feuille de exactement l'épaisseur du trait
    expect(valeur(rangee, 'margin-bottom')).toBe('calc(-1 * var(--charte-trait))')
    // 2 · et peint par-dessus elle
    expect(valeur(rangee, 'z-index')).toBe('1')
    expect(valeur(feuille, 'z-index')).toBe('0')
    // 3 · socles alignés, hauteurs identiques
    expect(valeur(rangee, 'align-items')).toBe('flex-end')
    // hauteur posée sur la classe, pas sur l'onglet actif : les trois socles sont
    // égaux par construction, et l'onglet ouvert ne peut pas se rallonger tout seul
    expect(onglet).toContain('height: 36px')
    expect(actif).not.toContain('height:')
    // 4 · l'onglet ouvert n'a pas de bordure basse et reprend ces 2 px en remplissage :
    //     sans lui, les trois libellés ne tiendraient pas la même ligne de base
    expect(valeur(actif, 'border-bottom')).toBe('0')
    expect(valeur(actif, 'padding-bottom')).toBe('var(--charte-trait)')
    // LA pâte : « même couleur » veut dire même jeton, lu dans les deux règles
    expect(valeur(actif, 'background')).toBe(valeur(feuille, 'background'))
    expect(valeur(actif, 'background')).toBe('var(--charte-surface)')
    // les deux autres ferment leur bas sur le trait de la feuille, au même y
    expect(valeur(onglet, 'border-bottom')).toBe('var(--charte-trait) solid var(--charte-encre)')
  })

  it('montre trois onglets, un seul encre, et les libellés entiers', () => {
    const html = rendre()
    expect(html.match(/abs-chemise-onglet"/g)).toHaveLength(3)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    // « Congés » seul, c'est ce que dessinait la maquette. Le libellé réel nomme l'onglet.
    expect(html).toContain('>Configuration congés<')
    expect(html).toContain('>Demandes employés<')
    // aucun des deux premiers onglets ne porte de compteur volé au voisin
    expect(html).not.toMatch(/>Absences<span[^>]*abs-chemise-onglet-compte/)
  })

  it('ne dit un compte que s’il y en a un, et jamais par la couleur seule', () => {
    const html = rendre()
    expect(html).toContain('abs-chemise-onglet-compte')
    expect(html).toContain('data-alerte="oui"')
    expect(html).toContain('>2<') // l'alerte : les demandes en attente
    expect(html).toContain('>5<') // la masse : toutes les demandes
    // le nombre est écrit à côté du mot qui le nomme (le libellé de l'onglet) — C7
    expect(regle('.abs-chemise-onglet-compte[data-alerte=')).toContain('var(--charte-alerte)')
    const vide = rendre({ onglets: [{ id: 'a', libelle: 'Absences', compte: 0 }, { id: 'b', libelle: 'Rien', compte: null }] })
    expect(vide).not.toContain('abs-chemise-onglet-compte')
  })

  it('a une seule variante pleine, deux pilules, et la flèche à la recette de la maison', () => {
    const html = rendre()
    expect(html.match(/ch-btn-pleine/g)).toHaveLength(1)
    expect(html.match(/ch-btn-contour/g)).toHaveLength(1)
    expect(html).toContain('>Export<')
    expect(html).toContain('>Déclarer<')
    // le bandeau ne se refait pas de bouton à son compte : il emprunte le kit
    expect(html).not.toContain('abs-btn')
    // le retour, gabarit canonique : 34 px, pilule, encre 2 px, et ses deux attributs
    const retour = regle('.abs-chemise-retour {')
    expect(retour).toContain('width: 34px')
    expect(retour).toContain('height: 34px')
    expect(retour).toContain('border-radius: var(--charte-rayon-pilule)')
    expect(retour).toContain('border: var(--charte-trait) solid var(--charte-encre)')
    expect(html).toContain('aria-label="Retour à la page précédente"')
    expect(html).toContain('title="Retour"')
    // la durée vient du jeton, pas d'un 140 ms recopié d'un écran à l'autre
    expect(retour).toContain('transition: background-color var(--charte-duree) ease-out')
  })

  it('revient d’où l’on vient, et pas à l’accueil', () => {
    // Le geste est celui de MonEntreprise, de la fiche employé et de l'annuaire :
    // `cibleRetour()` décide, la page n'écrit plus de destination sous une flèche.
    expect(PAGE).toContain('const cible = cibleRetour(window.history.state?.idx)')
    expect(PAGE).toContain("if (cible === 'precedent') navigate(-1)")
    const codes = PAGE.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'))
    expect(codes.some((l) => l.includes('onClick={() => navigate(\'/dashboard\')}'))).toBe(false)
    expect(codes.some((l) => l.includes('className="abs-back-btn"'))).toBe(false)
  })

  it('ne rapporte pas ce qui est sorti de la page', () => {
    const codes = PAGE.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('*'))
    const chimise = lire('src/components/AbsencesChemise.jsx')
      .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('*'))
    // la rangée plate, son conteneur et son objet de styles : partis les trois
    expect(codes.some((l) => l.includes('abs-section-tabs'))).toBe(false)
    expect(codes.some((l) => l.includes('TAB.container'))).toBe(false)
    expect(PAGE).not.toContain('const TAB = {')
    // le rail, la lune, le bandeau de titre : ils étaient sortis avant, ils ne reviennent pas
    expect(codes.some((l) => l.includes('<RaccourcisPages'))).toBe(false)
    expect(codes.some((l) => l.includes('abs-theme-toggle'))).toBe(false)
    expect(codes.some((l) => l.includes('<AbsencesCulturalBand'))).toBe(false)
    // et la maison ne fait pas respirer ses chiffres
    expect(chimise.concat(codes).join('\n')).not.toMatch(/animation:\s*'pulse/)
    expect(regle('.abs-chemise-onglet-compte')).not.toContain('animation')
  })

  it('tient la peau : ni hexadécimal, ni flou, ni rayon hors liste, ni graisse inventée', () => {
    const bloc = CHIMISE_CSS()
    expect(bloc).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/) // C1
    expect(bloc).not.toContain('blur(') // C9 — les ombres sont dures
    expect(bloc).not.toMatch(/linear-gradient|radial-gradient/) // aucune teinte de remplissage
    // C10 : les seuls rayons admis sont les cinq du kit, et ils viennent des jetons
    // une déclaration peut porter quatre coins (`6px 6px 0 0` sur l'onglet) : c'est
    // chaque valeur qui doit être un jeton du kit ou 0, pas la chaîne entière
    const coins = [...bloc.matchAll(/border-radius:\s*([^;]+);/g)]
      .flatMap((m) => m[1].trim().split(/\s+/))
    expect(coins.length).toBeGreaterThan(0)
    const admis = /^0$|^var\(--charte-rayon-(champ|carte|badge|tuile|pilule)\)$/
    for (const coin of coins) expect(coin).toMatch(admis)
    const distincts = new Set(coins)
    expect(distincts.has('var(--charte-rayon-pilule)')).toBe(true) // ce qui se clique
    expect(distincts.has('var(--charte-rayon-tuile)')).toBe(true) // la feuille
    expect(distincts.has('var(--charte-rayon-champ)')).toBe(true) // les deux coins d'onglet
    // les trois grains réellement chargés dans `public/fonts/` sont 400, 600, 700 :
    // un 740, un 760 ou un 800 écrit ici serait synthétisé par le navigateur
    const graisses = [...bloc.matchAll(/font-weight:\s*([^;]+);/g)].map((m) => m[1].trim())
    for (const g of graisses) expect(['400', '600', '700', 'var(--charte-poids-fort)']).toContain(g)
    // l'échelle de D-013, valeur par valeur — le kit ne connaît pas le 13 px ni le 22 px
    const valeurs = [...bloc.matchAll(/(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?:\s*([^;]+);/g)]
      .flatMap((m) => m[1].split(/\s+/))
      .filter((v) => /^\d/.test(v))
    const echelle = new Set(['0', '2px', '3px', '4px', '8px', '12px', '16px', '24px', '32px', '48px'])
    for (const v of valeurs) {
      if (v.startsWith('var(') || v.startsWith('calc(')) continue
      expect(echelle.has(v), `valeur d'espacement hors échelle : ${v}`).toBe(true)
    }
  })

  it('laisse le kit et le reste de la page où ils sont', () => {
    // la pilule des deux commandes est scopingée sous `.abs-chemise` : les `ch-btn-*`
    // des autres écrans gardent leur rayon de champ, sinon cette page aurait repeint
    // le kit entier pour un bandeau
    expect(regle('.abs-chemise .abs-chemise-action')).toContain('border-radius: var(--charte-rayon-pilule)')
    expect(KIT).toMatch(/\.ch-btn-pleine \{[\s\S]*?border-radius:\s*var\(--charte-rayon-champ\);/)
    // les `.abs-btn` de la page — tiroirs, barre d'outils, bandeau d'alerte — ne sont
    // pas de cette section : ils attendent la leur, et rien ici ne les a touchés
    const bouton = CSS.slice(CSS.indexOf('.abs-btn {'))
    expect(bouton.slice(0, bouton.indexOf('\n}'))).toContain('min-height: 40px')
    expect(bouton.slice(0, bouton.indexOf('\n}'))).toContain('border-radius: 11px')
    // et le bord du bas de la chemise est bien la POUTRE : depuis R1 (2/12), c'est
    // dessus que pend la rangée, donc la feuille ne peut plus avoir été repoussée.
    // La chaîne exacte est cherchée dans le CSS vide de commentaires — pas dans la
    // prose qui explique, elle, qu'il n'y a plus de corde longue du tout.
    expect(CSS.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\.abs-etagere-suspentes\s*\{/)
    expect(PAGE).not.toContain('<AbsencesHamac')
    expect(PAGE).toContain('jours={transat.jours}') // le nombre passe, la figure non
  })

  it('donne enfin un titre de page au niveau qui va avec', () => {
    const html = rendre()
    // la bande écrivait le titre dans une `<span>` : la page n'avait aucun `h1`
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('<h1 class="abs-chemise-titre">En-Check · ABSENCES &amp; CONGÉS</h1>')
    expect(html).toContain('<p class="abs-chemise-sous">Congés, maladies, formations et justificatifs</p>')
    expect(html).toContain('aria-label="Sections de la page Absences"')
  })
})
