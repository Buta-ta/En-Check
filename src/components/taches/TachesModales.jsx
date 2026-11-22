// ═══════════════════════════════════════════════════════════
// 🧩 TÂCHES — FENÊTRES DE TRAVAIL, en post-it (22/11/2026)
//
// Une tâche (avec durée prédite, charge de la personne et
// suggestions), une catégorie, une suppression à confirmer, les
// raccourcis — et la FICHE de tâche, lue sans quitter le tableau :
// l'adresse `/taches/:id` ouvrait une PAGE, le 22/11 elle ouvre une
// fenêtre, et la page est supprimée.
//
// Partagées par la vue « Tâches » de la page Employés : aucune coque
// d'écran ici, uniquement le travail — et la MÊME peau que les
// fenêtres des Équipes : `TachesModales.css`, posée sur la classe
// `tam-voile`.
//
// Jumelles strictes de `EquipesModales.jsx` : mêmes classes de
// coque (`tam-` au lieu de `eqm-`), mêmes largeurs au registre, même
// feuille (coin carré, contour d'encre de 2 px, bande de colle,
// rabat, double feutre en deux ombres dures). Ce qui change, c'est
// le contenu : les trois fenêtres de tâche sont les seules à poser
// deux colonnes, donc elles prennent la largeur MAXIMALE du registre
// — 760 px. La fiche de tâche lit la MÊME largeur : elle n'a pas de
// second panneau à côté, mais huit mesures, des pièces jointes, deux
// groupes de commentaires et un historique à loger.
//
// Avant : un objet `styles` de 133 clefs de CSS écrites dans le JS,
// posées en `style={…}` — 39 clefs trouvaient preneur, 94
// décrivaient une ANCIENNE PAGE entière (bandeau d'alertes,
// calendrier, grille de stats, squelettes) retirée quand la vue est
// devenue `.tqv2`. Une attribution en ligne bat n'importe quel
// sélecteur de feuille : trois entorses y étaient figées sans
// recours : `backdropFilter: blur(6px)` sur le voile et une ombre de
// `0 24px 80px` sous la feuille (la maison ne connaît AUCUN flou,
// D-016) ; un voile `rgba(0,0,0,0.8)`, du noir pur à 80 % qui efface
// la page au lieu de l'assourdir ; un `borderRadius: 18` et des
// rayons de 10 / 8 / 6 en dur ; et des largeurs de 340, 420, 520 et
// 800 px, hors du registre des modales (420 / 560 / 760, D-020).
// Les voilà 560 pour la catégorie, 760 pour la tâche, 420 pour les
// deux autres — le 420 de la suppression était la seule valeur
// conforme de l'île.
//
// Les COULEURS DE CATÉGORIE restent en ligne, et c'est voulu : ce
// sont des DONNÉES qui viennent de la base, une feuille ne peut pas
// les connaître. Tout le reste est classe.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Plus, X, Loader2, Edit3, Trash2, Clock, AlertTriangle, CheckCircle2, Camera, FileText, MessageSquare, ShieldCheck, Sparkles, Tag, Check, Lightbulb, ClipboardList, Calendar, Eye, Play, Zap, Paperclip, Image as ImageIcon, Download, History, ChevronDown, Send, RefreshCw, TimerReset, Users, XCircle, Pencil, Flag } from 'lucide-react'
import toast from 'react-hot-toast'

import {
  predictTaskDuration, checkEmployeeWorkload, suggestAssignees,
  TASK_PRIORITY, TASK_TYPE,
  // la fiche de tâche lit ses exigences et ses heures ici, et n'appelle
  // AUCUN service d'écriture : les gestes remontent au parent
  getStatusLabel, getPriorityLabel, getDeadlineStatus, formatDuration,
} from '../../services/taskService'

import './TachesModales.css'

// La palette FEUTRE — dix encres de marqueur, les mêmes que dans
// l'onglet Équipes (`EquipesModales.jsx`). Elle est écrite ici AUSSI
// parce que ce sont des valeurs enregistrées en base par catégorie,
// non un style : les deux îles doivent rester lisibles l'une sans
// l'autre. Les teintes sont choisies pour laver un papier sans jamais
// porter de texte (voir `TachesVue.css`, règle du lavis).
const CATEGORY_COLORS = [
  '#D2372C', '#E07B1F', '#E3B500', '#1F8A4C', '#0E8C9E',
  '#2C63B4', '#6A3FA0', '#C4326E', '#7A4A21', '#39507C',
]

// Les dix feutres ont un NOM, pour qu’un lecteur d’écran n’annonce pas un
// code hexadécimal : la teinte est une donnée, le mot est une étiquette.
const FEUTRE_NOMS = [
  'rouge', 'orange', 'jaune', 'vert', 'turquoise',
  'bleu', 'violet', 'rose', 'sepia', 'bleu nuit',
]

// ═══════════════════════════════════════════════════════════════════
// FENÊTRE CATÉGORIE
// ═══════════════════════════════════════════════════════════════════


