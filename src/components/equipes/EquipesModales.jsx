// ═══════════════════════════════════════════════════════════
// 🧩 ÉQUIPES — FENÊTRES DE TRAVAIL (perles zoulou)
//
// Créer/modifier une équipe, composer ses membres, changer de
// leader, supprimer, relire l'historique. Ces fenêtres sont
// partagées par la vue « Équipes » de la page Employés : elles
// ne portent aucune coque d'écran, seulement le travail.
// L'apparence suit les variables --zl-* de la page hôte
// (clair / sombre), jamais des couleurs figées.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Users, Plus, Search, Edit3, Trash2, UserPlus, UserMinus, Crown, X, Check, AlertTriangle, Loader2, Activity, History } from 'lucide-react'
import toast from 'react-hot-toast'

const TEAM_COLORS = [
  '#C9772F', '#2F7F73', '#8A8F4A', '#B4553F', '#7C6AA8',
  '#A9743F', '#4C7E8F', '#6E8B5A', '#B34B37', '#5B6F8C',
]

export function EmployeeAvatar({ employee, size = 32, showName = false, isLeader = false }) {
  const ini = `${employee?.first_name?.[0] || ''}${employee?.last_name?.[0] || ''}`.toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: size, height: size, borderRadius: size > 28 ? 10 : 7, background: 'linear-gradient(135deg, var(--zl-cuivre-voile), var(--zl-cuivre-voile))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--zl-cuivre)', fontWeight: 700, fontSize: size * 0.38, position: 'relative', flexShrink: 0, border: isLeader ? '2px solid var(--zl-cuivre)' : '2px solid var(--zl-trait)' }}>
        {employee?.photo_url ? <img src={employee.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : ini}
        {isLeader && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: '50%', background: 'var(--zl-cuivre)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--zl-fond)' }}><Crown size={6} color="var(--zl-sur-cuivre)" /></div>}
      </div>
      {showName && (
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--zl-encre)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{employee?.first_name} {employee?.last_name}</p>
          {employee?.position && <p style={{ fontSize: 10, color: 'var(--zl-faible)', margin: 0 }}>{employee.position}</p>}
        </div>
      )}
    </div>
  )
}

/* ═══════════════ INSIGHTS BANNER (horizontal, intégré) ═══════════════ */


export function TeamModal({ isOpen, onClose, team, employees, onSave, loading }) {
  const [form, setForm] = useState({ name: '', description: '', color: TEAM_COLORS[0], leader_employee_id: '' })
  useEffect(() => { if (isOpen) setForm({ name: team?.name || '', description: team?.description || '', color: team?.color || TEAM_COLORS[0], leader_employee_id: team?.leader_employee_id || '' }) }, [team, isOpen])
  if (!isOpen) return null
  const submit = e => { e.preventDefault(); if (!form.name.trim()) { toast.error('Nom requis'); return }; onSave(form) }
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><h2 style={S.modalTitle}>{team ? 'Modifier' : 'Nouvelle équipe'}</h2><button onClick={onClose} style={S.modalX}><X size={16} /></button></div>
        <form onSubmit={submit} style={S.modalBody}>
          <div style={S.field}><label style={S.label}>Nom *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} placeholder="Ex: Équipe Maintenance" required /></div>
          <div style={S.field}><label style={S.label}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...S.input, minHeight: 60, resize: 'vertical' }} placeholder="Description..." /></div>
          <div style={S.field}><label style={S.label}>Couleur</label><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{TEAM_COLORS.map(c => <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} style={{ width: 28, height: 28, borderRadius: 7, background: c, cursor: 'pointer', border: form.color === c ? '3px solid var(--zl-encre)' : '3px solid transparent', boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none' }} />)}</div></div>
          <div style={S.field}><label style={S.label}><Crown size={11} color="var(--zl-cuivre)" /> Leader</label><select value={form.leader_employee_id} onChange={e => setForm({ ...form, leader_employee_id: e.target.value })} style={S.select}><option value="">Aucun</option>{employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}{e.position ? ` - ${e.position}` : ''}</option>)}</select></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={onClose} style={S.btnSec} disabled={loading}>Annuler</button>
            <button type="submit" style={S.btnPri} disabled={loading}>{loading ? <><Loader2 size={14} className="spin" /> Sauvegarde...</> : <><Check size={14} /> {team ? 'Enregistrer' : 'Créer'}</>}</button>
          </div>
        </form>
      </div>
    </div>
  )
}


