// src/pages/JoursFeries.jsx
// ══════════════════════════════════════════════════════════
// 🧶 JOURS FÉRIÉS — le calendrier tissé
//
// La couverture du Lesotho : un champ de crème, deux lisières
// indigo, un liseré de terre cuite. Les fêtes du pays sont brodées
// en indigo, celles de l'entreprise en terre.
//
// Deux registres, une seule vérité : un jour férié se désactive
// pour UNE entreprise, il ne se supprime pas du pays. Le registre
// du pays est en lecture pour tout le monde ; seul le super
// administrateur le modifie. Le registre de l'entreprise
// s'ajoute librement, et c'est lui qu'on édite.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Globe, Building2, Calendar, CalendarDays,
  Pencil, Trash2, X, Info, Power, PowerOff, Sun, Moon,
  RefreshCw, Save, AlertTriangle, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { supabase } from '../lib/supabase'
import HolidayService, { SUPPORTED_COUNTRIES } from '../services/holidayService'
import { modeleFeries, paysAvecModele, feriesAAjouter } from '../services/modelesFeries'
import { useTheme } from '../contexts/ThemeContext'
import useLoadingMinimum from '../hooks/useLoadingMinimum'
import PageCulturalBand from '../components/PageCulturalBand'
import RaccourcisPages from '../components/RaccourcisPages'
import JoursFeriesAnnee from '../components/JoursFeriesAnnee'
import JoursFeriesLoading from '../components/JoursFeriesLoading'
import { LesothoSceauSvg, LesothoLosangeSvg, LesothoCoutureSvg } from '../components/LesothoMotif'
import './JoursFeries.css'

// ── Les deux registres ──
const REGISTRES = {
  PAYS: 'pays',   // les fêtes du pays, communes à toutes les entreprises
  MAISON: 'maison', // les fêtes propres à l'entreprise
}

const MOIS_COURTS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']

// ── La date d'un jour férié, ramenée à l'année en cours ──
function dateDuJourFerie(holiday, annee = new Date().getFullYear()) {
  const brut = String(holiday?.date || '')
  const [a, m, j] = brut.split('-').map(Number)
  if (!m || !j) return null
  if (holiday.is_recurring) return new Date(annee, m - 1, j, 12)
  if (a !== annee) return null
  return new Date(a, m - 1, j, 12)
}

/**
 * La date à montrer sur le médaillon : celle de l'année en cours pour une
 * fête récurrente, la vraie date sinon — même si elle tombe une autre année.
 */
function dateAffichage(holiday) {
  const resolue = dateDuJourFerie(holiday)
  if (resolue) return resolue
  const brute = new Date(`${holiday?.date}T12:00:00`)
  return Number.isNaN(brute.getTime()) ? null : brute
}

/** La date résolue, écrite en français. */
function resolveHolidayDate(holiday) {
  const d = dateDuJourFerie(holiday)
  if (!d) {
    const brut = new Date(`${holiday?.date}T12:00:00Z`)
    return Number.isNaN(brut.getTime())
      ? '—'
      : brut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Le prochain jour férié encore à venir, sur cette année ou la suivante. */
function prochainJourFerie(liste, depuis = new Date()) {
  const debutJour = new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate())
  let meilleur = null

  for (const { holiday, origine } of liste) {
    for (const annee of [depuis.getFullYear(), depuis.getFullYear() + 1]) {
      const d = dateDuJourFerie(holiday, annee)
      if (!d || d < debutJour) continue
      if (!meilleur || d < meilleur.date) meilleur = { date: d, holiday, origine }
      break
    }
  }

  return meilleur
}

/** Les jours qui restent avant une date. */
function joursAvant(date, depuis = new Date()) {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const b = new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate())
  return Math.round((a - b) / 86400000)
}

//  Tous les pays ne sont pas au catalogue (le Bénin, par exemple, y manque) :
//  on affiche alors le code, sans inventer de drapeau.
function paysInfo(code) {
  const connu = SUPPORTED_COUNTRIES.find(c => c.code === code)
  return {
    nom: connu?.name || code || '—',
    drapeau: connu?.flag || '',
  }
}

