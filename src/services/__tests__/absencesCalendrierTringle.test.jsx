import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import AbsencesCalendrier from '../../components/AbsencesCalendrier'

// ═══════════════════════════════════════════════════════════
// 🪝 LA TRINGLE du calendrier — le contrat de `maquettes/absences-outils-1-rideau.png`
//
// Le 9/12, le fondateur a envoyé la capture du bandeau (période, modes, sept
// pastilles de motif, « Tous les motifs », « Masquer les employés sans
// absence », « Déclarer ») et a demandé deux figures. Il a retenu la tringle:
// « je le veux exactement comme dans la maquette ». Ce fichier ne rejoue pas
// l'image — il garde les promesses qu'on ne voit pas dessus :
//   1. UNE tringle, pas trois lignes ; le bois se peint par tronçon sur chaque
//      pièce, donc un rang qui se replie à 390 px tend son propre trait ;
//   2. rien n'est supprimé du bandeau, tout est suspendu : les six commandes
//      existent encore, et le « Réallumer » ne s'accroche que s'il y a quelque
//      chose à rallumer ;
//   3. le nombre sous une étiquette est un fait de la période, pas un chiffre
//      de la maquette — et il survit au masque, sinon éteindre veut dire zéro ;
//   4. l'anneau mord le bois, la ficelle mesure exactement ce qui manque, la
//      pince serre au lieu de reposer.
// ═══════════════════════════════════════════════════════════

const RACINE = path.resolve(import.meta.dirname, '../../..')
const lire = (...chemins) => fs.readFileSync(path.join(RACINE, ...chemins), 'utf8')

const COMPOSANT = lire('src', 'components', 'AbsencesCalendrier.jsx')
const PAGE = lire('src', 'pages', 'Absences.jsx')
const FEUILLE = lire('src', 'pages', 'AbsencesAfroTech.css')
const CSS = FEUILLE.replace(/\/\*[\s\S]*?\*\//g, '')
// la rubrique de la tringle court jusqu'à la fin de la feuille — elle est
// posée là parce qu'elle doit tenir devant les correctifs `!important` du tas
// de fin — mais elle s'ARRÊTE où commence celle de la corde (10/12) : la
// corde a son propre fichier de serrures, `absencesCalendrierCorde.test.jsx`,
// et une serrure qui lit le bloc du voisin se déclenche pour les mauvaises
// raisons (le rayon de la planche n'est pas une affaire de tringle).
const DÉBUT_CORDE = CSS.search(/\.abs-cal\s*\{\s*--abs-corde-fil/)
if (DÉBUT_CORDE === -1) throw new Error('rubrique de la corde introuvable : la tringle ne sait plus où elle finit')
const TRINGLE = CSS.slice(CSS.indexOf('.abs-tringle {'), DÉBUT_CORDE)

const DESSIN = 'maquettes/absences-outils-1-rideau.png'

const nud = (chaîne) => chaîne.replace(/\s+/g, '')
const codes = (src) => src.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))
const porte = (src, motif) => codes(src).some((l) => l.includes(motif))

/** Le corps d'une règle, sélecteur retiré. */
function declarations(sélecteur, plage = CSS) {
  const i = plage.indexOf(`${sélecteur} {`)
  if (i === -1) throw new Error(`règle absente de la feuille : ${sélecteur}`)
  const début = plage.indexOf('{', i)
  const fin = plage.indexOf('}', début)
  return plage.slice(début + 1, fin)
}

/** Un jeton lu dans une plage, par son nom — jamais par un nombre recopié ici. */
function jeton(plage, nom) {
  const trou = plage.split(`${nom}:`)[1]
  if (!trou) throw new Error(`jeton absent : ${nom}`)
  return Number(trou.trim().split(';')[0].replace('px', ''))
}

/** Le bloc d'un calcul, de sa ligne d'ouverture à sa dépendance fermante. */
function bloc(source, début) {
  const i = source.indexOf(début)
  if (i === -1) throw new Error(`bloc absent : ${début}`)
  const fin = source.indexOf('}, [', i)
  return source.slice(i, fin)
}

