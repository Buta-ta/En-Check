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
  expect(nu(PAGE)).not.toMatch(/useTheme\s*\(/)
  expect(nu(PAGE)).not.toMatch(/\btoggleTheme\b/)
  // la racine de la page n'a plus de classe de thème : elle est `ot-page`, seule
  expect(PAGE).toMatch(/className="ot-page"/)
  expect(nu(PAGE)).not.toMatch(/['"`]ot-dark/)
  expect(corps).not.toMatch(/\.ot-dark\b/)
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