function formaterJour(date) {
  if (!date) return '—'
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** « vendredi 9 janvier 2026 » — pour la liste d'un modèle. */
function formaterDateModele(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function JoursFeries() {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()
  const { minLoadingDone, skipLoading } = useLoadingMinimum(1400)

  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [registre, setRegistre] = useState(REGISTRES.PAYS)

  // Entreprise active
  const [enterprises, setEnterprises] = useState([])
  const [selectedEntId, setSelectedEntId] = useState(null)

  // Données
  const [globalHolidays, setGlobalHolidays] = useState([])
  const [ownHolidays, setOwnHolidays] = useState([])
  const [overrides, setOverrides] = useState({})

  // Filtre pays
  const [filterCountry, setFilterCountry] = useState('ALL')

  // Modale de saisie
  const [showModal, setShowModal] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm())

  // Modale de suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Activation en masse
  const [togglingAll, setTogglingAll] = useState(false)

  // Modèle de fêtes du pays (Bénin, …)
  const [showModele, setShowModele] = useState(false)
  const [chargementModele, setChargementModele] = useState(false)

  const isSuperAdmin = admin?.role === 'super_admin'
  const annee = new Date().getFullYear()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }

    const parsed = JSON.parse(adminData)
    setAdmin(parsed)

    if (parsed.role === 'super_admin') {
      loadEnterprises().then(() => loadGlobalHolidays())
    } else {
      const entId = parsed.selectedEnterprise?.id || parsed.enterprise_id
      setSelectedEntId(entId)
      loadAll(entId)
    }
  }, [navigate])

  // ════════════════════════════════════
  // LECTURES
  // ════════════════════════════════════
  const loadEnterprises = async () => {
    const { data } = await supabase
      .from('enterprises')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')
    setEnterprises(data || [])
  }

  const loadAll = async (entId) => {
    setLoading(true)
    try {
      await Promise.all([
        loadGlobalHolidays(),
        loadOwnHolidays(entId),
        loadOverrides(entId),
      ])
    } catch (error) {
      //  une lecture qui échoue ne doit pas laisser la page sur son métier à tisser
      console.error(error)
      toast.error('Les jours fériés n’ont pas pu être chargés')
    } finally {
      setLoading(false)
    }
  }

  const loadGlobalHolidays = async () => {
    try {
      const data = await HolidayService.getGlobalHolidays()
      setGlobalHolidays(data || [])
    } catch (error) {
      console.error(error)
      toast.error('Les fêtes du pays n’ont pas pu être chargées')
    } finally {
      if (!selectedEntId) setLoading(false)
    }
  }

  const loadOwnHolidays = async (entId) => {
    if (!entId) return
    const { data } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('enterprise_id', entId)
      .order('date', { ascending: true })
    setOwnHolidays(data || [])
  }

  const loadOverrides = async (entId) => {
    if (!entId) return
    const data = await HolidayService.getEnterpriseOverrides(entId)
    const map = {}
    data.forEach(ov => { map[ov.holiday_id] = ov })
    setOverrides(map)
  }

  const handleEntChange = async (entId) => {
    setSelectedEntId(entId)
    if (entId) {
      await loadAll(entId)
    } else {
      setOwnHolidays([])
      setOverrides({})
    }
  }

  // ════════════════════════════════════
  // L'ÉTAT D'UNE FÊTE POUR CETTE ENTREPRISE
  // ════════════════════════════════════
  const isGlobalEnabled = (holidayId) => {
    const ov = overrides[holidayId]
    if (!ov) return true // pas de décision enregistrée = la fête s'applique
    return ov.is_enabled !== false
  }

  const handleToggleGlobal = async (holiday) => {
    if (!selectedEntId) {
      toast.error('Choisissez d’abord une entreprise')
      return
    }

    const actifAujourdhui = isGlobalEnabled(holiday.id)
    const result = await HolidayService.toggleGlobalHoliday(selectedEntId, holiday.id, !actifAujourdhui)

    if (result.success) {
      toast.success(actifAujourdhui ? 'Jour férié désactivé pour cette entreprise' : 'Jour férié activé pour cette entreprise')
      await loadOverrides(selectedEntId)
    } else {
      toast.error('La mise à jour n’a pas abouti')
    }
  }

  // ════════════════════════════════════
  // ACTIVATION EN MASSE
  // ════════════════════════════════════
  const handleToggleAllGlobal = async () => {
    if (!selectedEntId) {
      toast.error('Choisissez d’abord une entreprise')
      return
    }
    if (filteredGlobal.length === 0) {
      toast.error('Aucun jour férié à modifier')
      return
    }

    const auMoinsUnActif = filteredGlobal.some(h => isGlobalEnabled(h.id))
    const nouvelEtat = !auMoinsUnActif

    setTogglingAll(true)
    try {
      const resultats = await Promise.all(
        filteredGlobal.map(holiday =>
          HolidayService.toggleGlobalHoliday(selectedEntId, holiday.id, nouvelEtat)
        )
      )

      if (resultats.every(r => r.success)) {
        toast.success(
          nouvelEtat
            ? `${filteredGlobal.length} jour${filteredGlobal.length > 1 ? 's' : ''} férié${filteredGlobal.length > 1 ? 's' : ''} activé${filteredGlobal.length > 1 ? 's' : ''}`
            : `${filteredGlobal.length} jour${filteredGlobal.length > 1 ? 's' : ''} férié${filteredGlobal.length > 1 ? 's' : ''} désactivé${filteredGlobal.length > 1 ? 's' : ''}`
        )
      } else {
        toast.error('Certaines modifications n’ont pas abouti')
      }
      await loadOverrides(selectedEntId)
    } catch (error) {
      toast.error('La modification en masse a échoué')
      console.error(error)
    } finally {
      setTogglingAll(false)
    }
  }

  // ════════════════════════════════════
  // ÉCRITURES
  // ════════════════════════════════════
  const openCreateModal = () => {
    setEditingHoliday(null)
    setForm(defaultForm())
    setShowModal(true)
  }

  const openEditModal = (holiday) => {
    setEditingHoliday(holiday)
    setForm({
      name: holiday.name,
      date: holiday.date,
      is_recurring: holiday.is_recurring ?? true,
      country_code: holiday.country_code || '',
      is_worked: holiday.is_worked ?? false,
      overtime_rate: holiday.overtime_rate ?? 100,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Le nom est requis'); return }
    if (!form.date) { toast.error('La date est requise'); return }

    if (!selectedEntId && admin?.role !== 'super_admin') {
      toast.error('Aucune entreprise sélectionnée')
      return
    }

    setSaving(true)
    try {
      let result
      if (editingHoliday) {
        result = await HolidayService.updateHoliday(editingHoliday.id, selectedEntId, form)
      } else {
        // Le super administrateur peut créer une fête du pays (sans entreprise)
        const entId = admin?.role === 'super_admin' && registre === REGISTRES.PAYS ? null : selectedEntId
        result = await HolidayService.createHoliday(entId, form)
      }

      if (result.success) {
        toast.success(editingHoliday ? 'Jour férié modifié' : 'Jour férié créé')
        setShowModal(false)
        if (registre === REGISTRES.PAYS) await loadGlobalHolidays()
        else await loadOwnHolidays(selectedEntId)
      } else {
        toast.error('Enregistrement impossible : ' + (result.error || 'raison inconnue'))
      }
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (id) => {
    setDeletingId(id)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleting(true)
    const result = await HolidayService.deleteHoliday(deletingId, selectedEntId)
    if (result.success) {
      toast.success('Jour férié supprimé')
      setShowDeleteModal(false)
      //  on recharge le registre d'où venait la fête, pas l'autre
      if (registre === REGISTRES.PAYS) await loadGlobalHolidays()
      else await loadOwnHolidays(selectedEntId)
    } else {
      toast.error('Suppression impossible')
    }
    setDeleting(false)
    setDeletingId(null)
  }

  // ════════════════════════════════════
  // LE MODÈLE DU PAYS
  // ════════════════════════════════════
  const modeleActif = modeleFeries(filterCountry)

  const planModele = useMemo(() => {
    if (!modeleActif) return null
    const existants = globalHolidays.filter(h => h.country_code === modeleActif.code)
    return feriesAAjouter(modeleActif, annee, existants)
  }, [modeleActif, globalHolidays, annee])

  const ouvrirModele = () => setShowModele(true)

  const chargerModele = async () => {
    if (!modeleActif || !planModele || planModele.aCreer.length === 0) return
    setChargementModele(true)

    let crees = 0
    let echecs = 0

    for (const ferie of planModele.aCreer) {
      const result = await HolidayService.createHoliday(null, {
        name: ferie.nom,
        date: ferie.date,
        is_recurring: ferie.recurrent,
        country_code: modeleActif.code,
        is_worked: false,
        overtime_rate: 100,
      })
      if (result.success) crees += 1
      else echecs += 1
    }

    setChargementModele(false)
    setShowModele(false)

    if (crees > 0) {
      toast.success(
        `${crees} fête${crees > 1 ? 's' : ''} du ${modeleActif.nom} ajoutée${crees > 1 ? 's' : ''}`
      )
    }
    if (echecs > 0) {
      toast.error(`${echecs} fête${echecs > 1 ? 's n’ont' : ' n’a'} pas pu être créée${echecs > 1 ? 's' : ''}`)
    }
    await loadGlobalHolidays()
  }

  // ════════════════════════════════════
  // DÉRIVÉS
  // ════════════════════════════════════
  const filteredGlobal = filterCountry === 'ALL'
    ? globalHolidays
    : globalHolidays.filter(h => h.country_code === filterCountry)

  const paysDisponibles = useMemo(() => {
    //  Un pays qui a un modèle doit être proposé même s'il n'a encore
    //  aucune fête enregistrée : c'est justement là qu'on vient le charger.
    const codes = [...new Set([
      ...globalHolidays.map(h => h.country_code).filter(Boolean),
      ...paysAvecModele().map(m => m.code),
    ])]
    return codes
      .map(code => ({
        code,
        ...paysInfo(code),
        nombre: globalHolidays.filter(h => h.country_code === code).length,
        modele: Boolean(modeleFeries(code)),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }, [globalHolidays])

  //  Les deux registres, rangés du premier au dernier jour de l'année.
  const globalTries = useMemo(() => {
    const rang = (h) => {
      const d = dateDuJourFerie(h)
      return d ? d.getTime() : 0
    }
    return [...filteredGlobal].sort((a, b) => rang(a) - rang(b))
  }, [filteredGlobal])

  const ownTries = useMemo(() => {
    const rang = (h) => {
      const d = dateDuJourFerie(h)
      return d ? d.getTime() : 0
    }
    return [...ownHolidays].sort((a, b) => rang(a) - rang(b))
  }, [ownHolidays])

  //  Ce qui compte vraiment pour l'entreprise, tous registres confondus.
  const fetesActives = useMemo(() => {
    const liste = []
    for (const holiday of globalHolidays) {
      //  même règle que `isGlobalEnabled`, lue ici pour que le calcul
      //  se refasse dès qu'une décision change
      const ov = overrides[holiday.id]
      if (ov && ov.is_enabled === false) continue
      liste.push({ holiday, origine: 'pays' })
    }
    for (const holiday of ownHolidays) liste.push({ holiday, origine: 'entreprise' })
    return liste
  }, [globalHolidays, ownHolidays, overrides])

  const prochain = useMemo(() => prochainJourFerie(fetesActives), [fetesActives])

  const nbDesactivees = globalHolidays.filter(h => !isGlobalEnabled(h.id)).length
  const nbTravaillees = fetesActives.filter(({ holiday }) => holiday.is_worked).length

  //  Ce que propose le bouton d'activation en masse, selon ce qui est
  //  déjà actif dans le pays affiché. Calculé ici, APRÈS le filtre.
  const auMoinsUnActif = filteredGlobal.some(h => isGlobalEnabled(h.id))
  const libelleToggleAll = filteredGlobal.length === 0
    ? 'Aucun jour férié'
    : auMoinsUnActif ? 'Tout désactiver' : 'Tout activer'
  const IconeToggleAll = auMoinsUnActif ? PowerOff : Power

  //  Le chargement : les données, plus un plancher pour que la scène soit vue.
  if ((loading && globalHolidays.length === 0) || !minLoadingDone) {
    return (
      <JoursFeriesLoading
        darkMode={darkMode}
        onSkip={() => {
          skipLoading()
          setLoading(false)
        }}
      />
    )
  }

  const nomEntreprise = enterprises.find(e => e.id === selectedEntId)?.name
    || admin?.selectedEnterprise?.name
    || 'votre entreprise'

  const formulaireGlobal = registre === REGISTRES.PAYS && isSuperAdmin

  return (
    <div className={`jf-page${darkMode ? '' : ' jf-clair'}`}>
      <PageCulturalBand pathname="/jours-feries" />
      <div className="jf-bordure" aria-hidden="true" />

      {/* ══ L'EN-TÊTE ══ */}
      <header className="jf-entete">
        <button
          type="button"
          className="jf-retour"
          onClick={() => navigate('/dashboard')}
          aria-label="Revenir au tableau de bord"
          title="Tableau de bord"
        >
          <ArrowLeft size={17} />
        </button>

        <LesothoSceauSvg taille={46} ton="terre" />

        <div className="jf-titre-bloc">
          <span className="jf-eyebrow">Le calendrier tissé</span>
          <h1 className="jf-titre">Jours fériés<span>.</span></h1>
          <p className="jf-sous-titre">
            Les fêtes du pays s’appliquent à toutes les entreprises ; chacune peut
            désactiver celles qu’elle ne suit pas, et coudre les siennes.
          </p>
        </div>

        <div className="jf-entete-droite">
          {isSuperAdmin && (
            <div className="jf-entreprise">
              <Building2 size={14} aria-hidden="true" />
              <select
                value={selectedEntId || ''}
                onChange={e => handleEntChange(e.target.value || null)}
                aria-label="Entreprise dont on règle les jours fériés"
              >
                <option value="">Toutes les entreprises</option>
                {enterprises.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            className="jf-bascule"
            role="switch"
            aria-checked={darkMode}
            onClick={toggleTheme}
            aria-label={darkMode ? 'Passer en thème clair' : 'Passer en thème sombre'}
            title={darkMode ? 'Thème clair' : 'Thème sombre'}
          >
            {darkMode ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="jf-coque">

        {/* ══ LE SEUIL ══ */}
        <section className="jf-seuil" aria-label="Entreprise, année et accès rapides">
          <div className="jf-seuil-gauche">
            <div className="jf-seuil-item">
              <span className="jf-seuil-libelle">Entreprise</span>
              <span className="jf-seuil-valeur">
                <Building2 size={12} aria-hidden="true" />
                {nomEntreprise}
              </span>
            </div>
            <div className="jf-seuil-item">
              <span className="jf-seuil-libelle">Année</span>
              <span className="jf-seuil-valeur">
                <Calendar size={12} aria-hidden="true" />
                {annee}
              </span>
            </div>
            <div className="jf-seuil-item">
              <span className="jf-seuil-libelle">Prochain</span>
              <span className="jf-seuil-valeur">
                <CalendarDays size={12} aria-hidden="true" />
                {prochain ? formaterJour(prochain.date) : 'aucun à venir'}
              </span>
            </div>
          </div>

          <div className="jf-raccourcis">
            <RaccourcisPages compact excludePaths={['/jours-feries']} />
          </div>
        </section>

        {/* ══ L'ANNÉE ET SES MESURES ══ */}
        <div className="jf-haut">
          <JoursFeriesAnnee
            annee={annee}
            globalHolidays={globalHolidays}
            ownHolidays={ownHolidays}
            isGlobalEnabled={isGlobalEnabled}
            prochain={
              prochain && prochain.date.getFullYear() === annee
                ? { jour: prochain.date.getDate(), mois: prochain.date.getMonth() }
                : null
            }
            noteSuivante={
              prochain && prochain.date.getFullYear() !== annee
                ? `La prochaine fête tombe en ${prochain.date.getFullYear()} : ${formaterJour(prochain.date)} ${prochain.date.getFullYear()}.`
                : ''
            }
          />

          <div className="jf-mesures">
            <article className="jf-mesure" data-ton="indigo">
              <span className="jf-mesure-libelle">Fêtes du pays</span>
              <span className="jf-mesure-valeur">
                {filteredGlobal.length}
                <small>{filterCountry === 'ALL' ? 'au total' : 'pour ce pays'}</small>
              </span>
              <span className="jf-mesure-detail">
                {paysDisponibles.length} pays représenté{paysDisponibles.length > 1 ? 's' : ''}
              </span>
            </article>

            <article className="jf-mesure" data-ton="terre">
              <span className="jf-mesure-libelle">Fêtes de l’entreprise</span>
              <span className="jf-mesure-valeur">
                {ownHolidays.length}
                <small>{ownHolidays.length > 1 ? 'ajoutées' : 'ajoutée'}</small>
              </span>
              <span className="jf-mesure-detail">
                {selectedEntId ? nomEntreprise : 'choisissez une entreprise'}
              </span>
            </article>

            <article className="jf-mesure" data-ton={nbDesactivees > 0 ? 'attente' : 'ok'}>
              <span className="jf-mesure-libelle">Désactivées</span>
              <span className="jf-mesure-valeur">
                {nbDesactivees}
                <small>par l’entreprise</small>
              </span>
              <span className="jf-mesure-detail">
                {nbTravaillees > 0 ? `${nbTravaillees} fête${nbTravaillees > 1 ? 's' : ''} travaillée${nbTravaillees > 1 ? 's' : ''}` : 'aucune fête travaillée'}
              </span>
            </article>

            <article className="jf-mesure" data-ton="ok">
              <span className="jf-mesure-libelle">Prochain jour férié</span>
              <span className="jf-mesure-valeur">
                {prochain ? joursAvant(prochain.date) : '—'}
                <small>{prochain && joursAvant(prochain.date) === 1 ? 'jour' : 'jours'}</small>
              </span>
              <span className="jf-mesure-detail" title={prochain?.holiday?.name}>
                {prochain ? prochain.holiday.name : 'rien à venir cette année'}
              </span>
            </article>
          </div>
        </div>

        {/* ══ LES DEUX REGISTRES ══ */}
        <div className="jf-onglets" role="tablist" aria-label="Registres des jours fériés">
          <button
            type="button"
            role="tab"
            id="jf-onglet-pays"
            aria-selected={registre === REGISTRES.PAYS}
            aria-controls="jf-registre-pays"
            className="jf-onglet"
            onClick={() => setRegistre(REGISTRES.PAYS)}
          >
            <Globe size={14} aria-hidden="true" />
            Fêtes du pays
            <span className="jf-onglet-compte">{filteredGlobal.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="jf-onglet-maison"
            aria-selected={registre === REGISTRES.MAISON}
            aria-controls="jf-registre-maison"
            className="jf-onglet"
            onClick={() => setRegistre(REGISTRES.MAISON)}
          >
            <Building2 size={14} aria-hidden="true" />
            Fêtes de l’entreprise
            <span className="jf-onglet-compte">{ownHolidays.length}</span>
          </button>
        </div>

        {/* ── Registre du pays ── */}
        {registre === REGISTRES.PAYS && (
          <div id="jf-registre-pays" role="tabpanel" aria-labelledby="jf-onglet-pays">
            {isSuperAdmin && !selectedEntId && (
              <div className="jf-note">
                <Info size={15} aria-hidden="true" />
                <span>
                  Vous voyez les fêtes du pays telles qu’elles sont publiées.
                  Choisissez une entreprise, en haut, pour décider lesquelles elle suit.
                </span>
              </div>
            )}

            <div className="jf-barre">
              <div className="jf-pays" role="group" aria-label="Filtrer par pays">
                <button
                  type="button"
                  className="jf-pays-puce"
                  aria-pressed={filterCountry === 'ALL'}
                  onClick={() => setFilterCountry('ALL')}
                >
                  Tous les pays
                  <span className="jf-onglet-compte">{globalHolidays.length}</span>
                </button>
                {paysDisponibles.map(p => (
                  <button
                    key={p.code}
                    type="button"
                    className="jf-pays-puce"
                    aria-pressed={filterCountry === p.code}
                    onClick={() => setFilterCountry(p.code)}
                  >
                    {p.drapeau && <span className="jf-pays-drapeau" aria-hidden="true">{p.drapeau}</span>}
                    {p.nom}
                    {p.modele && p.nombre === 0
                      ? <span className="jf-pays-modele">modèle prêt</span>
                      : <span className="jf-onglet-compte">{p.nombre}</span>}
                  </button>
                ))}
              </div>

              {selectedEntId && (
                <button
                  type="button"
                  className="jf-bouton"
                  onClick={handleToggleAllGlobal}
                  disabled={togglingAll || filteredGlobal.length === 0}
                >
                  {togglingAll
                    ? <><RefreshCw size={14} className="jf-tourne" aria-hidden="true" /> Modification…</>
                    : <><IconeToggleAll size={14} aria-hidden="true" /> {libelleToggleAll}</>
                  }
                </button>
              )}

              {isSuperAdmin && modeleActif && (
                <button type="button" className="jf-bouton" onClick={ouvrirModele}>
                  <CalendarDays size={14} aria-hidden="true" />
                  Charger le modèle {modeleActif.nom}
                </button>
              )}

              {isSuperAdmin && (
                <button type="button" className="jf-bouton" data-ton="indigo" onClick={openCreateModal}>
                  <Plus size={14} aria-hidden="true" />
                  Ajouter une fête du pays
                </button>
              )}
            </div>

            <div className="jf-registre">
              {globalTries.length === 0 ? (
                <div className="jf-vide">
                  <Globe size={26} aria-hidden="true" />
                  <strong>
                    {modeleActif
                      ? `Le ${modeleActif.nom} n’a encore aucune fête publiée`
                      : 'Aucune fête pour ce pays'}
                  </strong>
                  <p>
                    {modeleActif && isSuperAdmin
                      ? `Le modèle ${modeleActif.nom} connaît déjà les fêtes légales de l’année.`
                      : 'Choisissez un autre pays, ou ajoutez une fête si vous êtes super administrateur.'}
                  </p>
                  {isSuperAdmin && modeleActif && (
                    <button type="button" className="jf-bouton" data-ton="terre" onClick={ouvrirModele}>
                      <CalendarDays size={14} aria-hidden="true" />
                      Charger le modèle {modeleActif.nom}
                    </button>
                  )}
                </div>
              ) : (
                globalTries.map((holiday, i) => {
                  const active = selectedEntId ? isGlobalEnabled(holiday.id) : true
                  const pays = paysInfo(holiday.country_code)
                  const date = dateAffichage(holiday)

                  return (
                    <article
                      key={holiday.id}
                      className="jf-jour"
                      data-origine="pays"
                      data-actif={active ? 'oui' : 'non'}
                      style={{ animationDelay: `${Math.min(i, 12) * 0.02}s` }}
                    >
                      <span className="jf-medaillon" aria-hidden="true">
                        <LesothoLosangeSvg taille={54} ton="indigo" />
                        <span className="jf-medaillon-texte">
                          <span className="jf-medaillon-jour">{date ? date.getDate() : '—'}</span>
                          <span className="jf-medaillon-mois">{date ? MOIS_COURTS[date.getMonth()] : ''}</span>
                        </span>
                      </span>

                      <div className="jf-jour-corps">
                        <div className="jf-jour-tete">
                          <span className="jf-jour-nom">{holiday.name}</span>
                          {holiday.is_recurring && <span className="jf-badge" data-ton="indigo">Chaque année</span>}
                          {holiday.is_worked && <span className="jf-badge" data-ton="attente">Travaillée</span>}
                          {!active && <span className="jf-badge" data-ton="neutre">Désactivée</span>}
                        </div>
                        <div className="jf-jour-meta">
                          <span>
                            <Calendar size={11} aria-hidden="true" />
                            {resolveHolidayDate(holiday)}
                          </span>
                          <span>{pays.drapeau} {pays.nom}</span>
                          <span>+{holiday.overtime_rate}% si travaillée</span>
                        </div>
                      </div>

                      <div className="jf-jour-actions">
                        {selectedEntId && (
                          <button
                            type="button"
                            className="jf-interrupteur"
                            role="switch"
                            aria-checked={active}
                            onClick={() => handleToggleGlobal(holiday)}
                            aria-label={`${holiday.name} — ${active ? 'désactiver' : 'activer'} pour ${nomEntreprise}`}
                            title={active ? 'Désactiver pour cette entreprise' : 'Activer pour cette entreprise'}
                          />
                        )}

                        {isSuperAdmin && (
                          <>
                            <button
                              type="button"
                              className="jf-icone-bouton"
                              onClick={() => openEditModal(holiday)}
                              title="Modifier"
                              aria-label={`Modifier ${holiday.name}`}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              className="jf-icone-bouton"
                              data-ton="danger"
                              onClick={() => confirmDelete(holiday.id)}
                              title="Supprimer"
                              aria-label={`Supprimer ${holiday.name}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── Registre de l'entreprise ── */}
        {registre === REGISTRES.MAISON && (
          <div id="jf-registre-maison" role="tabpanel" aria-labelledby="jf-onglet-maison">
            {!selectedEntId ? (
              <div className="jf-vide">
                <Building2 size={26} aria-hidden="true" />
                <strong>Choisissez une entreprise</strong>
                <p>Le registre des fêtes propres à une entreprise s’ouvre dès qu’une entreprise est sélectionnée.</p>
              </div>
            ) : (
              <>
                <div className="jf-barre">
                  <p className="jf-taux-note jf-barre-note">
                    Fêtes locales, ponts, jours exceptionnels : ce que vous ajoutez ici
                    ne vaut que pour {nomEntreprise}.
                  </p>
                  <button type="button" className="jf-bouton" data-ton="terre" onClick={openCreateModal}>
                    <Plus size={14} aria-hidden="true" />
                    Ajouter une fête
                  </button>
                </div>

                <div className="jf-registre">
                  {ownTries.length === 0 ? (
                    <div className="jf-vide">
                      <Calendar size={26} aria-hidden="true" />
                      <strong>Aucune fête propre à cette entreprise</strong>
                      <p>Les fêtes du pays s’appliquent déjà. Ajoutez ici ce qui n’existe que chez vous.</p>
                      <button type="button" className="jf-bouton" data-ton="terre" onClick={openCreateModal}>
                        <Plus size={14} aria-hidden="true" />
                        Ajouter la première
                      </button>
                    </div>
                  ) : (
                    ownTries.map((holiday, i) => {
                      const date = dateAffichage(holiday)
                      return (
                        <article
                          key={holiday.id}
                          className="jf-jour"
                          data-origine="entreprise"
                          style={{ animationDelay: `${Math.min(i, 12) * 0.02}s` }}
                        >
                          <span className="jf-medaillon" aria-hidden="true">
                            <LesothoLosangeSvg taille={54} ton="terre" />
                            <span className="jf-medaillon-texte">
                              <span className="jf-medaillon-jour">{date ? date.getDate() : '—'}</span>
                              <span className="jf-medaillon-mois">{date ? MOIS_COURTS[date.getMonth()] : ''}</span>
                            </span>
                          </span>

                          <div className="jf-jour-corps">
                            <div className="jf-jour-tete">
                              <span className="jf-jour-nom">{holiday.name}</span>
                              {holiday.is_recurring && <span className="jf-badge" data-ton="indigo">Chaque année</span>}
                              {holiday.is_worked && <span className="jf-badge" data-ton="attente">Travaillée</span>}
                            </div>
                            <div className="jf-jour-meta">
                              <span>
                                <Calendar size={11} aria-hidden="true" />
                                {resolveHolidayDate(holiday)}
                              </span>
                              <span>+{holiday.overtime_rate}% si travaillée</span>
                            </div>
                          </div>

                          <div className="jf-jour-actions">
                            <button
                              type="button"
                              className="jf-icone-bouton"
                              onClick={() => openEditModal(holiday)}
                              title="Modifier"
                              aria-label={`Modifier ${holiday.name}`}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              className="jf-icone-bouton"
                              data-ton="danger"
                              onClick={() => confirmDelete(holiday.id)}
                              title="Supprimer"
                              aria-label={`Supprimer ${holiday.name}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ CE QUE FAIT UN JOUR FÉRIÉ ══ */}
        <details className="jf-explication">
          <summary>
            <Info size={13} aria-hidden="true" />
            Ce qu’un jour férié change dans les calculs
          </summary>
          <div className="jf-explication-corps">
            <ul>
              <li><strong>Férié non travaillé</strong> — la journée n’est ni une absence, ni un retard.</li>
              <li><strong>Férié travaillé</strong> — les heures comptent, avec la majoration réglée sur la fête.</li>
              <li><strong>Désactivé pour l’entreprise</strong> — le jour redevient un jour ouvré ordinaire, avec son planning.</li>
            </ul>
            <p>
              Une désactivation ne touche jamais les autres entreprises : elle est
              enregistrée pour celle qui la demande, et se retire au même endroit.
            </p>
            {/*  la couture prend l'encre du thème : craie sur l'indigo,
                indigo sur la crème — jamais un trait invisible */}
            <LesothoCoutureSvg className="jf-explication-couture" ton={darkMode ? 'indigo' : 'craie'} />
          </div>
        </details>
      </main>

      {/* ══ LA MODALE DE SAISIE ══ */}
      {showModal && (
        <div className="jf-voile" onClick={() => !saving && setShowModal(false)}>
          <div
            className="jf-modale"
            role="dialog"
            aria-modal="true"
            aria-labelledby="jf-modale-titre"
            onClick={e => e.stopPropagation()}
          >
            <div className="jf-modale-tete">
              <LesothoSceauSvg taille={34} ton={formulaireGlobal ? 'indigo' : 'terre'} />
              <div className="jf-modale-titres">
                <h2 className="jf-modale-titre" id="jf-modale-titre">
                  {editingHoliday ? 'Modifier le jour férié' : 'Nouveau jour férié'}
                </h2>
                <span className="jf-modale-sous">
                  {formulaireGlobal
                    ? 'Fête du pays — elle s’appliquera à toutes les entreprises'
                    : `Fête propre à ${nomEntreprise}`}
                </span>
              </div>
              <button
                type="button"
                className="jf-icone-bouton"
                onClick={() => !saving && setShowModal(false)}
                aria-label="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="jf-modale-corps">
              <label className="jf-champ">
                <span className="jf-etiquette">Nom du jour férié</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Fête de l’Indépendance"
                  disabled={saving}
                />
              </label>

              <div className="jf-champ-ligne">
                <label className="jf-champ">
                  <span className="jf-etiquette">Date</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    disabled={saving}
                  />
                </label>

                <label className="jf-champ">
                  <span className="jf-etiquette">Pays</span>
                  <select
                    value={form.country_code}
                    onChange={e => setForm({ ...form, country_code: e.target.value })}
                    disabled={saving}
                  >
                    <option value="">— Aucun —</option>
                    {SUPPORTED_COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <span className="jf-etiquette">Ce que ce jour devient</span>
                <div className="jf-options">
                  <button
                    type="button"
                    className="jf-option"
                    aria-pressed={form.is_recurring}
                    onClick={() => setForm({ ...form, is_recurring: !form.is_recurring })}
                    disabled={saving}
                  >
                    <span className="jf-option-marque" aria-hidden="true" />
                    <span className="jf-option-texte">
                      <span className="jf-option-titre">Chaque année</span>
                      <span className="jf-option-aide">Se répète au même jour et au même mois</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="jf-option"
                    aria-pressed={form.is_worked}
                    onClick={() => setForm({ ...form, is_worked: !form.is_worked })}
                    disabled={saving}
                  >
                    <span className="jf-option-marque" aria-hidden="true" />
                    <span className="jf-option-texte">
                      <span className="jf-option-titre">Jour travaillé</span>
                      <span className="jf-option-aide">Les heures comptent, avec majoration</span>
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <span className="jf-etiquette">Majoration si on travaille ce jour-là</span>
                <div className="jf-taux">
                  {[25, 50, 100, 150, 200].map(taux => (
                    <button
                      key={taux}
                      type="button"
                      className="jf-taux-puce"
                      aria-pressed={form.overtime_rate === taux}
                      onClick={() => setForm({ ...form, overtime_rate: taux })}
                      disabled={saving}
                    >
                      +{taux} %
                    </button>
                  ))}
                  <input
                    type="number"
                    className="jf-taux-libre"
                    aria-label="Majoration en pourcentage"
                    value={form.overtime_rate}
                    onChange={e => setForm({ ...form, overtime_rate: parseInt(e.target.value, 10) || 0 })}
                    min="0"
                    max="300"
                    step="25"
                    disabled={saving}
                  />
                </div>
                <p className="jf-taux-note jf-taux-note-bas">
                  {form.overtime_rate === 100 ? 'Paie doublée' : `Majoration de ${form.overtime_rate} %`}
                </p>
              </div>
            </div>

            <div className="jf-modale-pied">
              <button
                type="button"
                className="jf-bouton"
                onClick={() => !saving && setShowModal(false)}
                disabled={saving}
              >
                Annuler
              </button>
              <button
                type="button"
                className="jf-bouton"
                data-ton="terre"
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.date}
              >
                {saving
                  ? <><RefreshCw size={14} className="jf-tourne" aria-hidden="true" /> Enregistrement…</>
                  : <><Save size={14} aria-hidden="true" /> {editingHoliday ? 'Enregistrer' : 'Créer'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LA MODALE DE SUPPRESSION ══ */}
      {showDeleteModal && (
        <div className="jf-voile" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div
            className="jf-modale jf-modale-suppression"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="jf-suppression-titre"
            onClick={e => e.stopPropagation()}
          >
            <span className="jf-suppression-icone">
              <AlertTriangle size={24} aria-hidden="true" />
            </span>
            <h2 id="jf-suppression-titre">Supprimer ce jour férié ?</h2>
            <p>
              Il ne sera plus pris en compte dans les retards, les absences et les
              heures supplémentaires. Cette action ne se défait pas.
            </p>
            <div className="jf-modale-pied">
              <button
                type="button"
                className="jf-bouton"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Garder
              </button>
              <button
                type="button"
                className="jf-supprimer"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <><RefreshCw size={13} className="jf-tourne" aria-hidden="true" /> Suppression…</>
                  : <><Trash2 size={13} aria-hidden="true" /> Supprimer</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LE MODÈLE DU PAYS ══ */}
      {showModele && planModele && modeleActif && (
        <div className="jf-voile" onClick={() => !chargementModele && setShowModele(false)}>
          <div
            className="jf-modale"
            role="dialog"
            aria-modal="true"
            aria-labelledby="jf-modele-titre"
            onClick={e => e.stopPropagation()}
          >
            <div className="jf-modale-tete">
              <LesothoSceauSvg taille={34} ton="indigo" />
              <div className="jf-modale-titres">
                <h2 className="jf-modale-titre" id="jf-modele-titre">
                  Modèle {modeleActif.nom}
                </h2>
                <span className="jf-modale-sous">
                  {planModele.aCreer.length === 0
                    ? `Tout est déjà là pour ${annee}`
                    : `${planModele.aCreer.length} fête${planModele.aCreer.length > 1 ? 's' : ''} à créer pour ${annee}`}
                  {' · '}
                  {modeleActif.source}
                </span>
              </div>
              <button
                type="button"
                className="jf-icone-bouton"
                onClick={() => !chargementModele && setShowModele(false)}
                aria-label="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="jf-modale-corps">
              {planModele.aCreer.length > 0 && (
                <ul className="jf-modele-liste">
                  {planModele.aCreer.map(ferie => (
                    <li className="jf-modele-item" key={`${ferie.nom}-${ferie.date}`}>
                      <span className="jf-modele-date">{formaterDateModele(ferie.date)}</span>
                      <span className="jf-modele-nom">{ferie.nom}</span>
                      <span className="jf-modele-nature" data-nature={ferie.nature}>
                        {ferie.recurrent ? 'chaque année' : 'cette année'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {planModele.dejaPresents.length > 0 && (
                <p className="jf-modele-note">
                  {planModele.dejaPresents.length} fête{planModele.dejaPresents.length > 1 ? 's' : ''} déjà
                  présente{planModele.dejaPresents.length > 1 ? 's' : ''} — rien à refaire.
                </p>
              )}

              {planModele.nonCalculables.length > 0 && (
                <div className="jf-modele-inconnues">
                  <span className="jf-etiquette">Ce que le modèle ne date pas</span>
                  <p>
                    Les fêtes religieuses musulmanes suivent la lune : leur date est
                    annoncée chaque année. On ne la devine pas — saisissez-la quand
                    elle tombe.
                  </p>
                  <ul>
                    {planModele.nonCalculables.map(f => (
                      <li key={f.nom}>
                        <strong>{f.nom}</strong> — {f.note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="jf-modale-pied">
              <button
                type="button"
                className="jf-bouton"
                onClick={() => !chargementModele && setShowModele(false)}
                disabled={chargementModele}
              >
                Annuler
              </button>
              <button
                type="button"
                className="jf-bouton"
                data-ton="terre"
                onClick={chargerModele}
                disabled={chargementModele || planModele.aCreer.length === 0}
              >
                {chargementModele
                  ? <><RefreshCw size={14} className="jf-tourne" aria-hidden="true" /> Création…</>
                  : <><Check size={14} aria-hidden="true" /> Créer {planModele.aCreer.length} fête{planModele.aCreer.length > 1 ? 's' : ''}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Le formulaire vierge ──
function defaultForm() {
  return {
    name: '',
    date: '',
    is_recurring: true,
    country_code: '',
    is_worked: false,
    overtime_rate: 100,
  }
}
