// ═══════════════════════════════════════════════════════════
// 🪧 LES SIX PAN CARTES DE L'ÉTAGÈRE (les ex-« cartes de synthèse »)
//
// Rendu serveur, aucune base : on vérifie les chiffres, les jauges
// et surtout la présence des photos de profil.
//
// Le 30/11/2026 (maquette P1 retenue) : la peinture est descendue du `<style>`
// embarqué dans le composant vers `AbsencesAfroTech.css`. Les verrous 13 à 18
// lisaient donc des bouts de chaîne dans le rendu ; ils lisent maintenant la
// feuille. Ce n'est pas un relâchement — `npm run charte` ne voyait pas le
// `<style>` du JSX, il voit chaque ligne de la feuille.
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import AbsencesKpiCards from '../../components/AbsencesKpiCards'
import { isoLocal, estJourOuvre } from '../absencesCalendrier'

// Le corps d'une règle de la feuille de style, sélecteur retiré, commentaires retirés.
const FEUILLE = readFileSync('src/pages/AbsencesAfroTech.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const règle = (sélecteur) => {
  const i = FEUILLE.indexOf(`${sélecteur} {`)
  if (i === -1) throw new Error(`règle absente de la feuille : ${sélecteur}`)
  return FEUILLE.slice(FEUILLE.indexOf('{', i) + 1, FEUILLE.indexOf('}', i))
}
const nud = (t) => t.replace(/\s+/g, '')

const AUJOURDHUI = isoLocal(new Date())
const dansNJours = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return isoLocal(d)
}
const moisDe = (iso) => iso.slice(0, 7)

const employes = [
  { id: 'e1', first_name: 'Aïssatou', last_name: 'Diallo', photo_url: 'https://cdn.test/aissatou.jpg' },
  { id: 'e2', first_name: 'Mamadou', last_name: 'Konaté', photo_url: null },
  { id: 'e3', first_name: 'Salimata', last_name: 'Keita', photo_url: 'https://cdn.test/salimata.jpg' },
]

const absence = (id, employeeId, debut, fin, statut = 'approuve') => ({
  id,
  employee_id: employeeId,
  start_date: debut,
  end_date: fin,
  status: statut,
  count_holidays_as_leave: false,
  employees: employes.find((e) => e.id === employeeId),
})

const absences = [
  absence('a1', 'e1', AUJOURDHUI, dansNJours(2)),        // Aïssatou absente aujourd'hui
  absence('a2', 'e2', dansNJours(-3), dansNJours(1)),    // Mamadou absent aujourd'hui
  absence('a3', 'e3', dansNJours(10), dansNJours(12), 'refuse'), // refusée : ne compte pas
]

const rendre = (props = {}) => renderToStaticMarkup(
  <AbsencesKpiCards
    absences={absences}
    employes={employes}
    conflitsEnAttente={2}
    joursPrisParEmploye={{ e1: 5, e2: 10, e3: 30 }}
    plafondConges={30}
    {...props}
  />
)

const grille = rendre()

it('1. six cartes de synthèse, toutes identifiables', () => {
  expect(grille).toContain('data-testid="abs-kpi-grille"')
  for (const id of ['absents', 'mois', 'taux', 'conges', 'attente', 'conflits']) {
    expect(grille).toContain(`data-testid="abs-kpi-${id}"`)
  }
})

it('2. « absents aujourd\'hui » compte les personnes, pas les absences', () => {
  // a1 + a2 couvrent aujourd'hui ; a3 est refusée → 2 absents sur 3
  expect(grille).toContain('Absents aujourd&#x27;hui')
  expect(grille).toContain('sur 3 employés · 67 %')
})

it('3. les photos de profil des absents apparaissent dans la carte', () => {
  const images = [...grille.matchAll(/<img src="(https:\/\/cdn\.test\/[^"]+)"/g)].map((m) => m[1])
  expect(images).toContain('https://cdn.test/aissatou.jpg')
  // Mamadou n'a pas de photo : repli sur ses initiales
  expect(grille).toContain('data-testid="abs-kpi-avatar"')
  expect(grille).toContain('>MK<')
})

