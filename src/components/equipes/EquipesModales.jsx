// ═══════════════════════════════════════════════════════════
// 🧩 ÉQUIPES — FENÊTRES DE TRAVAIL, en post-it (22/11/2026)
//
// Cinq fenêtres : créer ou modifier une équipe, composer ses
// membres, supprimer, relire l'historique, appeler les raccourcis.
// Le chef se choisit dans le formulaire de l'équipe — le menu de la
// carte « Changer de chef » ouvre cette même fenêtre, pas une autre.
// Ces cinq fenêtres ne portent aucune coque d'écran, seulement le
// travail — et depuis aujourd'hui, elles portent la MÊME peau que
// la feuille de l'onglet : `EquipesModales.css`, posée sur la
// classe `eqm-voile`.
//
// Ce qui a changé, et pourquoi ce n'était pas un caprice de style :
// ces fenêtres étaient la dernière île de styles EN LIGNE de la
// page — un objet `S` de 63 clefs de CSS écrit dans le JS.
// Trois de leurs règles étaient contraires à la charte et aucune
// feuille ne pouvait les rattraper, parce qu'une attribution
// `style` bat n'importe quel sélecteur :
//   • `backdropFilter: blur(5px)` sur le voile, et une ombre de
//     `0 20px 70px` sous la feuille — la maison ne connaît aucun
//     flou (D-016) ;
//   • `rgba(0,0,0,.8)` comme voile : un noir pur, pas l'espresso
//     de la charte, et à 80 % il efface la page au lieu de
//     l'assourdir (le voile validé est à 44 %) ;
//   • des largeurs de 300, 380, 440, 460 et 480 px, hors du
//     registre des modales (420 / 560 / 760, D-020).
// Les voici 420 et 560, sans qu'aucun champ, aucun libellé, aucun
// geste n'ait bougé : « garde la même interface » tenait déjà sur
// l'onglet, il tient ici.
//
// Sur ces 63 clefs, 13 trouvaient preneur. Les 50 autres
// décrivaient une ANCIENNE PAGE complète (grille d'équipes, bandeau
// d'aperçus, barre d'actions groupées, squelettes) retirée quand la
// vue est devenue `.eqv2` : elles sont parties avec l'objet. Ce
// fichier ne contient plus que le style des fenêtres, et ce style
// est dans une feuille — 319 lignes de markup, 674 de peau.
//
// Les COULEURS D'ÉQUIPE restent en ligne, et c'est voulu : `C9772F`
// et les huit autres viennent de la base, ce sont des DONNÉES ; une
// feuille ne peut pas les connaître. Tout le reste est classe.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Users, Plus, Search, Edit3, Trash2, UserPlus, UserMinus, Crown, X, Check, AlertTriangle, Loader2, Activity, History } from 'lucide-react'
import toast from 'react-hot-toast'

import './EquipesModales.css'

const TEAM_COLORS = [
  '#C9772F', '#2F7F73', '#8A8F4A', '#B4553F', '#7C6AA8',
  '#A9743F', '#4C7E8F', '#6E8B5A', '#B34B37', '#5B6F8C',
]

/**
 * La vignette d'une personne, dans les fenêtres : un cadre carré
 * d'encre, comme dans l'onglet. Le chef porte sa couronne — un
 * marqueur de donnée, pas une action.
 */
export function EmployeeAvatar({ employee, size = 32, showName = false, isLeader = false }) {
  const ini = `${employee?.first_name?.[0] || ''}${employee?.last_name?.[0] || ''}`.toUpperCase()
  return (
    <div className="eqm-personne">
      <span className="eqm-vignette" style={{ width: size, height: size }}>
        {employee?.photo_url
          ? <img src={employee.photo_url} alt="" />
          : <span className="eqm-initiales" style={{ fontSize: Math.round(size * 0.38) }}>{ini}</span>}
        {isLeader && (
          <span className="eqm-couronne"><Crown size={6} /></span>
        )}
      </span>
      {showName && (
        <span className="eqm-personne-nom">
          <span className="eqm-personne-titre">{employee?.first_name} {employee?.last_name}</span>
          {employee?.position && <small>{employee.position}</small>}
        </span>
      )}
    </div>
  )
}

/* ═══════════════ CRÉER / MODIFIER UNE ÉQUIPE ═══════════════ */

