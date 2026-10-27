// ═══════════════════════════════════════════════════════════
// 📇 L'ANNUAIRE — une entrée de registre par personne
//
// L'annuaire ne range plus les gens dans des cartes : chaque personne
// est une entrée, numérotée, posée sur un filet. Une entrée dit, dans
// cet ordre :
//
//   · qui (le nom en serif, le matricule, le contrat) ;
//   · quoi (poste, département, classification, ancienneté) ;
//   · où elle en est aujourd'hui (présence, heure de la journée) ;
//   · ce qu'on peut faire (fiche, badge, et le menu des autres gestes).
//
// Aucune information n'est inventée : une donnée absente disparaît,
// une présence inconnue s'écrit « Non pointé ».
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import PlanningPayslipBadge from '../PlanningPayslipBadge'
import {
  BadgeCheck, CalendarClock, Clock3, Key, MoreVertical,
  Nfc, Share2, Trash2, UserCheck, UserCog, UserX,
} from 'lucide-react'

const initiales = (personne) =>
  `${personne?.first_name?.[0] || ''}${personne?.last_name?.[0] || ''}`.toUpperCase()

const nomComplet = (personne) =>
  [personne?.first_name, personne?.last_name].filter(Boolean).join(' ') || 'Sans nom'

// L'état de présence, dans les mots de la maison. Le ton de la perle
// suit l'état ; l'heure ne s'affiche que si la pointeuse l'a donnée.
const PRESENCE = {
  en_poste: { libelle: 'En poste', ton: 'teal' },
  en_pause: { libelle: 'En pause', ton: 'cuivre' },
  termine: { libelle: 'Pointage terminé', ton: 'sauge' },
  en_conge: { libelle: 'En congé', ton: 'creme' },
  non_pointe: { libelle: 'Non pointé', ton: 'faible' },
}

