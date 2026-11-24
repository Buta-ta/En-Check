import '../pages/AbsencesAfroTech.css'

// Absences, 24/11/2026 : le motif de la page est le BOGOLAN — « utilise le
// bogolan comme motif, remplace l'autre ». Le nom des classes a suivi l'image,
// il ne reste plus de « ndebele » que dans les commentaires et dans le badge
// employé, qui garde son artiste.
//
// Sur la page, ce composant n'est plus utilisé : la section est ENCADRÉE par
// `PageCulturalBand placement="cadre"`. Il reste pour les deux tiroirs
// (déclaration, formulaire), qui sont des feuilles qui glissent : là, un bandeau
// en haut et un en bas, pas un cadre.
export default function AbsencesCulturalBand({ position = 'top', drawer = false }) {
  return <div className={`abs-bogolan-band abs-bogolan-${position}${drawer ? ' abs-bogolan-drawer' : ''}`} aria-hidden="true"/>
}