export function CategoryModal({ open, onClose, onSave, onDelete, loading, editingCategory, categories }) {
  const [form, setForm] = useState({ name: '', description: '', color: CATEGORY_COLORS[0], icon: 'clipboard' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      if (editingCategory) {
        setForm({
          name: editingCategory.name || '',
          description: editingCategory.description || '',
          color: editingCategory.color || CATEGORY_COLORS[0],
          icon: editingCategory.icon || 'clipboard'
        })
      } else {
        setForm({ name: '', description: '', color: CATEGORY_COLORS[0], icon: 'clipboard' })
      }
      setShowDeleteConfirm(false)
    }
  }, [open, editingCategory])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Le nom est requis'); return }
    onSave(form, editingCategory?.id)
  }

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(editingCategory.id)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  return (
    <div className="tam-voile" onClick={onClose}>
      <div className="tam-feuille" role="dialog" aria-modal="true" aria-label={editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClick={(e) => e.stopPropagation()}>
        <div className="tam-tete">
          <span className="tam-tete-bloc">
            <span className="tam-pucelle"><Tag size={18} /></span>
            <h3 className="tam-titre">{editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h3>
          </span>
          <button type="button" className="tam-fermer" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="tam-corps">
          <div className="tam-champ">
            <label htmlFor="tam-categorie-nom">Nom *</label>
            <input
              id="tam-categorie-nom"
              className="tam-saisie"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Maintenance"
            />
          </div>

          <div className="tam-champ">
            <label htmlFor="tam-categorie-description">Description</label>
            <textarea
              id="tam-categorie-description"
              className="tam-saisie tam-saisie--longue"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Description optionnelle..."
            />
          </div>

          <div className="tam-champ">
            <span className="tam-etiquette">Couleur</span>
            {/* la teinte est une DONNÉE : elle reste écrite en ligne. Le
                SÉLECTIONNÉ est un marqueur, il se lit dans la peau */}
            <div className="tam-couleurs" role="group" aria-label="Couleur de la catégorie">
              {CATEGORY_COLORS.map((color, i) => (
                <button
                  key={color}
                  type="button"
                  className="tam-couleur"
                  aria-pressed={form.color === color}
                  aria-label={`Couleur ${FEUTRE_NOMS[i] || color}`}
                  style={{ background: color }}
                  onClick={() => setForm({ ...form, color })}
                />
              ))}
            </div>
          </div>

          {/* Stats de la catégorie si édition */}
          {editingCategory && editingCategory.avg_duration_minutes && (
            <div className="tam-stats">
              <span className="tam-stat">
                <Clock size={14} />
                <span>Durée moyenne: <strong>{editingCategory.avg_duration_minutes} min</strong></span>
              </span>
              {editingCategory.total_tasks_completed > 0 && (
                <span className="tam-stat">
                  <CheckCircle2 size={14} />
                  <span>Tâches complétées: <strong>{editingCategory.total_tasks_completed}</strong></span>
                </span>
              )}
            </div>
          )}

          <div className="tam-pied">
            {editingCategory && (
              <button
                type="button"
                className="tam-btn tam-btn--danger"
                data-confirme={showDeleteConfirm ? 'oui' : undefined}
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 size={14} />
                {showDeleteConfirm ? 'Confirmer' : 'Supprimer'}
              </button>
            )}
            <button type="button" className="tam-btn" onClick={onClose}>Annuler</button>
            <button type="submit" className="tam-btn tam-btn--pleine" disabled={loading}>
              {loading ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
              <span>{editingCategory ? 'Enregistrer' : 'Créer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// FENÊTRE TÂCHE (avec prédictions intégrées)
// ═══════════════════════════════════════════════════════════════════


export function TaskModal({ 
  open, onClose, onSave, loading, editingTask, 
  employees, teams, categories, enterpriseId 
}) {
  const [form, setForm] = useState({
    title: '', description: '', task_type: TASK_TYPE.INDIVIDUAL,
    assigned_employee_id: '', team_id: '', category_id: '',
    priority: TASK_PRIORITY.MEDIUM, difficulty: 'medium',
    due_at: '', expected_duration_minutes: '',
    requires_proof: false, requires_comment: false,
    allow_image: true, allow_document: true, allow_camera_photo: true,
  })
  
  const [durationPrediction, setDurationPrediction] = useState(null)
  const [workloadWarning, setWorkloadWarning] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [loadingPrediction, setLoadingPrediction] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editingTask) {
      setForm({
        title: editingTask.title || '',
        description: editingTask.description || '',
        task_type: editingTask.task_type || TASK_TYPE.INDIVIDUAL,
        assigned_employee_id: editingTask.assigned_employee_id || '',
        team_id: editingTask.team_id || '',
        category_id: editingTask.category_id || '',
        priority: editingTask.priority || TASK_PRIORITY.MEDIUM,
        difficulty: editingTask.difficulty || 'medium',
        due_at: editingTask.due_at ? editingTask.due_at.slice(0, 16) : '',
        expected_duration_minutes: editingTask.expected_duration_minutes || '',
        requires_proof: editingTask.requires_proof || false,
        requires_comment: editingTask.requires_comment || false,
        allow_image: editingTask.allow_image ?? true,
        allow_document: editingTask.allow_document ?? true,
        allow_camera_photo: editingTask.allow_camera_photo ?? true,
      })
    } else {
      setForm({
        title: '', description: '', task_type: TASK_TYPE.INDIVIDUAL,
        assigned_employee_id: '', team_id: '', category_id: '',
        priority: TASK_PRIORITY.MEDIUM, difficulty: 'medium',
        due_at: '', expected_duration_minutes: '',
        requires_proof: false, requires_comment: false,
        allow_image: true, allow_document: true, allow_camera_photo: true,
      })
    }
    setDurationPrediction(null)
    setWorkloadWarning(null)
    setSuggestions(null)
  }, [editingTask, open])

  // Prédiction de durée quand catégorie/employé/difficulté change
  useEffect(() => {
    if (!open || !enterpriseId) return
    if (!form.category_id && !form.assigned_employee_id) return

    const fetchPrediction = async () => {
      setLoadingPrediction(true)
      try {
        const { data } = await predictTaskDuration(enterpriseId, {
          category_id: form.category_id || null,
          employee_id: form.assigned_employee_id || null,
          team_id: form.team_id || null,
          difficulty: form.difficulty
        })
        setDurationPrediction(data)
        
        // Auto-remplir si pas de valeur
        if (data && !form.expected_duration_minutes && !editingTask) {
          setForm(prev => ({ ...prev, expected_duration_minutes: data.predicted_minutes }))
        }
      } catch (err) {
        console.error('Erreur prédiction:', err)
      } finally {
        setLoadingPrediction(false)
      }
    }

    const timeout = setTimeout(fetchPrediction, 500)
    return () => clearTimeout(timeout)
  }, [form.category_id, form.assigned_employee_id, form.difficulty, enterpriseId, open])

  // Vérification de charge quand employé change
  useEffect(() => {
    if (!open || !enterpriseId || !form.assigned_employee_id) {
      setWorkloadWarning(null)
      return
    }

    const checkWorkload = async () => {
      try {
        const { data } = await checkEmployeeWorkload(form.assigned_employee_id, enterpriseId, {
          newTaskDuration: Number(form.expected_duration_minutes) || 30,
          newTaskDueAt: form.due_at || null
        })
        setWorkloadWarning(data)
      } catch (err) {
        console.error('Erreur workload:', err)
      }
    }

    const timeout = setTimeout(checkWorkload, 300)
    return () => clearTimeout(timeout)
  }, [form.assigned_employee_id, form.expected_duration_minutes, form.due_at, enterpriseId, open])

  // Charger les suggestions
  const loadSuggestions = async () => {
    if (!enterpriseId) return
    setLoadingPrediction(true)
    try {
      const { data } = await suggestAssignees(enterpriseId, {
        category_id: form.category_id || null,
        due_at: form.due_at || null,
        priority: form.priority,
        task_type: form.task_type
      })
      setSuggestions(data)
      setShowSuggestions(true)
    } catch (err) {
      console.error('Erreur suggestions:', err)
    } finally {
      setLoadingPrediction(false)
    }
  }

  const applySuggestion = (suggestion) => {
    if (form.task_type === TASK_TYPE.INDIVIDUAL) {
      setForm(prev => ({ ...prev, assigned_employee_id: suggestion.employee_id }))
    } else {
      setForm(prev => ({ ...prev, team_id: suggestion.team_id }))
    }
    setShowSuggestions(false)
  }

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Le titre est requis'); return }
    if (form.task_type === TASK_TYPE.INDIVIDUAL && !form.assigned_employee_id) { 
      toast.error('Choisissez un employé'); return 
    }
    if (form.task_type === TASK_TYPE.TEAM && !form.team_id) { 
      toast.error('Choisissez une équipe'); return 
    }
    
    onSave({
      ...form,
      assigned_employee_id: form.task_type === TASK_TYPE.INDIVIDUAL ? form.assigned_employee_id : null,
      team_id: form.task_type === TASK_TYPE.TEAM ? form.team_id : null,
      category_id: form.category_id || null,
      due_at: form.due_at || null,
      expected_duration_minutes: form.expected_duration_minutes ? Number(form.expected_duration_minutes) : null,
    })
  }

  const exige = form.task_type === TASK_TYPE.INDIVIDUAL

  return (
    <div className="tam-voile" onClick={onClose}>
      <div className="tam-feuille tam-feuille--large" role="dialog" aria-modal="true" aria-label={editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'} onClick={(e) => e.stopPropagation()}>
        <div className="tam-tete">
          <span className="tam-tete-bloc">
            <span className="tam-pucelle">{editingTask ? <Edit3 size={18} /> : <Plus size={18} />}</span>
            <h3 className="tam-titre">{editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}</h3>
          </span>
          <button type="button" className="tam-fermer" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="tam-corps">
          {/* Alerte de charge si warning */}
          {workloadWarning && workloadWarning.severity !== 'ok' && (
            <div className="tam-charge" data-ton={workloadWarning.severity === 'critical' ? 'critique' : 'attention'}>
              <AlertTriangle size={16} className="tam-charge-ico" aria-hidden="true" />
              <span className="tam-charge-corps">
                {workloadWarning.warnings.map((w, i) => (
                  <span className="tam-charge-ligne" key={i}>{w.message}</span>
                ))}
              </span>
            </div>
          )}

          <div className="tam-grille">
            {/* Titre */}
            <div className="tam-champ tam-champ--large">
              <label htmlFor="tam-tache-titre">Titre *</label>
              <input
                id="tam-tache-titre"
                className="tam-saisie"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Vérifier les extincteurs"
              />
            </div>

            {/* Description */}
            <div className="tam-champ tam-champ--large">
              <label htmlFor="tam-tache-description">Description</label>
              <textarea
                id="tam-tache-description"
                className="tam-saisie tam-saisie--longue"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Décrivez la tâche..."
              />
            </div>

            {/* Type de tâche */}
            <div className="tam-champ">
              <label htmlFor="tam-tache-type">Type</label>
              <select
                id="tam-tache-type"
                className="tam-saisie"
                value={form.task_type}
                onChange={(e) => setForm({ ...form, task_type: e.target.value, assigned_employee_id: '', team_id: '' })}
              >
                <option value={TASK_TYPE.INDIVIDUAL}>Individuelle</option>
                <option value={TASK_TYPE.TEAM}>Équipe</option>
              </select>
            </div>

            {/* Assignation avec bouton IA */}
            <div className="tam-champ">
              <label htmlFor="tam-tache-assignation" className="tam-libelle--action">
                {exige ? 'Employé *' : 'Équipe *'}
                <button
                  type="button"
                  className="tam-faisceau"
                  onClick={loadSuggestions}
                  disabled={loadingPrediction}
                >
                  <Lightbulb size={12} />
                  Suggérer
                </button>
              </label>
              {exige ? (
                <select
                  id="tam-tache-assignation"
                  className="tam-saisie"
                  value={form.assigned_employee_id}
                  onChange={(e) => setForm({ ...form, assigned_employee_id: e.target.value })}
                >
                  <option value="">Choisir un employé</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              ) : (
                <select
                  id="tam-tache-assignation"
                  className="tam-saisie"
                  value={form.team_id}
                  onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                >
                  <option value="">Choisir une équipe</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              )}

              {/* Suggestions IA */}
              {showSuggestions && suggestions && (
                <div className="tam-faisceaux" role="group" aria-label="Suggestions d'affectation">
                  <div className="tam-faisceaux-tete">
                    <Sparkles size={14} />
                    <span>Suggestions IA</span>
                    <button type="button" className="tam-fermer tam-fermer--menu" onClick={() => setShowSuggestions(false)} aria-label="Masquer les suggestions">
                      <X size={12} />
                    </button>
                  </div>
                  {suggestions.suggestions?.slice(0, 3).map((s, i) => (
                    <div
                      key={i}
                      className="tam-faisceau-ligne"
                      onClick={() => applySuggestion(s)}
                    >
                      <span className="tam-faisceau-corps">
                        <span className="tam-faisceau-nom">
                          {s.employee_name || s.team_name}
                        </span>
                        <span className="tam-faisceau-score">{s.score}%</span>
                      </span>
                      <span className="tam-motifs">
                        {s.factors?.slice(0, 2).map((f, j) => (
                          <span
                            key={j}
                            className="tam-motif"
                            data-impact={f.impact > 0 ? 'pour' : f.impact < 0 ? 'contre' : 'neutre'}
                          >
                            {f.label}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Catégorie */}
            <div className="tam-champ">
              <label htmlFor="tam-tache-categorie">Catégorie</label>
              <select
                id="tam-tache-categorie"
                className="tam-saisie"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Aucune catégorie</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Priorité */}
            <div className="tam-champ">
              <label htmlFor="tam-tache-priorite">Priorité</label>
              <select
                id="tam-tache-priorite"
                className="tam-saisie"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>
            </div>

            {/* Difficulté */}
            <div className="tam-champ">
              <label htmlFor="tam-tache-difficulte">Difficulté</label>
              <select
                id="tam-tache-difficulte"
                className="tam-saisie"
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              >
                <option value="easy">Facile</option>
                <option value="medium">Moyenne</option>
                <option value="hard">Difficile</option>
                <option value="critical">Critique</option>
              </select>
            </div>

            {/* Deadline */}
            <div className="tam-champ">
              <label htmlFor="tam-tache-echeance">Date limite</label>
              <input
                id="tam-tache-echeance"
                className="tam-saisie"
                type="datetime-local"
                value={form.due_at}
                onChange={(e) => setForm({ ...form, due_at: e.target.value })}
              />
            </div>

            {/* Durée prévue avec prédiction */}
            <div className="tam-champ">
              <label htmlFor="tam-tache-duree" className="tam-libelle--action">
                Durée prévue (min)
                {loadingPrediction && <Loader2 size={12} className="spin" />}
              </label>
              <input
                id="tam-tache-duree"
                className="tam-saisie"
                type="number"
                min="1"
                value={form.expected_duration_minutes}
                onChange={(e) => setForm({ ...form, expected_duration_minutes: e.target.value })}
                placeholder="Ex: 45"
              />
              {durationPrediction && (
                <div className="tam-indice">
                  <Sparkles size={12} />
                  <span>{durationPrediction.message}</span>
                  {durationPrediction.predicted_minutes !== Number(form.expected_duration_minutes) && (
                    <button
                      type="button"
                      className="tam-appliquer"
                      onClick={() => setForm(prev => ({ 
                        ...prev, 
                        expected_duration_minutes: durationPrediction.predicted_minutes 
                      }))}
                    >
                      Appliquer
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Exigences de validation */}
          <div className="tam-exigences">
            <h4 className="tam-exigences-titre">
              <ShieldCheck size={14} />
              <span>Exigences de validation</span>
            </h4>
            <div className="tam-coches">
              {[
                { key: 'requires_proof', label: 'Preuve requise', icon: Camera },
                { key: 'requires_comment', label: 'Commentaire requis', icon: MessageSquare },
                { key: 'allow_image', label: 'Autoriser image', icon: Camera },
                { key: 'allow_document', label: 'Autoriser document', icon: FileText },
                { key: 'allow_camera_photo', label: 'Photo caméra', icon: Camera },
              ].map(({ key, label, icon: Ic }) => (
                <label key={key} className="tam-coche" data-coche={form[key] ? 'oui' : undefined}>
                  <span className="tam-casier" aria-hidden="true">
                    {form[key] && <Check size={12} />}
                  </span>
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    className="tam-case-cachee"
                  />
                  <Ic size={13} className="tam-coche-ico" />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="tam-pied">
            <button type="button" className="tam-btn" onClick={onClose}>Annuler</button>
            <button type="submit" className="tam-btn tam-btn--pleine" disabled={loading}>
              {loading ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
              <span>{editingTask ? 'Enregistrer' : 'Créer la tâche'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// FENÊTRE SUPPRESSION
// ═══════════════════════════════════════════════════════════════════


export function DeleteModal({ open, onClose, onConfirm, title, loading }) {
  if (!open) return null
  return (
    <div className="tam-voile" onClick={onClose}>
      <div className="tam-feuille tam-feuille--petite" role="alertdialog" aria-modal="true" aria-label="Confirmer la suppression" onClick={(e) => e.stopPropagation()}>
        <div className="tam-corps tam-corps--centre">
          <span className="tam-alerte"><AlertTriangle size={26} /></span>
          <h3 className="tam-titre tam-titre--scene">Confirmer la suppression</h3>
          <p className="tam-texte">
            Supprimer <strong>« {title} »</strong> ?
          </p>
          <div className="tam-pied tam-pied--partage">
            <button type="button" className="tam-btn" onClick={onClose} disabled={loading}>Annuler</button>
            <button type="button" className="tam-btn tam-btn--danger" onClick={onConfirm} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// FENÊTRE RACCOURCIS CLAVIER
// ═══════════════════════════════════════════════════════════════════


export function ShortcutsModal({ open, onClose }) {
  if (!open) return null
  const shortcuts = [
    { key: 'N', action: 'Nouvelle tâche' },
    { key: 'C', action: 'Nouvelle catégorie' },
    { key: '/', action: 'Rechercher' },
    { key: 'R', action: 'Rafraîchir' },
    { key: 'G', action: 'Vue grille' },
    { key: 'L', action: 'Vue liste' },
    { key: 'K', action: 'Vue Kanban' },
    { key: 'Esc', action: 'Fermer modal' },
  ]
  return (
    <div className="tam-voile" onClick={onClose}>
      <div className="tam-feuille tam-feuille--petite" role="dialog" aria-modal="true" aria-label="Raccourcis clavier" onClick={(e) => e.stopPropagation()}>
        <div className="tam-tete">
          <h3 className="tam-titre">Raccourcis clavier</h3>
          <button type="button" className="tam-fermer" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="tam-corps">
          {shortcuts.map((s) => (
            <div key={s.key} className="tam-raccourci">
              <kbd>{s.key}</kbd>
              <span>{s.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// FENÊTRE FICHE DE TÂCHE — la page de détail est devenue une fenêtre
// ═══════════════════════════════════════════════════════════════════
//
// Avant, cliquer une carte faisait QUITTER l'onglet : une page entière
// s'ouvrait à l'adresse `/taches/:id`, hors de la peau : 1 655 lignes,
// dont un objet `S` de 699 lignes de CSS écrites en JS et 40
// attributions `style` — 83 valeurs de couleur en dur (dont un or
// F59E0B et cinquante-six `rgba(…)`), un `backdropFilter: blur(6px)` et
// deux ombres floues, rien que C1, C9 et D-016 n'auraient manqué. Elle
// est supprimée, et tout ce qu'elle savait dire entre ici, dans la MÊME
// feuille que les trois autres fenêtres de l'onglet.
//
// Ce qui est gardé, mot pour mot : les huit mesures (échéance, durée
// prédite et réelle, performance, les quatre horodatages), le motif de
// rejet, les pièces jointes, les cinq exigences, les commentaires en
// deux groupes avec leur champ d'ajout, l'historique, et les trois
// gestes d'administrateur — valider, rejeter, réassigner. Ce qui
// change : la couleur, les ombres et les largeurs viennent de la
// feuille, plus du JS. Les squelettes de chargement de la page sont
// tombés avec elle — une fenêtre qui charge dit « Chargement » en une
// ligne, elle ne dessine pas un faux écran derrière.
//
// Les gestes d'écriture restent chez le parent (`TachesVue`) : la fenêtre
// ne parle à aucun service, elle appelle `onValider`, `onRejeter`,
// `onReassigner`, `onCommenter` — comme `TaskModal` appelle `onSave`. La
// fiche est donc la seule fenêtre de l'île à être posée par-dessus le
// tableau SANS se refermer sur soi : après une validation, le parent
// recharge la liste, et la carte change de colonne sous la fenêtre.

// Le ton d'un statut, et le mot à côté. Une teinte seule ne dit rien (C7) :
// le mot est écrit, la couleur le rappelle.
const TON_STATUT = {
  assigned: 'neutre',
  seen: 'neutre',
  in_progress: 'cours',
  paused: 'cours',
  completed: 'cours',
  validated: 'present',
  rejected: 'absent',
  cancelled: 'neutre',
}

// Les cinq exigences, dans l'ordre du formulaire de création : la fiche de
// lecture doit nommer les mêmes cases que la fiche d'écriture.
const EXIGENCES_LUES = [
  { cle: 'requires_proof', libelle: 'Preuve requise', icone: Camera },
  { cle: 'requires_comment', libelle: 'Commentaire requis', icone: MessageSquare },
  { cle: 'allow_image', libelle: 'Image autorisée', icone: ImageIcon },
  { cle: 'allow_document', libelle: 'Document autorisé', icone: FileText },
  { cle: 'allow_camera_photo', libelle: 'Photo caméra', icone: Camera },
]

const TYPE_FICHIER = {
  image: 'Image',
  camera_photo: 'Photo caméra',
  document: 'Document',
}

// le service de réponse « — » quand une durée manque : la fiche le sait, et
// marque le cas comme une ABSENCE — un tiret peint en valeur pleine ferait un
// faux chiffre dans la grille
const dureeLisible = (secondes) => {
  const duree = formatDuration(secondes)
  return duree && duree !== '—' ? duree : null
}

const dateLisible = (valeur) => {
  if (!valeur) return null
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// une note ou un croquis, ça se lit à l'heure près, pas à l'année
const heureLisible = (valeur) => {
  if (!valeur) return null
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function FicheTacheModal({
  open,
  tache = null,
  chargement = false,
  travail = false,
  employes = [],
  onFermer,
  onRafraichir,
  onModifier,
  onValider,
  onRejeter,
  onReassigner,
  onCommenter,
}) {
  const [commentaire, setCommentaire] = useState('')
  const [journalOuvert, setJournalOuvert] = useState(false)
  const [rejetOuvert, setRejetOuvert] = useState(false)
  const [reassignationOuverte, setReassignationOuverte] = useState(false)

  // AUCUN effet de remise à zéro ici, et c'est voulu : le parent pose
  // `key={identifiant}` sur cette fenêtre, qui naît donc NEUVE à chaque
  // tâche ouverte — pas le commentaire de la tâche d'avant, pas la
  // fenêtre de rejet laissée ouverte. (Un `setState` dans un `useEffect`
  // pour vider quatre états est la faute que l'île connaissait déjà.)
  if (!open) return null

  const echeance = tache?.due_at ? getDeadlineStatus(tache.due_at) : null
  const commentaires = tache?.comments || []
  const notesAdmin = commentaires.filter((c) => c.author_type === 'admin')
  const notesEmploye = commentaires.filter((c) => c.author_type !== 'admin')
  const pieces = tache?.attachments || []
  const journal = tache?.activity_logs || []
  const teinte = tache?.category?.color || null
  const aValider = tache?.status === 'completed'
  const rejetee = tache?.status === 'rejected'
  const tonStatut = TON_STATUT[tache?.status] || 'neutre'

  const mesures = [
    { icone: Calendar, cle: 'echeance', label: 'Échéance', valeur: dateLisible(tache?.due_at) },
    { icone: Clock, cle: 'prevue', label: 'Durée prévue', valeur: tache?.expected_duration_minutes ? `${tache.expected_duration_minutes} min` : null },
    { icone: Clock, cle: 'reelle', label: 'Durée réelle', valeur: tache ? dureeLisible(tache.actual_duration_seconds) : null },
    { icone: Zap, cle: 'performance', label: 'Performance', valeur: tache?.performance_score != null ? `${tache.performance_score}%` : null },
    { icone: Eye, cle: 'vue', label: 'Vue le', valeur: dateLisible(tache?.seen_at) },
    { icone: Play, cle: 'demarree', label: 'Démarrée le', valeur: dateLisible(tache?.started_at) },
    { icone: CheckCircle2, cle: 'terminee', label: 'Terminée le', valeur: dateLisible(tache?.completed_at) },
    { icone: Calendar, cle: 'creee', label: 'Créée le', valeur: dateLisible(tache?.created_at) },
  ]

  return (
    <>
      <div className="tam-voile" onClick={onFermer}>
        <div
          className="tam-feuille tam-feuille--large tam-feuille--lecture"
          role="dialog"
          aria-modal="true"
          aria-label={tache ? `Tâche : ${tache.title}` : 'Tâche'}
          /* la teinte de la catégorie est une DONNÉE : seule une variable
             entre en ligne, la feuille en fait le trait. Pas de lavis ici :
             sous cette feuille, il y a des mots à lire partout */
          style={teinte ? { '--tam-teinte': teinte } : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tam-tete">
            <span className="tam-tete-bloc">
              <span className="tam-pucelle"><ClipboardList size={18} /></span>
              <h3 className="tam-titre">{tache?.title || 'Tâche'}</h3>
            </span>
            <span className="tam-tete-actions">
              <button type="button" className="tam-fermer" onClick={onRafraichir} aria-label="Recharger la tâche">
                <RefreshCw size={14} />
              </button>
              <button type="button" className="tam-fermer" onClick={onFermer} aria-label="Fermer">
                <X size={18} />
              </button>
            </span>
          </div>

          <div className="tam-corps">
            {chargement && (
              <p className="tam-vide"><Loader2 size={14} className="spin" /> Chargement de la tâche…</p>
            )}
            {!tache && !chargement && (
              <p className="tam-vide">Rien à montrer : la tâche n’est plus là.</p>
            )}

            {tache && (
              <>
                {/* les marques : quatre mots souligés de leur feutre, pas quatre
                    pastilles pleines — la maison ne met pas de fond sous un mot */}
                <p className="tam-marques" data-ton={tonStatut} data-priorite={tache.priority || 'medium'}>
                  <span className="tam-marque tam-marque--statut">{getStatusLabel(tache.status)}</span>
                  <span className="tam-marque tam-marque--priorite">{getPriorityLabel(tache.priority)}</span>
                  <span className="tam-marque">{tache.task_type === 'team' ? 'Équipe' : 'Individuelle'}</span>
                  {tache.category?.name && (
                    <span className="tam-marque tam-marque--categorie">{tache.category.name}</span>
                  )}
                </p>

                {echeance && echeance.urgency !== 'none' && (
                  <div className="tam-charge" data-ton={echeance.overdue ? 'critique' : 'attention'}>
                    {echeance.overdue
                      ? <AlertTriangle size={16} className="tam-charge-ico" aria-hidden="true" />
                      : <Clock size={16} className="tam-charge-ico" aria-hidden="true" />}
                    <span className="tam-charge-corps">
                      <span className="tam-charge-ligne">{echeance.text}</span>
                    </span>
                  </div>
                )}

                {tache.description && <p className="tam-texte">{tache.description}</p>}

                {/* à qui, et par qui */}
                <div className="tam-attribution">
                  {tache.task_type === 'team' ? (
                    <span className="tam-qui">
                      <span className="tam-qui-ico"><Users size={13} /></span>
                      <span className="tam-qui-nom">{tache.team?.name || 'Équipe'}</span>
                      <span className="tam-qui-role">équipe</span>
                    </span>
                  ) : (
                    <span className="tam-qui">
                      <span className="tam-avatar" aria-hidden="true">
                        {tache.assigned_employee?.photo_url
                          ? <img src={tache.assigned_employee.photo_url} alt="" />
                          : `${tache.assigned_employee?.first_name?.[0] || ''}${tache.assigned_employee?.last_name?.[0] || ''}`.toUpperCase() || '—'}
                      </span>
                      <span className="tam-qui-nom">
                        {tache.assigned_employee
                          ? `${tache.assigned_employee.first_name || ''} ${tache.assigned_employee.last_name || ''}`.trim()
                          : 'Personne non assignée'}
                      </span>
                      {tache.assigned_employee?.position && (
                        <span className="tam-qui-role">{tache.assigned_employee.position}</span>
                      )}
                    </span>
                  )}
                  {tache.created_by_admin && (
                    <span className="tam-qui">
                      <span className="tam-qui-ico"><ShieldCheck size={13} /></span>
                      <span className="tam-qui-role">créée par</span>
                      <span className="tam-qui-nom">
                        {tache.created_by_admin.first_name} {tache.created_by_admin.last_name}
                      </span>
                    </span>
                  )}
                </div>

                <h4 className="tam-section"><ClipboardList size={13} /><span>Informations</span></h4>
                <dl className="tam-mesures">
                  {mesures.map((mesure) => (
                    <div className="tam-mesure" key={mesure.cle}>
                      <dt className="tam-mesure-cle">
                        <mesure.icone size={12} aria-hidden="true" />
                        <span>{mesure.label}</span>
                      </dt>
                      <dd className={`tam-mesure-valeur${mesure.valeur ? '' : ' tam-mesure-valeur--absente'}`}>
                        {mesure.valeur || '—'}
                      </dd>
                    </div>
                  ))}
                </dl>

                {tache.rejection_reason && (
                  <div className="tam-charge" data-ton="critique">
                    <XCircle size={16} className="tam-charge-ico" aria-hidden="true" />
                    <span className="tam-charge-corps">
                      <span className="tam-charge-ligne">Rejetée : {tache.rejection_reason}</span>
                    </span>
                  </div>
                )}

                <h4 className="tam-section">
                  <Paperclip size={13} />
                  <span>Pièces jointes{pieces.length ? ` (${pieces.length})` : ''}</span>
                </h4>
                {pieces.length ? (
                  <ul className="tam-pieces">
                    {pieces.map((fichier) => (
                      <li key={fichier.id}>
                        <a className="tam-piece" href={fichier.file_url} target="_blank" rel="noreferrer">
                          <span className="tam-piece-ico" aria-hidden="true">
                            {fichier.file_type === 'image' && <ImageIcon size={14} />}
                            {fichier.file_type === 'camera_photo' && <Camera size={14} />}
                            {fichier.file_type === 'document' && <FileText size={14} />}
                            {!TYPE_FICHIER[fichier.file_type] && <Paperclip size={14} />}
                          </span>
                          <span className="tam-piece-corps">
                            <span className="tam-piece-nom">{fichier.file_name || 'Fichier'}</span>
                            <span className="tam-piece-note">
                              {TYPE_FICHIER[fichier.file_type] || fichier.file_type}
                              {' · '}{heureLisible(fichier.uploaded_at) || 'sans date'}
                            </span>
                          </span>
                          {/* le geste est ÉCRIT, pas seulement dessiné : une
                              icône de téléchargement seule ne dit pas ce qui
                              s'ouvre, et un mot caché à la main n'est pas la
                              maison */}
                          <span className="tam-piece-ouvrir">
                            <Download size={12} aria-hidden="true" />
                            <span>Ouvrir</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tam-vide">Aucune pièce jointe.</p>
                )}

                <h4 className="tam-section"><Flag size={13} /><span>Exigences</span></h4>
                <div className="tam-stats">
                  {EXIGENCES_LUES.map((exigence) => (
                    <span className="tam-stat" key={exigence.cle}>
                      <exigence.icone size={14} aria-hidden="true" />
                      <span>
                        {exigence.libelle} : <strong>{tache[exigence.cle] ? 'oui' : 'non'}</strong>
                      </span>
                    </span>
                  ))}
                </div>

                <h4 className="tam-section">
                  <MessageSquare size={13} />
                  <span>Commentaires{commentaires.length ? ` (${commentaires.length})` : ''}</span>
                </h4>
                <NotesTache Groupe="Commentaires admin" notes={notesAdmin} auteur="admin" vide="Aucun commentaire admin." />
                <NotesTache Groupe="Commentaires employé" notes={notesEmploye} auteur="employe" vide="Aucun commentaire employé." />

                <div className="tam-champ">
                  <label htmlFor="tam-fiche-commentaire">Ajouter un commentaire</label>
                  <textarea
                    id="tam-fiche-commentaire"
                    className="tam-saisie tam-saisie--longue"
                    rows={2}
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    placeholder="Ce que la personne doit savoir…"
                  />
                  <span className="tam-envoyer">
                    <button
                      type="button"
                      className="tam-btn"
                      disabled={travail || !commentaire.trim()}
                      onClick={() => onCommenter(commentaire.trim())}
                    >
                      {travail ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
                      <span>Envoyer</span>
                    </button>
                  </span>
                </div>

                <h4 className="tam-section">
                  <button
                    type="button"
                    className="tam-repli"
                    aria-expanded={journalOuvert}
                    onClick={() => setJournalOuvert((v) => !v)}
                  >
                    <History size={13} />
                    <span>Historique{journal.length ? ` (${journal.length})` : ''}</span>
                    <ChevronDown size={13} data-ouvert={journalOuvert ? 'oui' : undefined} />
                  </button>
                </h4>
                {journalOuvert && (
                  journal.length ? (
                    <ol className="tam-journal">
                      {journal.map((ligne) => (
                        <li className="tam-journal-ligne" key={ligne.id}>
                          <span className="tam-journal-point" aria-hidden="true" />
                          <span className="tam-journal-corps">
                            <span className="tam-journal-action">{ligne.action}</span>
                            <span className="tam-journal-note">
                              {ligne.actor_type === 'employee' ? 'l’employé' : ligne.actor_type === 'admin' ? 'l’administrateur' : ligne.actor_type}
                              {' · '}{heureLisible(ligne.created_at) || 'sans date'}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="tam-vide">Aucune activité enregistrée.</p>
                  )
                )}
              </>
            )}
          </div>

          {tache && (
            <div className="tam-pied">
              <button
                type="button"
                className={`tam-btn${aValider || rejetee ? '' : ' tam-btn--pleine'}`}
                onClick={() => onModifier(tache)}
              >
                <Pencil size={14} />
                <span>Modifier</span>
              </button>
              {aValider && (
                <>
                  <button type="button" className="tam-btn tam-btn--danger" onClick={() => setRejetOuvert(true)} disabled={travail}>
                    <XCircle size={14} />
                    <span>Rejeter</span>
                  </button>
                  <button type="button" className="tam-btn tam-btn--pleine" onClick={onValider} disabled={travail}>
                    {travail ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                    <span>Valider</span>
                  </button>
                </>
              )}
              {rejetee && (
                <button type="button" className="tam-btn tam-btn--pleine" onClick={() => setReassignationOuverte(true)} disabled={travail}>
                  <TimerReset size={14} />
                  <span>Réassigner</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* les deux fenêtres de geste, posées PAR-DESSUS la fiche : mêmes
          classes, même voile, et le clic sur leur fond ne ferme QUE elles */}
      {rejetOuvert && (
        <FenetreRejet
          travail={travail}
          onFermer={() => setRejetOuvert(false)}
          onConfirmer={(motif) => { setRejetOuvert(false); onRejeter(motif) }}
        />
      )}
      {reassignationOuverte && (
        <FenetreReassignation
          travail={travail}
          employes={employes}
          onFermer={() => setReassignationOuverte(false)}
          onConfirmer={(payload) => { setReassignationOuverte(false); onReassigner(payload) }}
        />
      )}
    </>
  )
}

// un groupe de notes : le mot de l'auteur porte la couleur, jamais l'inverse
function NotesTache({ Groupe, notes, auteur, vide }) {
  return (
    <div className="tam-notes-bloc">
      <p className="tam-notes-titre">{Groupe}</p>
      {notes.length ? (
        <ul className="tam-notes">
          {notes.map((note) => (
            <li className="tam-note" data-auteur={auteur} key={note.id}>
              <span className="tam-note-tete">
                <span className="tam-note-auteur">{auteur === 'admin' ? 'Admin' : 'Employé'}</span>
                <span className="tam-note-date">{heureLisible(note.created_at) || 'sans date'}</span>
              </span>
              <span className="tam-note-texte">{note.comment}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tam-vide">{vide}</p>
      )}
    </div>
  )
}

// la voile d'une fenêtre fille : le clic doit fermer la fille, pas la mère
const dessusVoile = (onFermer) => (e) => {
  e.stopPropagation()
  if (e.target === e.currentTarget) onFermer()
}

// posée par le père seulement quand elle est ouverte : elle se démonte, donc
// son motif s'efface sans effet à poser
function FenetreRejet({ travail, onFermer, onConfirmer }) {
  const [motif, setMotif] = useState('')

  return (
    <div className="tam-voile" onClick={dessusVoile(onFermer)}>
      <div className="tam-feuille" role="dialog" aria-modal="true" aria-label="Rejeter la tâche" onClick={(e) => e.stopPropagation()}>
        <div className="tam-tete">
          <span className="tam-tete-bloc">
            <span className="tam-pucelle"><XCircle size={18} /></span>
            <h3 className="tam-titre">Rejeter la tâche</h3>
          </span>
          <button type="button" className="tam-fermer" onClick={onFermer} aria-label="Fermer"><X size={18} /></button>
        </div>
        <form className="tam-corps" onSubmit={(e) => { e.preventDefault(); if (motif.trim()) onConfirmer(motif.trim()) }}>
          <div className="tam-champ">
            <label htmlFor="tam-rejet-motif">Motif du rejet *</label>
            <textarea
              id="tam-rejet-motif"
              className="tam-saisie tam-saisie--longue"
              rows={4}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Expliquez pourquoi la tâche est rejetée…"
            />
          </div>
          <div className="tam-pied">
            <button type="button" className="tam-btn" onClick={onFermer} disabled={travail}>Annuler</button>
            <button type="submit" className="tam-btn tam-btn--danger" disabled={travail || !motif.trim()}>
              {travail ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />}
              <span>Rejeter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FenetreReassignation({ travail, employes, onFermer, onConfirmer }) {
  const [employeId, setEmployeId] = useState('')
  const [echeance, setEcheance] = useState('')
  const [motif, setMotif] = useState('')

  return (
    <div className="tam-voile" onClick={dessusVoile(onFermer)}>
      <div className="tam-feuille" role="dialog" aria-modal="true" aria-label="Réassigner la tâche" onClick={(e) => e.stopPropagation()}>
        <div className="tam-tete">
          <span className="tam-tete-bloc">
            <span className="tam-pucelle"><TimerReset size={18} /></span>
            <h3 className="tam-titre">Réassigner la tâche</h3>
          </span>
          <button type="button" className="tam-fermer" onClick={onFermer} aria-label="Fermer"><X size={18} /></button>
        </div>
        <form className="tam-corps" onSubmit={(e) => {
          e.preventDefault()
          onConfirmer({
            new_employee_id: employeId || null,
            new_due_at: echeance || null,
            comment: motif || null,
          })
        }}>
          <div className="tam-champ">
            <label htmlFor="tam-reassign-employe">Nouvel employé</label>
            <select id="tam-reassign-employe" className="tam-saisie" value={employeId} onChange={(e) => setEmployeId(e.target.value)}>
              <option value="">Garder l’employé actuel</option>
              {employes.map((e) => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
              ))}
            </select>
          </div>
          <div className="tam-champ">
            <label htmlFor="tam-reassign-echeance">Nouvelle échéance</label>
            <input id="tam-reassign-echeance" className="tam-saisie" type="datetime-local" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
          </div>
          <div className="tam-champ">
            <label htmlFor="tam-reassign-motif">Commentaire admin</label>
            <textarea id="tam-reassign-motif" className="tam-saisie tam-saisie--longue" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Message de réassignation…" />
          </div>
          <div className="tam-pied">
            <button type="button" className="tam-btn" onClick={onFermer} disabled={travail}>Annuler</button>
            <button type="submit" className="tam-btn tam-btn--pleine" disabled={travail}>
              {travail ? <Loader2 size={14} className="spin" /> : <TimerReset size={14} />}
              <span>Réassigner</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
