// ═══════════════════════════════════════════════════════════
// 🧶 LA REFONTE DES JOURS FÉRIÉS — ce que les tests défendent
//
// Le motif du Lesotho n'est pas un décor posé sur une page : la page
// entière en découle. Ces tests tiennent les points qui cassent
// silencieusement une refonte :
//
//   · le bandeau suit la route et reste la même identité que Pauses ;
//   · la lisière de l'année place chaque fête au bon mois, y compris
//     les fêtes récurrentes ramenées à l'année affichée ;
//   · le chargement est dessiné, pas photographié ;
//   · le vieux décor violet ne revient pas par une porte dérobée ;
//   · les contrôles sont dessinés (interrupteurs), pas des cases.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import JoursFeries from '../../pages/JoursFeries'
import PageCulturalBand from '../../components/PageCulturalBand'
import { culturalMotifForPath } from '../../components/culturalMotif'
import JoursFeriesAnnee from '../../components/JoursFeriesAnnee'
import JoursFeriesLoading from '../../components/JoursFeriesLoading'
import {
  LesothoSceauSvg,
  LesothoLosangeSvg,
  LesothoCoutureSvg,
  LesothoLisiereSvg,
} from '../../components/LesothoMotif'

//  Les services sont simulés : on teste la page, pas la base.
const { basculer } = vi.hoisted(() => ({ basculer: vi.fn(async () => ({ success: true })) }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      const lignes = table === 'enterprises'
        ? [{ id: 'e1', name: 'Kandi SARL', code: 'KANDI' }]
        : [{ id: 'p1', name: 'Ouverture de l’usine', date: '2026-03-09', is_recurring: false, is_worked: false, overtime_rate: 100 }]
      const requete = {
        select: () => requete,
        eq: () => requete,
        order: () => Promise.resolve({ data: lignes, error: null }),
      }
      return requete
    },
  },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: vi.fn() }),
}))

vi.mock('../../services/holidayService', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    default: {
      getGlobalHolidays: async () => [
        { id: 'g1', name: 'Fête de l’Indépendance', date: '1960-08-01', is_recurring: true, country_code: 'ZZ', is_worked: false, overtime_rate: 100 },
        { id: 'g2', name: 'Noël', date: '2024-12-25', is_recurring: true, country_code: 'ZZ', is_worked: false, overtime_rate: 100 },
      ],
      getEnterpriseOverrides: async () => [],
      toggleGlobalHoliday: basculer,
    },
  }
})

const PAGE = readFileSync('src/pages/JoursFeries.jsx', 'utf8')
const CSS = readFileSync('src/pages/JoursFeries.css', 'utf8')
const FRISE = readFileSync('src/components/JoursFeriesAnnee.jsx', 'utf8')
const BAND_CSS = readFileSync('src/components/PageCulturalBand.css', 'utf8')

const globalHolidays = [
  { id: 'g1', name: 'Fête de l’Indépendance', date: '1960-08-01', is_recurring: true, country_code: 'ZZ', is_worked: false, overtime_rate: 100 },
  { id: 'g2', name: 'Noël', date: '2024-12-25', is_recurring: true, country_code: 'ZZ', is_worked: false, overtime_rate: 100 },
  { id: 'g3', name: 'Journée des Martyrs', date: '2026-01-16', is_recurring: false, country_code: 'ZZ', is_worked: true, overtime_rate: 50 },
]

const ownHolidays = [
  { id: 'p1', name: 'Ouverture de l’usine', date: '2026-03-09', is_recurring: false, is_worked: false, overtime_rate: 100 },
]