export function TeamModal({ isOpen, onClose, team, employees, onSave, loading }) {
  const [form, setForm] = useState({ name: '', description: '', color: TEAM_COLORS[0], leader_employee_id: '' })
  useEffect(() => { if (isOpen) setForm({ name: team?.name || '', description: team?.description || '', color: team?.color || TEAM_COLORS[0], leader_employee_id: team?.leader_employee_id || '' }) }, [team, isOpen])
  if (!isOpen) return null
  const submit = e => { e.preventDefault(); if (!form.name.trim()) { toast.error('Nom requis'); return }; onSave(form) }
  return (
    <div className="eqm-voile" onClick={onClose}>
      <div className="eqm-feuille" role="dialog" aria-modal="true" aria-label={team ? 'Modifier une équipe' : 'Nouvelle équipe'} onClick={e => e.stopPropagation()}>
        <div className="eqm-tete">
          <h2 className="eqm-titre">{team ? 'Modifier' : 'Nouvelle équipe'}</h2>
          <button type="button" className="eqm-fermer" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="eqm-corps">
          <div className="eqm-champ">
            <label htmlFor="eqm-equipe-nom">Nom *</label>
            <input id="eqm-equipe-nom" className="eqm-saisie" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Équipe Maintenance" required />
          </div>

          <div className="eqm-champ">
            <label htmlFor="eqm-equipe-description">Description</label>
            <textarea id="eqm-equipe-description" className="eqm-saisie eqm-saisie--longue" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description..." />
          </div>

          <div className="eqm-champ">
            <span className="eqm-etiquette">Couleur</span>
            {/* la couleur est une DONNÉE : elle reste écrite en ligne, la
                feuille ne peut pas la connaître. Le SÉLECTIONNÉ, lui, est un
                marqueur — il se lit dans la peau, pas dans un anneau de la
                couleur elle-même. */}
            <div className="eqm-couleurs" role="group" aria-label="Couleur de l’équipe">
              {TEAM_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className="eqm-couleur"
                  aria-pressed={form.color === c}
                  style={{ background: c }}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </div>

          <div className="eqm-champ">
            <label htmlFor="eqm-equipe-chef" className="eqm-etiquette">
              <Crown size={11} /> Leader
            </label>
            <select id="eqm-equipe-chef" className="eqm-saisie" value={form.leader_employee_id} onChange={e => setForm({ ...form, leader_employee_id: e.target.value })}>
              <option value="">Aucun</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}{e.position ? ` - ${e.position}` : ''}</option>)}
            </select>
          </div>

          <div className="eqm-pied">
            <button type="button" className="eqm-btn" onClick={onClose} disabled={loading}>Annuler</button>
            <button type="submit" className="eqm-btn eqm-btn--pleine" disabled={loading}>{loading ? <><Loader2 size={14} className="spin" /> Sauvegarde...</> : <><Check size={14} /> {team ? 'Enregistrer' : 'Créer'}</>}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════ COMPOSER LES MEMBRES ═══════════════ */

