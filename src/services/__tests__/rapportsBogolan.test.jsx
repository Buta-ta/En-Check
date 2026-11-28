// ═══════════════════════════════════════════════════════════
// ✍️ LES REGISTRES DE CRAIE, SUR LE PAGNE — la peau de Rapports
//
// 29/11 : « Cette page on va la garder telle quelle mais on va seulement
// appliquer le style brut adouci, double feutre. Enlever les raccourcis, le
// bouton sombre/clair. Retravaille un peu les formes de certains blocs.
// Remplace le bandeau motif actuel par le bandeau bogolan, en suite entoure le
// bloc en haut par ce bogolan exactement comme dans la page Rémunération. »
//
// Le verrou de ce fichier est dans « **garder telle quelle** » : aucun bloc
// déplacé, aucun libellé réécrit, aucune requête ni calcul de rapport touché.
// Ce qui a bougé est de l'encre et de la géométrie — et deux suppressions
// nommées. Les lois ci-dessous ne vérifient donc pas le métier (sections 5 et
// 6 : il est le même qu'avant) mais que la peau demandée est bien posée, au
// même endroit et de la même façon qu'à Rémunérations.
//
//   ① le tissu : une carte, un seul motif pour les deux bandeaux ;
//   ② l'enveloppe : la copie de `.rw-entete`, mesurée sur les deux feuilles ;
//   ③ les deux suppressions, et ce qu'elles emportent ;
//   ④ la feuille : des jetons, pas une charte parallèle ;
//   ⑤ le nsibidi qui RESTE (le blason, la frise) ;
//   ⑥ le métier et les mots, intacts.
// ═══════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import PageCulturalBand from '../../components/PageCulturalBand'
import { culturalMotifForPath } from '../../components/culturalMotif'
import { NsibidiBlasonSvg, NsibidiFriseSvg } from '../../components/NsibidiSvg'

const PAGE = readFileSync('src/pages/Rapports.jsx', 'utf8')
const CSS = readFileSync('src/pages/Rapports.css', 'utf8')
const RW = readFileSync('src/pages/Remunerations.css', 'utf8')
const CARTE = readFileSync('src/components/culturalMotif.js', 'utf8')
const PARTAGE = readFileSync('src/components/PageCulturalBand.css', 'utf8')
const FRISE = readFileSync('src/components/NsibidiSvg.jsx', 'utf8')
const PDF = readFileSync('src/utils/documentsRapports.js', 'utf8')

/*  ⚠️ Toutes les lois de ce fichier lisent le texte DÉGOMMÉ. La page comme la
    feuille expliquent les interdictions en les nommant (« ET SURTOUT PAS
    `loading` », « la rangée Aller à est tombée ») : une loi qui lirait le brut
    crierait sur sa propre documentation — et une loi qu'on amende pour se
    taire ne prévient plus. Mesuré le 28/11 à Rémunérations, chap. 23. */
const nu = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
const PAGE_NUE = nu(PAGE)
const CSS_NUE = nu(CSS)

/**  Le corps d'une règle, à partir de son sélecteur, et HORS COMMENTAIRES :
    une feuille qui explique une interdiction dans ses commentaires ne doit pas
    la faire rougir — `not.toMatch(/border: 1px/)` lu sur le texte brut échouerait
    sur la phrase qui dit que le 1 px est mort. */