// ── le jeu de données : la semaine du lundi 19 au dimanche 25 octobre 2026 ──
const employes = [
  { id: 'e1', first_name: 'Aïssatou', last_name: 'Diallo', enterprise_id: 'ent-1' },
  { id: 'e2', first_name: 'Mamadou', last_name: 'Sarr', enterprise_id: 'ent-1' },
  { id: 'e3', first_name: 'Salimata', last_name: 'Cissé', enterprise_id: 'ent-1' },
]

const absence = (id, employee_id, start_date, end_date, reason, extra = {}) => ({
  id,
  employee_id,
  enterprise_id: 'ent-1',
  start_date,
  end_date,
  reason,
  status: 'approuve',
  count_holidays_as_leave: false,
  created_at: '2026-10-01T08:00:00Z',
  ...extra,
})

const absences = [
  absence('a1', 'e1', '2026-10-19', '2026-10-21', 'conge'),
  absence('a2', 'e1', '2026-10-22', '2026-10-22', 'conge'),
  absence('a3', 'e2', '2026-10-15', '2026-10-23', 'maladie', { status: 'en_attente' }),
  absence('a4', 'e3', '2026-10-30', '2026-11-02', 'formation'), // hors période
  absence('a5', 'e9', '2026-10-20', '2026-10-20', 'conge'), // employé hors périmètre
]

function rendre(props = {}) {
  return renderToStaticMarkup(
    <AbsencesCalendrier
      absences={absences}
      employes={employes}
      annee={2026}
      mois={9}
      mode="semaine"
      jourInitial="2026-10-21"
      darkMode
      onDeclarer={() => {}}
      {...props}
    />
  )
}

