// ════════════════════════════════════════════════════════════════
// ✅ VUE « TÂCHES » — page Employés
//
// Le travail se lit en trois plans, comme dans la maquette :
//
//   1. quatre chiffres comptés sur les tâches chargées ;
//   2. une barre d'outils (recherche, état, priorité, tri,
//      « + Nouvelle tâche » doré) et les catégories en pastilles ;
//   3. un tableau à quatre colonnes — à faire, en cours, terminées,
//      validées — où chaque tâche est une carte : titre, priorité,
//      échéance, personne. Glisser une carte d'une colonne à
//      l'autre change son statut, pas son apparence.
//
// Peau « post-it » du 21/11 (maquette `onglet-taches-postit.png`, choix du
// fondateur) : la rangée de chiffres, les quatre colonnes et les cartes sont
// des FEUILLES cerclées d'encre, bande de colle en tête, rabat plié pour les
// cartes. L'action principale est en espresso, plus en or. Les règles de la
// peau vivent dans TachesVue.css sous `.tqv2--postit` : l'annuaire
// (`.emp-vues`, `.empv3-*`) n'est pas touché d'un octet.
//
// Mêmes tokens, même police, même thème que le reste de la page.
// Les fenêtres (tâche, catégorie, suppression) sont partagées :
// voir TachesModales.jsx.
// ════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronDown,
  Clock3, HelpCircle, Info, ListTodo, Loader2, Pencil, Plus,
  RefreshCw, Search, Sparkles, Tag, Trash2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import './TachesVue.css'

import FeatureService, { FEATURES } from '../../services/featureService'
import {
  getTasks, createTask, updateTask, deleteTask,
  getTaskCategories, createTaskCategory, updateTaskCategory, deleteTaskCategory,
  getStatusLabel, getPriorityLabel, getDeadlineStatus, getTaskAlerts,
} from '../../services/taskService'
import { getTeams } from '../../services/teamService'
import {
  CategoryModal, TaskModal, DeleteModal, ShortcutsModal,
} from './TachesModales'
import '../../pages/EmployesRefonte.css'

const COLONNES = [
  { cle: 'a-faire', titre: 'À faire', sous: 'pas encore commencées', statuts: ['assigned', 'seen'], cible: 'assigned', ton: 'teal' },
  { cle: 'en-cours', titre: 'En cours', sous: 'entre les mains', statuts: ['in_progress', 'paused'], cible: 'in_progress', ton: 'or' },
  { cle: 'terminees', titre: 'Terminées', sous: 'à valider', statuts: ['completed'], cible: 'completed', ton: 'vert' },
  { cle: 'validees', titre: 'Validées', sous: 'closes', statuts: ['validated'], cible: 'validated', ton: 'blanc' },
]

const FILTRES_STATUT = [
  { key: '', label: 'Tous les états' },
  { key: 'assigned', label: 'À faire' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'completed', label: 'Terminées' },
  { key: 'validated', label: 'Validées' },
]

const FILTRES_PRIORITE = [
  { key: '', label: 'Toutes priorités' },
  { key: 'critical', label: 'Critiques' },
  { key: 'high', label: 'Hautes' },
  { key: 'medium', label: 'Moyennes' },
  { key: 'low', label: 'Basses' },
]

const TRIS = [
  { key: 'due_asc', label: 'Échéance la plus proche' },
  { key: 'created_desc', label: 'Plus récentes' },
  { key: 'created_asc', label: 'Plus anciennes' },
  { key: 'priority_desc', label: 'Priorité la plus haute' },
  { key: 'title_asc', label: 'Titre (A → Z)' },
]

// Le ton de la pastille, clé par clé de priorité du service.
const TON_PRIORITE = {
  critical: 'critique',
  high: 'haute',
  medium: 'moyenne',
  low: 'basse',
}

const initiales = (personne) =>
  `${personne?.first_name?.[0] || ''}${personne?.last_name?.[0] || ''}`.toUpperCase()

const nomComplet = (personne) =>
  [personne?.first_name, personne?.last_name].filter(Boolean).join(' ') || 'Personne non assignée'

