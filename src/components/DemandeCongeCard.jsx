// ═══════════════════════════════════════════════════════════
// 📨 CARTE DE DEMANDE DE CONGÉ (onglet « Demandes employés »)
//
// Design aligné sur la liste de tâches : barre de couleur, avatar
// de l'employé, pastille de motif, boutons d'action visibles.
// Les couleurs et emojis viennent des motifs personnalisés.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { CheckCircle2, XCircle, Paperclip, CalendarDays, Clock, FileText, Trash2 } from 'lucide-react'
import { useMotifsAbsence } from '../hooks/useMotifsAbsence'

/** « Kofi Mensah » → « KM » — sert d'avatar quand il n'y a pas de photo */
function initiales(prenom, nom) {
  return `${(prenom || '?').charAt(0)}${(nom || '?').charAt(0)}`.toUpperCase()
}

/** Un dégradé stable par employé : deux cartes du même employé ont la même teinte */
function teinte(nom) {
  const base = [...`${nom || 'en-check'}`].reduce((n, c) => n + c.charCodeAt(0), 0)
  const h = base % 360
  return `linear-gradient(135deg, hsl(${h} 62% 52%), hsl(${(h + 48) % 360} 58% 38%))`
}

export function DemandeCongeCard({
  demande: d,
  onVoir,
  onApprouver,
  onRefuser,
  onSupprimer,
  busy,
  error,
  fmtDate,
  cleJour,
}) {
  const [survole, setSurvole] = useState(false)
  const { motifPour } = useMotifsAbsence()

  // le motif de l'entreprise de la demande, pas celui de la liste affichée
  const motif = motifPour(d)
  const couleur = motif?.color || '#94A3B8'
  const emoji = motif?.emoji || '📋'
  const titreMotif = motif?.label || d.reason

  // on compare deux Dates du calendrier local, en donnant toujours une
  // chaîne « AAAA-MM-JJ » à cleJour : pas de surprise d'un fuseau à l'autre
  const maintenant = new Date()
  const aujourdhuiIso = new Date(maintenant.getTime() - maintenant.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10)
  const cle = cleJour ? cleJour(String(d.start_date).slice(0, 10)) : String(d.start_date).slice(0, 10)
  const aujourdhui = cleJour ? cleJour(aujourdhuiIso) : aujourdhuiIso
  const commenceAujourdhui = cle === aujourdhui

  const statut = d.status === 'approved' || d.status === 'approuve' ? 'approuve'
    : d.status === 'rejected' || d.status === 'refuse' ? 'refuse'
      : 'attente'

  const pastille = {
    attente: { texte: '⏳ En attente', fond: 'rgba(245,158,11,0.14)', bord: 'rgba(245,158,11,0.35)', texte2: '#FCD34D' },
    approuve: { texte: '✅ Approuvée', fond: 'rgba(16,185,129,0.13)', bord: 'rgba(16,185,129,0.32)', texte2: '#6EE7B7' },
    refuse: { texte: '❌ Refusée', fond: 'rgba(239,68,68,0.13)', bord: 'rgba(239,68,68,0.32)', texte2: '#FCA5A5' },
  }[statut]

  const nomComplet = `${d.employees?.first_name || ''} ${d.employees?.last_name || ''}`.trim() || 'Employé'
  const nbJours = d.days_count ?? d.working_days ?? ''
  // une demande porte soit plusieurs pièces (documents), soit une seule (document_url)
  const pieces = Array.isArray(d.documents) ? d.documents.filter(Boolean) : (d.document_url ? [d.document_url] : [])

  const ouvrir = () => onVoir?.(d)
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(d) }

  const bouton = (actif) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600,
    fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
    background: actif ? 'rgba(16,185,129,0.16)' : 'transparent',
    border: `1px solid ${actif ? 'rgba(16,185,129,0.42)' : 'rgba(239,68,68,0.38)'}`,
    color: actif ? '#6EE7B7' : '#FCA5A5',
    opacity: busy ? 0.6 : 1,
  })

  return (
    <div
      className="card-on-hover"
      data-testid="demande-card"
      data-statut={statut}
      data-jour={cle}
      role="button"
      tabIndex={0}
      onClick={ouvrir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir() } }}
      onMouseEnter={() => setSurvole(true)}
      onMouseLeave={() => setSurvole(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
        background: survole ? 'var(--abs-line-soft)' : 'var(--abs-fill-soft)',
        border: '1px solid rgba(245,158,11,0.14)',
        borderLeft: `3px solid ${couleur}`,
        boxShadow: survole ? '0 6px 20px rgba(0,0,0,0.22)' : 'none',
        transform: survole ? 'translateX(2px)' : 'translateX(0)',
        transition: 'background .16s ease, box-shadow .16s ease, transform .16s ease',
      }}
    >
      {/* Avatar de l'employé */}
      <div
        style={{
          width: 42, height: 42, flexShrink: 0, borderRadius: '50%',
          background: teinte(nomComplet),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
          border: '2px solid var(--abs-line)',
        }}
        aria-hidden="true"
      >
        {initiales(d.employees?.first_name, d.employees?.last_name)}
      </div>

      {/* Identité + période */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--abs-text)', fontSize: 14.5, fontWeight: 600 }}>{nomComplet}</span>
          <span
            style={{
              padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 600,
              background: `${couleur}22`, border: `1px solid ${couleur}55`, color: couleur,
              display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            }}
            data-motif={d.reason}
          >
            {emoji} {titreMotif}
          </span>
          <span
            data-testid="demande-statut"
            style={{
              padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 600,
              background: pastille.fond, border: `1px solid ${pastille.bord}`, color: pastille.texte2,
              whiteSpace: 'nowrap',
            }}
          >
            {pastille.texte}
          </span>
          {commenceAujourdhui && (
            <span style={{ fontSize: 10, color: '#FCD34D', background: 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: 999 }}>
              commence aujourd’hui
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--abs-text-soft)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CalendarDays size={12} />
            {fmtDate ? `${fmtDate(d.start_date)} → ${fmtDate(d.end_date)}` : `${d.start_date} → ${d.end_date}`}
          </span>
          {nbJours !== '' && nbJours !== null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} /> {nbJours} j
            </span>
          )}
          {pieces.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#93C5FD' }}>
              <Paperclip size={12} /> {pieces.length} pièce{pieces.length > 1 ? 's' : ''} jointe{pieces.length > 1 ? 's' : ''}
            </span>
          )}
          {d.leave_type && d.leave_type !== 'full_day' && (
            <span>{d.leave_type === 'half_day' ? '½ journée' : d.leave_type}</span>
          )}
        </div>

        {d.comment && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--abs-text-soft)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <FileText size={11} /> {d.comment}
          </p>
        )}

        {error && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#FCA5A5' }}>{error}</p>
        )}
      </div>

      {/* Demande déjà traitée : on peut la retirer de la liste */}
      {statut !== 'attente' && (
        <button
          type="button"
          onClick={stop(onSupprimer)}
          data-testid="demande-supprimer"
          title={statut === 'approuve' ? 'Supprimer la demande et son absence' : 'Supprimer la demande'}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, flexShrink: 0, borderRadius: 9, cursor: 'pointer',
            background: 'transparent', border: '1px solid rgba(239,68,68,0.28)', color: '#FCA5A5',
            opacity: 0.75,
          }}
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Actions */}
      {statut === 'attente' && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={stop(onApprouver)}
            disabled={busy}
            data-testid="demande-approuver"
            style={bouton(true)}
          >
            <CheckCircle2 size={15} /> Approuver
          </button>
          <button
            type="button"
            onClick={stop(onRefuser)}
            disabled={busy}
            data-testid="demande-refuser"
            style={bouton(false)}
          >
            <XCircle size={15} /> Refuser
          </button>
        </div>
      )}
    </div>
  )
}

export default DemandeCongeCard
