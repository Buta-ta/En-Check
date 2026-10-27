// ═══════════════════════════════════════════════════════════
// ANALYTICS DU SITE — la toile de korhogo, une seule pièce
//
// Trois écrans vivaient côte à côte : le journal des connexions,
// la carte des connexions, et les statistiques de la page
// d'accueil (enfermées dans un panneau du tableau de bord). Ils
// parlent du même mouvement — quelqu'un entre quelque part — et
// ils font maintenant une page :
//
//   · Connexions — qui est entré, quand, d'où, avec quel appareil,
//     et pourquoi une entrée a été refusée ;
//   · Carte — les mêmes entrées, posées sur une carte, avec leurs
//     amas et le détail d'une personne ;
//   · Visites du site — ce que la page d'accueil retient : visites,
//     appareils, pays, sections vues, boutons cliqués.
//
// Le dessin est la toile peinte sénoufo, comme Entreprises : des
// cartouches d'écru sur un mur de fumée, des cadres tracés, des
// chevrons de lisière. Les chiffres restent ceux du serveur ; la
// suppression, elle, dit toujours ce qu'elle va emporter.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronDown, Clock, Download,
  FileText, Globe2, MapPin, Monitor, Moon, RefreshCw, Search, Shield,
  Smartphone, Sun, Tablet, Trash2, TrendingUp, UserRound, X, XCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import PageCulturalBand from '../components/PageCulturalBand'
import RaccourcisPages from '../components/RaccourcisPages'
import CarteConnexions from '../components/CarteConnexions'
import { KorhogoBlasonNuitSvg } from '../components/KorhogoSvg'
import { useTheme } from '../contexts/ThemeContext'
import ConnectionLogService from '../services/connectionLogService'
import {
  deleteAllVisits, deleteVisitById, deleteVisitsByCountry, getLandingPageStats,
} from '../services/analyticsService'
import { exportAnalyticsToCSV, exportAnalyticsToPDF } from '../services/pdfExportService'
import {
  construireCSV, dateHeure, dureeLisible, entrepriseDe, estReussie,
  identiteUtilisateur, libelleAppareil, libelleSection, maximumDe, motifsDeRefus,
  nomUtilisateur, partPourcent, qualiteUtilisateur, resumeDesLieux, centreDe,
  tempsRelatif, tauxReussite, tracesASupprimer, visitesParJour,
} from '../lib/analyticsSite'
import './AnalyticsSite.css'

const VUES = [
  { cle: 'connexions', libelle: 'Connexions', icone: Shield },
  { cle: 'carte', libelle: 'Carte', icone: Globe2 },
  { cle: 'visites', libelle: 'Visites du site', icone: TrendingUp },
]

const PERIODES = [
  { jours: 7, libelle: '7 jours' },
  { jours: 30, libelle: '30 jours' },
  { jours: 90, libelle: '90 jours' },
]

const PLAGES_CARTE = [
  { heures: 1, libelle: 'Dernière heure' },
  { heures: 6, libelle: '6 dernières heures' },
  { heures: 24, libelle: '24 dernières heures' },
  { heures: 72, libelle: '3 derniers jours' },
  { heures: 168, libelle: '7 derniers jours' },
]

const ICONE_APPAREIL = { desktop: Monitor, mobile: Smartphone, tablet: Tablet }

const FILTRES_VIDES = { recherche: '', type: '', etat: '', du: '', au: '' }

// ── les petits morceaux ────────────────────────────────────

function Chargement({ texte = 'Chargement des traces…', note = 'Les entrées arrivent du serveur.' }) {
  return (
    <div className="an-charge" role="status" aria-live="polite">
      <div className="an-charge-chevrons" aria-hidden="true">
        <span /><span /><span />
      </div>
      <p className="an-charge-texte">{texte}</p>
      <p className="an-charge-note">{note}</p>
    </div>
  )
}