describe('1. le bandeau suit la page, et c’est bien le Lesotho', () => {
  it('la route des jours fériés porte le motif du textile', () => {
    expect(culturalMotifForPath('/jours-feries')).toBe('lesotho')
    expect(culturalMotifForPath('/jours-feries?annee=2026')).toBe('lesotho')
    expect(culturalMotifForPath('/jours-feries/')).toBe('lesotho')
    //  la même identité que Pauses, et pas un repli sur le Kente
    expect(culturalMotifForPath('/pauses')).toBe('lesotho')
  })

  it('le bandeau est un vrai bandeau Lesotho, pas une image inventée', () => {
    const html = renderToStaticMarkup(<PageCulturalBand pathname="/jours-feries" />)
    expect(html).toContain('data-cultural-motif="lesotho"')
    expect(html).toContain('ec-cultural-top')
    expect(BAND_CSS).toContain(".ec-cultural-band[data-cultural-motif='lesotho'] { background-image: url('/images/pauses-lesotho.webp')")
    //  même hauteur que les autres pages, et le filet du bas
    expect(BAND_CSS).toContain('.ec-cultural-band { width: 100%; height: 76px;')
    expect(BAND_CSS).toContain('.ec-cultural-bottom { height: 32px; }')
  })

  it('la page et son chargement portent tous les deux le bandeau', () => {
    //  Deux fois : le bandeau n'est plus une frise en haut de page, il
    //  ENTOURE la bande du seuil — une fois dessus, une fois dessous,
    //  le second retourné (26/11, image 4).
    expect(PAGE.match(/<PageCulturalBand pathname="\/jours-feries" \/>/g)).toHaveLength(2)
    expect(PAGE).toContain('<div className="jf-seuil-bandeau">')
    expect(CSS).toContain('.jf-seuil-bandeau > .ec-cultural-band:last-child')
    const html = renderToStaticMarkup(<JoursFeriesLoading darkMode />)
    expect(html.match(/data-cultural-motif="lesotho"/g)).toHaveLength(2)
    expect(html).toContain('ec-cultural-bottom')
  })
})

