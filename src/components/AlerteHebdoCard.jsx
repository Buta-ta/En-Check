// src/components/AlerteHebdoCard.jsx
// ═══════════════════════════════════════════════════════════════════════════
// ⏰ L'ALERTE HEBDOMADAIRE, ENFIN VISIBLE — et muette quand elle doit l'être
//
// CE QUE CE COMPOSANT REND
//   Un dépassement de seuil hebdomadaire, chiffré en heures, quand — et
//   seulement quand — l'entreprise a activé la case « m'alerter ».
//
// CE QU'IL NE REND JAMAIS
//   · un seuil non choisi (le défaut 48 h ne s'affiche pas comme une règle) ;
//   · une case non cochée (le serveur envoie `disponible: false`) ;
//   · le mot « légal » : le seuil est un paramètre d'entreprise, pas un texte.
//   Silence = rien à l'écran. Ce n'est pas un oubli : une conformité non
//   évaluée ne doit pas ressembler à une conformité constatée.
// ═══════════════════════════════════════════════════════════════════════════

import { libelleOrigineSeuil, messageDepassement } from '../services/plafondHebdomadaire'
import { jourCourt } from '../utils/jourCourt'

export default function AlerteHebdoCard({ plafond }) {
  //  Rien à dire, ou rien de prouvé : on ne dit rien.
  if (!plafond || plafond.disponible !== true) return null
  const semaines = (plafond.semaines || []).filter((s) => s && s.depasse === true)
  if (semaines.length === 0) return null

  const message = messageDepassement(plafond)

  return (
    <section className="e360-carte e360-alerte-hebdo" aria-label="Dépassement hebdomadaire">
      <h3 className="e360-carte-titre">
        Dépassement hebdomadaire
        <span className="e360-alerte-hebdo-compte">
          {semaines.length} semaine{semaines.length > 1 ? 's' : ''}
        </span>
      </h3>

      {message && <p className="e360-alerte-hebdo-message">{message}</p>}

      <ul className="e360-alerte-hebdo-liste">
        {semaines.map((semaine) => (
          <li key={`${semaine.debut}-${semaine.fin}`}>
            <span>
              Semaine du {jourCourt(semaine.debut)} au {jourCourt(semaine.fin)}
            </span>
            <strong>
              {semaine.heures} h pour un seuil de {plafond.seuil} h
              {semaine.depassement_heures > 0
                ? ` — dépassement de ${semaine.depassement_heures} h`
                : ''}
            </strong>
          </li>
        ))}
      </ul>

      <p className="e360-alerte-hebdo-note">
        {libelleOrigineSeuil(plafond.source)}. Ce n’est pas un plafond légal.
      </p>
    </section>
  )
}