const rendu = rendre()
const nombreDe = (lus) => {
  const i = rendu.indexOf(`data-motif="${lus}"`)
  const trou = rendu.slice(i, rendu.indexOf('</button>', i))
  return Number(trou.match(/abs-pince-nombre">(\d+)</)[1])
}

describe('🪝 la tringle du calendrier', () => {
  it('0. la maquette retenue est dans le dépôt et nommée dans le composant', () => {
    expect(fs.existsSync(path.join(RACINE, DESSIN))).toBe(true)
    expect(COMPOSANT).toContain(DESSIN)
  })

  it('1. une tringle, une rangée : les trois lignes de pastilles sont parties', () => {
    expect(rendu).toContain('class="abs-tringle"')
    expect(rendu).toContain('class="abs-tringle-rangee"')
    // le vieux bandeau s'habillait de trois helpers de style en ligne ; ils
    // n'ont plus d'usage et n'ont pas été laissés là pour la décoration
    for (const helper of ['boutonNav', 'boutonDoux', 'boutonPrimaire']) {
      expect(porte(COMPOSANT, helper)).toBe(false)
    }
    // et la ligne de puces n'existe plus : le motif se pince, il ne se pilule pas
    expect(porte(COMPOSANT, 'Filtres par motif')).toBe(false)
  })

  it('2. sept pinces, une par motif, chacune muette sur son bois et son crochet', () => {
    const pinces = rendu.match(/<button[^>]*class="abs-pince[^"]*"/g) || []
    expect(pinces.length).toBeGreaterThanOrEqual(7)
    for (const p of pinces) {
      expect(p).toContain('aria-pressed=')
      expect(p).toContain('data-motif=')
    }
    // une pince ôtée se lit à la forme, pas seulement à la couleur
    expect(TRINGLE).toContain('.abs-pince.est-eteint')
    expect(nud(declarations('.abs-pince.est-eteint', TRINGLE))).toContain('transform:rotate(-2deg)')
    // l'état est dit aussi par un mot, dans l'infobulle
    expect(COMPOSANT).toContain('éteint — cliquer pour le rallumer')
  })

  it('3. les libellés de motif sont intacts, à la verticale par le CSS', () => {
    for (const mot of ['Congé payé', 'Maladie', 'Formation']) {
      expect(rendu).toContain(mot)
    }
    expect(rendu).not.toMatch(/>\s*conge\s*</)
    const nom = declarations('.abs-pince-nom', TRINGLE)
    expect(nom).toContain('writing-mode: vertical-rl')
    expect(nom).toContain('transform: rotate(180deg)')
  })

  it('4. le nombre sous l\'étiquette compte la période, pas l\'historique', () => {
    expect(nombreDe('conge')).toBe(2) // deux congés du 19 et du 22, dans la semaine
    expect(nombreDe('maladie')).toBe(1) // à cheval sur le bord, donc compté
    expect(nombreDe('formation'))
      .toBe(0) // 30 oct. → 2 nov. : hors de la semaine affichée
  })

  it('5. un employé hors du périmètre ne se compte pas', () => {
    // a5 est un « conge » du 20 oct. posé sur e9, qui n'est pas dans `employes` :
    // la grille l'ignore, le compte l'ignore aussi — sinon une pince annoncerait
    // un cas qu'on ne retrouvera jamais dans les lignes
    expect(nombreDe('conge')).toBe(2)
  })

  it('6. le compte ne suit pas le masque : éteindre ne fait pas disparaître le nombre', () => {
    const calcul = bloc(COMPOSANT, 'const comptes = useMemo(')
    expect(calcul).toContain('segmentSurJours') // la même géométrie que les lignes
    expect(calcul).toContain('jours') // la période affichée
    expect(calcul).not.toContain('motifsMasques') // et rien du masque
    expect(calcul).toContain('vus.has(a.employee_id)') // le même périmètre d'employés
  })

  it('7. le titre de la période reste la phrase du service, en capitales de CSS', () => {
    expect(rendu).toContain('Lun 19 – Dim 25 Oct. 2026')
    // la maquette écrivait « LUN 23 → DIM 29 » : la flèche est une tache de
    // dessin, et une capitaine inventée dans le texte se retrouve dans les
    // captures d'écran et les exports — c'est le CSS qui met les majuscules
    expect(declarations('.abs-tringle-plaque', TRINGLE)).toContain('text-transform: uppercase')
    const plaque = rendu.slice(rendu.indexOf('abs-tringle-plaque"'), rendu.indexOf('</button>', rendu.indexOf('abs-tringle-plaque"')))
    expect(plaque).toContain('Lun 19 – Dim 25 Oct. 2026')
    expect(plaque).not.toContain('→') // la flèche de la maquette n'est pas une donnée
  })

  it('8. le bois se peint par tronçon, sans montant d’encre à la couture', () => {
    const pièce = nud(declarations('.abs-tringle-bois', TRINGLE))
    const pince = nud(declarations('.abs-pince::before', TRINGLE))
    expect(pièce).toContain('top:var(--abs-tringle-ciel)')
    expect(pince).toContain('top:var(--abs-tringle-ciel)')
    // la soudure : le débord de chaque côté vaut la moitié de l'écart, plus un
    // chevron — se toucher laissait un fil blanc d'antialiasing entre deux
    // tronçons, et la capture du 9/12 montrait une tringle en lattes
    for (const côté of ['left', 'right']) {
      expect(pièce).toContain(`${côté}:calc(-1*var(--abs-tringle-debord))`)
      expect(pince).toContain(`${côté}:calc(-1*var(--abs-tringle-debord))`)
    }
    const jetons = declarations('.abs-tringle', TRINGLE)
    expect(jeton(jetons, '--abs-tringle-debord') * 2).toBeGreaterThanOrEqual(
      jeton(jetons, '--abs-tringle-ecart')
    )
    // la hauteur du trait inclut ses deux rives : 10 px de bois, 14 px posés
    expect(pièce).toContain('height:calc(var(--abs-tringle-bois)+2*var(--charte-trait))')
    expect(pince).toContain('height:calc(var(--abs-tringle-bois)+2*var(--charte-trait))')
    // et surtout : DEUX RIVES, PAS UN CADRE. Un `border` complet dessinait un
    // montant de 2 px à chaque jonction — l'anomalie signalée sur l'écran du
    // fondateur, qui voyait sept planchettes au lieu d'une tringle.
    for (const règle of [pièce, pince]) {
      expect(règle).not.toContain('border:var(--charte-trait)')
      expect(règle).toContain('border-top:var(--charte-trait)')
      expect(règle).toContain('border-bottom:var(--charte-trait)')
    }
  })

  it('9. l’anneau mord le bois : son centre tombe sur son axe', () => {
    const suspentes = nud(declarations('.abs-tringle-suspentes', TRINGLE))
    expect(suspentes).toContain('top:calc(')
    // le calcul est écrit, pas deviné : (bois + 2 traits) / 2 pour le centre du
    // bois, moins (anneau + 2 traits) / 2 pour la moitié du cercle
    expect(suspentes).toContain('(var(--abs-tringle-bois)+2*var(--charte-trait))/2')
    expect(suspentes).toContain('(var(--abs-tringle-anneau)+2*var(--charte-trait))/2')
    // l'anneau se centre sur la corde par une écriture, pas par un -5 px à
    // l'œil : changer la taille de l'anneau doit déplacer le cercle, pas le
    // laisser de travers
    expect(nud(declarations('.abs-tringle-suspentes i::before', TRINGLE))).toContain(
      'left:calc(-1*(var(--abs-tringle-anneau)+var(--charte-trait))/2)'
    )
    // ET IL EST PLUS HAUT QUE LE BOIS. Posé à 8 px sur un bandeau de 10 + 2 × 2,
    // il disparaissait dedans : sur la capture du fondateur, on ne voyait plus
    // que deux trous — un anneau qui ne déborde pas du trou qu'il retient ne
    // mord rien, c'est la leçon du 3/12 reprise à l'envers.
    const jetons = declarations('.abs-tringle', TRINGLE)
    expect(jeton(jetons, '--abs-tringle-anneau')).toBeGreaterThan(jeton(jetons, '--abs-tringle-bois'))
    // l'air au-dessus du bois est un nombre à part : sinon agrandir l'anneau
    // descend le bois avec lui et toute la rangée bouge
    expect(jetons).toContain('--abs-tringle-ciel')
    const anneau = nud(declarations('.abs-tringle-suspentes i::before', TRINGLE))
    expect(anneau).toContain('border-radius:var(--charte-rayon-pilule)')
    expect(anneau).toContain('background:var(--charte-sable)')
  })

  it('10. la ficelle des billets mesure exactement ce qui manque', () => {
    const billets = nud(declarations('.abs-tringle-piece--billets', TRINGLE))
    expect(billets).toContain('padding-top:calc(var(--abs-tringle-ciel)+var(--abs-tringle-bois)+2*var(--charte-trait)+var(--abs-tringle-ficelle))')
    const ficelle = nud(declarations('.abs-tringle-billet::before', TRINGLE))
    expect(ficelle).toContain('top:calc(-1*var(--abs-tringle-ficelle))')
    expect(ficelle).toContain('height:var(--abs-tringle-ficelle)')
    // et la ficelle est plus longue que le saut des pièces, sinon le billet
    // pend au même cran qu'un anneau et ne se lit plus « suspendu »
    const jetons = declarations('.abs-tringle', TRINGLE)
    expect(jeton(jetons, '--abs-tringle-ficelle')).toBeGreaterThan(jeton(jetons, '--abs-tringle-saut'))
  })

  it('11. les six commandes du bandeau existent encore, toutes pendues', () => {
    for (const id of [
      'abs-cal-titre',
      'abs-cal-modes',
      'abs-cal-aujourdhui',
      'abs-cal-masquer-sans-absence',
      'abs-cal-declarer',
      'Période précédente',
      'Période suivante',
    ]) {
      expect(rendu).toContain(id)
    }
    // l'interrupteur garde sa mécanique d'accessibilité
    expect(rendu).toMatch(/role="switch"[^>]*aria-checked=/)
  })

  it('12. « Réallumer » ne s’accroche que s’il y a quelque chose à rallumer', () => {
    expect(rendu).not.toContain('abs-cal-tous-motifs') // rien de masqué : pas de bouton
    expect(porte(COMPOSANT, 'motifsMasques.size > 0 && (')).toBe(true)
    expect(COMPOSANT).toContain('Réallumer {motifsMasques.size} motif')
  })

  it('13. la tringle n’apporte ni couleur en dur, ni flou, ni rayon hors liste', () => {
    expect(TRINGLE).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
    expect(TRINGLE).not.toMatch(/rgba?\(/)
    expect(TRINGLE).not.toContain('blur(')
    const rayons = [...TRINGLE.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim())
    for (const r of rayons) {
      expect(['var(--charte-rayon-champ)', 'var(--charte-rayon-pilule)']).toContain(r)
    }
  })

  it('14. tout ce que la tringle appelle est déclaré quelque part de la feuille', () => {
    // un `var(--x)` non déclaré retombe à 0 : c'est exactement comme ça que
    // l'anneau du fil s'était téléporté le 2/12
    const appelés = [...TRINGLE.matchAll(/var\((--abs-[a-z-]+)\)/g)].map((m) => m[1])
    expect(appelés.length).toBeGreaterThan(20)
    for (const nom of new Set(appelés)) {
      expect(FEUILLE).toContain(`${nom}:`)
    }
  })

  it('15. aucune media ne repositionne la tringle : le repli est une coupe', () => {
    const medias = [...TRINGLE.matchAll(/@media[^{]*\{([\s\S]*?)\n\}/g)].map((m) => m[1])
    expect(medias.length).toBeGreaterThan(0)
    for (const blocDeMedia of medias) {
      for (const sélecteur of blocDeMedia.matchAll(/^\s*([.:#][^,{]*)[,{]/gm)) {
        expect(['.abs-tringle-bande', '.abs-tringle-nav', '.abs-tringle-plaque', '.abs-tringle-plaque-boite', '.abs-tringle-clou'])
          .toContain(sélecteur[1].trim())
      }
    }
    // la pince et son bois ne se retouchent pas : ils se débrouillent seuls
    expect(TRINGLE.slice(TRINGLE.indexOf('@media'))).not.toContain('.abs-pince')
    expect(TRINGLE.slice(TRINGLE.indexOf('@media'))).not.toContain('.abs-tringle-bois')
  })

  it('19. une étiquette ne se coupe jamais : le libellé fait la hauteur', () => {
    // LA faute vue sur sa capture : « Maternité/Paternité » s'écrivait
    // « é/Paternit ». L'étiquette avait une boîte et un `overflow: hidden`, et
    // le libellé, étiré en `flex: 1`, était rogné des deux bouts.
    const nom = declarations('.abs-pince-nom', TRINGLE)
    expect(nom).not.toContain('overflow: hidden')
    expect(nom).not.toContain('flex: 1')
    expect(nom).toContain('white-space: nowrap')
    // `min-height` reste un plancher — jamais un plafond
    const étiquette = nud(declarations('.abs-pince-etiquette', TRINGLE))
    expect(étiquette).toContain('min-height:var(--abs-pince-longueur)')
    // une vraie `height`, même écrite après un `min-`, serait un plafond : la
    // hauteur est laissée au libellé, et `min-height` ne sert que de plancher
    expect(declarations('.abs-pince-etiquette', TRINGLE)).not.toMatch(/(^|[;{\s])height\s*:/)
    expect(étiquette).toContain('justify-content:space-between')
    // et le nombre reste au pied, que le libellé fasse six ou vingt lettres
    expect(étiquette).not.toContain('max-height')
  })

  it('20. les sept pinces forment un groupe : la rangée ne se coupe plus n’importe où', () => {
    // la capture montrait deux tringles, la coupe tombant entre le registre et
    // les billets. Le groupe prend la ligne (`flex: 1 1 auto`) et se replie
    // sur son propre bois : les commandes gardent leurs anneaux en haut.
    expect(rendu).toContain('class="abs-tringle-pinces"')
    const groupe = nud(declarations('.abs-tringle-pinces', TRINGLE))
    expect(groupe).toContain('flex:11auto')
    expect(groupe).toContain('flex-wrap:wrap')
    expect(groupe).toContain('column-gap:var(--abs-tringle-ecart)') // la couture tient
    // la mâchoire déborde du bois de quatre pixels de chaque côté : à la
    // hauteur du bandeau, elle ne se voyait pas
    const mâchoire = declarations('.abs-pince-bois', TRINGLE)
    expect(mâchoire).toContain('top: calc(var(--abs-tringle-ciel) - 4px)')
  })

  it('21. la pince a reçu le métier du dock : elle se glisse sur une ligne', () => {
    // `AbsencesDock` est enlevé de la page — ses sept lignes portaient le
    // glisser-déposer, et le fondateur a jugé que les étiquettes de la tringle
    // pouvaient faire ce travail aussi. Le geste est donc venu ici, avec son
    // chargement : la clé du contexte ET le repli `text/plain`.
    expect(porte(COMPOSANT, 'draggable')).toBe(true)
    expect(porte(COMPOSANT, 'e.dataTransfer.setData(DATA_TRANSFER_MOTIF, m.id)')).toBe(true)
    expect(porte(COMPOSANT, "e.dataTransfer.setData('text/plain', m.id)")).toBe(true)
    expect(porte(COMPOSANT, "e.dataTransfer.effectAllowed = 'copy'")).toBe(true)
    expect(porte(COMPOSANT, 'setMotifGlissé(m.id)')).toBe(true)
    // le CLIC, lui, garde un seul métier : éteindre. Deux gestes sur un objet,
    // deux gestes différents — la leçon de la case du Planning.
    expect(porte(COMPOSANT, 'onClick={() => basculerMotif(m.id)}')).toBe(true)
    expect(porte(COMPOSANT, 'onDeclarer?.({ motifId: m.id })')).toBe(false)
    // la pince portée décroche du bois, l'étiquette pend d'un fil
    expect(TRINGLE).toContain('.abs-pince.est-glissée')
    expect(nud(declarations('.abs-pince.est-glissée .abs-pince-etiquette', TRINGLE))).toContain('border-style:dashed')
  })

  it('22. le dock est parti, sa phrase d’explication reste', () => {
    expect(porte(PAGE, '<AbsencesDock')).toBe(false)
    expect(fs.existsSync(path.join(RACINE, 'src/components/AbsencesDock.jsx'))).toBe(false)
    expect(FEUILLE).not.toContain('.abs-dock')
    // le « Comment déclarer une absence ? » du panneau déménage en note de la
    // tringle : le geste nouveau s'explique, il ne se devine pas
    expect(rendu).toContain('abs-tringle-note')
    expect(rendu).toContain('Glisse une pince sur la ligne d’un employé')
  })

  it('16. le mode actif reste un seul des trois, sur son anneau', () => {
    const modes = rendu.match(/<button[^>]*data-testid="abs-cal-mode-[^"]+"[^>]*>/g) || []
    expect(modes).toHaveLength(3)
    expect(modes.filter((m) => m.includes('aria-pressed="true"'))).toHaveLength(1)
    expect(TRINGLE).toContain('.abs-tringle-suspentes.est-un')
    expect(nud(declarations('.abs-tringle-suspentes.est-un', TRINGLE))).toContain('justify-content:center')
    expect(nud(declarations('.abs-tringle-mode.est-actif', TRINGLE))).toContain('background:var(--abs-argile)')
  })

  it('17. une seule porte « Déclarer » dans ce bandeau, à droite et au-dessus du bois', () => {
    expect((rendu.match(/abs-cal-declarer/g) || [])).toHaveLength(1)
    expect(rendu).toContain('Déclarer une absence')
    // la maquette la dessine isolée en haut à droite : pas de deuxième bouton
    // rouille dans la rangée des pinces
    const rangée = nud(declarations('.abs-tringle-rangee', TRINGLE))
    expect(rangée).toContain('align-items:flex-start')
    expect(rangée).toContain('flex-wrap:wrap')
  })

  it('18. la suspension ne se paie pas un conteneur de plus autour de la grille', () => {
    // `.abs-tringle` est le premier enfant de `.abs-cal`, avant la grille, et
    // il ne borde pas : c'est une tringle, pas un cadre de plus (leçon des
    // tentatives refusées — rien n'encadre la page)
    expect(rendu).toMatch(/<div class="abs-cal"[^>]*>[\s\S]{0,400}?class="abs-tringle"/)
    const corps = nud(declarations('.abs-tringle', TRINGLE))
    expect(corps).not.toContain('border:')
    expect(corps).not.toContain('border-top:')
    expect(corps).not.toContain('background:')
  })
})
