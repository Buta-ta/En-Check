// ═══════════════════════════════════════════════════════════
// 🧩 TÂCHES — FENÊTRES DE TRAVAIL, en post-it (22/11/2026)
//
// Une tâche (avec durée prédite, charge de la personne et
// suggestions), une catégorie, une suppression à confirmer, les
// raccourcis. Partagées par la vue « Tâches » de la page Employés :
// aucune coque d'écran ici, uniquement le travail — et la MÊME peau
// que les fenêtres des Équipes : `TachesModales.css`, posée sur la
// classe `tam-voile`.
//
// Jumelles strictes de `EquipesModales.jsx` : mêmes classes de
// coque (`tam-` au lieu de `eqm-`), mêmes largeurs au registre, même
// feuille (coin carré, contour d'encre de 2 px, bande de colle,
// rabat, double feutre en deux ombres dures). Ce qui change, c'est
// le contenu : la fenêtre de tâche est la seule à deux colonnes,
// donc elle prend la largeur MAXIMALE du registre — 760 px.
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
import { Plus, X, Loader2, Edit3, Trash2, Clock, AlertTriangle, CheckCircle2, Camera, FileText, MessageSquare, ShieldCheck, Sparkles, Tag, Check, Lightbulb } from 'lucide-react'
import toast from 'react-hot-toast'

import {
  predictTaskDuration, checkEmployeeWorkload, suggestAssignees,
  TASK_PRIORITY, TASK_TYPE,
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
