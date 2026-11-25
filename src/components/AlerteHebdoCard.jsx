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
//
//   ⚠️ DEPUIS G7, LE SILENCE S'EXPLIQUE AILLEURS. Cette carte reste muette quand
//   rien n'est prouvé — c'est la décision du 24/10/2026 et elle ne change pas.
//   Mais un écran qui affiche des heures et se tait sur le contrôle doit dire
//   que celui-ci n'a pas été fait : c'est `controleDisponible.js` et son
//   composant `ControleIndisponible`, posés à côté de cette carte.
// ═══════════════════════════════════════════════════════════════════════════

import { libelleOrigineSeuil, messageDepassement } from '../services/plafondHebdomadaire'
import { jourCourt } from '../utils/jourCourt'

/**
 * Les origines de seuil réellement appliquées aux semaines affichées.
 * Une seule → on la nomme ; plusieurs → on le dit, sans en privilégier une.
 */
function originesDesSemaines(semaines, origineGlobale) {
  const origines = [...new Set(
    semaines.map((s) => s.seuil_source).filter(Boolean),
  )]
  if (origines.length === 0) return libelleOrigineSeuil(origineGlobale)
  if (origines.length === 1) return libelleOrigineSeuil(origines[0])
  return 'Seuils d’origine différente selon les semaines'
}

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
              {semaine.heures} h pour un seuil de {semaine.seuil_applique ?? plafond.seuil} h
              {semaine.depassement_heures > 0
                ? ` — dépassement de ${semaine.depassement_heures} h`
                : ''}
            </strong>
          </li>
        ))}
      </ul>

      {/*  ⚠️ Une semaine passée peut avoir été régie par une AUTRE origine que
          la semaine en cours (seuil personnel d'alors, règle d'entreprise
          depuis). Nommer une seule origine pour toutes les lignes reviendrait
          à prêter à une semaine une règle qui n'était pas la sienne. */}
      <p className="e360-alerte-hebdo-note">
        {originesDesSemaines(semaines, plafond.source)}. Ce n’est pas un plafond légal.
      </p>
    </section>
  )
}