function heureDe(valeur) {
  if (!valeur) return ''
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return String(valeur)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function LignePresence({ liveStatus }) {
  const etat = liveStatus?.state || 'non_pointe'
  const fiche = PRESENCE[etat] || PRESENCE.non_pointe
  return (
    <span className="rg-presence" data-etat={etat}>
      <span className="rg-presence-perle" data-ton={fiche.ton} aria-hidden="true" />
      <span className="rg-presence-texte">
        {fiche.libelle}
        {etat === 'en_poste' && liveStatus?.entryHHMM ? ` · ${liveStatus.entryHHMM}` : ''}
        {etat === 'en_pause' && liveStatus?.activePause ? ' · hors poste' : ''}
        {etat === 'termine'
          ? ` · ${heureDe(liveStatus?.entryTime) || liveStatus?.entryHHMM || '—'} → ${heureDe(liveStatus?.exitTime) || liveStatus?.exitHHMM || '—'}`
          : ''}
      </span>
    </span>
  )
}

export default function EntreeEmploye({
  employee,
  numero,
  liveStatus,
  stats,
  scheduleInfo,
  regimeLabel,
  seniority,
  derniereConnexion,
  contractLabel,
  classificationLabel,
  portalEnabled,
  planningEnabled,
  aCompte,
  ancienSysteme,
  payslipEntries = [],
  payslipDate = null,
  onOuvrirFiche,
  onBadge,
  onHoraires,
  onPartagerHoraires,
  onPointages,
  onMotDePasse,
  onBasculerPortail,
  onSupprimer,
}) {
  const [menu, setMenu] = useState(false)
  const actionsRef = useRef(null)
  const presence = liveStatus?.state || 'non_pointe'

  // Le menu se referme dès qu'on clique ailleurs ou qu'on appuie sur
  // Échap : sinon il reste posé sur la ligne suivante.
  useEffect(() => {
    if (!menu) return undefined
    const surPointeur = (evenement) => {
      if (!actionsRef.current?.contains(evenement.target)) setMenu(false)
    }
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') setMenu(false)
    }
    document.addEventListener('pointerdown', surPointeur)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('pointerdown', surPointeur)
      document.removeEventListener('keydown', surTouche)
    }
  }, [menu])

  return (
    <li
      className="rg-entree rg-entree-annuaire"
      data-presence={presence}
      data-menu={menu ? 'ouvert' : undefined}
    >
      <span className="rg-entree-index">{String(numero).padStart(2, '0')}</span>

      <div className="rg-cellule rg-cellule-identite">
        <span className="rg-avatar-annuaire" aria-hidden="true">
          {employee.photo_url
            ? <img src={employee.photo_url} alt="" />
            : initiales(employee)}
        </span>

        <div className="rg-identite-texte">
          <h4 className="rg-entree-titre">
            <button type="button" onClick={() => onOuvrirFiche(employee)}>{nomComplet(employee)}</button>
          </h4>

          <p className="rg-annuaire-sous">
            {employee.matricule && <span className="rg-annuaire-matricule">{employee.matricule}</span>}
            {contractLabel && <span>{contractLabel}</span>}
            {employee.machine_pin && <span>pointeuse {employee.machine_pin}</span>}
            {!employee.machine_pin && <span className="rg-annuaire-manque">aucun numéro de pointage</span>}
          </p>

          <p className="rg-entree-note">
            {[employee.position, employee.department, classificationLabel, seniority]
              .filter(Boolean)
              .join(' · ') || 'Fiche à compléter : ni poste, ni département.'}
          </p>

          <div className="rg-annuaire-etats">
            <LignePresence liveStatus={liveStatus} />
            {regimeLabel && <span className="rg-annuaire-regime">{regimeLabel}</span>}
            {aCompte && (
              <span className="rg-annuaire-compte" data-etat={ancienSysteme ? 'migrer' : (portalEnabled ? 'ouvert' : 'ferme')}>
                {ancienSysteme
                  ? <><UserX size={10} /> portail à migrer</>
                  : portalEnabled
                    ? <><UserCheck size={10} /> portail ouvert</>
                    : <><UserX size={10} /> portail fermé</>}
              </span>
            )}
            {!aCompte && <span className="rg-annuaire-compte" data-etat="aucun">pas de compte</span>}
            {payslipEntries.length > 0 && (
              <span className="rg-annuaire-paie">
                <PlanningPayslipBadge entries={payslipEntries} referenceDate={payslipDate} />
              </span>
            )}
          </div>

          {stats && stats.totalSeconds > 0 && (
            <span className="rg-annuaire-heures">
              <span className="rg-jauge" aria-hidden="true">
                <span
                  className="rg-jauge-remplie"
                  style={{ width: `${Math.min(100, Math.max(0, stats.percentage || 0))}%` }}
                  data-complet={stats.percentage >= 100 ? 'oui' : 'non'}
                />
              </span>
              <span className="rg-annuaire-heures-texte">{stats.label}</span>
            </span>
          )}
        </div>
      </div>

      <div className="rg-cellule rg-cellule-jour">
        <span className="rg-etiquette-champ">Aujourd’hui</span>
        <span className="rg-annuaire-jour">
          {scheduleInfo || 'Aucun horaire du jour'}
        </span>
        {derniereConnexion && (
          <span className="rg-annuaire-jour-note">{derniereConnexion}</span>
        )}
      </div>

      <div className="rg-entree-actions" ref={actionsRef}>
        <button type="button" className="rg-lien" onClick={() => onOuvrirFiche(employee)}>
          <UserCog size={12} /> Fiche
        </button>
        <button type="button" className="rg-lien" onClick={() => onBadge(employee)}>
          <BadgeCheck size={12} /> Badge
        </button>
        <button
          type="button"
          className="rg-lien"
          aria-label={`Autres actions pour ${nomComplet(employee)}`}
          aria-expanded={menu}
          aria-haspopup="true"
          onClick={() => setMenu((v) => !v)}
        >
          <MoreVertical size={14} />
        </button>

        {menu && (
          <div className="rg-menu rg-menu-annuaire" role="group" aria-label={`Autres actions pour ${nomComplet(employee)}`}>
            {planningEnabled && (
              <>
                <button type="button" onClick={() => { setMenu(false); onHoraires(employee) }}>
                  <CalendarClock size={13} /> Horaires
                </button>
                <button type="button" onClick={() => { setMenu(false); onPartagerHoraires(employee) }}>
                  <Share2 size={13} /> Envoyer les horaires
                </button>
              </>
            )}
            <button type="button" onClick={() => { setMenu(false); onPointages(employee) }}>
              <Clock3 size={13} /> Voir les pointages
            </button>
            {portalEnabled && (
              <button type="button" onClick={() => { setMenu(false); onMotDePasse(employee) }}>
                <Key size={13} /> {aCompte ? 'Mot de passe' : 'Créer l’accès portail'}
              </button>
            )}
            {aCompte && (
              <button type="button" onClick={() => { setMenu(false); onBasculerPortail(employee, !portalEnabled) }}>
                <Nfc size={13} /> {portalEnabled ? 'Fermer le portail' : 'Ouvrir le portail'}
              </button>
            )}
            <span className="rg-menu-sep" aria-hidden="true" />
            <button type="button" className="is-danger" onClick={() => { setMenu(false); onSupprimer(employee) }}>
              <Trash2 size={13} /> Supprimer la fiche
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