export function MembersModal({ isOpen, onClose, team, availableEmployees, onAddMembers, onRemoveMember, loading }) {
  const [sel, setSel] = useState([])
  const [search, setSearch] = useState('')
  useEffect(() => { if (isOpen) { setSel([]); setSearch('') } }, [isOpen])
  if (!isOpen || !team) return null
  const filtered = availableEmployees.filter(e => `${e.first_name} ${e.last_name} ${e.position || ''}`.toLowerCase().includes(search.toLowerCase()))
  const toggle = id => setSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const add = () => { if (!sel.length) { toast.error('Sélectionnez au moins un'); return }; onAddMembers(sel) }
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><div><h2 style={S.modalTitle}>Gérer les membres</h2><p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--zl-cuivre)' }}>{team.name}</p></div><button onClick={onClose} style={S.modalX}><X size={16} /></button></div>
        <div style={S.modalBody}>
          {team.members?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}><Users size={11} color="var(--zl-cuivre)" /> Actuels ({team.members.length})</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {team.members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--zl-creux)', border: '1px solid var(--zl-trait)', borderRadius: 12, fontSize: 10, color: 'var(--zl-douce)' }}>
                    <EmployeeAvatar employee={m.employee} size={18} isLeader={m.employee?.id === team.leader_employee_id} />
                    <span>{m.employee?.first_name} {m.employee?.last_name}</span>
                    {m.employee?.id !== team.leader_employee_id && <button onClick={() => onRemoveMember(m.employee?.id)} disabled={loading} style={{ background: 'transparent', border: 'none', padding: 1, color: 'var(--zl-corail)', cursor: 'pointer', display: 'flex' }}><X size={9} /></button>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <label style={S.label}><UserPlus size={11} color="var(--zl-teal)" /> Ajouter</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--zl-surface)', border: '1px solid var(--zl-trait)', borderRadius: 8, padding: '7px 10px', marginBottom: 8 }}>
            <Search size={13} color="var(--zl-cuivre)" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--zl-encre)', fontSize: 12 }} />
          </div>
          {filtered.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--zl-faible)', fontSize: 12 }}>Aucun disponible</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
              {filtered.map(e => (
                <div key={e.id} onClick={() => toggle(e.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 8, borderRadius: 8, border: `1px solid ${sel.includes(e.id) ? 'rgba(245,158,11,0.3)' : 'var(--zl-trait)'}`, background: sel.includes(e.id) ? 'var(--zl-cuivre-voile)' : 'var(--zl-creux)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <EmployeeAvatar employee={e} size={28} showName />
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: sel.includes(e.id) ? '2px solid var(--zl-cuivre)' : '2px solid rgba(255,255,255,0.15)', background: sel.includes(e.id) ? 'var(--zl-cuivre-voile)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sel.includes(e.id) && <Check size={10} color="var(--zl-cuivre)" />}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--zl-trait)' }}>
          <button onClick={onClose} style={S.btnSec} disabled={loading}>Fermer</button>
          {sel.length > 0 && <button onClick={add} style={S.btnPri} disabled={loading}>{loading ? <Loader2 size={13} className="spin" /> : <UserPlus size={13} />} Ajouter {sel.length}</button>}
        </div>
      </div>
    </div>
  )
}


export function DeleteModal({ open, onClose, onConfirm, teamName, loading }) {
  if (!open) return null
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ width: 50, height: 50, borderRadius: 13, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><AlertTriangle size={24} color="var(--zl-corail)" /></div>
          <h3 style={{ color: 'var(--zl-encre)', fontSize: 16, margin: '0 0 8px' }}>Supprimer l'équipe</h3>
          <p style={{ color: 'var(--zl-faible)', fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>Supprimer <strong style={{ color: 'var(--zl-cuivre)' }}>"{teamName}"</strong> ?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ ...S.btnSec, flex: 1 }} disabled={loading}>Annuler</button>
            <button onClick={onConfirm} style={{ ...S.btnDanger, flex: 1 }} disabled={loading}>{loading ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Supprimer</button>
          </div>
        </div>
      </div>
    </div>
  )
}


export function HistoryModal({ open, onClose, history, loading }) {
  if (!open) return null
  const iconMap = { 'plus': Plus, 'edit': Edit3, 'trash': Trash2, 'user-plus': UserPlus, 'user-minus': UserMinus, 'crown': Crown, 'activity': Activity }
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><History size={16} color="var(--zl-cuivre)" /><h2 style={S.modalTitle}>Historique</h2></div><button onClick={onClose} style={S.modalX}><X size={16} /></button></div>
        <div style={{ ...S.modalBody, maxHeight: 360, overflowY: 'auto' }}>
          {loading ? <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={20} className="spin" color="var(--zl-cuivre)" /></div> :
           history.length === 0 ? <div style={{ textAlign: 'center', padding: 32, color: 'var(--zl-faible)', fontSize: 12 }}>Aucun historique</div> :
           <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{history.map(h => { const I = iconMap[h.icon] || Activity; return (
             <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 7, background: 'var(--zl-creux)', borderRadius: 6 }}>
               <div style={{ width: 24, height: 24, borderRadius: 6, background: `${h.color}15`, border: `1px solid ${h.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><I size={11} color={h.color} /></div>
               <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, color: 'var(--zl-encre)', fontSize: 12 }}>{h.description}</p><p style={{ margin: '1px 0 0', color: 'var(--zl-faible)', fontSize: 10 }}>{h.admin} • {new Date(h.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>
             </div>)})}</div>}
        </div>
      </div>
    </div>
  )
}


export function ShortcutsModal({ open, onClose }) {
  if (!open) return null
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 300 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><h2 style={S.modalTitle}>Raccourcis</h2><button onClick={onClose} style={S.modalX}><X size={16} /></button></div>
        <div style={S.modalBody}>
          {[['N', 'Nouvelle équipe'], ['/', 'Rechercher'], ['R', 'Rafraîchir'], ['G', 'Grille'], ['L', 'Liste'], ['K', 'Kanban'], ['Esc', 'Fermer'], ['?', 'Raccourcis']].map(([k, a]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--zl-creux)' }}>
              <kbd style={{ padding: '3px 8px', background: 'var(--zl-cuivre-voile)', border: '1px solid var(--zl-cuivre-voile)', borderRadius: 4, color: 'var(--zl-cuivre)', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{k}</kbd>
              <span style={{ color: 'var(--zl-douce)', fontSize: 12 }}>{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ COMPOSANT PRINCIPAL ═══════════════ */


const S = {
  container: { minHeight: '100vh', background: 'var(--zl-fond)', position: 'relative' },
  bgPattern: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'radial-gradient(circle at 15% 50%, var(--zl-cuivre-voile) 0%, transparent 50%), radial-gradient(circle at 85% 20%, rgba(99,102,241,0.03) 0%, transparent 50%)' },
  main: { padding: 'clamp(10px, 2.5vw, 20px)', maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 },

  headerSection: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  titleIcon: { width: 38, height: 38, borderRadius: 10, background: 'var(--zl-cuivre-voile)', border: '1px solid var(--zl-cuivre-voile)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: 'var(--zl-encre)', fontSize: 'clamp(16px, 2.5vw, 20px)', fontWeight: 700, margin: 0 },
  pageSub: { color: 'var(--zl-faible)', fontSize: 11, margin: '1px 0 0' },
  liveBadge: { display: 'flex', alignItems: 'center', gap: 4, background: 'var(--zl-teal-voile)', border: '1px solid var(--zl-teal-voile)', color: 'var(--zl-teal)', padding: '3px 9px', borderRadius: 12, fontSize: 10, fontWeight: 600 },
  iconBtnH: { width: 32, height: 32, borderRadius: 8, border: '1px solid var(--zl-trait)', background: 'var(--zl-creux)', color: 'var(--zl-faible)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

  statsStrip: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  statChip: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: 'var(--zl-surface)', borderRadius: 9, border: '1px solid var(--zl-trait)' },

  // Insights banner — horizontal intégré
  insightsBanner: { background: 'var(--zl-surface)', borderRadius: 10, border: '1px solid var(--zl-trait)', overflow: 'hidden' },
  insightsBannerLocked: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--zl-surface)', borderRadius: 10, border: '1px solid var(--zl-trait)' },
  insightsBannerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', cursor: 'pointer', gap: 8, flexWrap: 'wrap' },
  insightsBannerLeft: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  insightsBannerRight: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  healthPill: { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 10px', background: 'rgba(245,158,11,0.06)', borderRadius: 8, border: '1px solid var(--zl-cuivre-voile)' },
  healthDots: { display: 'flex', gap: 6 },
  expandToggle: { width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  insightsBannerBody: { borderTop: '1px solid var(--zl-trait)' },
  insightsTabs: { display: 'flex', borderBottom: '1px solid var(--zl-trait)' },
  insightsTab: { flex: 1, padding: '7px 4px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, cursor: 'pointer' },
  tabLabel: {},
  insightsGrid: { padding: 10 },
  insightsHScroll: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 },
  insightCard: { minWidth: 200, maxWidth: 280, flex: '0 0 auto', padding: 8, background: 'var(--zl-creux)', borderRadius: 7, borderLeft: '3px solid rgba(245,158,11,0.3)', border: '1px solid var(--zl-trait)' },
  insightsEmpty: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16, color: 'var(--zl-faible)', fontSize: 11 },

  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 7, background: 'var(--zl-surface)', border: '1px solid var(--zl-trait)', borderRadius: 8, padding: '8px 10px', flex: 1, maxWidth: 320, minWidth: 160 },
  searchInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--zl-encre)', fontSize: 12 },
  sel: { background: 'var(--zl-surface)', border: '1px solid var(--zl-trait)', borderRadius: 6, padding: '6px 8px', color: 'var(--zl-encre)', fontSize: 11, cursor: 'pointer', outline: 'none' },
  viewToggle: { display: 'flex', background: 'var(--zl-surface)', borderRadius: 6, border: '1px solid var(--zl-trait)', overflow: 'hidden' },
  viewBtn: { padding: '6px 8px', background: 'transparent', border: 'none', color: 'var(--zl-faible)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  viewBtnActive: { background: 'var(--zl-cuivre-voile)', color: 'var(--zl-cuivre)' },

  bulkBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: 'var(--zl-cuivre-voile)', border: '1px solid var(--zl-cuivre-voile)', borderRadius: 8, flexWrap: 'wrap', gap: 6 },
  bulkBtn: { display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', background: 'transparent', border: '1px solid var(--zl-trait-fort)', borderRadius: 5, color: 'var(--zl-douce)', fontSize: 10, cursor: 'pointer' },

  teamsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 },

  teamCard: { background: 'var(--zl-surface)', backdropFilter: 'blur(8px)', borderRadius: 10, border: '1px solid var(--zl-trait)', padding: 10, position: 'relative', overflow: 'hidden' },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)' },
  expandBtn: { width: 24, height: 24, borderRadius: 5, background: 'var(--zl-cuivre-voile)', border: '1px solid var(--zl-cuivre-voile)', color: 'var(--zl-cuivre)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  moreBtn: { width: 24, height: 24, borderRadius: 5, background: 'var(--zl-creux)', border: '1px solid var(--zl-trait)', color: 'var(--zl-faible)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dropdown: { position: 'absolute', top: '100%', right: 0, marginTop: 3, background: 'var(--zl-fond-2)', border: '1px solid var(--zl-cuivre-voile)', borderRadius: 8, padding: 3, minWidth: 140, zIndex: 100, boxShadow: '0 10px 35px rgba(0,0,0,.5)' },
  ddItem: { display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '6px 8px', background: 'transparent', border: 'none', borderRadius: 5, color: 'var(--zl-douce)', fontSize: 11, cursor: 'pointer', textAlign: 'left' },

  teamRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--zl-surface)', borderRadius: 8, border: '1px solid var(--zl-trait)' },
  iconBtn: { width: 24, height: 24, borderRadius: 5, background: 'var(--zl-creux)', border: '1px solid var(--zl-trait)', color: 'var(--zl-faible)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  emptyState: { textAlign: 'center', padding: '36px 14px', background: 'var(--zl-surface)', borderRadius: 12, border: '1px solid var(--zl-trait)' },

  // Modals
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, zIndex: 1000 },
  modal: { width: '100%', maxWidth: 440, background: 'var(--zl-fond-2)', border: '1px solid var(--zl-cuivre-voile)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 70px rgba(0,0,0,.6)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--zl-trait)' },
  modalTitle: { margin: 0, color: 'var(--zl-encre)', fontSize: 14, fontWeight: 700 },
  modalX: { width: 28, height: 28, borderRadius: 7, border: '1px solid var(--zl-trait-fort)', background: 'var(--zl-creux)', color: 'var(--zl-faible)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 14, overflowY: 'auto', flex: 1 },
  field: { marginBottom: 12 },
  label: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--zl-faible)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 },
  input: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--zl-trait)', background: 'var(--zl-creux)', color: 'var(--zl-encre)', outline: 'none', fontSize: 12, fontFamily: 'inherit' },
  select: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--zl-trait)', background: 'var(--zl-creux)', color: 'var(--zl-encre)', outline: 'none', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' },

  btnPri: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--zl-cuivre), var(--zl-cuivre-fort))', color: 'var(--zl-sur-cuivre)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnSec: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--zl-trait)', background: 'var(--zl-creux)', color: 'var(--zl-douce)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--zl-corail), var(--zl-corail-fort))', color: 'var(--zl-encre)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },

  skeletonCard: { background: 'var(--zl-surface)', borderRadius: 10, border: '1px solid var(--zl-trait)', padding: 12, marginBottom: 8 },
  skeletonCircle: { borderRadius: 8, background: 'linear-gradient(90deg, var(--zl-creux) 25%, var(--zl-trait) 50%, var(--zl-creux) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },
  skeletonLine: { height: 12, borderRadius: 5, background: 'linear-gradient(90deg, var(--zl-creux) 25%, var(--zl-trait) 50%, var(--zl-creux) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },

  leaderBadgeIcon: { position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: '50%', background: 'var(--zl-cuivre)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--zl-fond)' },

}