it('4. sans photo, l\'avatar affiche les initiales', () => {
  const sansPhoto = rendre({ employes: employes.map((e) => ({ ...e, photo_url: null })) })
  expect(sansPhoto).not.toContain('cdn.test')
  expect(sansPhoto).toContain('>AD<')
  expect(sansPhoto).toContain('>MK<')
})

it('5. une absence refusée ne rend personne absent', () => {
  const seulementRefusees = rendre({
    absences: [absence('x', 'e1', AUJOURDHUI, AUJOURDHUI, 'refuse')],
  })
  expect(seulementRefusees).toContain('sur 3 employés · 0 %')
})

it('6. le mois en cours : bon nombre d\'absences et de jours décomptés', () => {
  // a1 et a2 commencent ce mois-ci (si leur début est dans le mois courant)
  const debutCeMois = absences.filter((a) => moisDe(a.start_date) === moisDe(AUJOURDHUI)).length
  const attendu = debutCeMois === 0 ? 0 : debutCeMois
  expect(grille).toContain('Absences ce mois-ci')
  expect(grille).toContain(`${attendu}`)
  // les jours décomptés excluent les week-ends
  const joursAttendus = estJourOuvre(AUJOURDHUI) ? 3 : 1 // a1 : aujourd'hui + 2 jours ; a2 : aujourd'hui + demain
  expect(grille).toMatch(/jour(s)? déc(ompté|omptés)?/)
  expect(grille).toContain(`décompté${joursAttendus > 1 ? 's' : ''}`)
})

it('7. deux cartes portent une jauge chiffrée', () => {
  const jauges = [...grille.matchAll(/data-testid="abs-kpi-jauge"[^>]*aria-valuenow="(\d+)"/g)]
  expect(jauges).toHaveLength(2) // taux d'absence + congés restants
  jauges.forEach(([, valeur]) => {
    const n = Number(valeur)
    expect(n).toBeGreaterThanOrEqual(0)
    expect(n).toBeLessThanOrEqual(100)
  })
})

it('8. les congés restants se calculent sur le plafond', () => {
  // e1: 25 restants, e2: 20, e3: 0 → moyenne 15
  expect(grille).toContain('Congés restants (moyenne)')
  expect(grille).toContain('plafond 30 jours')
  expect(grille).toContain('50 %')
  // jauge à 50 %
  expect(grille).toContain('aria-valuenow="50"')
})

it('9. les cartes « à traiter » sont des boutons cliquables', () => {
  const guidage = rendre({ onVoirConflits: () => {}, onVoirDemandes: () => {} })
  // deux cartes actionnables : les demandes en attente et les conflits. Le corps de
  // la planche EST le bouton — il n'y a plus de classe « cliquable » à coller à côté.
  expect((guidage.match(/<button type="button" class="abs-planche-corps"/g) || [])).toHaveLength(2)
  expect(guidage).toContain('data-testid="abs-kpi-conflits"')
  expect(guidage).toContain('Arbitrer')
  // ce sont bien des boutons, donc accessibles au clavier
  expect((guidage.match(/<button type="button"/g) || [])).toHaveLength(2)
})

it('10. sans conflit ni attente, les cartes redeviennent inertes', () => {
  const propre = rendre({ conflitsEnAttente: 0, absences: [] })
  expect(propre).not.toContain('<button')
  expect(propre).toContain('aucun conflit à arbitrer')
  expect(propre).toContain('aucune demande en souffrance')
})

it('11. un effectif vide ne casse aucun calcul', () => {
  const vide = rendre({ employes: [], absences: [] })
  expect(vide).toContain('sur 0 employé')
  expect(vide).toContain('aria-valuenow="0"')
})

it('12. les dates de fin manquantes sont traitées comme un seul jour', () => {
  const ponctuelle = rendre({
    absences: [{ id: 'z', employee_id: 'e1', start_date: AUJOURDHUI, end_date: null, status: 'approuve' }],
  })
  expect(ponctuelle).toContain('sur 3 employés · 33 %')
})

