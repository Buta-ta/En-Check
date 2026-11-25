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
const DESSIN = 'maquettes/absences-raccord-R1-poutre.png'

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

// Les lignes de CODE d'un fichier, commentaires retirés : un verrou qui cherche
// `<AbsencesHamac` dans tout `Absences.jsx` se fait avoir par la phrase qui explique
// pourquoi il n'y en a plus.
const codes = (src) => src.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))
const porte = (src, motif) => codes(src).some((l) => l.includes(motif))

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
   CE FICHIER NE REJOUE PAS LA MAQUETTE. Il garde les trois promesses qui ne se
   voient pas sur une capture large :
   1. « en pensant à comment rendre ça responsive en tout écran » (30/11) ;
   2. « relier l'étagère au bloc d'en haut, les accrocher là » (1/12, redit le 2/12) ;
   3. « je choisis la R1-poutre, je veux exactement ce résultat » (2/12) — donc :
      sept planches, plus de bloc entre la chemise et la rangée, plus de tringle
      posée à la main sur un bord d'écran.
   Chacune se défait en silence : une planche à hauteur fixe rogne un mot, un libellé
   à points de suspension avale une syllabe, une tringle par rangée reste en l'air
   dès que les planches passent de sept à trois, et une corde recalculée à la main
   dort le jour où quelqu'un respire `<main>`. D'où un test qui RELIT les sources des
   nombres au lieu de les répéter.
   ──────────────────────────────────────────────────────────────────────────── */

describe('L’étagère — le rail appartient à la planche, pas à la rangée', () => {
  it('la traverse se dessine sur chaque planche, en `::before` pleine largeur de case', () => {
    const rail = declarations('.abs-planche::before')
    expect(rail).toMatch(/position:\s*absolute/)
    expect(rail).toMatch(/left:\s*0/)
    expect(rail).toMatch(/right:\s*0/)
    expect(rail).toContain('height: var(--abs-tringle)')
    // et les colonnes sont SANS écart : c'est ce qui colle les sept bandeaux en un
    // seul trait plein, comme le dessine R1
    expect(declarations('.abs-etagere-planches')).toMatch(/gap:\s*var\(--abs-chute\) 0/)
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

  it('sept, quatre, trois, deux, une — dans cet ordre, et jamais un rang sans cordes', () => {
    expect(declarations('.abs-etagere-planches')).toMatch(/grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\)/)
    expect(media('@media (max-width: 1180px)')).toMatch(/repeat\(4, minmax\(0, 1fr\)\)/)
    expect(media('@media (max-width: 680px)')).toMatch(/repeat\(3, minmax\(0, 1fr\)\)/)
    expect(media('@media (max-width: 420px)')).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/)
    const points = ['1180', '680', '420'].map((px) => CSS.indexOf(`@media (max-width: ${px}px)`))
    expect(points).toEqual([...points].sort((a, b) => a - b))
  })

  it('les cinq hauteurs de la menuiserie viennent d\'un seul endroit : la rangée', () => {
    // La corde de la planche ET la hauteur de la rangée lisent la même
    // `--abs-corde` : sinon l'anneau ne touche plus le bord de la chemise à une
    // largeur d'écran, et ce n'est jamais une casse — c'est un raccord faux.
    const étagère = declarations('.abs-etagere')
    expect(étagère).toContain('--abs-chute: var(--charte-espace-5)')
    expect(étagère).toContain('--abs-tringle: 10px')
    expect(étagère).toContain('--abs-planche: 88px')
    expect(étagère).toContain('--abs-corde: 20px') // le seul vide sous la chemise, voir plus bas
    const corde = nud(declarations('.abs-planche-corde'))
    expect(corde).toContain('height:var(--abs-corde)')
    expect(corde).toContain('top:calc(-1*(var(--abs-corde)+var(--abs-tringle)))')
    // la place de la corde est portée par la planche, pas par la rangée
    expect(nud(declarations('.abs-planche'))).toContain('margin-top:var(--abs-corde)')
    // l'anneau se pose à hauteur du bord du bas de la chemise
    expect(nud(declarations('.abs-planche-corde i::before')))
      .toContain('top:calc(-1*(var(--abs-corde)+var(--abs-tringle)))')
  })
})

/* ────────────────────────────────────────────────────────────────────────────
   LE RACCORD AU BLOC DU HAUT — troisième tour, 2/12 : « tu as laissé bcp d'espace
   vide entre le bloc d'en haut et l'étagère », puis, face à la mesure, « je choisis
   la R1-poutre ». La corde ne TRAVERSE plus la bande : il n'y a plus de bande.

   Quatre verrous, un par façon dont ce raccord se défait tout seul : un 20 px
   recopié qui dort quand quelqu'un respire `<main>`, le bois qui saute quand
   `margin-top` et la corde se quittent des yeux, l'anneau qui dérape à côté du bord
   de la chemise, et la corde qui se met à capter un clic.
   ──────────────────────────────────────────────────────────────────────────── */
