// ════════════════════════════════════════════════════════════════════
// ✅ VUE « TÂCHES » — page Employés, le registre perlé
//
// Le travail se lit comme un registre de maison ouvert sur quatre
// colonnes : à faire, en cours, terminées, validées. Chaque colonne a
// sa tranche perlée ; chaque tâche est une entrée, pas une carte :
// une perle de priorité, un numéro, un titre serif, une échéance
// dessinée en collier.
//
// On déplace une entrée d'une tranche à l'autre pour changer son état.
// La vue Liste donne la même matière à plat, pour balayer et cocher.
//
// Les fenêtres (tâche, catégorie, suppression) sont partagées : voir
// TachesModales.jsx ; les dessins perlés : PerlesZoulouSvg.jsx.
// ════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Check, ChevronDown, HelpCircle, Info,
  Loader2, Pencil, Plus, RefreshCw, Search, Sparkles, Tag, Trash2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

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
import { CollierEcheanceSvg, RosacePerlesSvg } from '../zoulou/PerlesZoulouSvg'
import '../zoulou/zoulou.css'

const COLONNES = [
  { cle: 'a-faire', titre: 'À faire', sous: 'pas encore commencées', statuts: ['assigned', 'seen'], cible: 'assigned', ton: 'teal' },
  { cle: 'en-cours', titre: 'En cours', sous: 'entre les mains', statuts: ['in_progress', 'paused'], cible: 'in_progress', ton: 'cuivre' },
  { cle: 'terminees', titre: 'Terminées', sous: 'à valider', statuts: ['completed'], cible: 'completed', ton: 'sauge' },
  { cle: 'validees', titre: 'Validées', sous: 'closes', statuts: ['validated'], cible: 'validated', ton: 'creme' },
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

// ── le folio ───────────────────────────────────────────────────────
function Folio({ droite }) {
  return (
    <div className="rg-folio">
      <p className="rg-marque"><strong>En-Check</strong> · Gestion du personnel</p>
      <p className="rg-folio-droite">{droite}</p>
    </div>
  )
}

// ── le colophon : quatre chiffres, un filet entre chacun ───────────
function Colophon({ chiffres }) {
  return (
    <dl className="rg-colophon">
      {chiffres.map(({ valeur, libelle, note, ton }) => (
        <div className="rg-chiffre" key={libelle} data-ton={ton || 'normal'}>
          <dd className="rg-chiffre-valeur">{valeur}</dd>
          <dt className="rg-chiffre-libelle">{libelle}</dt>
          <dd className="rg-chiffre-note">{note}</dd>
        </div>
      ))}
    </dl>
  )
}

// ── l'échéance, dessinée : une perle par jour qui reste ────────────
function Echeance({ tache, compact = false }) {
  const echeance = getDeadlineStatus(tache?.due_at)
  const jours = joursRestants(tache?.due_at)
  if (!tache?.due_at || jours === null) return null
  const retard = Boolean(echeance?.overdue)
  return (
    <span
      className="rg-echeance rg-echeance-collier"
      data-ton={retard ? 'retard' : 'normal'}
      title={`Échéance : ${dateCourte(tache.due_at)}`}
    >
      <CollierEcheanceSvg jours={jours} enRetard={retard} />
      {!compact && (
        <span>
          {retard
            ? <>retard de {Math.abs(jours)} j</>
            : jours === 0
              ? 'aujourd’hui'
              : <>{jours} j restant{jours > 1 ? 's' : ''}</>}
        </span>
      )}
    </span>
  )
}

// ── la personne, en pastille et en nom ────────────────────────────
function Personne({ personne }) {
  if (!personne) return <span className="rg-personne">Non assignée</span>
  return (
    <span className="rg-personne">
      <span className="rg-membre" title={nomComplet(personne)} aria-hidden="true">
        {personne.photo_url ? <img src={personne.photo_url} alt="" /> : initiales(personne)}
      </span>
      {nomComplet(personne)}
    </span>
  )
}

// ── une entrée de tâche ───────────────────────────────────────────
function FicheTache({ tache, numero, selection, onBasculer, onOuvrir, onModifier, onSupprimer }) {
  const categorie = tache.category
  const retour = tache.status === 'rejected' || tache.status === 'cancelled'
  return (
    <article
      className="rg-fiche"
      data-priorite={tache.priority || 'medium'}
      data-selection={selection ? 'oui' : 'non'}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/tache', tache.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="rg-fiche-tete">
        <span className="rg-fiche-perle" aria-hidden="true" />
        <span className="rg-fiche-num">{String(numero).padStart(2, '0')}</span>
        <button type="button" className="rg-fiche-titre" onClick={() => onOuvrir(tache.id)}>
          {tache.title}
        </button>
        <button
          type="button"
          className="rg-case"
          aria-pressed={selection}
          aria-label={selection ? 'Retirer de la sélection' : 'Sélectionner la tâche'}
          onClick={() => onBasculer(tache.id)}
        >
          <Check size={11} />
        </button>
      </div>

      <div className="rg-fiche-meta">
        {retour
          ? <strong>{getStatusLabel(tache.status)}</strong>
          : <strong style={{ color: 'var(--rg-soft)' }}>{getPriorityLabel(tache.priority)}</strong>}
        {categorie && (
          <>
            <span data-sep aria-hidden="true">·</span>
            <span>{categorie.name}</span>
          </>
        )}
        <span data-sep aria-hidden="true">·</span>
        <Echeance tache={tache} />
      </div>

      <div className="rg-fiche-pied">
        <Personne personne={tache.assigned_employee} />
        <span className="rg-fiche-actions">
          <button type="button" className="rg-lien" onClick={() => onModifier(tache)}>
            <Pencil size={10} /> Modifier
          </button>
          <button
            type="button"
            className="rg-lien"
            onClick={() => onSupprimer(tache)}
            aria-label={`Supprimer ${tache.title}`}
          >
            <Trash2 size={11} />
          </button>
        </span>
      </div>
    </article>
  )
}

export default function TachesVue({ enterpriseId: enterpriseIdProp, employes = [] }) {
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
  const [vue, setVue] = useState('tableau')
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

  const pourcent = (morceau, total) => (total > 0 ? `${Math.round((morceau / total) * 100)} %` : '—')

  // Le numéro d'une tâche : son rang dans l'ordre du registre complet.
  const numeroDe = useCallback(
    (tache) => taches.findIndex((t) => t.id === tache.id) + 1,
    [taches],
  )

  if (raison === 'sansEntreprise') {
    return (
      <div className="emp-vues">
        <div className="rg-vide">
          <RosacePerlesSvg taille={52} ton="teal" />
          <h3>Sélectionnez une entreprise</h3>
          <p>
            Les tâches se lisent entreprise par entreprise. Choisissez-la dans
            l’en-tête de la page, puis revenez sur cet onglet.
          </p>
        </div>
      </div>
    )
  }

  if (raison === 'sansOption') {
    return (
      <div className="emp-vues">
        <div className="rg-vide">
          <RosacePerlesSvg taille={52} ton="cuivre" />
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
    <div className="emp-vues rg-taches">
      <Folio droite="Registre des tâches" />

      <header className="rg-tete">
        <div>
          <p className="rg-eyebrow">Le travail en cours</p>
          <h2 className="rg-titre">Tâches<span>.</span></h2>
        </div>
        <Colophon
          chiffres={[
            {
              valeur: chiffres.total,
              libelle: 'Tâches',
              note: chiffres.total > 0
                ? `dont ${chiffres.aFaire} jamais ouvertes`
                : 'aucune pour l’instant',
            },
            {
              valeur: chiffres.enCours,
              libelle: 'En cours',
              note: `${pourcent(chiffres.enCours, chiffres.total)} du registre`,
            },
            {
              valeur: chiffres.retard,
              libelle: 'En retard',
              note: `${pourcent(chiffres.retard, chiffres.total)} du registre`,
              ton: chiffres.retard > 0 ? 'corail' : 'normal',
            },
            {
              valeur: chiffres.terminees,
              libelle: 'Terminées',
              note: `${pourcent(chiffres.terminees, chiffres.total)} du registre`,
            },
          ]}
        />
      </header>

      <div className="rg-outils">
        <label className="rg-recherche">
          <Search size={14} />
          <input
            ref={rechercheRef}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une tâche"
            aria-label="Rechercher une tâche"
          />
          {recherche && (
            <button type="button" className="rg-recherche-effacer" onClick={() => setRecherche('')} aria-label="Effacer la recherche">
              <X size={12} />
            </button>
          )}
        </label>

        <select className="rg-tri" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label="Filtrer par état">
          {FILTRES_STATUT.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select className="rg-tri" value={filtrePriorite} onChange={(e) => setFiltrePriorite(e.target.value)} aria-label="Filtrer par priorité">
          {FILTRES_PRIORITE.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select className="rg-tri" value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier les tâches">
          {TRIS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        <div className="rg-filtres" role="group" aria-label="Mode d’affichage">
          <button type="button" className="rg-filtre" aria-pressed={vue === 'tableau'} onClick={() => setVue('tableau')}>
            Tableau
          </button>
          <button type="button" className="rg-filtre" aria-pressed={vue === 'liste'} onClick={() => setVue('liste')}>
            Liste
          </button>
        </div>

        <div className="rg-actions">
          <button type="button" className="rg-lien" onClick={() => charger(enterpriseId)} title="Rafraîchir (R)">
            <RefreshCw size={12} /> Rafraîchir
          </button>
          <button
            type="button"
            className="rg-lien"
            onClick={() => setMontrerRaccourcis(true)}
            aria-label="Raccourcis clavier"
            title="Raccourcis (?)"
          >
            <HelpCircle size={13} />
          </button>
          <button type="button" className="rg-lien" onClick={ouvrirNouvelleCategorie}>
            <Tag size={12} /> Catégorie
          </button>
          <button type="button" className="rg-primaire" onClick={ouvrirNouvelleTache}>
            <Plus size={14} /> Nouvelle tâche
          </button>
        </div>
      </div>

      <div className="rg-categories" role="group" aria-label="Catégories de tâches">
        <p className="rg-categories-titre">Catégories</p>
        {categories.length === 0 && (
          <span className="rg-categorie-nombre">aucune catégorie pour l’instant</span>
        )}
        {categories.map((categorie) => (
          <span key={categorie.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className="rg-categorie"
              style={{ '--rg-pastille': categorie.color || undefined }}
              aria-pressed={filtreCategorie === categorie.id}
              onClick={() => setFiltreCategorie(filtreCategorie === categorie.id ? '' : categorie.id)}
            >
              {categorie.name}
              <span className="rg-categorie-nombre">{compteParCategorie[categorie.id] || 0}</span>
            </button>
            <button
              type="button"
              className="rg-lien"
              style={{ minHeight: 32, padding: 0 }}
              aria-label={`Modifier la catégorie ${categorie.name}`}
              onClick={() => { setCategorieEditee(categorie); setMontrerCategorie(true) }}
            >
              <Pencil size={11} />
            </button>
          </span>
        ))}
        <button type="button" className="rg-lien" onClick={ouvrirNouvelleCategorie}>
          <Plus size={12} /> Nouvelle catégorie
        </button>
      </div>

      {selection.length > 0 && (
        <div className="rg-selection">
          <span>{selection.length} tâche{selection.length > 1 ? 's' : ''} sélectionnée{selection.length > 1 ? 's' : ''}</span>
          <div className="rg-selection-actions">
            <button type="button" className="rg-lien" onClick={() => setSelection([])}>
              <X size={12} /> Vider la sélection
            </button>
            <button type="button" className="rg-lien" onClick={supprimerSelection} disabled={enregistrement}>
              <Trash2 size={12} /> Supprimer
            </button>
          </div>
        </div>
      )}

      {chargement ? (
        <div className="rg-chargement" aria-live="polite">
          <span className="rg-chargement-texte"><Loader2 size={14} className="rg-tourne" /> Chargement des tâches…</span>
          <div className="rg-chargement-ligne" />
          <div className="rg-chargement-ligne" />
          <div className="rg-chargement-ligne" />
        </div>
      ) : tachesFiltrees.length === 0 ? (
        <div className="rg-vide">
          <RosacePerlesSvg taille={52} ton={taches.length === 0 ? 'cuivre' : 'teal'} />
          <h3>{taches.length === 0 ? 'Aucune tâche pour l’instant' : 'Aucune tâche ne correspond'}</h3>
          <p>
            {taches.length === 0
              ? 'Une tâche, c’est une personne, une échéance et une preuve si besoin. Créez la première : elle apparaîtra dans la colonne « À faire ».'
              : 'Élargissez la recherche ou retirez un filtre pour revoir toutes les tâches.'}
          </p>
          <button type="button" className="rg-primaire" onClick={ouvrirNouvelleTache}>
            <Plus size={14} /> Nouvelle tâche
          </button>
        </div>
      ) : vue === 'tableau' ? (
        <div className="rg-colonnes">
          {COLONNES.map((colonne) => (
            <section
              key={colonne.cle}
              className="rg-colonne"
              data-colonne={colonne.cle}
              data-survol={colonneSurvolee === colonne.cle ? 'oui' : 'non'}
              onDragOver={(e) => { e.preventDefault(); setColonneSurvolee(colonne.cle) }}
              onDragLeave={() => setColonneSurvolee((actuelle) => (actuelle === colonne.cle ? null : actuelle))}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/tache')
                if (id) changerStatut(id, colonne.cible)
              }}
            >
              <header className="rg-colonne-tete">
                <h4 className="rg-colonne-titre">{colonne.titre}</h4>
                <span className="rg-colonne-compte">{parStatut[colonne.cle].length}</span>
                <p className="rg-colonne-sous">{colonne.sous}</p>
              </header>

              <div className="rg-colonne-corps">
                {parStatut[colonne.cle].map((tache) => (
                  <FicheTache
                    key={tache.id}
                    tache={tache}
                    numero={numeroDe(tache)}
                    selection={selection.includes(tache.id)}
                    onBasculer={basculerSelection}
                    onOuvrir={(id) => navigate(`/taches/${id}`)}
                    onModifier={(t) => { setTacheEditee(t); setMontrerTache(true) }}
                    onSupprimer={(t) => { setASupprimer(t); setMontrerSuppression(true) }}
                  />
                ))}

                {parStatut[colonne.cle].length === 0 && (
                  <div className="rg-colonne-vide">
                    <RosacePerlesSvg taille={38} ton={colonne.ton} />
                    <span>Rien ici.</span>
                    <span>{colonne.sous}</span>
                  </div>
                )}

                <button type="button" className="rg-ajouter" onClick={ouvrirNouvelleTache}>
                  <Plus size={11} /> ajouter une tâche
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rg-liste">
          {tachesFiltrees.map((tache) => (
            <div key={tache.id} className="rg-ligne" data-selection={selection.includes(tache.id) ? 'oui' : 'non'}>
              <button
                type="button"
                className="rg-case"
                aria-pressed={selection.includes(tache.id)}
                aria-label={selection.includes(tache.id) ? 'Retirer de la sélection' : 'Sélectionner la tâche'}
                onClick={() => basculerSelection(tache.id)}
              >
                <Check size={11} />
              </button>

              <div style={{ minWidth: 0 }}>
                <p className="rg-ligne-nom">{tache.title}</p>
                <p className="rg-ligne-note">
                  {getStatusLabel(tache.status)}
                  {tache.team?.name ? ` · ${tache.team.name}` : ''}
                  {tache.category?.name ? ` · ${tache.category.name}` : ''}
                </p>
              </div>

              <Personne personne={tache.assigned_employee} />
              <Echeance tache={tache} />

              <span className="rg-fiche-actions">
                <button type="button" className="rg-lien" onClick={() => navigate(`/taches/${tache.id}`)}>
                  Ouvrir
                </button>
                <button
                  type="button"
                  className="rg-lien"
                  onClick={() => { setTacheEditee(tache); setMontrerTache(true) }}
                  aria-label={`Modifier ${tache.title}`}
                >
                  <Pencil size={11} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {vue === 'tableau' && horsCircuit > 0 && (
        <p className="rg-note">
          <Info size={14} />
          <span>
            {horsCircuit} tâche{horsCircuit > 1 ? 's' : ''} refusée{horsCircuit > 1 ? 's' : ''} ou annulée{horsCircuit > 1 ? 's' : ''}
            {' '}ne figure{horsCircuit > 1 ? 'nt' : ''} pas au tableau : passez en liste pour les revoir.
          </span>
        </p>
      )}

      <footer className="rg-pied">
        <div className="rg-pied-ligne">
          <p className="rg-pied-titre">
            À décider
            <span className="rg-pied-texte">
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
              className="rg-lien"
              aria-expanded={montrerAlertes}
              onClick={() => setMontrerAlertes((v) => !v)}
            >
              <Sparkles size={12} /> {montrerAlertes ? 'Refermer' : 'Ouvrir le registre'}
              <ChevronDown size={13} style={{ transform: montrerAlertes ? 'rotate(180deg)' : 'none' }} />
            </button>
          )}
        </div>

        {predictions && montrerAlertes && alertes.length > 0 && (
          <div className="rg-pied-liste">
            {alertes.map((a) => (
              <div key={a.id} className="rg-pied-item" data-grave={a.severity === 'critical' ? 'oui' : 'non'}>
                <div>
                  <p className="rg-pied-item-titre">
                    {a.severity === 'critical' && <AlertTriangle size={11} style={{ marginRight: 6 }} />}
                    {a.task_title || 'Tâche'}
                  </p>
                  <p className="rg-pied-item-note">{a.message}</p>
                </div>
                {a.task_id && (
                  <div className="rg-pied-item-actions">
                    <button type="button" className="rg-lien" onClick={() => navigate(`/taches/${a.task_id}`)}>
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