// ═══════════════════════════════════════════════════════════
// 📏 FORMAT COMPACTE — la bande ne doit plus manger la page
// ═══════════════════════════════════════════════════════════

it('13. six planches pendues à un rail, de poids égal, et plus de filet entre voisines', () => {
  // Absences, 30/11/2026 (maquette `absences-kpi-P1-etagere.png`, P1 retenu par le
  // fondateur). La rangée d'avant était un ruban coupé en six par des bordures
  // gauche, avec deux lanières plus larges parce qu'elles portaient une poche de
  // renvoi. Maintenant six planches ÉGALES : le rabat se pose SUR la planche, il ne
  // mange plus la largeur de sa voisine.
  expect(nud(règle('.abs-etagere-planches'))).toContain('grid-template-columns:repeat(6,minmax(0,1fr))')
  // la séparation, c'est le bois de chaque planche — son propre contour — et plus une
  // bordure basse ajoutée sur la voisine de droite
  expect(FEUILLE).not.toMatch(/\.abs-kpi/)
  expect(nud(règle('.abs-planche-corps'))).toContain('border:var(--charte-trait)solidvar(--charte-encre)')
  // le paragraphe « chiffres calculés… » ne prend toujours pas une ligne entière
  expect(grille).not.toContain('1 / -1')
  expect(grille).toContain('title="Chiffres calculés sur les absences chargées')
  // et chaque planche est pendue : deux cordes à sa tringle, et un rang de deux
  // longues cordes au-dessus de la rangée
  expect((grille.match(/abs-planche-corde/g) || [])).toHaveLength(6)
  expect((grille.match(/abs-etagere-suspentes/g) || [])).toHaveLength(1)
})

it('14. le détail reste disponible, mais en infobulle', () => {
  expect(grille).toContain('title="sur 3 employés · 67 %')
  expect(grille).toContain('title="plafond 30 jours')
  // quand il n'y a rien à traiter, le détail le dit toujours
  const propre = rendre({ conflitsEnAttente: 0, absences: [] })
  expect(propre).toContain('title="aucun conflit à arbitrer"')
  expect(propre).toContain('title="aucune demande en souffrance"')
})

it('15. un chiffre de tableau, un libellé qui garde son mot entier', () => {
  // La tuile compacte d'avant écrivait `font-size:20px` et `text-overflow:ellipsis`
  // dans un `<style>` en ligne : le libellé sautait s'il était long. Six planches
  // sur 1560 px font ~185 px de large — le libellé passe sur deux lignes au lieu
  // de sauter, et le chiffre prend 26 px. C'est la seule raison pour laquelle la
  // rangée en compte six et non quatre.
  expect(nud(règle('.abs-planche-chiffre'))).toContain('font-size:26px')
  expect(nud(règle('.abs-planche-label'))).not.toContain('text-overflow')
  expect(nud(règle('.abs-planche-label'))).not.toContain('white-space')
  // et l'icône de 42 px de côté n'est pas revenue : une planche n'a pas d'icône,
  // elle a un chiffre. Six pictogrammes sur 185 px, c'est six timbres-poste.
  expect(grille).not.toMatch(/width:42px/)
  // la seule figure dessinée de la bande, c'est la flèche d'un rabat : une par
  // étiquette, jamais une par planche.
  expect((grille.match(/<svg/g) || []).length).toBe((grille.match(/abs-planche-etiquette/g) || []).length)
})

// 🪡 LANIÈRES, POCHES ET COUTURE — maquette bogolan, 24/11/2026
// ═══════════════════════════════════════════════════════════