const degommente = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
const regle = (source, selecteur) => {
  const nu = degommente(degommente(source))
  const propre = selecteur.replace(/\s*\{$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(^|\\n)${propre} \\{`).exec(nu)
  expect(m, `règle introuvable : ${selecteur}`).not.toBeNull()
  const debut = m.index + m[1].length
  return nu.slice(debut, nu.indexOf('}', debut))
}
const corps = (selecteur) => regle(CSS, selecteur)
const corpsRW = (selecteur) => regle(RW, selecteur)

// ── 1. Le tissu ────────────────────────────────────────────

describe('1. le bogolan est la toile de la page', () => {
  it('la carte des motifs répond bogolan, et une seule fois', () => {
    for (const chemin of ['/rapports', '/rapports/', '/rapports?periode=mois']) {
      expect(culturalMotifForPath(chemin)).toBe('bogolan')
    }
    // une ligne par page dans la carte : pas de règle `rapports` de rechange
    expect((CARTE.match(/page === 'rapports'/g) || [])).toHaveLength(1)
  })

  it('les deux bandeaux lisent la carte, sans motif posé à la main', () => {
    expect(PAGE).toContain('<PageCulturalBand pathname="/rapports" />')
    expect(PAGE).toContain('<PageCulturalBand pathname="/rapports" placement="bottom" />')
    expect(PAGE).toContain('className="rp-pied"')
    // aucun `data-cultural-motif` forcé depuis la page : la carte suffit
    expect(PAGE_NUE).not.toMatch(/data-cultural-motif/)
    const rendu = renderToStaticMarkup(<PageCulturalBand pathname="/rapports" />)
    expect(rendu).toContain('data-cultural-motif="bogolan"')
    expect(rendu).toContain('aria-hidden="true"')
    expect(rendu).not.toContain('<svg')
  })

  it('ne redessine pas une bande à côté du bandeau partagé', () => {
    // la couture de craie (9 px de pointillés) est morte, et sa règle avec elle
    expect(PAGE_NUE).not.toContain('rp-bordure')
    expect(CSS).not.toMatch(/\.rp-bordure/)
    // la hauteur du bandeau reste réglée par la feuille partagée : rien ici
    expect(corps('.rp-pied')).not.toMatch(/(?:^|[\s;])height:/)
    expect(PARTAGE).toMatch(/\.ec-cultural-band \{[^}]*height: 76px/)
    expect(PARTAGE).toMatch(/\.ec-cultural-bottom \{ height: 32px/)
    // et l'image du bogolan existe, en haut comme en bas
    expect(PARTAGE).toContain(".ec-cultural-band[data-cultural-motif='bogolan']")
    expect(PARTAGE).toContain('.ec-cultural-band[data-cultural-motif=\'bogolan\'].ec-cultural-bottom')
  })
})

// ── 2. L'enveloppe : la copie du cartouche de Rémunérations ─

describe('2. le bloc du haut est cerclé d’étoffe, comme à Rémunérations', () => {
  it('la plaque est posée dans l’étoffe, à la même cote', () => {
    const entete = corps('.rp-entete')
    expect(entete).toContain('position: sticky')
    expect(entete).toContain('top: 0')
    expect(entete).toContain('isolation: isolate')
    expect(entete).toContain('padding: var(--rp-tissu)')
    expect(entete).toContain('border-radius: var(--rp-rayon-bloc)')
    // l'épaisseur est UN jeton, comme `--rw-tissu`
    expect(corps('.rp-page')).toContain('--rp-tissu: var(--charte-espace-5)')
    expect(corpsRW('.rw-page,\n.rw-chargement')).toContain('--rw-tissu: var(--charte-espace-5)')
  })

  it('le tour est fait des deux mêmes fichiers, aux quatre bords', () => {
    const avant = corps('.rp-entete::before')
    const modele = corpsRW('.rw-entete::before')
    for (const mot of ['repeat-x, repeat-x, repeat-y, repeat-y',
      'left top, left bottom, left top, right top',
      'box-shadow: var(--charte-ombre-dure)', 'pointer-events: none']) {
      expect(avant, `le tour n'est plus le même qu'à Rémunérations : ${mot}`)
        .toContain(mot)
      expect(modele).toContain(mot)
    }
    expect(CSS).toContain("--rp-tissu-haut: url('/images/paie-bogolan-haut.webp')")
    expect(CSS).toContain("--rp-tissu-filet: url('/images/bogolan-vertical.webp')")
    // chaque couche est ramenée à l'épaisseur sur UN seul axe : jamais étirée
    expect(avant).toContain('auto var(--rp-tissu), auto var(--rp-tissu),')
    expect(avant).toContain('var(--rp-tissu) auto, var(--rp-tissu) auto')
  })

  it('la plaque est reculée de l’épaisseur exacte, sans bord', () => {
    const apres = corps('.rp-entete::after')
    expect(apres).toContain('inset: var(--rp-tissu)')
    expect(apres).toContain('border-radius: var(--rp-rayon-plaque)')
    // le contour, ici, c'est le tissage : pas de trait d'encre sur la plaque
    expect(apres).not.toMatch(/border(-top|-left|-right|-bottom)?:/)
    expect(apres).not.toMatch(/box-shadow:/)
  })

  it('le corps de l’en-tête existe dans la page — sinon la règle ne cercle rien', () => {
    //  le tissu vit sur `.rp-entete`, la plaque est reculée de sa cote : ce qui
    //  est posé sur le papier doit être dans UN contenant, sinon la marge
    //  intérieure est commandée quatre fois.
    expect(PAGE).toContain('className="rp-entete"')
    expect(PAGE).toContain('className="rp-entete-corps"')
    expect((PAGE.match(/className="rp-entete-corps"/g) || [])).toHaveLength(1)
    expect(corps('.rp-entete-corps')).toContain('padding: var(--charte-espace-4) var(--charte-espace-5)')
    //  et l'en-tête n'a pas été mis en boîte par-dessus l'étoffe
    expect(corps('.rp-entete')).not.toMatch(/overflow: hidden/)
    //  ni cerclé deux fois : le tour d'étoffe EST le cerclage, le blason se
    //  pose dessus sans anneau à lui (un anneau dans un anneau, chap. 23)
    expect(corps('.rp-entete-corps > svg')).not.toMatch(/box-shadow|border:/)
    expect(corps('.rp-entete-corps')).not.toMatch(/border(-top|-right|-bottom|-left)?:/)
  })
})

// ── 3. Les deux suppressions ───────────────────────────────

describe('3. les raccourcis et la bascule sont dehors', () => {
  it('plus de raccourcis de pages dans la page ni dans la feuille', () => {
    expect(PAGE).not.toContain('RaccourcisPages')
    expect(PAGE).not.toMatch(/import RaccourcisPages/)
    expect(PAGE).not.toContain('rp-raccourcis')
    expect(PAGE_NUE).not.toMatch(/>Aller à</)
    // le seuil ne promet plus ce qui a été enlevé
    expect(PAGE).toContain('aria-label="Entreprise et période du rapport"')
    expect(PAGE_NUE).not.toContain('accès rapides')
    // et la feuille n'héberge plus leurs règles — ni leur vocabulaire importé
    const corpsCSS = CSS_NUE
    expect(corpsCSS).not.toMatch(/\.rp-raccourcis/)
    expect(corpsCSS).not.toMatch(/abs-raccourci/)
  })

  it('plus de bouton sombre / clair posé par l’écran', () => {
    expect(PAGE_NUE).not.toContain('rp-bascule')
    expect(PAGE).not.toMatch(/role="switch"/)
    expect(PAGE).not.toMatch(/<Moon|<Sun\b/)
    expect(PAGE_NUE).not.toContain('useTheme')
    expect(PAGE_NUE).not.toMatch(/darkMode|toggleTheme/)
    // la page ne pose plus ni classe de thème, ni attribut
    expect(PAGE_NUE).not.toMatch(/rp-clair|data-theme=\{/)
    expect(PAGE_NUE).toMatch(/<div className="rp-page">/)
  })

  it('et la feuille n’entretient plus de thème de rechange', () => {
    const corpsCSS = CSS_NUE
    expect(corpsCSS).not.toMatch(/\.rp-page\.rp-clair/)
    // la seule règle retournée à la racine est une IMAGE (le chevron natif
    // d'un fond encodé ne peut pas lire un jeton) — pas une couleur de peau
    const retournements = corpsCSS.match(/\[data-theme='dark'\][^}]*\}/g) || []
    expect(retournements).toHaveLength(1)
    expect(retournements[0]).toContain('--rp-chevron')
    expect(retournements[0]).not.toMatch(/color|background:\s*#/)
    // un thème de page se reconnaît à ses couleurs en dur : zéro
    expect(corpsCSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(corpsCSS).not.toMatch(/rgba?\(/)
  })
})

// ── 4. La peau : des jetons, le feutre, et rien d'autre ────

describe('4. la feuille est de l’encre, pas une charte parallèle', () => {
  it('le double feutre est posé partout : trait de deux, ombre à flou zéro', () => {
    const corpsCSS = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    //  la loi n'est pas un compteur arbitraire mais une FORME : toute bordure
    //    déclarée en px doit passer par un jeton, sinon c'est la page qui fixe
    //    son épacement
    for (const m of corpsCSS.matchAll(/border(-top|-right|-bottom|-left)?:\s*([^;]+);/g)) {
      expect(m[2], `bordure hors jeton : ${m[2]}`).toMatch(/var\(--rp-|none|^0/)
    }
    //  et la bordure N'EST JAMAIS écrite en chiffres, même via un jeton de la
    //    charte : la page a son nom de maison, un seul, à retoucher
    for (const m of corpsCSS.matchAll(/border(-top|-right|-bottom|-left)?:\s*([^;]+);/g)) {
      expect(m[2], `bordure chiffrée : ${m[2]}`).not.toMatch(/\d+px/)
    }
    //  la règle pleine de trois : six porteurs au moins (enveloppe exceptée)
    expect(corpsCSS.match(/var\(--rp-regle\)/g).length).toBeGreaterThanOrEqual(6)
    expect(corpsCSS).not.toMatch(/box-shadow:[^;]*\b\d+px\s+\d+px\s+\d+px/)
    expect(corpsCSS).not.toMatch(/backdrop-filter|filter:\s*blur/)
    // la couture manquée n'est pas un style : plus un seul pointillé
    expect(corpsCSS).not.toMatch(/dashed|dotted/)
    // la page d'avant dimmait à l'`opacity` : les états éteints se PEIGNENT,
    //  et la loi se lit DÉCLARATION PAR DÉCLARATION — un `/^\s*opacity:/m` ne
    //  verrait pas un `opacity` collé derrière un `;` sur une ligne compacte
    for (const m of corpsCSS.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)) {
      //  `opacity` comme PROPRIÉTÉ, ou `opacity:` enfoui dans une valeur :
      //  une loi qui ne regarde qu'une forme d'écriture ne crie que sur elle
      expect(m[1], `état estompé : ${m[1]}`).not.toBe('opacity')
      expect(m[2], `état estompé dans ${m[1]} : ${m[2]}`).not.toMatch(/opacity(?!-)\s*:/)
    }
  })

  it('les valeurs viennent de l’échelle, jamais de chiffres nus', () => {
    const corpsCSS = CSS_NUE
    const lues = new Set()
    for (const m of corpsCSS.matchAll(/(?:margin|padding)(?:-[a-z]+)?\s*:\s*([^;]+);/g)) {
      for (const v of m[1].split(/\s+/)) {
        if (!/^-?\d*\.?\d+px$/.test(v)) continue
        // deux cotes d'ajustement de glyphes, ni une mesure ni un pas :
        // `1px` le long d'une ligne de texte, `2px` l'anneau de focus
        if (v === '1px' || v === '2px') continue
        lues.add(parseFloat(v))
      }
    }
    expect([...lues], `pas d'espacement chiffré : ${[...lues]}`).toEqual([])
    // les tailles d'écriture sont les quatre jetons (iOS garde son 16 px)
    const tailles = new Set((corpsCSS.match(/font-size:\s*([^;]+);/g) || [])
      .map((l) => l.replace(/font-size:\s*|;/g, '')))
    for (const t of tailles) {
      expect(
        ['var(--charte-taille-titre)', 'var(--charte-taille-corps)',
          'var(--charte-taille-micro)', '16px', 'var(--charte-taille-bouton)'],
        `taille hors échelle : ${t}`,
      ).toContain(t)
    }
    // les rayons sont ceux du contrôle C10 (+ le sceau rond et le tissu)
    const rayons = new Set((corpsCSS.match(/border-radius:\s*([^;]+);/g) || [])
      .map((l) => l.replace(/border-radius:\s*|;/g, '')))
    for (const r of rayons) {
      expect(
        ['var(--charte-rayon-champ)', 'var(--charte-rayon-carte)',
          'var(--charte-rayon-badge)', 'var(--charte-rayon-tuile)',
          'var(--rp-rayon-bloc)', 'var(--rp-rayon-plaque)', 'var(--rp-rond)',
          '0 var(--charte-rayon-champ) var(--charte-rayon-champ) 0'],
        `rayon hors liste : ${r}`,
      ).toContain(r)
    }
    // `50%` n'existe pas au contrôle : il passe par un jeton nommé
    expect(corps('.rp-page')).toContain('--rp-rond: 50%')
    expect(corps('.rp-sceau-marque')).toContain('border-radius: var(--rp-rond)')
  })

  it('la couche de jetons ne fait que dériver la charte', () => {
    const page = corps('.rp-page')
    for (const cle of ['--rp-nuit', '--rp-panneau', '--rp-encre', '--rp-douce',
      '--rp-terre', '--rp-ocre', '--rp-boue', '--rp-ligne', '--rp-trait',
      '--rp-ok', '--rp-attente', '--rp-alerte']) {
      const ligne = new RegExp(`${cle}:\\s*([^;]+);`).exec(page)
      expect(ligne, `${cle} n'est pas défini`).not.toBeNull()
      expect(ligne[1], `${cle} s'invente une valeur : ${ligne[1]}`)
        .toMatch(/var\(--charte-|color-mix\(in srgb, var\(--charte-|var\(--rp-/)
    }
    // les teintes de DATA ne sont pas des hex rescapés
    expect(page).toContain('--rp-onyx: color-mix(in srgb, var(--charte-indigo) 80%')
    expect(page).toContain('--rp-nacre: color-mix(in srgb, var(--charte-aplat) 55%')
  })

  it('les formes retravaillées : tampon, tuile, règle pleine', () => {
    // un glyphe devient un tampon (badge 11) et non deux cerclages nichés
    expect(corps('.rp-cartouche-icone')).toContain('var(--charte-rayon-badge)')
    expect(corps('.rp-cartouche-icone')).not.toMatch(/outline|inset 0 0 0/)
    // les tuiles prennent le rayon tuile, le contour de deux, l'ombre de trois
    for (const tuile of ['.rp-cartouche', '.rp-apercu', '.rp-marge']) {
      expect(corps(tuile), `${tuile} n'est pas une tuile du kit`).toContain('var(--charte-rayon-tuile)')
      expect(corps(tuile)).toContain('box-shadow: var(--rp-ombre)')
      expect(corps(tuile)).toContain('border: var(--rp-trait) solid var(--rp-ligne)')
    }
    // les faits du seuil sont des tampons, plus des étiquettes pointillées
    expect(corps('.rp-seuil-fait')).toContain('border-radius: var(--charte-rayon-badge)')
    // le bouton du kit : capitales au jeton micro, translate à l'actif
    expect(corps('.rp-page .rp-export')).toContain('min-height: var(--rp-cadre)')
    expect(CSS).toMatch(/\.rp-page \.rp-export:active:not\(:disabled\) \{[^}]*translate\(1px, 1px\)/)
    // la page qui travaille se peint, elle ne s'estompe pas
    expect(corps('.rp-page .rp-export:disabled')).toContain('var(--charte-btn-desactive)')
  })

  it('la page ne pose pas une seule règle de style dans le JSX', () => {
    expect(PAGE).not.toContain('<style>')
    expect(PAGE).not.toMatch(/\bstyle=\{\{/)
    expect(PAGE).not.toMatch(/\bstyle="/)
  })
})

// ── 5. Ce qui reste nsibidi ────────────────────────────────

describe('5. le nsibidi reste la signature, pas la bande', () => {
  it('le blason signe l’en-tête de la page', () => {
    expect(PAGE).toContain('<NsibidiBlasonSvg size={48} />')
    const blason = renderToStaticMarkup(<NsibidiBlasonSvg size={48} />)
    expect(blason).toContain('viewBox="0 0 52 52"')
    expect(blason).toContain('aria-hidden="true"')
  })

  it('le dessin de la frise est intact, même sans bande', () => {
    //  le motif de bande a changé, le dessin non : la frise de neuf tuiles
  //  reste exportée et mesurée — un dessinateur ne se désarmat pas
    const rendu = renderToStaticMarkup(<NsibidiFriseSvg />)
    expect(rendu).toContain('viewBox="0 0 2700 120"')
    expect(rendu).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(FRISE).toContain('NB_TUILES = 9')
    for (const signe of ['Fleche', 'Spirale', 'Arc', 'Croix', 'Fougere', 'Echelle', 'Cercle']) {
      expect(FRISE).toContain(`function ${signe}`)
    }
  })

  it('le PDF garde sa marque, hors de la carte des bandeaux', () => {
    //  le document ne rend pas de composant React : `dessinerBlason` trace les
    //  mêmes signes à la main dans jsPDF. C'est ce qui prouve que le changement
    //  de BANDE n'a pas atteint le document.
    expect(PDF).toContain('/** Le blason : quatre signes autour d\'un sceau, comme sur la page. */')
    expect(PDF).toContain('export function dessinerBlason')
    // la carte des motifs ne sert qu'aux bandeaux : le document n'y lit rien
    expect(PDF).not.toContain('culturalMotifForPath')
  })
})

// ── 6. Le métier et les mots, intacts ──────────────────────

describe('6. rien d’autre n’a bougé', () => {
  it('les trois exports et leurs bibliothèques', () => {
    for (const mot of ['jspdf', 'autoTable', 'generatePDF', 'generateGraphicalPDF', 'generateExcel']) {
      expect(PAGE).toContain(mot)
    }
  })

  it('la page bat toujours en seuil, composeur, aperçu et marge', () => {
    for (const classe of [
      'rp-coque', 'rp-seuil', 'rp-cartouche', 'rp-champs', 'rp-sceaux', 'rp-sceau',
      'rp-exports', 'rp-export', 'rp-apercu', 'rp-mesures', 'rp-mesure', 'rp-marge',
      'rp-note', 'rp-sujet', 'rp-recherche', 'rp-select-employe', 'rp-journees',
      'rp-constat', 'rp-etiquette-ton', 'rp-apercu-vide', 'rp-pied',
    ]) {
      expect(CSS, `la feuille a perdu .${classe}`).toContain(`.${classe}`)
      expect(PAGE, `la page a perdu rp-${classe}`).toContain(classe)
    }
    expect(PAGE).toContain('Composer le rapport')
    expect(PAGE).toContain('Aperçu du rapport')
    expect(PAGE).toContain('Ce que contient le rapport')
    expect(PAGE).toContain('Les registres de craie')
    expect(PAGE).toContain('Rapports<span>.</span>')
  })

  it('les rubriques restent des sceaux dessinés, pas des cases natives', () => {
    expect(PAGE).toContain("aria-pressed=")
    expect(PAGE).toContain('className="rp-sceau-marque"')
    expect(PAGE).not.toMatch(/<input[^>]*type="checkbox"/)
    // les cinq tons de données du produit sont toujours là
    for (const ton of ['ok', 'attente', 'alerte', 'indigo', 'violet']) {
      expect(corps(`.rp-sceau[aria-pressed='true'][data-ton='${ton}'] .rp-sceau-marque`))
        .toContain('background: var(--rp-')
    }
  })

  it('la poche tient : le pli n’est pas mangé par l’enveloppe', () => {
    //  la règle du sujet est la première du bloc 720 (loi lue dans
    //    `rapportsDureePaie` : le commentaire vit au-dessus du bloc)
    expect(CSS).toMatch(/@media \(max-width: 720px\) \{\n\s+\.rp-sujet-corps \{/)
    expect(CSS).toMatch(/@media \(max-width: 980px\)[\s\S]*?\.rp-apercu\s*\{[^}]*position:\s*static/)
    expect(CSS).toContain('@media (max-width: 460px)')
    //  à 650 px, l'enveloppe ne change pas de cote de tissu : seule la plaque
    //  se met en pile — sinon le tour d'étoffe se défera d'un côté
    const bloc = CSS.slice(CSS.indexOf('@media (max-width: 650px)'))
    const nu = degommente(bloc.slice(0, bloc.indexOf('\n}', bloc.indexOf('{'))))
    //  aucun seuil mobile sur l'enveloppe : la cote de tissu est unique, et
    //    `.rp-entete` ne se redéclare pas en petit
    expect(nu).not.toMatch(/--rp-tissu/)
    expect(nu).not.toMatch(/\.rp-entete \{/)
    expect(nu).not.toMatch(/\.rp-entete-droite/)
    expect(nu).toContain('.rp-entete-corps {')
  })
})
