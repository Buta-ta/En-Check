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

/**
 * Les semaines dont le dépassement est PROUVÉ.
 *
 * Une semaine n'est retenue que si elle a été réellement jugée : règle
 * résolue (`regle_resolue !== false`) et dépassement constaté. Une semaine
 * sans règle n'a pas de verdict, donc pas de dépassement à afficher.
 */
function semainesProuvees(plafond) {
  return (plafond.semaines || []).filter(
    (s) => s && s.depasse === true && s.regle_resolue !== false,
  )
}

/**
 * Les semaines qui n'ont PAS pu être jugées.
 *
 * Elles ne sont ni conformes ni en dépassement : elles n'ont pas eu de
 * verdict. On les nomme, sans les mêler aux semaines prouvées.
 */
function semainesSansVerdict(plafond) {
  return (plafond.semaines || []).filter((s) => s && s.regle_resolue === false)
}

export default function AlerteHebdoCard({ plafond }) {
  if (!plafond) return null

  const semaines = semainesProuvees(plafond)
  const sansVerdict = semainesSansVerdict(plafond)

  //  ⚠️ `disponible === false` ne signifie PAS « rien à dire » : il signifie
  //  que TOUTES les semaines n'ont pas pu être jugées. Une semaine vérifiée
  //  peut malgré tout porter un dépassement prouvé — le masquer parce qu'une
  //  AUTRE semaine est indisponible, c'est perdre une alerte réelle.
  //  On l'affiche donc, en signalant séparément ce qui reste inconnu.

  //  Rien de prouvé et rien à signaler : on ne dit rien.
  if (semaines.length === 0 && sansVerdict.length === 0) return null

  const message = semaines.length > 0 ? messageDepassement(plafond) : null

  return (
    <section className="e360-carte e360-alerte-hebdo" aria-label="Dépassement hebdomadaire">
      <h3 className="e360-carte-titre">
        {/*  ⚠️ Le titre ne doit pas annoncer un dépassement quand aucun n'est
            affiché. Une carte qui ne porte que des semaines sans verdict
            parle de contrôle, pas de dépassement. */}
        {semaines.length > 0 ? 'Dépassement hebdomadaire' : 'Contrôle hebdomadaire'}
        {semaines.length > 0 && (
          <span className="e360-alerte-hebdo-compte">
            {semaines.length} semaine{semaines.length > 1 ? 's' : ''}
          </span>
        )}
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

      {/*  Une semaine sans verdict est dite À PART : ni conforme, ni en
          dépassement. La mêler aux semaines prouvées ferait croire qu'elle a
          été jugée ; la taire ferait croire qu'il n'y avait rien à voir. */}
      {sansVerdict.length > 0 && (
        <ul className="e360-alerte-hebdo-liste e360-alerte-hebdo-sans-verdict">
          {sansVerdict.map((semaine) => (
            <li key={`sv-${semaine.debut}-${semaine.fin}`}>
              <span>
                Semaine du {jourCourt(semaine.debut)} au {jourCourt(semaine.fin)}
              </span>
              <strong>
                {semaine.heures} h — aucun seuil applicable n’a pu être résolu :
                aucun verdict n’est prononcé pour cette semaine.
              </strong>
            </li>
          ))}
        </ul>
      )}

      {/*  ⚠️ Une semaine passée peut avoir été régie par une AUTRE origine que
          la semaine en cours (seuil personnel d'alors, règle d'entreprise
          depuis). Nommer une seule origine pour toutes les lignes reviendrait
          à prêter à une semaine une règle qui n'était pas la sienne. */}
      {semaines.length > 0 && (
        <p className="e360-alerte-hebdo-note">
          {originesDesSemaines(semaines, plafond.source)}. Ce n’est pas un plafond légal.
        </p>
      )}
    </section>
  )
}