describe('L’étagère — plus de bande à franchir : la rangée pend du bord du bas', () => {
  // 20 px n'est pas un goût : c'est le `padding-top` de `<main>`, écrit ailleurs.
  // C'est précisément le genre de chiffre qu'on recopie et qu'on oublie — donc il est
  // relu à sa source à chaque `vitest run`.
  it('--abs-corde est le vide qu\'il reste sous la chemise, relu dans la page', () => {
    const étagère = declarations('.abs-etagere')
    const page = lire('src', 'pages', 'Absences.jsx')
    const main = parseInt(/main:\s*\{\s*padding:\s*(\d+)/.exec(page)[1], 10)
    const posée = parseInt(/--abs-corde:\s*(\d+)px/.exec(étagère)[1], 10)
    expect(main).toBe(20)
    expect(posée).toBe(main)
    // et le bloc du transat est bien parti : sinon la corde de 20 px retomberait sur
    // un bloc de 253 px, et nous revoilà au 1/12 — « aucun changement »
    expect(porte(page, 'AbsencesHamac')).toBe(false)
    expect(porte(page, 'transat.jours')).toBe(true) // le nombre passe, la figure non
  })

  // Le raccord est une ANNULATION, pas un empilement : `margin-top: -corde` efface le
  // `padding-top` de `<main>`, `padding: 0` de la rangée dit qu'elle ne garde rien.
  // Toucher l'un sans l'autre fait sauter les sept planches de 20 px.
  it('le vide est annulé, pas résorbé : les deux nombres se répondent', () => {
    const étagère = nud(declarations('.abs-etagere'))
    expect(étagère).toContain('margin:calc(-1*var(--abs-corde))autovar(--abs-chute)')
    expect(étagère).toContain('padding:0var(--abs-retrait)')
    // la corde, elle, est rendue planche par planche — c'est ce qui fait qu'un rang
    // qui se replie garde ses cordes
    expect(nud(declarations('.abs-planche'))).toContain('margin-top:var(--abs-corde)')
  })

  // L'anneau est le point d'accroche : il se pose à la hauteur du bord du bas de la
  // chemise, donc une corde + une traverse au-dessus du haut de la corde, et le
  // retrait horizontal est LE MÊME que celui de la rangée.
  it('l’anneau tombe sur le bord de la chemise, à son aplomb', () => {
    const anneau = declarations('.abs-planche-corde i::before')
    expect(nud(anneau)).toContain('top:calc(-1*(var(--abs-corde)+var(--abs-tringle)))')
    expect(anneau).toMatch(/left:\s*-5px/) // centré sur un trait de 2 px : -(8 + 2) / 2
    const étagère = declarations('.abs-etagere')
    expect(étagère).toMatch(/padding:\s*0\s+var\(--abs-retrait\)/)
    expect(étagère).toMatch(/--abs-retrait:\s*40px/)
    // 40 = le retrait du contenu de la chemise, relu dans la feuille : 16 + 24
    const chimise = declarations('.abs-chemise')
    const feuille = declarations('.abs-chemise-feuille')
    const bas = (bloc, i) => parseInt(bloc.match(new RegExp(`padding:\\s*([^;]+)`))[1].trim().split(/\s+/)[i], 10)
    expect(bas(chimise, 1) + bas(feuille, 1)).toBe(40)
    // et aucune coupe ne repositionne le retrait horizontal : la rangée garde son
    // aplomb à 1180, 680 et 420 px
    for (const coupe of ['1180', '680', '420']) {
      expect(media(`@media (max-width: ${coupe}px)`, '.abs-etagere-planches')).not.toMatch(/padding-(left|right):/)
    }
  })

  // La corde est un dessin : jamais une cible, jamais par-dessus le bois.
  it('la corde est muette, hors du clic, et sous la traverse', () => {
    const corde = declarations('.abs-planche-corde')
    expect(corde).toMatch(/pointer-events:\s*none/)
    expect(corde).toMatch(/position:\s*absolute/)
    expect(declarations('.abs-etagere-planches')).toMatch(/z-index:\s*1/)
    expect(declarations('.abs-planche-corde')).toMatch(/top:\s*calc\(-1/)
    // le rang de cordes vit dans le composant, planche par planche — la page ne
    // connaît pas la menuiserie, et n'a plus aucune corde à elle
    expect(JSX).toContain('className="abs-planche-corde"')
    expect(JSX).not.toMatch(/abs-etagere-suspentes/)
    expect(CSS).not.toMatch(/abs-etagere-suspentes/)
  })

  // R1 dessine sept pancartes, pas six et un bloc au-dessus.
  it('sept planches pendues, et le transat n’est plus un bloc de la page', () => {
    const html = renderToStaticMarkup(<AbsencesKpiCards jours={30} retour="lun. 30 nov." />)
    expect((html.match(/class="abs-planche"/g) || [])).toHaveLength(7)
    expect((html.match(/abs-planche-corde/g) || [])).toHaveLength(7) // un rang par planche
    expect(html).toContain('data-testid="abs-kpi-solde"')
    expect(html).toContain('Jours de congé qui restent')
    expect(html).toContain('retour lun. 30 nov.') // la note du bloc est descendue avec lui
    expect(html).not.toMatch(/abs-hamac/)
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

  it('sept planches pendues, deux cordes chacune, et rien au-dessus d’elles', () => {
    const html = renderToStaticMarkup(<AbsencesKpiCards jours={30} />)
    const compte = (c) => [...html.matchAll(/class="([^"]*)"/g)].filter((m) => m[1].split(/\s+/).includes(c)).length
    expect(compte('abs-planche')).toBe(7) // six compteurs + le solde descendu du transat
    expect(compte('abs-planche-corde')).toBe(7) // un rang de cordes PAR planche, jamais un seul pour la rangée
    expect(compte('abs-etagere-suspentes')).toBe(0) // la longue corde du 1/12 est morte avec le bloc
    expect((html.match(/<i><\/i>/g) || []).length).toBe(14) // deux cordes par planche
    expect(JSX).not.toMatch(/abs-hamac/) // le composant ne redessine pas le transat : il le pend
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
