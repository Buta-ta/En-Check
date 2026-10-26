// ═══════════════════════════════════════════════════════════
// 📅 L'ANNÉE EN LISIÈRE
//
// Une bande de laine coupée en douze : les mois, et sur chacun la
// place exacte des jours fériés. Les losanges indigo sont les fêtes
// du pays, les terres celles de l'entreprise ; un losange creux est
// une fête que cette entreprise a désactivée.
//
// Ce n'est pas un ornement : c'est la seule vue qui montre d'un coup
// d'œil les mois chargés et les mois vides, et le prochain jour
// férié. Chaque repère porte son nom pour les lecteurs d'écran.
// ═══════════════════════════════════════════════════════════

import { LesothoLisiereSvg } from './LesothoMotif'

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** La date d'un jour férié, ramenée à l'année affichée. */
function dateDansLAnnee(holiday, annee) {
  const brut = String(holiday?.date || '')
  const [a, m, j] = brut.split('-').map(Number)
  if (!m || !j) return null

  if (holiday.is_recurring) return new Date(annee, m - 1, j, 12)
  if (a !== annee) return null
  return new Date(a, m - 1, j, 12)
}

export default function JoursFeriesAnnee({
  annee,
  globalHolidays = [],
  ownHolidays = [],
  isGlobalEnabled = () => true,
  prochain = null,
  noteSuivante = '',
}) {
  const reperes = []

  for (const h of globalHolidays) {
    const d = dateDansLAnnee(h, annee)
    if (!d) continue
    reperes.push({
      cle: `g-${h.id}`,
      jour: d.getDate(),
      mois: d.getMonth(),
      nom: h.name,
      origine: 'pays',
      actif: isGlobalEnabled(h.id),
      travaille: !!h.is_worked,
    })
  }

  for (const h of ownHolidays) {
    const d = dateDansLAnnee(h, annee)
    if (!d) continue
    reperes.push({
      cle: `p-${h.id}`,
      jour: d.getDate(),
      mois: d.getMonth(),
      nom: h.name,
      origine: 'entreprise',
      actif: true,
      travaille: !!h.is_worked,
    })
  }

  const parMois = MOIS.map((_, m) => reperes.filter(r => r.mois === m))
  const total = reperes.length

  return (
    <figure className="jf-annee" aria-label={`Les ${total} jours fériés de l’année ${annee}, mois par mois`}>
      <div className="jf-annee-tete">
        <div>
          <span className="jf-annee-titre">L’année en lisière</span>
          <span className="jf-annee-note">
            {total === 0
              ? 'Aucun jour férié sur cette année'
              : `${total} repère${total > 1 ? 's' : ''} — un losange par jour férié`}
            {noteSuivante && <em className="jf-annee-suite"> {noteSuivante}</em>}
          </span>
        </div>
        <div className="jf-annee-legende" aria-hidden="true">
          <span className="jf-legende jf-legende-pays">Fête du pays</span>
          <span className="jf-legende jf-legende-entreprise">Fête de l’entreprise</span>
          <span className="jf-legende jf-legende-off">Désactivée</span>
        </div>
      </div>

      <LesothoLisiereSvg className="jf-annee-lisiere" hauteur={14} />

      <div className="jf-annee-bande" role="list">
        {parMois.map((liste, m) => (
          <div className="jf-annee-mois" key={MOIS[m]} role="listitem">
            <span className="jf-annee-mois-nom">{MOIS[m]}</span>
            <div className="jf-annee-piste">
              {liste.map(r => {
                const estProchain = prochain && prochain.mois === r.mois && prochain.jour === r.jour
                return (
                  <span
                    key={r.cle}
                    className="jf-repere"
                    data-origine={r.origine}
                    data-actif={r.actif ? 'oui' : 'non'}
                    data-travaille={r.travaille ? 'oui' : 'non'}
                    data-prochain={estProchain ? 'oui' : 'non'}
                    style={{ left: `${Math.min(94, (r.jour / 31) * 100)}%` }}
                    role="img"
                    aria-label={`${r.jour} ${MOIS_LONGS[m]} — ${r.nom}, ${r.origine === 'pays' ? 'fête du pays' : 'fête de l’entreprise'}${r.actif ? '' : ', désactivée'}${r.travaille ? ', travaillée' : ''}`}
                    title={`${r.jour} ${MOIS_LONGS[m]} — ${r.nom}`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </figure>
  )
}