export function MembersModal({ isOpen, onClose, team, availableEmployees, onAddMembers, onRemoveMember, loading }) {
  const [sel, setSel] = useState([])
  const [search, setSearch] = useState('')
  useEffect(() => { if (isOpen) { setSel([]); setSearch('') } }, [isOpen])
  if (!isOpen || !team) return null
  const filtered = availableEmployees.filter(e => `${e.first_name} ${e.last_name} ${e.position || ''}`.toLowerCase().includes(search.toLowerCase()))
  const toggle = id => setSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const add = () => { if (!sel.length) { toast.error('Sélectionnez au moins un'); return }; onAddMembers(sel) }
  return (
    <div className="eqm-voile" onClick={onClose}>
      <div className="eqm-feuille" role="dialog" aria-modal="true" aria-label="Gérer les membres" onClick={e => e.stopPropagation()}>
        <div className="eqm-tete">
          <div className="eqm-tete-bloc">
            <h2 className="eqm-titre">Gérer les membres</h2>
            <p className="eqm-sous-titre">{team.name}</p>
          </div>
          <button type="button" className="eqm-fermer" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
        </div>

        <div className="eqm-corps">
          {team.members?.length > 0 && (
            <div className="eqm-champ">
              <span className="eqm-etiquette"><Users size={11} /> Actuels ({team.members.length})</span>
              <div className="eqm-pile">
                {team.members.map(m => {
                  const chef = m.employee?.id === team.leader_employee_id
                  return (
                    <span className="eqm-jeton" key={m.id}>
                      <EmployeeAvatar employee={m.employee} size={18} isLeader={chef} />
                      <span>{m.employee?.first_name} {m.employee?.last_name}</span>
                      {!chef && (
                        <button type="button" className="eqm-retirer" onClick={() => onRemoveMember(m.employee?.id)} disabled={loading} aria-label={`Retirer ${m.employee?.first_name} ${m.employee?.last_name} de l’équipe`}>
                          <X size={9} />
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <div className="eqm-champ">
            <label htmlFor="eqm-membres-recherche" className="eqm-etiquette"><UserPlus size={11} /> Ajouter</label>
            <span className="eqm-recherche">
              <Search size={13} />
              <input id="eqm-membres-recherche" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." />
            </span>

            {filtered.length === 0
              ? <p className="eqm-vide">Aucun disponible</p>
              : (
                <div className="eqm-liste" role="group" aria-label="Personnes disponibles">
                  {filtered.map(e => (
                    <div
                      key={e.id}
                      className="eqm-ligne"
                      data-choix={sel.includes(e.id) ? 'oui' : undefined}
                      onClick={() => toggle(e.id)}
                    >
                      <EmployeeAvatar employee={e} size={28} showName />
                      <span className="eqm-case" aria-hidden="true">{sel.includes(e.id) && <Check size={10} />}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        <div className="eqm-pied">
          <button type="button" className="eqm-btn" onClick={onClose} disabled={loading}>Fermer</button>
          {sel.length > 0 && (
            <button type="button" className="eqm-btn eqm-btn--pleine" onClick={add} disabled={loading}>
              {loading ? <Loader2 size={13} className="spin" /> : <UserPlus size={13} />} Ajouter {sel.length}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ SUPPRIMER ═══════════════ */

export function DeleteModal({ open, onClose, onConfirm, teamName, loading }) {
  if (!open) return null
  return (
    <div className="eqm-voile" onClick={onClose}>
      <div className="eqm-feuille eqm-feuille--petite" role="alertdialog" aria-modal="true" aria-label="Supprimer l’équipe" onClick={e => e.stopPropagation()}>
        <div className="eqm-corps eqm-corps--centre">
          <span className="eqm-alerte"><AlertTriangle size={24} /></span>
          <h3 className="eqm-titre eqm-titre--scene">Supprimer l'équipe</h3>
          <p className="eqm-texte">Supprimer <strong>« {teamName} »</strong> ?</p>
          <div className="eqm-pied eqm-pied--partage">
            <button type="button" className="eqm-btn" onClick={onClose} disabled={loading}>Annuler</button>
            <button type="button" className="eqm-btn eqm-btn--danger" onClick={onConfirm} disabled={loading}>
              {loading ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ HISTORIQUE ═══════════════ */

export function HistoryModal({ open, onClose, history, loading }) {
  if (!open) return null
  const iconMap = { 'plus': Plus, 'edit': Edit3, 'trash': Trash2, 'user-plus': UserPlus, 'user-minus': UserMinus, 'crown': Crown, 'activity': Activity }
  return (
    <div className="eqm-voile" onClick={onClose}>
      <div className="eqm-feuille" role="dialog" aria-modal="true" aria-label="Historique de l’équipe" onClick={e => e.stopPropagation()}>
        <div className="eqm-tete">
          <h2 className="eqm-titre"><History size={15} /> Historique</h2>
          <button type="button" className="eqm-fermer" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
        </div>
        <div className="eqm-corps eqm-corps--deroulant">
          {loading
            ? <p className="eqm-vide"><Loader2 size={20} className="spin" /> Lecture de l’historique…</p>
            : history.length === 0
              ? <p className="eqm-vide">Aucun historique</p>
              : (
                <div className="eqm-ecritures">
                  {history.map(h => {
                    const I = iconMap[h.icon] || Activity
                    return (
                      <div className="eqm-ecriture" key={h.id}>
                        {/* la teinte de l'écriture vient de la base : c'est la
                            couleur de l'équipe qui a agi, une donnée */}
                        <span className="eqm-ecriture-ico" style={{ background: `${h.color}15`, borderColor: `${h.color}30` }}>
                          <I size={11} color={h.color} />
                        </span>
                        <span className="eqm-ecriture-corps">
                          <p>{h.description}</p>
                          <small>{h.admin} • {new Date(h.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ RACCOURCIS ═══════════════ */

export function ShortcutsModal({ open, onClose }) {
  if (!open) return null
  return (
    <div className="eqm-voile" onClick={onClose}>
      <div className="eqm-feuille eqm-feuille--petite" role="dialog" aria-modal="true" aria-label="Raccourcis clavier" onClick={e => e.stopPropagation()}>
        <div className="eqm-tete">
          <h2 className="eqm-titre">Raccourcis</h2>
          <button type="button" className="eqm-fermer" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
        </div>
        <div className="eqm-corps">
          {[['N', 'Nouvelle équipe'], ['/', 'Rechercher'], ['R', 'Rafraîchir'], ['G', 'Grille'], ['L', 'Liste'], ['K', 'Kanban'], ['Esc', 'Fermer'], ['?', 'Raccourcis']].map(([k, a]) => (
            <div className="eqm-raccourci" key={k}>
              <kbd>{k}</kbd>
              <span>{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
