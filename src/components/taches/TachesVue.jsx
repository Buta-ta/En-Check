// ════════════════════════════════════════════════════════════════════
// ✅ VUE « TÂCHES » — page Employés, motif perles zoulou
//
// Le travail se lit sur un métier à perles : quatre colonnes, un fil
// de couleur par priorité, et l'on déplace une carte d'une colonne à
// l'autre pour changer son état — comme on fait glisser une perle sur
// son fil.
//
// Deux présentations :
//   • Tableau — colonnes et glisser-déposer (le geste du quotidien) ;
//   • Liste   — une ligne par tâche, pour balayer et cocher.
//
// Les fenêtres (tâche, catégorie, suppression) sont partagées :
// voir TachesModales.jsx.
// ════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Check, ChevronDown, ClipboardList, HelpCircle, Info, LayoutList,
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
import {
  AnneauPerlesSvg, CollierEcheanceSvg, FrisePerlesSvg,
  LosangePerlesSvg, RosacePerlesSvg,
} from '../zoulou/PerlesZoulouSvg'
import '../zoulou/zoulou.css'

const COLONNES = [
  { cle: 'a-faire', titre: 'À faire', statuts: ['assigned', 'seen'], cible: 'assigned', perle: 'teal' },
  { cle: 'en-cours', titre: 'En cours', statuts: ['in_progress', 'paused'], cible: 'in_progress', perle: 'cuivre' },
  { cle: 'terminees', titre: 'Terminées', statuts: ['completed'], cible: 'completed', perle: 'sauge' },
  { cle: 'validees', titre: 'Validées', statuts: ['validated'], cible: 'validated', perle: 'creme' },
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

const part = (morceau, total, perles = 26) => {
  if (!total || total <= 0) return 0
  return Math.round((Math.max(0, morceau) / total) * perles)
}

const dateCourte = (valeur) => {
  if (!valeur) return null
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

/**
 * L'échéance, dessinée : un collier d'une perle par jour qui reste.
 * Le texte reste là pour la lecture précise, mais le regard sait
 * combien il reste de temps avant même de lire le chiffre.
 */
function EtiquetteEcheance({ tache }) {
  const echeance = getDeadlineStatus(tache?.due_at)
  if (!tache?.due_at) return null
  const ton = echeance.overdue ? 'retard' : echeance.urgency === 'critical' || echeance.urgency === 'high' ? 'bientot' : 'normal'
  const jours = Math.ceil((new Date(tache.due_at) - new Date()) / (1000 * 60 * 60 * 24))
  return (
    <span className="zl-echeance" data-ton={ton} title={`Échéance : ${dateCourte(tache.due_at)}`}>
      <CollierEcheanceSvg
        jours={jours}
        enRetard={echeance.overdue}
        className="zl-echeance-collier"
      />
      <span className="zl-echeance-texte">
        {echeance.overdue ? <AlertTriangle size={10} /> : null}
        {echeance.text} · {dateCourte(tache.due_at)}
      </span>
    </span>
  )
}

function PastillePersonne({ personne, chef = false }) {
  if (!personne) return <span className="zl-compte">Non assignée</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className={`zl-perle-avatar${chef ? ' is-chef' : ''}`} title={nomComplet(personne)}>
        {personne.photo_url ? <img src={personne.photo_url} alt="" /> : initiales(personne)}
      </span>
      <span style={{ fontSize: 11.5 }}>{nomComplet(personne)}</span>
    </span>
  )
}

function CarteTache({ tache, onOuvrir, onModifier, onSupprimer, selection, onBasculer, onGlisser }) {
  const categorie = tache.category
  return (
    <article
      className="zl-carte-tache"
      data-priorite={tache.priority || 'medium'}
      data-selection={selection ? 'oui' : 'non'}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/tache', tache.id)
        e.dataTransfer.effectAllowed = 'move'
        onGlisser?.(tache.id)
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <button
          type="button"
          className="zl-carte-tache-titre"
          onClick={() => onOuvrir(tache.id)}
        >
          {tache.title}
        </button>
        <button
          type="button"
          className="zl-case"
          aria-pressed={selection}
          aria-label={selection ? 'Retirer de la sélection' : 'Sélectionner la tâche'}
          onClick={() => onBasculer(tache.id)}
        >
          <Check size={12} />
        </button>
      </div>

      <div className="zl-carte-tache-meta">
        <span className="zl-etiquette" data-ton={tache.priority === 'critical' || tache.priority === 'high' ? 'retard' : 'normal'}>
          {getPriorityLabel(tache.priority)}
        </span>
        {categorie && (
          <span className="zl-etiquette">
            <span className="zl-pastille" style={{ width: 7, height: 7, boxShadow: 'none', background: categorie.color || 'var(--zl-perle-cuivre)' }} aria-hidden="true" />
            {categorie.name}
          </span>
        )}
        <EtiquetteEcheance tache={tache} />
      </div>

      <div className="zl-carte-tache-meta" style={{ justifyContent: 'space-between' }}>
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <PastillePersonne personne={tache.assigned_employee} />
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="zl-menage" onClick={() => onModifier(tache)} aria-label={`Modifier ${tache.title}`}>
            <Pencil size={12} />
          </button>
          <button type="button" className="zl-menage" onClick={() => onSupprimer(tache)} aria-label={`Supprimer ${tache.title}`}>
            <Trash2 size={12} />
          </button>
        </div>
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

  if (raison === 'sansEntreprise') {
    return (
      <div className="emp-vues">
        <div className="zl-vide">
          <RosacePerlesSvg taille={76} ton="teal" />
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
        <div className="zl-vide">
          <RosacePerlesSvg taille={76} ton="cuivre" />
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
    <div className="emp-vues zl-taches">
      {/* ══ LA SCÈNE : la frise, le titre, les actions ══ */}
      <section className="zl-scene" aria-label="Vue Tâches">
        <div className="zl-scene-frise">
          <FrisePerlesSvg hauteur={46} motif="zigzag" />
        </div>

        <div className="zl-scene-corps">
          <div className="zl-scene-texte">
            <p className="zl-eyebrow">
              <LosangePerlesSvg taille={16} ton="corail" />
              Le travail en cours
            </p>
            <h2 className="zl-scene-titre">Tâches<span>.</span></h2>
            <p className="zl-scene-sous">
              <span><strong>{chiffres.total}</strong> tâche{chiffres.total > 1 ? 's' : ''}</span>
              <span className="zl-sep" aria-hidden="true" />
              <span><strong>{chiffres.enCours}</strong> en cours</span>
              <span className="zl-sep" aria-hidden="true" />
              <span><strong>{chiffres.retard}</strong> en retard</span>
              <span className="zl-sep" aria-hidden="true" />
              <span><strong>{chiffres.terminees}</strong> terminée{chiffres.terminees > 1 ? 's' : ''}</span>
            </p>
          </div>
          <div className="zl-scene-actions">
            <div className="zl-scene-utilitaires">
              <button type="button" className="zl-bouton zl-bouton-icone" onClick={() => charger(enterpriseId)}
                aria-label="Rafraîchir les tâches" title="Rafraîchir (R)">
                <RefreshCw size={15} />
              </button>
              <button type="button" className="zl-bouton zl-bouton-icone"
                onClick={() => setMontrerRaccourcis(true)} aria-label="Raccourcis clavier" title="Raccourcis (?)">
                <HelpCircle size={15} />
              </button>
            </div>
            <button type="button" className="zl-bouton" onClick={ouvrirNouvelleCategorie}>
              <Tag size={14} /> Nouvelle catégorie
            </button>
            <button type="button" className="zl-bouton zl-bouton-principal" onClick={ouvrirNouvelleTache}>
              <Plus size={15} /> Nouvelle tâche
            </button>
          </div>
        </div>

        {/* ══ LES MÉDAILLONS : la part de chaque état ══ */}
        <div className="zl-medaillons">
          <div className="zl-medaillon">
            <span className="zl-medaillon-rond">
              <AnneauPerlesSvg taille={62} parts={26} remplis={part(chiffres.aFaire, chiffres.total, 26)} ton="teal" />
              <span className="zl-medaillon-cle">{chiffres.aFaire}</span>
            </span>
            <span className="zl-medaillon-texte">
              <span className="zl-medaillon-libelle">À faire</span>
              <span className="zl-medaillon-note">
                {chiffres.total > 0 ? `${Math.round((chiffres.aFaire / chiffres.total) * 100)} % du total` : '—'}
              </span>
            </span>
          </div>

          <div className="zl-medaillon">
            <span className="zl-medaillon-rond">
              <AnneauPerlesSvg taille={62} parts={26} remplis={part(chiffres.enCours, chiffres.total, 26)} ton="cuivre" />
              <span className="zl-medaillon-cle">{chiffres.enCours}</span>
            </span>
            <span className="zl-medaillon-texte">
              <span className="zl-medaillon-libelle">En cours</span>
              <span className="zl-medaillon-note">
                {chiffres.total > 0 ? `${Math.round((chiffres.enCours / chiffres.total) * 100)} % du total` : '—'}
              </span>
            </span>
          </div>

          <div className="zl-medaillon">
            <span className="zl-medaillon-rond">
              <AnneauPerlesSvg taille={62} parts={26} remplis={part(chiffres.retard, chiffres.total, 26)} ton="corail" />
              <span className="zl-medaillon-cle">{chiffres.retard}</span>
            </span>
            <span className="zl-medaillon-texte">
              <span className="zl-medaillon-libelle">En retard</span>
              <span className="zl-medaillon-note" data-ton={chiffres.retard > 0 ? 'alerte' : 'ok'}>
                {chiffres.total > 0 ? `${Math.round((chiffres.retard / chiffres.total) * 100)} % du total` : '—'}
              </span>
            </span>
          </div>

          <div className="zl-medaillon">
            <span className="zl-medaillon-rond">
              <AnneauPerlesSvg taille={62} parts={26} remplis={part(chiffres.terminees, chiffres.total, 26)} ton="sauge" />
              <span className="zl-medaillon-cle">{chiffres.terminees}</span>
            </span>
            <span className="zl-medaillon-texte">
              <span className="zl-medaillon-libelle">Terminées</span>
              <span className="zl-medaillon-note">
                {chiffres.total > 0
                  ? `${Math.round((chiffres.terminees / chiffres.total) * 100)} % du total`
                  : '—'}
              </span>
            </span>
          </div>
        </div>
      </section>

      
      {predictions && alertes.length > 0 && (
        <section className="zl-collier" aria-label="Tâches à surveiller">
          <header className="zl-collier-tete">
            <h3 className="zl-collier-titre"><Sparkles size={13} /> À surveiller</h3>
            <button type="button" className="zl-mini" onClick={() => setMontrerAlertes((v) => !v)} aria-expanded={montrerAlertes}>
              <AlertTriangle size={12} /> {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
              <ChevronDown size={12} style={{ transform: montrerAlertes ? 'rotate(180deg)' : 'none' }} />
            </button>
          </header>
          {montrerAlertes && (
            <div className="zl-collier-liste" style={{ padding: 12, maxHeight: 220 }}>
              {alertes.map((a) => (
                <div key={a.id} className="zl-collier-item" data-grave={a.severity === 'critical' ? 'oui' : 'non'}>
                  <div className="zl-collier-item-texte">
                    <p className="zl-collier-item-titre">{a.task_title || 'Tâche'}</p>
                    <p className="zl-collier-item-note">{a.message}</p>
                  </div>
                  {a.task_id && (
                    <button type="button" className="zl-mini" onClick={() => navigate(`/taches/${a.task_id}`)}>
                      Ouvrir
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {categories.length > 0 && (
        <div className="zl-categories" role="group" aria-label="Catégories de tâches">
          <p className="zl-categories-titre">Catégories</p>
          {categories.map((categorie) => (
            <span key={categorie.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <button
                type="button"
                className="zl-puce"
                aria-pressed={filtreCategorie === categorie.id}
                onClick={() => setFiltreCategorie(filtreCategorie === categorie.id ? '' : categorie.id)}
              >
                <span className="zl-pastille" style={{ width: 8, height: 8, boxShadow: 'none', background: categorie.color || 'var(--zl-perle-cuivre)' }} aria-hidden="true" />
                {categorie.name}
                <span className="zl-compte">{compteParCategorie[categorie.id] || 0}</span>
              </button>
              <button
                type="button"
                className="zl-menage"
                style={{ marginLeft: 4 }}
                aria-label={`Modifier la catégorie ${categorie.name}`}
                onClick={() => { setCategorieEditee(categorie); setMontrerCategorie(true) }}
              >
                <Pencil size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="zl-outils">
        <label className="zl-recherche">
          <Search size={16} />
          <input
            ref={rechercheRef}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une tâche"
            aria-label="Rechercher une tâche"
          />
          {recherche && (
            <button type="button" className="zl-recherche-effacer" onClick={() => setRecherche('')} aria-label="Effacer la recherche">
              <X size={13} />
            </button>
          )}
        </label>

        <select className="zl-select" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label="Filtrer par état">
          {FILTRES_STATUT.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select className="zl-select" value={filtrePriorite} onChange={(e) => setFiltrePriorite(e.target.value)} aria-label="Filtrer par priorité">
          {FILTRES_PRIORITE.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select className="zl-select" value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier les tâches">
          {TRIS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        <div className="zl-bascule" role="group" aria-label="Mode d’affichage">
          <button type="button" aria-pressed={vue === 'tableau'} onClick={() => setVue('tableau')}>
            <LayoutList size={13} /> Tableau
          </button>
          <button type="button" aria-pressed={vue === 'liste'} onClick={() => setVue('liste')}>
            <ClipboardList size={13} /> Liste
          </button>
        </div>
        <span className="zl-compte">{tachesFiltrees.length} tâche{tachesFiltrees.length > 1 ? 's' : ''} affichée{tachesFiltrees.length > 1 ? 's' : ''}</span>
      </div>

      {selection.length > 0 && (
        <div className="zl-selection">
          <span>{selection.length} tâche{selection.length > 1 ? 's' : ''} sélectionnée{selection.length > 1 ? 's' : ''}</span>
          <div className="zl-selection-actions">
            <button type="button" className="zl-mini" onClick={() => setSelection([])}>
              <X size={12} /> Vider la sélection
            </button>
            <button type="button" className="zl-mini" onClick={supprimerSelection} disabled={enregistrement}>
              <Trash2 size={12} /> Supprimer
            </button>
          </div>
        </div>
      )}

      {chargement ? (
        <div className="zl-chargement" aria-live="polite">
          <span className="zl-compte"><Loader2 size={14} className="spin" /> Chargement des tâches…</span>
          <div className="zl-chargement-ligne" />
          <div className="zl-chargement-ligne" />
          <div className="zl-chargement-ligne" />
        </div>
      ) : tachesFiltrees.length === 0 ? (
        <div className="zl-vide">
          <RosacePerlesSvg taille={76} ton={taches.length === 0 ? 'cuivre' : 'teal'} />
          <h3>{taches.length === 0 ? 'Aucune tâche pour l’instant' : 'Aucune tâche ne correspond'}</h3>
          <p>
            {taches.length === 0
              ? 'Une tâche, c’est une personne, une échéance et une preuve si besoin. Créez la première : elle apparaîtra dans la colonne « À faire ».'
              : 'Élargissez la recherche ou retirez un filtre pour revoir toutes les tâches.'}
          </p>
          <button type="button" className="zl-bouton zl-bouton-principal" onClick={ouvrirNouvelleTache}>
            <Plus size={15} /> Nouvelle tâche
          </button>
        </div>
      ) : vue === 'tableau' ? (
        <div className="zl-tableau">
          {COLONNES.map((colonne) => (
            <section
              key={colonne.cle}
              className="zl-colonne"
              data-survol={colonneSurvolee === colonne.cle ? 'oui' : 'non'}
              onDragOver={(e) => { e.preventDefault(); setColonneSurvolee(colonne.cle) }}
              onDragLeave={() => setColonneSurvolee((actuelle) => (actuelle === colonne.cle ? null : actuelle))}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/tache')
                if (id) changerStatut(id, colonne.cible)
              }}
            >
              <header className="zl-colonne-tete">
                <h4 className="zl-colonne-titre">
                  <span className="zl-puce-perle" data-ton={colonne.perle} aria-hidden="true" />
                  {colonne.titre}
                </h4>
                <span className="zl-compte">{parStatut[colonne.cle].length}</span>
              </header>
              <div className="zl-colonne-corps">
                {parStatut[colonne.cle].map((tache) => (
                  <CarteTache
                    key={tache.id}
                    tache={tache}
                    selection={selection.includes(tache.id)}
                    onBasculer={basculerSelection}
                    onOuvrir={(id) => navigate(`/taches/${id}`)}
                    onModifier={(t) => { setTacheEditee(t); setMontrerTache(true) }}
                    onSupprimer={(t) => { setASupprimer(t); setMontrerSuppression(true) }}
                    onGlisser={() => setColonneSurvolee(null)}
                  />
                ))}
                {parStatut[colonne.cle].length === 0 && (
                  <div className="zl-colonne-vide">
                    <RosacePerlesSvg taille={38} ton={colonne.perle} />
                    <span>Rien ici.</span>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="zl-liste">
          {tachesFiltrees.map((tache) => (
            <div key={tache.id} className="zl-tache-ligne" data-selection={selection.includes(tache.id) ? 'oui' : 'non'}>
              <button
                type="button"
                className="zl-case"
                aria-pressed={selection.includes(tache.id)}
                aria-label={selection.includes(tache.id) ? 'Retirer de la sélection' : 'Sélectionner la tâche'}
                onClick={() => basculerSelection(tache.id)}
              >
                <Check size={12} />
              </button>
              <div style={{ minWidth: 0 }}>
                <p className="zl-ligne-nom">{tache.title}</p>
                <p className="zl-ligne-note">
                  {getStatusLabel(tache.status)}
                  {tache.team?.name ? ` · ${tache.team.name}` : ''}
                  {tache.category?.name ? ` · ${tache.category.name}` : ''}
                </p>
              </div>
              <PastillePersonne personne={tache.assigned_employee} />
              <EtiquetteEcheance tache={tache} />
              <div className="zl-carte-actions">
                <button type="button" className="zl-mini" onClick={() => navigate(`/taches/${tache.id}`)}>
                  Ouvrir
                </button>
                <button type="button" className="zl-mini" onClick={() => { setTacheEditee(tache); setMontrerTache(true) }} aria-label={`Modifier ${tache.title}`}>
                  <Pencil size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vue === 'tableau' && horsCircuit > 0 && (
        <div className="zl-note-module">
          <Info size={15} />
          <span>
            {horsCircuit} tâche{horsCircuit > 1 ? 's' : ''} refusée{horsCircuit > 1 ? 's' : ''} ou annulée{horsCircuit > 1 ? 's' : ''}
            {' '}ne figure{horsCircuit > 1 ? 'nt' : ''} pas au tableau : ouvrez la liste pour les revoir.
          </span>
        </div>
      )}

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
