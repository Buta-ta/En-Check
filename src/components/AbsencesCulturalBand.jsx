import '../pages/AbsencesAfroTech.css'

// Absences, 24/11/2026 : le motif de la page est le BOGOLAN — « utilise le
// bogolan comme motif, remplace l'autre ». Le nom des classes a suivi l'image,
// il ne reste plus de « ndebele » que dans les commentaires et dans le badge
// employé, qui garde son artiste.
//
// Le 24/11, la page s'était laissé convaincre par un CADRE posé autour du `<main>`
// entier — refusé le 26/11 : un liseré autour d'une page intacte n'est pas une
// reprise. Le cadre est défait et la bande reprend du service SUR la page, en
// `position="tete"` : 34 px en travers, bord bas de la section du haut. Les deux
// tiroirs (déclaration, formulaire) gardent les leurs : une feuille qui glisse se
// borde en haut et en bas, pas en lisière unique.
export default function AbsencesCulturalBand({ position = 'top', drawer = false }) {
  return <div className={`abs-bogolan-band abs-bogolan-${position}${drawer ? ' abs-bogolan-drawer' : ''}`} aria-hidden="true"/>
}
