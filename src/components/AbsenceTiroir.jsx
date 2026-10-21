// ═══════════════════════════════════════════════════════════
// 🗂️ TIROIR DE DÉTAIL D'UNE ABSENCE
//
// Panneau latéral ouvert depuis le calendrier mensuel : on y LIT
// l'absence et on y PREND une décision (approuver / refuser / modifier).
//
// Doctrine En-Check : une décision change un statut, elle ne supprime
// jamais la ligne. Il n'y a donc volontairement AUCUN bouton de
// suppression ici — la corbeille reste un acte tracé, ailleurs.
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react'
import { X, Paperclip, Pencil, Check, Ban, CalendarOff } from 'lucide-react'
import { styleBarreAbsence } from '../constants/motifsAbsence'
import { formaterDateCourt, formaterHorodatage } from '../services/absencesCalendrier'

export default function AbsenceTiroir({
  absence,
  darkMode = true,
  joursOuvres = null,
  solde = null,
  conflit = null,
  onClose,
  onChangerStatut,
  onModifier,
  onVoirDocument,
}) {
  useEffect(() => {
    const surTouche = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onClose])

  if (!absence) return null

  const theme = {
    fond: darkMode ? '#1D1713' : '#FFFFFF',
    texte: darkMode ? '#F5F2EB' : '#1D1713',
    texteDoux: darkMode ? 'rgba(245,242,235,0.62)' : 'rgba(29,23,19,0.62)',
    bordure: darkMode ? 'rgba(245,158,11,0.16)' : 'rgba(29,23,19,0.12)',
    bloc: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(29,23,19,0.03)',
    ombre: '0 24px 60px rgba(0,0,0,0.45)',
  }

  const style = styleBarreAbsence(absence)
  const nom = `${absence.employees?.first_name || ''} ${absence.employees?.last_name || ''}`.trim() || 'Employé'

  const bloc = { background: theme.bloc, border: `1px solid ${theme.bordure}`, borderRadius: 14, padding: 14, marginBottom: 14 }
  const titre = { margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.texteDoux, marginBottom: 6 }
  const valeur = { margin: 0, fontSize: 14, color: theme.texte, fontWeight: 600 }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000 }}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Absence de ${nom}`}
        data-testid="absence-tiroir"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(430px, 100%)',
          background: theme.fond,
          borderLeft: `1px solid ${theme.bordure}`,
          boxShadow: theme.ombre,
          zIndex: 1001,
          overflowY: 'auto',
          padding: 22,
          fontFamily: 'inherit',
        }}
      >
        {/* ─── En-tête ─── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: style.fond, border: `1px solid ${style.bordure}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
              {style.motif.emoji}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.texte }}>{style.motif.label}</p>
              <p style={{ margin: 0, fontSize: 12, color: theme.texteDoux, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nom}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{
            background: 'transparent', border: `1px solid ${theme.bordure}`, borderRadius: 10,
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: theme.texteDoux, flexShrink: 0,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* ─── Statut ─── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          <span style={{
            background: style.statut.bg, color: style.statut.color,
            border: `1px solid ${style.statut.color}55`,
            borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700,
          }}>
            {style.statut.label}
          </span>
          {absence.document_url && (
            <span style={{
              background: theme.bloc, color: theme.texteDoux, border: `1px solid ${theme.bordure}`,
              borderRadius: 999, padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Paperclip size={12} /> Justificatif
            </span>
          )}
          {conflit && conflit.status === 'pending' && (
            <span style={{
              background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700,
            }}>
              ⚡ Conflit de pointage
            </span>
          )}
        </div>

        {/* ─── Période ─── */}
        <div style={bloc}>
          <p style={titre}>Période</p>
          <p style={valeur}>
            Du {formaterDateCourt(absence.start_date)} au {formaterDateCourt(absence.end_date)}
          </p>
          {joursOuvres !== null && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: theme.texteDoux }}>
              {joursOuvres} jour{joursOuvres > 1 ? 's' : ''} compté{joursOuvres > 1 ? 's' : ''}
              {absence.count_holidays_as_leave ? ' · jours fériés inclus' : ' · jours fériés exclus'}
            </p>
          )}
        </div>

        {/* ─── Soldes ─── */}
        <div style={bloc}>
          <p style={titre}>Solde de congés</p>
          {solde ? (
            <p style={valeur}>
              🌴 {solde.restant} j restants sur {solde.plafond} j
              {solde.pris > 0 && (
                <span style={{ color: theme.texteDoux, fontWeight: 400, fontSize: 13 }}> · {solde.pris} j pris cette année</span>
              )}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: theme.texteDoux }}>Solde non renseigné</p>
          )}
        </div>

        {/* ─── Justificatif ─── */}
        {absence.document_url ? (
          <button onClick={() => onVoirDocument?.(absence)} style={{
            ...bloc, width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: theme.texte,
          }}>
            <Paperclip size={16} color="#F59E0B" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Voir le justificatif</span>
          </button>
        ) : (
          <div style={bloc}>
            <p style={titre}>Justificatif</p>
            <p style={{ margin: 0, fontSize: 13, color: theme.texteDoux }}>Aucun document joint</p>
          </div>
        )}

        {/* ─── Notes ─── */}
        {absence.notes && (
          <div style={bloc}>
            <p style={titre}>Notes</p>
            <p style={{ margin: 0, fontSize: 13, color: theme.texte, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {absence.notes}
            </p>
          </div>
        )}

        {/* ─── Historique ─── */}
        <div style={bloc}>
          <p style={titre}>Historique</p>
          <p style={{ margin: 0, fontSize: 13, color: theme.texteDoux, lineHeight: 1.7 }}>
            Déclarée le {formaterHorodatage(absence.created_at)}
            {absence.employees?.matricule ? ` · Matricule ${absence.employees.matricule}` : ''}
          </p>
        </div>

        {/* ─── Décisions ─── */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {absence.status !== 'approuve' && (
            <button data-testid="tiroir-approuver" onClick={() => onChangerStatut?.(absence, 'approuve')} style={{
              flex: 1, padding: 13, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFF',
              fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Check size={16} /> Approuver
            </button>
          )}
          {absence.status !== 'refuse' && (
            <button data-testid="tiroir-refuser" onClick={() => onChangerStatut?.(absence, 'refuse')} style={{
              flex: 1, padding: 13, borderRadius: 12, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(239,68,68,0.5)', color: '#EF4444',
              fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Ban size={16} /> Refuser
            </button>
          )}
        </div>

        <button onClick={() => onModifier?.(absence)} style={{
          width: '100%', marginTop: 10, padding: 12, borderRadius: 12, cursor: 'pointer',
          background: 'transparent', border: `1px solid ${theme.bordure}`, color: theme.texteDoux,
          fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Pencil size={14} /> Modifier l’absence
        </button>

        <p style={{ margin: '18px 0 0', fontSize: 11, color: theme.texteDoux, display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.6 }}>
          <CalendarOff size={12} />
          Approuver ou refuser change le statut de l’absence. Rien n’est supprimé.
        </p>
      </aside>
    </>
  )
}
