import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/*  ┌────────────────────────────────────────────────────────────────────────┐
    │  CE TEST A ÉTÉ RÉÉCRIT LE 26/12, ET IL FAUT LE LIRE COMME TEL.          │
    │                                                                          │
    │  Il s'appelait « brand alignment » et verrouillait exactement le          │
    │  contraire de la charte de la maison : sept teintes en dur               │
    │  (#FAF6F0 #FFFFFF #231911 #4E3D2E #15110E #1D1713 #F5F2EB), une police    │
    │  non chargée ('Segoe UI', Tahoma, Geneva, Verdana) et quatre tailles     │
    │  orphelines (27 / 24 / 17 / 16 px) posées sur les trois blocs de texte    │
    │  qui comptent. La page avait donc sa PROPRE charte, écrite en dur dans    │
    │  une feuille de 627 lignes, et le test la défendait : chaque ligne que    │
    │  le fondateur a demandée le 26/12 (« appliquer le style brut adouci,      │
    │  double feutre ») faisait ROUGIR ce test. Le garder vert en laissant les  │
    │  valeurs en dur, c'était choisir le test contre la loi — alors la loi     │
    │  est entrée dans le test.                                                │
    │                                                                          │
    │  La forme de l'aiguille reste la même qu'ailleurs dans ce dépôt : une     │
    │  REGROUPEMENT qui répond par le DÉTAIL (le nom de la classe, la valeur,   │
    │  la ligne de la feuille). Un `not.toMatch(/#[0-9A-Fa-f]/)` à la sauvette  │
    │  échoue en disant « ça ne doit pas être là » sans dire OÙ — et comme le   │
    │  bloc `:root` de la page a le DROIT d'écrire sa cote une fois, il faut    │
    │  d'abord le retirer de la portée.                                        │
    └────────────────────────────────────────────────────────────────────────┘ */

const CSS = readFileSync('src/pages/HeuresSupplementaires.css', 'utf8')
const bands = readFileSync('src/components/PageCulturalBand.css', 'utf8')
const PAGE = readFileSync('src/pages/HeuresSupplementaires.jsx', 'utf8')
const NAV = readFileSync('src/components/OvertimeExperience.jsx', 'utf8')
const DASH = readFileSync('src/components/OvertimeDashboard.jsx', 'utf8')

/*  LA COUCHE D'ALIAS. Cette page n'écrit pas ses cotes dans un `:root` mais
    dans `.ot-page` — c'est ce bloc qui a le DROIT de porter une valeur en dur
    (une fois, et une fois seulement), parce que c'est là qu'elles sont lues par
    soixante sélecteurs. Tout le reste de la feuille ne PEUT que citer un jeton.
    Les commentaires sont écartés d'office : ils CITENT les valeurs renvoyées
    (« Sept hex en dur (#FAF6F0…) »), et une aiguille d'ABSENCE lue sur le texte
    cru se réfuterait elle-même. */
/*  Le marcheur d'accolades, et rien d'autre : `nu.lastIndexOf('}')` ou
    `indexOf('}', indexOf('--ot-glyphe'))` dépendraient de l'ORDRE des lignes de
    la feuille — ajouter une cote en bas du bloc ferait passer une triche. */
function bloc(nu, debut) {
  let i = nu.indexOf('{', debut)
  let prof = 0
  const fin = i
  do {
    if (nu[i] === '{') prof++
    else if (nu[i] === '}') prof--
    i++
  } while (prof > 0 && i < nu.length)
  return [fin, i]
}
const ALIAS = '.ot-page {'
function porteeAlias(nu) {
  const d = nu.indexOf(ALIAS)
  if (d < 0) throw new Error(`la feuille n'a plus de bloc ${ALIAS} : la couche d'alias a déménagé, et ce test doit suivre`)
  const [a, b] = bloc(nu, d)
  return nu.slice(a, b)
}
function horsAlias(texte) {
  const nu = texte.replace(/\/\*[\s\S]*?\*\//g, '')
  const d = nu.indexOf(ALIAS)
  const [, b] = bloc(nu, d)
  return nu.slice(0, d) + nu.slice(b)
}

const nuCSS = CSS.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '')
const corps = horsAlias(CSS)