function Fenetre({ eyebrow, titre, surFermer, children, pied, large = false, labelledBy }) {
  const panneau = useRef(null)

  useEffect(() => {
    const surTouche = (evenement) => { if (evenement.key === 'Escape') surFermer() }
    window.addEventListener('keydown', surTouche)
    const ancien = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', surTouche)
      document.body.style.overflow = ancien
    }
  }, [surFermer])

  useEffect(() => {
    const premier = panneau.current?.querySelector('button, input, select, textarea, [tabindex]')
    if (premier) premier.focus({ preventScroll: true })
  }, [])

  return (
    <div
      className="an-voile"
      onMouseDown={(evenement) => { if (evenement.target === evenement.currentTarget) surFermer() }}
    >
      <div
        className={`an-fenetre${large ? ' an-fenetre--large' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        ref={panneau}
      >
        <header className="an-fenetre-tete">
          <div>
            {eyebrow && <p className="an-eyebrow">{eyebrow}</p>}
            <h2 className="an-fenetre-titre" id={labelledBy}>{titre}</h2>
          </div>
          <button type="button" className="an-fenetre-fermer" onClick={surFermer} aria-label="Fermer">
            <X size={15} />
          </button>
        </header>
        <div className="an-fenetre-corps">{children}</div>
        {pied && <footer className="an-fenetre-pied">{pied}</footer>}
      </div>
    </div>
  )
}

function Etiquette({ ton = 'neutre', children, icone: Icone }) {
  return (
    <span className="an-etiquette" data-ton={ton}>
      {Icone && <Icone size={11} aria-hidden="true" />}
      {children}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════
// LA PAGE
// ═══════════════════════════════════════════════════════════

export default function AnalyticsSite() {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()
  const [parametres, setParametres] = useSearchParams()

  const [admin, setAdmin] = useState(null)
  const [vue, setVue] = useState(() => {
    const demandee = parametres.get('vue')
    return VUES.some((item) => item.cle === demandee) ? demandee : 'connexions'
  })
  const [avis, setAvis] = useState(null)

  const [entreprises, setEntreprises] = useState([])
  const [entreprise, setEntreprise] = useState('all')
  const [periode, setPeriode] = useState(7)

  const [traces, setTraces] = useState([])
  const [stats, setStats] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [rafraichir, setRafraichir] = useState(false)

  const [filtres, setFiltres] = useState(FILTRES_VIDES)
  const [depliee, setDepliee] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selection, setSelection] = useState(() => new Set())

  const [purge, setPurge] = useState(null) // { cible: 'selection' | 'jour' | 'tout', jours }
  const [confirmation, setConfirmation] = useState('')
  const [suppression, setSuppression] = useState(false)

  const [carte, setCarte] = useState([])
  const [chargeCarte, setChargeCarte] = useState(true)
  const [plage, setPlage] = useState(24)
  const [suiviAuto, setSuiviAuto] = useState(true)
  const [cible, setCible] = useState(null)
  const [centre, setCentre] = useState([14.6937, -17.4441])
  const [zoom, setZoom] = useState(3)
  const minuterie = useRef(null)
  const centrageAuto = useRef(true)

  const [visites, setVisites] = useState(null)
  const [chargeVisites, setChargeVisites] = useState(true)
  const [joursVisites, setJoursVisites] = useState(30)
  const [aSupprimer, setASupprimer] = useState(null) // { type: 'visite' | 'pays' | 'tout', ... }

  const changerVue = (cle) => {
    setVue(cle)
    setParametres(cle === 'connexions' ? {} : { vue: cle }, { replace: true })
  }

  // ── l'accès ───────────────────────────────────────────────
  useEffect(() => {
    const brut = localStorage.getItem('admin')
    if (!brut) { navigate('/login'); return }
    let parse
    try {
      parse = JSON.parse(brut)
    } catch {
      navigate('/login')
      return
    }
    if (parse.role !== 'super_admin') { navigate('/dashboard'); return }
    setAdmin(parse)
  }, [navigate])

  useEffect(() => {
    if (!admin) return
    let vivant = true
    supabase
      .from('enterprises')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { if (vivant) setEntreprises(data || []) })
    return () => { vivant = false }
  }, [admin])

  // ── le journal ────────────────────────────────────────────
  const chargerJournal = useCallback(async () => {
    if (!admin) return
    setChargement(true)
    try {
      const donnees = await ConnectionLogService.getLogs({
        user_type: filtres.type || undefined,
        enterprise_id: entreprise === 'all' ? 'all' : entreprise,
        success: filtres.etat === '' ? undefined : filtres.etat === 'true',
        date_from: filtres.du || undefined,
        date_to: filtres.au || undefined,
        limit: 200,
      })
      setTraces(donnees)
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'Le journal n’a pas pu être lu.' })
    } finally {
      setChargement(false)
    }
  }, [admin, filtres.type, filtres.etat, filtres.du, filtres.au, entreprise])

  const chargerStatistiques = useCallback(async () => {
    if (!admin) return
    try {
      const donnees = await ConnectionLogService.getStats(
        entreprise === 'all' ? null : entreprise,
        periode,
      )
      setStats(donnees)
    } catch (probleme) {
      console.error(probleme)
    }
  }, [admin, entreprise, periode])

  const chargerCarte = useCallback(async () => {
    if (!admin) return
    setChargeCarte(true)
    try {
      const donnees = await ConnectionLogService.getGeoLocatedConnections(
        plage,
        entreprise === 'all' ? null : entreprise,
      )
      setCarte(donnees)
      // On ne recentre qu'une fois par plage : le suivi de 30 s ne doit pas
      // ramener la carte sous le doigt de celui qui la déplace.
      if (centrageAuto.current) {
        const point = centreDe(donnees)
        if (point) {
          setCentre(point)
          setZoom(donnees.length === 1 ? 11 : 4)
        }
        centrageAuto.current = false
      }
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'La carte n’a pas pu être chargée.' })
    } finally {
      setChargeCarte(false)
    }
  }, [admin, plage, entreprise])

  const chargerVisites = useCallback(async () => {
    if (!admin) return
    setChargeVisites(true)
    try {
      const donnees = await getLandingPageStats({ days: joursVisites })
      setVisites(donnees)
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'Les visites n’ont pas pu être lues.' })
    } finally {
      setChargeVisites(false)
    }
  }, [admin, joursVisites])

  useEffect(() => { centrageAuto.current = true }, [plage, entreprise])

  useEffect(() => { chargerJournal() }, [chargerJournal])
  useEffect(() => { chargerStatistiques() }, [chargerStatistiques])
  useEffect(() => { chargerCarte() }, [chargerCarte])
  useEffect(() => { chargerVisites() }, [chargerVisites])

  useEffect(() => {
    if (!suiviAuto || !admin) return undefined
    minuterie.current = setInterval(() => { chargerCarte() }, 30000)
    return () => { if (minuterie.current) clearInterval(minuterie.current) }
  }, [suiviAuto, admin, chargerCarte])

  // ── les chiffres du haut ──────────────────────────────────
  const reussite = useMemo(() => tauxReussite(traces), [traces])
  const refus = useMemo(() => traces.filter((trace) => !estReussie(trace)).length, [traces])
  const admins = useMemo(() => traces.filter((trace) => trace.user_type === 'admin').length, [traces])
  const employes = traces.length - admins

  const visitesTotal = visites?.total || 0

  const tousChoisis = traces.length > 0 && selection.size === traces.length

  // ── la recherche, côté écran ──────────────────────────────
  const tracesAffichees = useMemo(() => {
    const terme = filtres.recherche.trim().toLowerCase()
    if (!terme) return traces
    return traces.filter((trace) => [
      nomUtilisateur(trace), identiteUtilisateur(trace), entrepriseDe(trace),
      trace.ip_address, trace.city, trace.country,
    ].some((champ) => (champ || '').toLowerCase().includes(terme)))
  }, [traces, filtres.recherche])

  const motifs = useMemo(() => motifsDeRefus(traces), [traces])
  const lieux = useMemo(() => resumeDesLieux(carte), [carte])

  // ── les gestes ────────────────────────────────────────────
  const rafraichirTout = async () => {
    setRafraichir(true)
    await Promise.all([chargerJournal(), chargerStatistiques(), chargerCarte(), chargerVisites()])
    setRafraichir(false)
    setAvis({ ton: 'ok', texte: 'Les chiffres sont à jour.' })
  }

  const basculerSelection = (id) => {
    setSelection((actuelle) => {
      const suivant = new Set(actuelle)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  }

  const basculerTout = () => {
    setSelection(tousChoisis ? new Set() : new Set(traces.map((trace) => trace.id)))
  }

  const quitterSelection = () => {
    setSelectionMode(false)
    setSelection(new Set())
  }

  const ouvrirPurge = (ciblePurge, joursPurge = 30) => {
    setConfirmation('')
    setPurge({ cible: ciblePurge, jours: joursPurge })
  }

  const nombreAPurger = purge
    ? purge.cible === 'selection'
      ? selection.size
      : purge.cible === 'tout'
        ? traces.length
        : tracesASupprimer(traces, purge.jours)
    : 0

  const supprimerTraces = async () => {
    if (!purge) return
    setSuppression(true)
    try {
      let ids = []
      if (purge.cible === 'selection') ids = Array.from(selection)
      else if (purge.cible === 'tout') ids = traces.map((trace) => trace.id)
      else {
        const limite = new Date()
        limite.setDate(limite.getDate() - purge.jours)
        ids = traces
          .filter((trace) => trace.connected_at && new Date(trace.connected_at) < limite)
          .map((trace) => trace.id)
      }

      if (ids.length === 0) {
        setAvis({ ton: 'erreur', texte: 'Aucune trace à supprimer avec ce choix.' })
        setSuppression(false)
        setPurge(null)
        return
      }

      for (let i = 0; i < ids.length; i += 100) {
        const lot = ids.slice(i, i + 100)
        const { error } = await supabase.from('connection_logs').delete().in('id', lot)
        if (error) throw error
      }

      setAvis({
        ton: 'ok',
        texte: `${ids.length} trace${ids.length > 1 ? 's' : ''} supprimée${ids.length > 1 ? 's' : ''}.`,
      })
      setPurge(null)
      setSelection(new Set())
      setSelectionMode(false)
      await Promise.all([chargerJournal(), chargerStatistiques(), chargerCarte()])
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'La suppression a échoué. Rien n’a été effacé.' })
    } finally {
      setSuppression(false)
    }
  }

  const exporterCSV = () => {
    if (tracesAffichees.length === 0) {
      setAvis({ ton: 'erreur', texte: 'Aucune trace à exporter.' })
      return
    }
    const csv = construireCSV(tracesAffichees)
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `connexions_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(lien)
    lien.click()
    document.body.removeChild(lien)
    URL.revokeObjectURL(url)
    setAvis({ ton: 'ok', texte: `${tracesAffichees.length} connexions exportées.` })
  }

  const supprimerVisites = async () => {
    if (!aSupprimer) return
    setSuppression(true)
    try {
      if (aSupprimer.type === 'visite') await deleteVisitById(aSupprimer.visite.id)
      else if (aSupprimer.type === 'pays') await deleteVisitsByCountry(aSupprimer.code)
      else await deleteAllVisits()

      setAvis({
        ton: 'ok',
        texte: aSupprimer.type === 'tout'
          ? 'Toutes les visites ont été supprimées.'
          : aSupprimer.type === 'pays'
            ? `Les visites de ${aSupprimer.pays} sont supprimées.`
            : 'La visite est supprimée.',
      })
      setASupprimer(null)
      await chargerVisites()
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'La suppression a échoué. Rien n’a été effacé.' })
      setASupprimer(null)
    } finally {
      setSuppression(false)
    }
  }

  const exporterVisites = async (format) => {
    if (!visites) return
    try {
      if (format === 'pdf') await exportAnalyticsToPDF(visites)
      else exportAnalyticsToCSV(visites)
      setAvis({ ton: 'ok', texte: `Le fichier ${format.toUpperCase()} est prêt.` })
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'L’export a échoué.' })
    }
  }

  const serieVisites = useMemo(
    () => visitesParJour(visites?.rawVisits || [], 14),
    [visites],
  )
  const maximumVisites = maximumDe(serieVisites)

  const appareils = useMemo(() => {
    const compte = visites?.byDevice || {}
    const total = Object.values(compte).reduce((somme, nombre) => somme + nombre, 0)
    return Object.entries(compte)
      .map(([cle, nombre]) => ({
        cle, libelle: libelleAppareil(cle), nombre, part: partPourcent(nombre, total),
      }))
      .sort((a, b) => b.nombre - a.nombre)
  }, [visites])

  const pays = useMemo(() => {
    const compte = visites?.byCountry || {}
    const total = Object.values(compte).reduce((somme, item) => somme + (item.count || 0), 0)
    return Object.entries(compte)
      .map(([nom, item]) => ({
        nom, code: item.code, nombre: item.count, part: partPourcent(item.count, total),
      }))
      .sort((a, b) => b.nombre - a.nombre)
  }, [visites])

  const sections = useMemo(() => {
    const compte = visites?.sectionCounts || {}
    const total = Object.values(compte).reduce((somme, nombre) => somme + nombre, 0)
    return Object.entries(compte)
      .map(([cle, nombre]) => ({ cle, libelle: libelleSection(cle), nombre, part: partPourcent(nombre, total) }))
      .sort((a, b) => b.nombre - a.nombre)
  }, [visites])

  const boutons = useMemo(() => {
    const compte = visites?.ctaCounts || {}
    const total = Object.values(compte).reduce((somme, nombre) => somme + nombre, 0)
    return Object.entries(compte)
      .map(([nom, nombre]) => ({ nom, nombre, part: partPourcent(nombre, total) }))
      .sort((a, b) => b.nombre - a.nombre)
  }, [visites])

  const dernieresVisites = useMemo(
    () => (visites?.rawVisits || []).slice(0, 8),
    [visites],
  )

  if (!admin) return null

  return (
    <div className={`an-page${darkMode ? '' : ' an-clair'}`}>
      <PageCulturalBand pathname="/analytics" />
      <div className="an-lisiere" aria-hidden="true" />

      <header className="an-entete">
        <button
          type="button"
          className="an-retour"
          onClick={() => navigate('/dashboard')}
          aria-label="Revenir au tableau de bord"
          title="Tableau de bord"
        >
          <ArrowLeft size={16} />
        </button>

        <KorhogoBlasonNuitSvg size={54} />

        <div className="an-titre-bloc">
          <p className="an-eyebrow">Supervision · site et connexions</p>
          <h1 className="an-titre">Analytics du site<span>.</span></h1>
          <p className="an-sous-titre">
            Qui entre, d’où, et ce que le site retient — trois lectures d’un même mouvement.
          </p>
        </div>

        <div className="an-entete-droite">
          <span className="an-pastille" title="Connexions réussies sur la période">
            <i aria-hidden="true" data-etat={traces.length === 0 ? 'faible' : reussite >= 90 ? 'ok' : 'attente'} />
            {traces.length === 0 ? 'aucune trace' : `${reussite} % de réussite`}
          </span>
          <button
            type="button"
            className="an-theme"
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

      <main className="an-coque">
        {/* ── le seuil : la période, l'entreprise, les autres écrans ── */}
        <section className="an-seuil" aria-label="Période, entreprise et accès rapides">
          <div className="an-seuil-groupe">
            <span className="an-seuil-libelle">Période</span>
            <div className="an-segments" role="group" aria-label="Période analysée">
              {PERIODES.map((item) => (
                <button
                  key={item.jours}
                  type="button"
                  className="an-segment"
                  data-actif={periode === item.jours ? 'oui' : 'non'}
                  aria-pressed={periode === item.jours}
                  onClick={() => setPeriode(item.jours)}
                >
                  {item.libelle}
                </button>
              ))}
            </div>
          </div>

          <label className="an-seuil-groupe">
            <span className="an-seuil-libelle">Entreprise</span>
            <select
              className="an-seuil-select"
              value={entreprise}
              onChange={(evenement) => { setEntreprise(evenement.target.value); setSelection(new Set()) }}
              aria-label="Choisir l’entreprise"
            >
              <option value="all">Toutes les entreprises</option>
              {entreprises.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <div className="an-raccourcis">
            <span className="an-seuil-libelle">Aller à</span>
            <RaccourcisPages compact />
          </div>
        </section>

        {avis && (
          <p className="an-avis" data-ton={avis.ton} role="status">
            {avis.ton === 'ok'
              ? <CheckCircle2 size={13} aria-hidden="true" />
              : <AlertTriangle size={13} aria-hidden="true" />}
            {avis.texte}
            <button type="button" className="an-avis-fermer" onClick={() => setAvis(null)} aria-label="Masquer ce message">
              <X size={12} />
            </button>
          </p>
        )}

        {/* ── les stèles ─────────────────────────────────── */}
        <section className="an-steles" aria-label="Chiffres de la période">
          {[
            {
              libelle: `Connexions réussies · ${periode} j`,
              valeur: stats?.totalConnections ?? admins + employes,
              note: `${stats?.adminConnections ?? admins} admins · ${stats?.employeeConnections ?? employes} employés`,
              ton: 'or',
              icone: Shield,
            },
            {
              libelle: 'Taux de réussite',
              valeur: `${reussite} %`,
              note: `${refus} refus sur les traces lues`,
              ton: refus > 0 ? 'attente' : 'vert',
              icone: CheckCircle2,
            },
            {
              libelle: `Visites du site · ${joursVisites} j`,
              valeur: visitesTotal,
              note: `${visites?.newVisitors || 0} nouvelles · ${visites?.returning || 0} de retour`,
              ton: 'ocre',
              icone: TrendingUp,
            },
            {
              libelle: 'Durée moyenne',
              valeur: dureeLisible(visites?.avgDuration || 0),
              note: `rebond ${visites?.bounceRate || 0} %`,
              ton: 'or',
              icone: Clock,
            },
          ].map((item) => {
            const Icone = item.icone
            return (
              <div className="an-stele" data-ton={item.ton} key={item.libelle}>
                <span className="an-stele-marque"><Icone size={16} aria-hidden="true" /></span>
                <span className="an-stele-texte">
                  <span className="an-stele-nombre">{item.valeur}</span>
                  <span className="an-stele-libelle">{item.libelle}</span>
                  <span className="an-stele-note">{item.note}</span>
                </span>
              </div>
            )
          })}
        </section>

        {/* ── le sommaire ────────────────────────────────── */}
        <div className="an-sommaire">
          <p className="an-sommaire-titre">Sommaire</p>
          <div className="an-sommaire-liste" role="tablist" aria-label="Vues de l’analytics du site">
            {VUES.map((item) => {
              const Icone = item.icone
              const actif = vue === item.cle
              const compte = item.cle === 'connexions' ? traces.length
                : item.cle === 'carte' ? carte.length
                  : visitesTotal
              return (
                <button
                  key={item.cle}
                  type="button"
                  role="tab"
                  id={`an-onglet-${item.cle}`}
                  aria-selected={actif}
                  aria-controls={`an-vue-${item.cle}`}
                  className="an-onglet"
                  data-actif={actif ? 'oui' : 'non'}
                  onClick={() => changerVue(item.cle)}
                >
                  <Icone size={14} aria-hidden="true" />
                  {item.libelle}
                  <span className="an-onglet-compte">{compte}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="an-bouton-discret an-rafraichir"
            onClick={rafraichirTout}
            disabled={rafraichir}
          >
            <RefreshCw size={13} aria-hidden="true" className={rafraichir ? 'an-tourne' : undefined} />
            {rafraichir ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>

        {/* ═══ 1. CONNEXIONS ═══ */}
        {vue === 'connexions' && (
          <section className="an-vue" id="an-vue-connexions" role="tabpanel" aria-labelledby="an-onglet-connexions">
            <header className="an-vue-tete">
              <div>
                <h2 className="an-vue-titre">Le journal des connexions</h2>
                <p className="an-vue-note">
                  {traces.length} trace{traces.length > 1 ? 's' : ''} · les 200 dernières · entrez dans une ligne pour le détail
                </p>
              </div>
              <div className="an-vue-gestes">
                <button type="button" className="an-bouton-creux" onClick={exporterCSV}>
                  <Download size={14} /> Exporter
                </button>
                <button
                  type="button"
                  className="an-bouton-creux"
                  data-actif={selectionMode ? 'oui' : 'non'}
                  onClick={() => (selectionMode ? quitterSelection() : setSelectionMode(true))}
                >
                  <Check size={14} /> {selectionMode ? 'Quitter la sélection' : 'Sélectionner'}
                </button>
                <button type="button" className="an-bouton an-bouton--danger" onClick={() => ouvrirPurge('jour', 30)}>
                  <Trash2 size={14} /> Purger
                </button>
              </div>
            </header>

            <div className="an-barre">
              <label className="an-recherche">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  value={filtres.recherche}
                  onChange={(evenement) => setFiltres({ ...filtres, recherche: evenement.target.value })}
                  placeholder="Nom, courriel, ville, adresse IP"
                  aria-label="Rechercher une connexion"
                />
                {filtres.recherche && (
                  <button type="button" onClick={() => setFiltres({ ...filtres, recherche: '' })} aria-label="Effacer la recherche">
                    <X size={13} />
                  </button>
                )}
              </label>

              <div className="an-filtres" role="group" aria-label="Type de compte">
                {[{ cle: '', libelle: 'Tous' }, { cle: 'admin', libelle: 'Admins' }, { cle: 'employee', libelle: 'Employés' }].map((option) => (
                  <button
                    key={option.cle || 'tous'}
                    type="button"
                    className="an-filtre"
                    data-actif={filtres.type === option.cle ? 'oui' : 'non'}
                    aria-pressed={filtres.type === option.cle}
                    onClick={() => setFiltres({ ...filtres, type: option.cle })}
                  >
                    {option.libelle}
                  </button>
                ))}
              </div>

              <div className="an-filtres" role="group" aria-label="État de la connexion">
                {[{ cle: '', libelle: 'Tout état' }, { cle: 'true', libelle: 'Réussies' }, { cle: 'false', libelle: 'Refusées' }].map((option) => (
                  <button
                    key={option.cle || 'tout'}
                    type="button"
                    className="an-filtre"
                    data-actif={filtres.etat === option.cle ? 'oui' : 'non'}
                    aria-pressed={filtres.etat === option.cle}
                    onClick={() => setFiltres({ ...filtres, etat: option.cle })}
                  >
                    {option.libelle}
                  </button>
                ))}
              </div>

              <label className="an-date">
                <span>Du</span>
                <input type="date" value={filtres.du} onChange={(evenement) => setFiltres({ ...filtres, du: evenement.target.value })} />
              </label>
              <label className="an-date">
                <span>Au</span>
                <input type="date" value={filtres.au} onChange={(evenement) => setFiltres({ ...filtres, au: evenement.target.value })} />
              </label>

              {(filtres.recherche || filtres.type || filtres.etat || filtres.du || filtres.au) && (
                <button type="button" className="an-bouton-discret" onClick={() => setFiltres(FILTRES_VIDES)}>
                  Tout effacer
                </button>
              )}
            </div>

            {selectionMode && (
              <div className="an-selection-barre" role="status">
                <span>{selection.size} trace{selection.size > 1 ? 's' : ''} choisie{selection.size > 1 ? 's' : ''}</span>
                <button type="button" className="an-lien" onClick={basculerTout}>
                  {tousChoisis ? 'Tout décocher' : 'Tout cocher'}
                </button>
                <button
                  type="button"
                  className="an-bouton an-bouton--danger an-bouton--petit"
                  onClick={() => ouvrirPurge('selection')}
                  disabled={selection.size === 0}
                >
                  <Trash2 size={13} /> Supprimer la sélection
                </button>
              </div>
            )}

            {chargement ? (
              <Chargement texte="Lecture du journal…" note="Les traces arrivent du serveur." />
            ) : traces.length === 0 ? (
              <div className="an-vide">
                <Shield size={32} aria-hidden="true" />
                <p className="an-vide-titre">Aucune connexion sur cette période</p>
                <p className="an-vide-texte">
                  Élargissez la période ou choisissez « Toutes les entreprises » : le journal ne montre que ce qui existe.
                </p>
              </div>
            ) : (
              <>
                <div className="an-tableau" data-selection={selectionMode ? 'oui' : 'non'} role="table" aria-label="Journal des connexions">
                  <div className="an-tableau-tete" role="row">
                    {selectionMode && <span role="columnheader" aria-label="Sélection" />}
                    <span role="columnheader">Quand</span>
                    <span role="columnheader">Qui</span>
                    <span role="columnheader">Entreprise</span>
                    <span role="columnheader">Appareil</span>
                    <span role="columnheader">Lieu</span>
                    <span role="columnheader">État</span>
                  </div>

                  {tracesAffichees.map((trace) => {
                    const Icone = ICONE_APPAREIL[trace.device_type] || Monitor
                    const reussie = estReussie(trace)
                    const ouverte = depliee === trace.id
                    const choisie = selection.has(trace.id)
                    return (
                      <div className="an-ligne-bloc" key={trace.id}>
                        <div
                          className="an-tableau-ligne"
                          role="row"
                          data-etat={reussie ? 'ok' : 'refus'}
                          data-choisie={choisie ? 'oui' : 'non'}
                        >
                          {selectionMode && (
                            <span className="an-case-cellule" role="cell">
                              <button
                                type="button"
                                className="an-case"
                                role="checkbox"
                                aria-checked={choisie}
                                aria-label={`Choisir la connexion de ${nomUtilisateur(trace)}`}
                                onClick={() => basculerSelection(trace.id)}
                              >
                                {choisie && <Check size={11} strokeWidth={3} />}
                              </button>
                            </span>
                          )}
                          <span className="an-cellule-quand" role="cell">
                            <strong>{tempsRelatif(trace.connected_at)}</strong>
                            <small>{dateHeure(trace.connected_at)}</small>
                          </span>
                          <span className="an-cellule-qui" role="cell">
                            <span className="an-puce" data-role={trace.user_type} aria-hidden="true">
                              {trace.user_type === 'admin' ? <Shield size={11} /> : <UserRound size={11} />}
                            </span>
                            <span>
                              <strong>{nomUtilisateur(trace)}</strong>
                              <small>{identiteUtilisateur(trace) || qualiteUtilisateur(trace)}</small>
                            </span>
                          </span>
                          <span className="an-cellule-entreprise" role="cell">
                            {entrepriseDe(trace) || <span className="an-faible">Sans entreprise</span>}
                          </span>
                          <span className="an-cellule-appareil" role="cell">
                            <Icone size={12} aria-hidden="true" /> {libelleAppareil(trace.device_type)}
                          </span>
                          <span className="an-cellule-lieu" role="cell">
                            {trace.city || trace.country
                              ? [trace.city, trace.country].filter(Boolean).join(', ')
                              : <span className="an-faible">Lieu inconnu</span>}
                          </span>
                          <span className="an-cellule-etat" role="cell">
                            <Etiquette ton={reussie ? 'vert' : 'terre'} icone={reussie ? CheckCircle2 : XCircle}>
                              {reussie ? 'Réussie' : 'Refusée'}
                            </Etiquette>
                            <button
                              type="button"
                              className="an-deplier"
                              aria-expanded={ouverte}
                              onClick={() => setDepliee(ouverte ? null : trace.id)}
                              aria-label={ouverte ? 'Replier le détail' : 'Déplier le détail'}
                            >
                              <ChevronDown size={14} className={ouverte ? 'an-pivote' : undefined} />
                            </button>
                          </span>
                        </div>

                        {ouverte && (
                          <div className="an-detail" role="region" aria-label={`Détail de la connexion de ${nomUtilisateur(trace)}`}>
                            {!reussie && (
                              <p className="an-detail-motif">
                                <AlertTriangle size={13} aria-hidden="true" />
                                Motif du refus : {trace.failure_reason || 'non renseigné par le serveur'}
                              </p>
                            )}
                            <dl className="an-detail-grille">
                              <div><dt>Adresse IP</dt><dd>{trace.ip_address || '—'}</dd></div>
                              <div><dt>Navigateur</dt><dd>{trace.user_agent ? trace.user_agent.slice(0, 60) : '—'}</dd></div>
                              <div><dt>{trace.user_type === 'admin' ? 'Administrateur' : 'Employé'}</dt><dd>{nomUtilisateur(trace)}</dd></div>
                              <div><dt>Position</dt><dd>{trace.latitude != null && trace.longitude != null
                                ? `${Number(trace.latitude).toFixed(4)}, ${Number(trace.longitude).toFixed(4)}`
                                : 'non géolocalisée'}</dd></div>
                              <div><dt>Méthode</dt><dd>{trace.login_method || '—'}</dd></div>
                              <div><dt>Dates</dt><dd>{dateHeure(trace.connected_at)}</dd></div>
                            </dl>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {tracesAffichees.length === 0 && (
                  <p className="an-aucun">Aucune trace ne correspond à cette recherche.</p>
                )}

                {motifs.length > 0 && (
                  <div className="an-motifs">
                    <h3 className="an-motifs-titre">Ce qui a fait refuser</h3>
                    <ul>
                      {motifs.slice(0, 4).map((motif) => (
                        <li key={motif.motif}>
                          <span>{motif.motif}</span>
                          <strong>{motif.nombre}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ═══ 2. CARTE ═══ */}
        {vue === 'carte' && (
          <section className="an-vue" id="an-vue-carte" role="tabpanel" aria-labelledby="an-onglet-carte">
            <header className="an-vue-tete">
              <div>
                <h2 className="an-vue-titre">La carte</h2>
                <p className="an-vue-note">
                  {carte.length} connexion{carte.length > 1 ? 's' : ''} géolocalisée{carte.length > 1 ? 's' : ''} ·{' '}
                  {lieux.lieuxDistincts} lieu{lieux.lieuxDistincts > 1 ? 'x' : ''} · cliquez une épingle ou une personne
                </p>
              </div>
              <div className="an-vue-gestes">
                <button type="button" className="an-bouton-creux" onClick={chargerCarte} disabled={chargeCarte}>
                  <RefreshCw size={14} className={chargeCarte ? 'an-tourne' : undefined} /> Rafraîchir
                </button>
              </div>
            </header>

            <div className="an-barre">
              <label className="an-date">
                <span>Plage</span>
                <select value={plage} onChange={(evenement) => setPlage(Number(evenement.target.value))} aria-label="Plage horaire">
                  {PLAGES_CARTE.map((item) => (
                    <option key={item.heures} value={item.heures}>{item.libelle}</option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="an-bascule"
                data-actif={suiviAuto ? 'oui' : 'non'}
                aria-pressed={suiviAuto}
                onClick={() => setSuiviAuto(!suiviAuto)}
              >
                <span className="an-bascule-case" aria-hidden="true">{suiviAuto && <Check size={10} strokeWidth={3} />}</span>
                Suivi automatique (30 s)
              </button>

              {lieux.empilementMax > 1 && (
                <p className="an-note-carte">
                  <MapPin size={12} aria-hidden="true" />
                  Jusqu’à {lieux.empilementMax} personnes au même endroit — cliquez l’amas pour le déplier
                </p>
              )}
            </div>

            <div className="an-carte-grille">
              <div className="an-carte-cellule">
                {chargeCarte && carte.length === 0 ? (
                  <Chargement texte="La carte se déplie…" note="Leaflet et les positions arrivent." />
                ) : (
                  <CarteConnexions
                    connexions={carte}
                    centre={centre}
                    zoom={zoom}
                    identifiantCible={cible}
                    surEpingles={(connexion) => {
                      setCible(null)
                      setTimeout(() => setCible(connexion.id), 40)
                    }}
                    horodatage={dateHeure}
                  />
                )}
              </div>

              <aside className="an-carte-liste" aria-label="Connexions récentes">
                <header className="an-carte-liste-tete">
                  <h3>Connexions récentes</h3>
                  <span className="an-compte">{carte.length}</span>
                </header>
                {carte.length === 0 ? (
                  <p className="an-carte-vide">Aucune connexion géolocalisée sur cette plage.</p>
                ) : (
                  <ul>
                    {carte.slice(0, 40).map((connexion) => {
                      const Icone = ICONE_APPAREIL[connexion.device_type] || Monitor
                      return (
                        <li key={connexion.id}>
                          <button
                            type="button"
                            className="an-carte-item"
                            data-role={connexion.user_type}
                            data-cible={cible === connexion.id ? 'oui' : 'non'}
                            onClick={() => {
                              setCible(null)
                              setTimeout(() => setCible(connexion.id), 40)
                            }}
                          >
                            <span className="an-carte-item-puce" aria-hidden="true">
                              {connexion.user_type === 'admin' ? <Shield size={12} /> : <UserRound size={12} />}
                            </span>
                            <span className="an-carte-item-texte">
                              <span className="an-carte-item-nom">{nomUtilisateur(connexion)}</span>
                              <span className="an-carte-item-sous">
                                {[entrepriseDe(connexion), connexion.city].filter(Boolean).join(' · ') || 'Lieu inconnu'}
                              </span>
                            </span>
                            <span className="an-carte-item-droite">
                              <span className="an-carte-item-quand">{tempsRelatif(connexion.connected_at)}</span>
                              <Icone size={11} aria-hidden="true" />
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </aside>
            </div>
          </section>
        )}

        {/* ═══ 3. VISITES DU SITE ═══ */}
        {vue === 'visites' && (
          <section className="an-vue" id="an-vue-visites" role="tabpanel" aria-labelledby="an-onglet-visites">
            <header className="an-vue-tete">
              <div>
                <h2 className="an-vue-titre">Les visites du site</h2>
                <p className="an-vue-note">
                  {visitesTotal} visite{visitesTotal > 1 ? 's' : ''} sur {joursVisites} jours · page d’accueil d’En-Check
                </p>
              </div>
              <div className="an-vue-gestes">
                <div className="an-segments" role="group" aria-label="Période des visites">
                  {[7, 30, 90].map((jours) => (
                    <button
                      key={jours}
                      type="button"
                      className="an-segment"
                      data-actif={joursVisites === jours ? 'oui' : 'non'}
                      aria-pressed={joursVisites === jours}
                      onClick={() => setJoursVisites(jours)}
                    >
                      {jours} j
                    </button>
                  ))}
                </div>
                <button type="button" className="an-bouton-creux" onClick={() => exporterVisites('pdf')}>
                  <FileText size={14} /> PDF
                </button>
                <button type="button" className="an-bouton-creux" onClick={() => exporterVisites('csv')}>
                  <Download size={14} /> CSV
                </button>
                <button type="button" className="an-bouton an-bouton--danger" onClick={() => setASupprimer({ type: 'tout' })}>
                  <Trash2 size={14} /> Purger
                </button>
              </div>
            </header>

            {chargeVisites && !visites ? (
              <Chargement texte="Lecture des visites…" note="Les statistiques de la page d’accueil arrivent." />
            ) : visitesTotal === 0 ? (
              <div className="an-vide">
                <TrendingUp size={32} aria-hidden="true" />
                <p className="an-vide-titre">Aucune visite sur cette période</p>
                <p className="an-vide-texte">
                  Le suivi s’active depuis la page d’accueil du site. Rien n’est inventé ici.
                </p>
              </div>
            ) : (
              <>
                <div className="an-cartouches">
                  {[
                    { libelle: 'Visites', valeur: visites.total, note: `${partPourcent(visites.newVisitors, visites.total)} % de nouvelles` },
                    { libelle: 'Nouvelles', valeur: visites.newVisitors, note: `${visites.returning} de retour` },
                    { libelle: 'Durée moyenne', valeur: dureeLisible(visites.avgDuration), note: 'temps passé sur la page' },
                    { libelle: 'Rebond', valeur: `${visites.bounceRate} %`, note: 'moins de 10 secondes' },
                  ].map((item) => (
                    <div className="an-cartouche" key={item.libelle}>
                      <p className="an-cartouche-libelle">{item.libelle}</p>
                      <p className="an-cartouche-valeur">{item.valeur}</p>
                      <p className="an-cartouche-note">{item.note}</p>
                    </div>
                  ))}
                </div>

                <div className="an-double">
                  <div className="an-cartouche an-cartouche--large">
                    <p className="an-cartouche-titre">Visites par jour · 14 derniers jours</p>
                    <div className="an-graphique" role="img" aria-label={`Visites par jour, maximum ${maximumVisites}`}>
                      {serieVisites.map((jour) => (
                        <div className="an-graphique-colonne" key={jour.jour}>
                          <span className="an-graphique-valeur">{jour.nombre > 0 ? jour.nombre : ''}</span>
                          <span
                            className="an-graphique-barre"
                            data-vide={jour.nombre === 0 ? 'oui' : 'non'}
                            style={{ '--an-part': maximumVisites > 0 ? `${Math.round((jour.nombre / maximumVisites) * 100)}%` : '0%' }}
                          />
                          <span className="an-graphique-jour">{jour.libelle}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="an-cartouche">
                    <p className="an-cartouche-titre">Dernières visites</p>
                    <ul className="an-visites-recentes">
                      {dernieresVisites.map((visite) => (
                        <li key={visite.id}>
                          <span className="an-visite-quand">{tempsRelatif(visite.created_at)}</span>
                          <span className="an-visite-lieu">
                            {[visite.city, visite.country_code || visite.country].filter(Boolean).join(', ') || 'Lieu inconnu'}
                            <small>{libelleAppareil(visite.device_type)} · {dureeLisible(visite.duration_seconds)}</small>
                          </span>
                          <button
                            type="button"
                            className="an-lien an-lien--danger"
                            onClick={() => setASupprimer({ type: 'visite', visite })}
                            aria-label="Supprimer cette visite"
                          >
                            <Trash2 size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="an-triple">
                  <div className="an-cartouche">
                    <p className="an-cartouche-titre">Appareils</p>
                    <ul className="an-jauge-liste">
                      {appareils.map((item) => {
                        const Icone = ICONE_APPAREIL[item.cle] || Monitor
                        return (
                          <li key={item.cle}>
                            <span className="an-jauge-libelle"><Icone size={12} aria-hidden="true" /> {item.libelle}</span>
                            <span className="an-jauge-piste"><i style={{ width: `${item.part}%` }} /></span>
                            <span className="an-jauge-valeur">{item.nombre}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  <div className="an-cartouche">
                    <p className="an-cartouche-titre">Pays</p>
                    <ul className="an-jauge-liste">
                      {pays.slice(0, 6).map((item) => (
                        <li key={item.nom}>
                          <button
                            type="button"
                            className="an-jauge-libelle an-jauge-libelle--lien"
                            onClick={() => setASupprimer({ type: 'pays', code: item.code, pays: item.nom, nombre: item.nombre })}
                            title={`Supprimer les visites de ${item.nom}`}
                          >
                            {item.nom}
                          </button>
                          <span className="an-jauge-piste"><i style={{ width: `${item.part}%` }} /></span>
                          <span className="an-jauge-valeur">{item.nombre}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="an-cartouche">
                    <p className="an-cartouche-titre">Villes</p>
                    <ul className="an-jauge-liste">
                      {Object.entries(visites.byCity || {}).slice(0, 6).map(([ville, nombre]) => (
                        <li key={ville}>
                          <span className="an-jauge-libelle">{ville}</span>
                          <span className="an-jauge-piste">
                            <i style={{ width: `${partPourcent(nombre, visitesTotal)}%` }} />
                          </span>
                          <span className="an-jauge-valeur">{nombre}</span>
                        </li>
                      ))}
                      {Object.keys(visites.byCity || {}).length === 0 && (
                        <li className="an-jauge-vide">Aucune ville reconnue.</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="an-double">
                  <div className="an-cartouche">
                    <p className="an-cartouche-titre">Sections vues</p>
                    <ul className="an-jauge-liste">
                      {sections.map((item) => (
                        <li key={item.cle}>
                          <span className="an-jauge-libelle">{item.libelle}</span>
                          <span className="an-jauge-piste"><i style={{ width: `${item.part}%` }} /></span>
                          <span className="an-jauge-valeur">{item.nombre}</span>
                        </li>
                      ))}
                      {sections.length === 0 && <li className="an-jauge-vide">Aucune section relevée.</li>}
                    </ul>
                  </div>

                  <div className="an-cartouche">
                    <p className="an-cartouche-titre">Boutons cliqués</p>
                    <ul className="an-jauge-liste">
                      {boutons.map((item) => (
                        <li key={item.nom}>
                          <span className="an-jauge-libelle">{item.nom}</span>
                          <span className="an-jauge-piste"><i style={{ width: `${item.part}%` }} /></span>
                          <span className="an-jauge-valeur">{item.nombre}</span>
                        </li>
                      ))}
                      {boutons.length === 0 && <li className="an-jauge-vide">Aucun bouton cliqué sur la période.</li>}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <footer className="an-pied">
        <span className="an-pied-marque">ANALYTICS DU SITE</span>
        <span className="an-pied-sep">·</span>
        <span>En-Check, toile de korhogo</span>
        <span className="an-pied-sep">·</span>
        <span>{traces.length} connexions, {carte.length} géolocalisées, {visitesTotal} visites</span>
      </footer>

      <PageCulturalBand pathname="/analytics" placement="bottom" />

      {/* ── la fenêtre de purge ───────────────────────────── */}
      {purge && (
        <Fenetre
          eyebrow="Suppression · connexions"
          titre={`Supprimer ${nombreAPurger} trace${nombreAPurger > 1 ? 's' : ''} ?`}
          labelledBy="an-titre-purge"
          surFermer={() => setPurge(null)}
          pied={(
            <>
              <button type="button" className="an-bouton-creux" onClick={() => setPurge(null)}>Annuler</button>
              <button
                type="button"
                className="an-bouton an-bouton--danger"
                onClick={supprimerTraces}
                disabled={suppression || confirmation.trim().toUpperCase() !== 'PURGER' || nombreAPurger === 0}
              >
                <Trash2 size={14} /> {suppression ? 'Suppression…' : `Supprimer ${nombreAPurger} trace${nombreAPurger > 1 ? 's' : ''}`}
              </button>
            </>
          )}
        >
          <div className="an-fenetre-alerte">
            <p className="an-fenetre-alerte-titre">Ce qui sera effacé</p>
            <p>
              {purge.cible === 'selection'
                ? `${selection.size} connexion${selection.size > 1 ? 's' : ''} choisie${selection.size > 1 ? 's' : ''} dans la liste.`
                : purge.cible === 'tout' || purge.jours === 0
                  ? `${traces.length} connexion${traces.length > 1 ? 's' : ''}, soit tout l’historique affiché.`
                  : `${nombreAPurger} connexion${nombreAPurger > 1 ? 's' : ''} de plus de ${purge.jours} jours.`}
            </p>
            <p className="an-fenetre-alerte-note">
              Les pointages, les visites du site et les comptes ne sont pas touchés.
              Cette action est définitive : aucun retour en arrière.
            </p>
          </div>

          {purge.cible === 'jour' && (
            <>
              <p className="an-fenetre-libelle">Période à purger</p>
              <div className="an-segments" role="group" aria-label="Période à purger">
                {[30, 90, 0].map((jours) => (
                  <button
                    key={jours}
                    type="button"
                    className="an-segment"
                    data-actif={purge.jours === jours ? 'oui' : 'non'}
                    aria-pressed={purge.jours === jours}
                    onClick={() => setPurge({ ...purge, jours })}
                  >
                    {jours === 0 ? 'Tout l’historique' : `Plus de ${jours} jours`}
                  </button>
                ))}
              </div>
            </>
          )}

          <label className="an-champ">
            <span className="an-champ-libelle">Pour confirmer, tapez « PURGER »</span>
            <input
              value={confirmation}
              onChange={(evenement) => setConfirmation(evenement.target.value)}
              placeholder="PURGER"
              autoComplete="off"
            />
          </label>

          <p className="an-fenetre-trace">
            <Shield size={13} aria-hidden="true" />
            La suppression elle-même reste dans l’historique : qui, quand, combien.
          </p>
        </Fenetre>
      )}

      {/* ── la fenêtre des visites ─────────────────────────── */}
      {aSupprimer && (
        <Fenetre
          eyebrow="Suppression · visites du site"
          titre={aSupprimer.type === 'tout'
            ? 'Supprimer toutes les visites ?'
            : aSupprimer.type === 'pays'
              ? `Supprimer les visites de ${aSupprimer.pays} ?`
              : 'Supprimer cette visite ?'}
          labelledBy="an-titre-visite"
          surFermer={() => setASupprimer(null)}
          pied={(
            <>
              <button type="button" className="an-bouton-creux" onClick={() => setASupprimer(null)}>Annuler</button>
              <button type="button" className="an-bouton an-bouton--danger" onClick={supprimerVisites} disabled={suppression}>
                <Trash2 size={14} /> {suppression ? 'Suppression…' : 'Supprimer'}
              </button>
            </>
          )}
        >
          <p className="an-note">
            {aSupprimer.type === 'tout'
              ? `Les ${visitesTotal} visites de la période seront effacées. Les connexions et les comptes ne sont pas touchés.`
              : aSupprimer.type === 'pays'
                ? `${aSupprimer.nombre} visite${aSupprimer.nombre > 1 ? 's' : ''} venant de ${aSupprimer.pays} seront effacées.`
                : `La visite de ${[aSupprimer.visite.city, aSupprimer.visite.country].filter(Boolean).join(', ') || 'lieu inconnu'} sera effacée.`}
          </p>
          <p className="an-note an-note--forte">Cette action est définitive.</p>
        </Fenetre>
      )}
    </div>
  )
}