const dateCourte = (valeur) => {
  if (!valeur) return null
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const joursRestants = (valeur) => {
  if (!valeur) return null
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return null
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ── la personne, en pastille et en nom ────────────────────────────
function Personne({ personne, equipe }) {
  if (!personne) return <span className="tqv2-personne-none">Non assignée</span>
  return (
    <span className="tqv2-personne">
      <span className="tqv2-avatar" aria-hidden="true">
        {personne.photo_url ? <img src={personne.photo_url} alt="" /> : initiales(personne)}
      </span>
      <span className="tqv2-personne-nom">
        {nomComplet(personne)}
        {equipe ? <small> · {equipe}</small> : ''}
      </span>
    </span>
  )
}

// ── la carte de tâche ─────────────────────────────────────────────
function CarteTache({ tache, selection, equipe, onBasculer, onOuvrir, onModifier, onSupprimer }) {
  const echeance = tache.due_at ? getDeadlineStatus(tache.due_at) : null
  const jours = joursRestants(tache?.due_at)
  const retard = Boolean(echeance?.overdue)
  const ton = TON_PRIORITE[tache.priority] || 'moyenne'

  return (
    <article
      className="tqv2-fiche"
      data-priorite={tache.priority || 'medium'}
      data-selection={selection ? 'oui' : 'non'}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/tache', tache.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="tqv2-fiche-tete">
        <button type="button" className="tqv2-fiche-titre" onClick={() => onOuvrir(tache.id)}>
          {tache.title}
        </button>
        <button
          type="button"
          className="tqv2-case"
          aria-pressed={selection}
          aria-label={selection ? 'Retirer de la sélection' : 'Sélectionner la tâche'}
          onClick={() => onBasculer(tache.id)}
        >
          <Check size={11} />
        </button>
      </div>

      <div className="tqv2-fiche-meta">
        <span className={`tqv2-priorite tqv2-priorite--${ton}`}>
          {getPriorityLabel(tache.priority)}
        </span>
        {tache.due_at && (
          <span className={`tqv2-fiche-date${retard ? ' tqv2-fiche-date--retard' : ''}`}>
            <CalendarDays size={12} aria-hidden="true" />
            <span>{dateCourte(tache.due_at)}</span>
            {retard && jours !== null && (
              <strong className="tqv2-retard">retard de {Math.abs(jours)} j</strong>
            )}
          </span>
        )}
      </div>

      <div className="tqv2-fiche-pied">
        <Personne personne={tache.assigned_employee} equipe={tache.team?.name} />
        <span className="tqv2-fiche-actions">
          <button type="button" className="tqv2-action" onClick={() => onModifier(tache)} aria-label={`Modifier ${tache.title}`}>
            <Pencil size={11} />
          </button>
          <button type="button" className="tqv2-action" onClick={() => onSupprimer(tache)} aria-label={`Supprimer ${tache.title}`}>
            <Trash2 size={11} />
          </button>
        </span>
      </div>
    </article>
  )
}

export default function TachesVue({ enterpriseId: enterpriseIdProp, employes = [], signalCreation = 0 }) {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState(null)
  const [enterpriseId, setEnterpriseId] = useState(enterpriseIdProp || null)
  const [raison, setRaison] = useState('ok')
  const [predictions, setPredictions] = useState(false)

  const [taches, setTaches] = useState([])
  const [equipes, setEquipes] = useState([])
  const [categories, setCategories] = useState([])
  const [alertes, setAlertes] = useState([])

  const [chargement, setChargement] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [montrerAlertes, setMontrerAlertes] = useState(false)

  const [recherche, setRecherche] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('')
  const [filtrePriorite, setFiltrePriorite] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [tri, setTri] = useState('due_asc')
  const [selection, setSelection] = useState([])
  const [colonneSurvolee, setColonneSurvolee] = useState(null)

  const [tacheEditee, setTacheEditee] = useState(null)
  const [categorieEditee, setCategorieEditee] = useState(null)
  const [aSupprimer, setASupprimer] = useState(null)

  const [montrerTache, setMontrerTache] = useState(false)
  const [montrerCategorie, setMontrerCategorie] = useState(false)
  const [montrerSuppression, setMontrerSuppression] = useState(false)
  const [montrerRaccourcis, setMontrerRaccourcis] = useState(false)

  const rechercheRef = useRef(null)

  const charger = useCallback(async (eid) => {
    if (!eid) return
    setChargement(true)
    try {
      const [reponseTaches, reponseEquipes, reponseCategories] = await Promise.all([
        getTasks(eid, { limit: 200 }),
        getTeams(eid),
        getTaskCategories(eid),
      ])
      if (reponseTaches.error) throw reponseTaches.error
      setTaches(reponseTaches.data || [])
      setEquipes(reponseEquipes.data || [])
      setCategories(reponseCategories.data || [])

      if (await FeatureService.hasFeature(eid, FEATURES.PREDICTIONS)) {
        setPredictions(true)
        const { data } = await getTaskAlerts(eid)
        setAlertes(data || [])
      } else {
        setPredictions(false)
        setAlertes([])
      }
    } catch (erreur) {
      console.error('Chargement des tâches :', erreur)
      toast.error('Impossible de charger les tâches')
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
    let annule = false
    const demarrer = async () => {
      const donnees = JSON.parse(localStorage.getItem('admin') || '{}')
      if (annule) return
      setAdmin(donnees)
      const eid = enterpriseIdProp || donnees.selectedEnterprise?.id || donnees.enterprise_id || null
      setEnterpriseId(eid)
      if (!eid) {
        setChargement(false)
        setRaison('sansEntreprise')
        return
      }
      const autorise = donnees.role === 'super_admin'
        || await FeatureService.hasFeature(eid, FEATURES.GESTION_TACHES)
      if (annule) return
      if (!autorise) {
        setRaison('sansOption')
        setChargement(false)
        return
      }
      setRaison('ok')
      await charger(eid)
    }
    demarrer()
    return () => { annule = true }
  }, [enterpriseIdProp, charger])

  const ouvrirNouvelleTache = useCallback(() => {
    setTacheEditee(null)
    setMontrerTache(true)
  }, [])

  const ouvrirNouvelleCategorie = useCallback(() => {
    setCategorieEditee(null)
    setMontrerCategorie(true)
  }, [])

  // Le bouton « Nouvelle tâche » vit dans la ligne de titre de la
  // page : le signal monte, la vue ouvre sa fenêtre.
  useEffect(() => {
    if (signalCreation > 0) {
      setTacheEditee(null)
      setMontrerTache(true)
    }
  }, [signalCreation])

  useEffect(() => {
    const surTouche = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); ouvrirNouvelleTache(); break
        case '/': e.preventDefault(); rechercheRef.current?.focus(); break
        case 'r': e.preventDefault(); charger(enterpriseId); break
        case 'escape':
          setMontrerTache(false); setMontrerCategorie(false)
          setMontrerSuppression(false); setMontrerRaccourcis(false)
          break
        case '?': e.preventDefault(); setMontrerRaccourcis(true); break
        default: break
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [charger, ouvrirNouvelleTache, enterpriseId])

  const enregistrerTache = useCallback(async (formulaire) => {
    setEnregistrement(true)
    try {
      if (tacheEditee) {
        const { error } = await updateTask(tacheEditee.id, formulaire, admin?.id)
        if (error) throw error
        toast.success('Tâche modifiée')
      } else {
        const { error } = await createTask({ ...formulaire, enterprise_id: enterpriseId }, admin?.id)
        if (error) throw error
        toast.success('Tâche créée')
      }
      setMontrerTache(false)
      await charger(enterpriseId)
    } catch (erreur) {
      toast.error(erreur.message || 'Enregistrement impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [tacheEditee, admin, enterpriseId, charger])

  const confirmerSuppression = useCallback(async () => {
    if (!aSupprimer) return
    setEnregistrement(true)
    try {
      const { success, error } = await deleteTask(aSupprimer.id, admin?.id)
      if (!success) throw error
      toast.success('Tâche supprimée')
      setASupprimer(null)
      setMontrerSuppression(false)
      await charger(enterpriseId)
    } catch (erreur) {
      toast.error(erreur.message || 'Suppression impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [aSupprimer, admin, charger])

  const enregistrerCategorie = useCallback(async (formulaire, identifiant) => {
    setEnregistrement(true)
    try {
      if (identifiant) {
        const { error } = await updateTaskCategory(identifiant, formulaire)
        if (error) throw error
        toast.success('Catégorie modifiée')
      } else {
        const { error } = await createTaskCategory({ ...formulaire, enterprise_id: enterpriseId }, admin?.id)
        if (error) throw error
        toast.success('Catégorie créée')
      }
      setMontrerCategorie(false)
      await charger(enterpriseId)
    } catch (erreur) {
      toast.error(erreur.message || 'Enregistrement impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [admin, enterpriseId, charger])

  const supprimerCategorie = useCallback(async (identifiant) => {
    setEnregistrement(true)
    try {
      const { success, error } = await deleteTaskCategory(identifiant, admin?.id)
      if (!success) throw error
      toast.success('Catégorie supprimée')
      setMontrerCategorie(false)
      if (filtreCategorie === identifiant) setFiltreCategorie('')
      await charger(enterpriseId)
    } catch (erreur) {
      toast.error(erreur.message || 'Suppression impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [admin, filtreCategorie, charger])

  const changerStatut = useCallback(async (idTache, statut) => {
    const tache = taches.find((t) => t.id === idTache)
    if (!tache || tache.status === statut) return
    setEnregistrement(true)
    try {
      await updateTask(idTache, { status: statut }, admin?.id)
      toast.success(`Statut : ${getStatusLabel(statut).toLowerCase()}`)
      await charger(enterpriseId)
    } catch {
      toast.error('Changement de statut impossible')
    } finally {
      setEnregistrement(false)
      setColonneSurvolee(null)
    }
  }, [taches, admin, charger])

  const basculerSelection = useCallback((idTache) => {
    setSelection((precedent) => precedent.includes(idTache)
      ? precedent.filter((id) => id !== idTache)
      : [...precedent, idTache])
  }, [])

  const supprimerSelection = useCallback(async () => {
    if (selection.length === 0) return
    if (!window.confirm(`Supprimer ${selection.length} tâche${selection.length > 1 ? 's' : ''} ?`)) return
    setEnregistrement(true)
    try {
      for (const id of selection) await deleteTask(id, admin?.id)
      toast.success(`${selection.length} tâche${selection.length > 1 ? 's supprimées' : ' supprimée'}`)
      setSelection([])
      await charger(enterpriseId)
    } catch {
      toast.error('Suppression impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [selection, admin, charger])

  const tachesFiltrees = useMemo(() => {
    let liste = [...taches]
    if (recherche.trim()) {
      const terme = recherche.trim().toLowerCase()
      liste = liste.filter((t) =>
        t.title?.toLowerCase().includes(terme) || t.description?.toLowerCase().includes(terme))
    }
    if (filtreStatut) liste = liste.filter((t) => t.status === filtreStatut)
    if (filtrePriorite) liste = liste.filter((t) => t.priority === filtrePriorite)
    if (filtreCategorie) liste = liste.filter((t) => t.category_id === filtreCategorie)

    const ordrePriorite = { critical: 0, high: 1, medium: 2, low: 3 }
    liste.sort((a, b) => {
      switch (tri) {
        case 'due_asc': {
          if (!a.due_at) return 1
          if (!b.due_at) return -1
          return new Date(a.due_at) - new Date(b.due_at)
        }
        case 'created_asc': return new Date(a.created_at || 0) - new Date(b.created_at || 0)
        case 'priority_desc': return (ordrePriorite[a.priority] ?? 2) - (ordrePriorite[b.priority] ?? 2)
        case 'title_asc': return (a.title || '').localeCompare(b.title || '')
        default: return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      }
    })
    return liste
  }, [taches, recherche, filtreStatut, filtrePriorite, filtreCategorie, tri])

  const parStatut = useMemo(() => {
    const groupes = {}
    for (const colonne of COLONNES) groupes[colonne.cle] = []
    for (const tache of tachesFiltrees) {
      const colonne = COLONNES.find((c) => c.statuts.includes(tache.status))
      if (colonne) groupes[colonne.cle].push(tache)
    }
    return groupes
  }, [tachesFiltrees])

  const horsCircuit = useMemo(
    () => tachesFiltrees.filter((t) => !COLONNES.some((c) => c.statuts.includes(t.status))).length,
    [tachesFiltrees],
  )

  const chiffres = useMemo(() => ({
    total: taches.length,
    aFaire: taches.filter((t) => ['assigned', 'seen'].includes(t.status)).length,
    enCours: taches.filter((t) => ['in_progress', 'paused'].includes(t.status)).length,
    retard: taches.filter((t) => getDeadlineStatus(t.due_at).overdue).length,
    terminees: taches.filter((t) => ['completed', 'validated'].includes(t.status)).length,
  }), [taches])

  const compteParCategorie = useMemo(() => {
    const compte = {}
    for (const tache of taches) {
      if (!tache.category_id) continue
      compte[tache.category_id] = (compte[tache.category_id] || 0) + 1
    }
    return compte
  }, [taches])

  if (raison === 'sansEntreprise') {
    return (
      <div className="emp-vues tqv2 tqv2--postit">
        <div className="tqv2-vide">
          <h3>Sélectionnez une entreprise</h3>
          <p>
            Les tâches se lisent entreprise par entreprise. Choisissez-la dans
            la sidebar, puis revenez sur cet onglet.
          </p>
        </div>
      </div>
    )
  }

  if (raison === 'sansOption') {
    return (
      <div className="emp-vues tqv2 tqv2--postit">
        <div className="tqv2-vide">
          <h3>Option Équipes et tâches non activée</h3>
          <p>
            Cette entreprise n’a pas l’option Équipes et tâches. Un administrateur
            peut l’allumer depuis la fiche de l’entreprise ; l’annuaire reste
            disponible en attendant.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="emp-vues tqv2 tqv2--postit">
      {/* la tête de l'onglet : le titre et les quatre chiffres, cerclés d'UNE
          SEULE bande de bogolan — le dispositif de la fiche employé, pas trois
          galons. Le chiffre se lit sur la plaque de papier : le tissu ne passe
          jamais sous un mot (refus enregistré sur la page). */}
      <header className="tqv2-tete">
        <h3 className="tqv2-titre">Tâches</h3>

        <div className="tqv2-kpis" aria-label="Chiffres des tâches">
          <div className="empv2-kpi">
            <div className="empv2-kpi-haut">
              <strong>{chiffres.total}</strong>
              <ListTodo size={15} aria-hidden="true" />
            </div>
            <span className="empv2-kpi-libelle">Tâches</span>
          </div>
          <div className="empv2-kpi">
            <div className="empv2-kpi-haut">
              <strong>{chiffres.enCours}</strong>
              <Clock3 size={15} aria-hidden="true" />
            </div>
            <span className="empv2-kpi-libelle">En cours</span>
          </div>
          <div className="empv2-kpi">
            <div className="empv2-kpi-haut">
              <strong>{chiffres.retard}</strong>
              <AlertTriangle size={15} aria-hidden="true" />
            </div>
            <span className="empv2-kpi-libelle"><i className={`empv2-point ${chiffres.retard > 0 ? 'empv2-point--orange' : 'empv2-point--or'}`} aria-hidden="true" />En retard</span>
          </div>
          <div className="empv2-kpi">
            <div className="empv2-kpi-haut">
              <strong>{chiffres.terminees}</strong>
              <CheckCircle2 size={15} aria-hidden="true" />
            </div>
            <span className="empv2-kpi-libelle">Terminées</span>
          </div>
        </div>
      </header>

      {/* la barre d'outils : chercher, filtrer, trier, créer */}
      <div className="tqv2-outils">
        <label className="empv2-recherche tqv2-recherche">
          <Search size={14} />
          <input
            ref={rechercheRef}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une tâche..."
            aria-label="Rechercher une tâche"
          />
          {recherche && (
            <button type="button" className="empv2-recherche-effacer" onClick={() => setRecherche('')} aria-label="Effacer la recherche">
              <X size={12} />
            </button>
          )}
        </label>

        <select className="tqv2-select" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label="Filtrer par état">
          {FILTRES_STATUT.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select className="tqv2-select" value={filtrePriorite} onChange={(e) => setFiltrePriorite(e.target.value)} aria-label="Filtrer par priorité">
          {FILTRES_PRIORITE.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select className="tqv2-select" value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier les tâches">
          {TRIS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        <span className="tqv2-actions">
          <button type="button" className="empv2-lien" onClick={() => charger(enterpriseId)} title="Rafraîchir (R)">
            <RefreshCw size={12} /> Rafraîchir
          </button>
          <button
            type="button"
            className="empv2-lien"
            onClick={() => setMontrerRaccourcis(true)}
            aria-label="Raccourcis clavier"
            title="Raccourcis (?)"
          >
            <HelpCircle size={13} />
          </button>
          <button type="button" className="empv2-lien" onClick={ouvrirNouvelleCategorie}>
            <Tag size={12} /> Catégorie
          </button>
          <button type="button" className="empv2-nouvel" onClick={ouvrirNouvelleTache}>
            <Plus size={14} /> Nouvelle tâche
          </button>
        </span>
      </div>

      {/* les catégories en pastilles, quand il y en a */}
      {categories.length > 0 && (
        <div className="tqv2-categories" role="group" aria-label="Catégories de tâches">
          <p className="tqv2-categories-titre">Catégories</p>
          {categories.map((categorie) => (
            <span key={categorie.id} className="tqv2-categorie-groupe">
              <button
                type="button"
                className="tqv2-categorie"
                style={{ '--tqv2-pastille': categorie.color || undefined }}
                aria-pressed={filtreCategorie === categorie.id}
                onClick={() => setFiltreCategorie(filtreCategorie === categorie.id ? '' : categorie.id)}
              >
                <i className="tqv2-pastille" aria-hidden="true" />
                {categorie.name}
                <span className="tqv2-categorie-nombre">{compteParCategorie[categorie.id] || 0}</span>
              </button>
              <button
                type="button"
                className="tqv2-action"
                aria-label={`Modifier la catégorie ${categorie.name}`}
                onClick={() => { setCategorieEditee(categorie); setMontrerCategorie(true) }}
              >
                <Pencil size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {selection.length > 0 && (
        <div className="tqv2-selection">
          <span>{selection.length} tâche{selection.length > 1 ? 's' : ''} sélectionnée{selection.length > 1 ? 's' : ''}</span>
          <div className="tqv2-selection-actions">
            <button type="button" className="empv2-lien" onClick={() => setSelection([])}>
              <X size={12} /> Vider la sélection
            </button>
            <button type="button" className="empv2-lien" onClick={supprimerSelection} disabled={enregistrement}>
              <Trash2 size={12} /> Supprimer
            </button>
          </div>
        </div>
      )}

      {chargement ? (
        <div className="tqv2-chargement" aria-live="polite">
          <span className="tqv2-chargement-texte"><Loader2 size={14} className="tqv2-tourne" /> Chargement des tâches…</span>
        </div>
      ) : tachesFiltrees.length === 0 ? (
        <div className="tqv2-vide">
          <h3>{taches.length === 0 ? 'Aucune tâche pour l’instant' : 'Aucune tâche ne correspond'}</h3>
          <p>
            {taches.length === 0
              ? 'Une tâche, c’est une personne, une échéance et une preuve si besoin. Créez la première : elle apparaîtra dans la colonne « À faire ».'
              : 'Élargissez la recherche ou retirez un filtre pour revoir toutes les tâches.'}
          </p>
          <button type="button" className="empv2-nouvel" onClick={ouvrirNouvelleTache}>
            <Plus size={14} /> Nouvelle tâche
          </button>
        </div>
      ) : (
        <div className="tqv2-colonnes">
          {COLONNES.map((colonne) => (
            <section
              key={colonne.cle}
              className="tqv2-colonne"
              data-colonne={colonne.cle}
              data-ton={colonne.ton}
              data-survol={colonneSurvolee === colonne.cle ? 'oui' : 'non'}
              onDragOver={(e) => { e.preventDefault(); setColonneSurvolee(colonne.cle) }}
              onDragLeave={() => setColonneSurvolee((actuelle) => (actuelle === colonne.cle ? null : actuelle))}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/tache')
                if (id) changerStatut(id, colonne.cible)
              }}
            >
              <header className="tqv2-colonne-tete">
                <h4 className="tqv2-colonne-titre">{colonne.titre}</h4>
                <span className="tqv2-colonne-compte">{parStatut[colonne.cle].length}</span>
              </header>

              <div className="tqv2-colonne-corps">
                {parStatut[colonne.cle].map((tache) => (
                  <CarteTache
                    key={tache.id}
                    tache={tache}
                    selection={selection.includes(tache.id)}
                    equipe={tache.team?.name}
                    onBasculer={basculerSelection}
                    onOuvrir={(id) => navigate(`/taches/${id}`)}
                    onModifier={(t) => { setTacheEditee(t); setMontrerTache(true) }}
                    onSupprimer={(t) => { setASupprimer(t); setMontrerSuppression(true) }}
                  />
                ))}

                {parStatut[colonne.cle].length === 0 && (
                  <div className="tqv2-colonne-vide">Rien ici.</div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {horsCircuit > 0 && (
        <p className="tqv2-note">
          <Info size={14} />
          <span>
            {horsCircuit} tâche{horsCircuit > 1 ? 's' : ''} refusée{horsCircuit > 1 ? 's' : ''} ou annulée{horsCircuit > 1 ? 's' : ''}
            {' '}ne figure{horsCircuit > 1 ? 'nt' : ''} pas au tableau.
          </span>
        </p>
      )}

      {/* le pied : ce qui demande un regard, replié par défaut */}
      <footer className="empv2-pied">
        <div className="empv2-pied-ligne">
          <p className="empv2-pied-titre">
            À décider
            <span className="empv2-pied-texte">
              {!predictions
                ? 'Les analyses de tâches ne sont pas activées : aucune alerte calculée.'
                : alertes.length === 0
                  ? 'Rien à signaler : aucune échéance ne dérape.'
                  : `${alertes.length} point${alertes.length > 1 ? 's' : ''} à regarder`}
            </span>
          </p>
          {predictions && alertes.length > 0 && (
            <button
              type="button"
              className="empv2-lien"
              aria-expanded={montrerAlertes}
              onClick={() => setMontrerAlertes((v) => !v)}
            >
              <Sparkles size={12} /> {montrerAlertes ? 'Refermer' : 'Ouvrir'}
              <ChevronDown size={13} style={{ transform: montrerAlertes ? 'rotate(180deg)' : 'none' }} />
            </button>
          )}
        </div>

        {predictions && montrerAlertes && alertes.length > 0 && (
          <div className="empv2-pied-liste">
            {alertes.map((a) => (
              <div key={a.id} className="empv2-pied-item" data-grave={a.severity === 'critical' ? 'oui' : 'non'}>
                <div>
                  <p className="empv2-pied-item-titre">
                    {a.severity === 'critical' && <AlertTriangle size={11} style={{ marginRight: 6 }} />}
                    {a.task_title || 'Tâche'}
                  </p>
                  <p className="empv2-pied-item-note">{a.message}</p>
                </div>
                {a.task_id && (
                  <div className="empv2-pied-item-actions">
                    <button type="button" className="empv2-lien" onClick={() => navigate(`/taches/${a.task_id}`)}>
                      Ouvrir la tâche
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </footer>

      <TaskModal
        open={montrerTache}
        onClose={() => setMontrerTache(false)}
        onSave={enregistrerTache}
        loading={enregistrement}
        editingTask={tacheEditee}
        employees={employes}
        teams={equipes}
        categories={categories}
        enterpriseId={enterpriseId}
      />
      <CategoryModal
        open={montrerCategorie}
        onClose={() => setMontrerCategorie(false)}
        onSave={enregistrerCategorie}
        onDelete={supprimerCategorie}
        loading={enregistrement}
        editingCategory={categorieEditee}
        categories={categories}
      />
      <DeleteModal
        open={montrerSuppression}
        onClose={() => setMontrerSuppression(false)}
        onConfirm={confirmerSuppression}
        title={aSupprimer?.title || ''}
        loading={enregistrement}
      />
      <ShortcutsModal open={montrerRaccourcis} onClose={() => setMontrerRaccourcis(false)} />
    </div>
  )
}