it('16. les deux pancartes qui mènent quelque part finissent sur un rabat fléché', () => {
  // une demande en attente dans le jeu, pour que les DEUX rabats existent
  const deux = absence('a9', 'e2', AUJOURDHUI, AUJOURDHUI, 'en_attente')
  const guidage = rendre({
    absences: [...absences, deux],
    onVoirConflits: () => {},
    onVoirDemandes: () => {},
  })
  // le rabat est coupé du même biseau de 5 px que la rangée d'avant, mais il ne se
  // peint plus à chaque rendu : une règle dans la feuille, six planches.
  expect(nud(règle('.abs-planche-etiquette'))).toContain('clip-path:polygon(5px0,100%0,100%100%,0100%,05px)')
  expect((guidage.match(/abs-planche-etiquette/g) || [])).toHaveLength(2)
  // un seul rabat quand il n'y a rien à traiter : la planche dit l'action possible
  expect((rendre({ onVoirConflits: () => {}, onVoirDemandes: () => {} }).match(/abs-planche-etiquette/g) || [])).toHaveLength(1)
  expect(guidage).toContain('Traiter')
  expect(guidage).toContain('Arbitrer')
  // le rabat se remplit avec l'aplatissement de la charte, jamais un hex en dur —
  // et jamais en ligne : une attribution en ligne bat n'importe quel sélecteur.
  expect(nud(règle('.abs-planche-etiquette'))).toContain('background:var(--charte-aplat)')
  expect(grille).not.toMatch(/background:/)
})

// ═══════════════════════════════════════════════════════════
// 🪡 COUTURE — le fil oblique de la pancarte des conflits
// ═══════════════════════════════════════════════════════════

it('17. la planche des conflits porte une couture, et elle seule', () => {
  const guidage = rendre({ onVoirConflits: () => {}, onVoirDemandes: () => {} })
  expect((guidage.match(/data-testid="abs-kpi-couture"/g) || [])).toHaveLength(1)
  // un fil oblique de la teinte du statut absent — plus de bandeau plein
  expect(nud(règle('.abs-planche-couture'))).toContain(
    'background-image:repeating-linear-gradient(135deg,var(--abs-coral)02px,transparent2px5px)',
  )
  expect(nud(règle('.abs-planche-couture'))).not.toContain('background:var(--abs-coral)')
  // à la base déjà (deux conflits en attente), une seule couture…
  expect((grille.match(/data-testid="abs-kpi-couture"/g) || [])).toHaveLength(1)
  // …et elle disparaît quand il n'y a plus rien à arbitrer
  expect(rendre({ conflitsEnAttente: 0 })).not.toContain('data-testid="abs-kpi-couture"')
})

it('18. aucune teinte en dur dans la bande : tout passe par les jetons', () => {
  // Le composant était peint en `rgba()` et en `#rrggbb` recopiés, avec un
  // `${couleur}1F` concaténé qui ne peignait rien sur les cartes à jeton — et son
  // `<style>` en ligne échappait à `npm run charte`. La peinture est descendue dans
  // la feuille : elle y est comptée, et elle ne se repeint plus à chaque composant.
  const source = readFileSync('src/components/AbsencesKpiCards.jsx', 'utf8')
    .replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  expect(source).not.toMatch(/#[0-9A-Fa-f]{6}/)
  expect(source).not.toMatch(/rgba?\(/)
  expect(source).not.toMatch(/\$\{couleur\}[0-9A-F]{2}/)
  // plus de `color-mix` en ligne non plus : la seule couleur que le JSX ose poser
  // était une teinte de survol, elle est dans la feuille. Ce qu'il pose encore est
  // une largeur de jauge en pourcentage — une donnée, pas un goût.
  expect(source).not.toMatch(/color-mix\(/)
  expect(nud(source)).toContain('style={{width:`${Math.max(0,Math.min(100,jauge))}%`}}'.replace(/\s/g,'').slice(5))
  // la plage de l'étagère, dans la feuille : zéro hexadécimal, zéro `rgba()`, zéro flou
  const plage = FEUILLE.slice(FEUILLE.indexOf('.abs-etagere {'), FEUILLE.indexOf('@media (max-width: 1180px)'))
  expect(plage.length).toBeGreaterThan(1000)
  expect(plage).not.toMatch(/#[0-9A-Fa-f]{3,6}/)
  expect(plage).not.toMatch(/rgba?\(/)
  expect(plage).not.toMatch(/blur\(/)
  // le chiffre reste en graisse de tableau, l'alignement est tabulaire
  expect(nud(règle('.abs-planche-chiffre'))).toContain('font-variant-numeric:tabular-nums')
  expect(nud(règle('.abs-planche-chiffre'))).toContain('font-weight:700')
})
