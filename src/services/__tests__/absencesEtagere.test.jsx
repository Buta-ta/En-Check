import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import AbsencesKpiCards from '../../components/AbsencesKpiCards'

// `import.meta.dirname`, pas `process.cwd()` : un test lancé d'un autre répertoire
// que la racine lirait le mauvais fichier — et conclurait « rien à redire ».
const RACINE = path.resolve(import.meta.dirname, '../../..')
const lire = (...chemins) => fs.readFileSync(path.join(RACINE, ...chemins), 'utf8')

// Les commentaires sont retirés d'office : cette plage explique ce qu'elle ne fait
// pas (`!important`, `text-overflow: ellipsis`, `50%`), et un verrou qui lit de la
// prose trouve ce qu'il cherche — la veille, il aurait fallu la retirer à la main.
const CSS = lire('src', 'pages', 'AbsencesAfroTech.css').replace(/\/\*[\s\S]*?\*\//g, '')
const JSX = lire('src', 'components', 'AbsencesKpiCards.jsx')
// Le dessin retenu est une IMAGE, pas un gabarit : ses largeurs sont dessinées à une
// échelle qui n'est pas celle de la page (la page plafonne à 1200 px, l'image à
// 1560). Ce fichier vérifie donc les rapports et le comportement, jamais les pixels.
const DESSIN = 'maquettes/absences-kpi-P1-etagere.png'

/** Le corps d'une règle, sélecteur retiré — pour ne pas confondre un `left:` écrit
    dans une media-query avec un `left:` posé sur la planche. */
function declarations(sélecteur) {
  const i = CSS.indexOf(`${sélecteur} {`)
  if (i === -1) throw new Error(`règle absente de la feuille : ${sélecteur}`)
  const début = CSS.indexOf('{', i)
  const fin = CSS.indexOf('}', début)
  return CSS.slice(début + 1, fin)
}

/** Le bloc d'un média, accolades comprises. `àCôtéDe` désigne LEQUEL quand deux
    portent la même coupe : `.abs-hamac` et `.abs-etagere` coupent toutes les deux à
    650 px, et lire le premier trouvé vérifierait le voisin. */
function blocMedia(source, i) {
  let n = 0
  for (let j = source.indexOf('{', i); j < source.length; j += 1) {
    if (source[j] === '{') n += 1
    if (source[j] === '}') {
      n -= 1
      if (n === 0) return CSS.slice(i, j + 1)
    }
  }
  throw new Error(`média non fermé à l'index ${i}`)
}

const nud = (chaîne) => chaîne.replace(/\s+/g, '')

// Le jour « aujourd'hui » s'écrit ici au lieu d'être importé du service de
// calendrier : ce fichier lit des sources, et un import de plus dans un test de
// source est une raison de plus qu'il tombe pour autre chose que ce qu'on vérifie.
const AUJOURDHUI = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()
const moisDe = (iso) => iso.slice(0, 7)

function media(état, àCôtéDe) {
  for (let i = CSS.indexOf(état); i !== -1; i = CSS.indexOf(état, i + 1)) {
    const bloc = blocMedia(CSS, i)
    if (!àCôtéDe || bloc.includes(àCôtéDe)) return bloc
  }
  throw new Error(`média absent${àCôtéDe ? ` (avec ${àCôtéDe})` : ''} : ${état}`)
}

/* ────────────────────────────────────────────────────────────────────────────
   CE FICHIER NE REJOUE PAS LA MAQUETTE. Il garde les deux promesses qui ne se
   voient pas sur une capture large :
   1. « en pensant à comment rendre ça responsive en tout écran » (30/11) ;
   2. « relier l'étagère au bloc d'en haut, les accrocher là » (1/12).
   Chacune se défait en silence : une planche à hauteur fixe rogne un mot, un
   libellé à points de suspension avale une syllabe, une tringle par rangée reste
   en l'air dès que les planches passent de six à trois, et un raccord chiffré à
   la main dort le jour où quelqu'un respire le transat. D'où un test qui RELIT les
   sources des nombres au lieu de les répéter.
   ──────────────────────────────────────────────────────────────────────────── */

describe('L’étagère — le rail appartient à la planche, pas à la rangée', () => {
  it('le rail se dessine sur chaque planche, en `::before` pleine largeur de case', () => {
    const rail = declarations('.abs-planche::before')
    expect(rail).toMatch(/position:\s*absolute/)
    expect(rail).toMatch(/left:\s*0/)
    expect(rail).toMatch(/right:\s*0/)
    expect(rail).toContain('height: var(--abs-tringle)')
    // et les colonnes sont SANS écart : c'est ce qui colle les tronçons en un trait
    expect(declarations('.abs-etagere-planches')).toMatch(/gap:\s*var\(--charte-espace-4\) 0/)
  })

  // C'est LE test du responsive : si quelqu'un remet la tringle sur le conteneur
  // (une bordure, un `::before` sur `.abs-etagere-planches`), chaque coupe d'écran
  // devra repositionner le rail à la main — et en manquera une.
  it('aucune coupe d’écran ne repositionne de tringle : le rail suit tout seul', () => {
    for (const état of ['@media (max-width: 1180px)', '@media (max-width: 680px)', '@media (max-width: 420px)']) {
      const bloc = media(état)
      expect(bloc).not.toMatch(/\n\s*(left|right|top|bottom):/)
      expect(bloc).toMatch(/grid-template-columns:/)
    }
    // et le rail n'existe qu'au singulier : une seule règle le dessine
    expect(CSS.match(/\.abs-planche::before\s*\{/g)).toHaveLength(1)
    expect(CSS).not.toMatch(/\.abs-etagere-planches::before/)
  })

  it('six, trois, deux, une — dans cet ordre, et jamais moins d’un rang de cordes par ligne', () => {
    expect(declarations('.abs-etagere-planches')).toMatch(/grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/)
    expect(media('@media (max-width: 1180px)')).toMatch(/repeat\(3, minmax\(0, 1fr\)\)/)
    expect(media('@media (max-width: 680px)')).toMatch(/repeat\(2, minmax\(0, 1fr\)\)/)
    expect(media('@media (max-width: 420px)')).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/)
    const points = ['1180', '680', '420'].map((px) => CSS.indexOf(`@media (max-width: ${px}px)`))
    expect(points).toEqual([...points].sort((a, b) => a - b))
  })

  it('les quatre hauteurs de la menuiserie viennent de quatre nombres posés sur l’étagère', () => {
    // Un seul endroit les déclare, et la corde courte comme la chute lisent la même
    // `--abs-chute` : sinon l'anneau ne touche plus le rail à une largeur d'écran.
    const étagère = declarations('.abs-etagere')
    expect(étagère).toContain('--abs-chute: var(--charte-espace-5)')
    expect(étagère).toContain('--abs-tringle: 4px')
    expect(étagère).toContain('--abs-planche: 88px')
    expect(nud(declarations('.abs-planche-corde'))).toContain('height:var(--abs-chute)')
    expect(étagère).toContain('--abs-corde: 70px') // la bande à traverser, voir plus bas
    expect(nud(declarations('.abs-etagere-suspentes'))).toContain('height:var(--abs-corde)')
    expect(nud(declarations('.abs-planche-corde i::before'))).toContain('top:-7px')
    // le `padding-top` de la planche, c'est le trait du rail — pas un nombre de plus
    expect(nud(declarations('.abs-planche'))).toContain('padding-top:var(--abs-tringle)')
  })
})

/* ────────────────────────────────────────────────────────────────────────────
   LE RACCORD AU BLOC DU HAUT — la demande du 1/12, après la première pose : « tu
   as laissé bcp d'espace vide entre le bloc d'en haut et l'étagère. Moi ce que je
   voulais est de relier l'étagère au bloc d'en haut, de les accrocher là ».

   Quatre verrous, et chacun tient une façon dont ce raccord se défait tout seul :
   un nombre recopié qui dort, le bois qui saute de 46 px quand on « corrige » la
   corde, la corde qui dérape à côté du rail petit écran, et la corde qui marche sur
   le transat quand celui-ci prend toute la largeur.
   ──────────────────────────────────────────────────────────────────────────── */
describe('L’étagère — la corde traverse la bande et s’accroche au bloc du haut', () => {
  // 70 px n'est pas un goût : c'est la somme de trois nombres qui vivent ailleurs.
  // C'est précisément le genre de chiffre qu'on recopie et qu'on oublie — donc il
  // est relu à sa source, dans les deux fichiers, à chaque `vitest run`.
  it('--abs-corde est la SOMME des trois respirations, relue là où elle est écrite', () => {
    const étagère = declarations('.abs-etagere')
    // 1 · la respiration du bas du transat, dans cette feuille.
    const blocTransat = /\.abs-hamac\s*\{[^}]*\}/.exec(CSS)[0]
    const quatre = /padding:\s*([^;]+)/.exec(blocTransat)[1].trim().split(/\s+/)
    const respiration = parseInt(quatre[quatre.length - 1], 10) // la dernière = le bas
    // 2 · le remplissage du haut de `<main>`, dans la page.
    const page = lire('src', 'pages', 'Absences.jsx')
    const remplissage = parseInt(/main:\s*\{\s*padding:\s*(\d+)/.exec(page)[1], 10)
    // 3 · la chute, qui est un jeton de l'échelle, pas un nombre de la page.
    const nom = /--abs-chute:\s*var\((--charte-espace-\d)\)/.exec(étagère)[1]
    const tokens = lire('src', 'styles', 'tokens.css')
    const chute = parseInt(new RegExp(`${nom}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(tokens)[1], 10)

    const posée = parseInt(/--abs-corde:\s*(\d+)px/.exec(étagère)[1], 10)
    expect([respiration, remplissage, chute, posée]).toEqual([26, 20, 24, 70])
    expect(posée).toBe(respiration + remplissage + chute)
  })

  // La bande est grimpée, pas résorbée : `margin-top: calc(chute − corde)` remonte la
  // boîte de `corde − chute`, `padding-top: corde` la redescend d'autant. Le bois est
  // exactement où il était — si l'un des deux est touché sans l'autre, les six
  // planches sautent de 46 px sous le transat, et la table en dessous avec.
  it('le bois ne bouge pas d’un pixel : c’est la corde qui s’allonge', () => {
    const étagère = nud(declarations('.abs-etagere'))
    expect(étagère).toContain('margin:calc(var(--abs-chute)-var(--abs-corde))auto0')
    expect(étagère).toMatch(/padding:var\(--abs-corde\)var\(--charte-espace-5\)var\(--charte-espace-5\)/)
  })

  // Les deux longues cordes tombent sur les bouts du rail parce qu'elles lisent le
  // MÊME jeton que le remplissage horizontal de l'étagère — et parce qu'aucune coupe
  // d'écran ne redefine l'un sans l'autre. (La feuille en portait une, à 680 px, qui
  // passait l'étagère à 16 px : la corde restait à 24, soit 8 px à côté du rail.)
  it('l’aplomb des cordes est celui du rail, à toute largeur', () => {
    const cordes = declarations('.abs-etagere-suspentes')
    expect(cordes).toMatch(/left:\s*var\(--charte-espace-5\)/)
    expect(cordes).toMatch(/right:\s*var\(--charte-espace-5\)/)
    expect(cordes).toMatch(/top:\s*0/)
    expect(cordes).toMatch(/position:\s*absolute/)
    const étagère = declarations('.abs-etagere')
    expect(étagère).toMatch(/padding:\s*var\(--abs-corde\)\s+var\(--charte-espace-5\)/)
    // et personne ne redefini plus le retrait horizontal de l'étagère dans un média
    for (const coupe of ['1180', '680', '650', '420']) {
      expect(media(`@media (max-width: ${coupe}px)`, '.abs-etagere')).not.toMatch(/padding-(left|right):/)
    }
  })

  // Sous 650 px, la tuile du transat passe à `width: 100%` : une corde qui traverse
  // la bande marcherait sur son bois. Elle se retire, et le rail reste pendu à ses
  // propres cordes courtes — la figure survit, seule la traversée s'arrête.
  it('sous 650 px la corde se retire, et le rail reste à sa place', () => {
    const bloc = media('@media (max-width: 650px)', '.abs-etagere')
    expect(bloc).toMatch(/--abs-corde:\s*var\(--abs-chute\)/)
    expect(bloc).toMatch(/\.abs-etagere-suspentes\s*\{\s*display:\s*none/)
    expect(bloc).toMatch(/margin-top:\s*0/)
    expect(bloc).toMatch(/padding-top:\s*var\(--abs-chute\)/)
    // la coupe du transat, elle, est toujours là et n'a rien gagné : le raccord ne
    // touche pas à la figure d'en haut
    const transat = media('@media (max-width: 650px)', '.abs-hamac-suspendu')
    expect(transat).toContain('width: 100%')
    expect(transat).not.toMatch(/abs-etagere/)
  })

  // La corde passe dans le vide à côté du transat, et sous le bois si jamais elle
  // le longe : jamais elle ne capte un clic, jamais elle ne peint par-dessus.
  it('la corde est muette, hors du clic, et sous le bois', () => {
    const cordes = declarations('.abs-etagere-suspentes')
    expect(cordes).toMatch(/pointer-events:\s*none/)
    expect(cordes).toMatch(/z-index:\s*0/)
    expect(declarations('.abs-etagere-planches')).toMatch(/z-index:\s*1/)
    expect(declarations('.abs-etagere-planches')).toMatch(/position:\s*relative/)
    // le rang de cordes vit dans le composant, pas dans la page : la page ne connaît
    // pas la menuiserie, et le transat reste monté où le fondateur l'a validé
    expect(JSX).toContain('className="abs-etagere-suspentes"')
    expect(JSX).not.toMatch(/abs-hamac/)
  })
})

describe('L’étagère — une planche ne rogne pas ce qu’elle porte', () => {
  it('aucune planche ne fige sa hauteur : `min-height` seulement', () => {
    // Les trois règles qui font le bois — la case, le corps, le bouton. Une `height`
    // ici est un libellé rogné sur un écran de 900 px, et rien ne le dit sur la
    // capture d'un grand bureau.
    for (const sel of ['.abs-planche', '.abs-planche-corps', 'button.abs-planche-corps']) {
      expect(declarations(sel)).not.toMatch(/(^|;)\s*height:/)
    }
    expect(declarations('.abs-planche-corps')).toContain('min-height: var(--abs-planche)')
    // la corde courte et la jauge, elles, ont une hauteur : c'est la menuiserie, pas le bois
    expect(declarations('.abs-planche-corde')).toMatch(/height:/)
    expect(declarations('.abs-planche-jauge')).toMatch(/height:/)
  })

  it('le libellé a le droit de passer sur deux lignes : ni ellipsis, ni nowrap', () => {
    const corps = declarations('.abs-planche-label')
    expect(corps).not.toMatch(/text-overflow/)
    expect(corps).not.toMatch(/white-space/)
    // et le mot entier reste lisible à toute largeur : 11 px, le grain `micro`
    expect(corps).toContain('font-size: var(--charte-taille-micro)')
  })

  it('le chiffre peut se rabattre sur une seconde ligne sans déborder', () => {
    expect(declarations('.abs-planche-nombre')).toMatch(/flex-wrap:\s*wrap/)
    expect(declarations('.abs-planche-nombre')).toMatch(/min-width:\s*0/)
    expect(declarations('.abs-planche')).toMatch(/min-width:\s*0/)
  })
})

describe('L’étagère — ce que la maquette promettait et que le code peut oublier', () => {
  it('les visages sont des disques, et c’est le token qui le dit', () => {
    // « le rond passe à var(--charte-rayon-pilule) » : sur un carré de 22 px, 50 % et
    // le jeton tracent le même disque — mais 50 % n'est pas dans la liste de D-016.
    const corps = declarations('.abs-planche-visage')
    expect(corps).toContain('border-radius: var(--charte-rayon-pilule)')
    expect(corps).not.toMatch(/50%/)
    expect(JSX).not.toMatch(/borderRadius:\s*'50%'/)
  })

  it('le survol répond, sans ambre, sans `!important`, et sans effacer la corde', () => {
    const plage = CSS.slice(CSS.indexOf('.abs-etagere {'), CSS.indexOf('@media (max-width: 1180px)'))
    expect(plage).not.toMatch(/!important/)
    for (const survol of plage.matchAll(/:hover\s*\{([^}]*)\}/g)) {
      expect(survol[1]).not.toMatch(/opacity/)
      expect(survol[1]).not.toMatch(/--abs-ambre|--abs-gold|amber/)
    }
    expect(declarations('button.abs-planche-corps:hover')).toContain('background: var(--charte-surface2)')
  })

  it('la couture des conflits est un fil oblique, pas un bandeau, et il meurt avec le conflit', () => {
    expect(declarations('.abs-planche-couture')).toMatch(/repeating-linear-gradient\(135deg/)
    expect(declarations('.abs-planche-couture')).not.toMatch(/background:\s*var\(--abs-coral\)/)
    const nombre = (props) => (renderToStaticMarkup(<AbsencesKpiCards {...props} />).match(/abs-planche-couture/g) || []).length
    expect(nombre({ conflitsEnAttente: 3, onVoirConflits: () => {} })).toBe(1)
    expect(nombre({ conflitsEnAttente: 0 })).toBe(0)
  })

  it('une étiquette d’action par pancarte cliquable, posée sur la planche et hors du clic', () => {
    const corps = declarations('.abs-planche-etiquette')
    expect(corps).toMatch(/right:\s*8px/)
    expect(corps).toMatch(/bottom:\s*8px/)
    expect(corps).toMatch(/pointer-events:\s*none/) // le clic est sur toute la planche
    expect(corps).toMatch(/clip-path:\s*polygon\(5px 0, 100% 0, 100% 100%, 0 100%, 0 5px\)/)
    const html = renderToStaticMarkup(
      <AbsencesKpiCards
        conflitsEnAttente={2}
        absences={[{ status: 'en_attente', start_date: `${moisDe(AUJOURDHUI)}-01`, employee_id: 'e1' }]}
        employes={[{ id: 'e1', first_name: 'Awa', last_name: 'Diallo' }]}
        onVoirConflits={() => {}}
        onVoirDemandes={() => {}}
      />,
    )
    const étiquettes = [...html.matchAll(/abs-planche-etiquette[^>]*>([^<]*)/g)].map((m) => m[1])
    expect(étiquettes).toEqual(['Traiter', 'Arbitrer'])
    // et rien quand il n'y a rien à faire : une étiquette muette est une promesse vide
    expect(renderToStaticMarkup(<AbsencesKpiCards conflitsEnAttente={0} />)).not.toMatch(/abs-planche-etiquette/)
  })

  it('six planches, deux longues cordes, et le transat n’est pas redessiné ici', () => {
    const html = renderToStaticMarkup(<AbsencesKpiCards />)
    const compte = (c) => [...html.matchAll(/class="([^"]*)"/g)].filter((m) => m[1].split(/\s+/).includes(c)).length
    expect(compte('abs-planche')).toBe(6)
    expect(compte('abs-planche-corde')).toBe(6)
    expect(compte('abs-etagere-suspentes')).toBe(1)
    expect((html.match(/<i><\/i>/g) || []).length).toBe(12) // deux cordes par planche
    expect(JSX).not.toMatch(/abs-hamac/) // le transat se suspend où il est
  })

  it('un chiffre peint sur bois reste un chiffre peint : rien de la maquette ne se recopie', () => {
    // « 3 · 0,4 % · 30,0 j » est une image, et 0,4 % est né d'un prompt, pas d'une
    // table. Un littéral ici serait un chiffre gravé dans le bois.
    expect(JSX).not.toMatch(/0,4|30,0/)
    expect(JSX).toMatch(/mesures\.tauxAbsence/)
    expect(JSX).toMatch(/mesures\.soldeMoyen/)
    expect(JSX).toContain("+{enPlus}")
    expect(JSX).toMatch(/import \{ soldeMoyen \} from '\.\.\/services\/congesRestants'/)
  })

  it('les deux seules valeurs en ligne viennent des données, pas du goût', () => {
    // trois, pas un de plus : le diamètre d'un visage (deux fois, <img> et son
    // repli d'initiales) et le remplissage d'une jauge. Tout le reste est peint
    // dans la feuille, donc `npm run charte` le voit.
    const enLigne = [...JSX.matchAll(/style=\{\{([\s\S]*?)\}\}/g)].map((m) => m[1])
    expect(enLigne).toHaveLength(3)
    expect(enLigne.every((s) => /width|height|fontSize/.test(s))).toBe(true)
    expect(enLigne.some((s) => /background|color|border|padding|margin|font-size/.test(s))).toBe(false)
  })

  // Un `var(--jeton-fantôme)` ne lève pas d'erreur : il tombe en 0, et le dessin se
  // délite sans qu'aucun message le dise. C'est exactement ce que faisaient les cinq
  // espaces que la maquette s'était déclarés à elle-même, absents de cette feuille.
  it('aucun jeton fantôme dans la plage : tout ce qui est lu est déclaré', () => {
    const étagère = CSS.slice(CSS.indexOf('.abs-etagere {'), CSS.indexOf('@media (max-width: 1180px)'))
    const lus = [...étagère.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1])
    // l'échelle vient de `tokens.css`, la menuiserie de la feuille de la page :
    // un jeton n'est déclaré que si l'un des deux le pose.
    const déclarés = new Set(
      [CSS, lire('src', 'styles', 'tokens.css')].flatMap((t) => [...t.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1])),
    )
    expect([...new Set(lus)].filter((t) => !déclarés.has(t))).toEqual([])
    expect(lus.length).toBeGreaterThan(20)
    // trois grains seulement, pris dans l'échelle : 26 px de chiffre, 11 px de
    // libellé, 9,5 px de capitales — pas un quatrième
    const grains = [...étagère.matchAll(/font-size:\s*([^;]+)/g)].map((m) => m[1].trim())
    expect([...new Set(grains)].sort()).toEqual([
      '26px',
      'var(--charte-taille-bouton)',
      'var(--charte-taille-micro)',
    ])
  })

  it('le bandeau de titre, gelé, ne porte aucune attache de plus', () => {
    // Le fondateur a validé la chemise « telle quelle » le 24/11 : l'étagère
    // s'accroche SOUS elle, sans la percer ni la rallonger. Un œillet, un crochet
    // ou un cordon de plus sur cette feuille serait un changement de contrat, pas
    // un ajustement de figure — et `absencesChemise.test.jsx` (9 verrous) veille
    // déjà sur ses nombres à elle. Ici on vérifie seulement que l'étagère n'a pas
    // étendu la main : la plage ci-dessous ne doit toucher aucun sélecteur `.abs-chemise`.
    const étagère = CSS.slice(CSS.indexOf('.abs-etagere {'))
    expect(étagère).not.toMatch(/\.abs-chemise/)
    expect(CSS).not.toMatch(/oeillet|crochet-chemise|abs-pendaison/)
    // et la chemise n'a pas gagné de `clip-path` en passant
    const chemise = CSS.slice(CSS.indexOf('.abs-chemise {'), CSS.indexOf('.abs-etagere {'))
    expect(chemise).not.toMatch(/clip-path/)
  })
})
