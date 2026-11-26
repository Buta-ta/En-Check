// ═══════════════════════════════════════════════════════════════════════════
// 🌴 ÉCRAN DE CHARGEMENT ABSENCES — la carte de la page Employés
//
// « Pour le loading de cette page, utilise cette même animation, juste
// retravaille ça comme dans la page employés », 08/12. La carte est donc
// EMPRUNTÉE, comme le Planning (22/11) et Pauses (26/11) l'avaient fait avant
// elle : même en-tête (marque, entreprise, compteur), même scène 16:9, quatre
// étapes numérotées, même « Passer l'animation », mêmes pips de file. Écrire
// une cinquième carte de chargement ressemblante, c'était cinq cartes à entretenir.
//
// Ce qui reste propre à Absences : le RÉCIT du chargement — les quatre étapes
// que `loadData` traverse vraiment, dans son ordre — et la SCÈNE, l'illustration
// déjà validée de la page (`absences-loading-scene.webp`, la chemise et son
// couvercle). La scène est posée d'un bloc, sans calques découpés : les quatre
// calques de la file appartiennent à la scène des Employés, les re-couper ici
// sur une autre illustration serait un dessin inventé.
//
// ⚠️ PLUS AUCUN BANDEAU DE MOTIF dans la carte (22/11, Pauses 26/11 : « un écran
// de chargement est un compte rendu, pas une tribune décorative ») — l'ancienne
// version en portait deux, en haut et en bas.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import EmployesLoadingScreen from './EmployesLoadingScreen'
import { DUREE_MIN_CHARGEMENT_MS } from '../hooks/useLoadingMinimum'

/** Les quatre étapes, dans l'ordre réel de la page : les visages avant les
    feuilles (les absences sont rattachées à un employé), les feuilles avant les
    demandes (une demande devient une absence), les demandes avant les soldes
    (c'est ce qui est approuvé qui compte). */
export const ETAPES_CHARGEMENT_ABSENCES = [
  {
    id: 1,
    court: 'Collaborateurs',
    detail: 'Lecture des collaborateurs et de leurs entreprises…',
    pct: 24,
  },
  {
    id: 2,
    court: 'Absences de la période',
    detail: 'Relevé des congés, maladies et formations posés sur le calendrier…',
    pct: 50,
  },
  {
    id: 3,
    court: 'Demandes & conflits',
    detail: 'Rangement des demandes en attente et des chevauchements de planning…',
    pct: 76,
  },
  {
    id: 4,
    court: 'Solde de congés',
    detail: 'Recalcul des acquis, des pris et des reports de l’année…',
    pct: 95,
  },
]

export default function AbsencesLoadingScreen({
  darkMode = false,
  onSkip,
  dataReady = false,
  nomEntreprise = '',
  accessChecked = true,
}) {
  /* L'écran n'a plus de variante « vérification des accès » à lui : la carte de
     la maison lit l'ENTREPRISE et l'affiche dans sa marque. On ne remplace donc
     pas le titre par un texte d'état, on LE PRÉCÈDE — et l'accès en attente se dit
     dans le statut de la page, pas dans un second écran. */
  const titreAffiché = accessChecked
    ? nomEntreprise
      ? `Préparation des absences et congés de ${nomEntreprise}…`
      : 'Préparation de vos absences et congés…'
    : 'Vérification de votre accès aux absences et congés…'
  const [etape, setEtape] = useState(1)

  // Le rythme est décoratif : le plancher de `useLoadingMinimum` tient l'écran
  // ouvert, et la page s'affiche dès que LES DONNÉES sont là. Le compteur, lui,
  // est branché sur `dataReady` — il ne promet jamais un pourcentage mesuré.
  useEffect(() => {
    const total = ETAPES_CHARGEMENT_ABSENCES.length
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
      /* PAS d'`onIntroDone` branché ici : dans la carte, c'est la fin de
         l'INTRODUCTION (2 600 ms) qui le déclenche, et la page Employés ne le
         branche que pour libérer SON plancher. Le nôtre vaut 4 500 ms et se libère
         par `skipLoading()` — le câbler sur `onSkip` de la page éteindrait l'écran
         avant la fin du plancher ET avant la donnée. Pauses et Planning ne le
         passent pas non plus : même câblage que les deux aînées. */
      dataReady={dataReady}
      etape={etape}
      nomEntreprise={nomEntreprise}
      etapes={ETAPES_CHARGEMENT_ABSENCES}
      marque={accessChecked ? undefined : 'EN-CHECK · ABSENCES & CONGÉS'}
      titre={titreAffiché}
      titrePret="L’espace Absences est prêt"
      statutPret="Calendrier, demandes et soldes sont à jour."
      legende="Chargement des absences et des congés"
      imageScene="/images/absences-loading-scene.webp"
      calques={[]}
    />
  )
}