/*  ⚠️ Le piège dans lequel ce fichier est tombé deux fois : une aiguille qui
    énumère ce qui est INTERDIT est réfutée par ses propres survivants, parce
    que les commentaires de la page CITENT ce qu'ils renvoient (« Sept hex en
    dur (#FAF6F0 …) », « `backdrop-filter: blur(4px)` »). Toute aiguille de
    ABSENCE lit donc `nu()`, jamais le texte cru — et toute aiguille de
    PRÉSENCE peut lire le cru, puisqu'un commentaire ne satisfait pas un
    `toContain` sur une classe. */
function nu(texte) {
  return texte.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '')
}

it('habille la page avec les jetons de la maison, jamais avec une teinte en dur', () => {
  // AUCUNE couleur en dur hors du `:root` — hexadécimal, rgb(), hsl() et les
  // mots-clés CSS (« white », « transparent » sont tolérés car ils ne disent
  // rien d'une marque : `border-radius: 0` et `background: transparent`).
  const couleurs = [
    ...[...corps.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)].map((m) => m[0]),
    ...[...corps.matchAll(/\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/g)].map((m) => m[0]),
  ]
  expect(couleurs, `théorie 105 : couleurs en dur dans la feuille — ${couleurs.join(' ')}`).toEqual([])
  // et le `:root` de la page ne PEUT que dériver : il n'invente aucune teinte.
  expect(
    porteeAlias(nuCSS).match(/#[0-9A-Fa-f]{3,8}\b/g) || [],
    'théorie 105 : la couche d’alias dérive les jetons de la maison, elle ne retinte pas',
  ).toEqual([])
  expect(CSS).toContain('var(--charte-sable)')
  expect(CSS).toContain('var(--charte-ombre-dure)')
  // la police de la maison est self-hostie en 400/600/700 ; Segoe UI n'est
  // JAMAIS chargée, donc l'écrire était promettre un rendu qu'aucun navigateur
  // de l'équipe ne verrait.
  expect(nu(CSS)).not.toMatch(/Segoe UI|Tahoma|Geneva|Verdana/)
  expect(nu(CSS)).not.toMatch(/linear-gradient|radial-gradient/)
  // aucun flou : le voile du tiroir est l'opacité de la maison
  expect(nu(CSS)).not.toMatch(/blur\(/)
  expect(CSS).toContain('var(--charte-modale-voile)')
})

it('ne connaît que les trois tailles, les quatre rayons et les trois poids de la charte', () => {
  const tailles = new Set([...corps.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim()))
  expect(
    [...tailles].filter((v) => !/^var\(--charte-taille-(titre|corps|micro|bouton)\)$/.test(v)),
    `théorie 121 : quatre tailles à l'hectare (titre 20 · corps 14 · micro 11 · bouton 9,5) — tailles vues : ${[...tailles]}`,
  ).toEqual([])
  /*  Les quatre rayons de la maison, plus 0. Un `border-radius: 12px 4px` écrit
        à la main ne se refuse pas avec une expression régulière qui reconnaîtrait
        « à peu près » la liste blanche — il se refuse en DÉMONTANT la
        déclaration : chaque coin doit valoir `0` ou un jeton de rayon, et la
        cote doit venir du jeton, jamais du chiffre. */
  const jetonsRayon = /^var\(--(?:ot-rayon-(?:bloc|champ|tampon)|charte-rayon-(?:champ|carte|badge|tuile|pilule))\)$/
  const coinsHorsLoi = []
  for (const m of corps.matchAll(/border-radius:\s*([^;}]+)[;}]/g)) {
    for (const coin of m[1].trim().split(/\s+/)) {
      if (coin !== '0' && !jetonsRayon.test(coin)) coinsHorsLoi.push(`${m[0]} → ${coin}`)
    }
  }
  expect(
    coinsHorsLoi,
    'théorie 121 : rayon hors liste blanche (champ 6 · carte 8 · badge 11 · tuile 12 · pilule 999), et toujours par le jeton',
  ).toEqual([])
  const poids = new Set([...corps.matchAll(/font-weight:\s*([^;]+);/g)].map((m) => m[1].trim()))
  expect(
    [...poids].filter((v) => !/^(400|600|700|bold)$/.test(v)),
    `théorie 121 : la maison ne charge que 400/600/700 — poids vus : ${[...poids]}`,
  ).toEqual([])
  // 23 `border: 1px` dans l'ancienne feuille : une couleur d'accent ne se
  // décrète pas, mais un trait de 1 posé sur une surface ne se voit pas non
  // plus. La loi est celle du kit : le trait d'encre de 2.
  expect(corps.match(/border[^;:]*:\s*1px/g) || [], 'théorie 121 : le trait fait --charte-trait (2 px)').toEqual([])
})

