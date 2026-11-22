import PageCulturalBand from './PageCulturalBand'
// ═══════════════════════════════════════════════════════════════════════════
// 📅 ÉCRAN DE CHARGEMENT PLANNING — la carte de la page Employés
// « Je veux le même style de loading comme la page employé », 22/11. La carte
// est donc empruntée, pas copié-collé : même en-tête (marque, entreprise,
// compteur), même scène 16:9, quatre étapes, « Passer l'animation ».
//
// Une seule image, ici : la scène du Planning est un mur d'équipe qu'on
// regarde d'un bloc, pas une file de personnages découpée en calques. Le
// bandeau de motif kuba reste dans la carte — un seul motif par écran, la page
// elle-même ne porte plus sa bande de pied depuis le même jour.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import EmployesLoadingScreen from './EmployesLoadingScreen'
import { DUREE_MIN_CHARGEMENT_MS } from '../hooks/useLoadingMinimum'

// Les quatre étapes sont celles que la page traverse vraiment, dans l'ordre de
// `loadData` : les modèles, les collaborateurs et leurs équipes, les horaires
// individuels et les disponibilités, puis la grille de la semaine.
export const ETAPES_CHARGEMENT_PLANNING = [
  {
    id: 1,
    court: 'Modèles',
    detail: 'Lecture des modèles d’horaire de l’entreprise…',
    pct: 22,
  },
  {
    id: 2,
    court: 'Collaborateurs',
    detail: 'Lecture des équipes et des collaborateurs de la semaine…',
    pct: 48,
  },
  {
    id: 3,
    court: 'Horaires & dispos',
    detail: 'Synchronisation des horaires individuels et des disponibilités…',
    pct: 74,
  },
  {
    id: 4,
    court: 'Grille de la semaine',
    detail: 'Composition de la grille et contrôle des pointages réels…',
    pct: 95,
  },
]

export default function PlanningLoadingScreen({
  darkMode = false,
  onSkip,
  nomEntreprise = '',
  dataReady = false,
}) {
  const [etape, setEtape] = useState(1)

  // Le rythme est décoratif : le plancher de `useLoadingMinimum` tient l'écran
  // ouvert le temps du chargement minimal, et la page s'affiche dès que LES
  // DONNÉES sont là. L'étape avance donc à pas réglé, sans jamais promettre un
  // pourcentage mesuré — le compteur, lui, est branché sur la donnée réelle.
  useEffect(() => {
    const total = ETAPES_CHARGEMENT_PLANNING.length
    const pas = Math.max(DUREE_MIN_CHARGEMENT_MS, 1200) / total
    const minuterie = window.setInterval(() => {
      setEtape((prev) => (prev >= total ? prev : prev + 1))
    }, pas)
    return () => window.clearInterval(minuterie)
  }, [])

  return (
    <EmployesLoadingScreen
      darkMode={darkMode}
      onSkip={onSkip}
      dataReady={dataReady}
      etape={etape}
      nomEntreprise={nomEntreprise}
      etapes={ETAPES_CHARGEMENT_PLANNING}
      marque="EN-CHECK · PLANNING DE LA SEMAINE"
      titre="Chargement du planning de la semaine…"
      titrePret="Le planning de la semaine est prêt"
      statutPret="Modèles, horaires, disponibilités et pointages sont à jour."
      legende="Chargement du planning"
      dossierImages="/images/planning-loading-"
      imageScene="/images/planning-loading-scene.webp"
      calques={[]}
      ruban={<PageCulturalBand pathname="/planning" placement="loading" />}
    />
  )
}