describe('2. la lisière de l’année place chaque fête', () => {
  const html = renderToStaticMarkup(
    <JoursFeriesAnnee
      annee={2026}
      globalHolidays={globalHolidays}
      ownHolidays={ownHolidays}
      isGlobalEnabled={() => true}
      prochain={{ jour: 16, mois: 0 }}
    />
  )

  it('les douze mois sont tissés', () => {
    expect(html.match(/class="jf-annee-mois"/g)).toHaveLength(12)
    for (const mois of ['janv.', 'févr.', 'mars', 'juin', 'juil.', 'déc.']) {
      expect(html).toContain(mois)
    }
  })

  it('une fête récurrente est ramenée à l’année affichée', () => {
    //  1960-08-01 doit tomber en août 2026, pas en 1960
    expect(html).toContain('1 août — Fête de l’Indépendance')
    expect(html).toContain('25 décembre — Noël')
  })

  it('une fête datée d’une autre année ne s’affiche pas', () => {
    //  « Journée des Martyrs » est datée de 2026 : elle doit être là
    expect(html).toContain('16 janvier — Journée des Martyrs, fête du pays, travaillée')
    //  mais pas en 2027
    const autre = renderToStaticMarkup(
      <JoursFeriesAnnee annee={2027} globalHolidays={globalHolidays} ownHolidays={[]} />
    )
    expect(autre).not.toContain('Journée des Martyrs')
    //  les récurrentes, elles, suivent
    expect(autre).toContain('1 août — Fête de l’Indépendance')
  })

  it('les fêtes de l’entreprise se distinguent de celles du pays', () => {
    expect(html).toContain('data-origine="entreprise"')
    expect(html).toContain('9 mars — Ouverture de l’usine, fête de l’entreprise')
  })

  it('la prochaine fête, si elle tombe après l’année affichée, est dite à côté', () => {
    const html = renderToStaticMarkup(
      <JoursFeriesAnnee
        annee={2026}
        globalHolidays={globalHolidays}
        ownHolidays={[]}
        noteSuivante="La prochaine fête tombe en 2027 : lundi 1 février 2027."
      />
    )
    expect(html).toContain('La prochaine fête tombe en 2027')
    expect(html).toContain('jf-annee-suite')
  })

  it('le sceau du titre a sa propre classe et sa propre cellule', () => {
    //  La panne du 27/11 : le médaillon du Lesotho tombait AU MILIEU de
    //  « Jours fériés ». Le sceau était un `svg` sans classe, visé par un
    //  sélecteur `> svg` qui ne l'attrapait pas.
    expect(PAGE).toContain('className="jf-sceau"')
    expect(CSS).toContain('.jf-page .jf-entete > .jf-sceau {')
    //  …et il ne porte PLUS de placement : le 28/11, la capture montrait
    //  encore le sceau et les quatre mesures par-dessus le titre. La cause
    //  était une règle `grid-column` écrite hors media query (spécificité
    //  0,3,0) qui battait les paliers (0,2,0), même placés après elle.
    //  Le placement n'appartient plus qu'aux paliers, tout en bas du fichier.
    const blocSceau = CSS.match(/\.jf-page \.jf-entete > \.jf-sceau \{([^}]*)\}/)
    expect(blocSceau).not.toBeNull()
    expect(blocSceau[1]).not.toMatch(/grid-column/)
    expect(blocSceau[1]).not.toMatch(/grid-row/)
  })

  it('le sélecteur d’entreprise de l’en-tête est retiré', () => {
    //  « Enlève ce bouton sélecteur » (27/11, image 2) — le rail le porte.
    expect(PAGE).not.toContain('jf-entreprise')
    expect(PAGE).not.toContain('Entreprise dont on règle les jours fériés')
  })

  it('la frise ne se chevauche ni en colonne ni en grille', () => {
    //  Colonne étroite : la cible de l'épingle tient dans la piste, et la
    //  marge de fin grandit avec elle au lieu d'être figée.
    //  Une épingle est un élément de FLUX, à toutes les largeurs : c'est le
    //  mois qui la range, et il passe à la ligne quand il est chargé. Plus
    //  de position absolue à un pourcentage, donc plus de superposition.
    expect(CSS).toMatch(/\.jf-frise \.jf-annee-piste > \.jf-repere[\s\S]*?position: relative;/)
    expect(CSS).toMatch(/\.jf-frise \.jf-annee-piste \{\s*position: relative;\s*display: flex;\s*flex-wrap: wrap;/)
    //  La piste ne réserve plus de marge pour la cible : elle n'en a plus
    //  besoin, l'épingle ne sort pas du flux.
    expect(CSS).not.toContain('margin: 0 calc(10px + 6%) 0 0;')
    //  Une seule définition de bande : douze colonnes fixes = douze cellules
    //  de 150 px, où douze épingles de janvier s'empilaient sur trois rangs.
    const sectionsFrise = CSS.slice(CSS.indexOf("LA FRISE, RÉÉCRITE UNE FOIS POUR TOUTES"))
    expect(sectionsFrise.match(/\.jf-frise \.jf-annee-bande \{/g)).toHaveLength(2)
    expect(CSS).toContain('grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));')
  })

  it('le placement de l’en-tête n’est dit que par les paliers de largeur', () => {
    //  La panne du 28/11, et c'est la même que celle du 27/11 sous une autre
    //  forme : une règle de placement écrite UNE FOIS, hors media query, gagne
    //  sur tous les paliers à cause de sa spécificité. Au-dessus de 1 200 px,
    //  `.jf-page .jf-entete > .jf-sceau { grid-column: 2 }` valait (0,3,0) ;
    //  la règle du palier `.jf-entete > .jf-sceau` ne vaut que (0,2,0) et
    //  perdait, même écrite après. Résultat : sceau et mesures sur le titre.
    //
    //  Désormais, chaque palier parle de la même façon (`.jf-entete > …`),
    //  et aucune règle de placement ne vit hors media query.
    //  On retire les commentaires (le mot « @media » y figure parfois), puis
    //  on retire le CONTENU de chaque bloc média : ce qui reste est le niveau 0.
    const sansCommentaires = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    const horsMedia = sansCommentaires.replace(
      /@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g,
      ''
    )
    const fautives = (horsMedia.match(/[^{}]+\{[^{}]*\}/g) || []).filter(
      r => /\.jf-entete|\.jf-sceaux|\.jf-sceau\b|\.jf-titre-bloc/.test(r)
        && /grid-(?:column|row):\s*\d/.test(r)
    )
    expect(fautives).toEqual([])
    //  Les quatre paliers existent, et ils posent bien le titre sur sa ligne.
    for (const palier of ['min-width: 1201px', 'max-width: 1200px', 'max-width: 900px', 'max-width: 560px']) {
      expect(CSS).toContain(palier)
    }
    expect(CSS).toMatch(/@media \(max-width: 1200px\)[\s\S]*?\.jf-entete > \.jf-titre-bloc \{[\s\S]*?grid-row: 2;/)
    expect(CSS).toMatch(/@media \(max-width: 1200px\)[\s\S]*?\.jf-entete > \.jf-sceaux \{[\s\S]*?grid-row: 3;/)
  })

  it('aucune épingle ne porte de décalage en ligne', () => {
    //  Deuxième cause du 28/11 : le composant écrivait `style={{ left: X% }}`.
    //  Sur une épingle devenue `position: relative`, ce pourcentage ne place
    //  rien : il DÉCALE la pastille de X % de la largeur de la piste. Les
    //  douze fêtes de janvier partaient donc à droite, par-dessus février.
    //  C'est le composant qui trie, plus le CSS qui absolutise.
    expect(FRISE).not.toContain('style: { left:')
    expect(FRISE).toContain('.sort(')
  })

  it('le seuil reste une ligne sur grand écran et empile ses faits sur mobile', () => {
    expect(CSS).toMatch(/\.jf-page \.jf-seuil-gauche \{\s*display: flex;\s*flex-direction: row;/)
    expect(CSS).toMatch(/@media \(max-width: 720px\) \{[\s\S]*?\.jf-page \.jf-seuil-gauche \{\s*display: flex;\s*flex-direction: column;/)
  })

  it('le titre ne se coupe jamais lettre à lettre', () => {
    //  La panne du 27/11 : entre 900 et 1 200 px, la colonne du titre tombait
    //  à min-content — une lettre — et « Jours fériés » s'écrivait à la
    //  verticale sur 750 px de haut.
    //  1. le titre refuse la césure et le retour dans un mot, à toute largeur ;
    expect(CSS).toContain('.jf-page .jf-titre {')
    expect(CSS).toMatch(/\.jf-page \.jf-titre \{[^}]*overflow-wrap: normal;/)
    expect(CSS).toMatch(/\.jf-page \.jf-titre \{[^}]*hyphens: none;/)
    expect(CSS).toMatch(/\.jf-page \.jf-titre \{[^}]*min-width: min-content;/)
    //  2. la colonne du titre ne peut plus s'écraser : plancher de contenu.
    expect(CSS).toContain('grid-template-columns: auto auto minmax(min-content, 1fr) auto auto;')
    //  3. sous 1 200 px, le titre prend une ligne à lui, pleine largeur.
    expect(CSS).toMatch(/@media \(max-width: 1200px\) \{[\s\S]*?\.jf-entete > \.jf-titre-bloc \{\s*grid-column: 1 \/ -1;/)
  })

  it('le rang du haut est droit : plus de marges héritées', () => {
    //  Sa capture du 28/11, fenêtre réduite : « le bouton flèche retour un
    //  peu plus à gauche, tu peux un peu espacer les éléments en haut ».
    //  Deux marges de l'ancienne mise en page — quand le sceau vivait à CÔTÉ
    //  du titre — n'avaient jamais été annulées : `margin-top: 34px` sur le
    //  retour, `margin-top: 16px` sur le sceau. Elles désalignaient le rang.
    const retour = CSS.match(/\.jf-retour \{([^}]*)\}/)
    expect(retour).not.toBeNull()
    expect(retour[1]).not.toMatch(/margin-top/)
    const sceauSvg = CSS.match(/\.jf-entete > svg \{([^}]*)\}/)
    expect(sceauSvg).not.toBeNull()
    expect(sceauSvg[1]).not.toMatch(/margin-top/)
    //  …et la remise à zéro est écrite une fois, pour toutes les largeurs.
    expect(CSS).toMatch(
      /\.jf-page \.jf-entete > \.jf-retour,[\s\S]{0,120}\.jf-page \.jf-entete > \.jf-sceau \{\s*margin-top: 0;/
    )
  })

  it('les éléments du haut ne se touchent pas', () => {
    //  Deux disques de 42 et 62 px à 14 px l'un de l'autre se touchaient
    //  presque ; la grille de deux mesures tenait à `gap: 10px`, si bien que
    //  l'ombre de l'un recouvrait le bord de l'autre.
    expect(CSS).toMatch(/@media \(max-width: 900px\)[\s\S]*?column-gap: 18px;/)
    expect(CSS).toMatch(/@media \(max-width: 560px\)[\s\S]*?gap: 16px 18px;/)
  })

  it('le retour tombe au même endroit que sur Pauses', () => {
    //  Sa remarque du 28/11 : « le bouton flèche retour n'est pas
    //  proportionnellement au même endroit que dans la page Pauses ».
    //
    //  Les deux pages ne se tenaient pas de la même façon. Pauses a UNE
    //  enveloppe (1 440 px, gouttière clamp(16px, 2.5vw, 34px)) et l'enseigne
    //  du retour est dedans. Jours fériés avait une coque plus étroite
    //  (1 360 px) ET un en-tête qui ajoutait sa propre gouttière par-dessus,
    //  différente à chaque palier.
    //
    //  On ne copie pas un nombre, on copie la structure : la largeur et la
    //  gouttière appartiennent à la coque, l'en-tête n'en ajoute pas.
    expect(CSS).toMatch(/\.jf-coque \{\s*width: min\(1440px, 100%\);/)
    expect(CSS).toMatch(/\.jf-coque \{\s*width: min\(1440px, 100%\);[\s\S]{0,200}?padding: clamp\(16px, 2\.4vw, 30px\) clamp\(16px, 2\.5vw, 34px\)/)

    //  …et l'en-tête ne rajoute pas la sienne par-dessus.
    expect(CSS).toMatch(/\.jf-page \.jf-entete \{\s*padding-left: 0;\s*padding-right: 0;/)

    //  Aucun palier ne doit plus rétrécir la gouttière de la coque : ce sont
    //  les deux règles qui la ramenaient à 12 puis 10 px.
    expect(CSS).not.toMatch(/\.jf-coque \{ padding: 14px 12px/)
    expect(CSS).not.toMatch(/\.jf-coque \{ padding: 12px 10px/)
  })

  it('le sous-titre est retiré, et la page tient sur petit écran', () => {
    //  « Enlève ce texte » (26/11) : la phrase de présentation ne s'affiche
    //  plus. L'eyebrow et le titre restent.
    expect(PAGE).not.toContain('jf-sous-titre')
    expect(PAGE).not.toContain('coudre les siennes')
    expect(PAGE).toContain('Le calendrier tissé')

    //  « Rends la page responsive en toute taille d'écran » (26/11) : les
    //  paliers existent, et la page ne peut pas déborder en largeur.
    for (const palier of [1200, 1080, 900, 720, 480]) {
      expect(CSS).toContain(`@media (max-width: ${palier}px)`)
    }
    expect(CSS).toContain('overflow-x: clip')
    expect(CSS).toContain('.jf-corps { grid-template-columns: minmax(0, 1fr); gap: 20px; }')
  })

  it('la modale est un panneau, pas un disque', () => {
    //  La panne du 26/11 : `--jf-radius-piece` valait 999 px, donc le panneau
    //  se refermait en cercle et l'on ne voyait ni les champs ni le pied.
    expect(CSS).toContain('--jf-radius-piece: 34px;')
    expect(CSS).not.toContain('--jf-radius-piece: 999px;')
  })

  it('un repère ouvre la fiche de sa fête, il ne filtre pas', () => {
    //  « Quand on clique sur un point ça doit nous diriger vers le jour férié
    //  dédié » (26/11, image 3).
    expect(PAGE).toContain('onChoisirRepère')
    expect(PAGE).toContain('openEditModal(fete)')
  })

  it('l’entreprise montre son logo dans la bande du seuil', () => {
    //  « Affiche l'image de l'entreprise aussi » (26/11, image 4).
    expect(PAGE).toContain('jf-seuil-logo')
    expect(PAGE).toContain('logo_url')
  })

  it('les repères deviennent des boutons quand la page sait les ouvrir', () => {
    //  « Rends cette lisière cliquable » (26/11, image 2) : chaque repère
    //  appelle la page avec sa fête, son origine et son pays.
    const cliquable = renderToStaticMarkup(
      <JoursFeriesAnnee
        annee={2026}
        globalHolidays={globalHolidays}
        ownHolidays={ownHolidays}
        isGlobalEnabled={() => true}
        onChoisirRepere={() => {}}
        repereActif="g-g1"
      />
    )
    expect(cliquable).toContain('<button')
    expect(cliquable).toContain('type="button"')
    expect(cliquable).toContain('data-actif-choix="oui"')
    expect(cliquable).toContain('voir la fiche')
  })

  it('sans gestionnaire, le repère reste un point nommé', () => {
    //  La lisière s'affiche ailleurs (aperçus, tests) sans devenir un bouton
    //  mort : c'est la page qui décide.
    expect(html).not.toContain('<button')
    expect(html).toContain('role="img"')
  })

  it('une fête désactivée est marquée comme telle', () => {
    const desactive = renderToStaticMarkup(
      <JoursFeriesAnnee annee={2026} globalHolidays={globalHolidays} ownHolidays={[]} isGlobalEnabled={id => id !== 'g2'} />
    )
    expect(desactive).toContain('25 décembre — Noël, fête du pays, désactivée')
  })
})

describe('3. le chargement est dessiné', () => {
  const html = renderToStaticMarkup(<JoursFeriesLoading darkMode onSkip={() => {}} />)

  it('aucune photographie : une scène vectorielle', () => {
    expect(html).not.toContain('<img')
    expect(html).toContain('<svg')
    expect(html).toContain('jf-metier')
    expect(html).toContain('jf-metier-navette')
    expect(html).toContain('jf-metier-trame')
  })

  it('il annonce ce qu’il fait, et ne prétend rien de plus', () => {
    expect(html).toContain('role="status"')
    expect(html).toContain('Chargement des jours fériés du pays et de ceux de votre entreprise.')
    expect(html).toContain('Aucune date n’est')
    expect(html).toContain('Passer l’animation')
  })

  it('il s’arrête pour qui préfère ne pas voir d’animation', () => {
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)')
    expect(CSS).toMatch(/\.jf-metier-trame \{\s*animation: none;/)
    expect(CSS).toMatch(/\.jf-losange \{\s*animation: none;\s*opacity: 1;/)
  })
})

describe('4. le vieux décor ne revient pas', () => {
  it('plus de violet, plus de fond nocturne d’origine', () => {
    expect(PAGE).not.toMatch(/#8b5cf6/i)
    expect(PAGE).not.toMatch(/#7c3aed/i)
    expect(PAGE).not.toMatch(/#0a0a0f/i)
    expect(PAGE).not.toMatch(/rgba\(139,\s*92,\s*246/i)
    expect(CSS).not.toMatch(/#8b5cf6/i)
    expect(CSS).not.toMatch(/linear-gradient\(135deg,\s*#8b5cf6/i)
    //  et aucune orbite décorative de l'ancienne page
    expect(PAGE).not.toContain('bgOrb')
  })

  it('les couleurs viennent du textile : indigo, crème, terre cuite', () => {
    for (const couleur of ['#14263c', '#efe7d7', '#b4622a', '#8b3e1d', '#08151f']) {
      expect(CSS.toLowerCase()).toContain(couleur)
    }
  })

  it('la page a bien deux thèmes, et pas un seul fond sombre', () => {
    expect(CSS).toContain('.jf-page.jf-clair {')
    //  « Enlève le bouton sombre/clair » (26/11) : la page ne suit plus le
    //  thème, elle tient LE sien — le champ de crème de la maquette.
    expect(PAGE).toContain('<div className="jf-page jf-clair">')
    expect(CSS).toContain('.jf-page:not(.jf-clair)')
    //  « Enlève le bouton sombre/clair » (26/11) : la bascule ne vit plus
    //  dans l'en-tête de la page, c'est le rail de la sidebar qui la porte.
    expect(PAGE).not.toContain('jf-bascule')
    expect(PAGE).toContain('surTheme={toggleTheme}')
  })

  it('les contrôles sont dessinés, pas des cases à cocher', () => {
    expect(PAGE).not.toContain('type="checkbox"')
    expect(PAGE).toContain('className="jf-interrupteur"')
    expect(PAGE).toContain("aria-checked={active}")
    expect(PAGE).toContain("aria-pressed={form.is_recurring}")
    expect(PAGE).toContain("aria-pressed={form.is_worked}")
    expect(CSS).toContain('.jf-interrupteur[aria-checked=\'true\']::after')
  })
})

describe('5. les autres écrans restent à portée', () => {
  it('les raccourcis ont quitté la coque, la sidebar y est entrée', () => {
    //  « Enlève les raccourcis » (26/11) : plus de barre de raccourcis ici.
    expect(PAGE).not.toContain('RaccourcisPages')
    expect(PAGE).not.toContain('jf-raccourcis')
    //  « Ramène la sidebar et son rail dans cette page » (26/11).
    expect(PAGE).toContain("import SidebarUnique from '../components/SidebarUnique'")
    expect(PAGE).toContain('import CoqueAdmin from')
    expect(PAGE).toContain('<CoqueAdmin')
    expect(PAGE).toContain('<SidebarUnique')
  })

  it('l’explication est repliée, pas imposée', () => {
    expect(PAGE).toContain('<details className="jf-explication">')
    expect(PAGE).toContain('Ce qu’un jour férié change dans les calculs')
  })
})

describe('6. les cinq pièces du motif se dessinent', () => {
  it('chaque pièce est un SVG décoratif, sans texte inventé', () => {
    const pieces = [
      renderToStaticMarkup(<LesothoSceauSvg />),
      renderToStaticMarkup(<LesothoLosangeSvg />),
      renderToStaticMarkup(<LesothoCoutureSvg />),
      renderToStaticMarkup(<LesothoLisiereSvg />),
    ]
    for (const html of pieces) {
      expect(html).toContain('<svg')
      expect(html).toContain('aria-hidden="true"')
      expect(html).toContain('focusable="false"')
    }
    //  la lisière s'étire : elle ne doit pas se déformer au passage
    expect(pieces[3]).toContain('preserveAspectRatio="none"')
  })

  it('le sceau garde les trois tons du textile', () => {
    for (const ton of ['indigo', 'terre', 'craie']) {
      expect(renderToStaticMarkup(<LesothoSceauSvg ton={ton} />)).toContain('<svg')
    }
    //  un ton inconnu retombe sur la terre cuite plutôt que de casser
    expect(renderToStaticMarkup(<LesothoSceauSvg ton="inexistant" />)).toContain('<svg')
  })
})

describe('7. le texte reste lisible dans les deux thèmes', () => {
  const luminance = (hex) => {
    const [r, g, b] = hex.replace('#', '').match(/[0-9a-f]{2}/gi)
      .map(h => parseInt(h, 16) / 255)
      .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contraste = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
    return (x + 0.05) / (y + 0.05)
  }
  const bloc = (selecteur) => {
    const debut = CSS.indexOf(selecteur)
    expect(debut).toBeGreaterThan(-1)
    const fin = CSS.indexOf('}', debut)
    return CSS.slice(debut, fin)
  }
  const jeton = (source, nom) => {
    const m = source.match(new RegExp(`--jf-${nom}: (#[a-fA-F0-9]{6});`))
    expect(m, nom).not.toBeNull()
    return m[1]
  }

  it('les trois niveaux de texte passent 4,5:1, en sombre comme en clair', () => {
    const sombre = bloc('.jf-page {')
    const clair = bloc('.jf-page.jf-clair {')

    for (const [source, nom] of [[sombre, 'sombre'], [clair, 'clair']]) {
      const fonds = [jeton(source, 'panneau'), jeton(source, 'nuit')]
      for (const niveau of ['craie', 'craie-douce', 'craie-faible']) {
        for (const fond of fonds) {
          expect(
            contraste(jeton(source, niveau), fond),
            `${nom} · ${niveau} sur ${fond}`
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
      //  le petit texte d'accent (l'eyebrow) doit tenir aussi
      expect(contraste(jeton(source, 'terre-clair'), jeton(source, 'panneau')), nom).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('le bouton de suppression garde un texte lisible sur son rouge', () => {
    expect(contraste('#fff6ea', '#a83226')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('8. la page se monte et répond', () => {
  let hote
  let racine

  beforeEach(async () => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.setItem('admin', JSON.stringify({
      role: 'admin',
      enterprise_id: 'e1',
      selectedEnterprise: { id: 'e1', name: 'Kandi SARL' },
    }))
    hote = document.createElement('div')
    document.body.append(hote)
    racine = createRoot(hote)

    await act(async () => {
      racine.render(<MemoryRouter><JoursFeries /></MemoryRouter>)
    })
    //  le plancher du chargement (1 400 ms) puis les lectures
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
  })

  afterEach(async () => {
    await act(async () => racine.unmount())
    hote.remove()
    vi.useRealTimers()
    basculer.mockClear()
  })

  it('la coque s’affiche avec son bandeau, son titre et ses mesures', () => {
    expect(hote.querySelector('.jf-page')).not.toBeNull()
    expect(hote.querySelector('[data-cultural-motif="lesotho"]')).not.toBeNull()
    expect(hote.querySelector('h1').textContent).toContain('Jours fériés')
    expect(hote.querySelectorAll('.jf-mesure')).toHaveLength(4)
    expect(hote.querySelector('.jf-annee')).not.toBeNull()
    //  « Enlève les raccourcis » (26/11) : la capsule du seuil n'en porte plus.
    expect(hote.querySelector('[data-testid="raccourcis-pages"]')).toBeNull()
    //  « Ramène la sidebar et son rail dans cette page » (26/11).
    expect(hote.querySelector('.sb')).not.toBeNull()
  })

  it('le registre du pays liste les fêtes, avec un interrupteur dessiné', () => {
    expect(hote.querySelectorAll('.jf-jour')).toHaveLength(2)
    const interrupteur = hote.querySelector('.jf-interrupteur')
    expect(interrupteur).not.toBeNull()
    expect(interrupteur.getAttribute('role')).toBe('switch')
    expect(interrupteur.getAttribute('aria-checked')).toBe('true')
    //  aucune case à cocher native dans la page
    expect(hote.querySelector('input[type="checkbox"]')).toBeNull()
  })

  it('l’interrupteur bascule la fête pour cette entreprise', async () => {
    const interrupteur = hote.querySelector('.jf-interrupteur')
    await act(async () => {
      interrupteur.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(basculer).toHaveBeenCalledWith('e1', 'g1', false)
  })

  it('un pays absent du catalogue affiche son code, sans drapeau inventé', async () => {
    //  les données de test portent « ZZ » : un code que le catalogue ignore
    //  (le Bénin, lui, y est entré : c'est le modèle de fêtes du round 19)
    const pastille = [...hote.querySelectorAll('.jf-pays-puce')]
      .find(b => b.textContent.includes('ZZ'))
    expect(pastille).toBeTruthy()
    expect(pastille.querySelector('.jf-pays-drapeau')).toBeNull()
    //  la ligne de registre affiche le code, pas un globe générique
    const meta = hote.querySelector('.jf-jour-meta')
    expect(meta.textContent).toContain('ZZ')
    expect(meta.textContent).not.toContain('🌍')
  })

  it('le second registre montre les fêtes de l’entreprise', async () => {
    const ongletMaison = hote.querySelector('#jf-onglet-maison')
    await act(async () => {
      ongletMaison.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(ongletMaison.getAttribute('aria-selected')).toBe('true')
    expect(hote.textContent).toContain('Ouverture de l’usine')
    expect(hote.querySelector('.jf-jour[data-origine="entreprise"]')).not.toBeNull()
  })

  it('les deux registres portent leur onglet et leur panneau', () => {
    expect(hote.querySelector('[role="tablist"]')).not.toBeNull()
    expect(hote.querySelector('#jf-onglet-pays').getAttribute('aria-selected')).toBe('true')
    expect(hote.querySelector('#jf-registre-pays')).not.toBeNull()
  })
})