it('ne s’habille que des quatre formes de la maison et rend le cerclage de feutre', () => {
  // la « double feutre » de l'intention : le MÊME objet porte le cadre de 2 et
  // l'ombre dure de 3 à flou zéro — jamais deux cerclages l'un dans l'autre.
  const blocs = corps.match(/\.ot-(?:stats article|panel|list|insights)[^{]*\{[^}]*\}/g) || []
  expect(blocs.length, 'les blocs de mesure de la page').toBeGreaterThan(1)
  // et la cote n'est écrite qu'une fois : elle sort des jetons
  expect(CSS).toMatch(/--ot-trait:\s*var\(--charte-trait\)/)
  expect(CSS).toMatch(/--ot-regle:\s*3px/)
  expect(CSS).toMatch(/--ot-rayon-bloc:\s*var\(--charte-rayon-tuile\)/)
  // la feuille ne RABAT pas l'en-tête de la maison : elle ne touche que le
  // titre de l'en-tête, et avec le jeton, pas avec une taille inventée
  expect(corps).not.toMatch(/\.ot-page h[12]\s*\{/)
  expect(CSS).toMatch(/\.ot-page \.afro-header-title\s*\{[^}]*font-size:\s*var\(--charte-taille-titre\)/)
})

it('ne porte plus ni raccourcis ni bouton de thème, et donc plus de second thème', () => {
  /*  « Enlever les raccourcis, le bouton sombre/clair ». La page se relit par
        l'ABSENCE : un composant qui survit sans être monté est une dette, pas une
        option. Les quatre `href` des raccourcis, l'ancre `encheck.theme` et la
        classe `.ot-dark` sont testés sur la feuille ET sur le rendu. */
  // le composant n'existe plus : ni export, ni import, ni mount
  expect(NAV).not.toContain('OvertimeNavigation')
  expect(NAV).not.toMatch(/from 'react-router-dom'/)
  expect(NAV).not.toMatch(/\buseNavigate\b/)
  expect(NAV).not.toMatch(/encheck\.theme|Mode sombre|Mode clair/)
  expect(PAGE).not.toMatch(/<OvertimeNavigation|\bOvertimeNavigation\b(?!,)/)
  //  CE QUE LE VERROU DÉFEND, DIT AUTREMENT LE 27/11. Ce n'était pas « cette page ne doit
  //  rien savoir du thème » : c'était « cette page n'entient pas UN SECOND
  //  thème à côté du global ». La barre et son rail sont revenus ce jour-là, et
  //  la commande de thème vit DANS la barre — la page la branche, elle ne
  //  l'habille pas. Sont donc toujours défendus : la classe propre, l'attribut
  //  posé par la page, l'ancre de localStorage et un bouton de thème rendu par
  //  la page. Est permis, et compté : UN seul `useTheme()`, lu pour les props de
  //  `SidebarUnique`.
  expect(nu(PAGE)).toMatch(/surTheme=\{toggleTheme\}/)
  expect(
    (nu(PAGE).match(/useTheme\s*\(/g) || []).length,
    'deux lectures du thème dans la page : le second thème est de retour',
  ).toBe(1)
  expect(nu(PAGE)).not.toMatch(/<button[^>]*onClick=\{toggleTheme\}/)
  expect(nu(PAGE)).not.toMatch(/data-theme=/)
  expect(nu(PAGE)).not.toMatch(/encheck\.theme|Mode sombre|Mode clair/)
  // la racine de la page n'a plus de classe de thème : elle est `ot-page`, seule
  expect(PAGE).toMatch(/className="ot-page"/)
  expect(nu(PAGE)).not.toMatch(/['"`]ot-dark/)
  expect(corps).not.toMatch(/\.ot-dark\b/)
})

/*  LE TIROIR SE RELIT PAR SES ÉTAGES, et une règle ne vaut que si elle est
    ANCRÉE EN DÉBUT DE LIGNE : `nu.indexOf('.ot-rules-body')` retombe sur
    `.ot-drawer > .ot-rules-body`, qui est un AUTRE bloc (le `min-height: 0` et
    le `flex-shrink`), et l'aiguille y lirait le faux en silence. */
function etage(nu, selecteur) {
  const m = nu.match(new RegExp('(?:^|\\n)' + selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'))
  return m ? m[1] : null
}

it('laisse le corps du tiroir scroller, et son trop-plein ne peint pas sur le pied', () => {
  const corps = etage(nuCSS, '.ot-rules-body')
  expect(corps, 'le bloc .ot-rules-body a disparu de la feuille').toBeTruthy()
  expect(corps).toMatch(/overflow-y:\s*auto/)
  //  les trois moitiés d'un conteneur qui scrollent, écrites ensemble : la
  //    promesse (`overscroll-behavior`), le fait (`overflow-y`) et le droit de
  //    rétrécir dans la colonne flex (`min-height: 0`, sur l'autre sélecteur).
  expect(corps).toMatch(/overscroll-behavior:\s*contain/)
  expect(etage(nuCSS, '.ot-drawer > .ot-rules-body')).toMatch(/min-height:\s*0/)
  expect(etage(nuCSS, '.ot-drawer')).toMatch(/overflow:\s*hidden/)
  //  pas de cote de hauteur inventée pour « arranger » le débordement : le
  //    tiroir fait la hauteur de l'écran, son corps fait le reste.
  expect(corps).not.toMatch(/max-height|height:/)

  /*  ET LE PIED DU TIROIR RESPIRE SUR ÉCRAN LARGE. La lecture doit être bornée
        AVANT le premier `@media`, sans quoi le `padding` du bloc de 650 px
        satisferait l'aiguille à la place de celui du haut : c'est exactement le
        défaut qui était à l'écran — le pied n'était habillé que pour le
        téléphone, et ses deux boutons touchaient la règle de trois. */
  const avantMedia = nuCSS.slice(0, nuCSS.indexOf('@media'))
  const piedBase = [...avantMedia.matchAll(/\.ot-rules-footer\s*\{([^}]*)\}/g)]
    .map((m) => m[1])
    .join('\n')
  expect(
    piedBase,
    'le pied du tiroir ne porte pas de respiration hors `@media` : sur écran large, ses boutons collent la règle du haut',
  ).toBeTruthy()
  expect(piedBase).toMatch(/padding:\s*var\(--charte-espace-4\) var\(--charte-espace-5\)/)
  //  8 px entre les deux boutons, le trou de la rangée de gestes d'un état vide.
  expect(piedBase).toMatch(/gap:\s*var\(--charte-espace-2\)/)
  //  une bordure par bord : le pied ferme par le haut, il ne se cercle pas.
  expect(piedBase).toMatch(/border-top:\s*var\(--ot-regle\)/)
  expect(piedBase).not.toMatch(/border-bottom|border-left|border-right|border:/)
})

/*  le CORPS d'une règle, pour pouvoir dire qu'il NE contient pas telle
    déclaration — sans ça, `css.includes('box-shadow')` répond oui à cause d'un
    voisin et l'aiguille ment en silence. (Le nom `corps` est déjà pris par la
    portée de la feuille entière.) */
function regle(nu, selecteur) {
  const i = nu.indexOf(selecteur)
  if (i < 0) return null
  return nu.slice(nu.indexOf('{', i) + 1, nu.indexOf('}', i))
}

it('habille les états vides et les boutons sans réécrire le kit', () => {
  const nu = nuCSS
  //  UN ÉTAT VIDE N'EST PAS UNE CARTE DANS LA CARTE : le bloc est posé dans un
  //  panneau déjà cerclé, il prend donc le lavis et la règle de trois à gauche,
  //  jamais une seconde ombre, un second rayon ou un cadre complet.
  for (const sel of ['.ot-vide', '.ot-vide-creux']) {
    const c = regle(nu, sel)
    expect(c, `${sel} doit exister dans la feuille`).toBeTruthy()
    for (const interdit of ['box-shadow', 'border-radius', 'border:']) {
      expect(c.includes(interdit), `${sel} ne doit pas porter ${interdit} (une bordure par bord)`).toBe(false)
    }
  }
  //  la figure est déclarée UNE fois sur la base ; le modificateur du trou
  //  n'hérite pas d'un second cadre, il n'hérite que du premier.
  expect(regle(nu, '.ot-vide')).toMatch(/border-left:\s*var\(--ot-regle\)/)
  expect(regle(nu, '.ot-vide')).toMatch(/background:\s*var\(--ot-lavis\)/)
  /*  et la pastille posée DANS ce lavis ne peut pas avoir la MÊME pâte : un
        objet du fond de son contenant n'est plus un objet, c'est une tache.
        Aucun navigateur ici, donc la loi est écrite comme une règle — l'override
        doit exister et porter le papier. */
  const pastille = regle(nu, '.ot-vide .ot-coin')
  expect(pastille, 'la pastille de l’état vide doit être repérée sur le lavis').toBeTruthy()
  expect(pastille).toMatch(/background:\s*var\(--ot-surface\)/)
  //  la cote du trou du graphe reste UNE fois écrite : le vide occupe la place
  //  du plein, et non un 190 px re-taper à côté du 205.
  expect(regle(nu, '.ot-vide-creux')).toMatch(/min-height:\s*var\(--ot-hauteur-graphe\)/)
  expect(regle(nu, '.ot-vide')).not.toMatch(/min-height:\s*\d/)

  /*  LE KIT N'A PAS DE DOUBLON SUR CETTE PAGE. Le 26/12, la feuille avait
        recopié les cotes de `.ch-btn-pleine` dans `.ot-page button { … }` ; le
        27/11, le markup porte les classes de la maison et la copie est partie.
        Elle est interdite pour DEUX raisons, et la seconde est la plus
        silencieuse : un `.ot-page button { font: inherit }` bat
        `.ch-btn-pleine { font-size: 9,5px }` (une classe + un type > une classe
        seule) et fait disparaître les capitales du kit sans qu'aucun contrôle
        de fichier ne le voie. */
  for (const sel of ['.ot-page button', '.ot-page button:hover', '.ot-page button:disabled']) {
    const b = regle(nu, sel)
    if (!b) continue
    for (const interdit of ['height', 'background', 'border', 'font-size', 'letter-spacing', 'text-transform']) {
      expect(b, `théorie 121 : ${sel} ne doit plus décrire ${interdit} — c'est le kit`).not.toMatch(
        new RegExp(`(^|;)\\s*${interdit}[a-z-]*\\s*:`),
      )
    }
  }
  const base = regle(nu, '.ot-page button,')
  if (base) {
    expect(base, '`font: inherit` ne doit plus viser les boutons').not.toMatch(/font:\s*inherit/)
  }
  //  et les segments, qui ne sont PAS des boutons du kit, portent leur
  //  typographie eux-mêmes — sinon ils retomberaient en 16 px du navigateur.
  const segments = regle(nu, '.ot-segments button')
  expect(segments).toMatch(/font-size:\s*var\(--charte-taille-bouton\)/)
  expect(segments).toMatch(/text-transform:\s*uppercase/)

  /*  LE MARKUP A ADOPTÉ LE KIT, BOUTON PAR BOUTON — et le comptage est la
        seule façon honnête de le dire. Un seuil du genre « au moins 6 fois
        ch-btn-contour » ne refuse rien : il restait VERT quand un septième
        bouton quittait le kit. La loi est donc un ÉCART EXACT : chaque `<button`
        écrit dans la source porte une classe du kit, à l'exception d'UN seul —
        les trois segments de vue, qui ne sont pas des actions mais un
        sélecteur, et qui ne sont écrits qu'une fois dans un `.map`. */
  const sources = PAGE + NAV + DASH
  const ecrits = (sources.match(/<button\b/g) || []).length
  const habilles = (sources.match(/ch-btn-(?:pleine|contour)/g) || []).length
  expect(
    habilles,
    `théorie 121 : ${ecrits} <button> écrits, ${habilles} habillés — tout bouton de la page doit porter le kit, un seul (le sélecteur de vue) en est exclus`,
  ).toBe(ecrits - 1)
  expect(sources).toMatch(/className="ch-btn-pleine"/)
  expect(nu).not.toMatch(/\.ot-btn-contour|\.ot-pince/)
  expect(sources).not.toMatch(/ot-btn-contour|ot-pince/)
  expect(sources).toMatch(/ch-btn-contour ot-carre/)
})

it('garde la bande culturelle mince et vectorielle', () => {
  expect(bands).toContain("url('/images/heures-aso-oke.svg')")
  expect(bands).not.toContain("url('/images/heures-aso-oke.webp')")
  expect(bands).toContain(".ec-cultural-top[data-cultural-motif='aso-oke'] { height: 40px; }")
  expect(bands).toContain(".ec-cultural-top[data-cultural-motif='aso-oke'] { height: 32px; }")
  const svg = readFileSync('public/images/heures-aso-oke.svg', 'utf8')
  expect(svg).toContain('viewBox="0 0 240 40"')
  expect(svg).not.toMatch(/<image|data:image|<filter/)
})

/*  ──────────────────────────────────────────────────────────────────────────
    LA STRUCTURE DE LA FEUILLE, ET PAS SEULEMENT SON CONTENU.

    Deux orphelins ont été trouvés dans cette feuille le 27/11, tous deux
    hérités de la base (fusion #394), tous deux INVISIBLES aux aiguilles de
    valeurs : la page citait ses jetons comme il fallait, et malgré ça le
    histogramme n'avait plus de couleur. Une CLÔTURE de commentaire échappée dans
    le texte d'une note ne casse AUCUNE cote — elle déplace le sélecteur de la
    règle suivante dans une poubelle, et le navigateur jette la règle avec. Une
    OUVERTURE jamais refermée avale cent lignes et laisse un bloc ouvert jusqu'en
    fin de fichier. (Cette note écrit les deux mots au lieu des deux caractères,
    et ce n'est pas une coquetterie : le second orphelin de la feuille est né
    d'une note qui citait sa propre clôture.)

    Ce dépôt n'a ni navigateur ni parseur CSS déclaré (`postcss` n'est pas une
    dépendance du projet : l'utiliser ici serait écriture d'une dette). Une
    feuille de style se relit pourtant avec trente lignes de marche d'états —
    code, commentaire, chaîne — et c'est exactement ce que ces deux fautes
    violent. D'où trois aiguilles, toutes mutées avant d'être cruces :
      1. clôture de commentaire hors commentaire, accolade non refermée,
         profondeur finale : 0 ;
      2. le repli « sans animation » doit être À LA RACINE (un média ouvert qui
         ne se ferme pas l'enferme sous `(max-width: 650px)` : le respect de
         `prefers-reduced-motion` ne devient pas une faveur de l'écran petit) ;
      3. la phrase-témoin de la panne du 28/11 ne doit être écrite qu'UNE fois
         — sa seconde apparition était précisément l'orphelin.
    ────────────────────────────────────────────────────────────────────────── */
function structure(css) {
  const fautes = []
  const profondeurAvant = [0]
  let etat = 'code'
  let prof = 0
  let ligne = 1
  let guillemet = ''
  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    const d = css[i + 1] || ''
    if (c === '\n') {
      //  Une chaîne CSS ne change jamais de ligne : une apostrophe non refermée
      //    AVANT le saut est une faute, pas un début de texte. C'est ce détail
      //    qui rend le marcheur utile sur une feuille en français — sinon, l'«
      //    apostrophe » de `l'état` dans une note avalerait la ligne d'après et
      //    le `*/` orphelin passerait inaperçu. (Muté : vert. Corrigé : rouge.)
      if (etat === 'chaine') {
        fautes.push(`ligne ${ligne} : chaîne ouverte non refermée`)
        etat = 'code'
      }
      ligne++
      profondeurAvant.push(prof)
      continue
    }
    if (etat === 'commentaire') {
      if (c === '*' && d === '/') {
        etat = 'code'
        i++
      }
      continue
    }
    if (etat === 'chaine') {
      if (c === guillemet) etat = 'code'
      continue
    }
    if (c === '/' && d === '*') {
      etat = 'commentaire'
      i++
      continue
    }
    if (c === '"' || c === "'") {
      etat = 'chaine'
      guillemet = c
      continue
    }
    if (c === '*' && d === '/') {
      fautes.push(`ligne ${ligne} : « */ » hors commentaire`)
      i++
      continue
    }
    if (c === '{') prof++
    else if (c === '}') {
      prof--
      if (prof < 0) {
        fautes.push(`ligne ${ligne} : accolade fermante sans ouvrante`)
        prof = 0
      }
    }
  }
  if (etat === 'commentaire') fautes.push('commentaire ouvert jamais fermé')
  if (etat === 'chaine') fautes.push('chaîne ouverte jamais fermée')
  if (prof !== 0) fautes.push(`profondeur finale ${prof} : la feuille ne se referme pas`)
  return { fautes, profondeurAvant }
}

it('relit la feuille sans orphelin : commentaire fermé, média à la racine', () => {
  const { fautes, profondeurAvant } = structure(CSS)
  expect(fautes, `la feuille ne se relit pas — ${fautes.join(' ; ')}`).toEqual([])

  const replis = [
    ...CSS.matchAll(/^@media\(prefers-reduced-motion/gm),
  ].map((m) => CSS.slice(0, m.index).split('\n').length)
  expect(replis.length, 'la feuille a perdu son repli sans animation').toBe(2)
  replis.forEach((n) => {
    expect(
      profondeurAvant[n - 1],
      `repli sans animation enfermé à la ligne ${n} : un bloc ouvert ne s'est pas refermé`,
    ).toBe(0)
  })

  //  La règle du cerne des barres doit être LA PREMIÈRE PAROLE de sa ligne :
  //    précédée d'un texte de commentaire mal fermé, elle devient la queue d'un
  //    sélecteur invalide et le navigateur la jette — c'est ainsi que
  //    l'histogramme s'est retrouvé sans teinte.
  expect(nu(CSS), 'la règle .ot-bar n’est plus ouverte par son propre sélecteur').toMatch(
    /^\.ot-bar \{$/m,
  )

  const temoin = CSS.split('la maison ne colore pas une alternance').length - 1
  expect(
    temoin,
    `la phrase-témoin de la panne du 28/11 est écrite ${temoin} fois : une seconde fois, c'est un orphelin`,
  ).toBe(1)
})
