// src/components/ControleIndisponible.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 🧭 « CONTRÔLE INDISPONIBLE » — une ligne, pas une alerte
//
// G7 / V-B3. La carte d'alerte reste muette quand aucun seuil n'a été choisi
// (décision du 24/10/2026 : pas d'alerte sur une règle que personne n'a posée).
// Mais ce silence, à côté d'heures qui s'affichent, se lit comme « tout va
// bien ». Ce composant dit l'inverse, sans crier :
//
//   « Contrôle indisponible — aucun seuil hebdomadaire choisi par l'entreprise :
//     ce contrôle n'est pas fait. »
//
// CE QU'IL N'EST PAS
//   · PAS une alerte : pas de rouge, pas d'icône d'avertissement, aucune
//     urgence inventée. C'est un état de connaissance, pas un incident ;
//   · PAS une conformité déguisée : il ne dit jamais « conforme ».
//
// ⚠️ Il rend `null` quand le contrôle A été fait : la carte d'alerte prend
//    alors le relais, et deux messages se contrediraient.
// ═══════════════════════════════════════════════════════════════════════════

import { CircleDashed } from 'lucide-react'
import {
  ETIQUETTE_INDISPONIBLE,
  pourquoiControleIndisponible,
} from '../lib/controleDisponible'

export default function ControleIndisponible({ plafond, className = '' }) {
  const etat = pourquoiControleIndisponible(plafond)
  if (!etat) return null

  return (
    <p
      className={`e360-controle-indisponible ${className}`.trim()}
      //  `role="status"` : c'est une information d'état, pas une alerte. Un
      //  lecteur d'écran l'annonce sans interrompre, comme il le doit.
      role="status"
    >
      <CircleDashed size={13} aria-hidden="true" />
      <span className="e360-controle-indisponible-mot">
        {etat.etiquette || ETIQUETTE_INDISPONIBLE}
      </span>
      <span className="e360-controle-indisponible-raison">{etat.raison}</span>
    </p>
  )
}
