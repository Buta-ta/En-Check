// ═══════════════════════════════════════════════════════════════════════════
// ⏸ ÉCRAN DE CHARGEMENT PAUSES — la carte de la page Employés
// « Remplacer le loading actuel de cette page par le loading de la page
// employés », 26/11. Comme le Planning, on EMPRUNTE la carte au lieu de la
// copier : même en-tête (marque, entreprise, compteur), même scène 16:9,
// mêmes étapes numérotées, même « Passer l'animation ».
//
// Ce qui reste propre à Pauses, c'est le récit du chargement : les quatre
// étapes que la page traverse vraiment, et la scène du dépointage sur la
// borne. La page porte déjà sa toile culturelle dans son bandeau : l'écran
// de chargement, lui, reste un compte rendu.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import EmployesLoadingScreen from './EmployesLoadingScreen'
import { DUREE_MIN_CHARGEMENT_MS } from '../hooks/useLoadingMinimum'

//  Les quatre étapes suivent l'ordre réel de `loadData` sur la page Pauses :
//  les collaborateurs d'abord (ce sont eux qu'on nomme dans la table), puis
//  les pauses réellement pointées, puis les présumées qu'il faudra statuer,
//  enfin les décisions déjà prises.
export const ETAPES_CHARGEMENT_PAUSES = [
  {
    id: 1,
    court: 'Collaborateurs',
    detail: 'Lecture des collaborateurs et de leurs services…',
    pct: 25,
  },
  {
    id: 2,
    court: 'Pauses pointées',
    detail: 'Relevé des pauses réellement dépointées sur la borne…',
    pct: 52,
  },
  {
    id: 3,
    court: 'Présumées',
    detail: 'Séparation des pauses présumées et calcul des durées…',
    pct: 78,
  },
  {
    id: 4,
    court: 'Décisions',
    detail: 'Reprise du journal des décisions et de la corbeille…',
    pct: 95,
  },
]

export default function PausesLoadingScreen({
  darkMode = false,
  onSkip,
  nomEntreprise = '',
  dataReady = false,
}) {
  const [etape, setEtape] = useState(1)

  //  Le rythme est décoratif : le plancher de `useLoadingMinimum` tient
  //  l'écran ouvert, et la page s'affiche dès que les données sont là. Le
  //  compteur, lui, ne promet jamais un pourcentage mesuré.
  useEffect(() => {
    const total = ETAPES_CHARGEMENT_PAUSES.length
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
      etapes={ETAPES_CHARGEMENT_PAUSES}
      marque="EN-CHECK · PAUSES DE LA PÉRIODE"
      titre="Chargement de l’espace Pauses…"
      titrePret="L’espace Pauses est prêt"
      statutPret="Pauses pointées, présumées et décisions sont à jour."
      legende="Chargement des pauses"
      dossierImages="/images/pauses-loading-"
      imageScene="/images/pauses-loading-depointage.jpg"
      calques={[]}
    />
  )
}
