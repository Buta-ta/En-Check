import { useEffect, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// ⏳ DURÉE MINIMALE DE L'ÉCRAN DE CHARGEMENT
// ═══════════════════════════════════════════════════════════════════════════
//  Une page rapide (Planning, Pauses) affichait son écran de chargement une
//  fraction de seconde : les deux scènes n'avaient pas le temps d'être vues.
//  Ce crochet impose un plancher — l'écran reste tant que les données NE SONT
//  PAS là OU que le délai minimal n'est pas écoulé.
//
//  « Passer l'animation » appelle `skipLoading()` : le plancher saute, la page
//  s'affiche dès que les données sont prêtes (jamais avant).
//
//  Le délai ne s'applique qu'au premier chargement : il est armé au montage du
//  composant, pas à chaque rechargement de données.
// ═══════════════════════════════════════════════════════════════════════════

export const DUREE_MIN_CHARGEMENT_MS = 4500

export default function useLoadingMinimum (dureeMs = DUREE_MIN_CHARGEMENT_MS) {
  const [minLoadingDone, setMinLoadingDone] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setMinLoadingDone(true), dureeMs)
    return () => window.clearTimeout(timer)
  }, [dureeMs])

  const skipLoading = () => setMinLoadingDone(true)

  return { minLoadingDone, skipLoading }
}
