// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — ASSEMBLAGE (maquette v4 validée 15/11)
// ───────────────────────────────────────────────────────────
// Cadre kente tissé sur les 4 bords, bandeau bogolan sous le
// cadre, barre du haut horizontale (Dashboard · Pointages ·
// Équipe · Planning · Paie · Plus), hero « Bonjour » + photo de
// pointage + carte « À vérifier », puis grille de 5 cartes :
// Activité de pointage (heatmap), Mise en route, Équipe en
// direct, Planning de l'équipe, Heures enregistrées.
//
// Les données réelles viennent de useDashboardData (page) ; la
// synthèse kente (heatmap, heures, rapport) de la RPC
// encheck_dashboard_synthese ; le planning de la semaine d'un
// léger chargement employee_schedules. La personnalisation
// (widgets, actions rapides, barre du haut) reste portée par
// useDashboardLayout — signatures + préférences distantes.
// ═══════════════════════════════════════════════════════════
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Check, ChevronRight, Clock, ShieldCheck, Share2 } from 'lucide-react'
import SystemMessageBanner from '../../components/SystemMessageBanner'
import EnterpriseSwitcher from '../../components/EnterpriseSwitcher'
import { supabase } from '../../lib/supabase'
import DashboardTopbar from './DashboardTopbar'
import DashboardDialogs from './DashboardDialogs'
import DashboardPanneaux from './DashboardPanneaux'
import KenteModalRapport from './kente/KenteModalRapport'
import { estPauseReelleEffectuee } from '../../services/pausesService'
import { buildNavigationSections, buildQuickActionCatalog, buildWidgetCatalog } from './experienceCatalogs'
import { useDashboardLayout } from './useDashboardLayout'
import { useKenteSynthese } from './useKenteSynthese'
import { JOURS_FR, JOURS_SEMAINE, choisirInsight, couleurCellule, formatDelta, moyenne, pctDelta } from './kente/kenteUtils'
import './bento.css'
import './kente/kente.css'

// Navigation primaire de la barre du haut (maquette v4) ; le
// reste du catalogue part dans le menu « Plus ».
const NAV_PRIMAIRE = ['/dashboard', '/pointages', '/employes', '/planning', '/paie']
// Heures affichées sur la heatmap (maquette : 08/10/12/14)
const HEURES_HEATMAP = [8, 10, 12, 14]
// Les 3 lignes horaires du planning de la semaine
const LIGNES_PLANNING = ['08:00', '12:00', '16:00']
const PAYS_FR = {
  BJ: 'Bénin', SN: 'Sénégal', CI: 'Côte d’Ivoire', ML: 'Mali', TG: 'Togo',
  BF: 'Burkina Faso', GA: 'Gabon', CM: 'Cameroun', NE: 'Niger', GH: 'Ghana',
}

const initiales = (nom) =>
  nom.split(' ').filter(Boolean).map((mot) => mot[0]).join('').slice(0, 2).toUpperCase() || 'EC'

// Ligne du mini-grille selon l'heure de début d'un créneau
const lignePlanning = (heures) => {
  const h = Number(String(heures || '').slice(0, 2))
  if (!Number.isFinite(h) || h === 0) return 1
  if (h < 10) return 1
  if (h < 14) return 2
  return 3
}

export default function DashboardExperience({
  admin,
  entreprises = [],
  isSuperAdmin,
  isMultiEntreprise,
  modulePlanning,
  moduleRetards,
  retardsOptionActive = false,
  moduleConges,
  moduleHeuresSup,
  moduleGeofencing,
  moduleCarteTempsReel,
  moduleRecoFaciale,
  moduleFichesPaie,
  moduleTaches,
  modulePredictions,
  modulePointeuses,
  modulePostePointage,
  moduleRemunerations,
  moduleCoutSalarial,
  moduleConfigFiscale,
  stats,
  recentActivity = [],
  liveEmployees = [],
  topEntreprises = [],
  conflictsPending = [],
  scheduleRequestsPending = [],
  handleQuickScheduleRequest,
  processingScheduleRequestId,
  forgottenExitItems = [],
  confirmForgottenExit,
  savingForgottenExitId,
  pausesToday = [],
  todayHoliday,
  currentTime,
  loadError,
  notifications = [],
  unreadCount = 0,
  hasHighPriority = false,
  markAsRead,
  markAllAsRead,
  handleLogout,
  handleEnterpriseSwitch,
  mobileMenuOpen,
  setMobileMenuOpen,
  tabStates = {},
  markTabAsViewed,
  canManageConflict,
  openConflictModal,
  showConflictModal,
  setShowConflictModal,
  selectedConflict,
  conflictNote,
  setConflictNote,
  resolvingConflict,
  resolveConflict,
  retryLoad,
  darkMode,
  toggleTheme,
  showSystemMessages = true,
}) {
  const navigate = useNavigate()
  const employeeCount = Number(stats?.employes) || 0
  const presentCount = Number(stats?.presentsToday) || 0
  const livePresentCount = liveEmployees.filter((employee) => String(employee.type || '').toLowerCase() === 'in').length
  const lateCount = Number(stats?.retardsToday) || 0
  const forgottenExits = Number(stats?.oublisSortie) || 0
  const conflictCount = conflictsPending.length || Number(stats?.conflitsPending) || 0
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now())
  const realPausesToday = pausesToday.filter((pa) => estPauseReelleEffectuee(pa))
  const activePauses = realPausesToday.filter((pa) => pa?.ouverte)
  const unplannedPauses = realPausesToday.filter((pa) => pa?.estNonPlanifiee)

  useEffect(() => {
    if (!activePauses.length) return undefined
    const timer = window.setInterval(() => setLiveNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activePauses.length])

  const nowMs = currentTime?.getTime ? currentTime.getTime() : liveNowMs
  const presenceRate = employeeCount > 0
    ? Math.max(0, Math.min(100, Math.round((presentCount / employeeCount) * 100)))
    : 0
  const reviewCount = conflictCount + scheduleRequestsPending.length + forgottenExits
  const metricValue = (value, pad = false) => loadError ? '—' : (pad ? String(value).padStart(2, '0') : value)
  const metricCaption = (caption) => loadError ? 'Données indisponibles' : caption
  const metricShare = (value) => loadError ? null : (employeeCount ? Math.min(100, Math.round((value / employeeCount) * 100)) : 0)
  const adminName = `${admin?.first_name || ''} ${admin?.last_name || ''}`.trim() || 'Administrateur'
  const adminInitials = `${admin?.first_name?.[0] || ''}${admin?.last_name?.[0] || ''}` || 'EC'
  const adminRole = isSuperAdmin ? 'Super administrateur' : (isMultiEntreprise ? 'Admin multi-entreprises' : 'Administrateur')

  // Catalogues reconstruits à chaque rendu : la personnalisation s'appuie
  // sur des signatures texte (useDashboardLayout), jamais sur ces tableaux.
  const quickActionCatalog = buildQuickActionCatalog({
    isSuperAdmin, modulePlanning, moduleConges, moduleRetards, moduleHeuresSup,
    moduleFichesPaie, moduleConfigFiscale, moduleCoutSalarial,
    moduleRemunerations, moduleTaches, modulePredictions,
  })
  const widgetCatalog = buildWidgetCatalog({
    loadError, presentCount, employeeCount, presenceRate, reviewCount, lateCount,
    absentCount: Number(stats?.absentsToday) || 0,
    leaveCount: Number(stats?.congesToday) || 0,
    forgottenExits, conflictCount, retardsOptionActive,
    isSuperAdmin, moduleConges, moduleRetards, stats, entreprises,
    realPausesToday, activePauses, unplannedPauses, nowMs, metricValue,
    metricCaption, metricShare,
  })
  const layout = useDashboardLayout({ admin, retardsOptionActive, widgetCatalog, quickActionCatalog })
  const navigationSections = buildNavigationSections({
    isSuperAdmin, modulePlanning, moduleConges, moduleRetards, moduleHeuresSup,
    moduleRemunerations, moduleFichesPaie, moduleConfigFiscale, modulePredictions,
    moduleCarteTempsReel, moduleGeofencing, moduleRecoFaciale, modulePointeuses,
    modulePostePointage, forgottenExits, conflictCount, scheduleRequestsPending,
    lateCount, activePauses,
  })

  // Menu « Plus » : tout ce que la navigation primaire ne montre pas,
  // plus le rapport kente (qui remplace l'ancien bouton de l'en-tête).
  const plusSections = navigationSections
    .map((section) => ({
      label: section.label,
      items: section.items.filter((item) => item.show && !NAV_PRIMAIRE.includes(item.path)),
    }))
    .filter((section) => section.items.length > 0)
  plusSections.push({
    label: 'Rapports',
    items: [{ label: 'Rapport kente', icon: Share2, path: null, action: 'rapport' }],
  })

  // ═══ SYNTHÈSE KENTE (heatmap, heures, rapport) ═══
  const kente = useKenteSynthese({ admin, isSuperAdmin })
  const { serie, tendances, sante, bornes, echec, chargement } = kente
  const insight = useMemo(
    () => (kente.donnees
      ? choisirInsight({ serie, heatmap: kente.donnees.heatmap, tendance: tendances, stats })
      : null),
    [kente.donnees, serie, tendances, stats],
  )
  const entreesJour = serie.length ? serie[serie.length - 1].entrees : 0
  const moy7 = Math.round(moyenne(serie.slice(-7).map((p) => p.entrees)))
  const deltaSemaine = pctDelta(tendances?.entrees_7j, tendances?.entrees_7j_prev)

  const [rapportOuvert, setRapportOuvert] = useState(false)
  const [copie, setCopie] = useState(false)
  const rapport = useMemo(() => {
    if (!kente.donnees) return ''
    const lignes = [
      'En-Check — Synthèse du tableau de bord',
      `Généré le ${new Date().toLocaleDateString('fr-FR')} · ${kente.scopeNom || 'Toutes les entreprises'}`,
      `Période : ${JOURS_FR[kente.jours]}`,
      '',
      "Aujourd'hui",
      `- Présents : ${stats?.presentsToday ?? '—'} (taux de présence ${stats?.tauxPresence ?? '—'} %)`,
      `- Retards : ${stats?.retardsToday ?? '—'} · Absents : ${stats?.absentsToday ?? '—'} · En congé : ${stats?.congesToday ?? '—'}`,
      `- Pointages : ${entreesJour} (moyenne 7 jours : ${moy7}/jour)`,
      '',
      'Tendance',
      `- Pointages 7 jours : ${tendances?.entrees_7j ?? '—'} (semaine précédente : ${tendances?.entrees_7j_prev ?? '—'}${deltaSemaine !== null ? ` → ${formatDelta(deltaSemaine)}` : ''})`,
      `- Assiduité : ${sante?.assiduite ?? '—'} % · Régularité : ${sante?.regularite ?? '—'} %`,
      '',
      'Bornes',
      `- ${bornes?.actives ?? '—'} borne(s) active(s) sur ${bornes?.total ?? '—'}`,
      '',
      'Insight du jour',
      insight || '—',
    ]
    return lignes.join('\n')
  }, [kente.donnees, kente.scopeNom, kente.jours, stats, entreesJour, moy7, tendances, deltaSemaine, sante, bornes, insight])

  async function copierRapport() {
    try {
      await navigator.clipboard.writeText(rapport)
      setCopie(true)
      setTimeout(() => setCopie(false), 2500)
    } catch {
      // Le presse-papiers peut être bloqué : on n'échoue pas le rapport.
    }
  }

  // ═══ PLANNING DE LA SEMAINE (employee_schedules) ═══
  // Le dashboard ne charge pas l'écran Planning complet : un petit
  // chargement suffit à dessiner le mini-grille Lun–Sam.
  const [planningJours, setPlanningJours] = useState(null)
  useEffect(() => {
    let actif = true
    async function chargerPlanning() {
      try {
        const enterpriseId = admin?.selectedEnterprise?.id || (isSuperAdmin ? null : (admin?.enterprise_id || null))
        let requete = supabase.from('employees').select('id').eq('is_active', true)
        if (enterpriseId) requete = requete.eq('enterprise_id', enterpriseId)
        const { data: employeesData } = await requete
        const employeeIds = (employeesData || []).map((e) => e.id)
        if (!employeeIds.length) {
          if (actif) setPlanningJours([])
          return
        }
        const { data: esData } = await supabase
          .from('employee_schedules')
          .select('custom_work_days, work_schedules(id, start_time, end_time, work_days)')
          .in('employee_id', employeeIds)
          .eq('is_active', true)
        const parJour = Array.from({ length: 6 }, () => ({ personnes: 0, heures: '' }))
        for (const es of esData || []) {
          const jours = (Array.isArray(es.custom_work_days) && es.custom_work_days.length)
            ? es.custom_work_days
            : (es.work_schedules?.work_days || [1, 2, 3, 4, 5])
          const ws = es.work_schedules
          for (const j of jours) {
            if (j >= 1 && j <= 6) {
              const cellule = parJour[j - 1]
              cellule.personnes += 1
              if (!cellule.heures && ws?.start_time && ws?.end_time) {
                cellule.heures = `${ws.start_time}–${ws.end_time}`
              }
            }
          }
        }
        if (actif) setPlanningJours(parJour)
      } catch {
        if (actif) setPlanningJours([])
      }
    }
    chargerPlanning()
    return () => { actif = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id, admin?.selectedEnterprise?.id, admin?.enterprise_id, isSuperAdmin])

  const aujourdhui = new Date()
  const isoJour = aujourdhui.getDay() === 0 ? 7 : aujourdhui.getDay()
  const lundi = new Date(aujourdhui)
  lundi.setDate(aujourdhui.getDate() - (isoJour - 1))
  const samedi = new Date(lundi)
  samedi.setDate(lundi.getDate() + 5)
  const semaineLibelle = `Semaine du ${lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${samedi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
  const cellulesPlanning = (planningJours || []).map((cellule, idx) => {
    const libelle = cellule.heures
      ? `${cellule.heures} · ${cellule.personnes}`
      : `${cellule.personnes} pers.`
    return {
      jour: idx + 1,
      row: lignePlanning(cellule.heures),
      personnes: cellule.personnes,
      libelle: cellule.personnes > 0 ? libelle : '',
    }
  })
  const planningVide = planningJours !== null && cellulesPlanning.every((c) => c.personnes === 0)

  // ═══ HEURES ENREGISTRÉES (série de la synthèse) ═══
  const heuresJours = useMemo(() => {
    const parJour = {}
    for (const point of serie.slice(-7)) {
      if (point.jourSemaine >= 1 && point.jourSemaine <= 6) {
        parJour[point.jourSemaine] = (parJour[point.jourSemaine] || 0) + point.entrees
      }
    }
    return [1, 2, 3, 4, 5, 6].map((j) => ({ jour: JOURS_SEMAINE[j - 1], valeur: parJour[j] || 0 }))
  }, [serie])
  const maxHeures = Math.max(1, ...heuresJours.map((h) => h.valeur))

  // ═══ HEATMAP 7 JOURS × HEURES (synthèse) ═══
  const heatmap = Array.isArray(kente.donnees?.heatmap) ? kente.donnees.heatmap : null
  const maxHeat = useMemo(
    () => (heatmap ? Math.max(1, ...heatmap.flat()) : 1),
    [heatmap],
  )

  // ═══ HERO : salutation, date, présents ═══
  const heureActuelle = (currentTime || aujourdhui).getHours()
  const salutation = heureActuelle < 12 ? 'Bonjour' : (heureActuelle < 18 ? 'Bon après-midi' : 'Bonsoir')
  const baseDate = currentTime || aujourdhui
  const heureLibelle = baseDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const dateLongue = baseDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const paysLibelle = PAYS_FR[admin?.selectedEnterprise?.country_code] || ''

  const presentsAvatars = useMemo(() => liveEmployees
    .filter((item) => String(item.type || '').toLowerCase() === 'in')
    .slice(0, 4)
    .map((item) => ({
      id: item.employee_id || item.id,
      photo: item.employee?.photo_url || item.photoUrl,
      nom: `${item.employee?.first_name || ''} ${item.employee?.last_name || ''}`.trim(),
    })), [liveEmployees])

  // ═══ MISE EN ROUTE (4 étapes pilotées par les données réelles) ═══
  const etapesMiseEnRoute = [
    { label: 'Connexion à En-Check', done: true, action: null },
    { label: `Équipe importée (${employeeCount})`, done: employeeCount > 0, action: '/employes' },
    { label: 'Créer un planning', done: Boolean(modulePlanning), action: '/planning' },
    { label: 'Premier pointage', done: Boolean(recentActivity.length) || Boolean(Number(stats?.pointages) > 0), action: '/pointages' },
  ]
  const etapesFaits = etapesMiseEnRoute.filter((etape) => etape.done).length

  const handleNavigation = (item) => {
    setMobileMenuOpen(false)
    if (!item || item.action === 'close') return
    if (item.action === 'rapport') {
      if (kente.donnees) setRapportOuvert(true)
      return
    }
    if (item.tabKey) markTabAsViewed?.(item.tabKey)
    if (item.path) navigate(item.path)
  }

  const dialogsData = {
    forgottenExitItems, confirmForgottenExit, savingForgottenExitId,
    showConflictModal, setShowConflictModal, selectedConflict, conflictNote,
    setConflictNote, resolvingConflict, resolveConflict,
  }
  const panneauxData = {
    recentActivity, liveEmployees, retardsOptionActive, loadError, activePauses,
  }

  const lignesAverifier = [
    {
      id: 'conflits',
      titre: 'Conflits',
      detail: 'Pointage pendant une absence',
      ico: ShieldCheck,
      ton: 'terre',
      nombre: conflictCount,
      action: () => (canManageConflict && conflictsPending.length
        ? openConflictModal(conflictsPending[0])
        : navigate('/pointages')),
    },
    {
      id: 'sorties',
      titre: 'Sorties manquantes',
      detail: 'Arrivées sans sortie',
      ico: Clock,
      ton: 'or',
      nombre: forgottenExits,
      action: () => (forgottenExitItems.length > 0
        ? layout.setIsForgottenExitModalOpen(true)
        : navigate('/pointages')),
    },
    {
      id: 'planning',
      titre: 'Demandes planning',
      detail: 'Horaires à examiner',
      ico: CalendarDays,
      ton: 'vert',
      nombre: scheduleRequestsPending.length,
      action: () => navigate('/planning'),
    },
  ]

  return (
    <div className="encheck-dashboard bento-app" data-theme={darkMode ? 'dark' : 'light'}>
      {/* Cadre kente tissé (4 bords) + bandeau bogolan sous le cadre haut */}
      <div className="kente-frame" aria-hidden="true">
        <span className="kente-frame-bande kente-frame-bande--haut" />
        <span className="kente-frame-bande kente-frame-bande--bas" />
        <span className="kente-frame-bande kente-frame-bande--gauche" />
        <span className="kente-frame-bande kente-frame-bande--droite" />
      </div>
      <div className="dashboard-bogolan" aria-hidden="true" />

      <DashboardTopbar
        admin={admin}
        isSuperAdmin={isSuperAdmin}
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        notifications={notifications}
        unreadCount={unreadCount}
        hasHighPriority={hasHighPriority}
        markAsRead={markAsRead}
        markAllAsRead={markAllAsRead}
        adminName={adminName}
        adminRole={adminRole}
        adminInitials={adminInitials}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        sections={plusSections}
        handleNavigation={handleNavigation}
        handleLogout={handleLogout}
      />

      <main className="mq-page">
        {showSystemMessages && <SystemMessageBanner userType="admins" />}

        {loadError && (
          <div className="mq-error-banner" role="alert">
            <AlertTriangle size={19} />
            <div className="copy">
              <strong>Les données ne sont pas à jour</strong>
              <span>Impossible de charger l'activité du jour ({loadError}). Les compteurs ne doivent pas être interprétés comme des données réelles.</span>
            </div>
            <button type="button" onClick={retryLoad}>Réessayer</button>
          </div>
        )}

        {/* ═══ HERO : salutation + photo de pointage + à vérifier ═══ */}
        <section className="mq-hero" aria-label={`Bonjour, ${salutation} et présence du jour`}>
          <div className="mq-hero-text">
            <p className="mq-greeting">{salutation}</p>
            <div className="kente-accent" aria-hidden="true" />
            <p className="mq-hero-date">
              <span className="mq-live-dot" aria-hidden="true" />
              {heureLibelle} · {dateLongue}
            </p>
            <div className="mq-hero-ent">
              <EnterpriseSwitcher admin={admin} onSwitch={handleEnterpriseSwitch} />
              {paysLibelle && <span className="mq-hero-pays">· {paysLibelle}</span>}
            </div>
          </div>
          <div className="mq-hero-photo">
            <img src="/images/dashboard-attendance.jpg" alt="Pointage en cours sur l'application En-Check" />
          </div>
          <div className="mq-hero-overlay" aria-hidden="true" />
          <div className="mq-hero-presents">
            <span>
              <b>{loadError ? '—' : livePresentCount}</b> présent{livePresentCount > 1 ? 's' : ''}
            </span>
            <span className="mq-hero-avatars">
              {presentsAvatars.map((p) => (p.photo
                ? <img key={p.id} src={p.photo} alt="" />
                : <i key={p.id} aria-hidden="true">{initiales(p.nom)}</i>))}
            </span>
          </div>

          {/* Carte « À vérifier » (chevauche le hero, à droite) */}
          <aside className="mq-averifier" aria-label="À vérifier">
            <div className="mq-averifier-head">
              <h2>
                <span className="mq-live-dot" aria-hidden="true" />
                À vérifier
              </h2>
              <button type="button" className="mq-averifier-tout" onClick={() => navigate('/pointages')}>
                Tout voir
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
            <div className="mq-averifier-rows">
              {lignesAverifier.map((ligne) => {
                const Icone = ligne.ico
                return (
                  <button type="button" className="mq-averifier-row" key={ligne.id} onClick={ligne.action}>
                    <span className={`mq-averifier-ico ${ligne.ton}`}>
                      <Icone size={17} />
                    </span>
                    <span className="mq-averifier-copy">
                      <b>{ligne.titre}</b>
                      <span>{ligne.detail}</span>
                    </span>
                    <span className={`mq-averifier-count${ligne.nombre > 0 ? ' has' : ''}`}>{ligne.nombre}</span>
                  </button>
                )
              })}
            </div>
            <div className={`mq-averifier-foot${reviewCount > 0 ? ' has' : ''}`}>
              {reviewCount > 0 ? (
                <>
                  <ShieldCheck size={14} aria-hidden="true" />
                  {reviewCount} situation{reviewCount > 1 ? 's' : ''} à examiner
                </>
              ) : (
                <>
                  <Check size={14} aria-hidden="true" />
                  Rien à traiter pour le moment
                </>
              )}
            </div>
          </aside>
        </section>

        {/* ═══ GRILLE DES 5 CARTES ═══ */}
        <div className="mq-grid">
          {/* 1 — Activité de pointage (heatmap 7 jours) */}
          <article className="mq-card mq-c8 tile" aria-label="Activité de pointage">
            <div className="mq-card-head">
              <div className="titles">
                <h2>Activité de pointage</h2>
                <div className="sub">{JOURS_FR[kente.jours]} · Lun–Dim</div>
              </div>
              <div className="head-right">
                <div className="mq-tabs" role="group" aria-label="Période de la heatmap">
                  {[7, 30, 90].map((j) => (
                    <button
                      key={j}
                      type="button"
                      className={`mq-tab${kente.jours === j ? ' is-active' : ''}`}
                      onClick={() => kente.setJours(j)}
                    >
                      {j} j
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mq-heat">
              {heatmap ? (
                <>
                  <div className="mq-heat-grid">
                    <span aria-hidden="true" />
                    {JOURS_SEMAINE.map((jour) => (
                      <span key={jour} className="mq-heat-col">{jour}</span>
                    ))}
                    {HEURES_HEATMAP.map((h) => (
                      <Fragment key={h}>
                        <span className="mq-heat-rowlabel">{String(h).padStart(2, '0')}:00</span>
                        {JOURS_SEMAINE.map((jour, idx) => {
                          const valeur = heatmap[idx]?.[h] || 0
                          return (
                            <span
                              key={jour}
                              className="mq-heat-cell"
                              style={{ background: couleurCellule(valeur, maxHeat) }}
                              title={`${jour} · ${String(h).padStart(2, '0')}:00 — ${valeur} pointage${valeur > 1 ? 's' : ''}`}
                            />
                          )
                        })}
                      </Fragment>
                    ))}
                  </div>
                  <div className="mq-heat-legende">
                    <span><i style={{ background: 'rgba(201, 169, 97, 0.38)' }} />Entrées</span>
                    <span><i style={{ background: '#eba35c' }} />À vérifier</span>
                    <span><i style={{ background: 'var(--track)' }} />Aucune activité</span>
                  </div>
                </>
              ) : (
                <div className="mq-heat-empty">
                  {chargement ? 'Chargement de l’activité…' : 'Aucune activité à afficher'}
                </div>
              )}
            </div>
          </article>

          {/* 2 — Mise en route (progression) */}
          <article className="mq-card mq-c4 tile" aria-label="Mise en route">
            <span className="mq-step-count" aria-hidden="true">{etapesFaits}/4</span>
            <div className="mq-card-head">
              <div className="titles">
                <h2>Mise en route</h2>
                <div className="sub">Pour démarrer avec En-Check</div>
              </div>
            </div>
            <div
              className="mq-progress"
              role="progressbar"
              aria-valuenow={etapesFaits}
              aria-valuemin={0}
              aria-valuemax={4}
              aria-label={`Mise en route : ${etapesFaits} étapes sur 4`}
            >
              <i style={{ '--w': `${(etapesFaits / 4) * 100}%` }} />
            </div>
            <div className="mq-steps">
              {etapesMiseEnRoute.map((etape, idx) => (
                <button
                  key={etape.label}
                  type="button"
                  className={`mq-step${etape.done ? ' is-done' : ''}`}
                  onClick={() => { if (!etape.done && etape.action) navigate(etape.action) }}
                >
                  <span className="mq-step-check" aria-hidden="true">
                    {etape.done ? <Check size={13} /> : idx + 1}
                  </span>
                  <span className="mq-step-copy">
                    <b className={etape.done ? 'done-label' : ''}>{etape.label}</b>
                  </span>
                </button>
              ))}
            </div>
          </article>

          {/* 3 — Équipe en direct (flux filtrable) */}
          <DashboardPanneaux layout={layout} data={panneauxData} />

          {/* 4 — Planning de l'équipe (mini-grille de la semaine) */}
          <article className="mq-card mq-c4 tile" aria-label="Planning de l'équipe">
            <div className="mq-card-head">
              <div className="titles">
                <h2>Planning de l'équipe</h2>
                <div className="sub">{semaineLibelle}</div>
              </div>
              <div className="head-right">
                <button type="button" className="mq-chip" onClick={() => navigate('/planning')}>
                  Ouvrir
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="mq-plan">
              {planningJours === null ? (
                <div className="mq-plan-empty">Chargement du planning…</div>
              ) : planningVide ? (
                <div className="mq-plan-empty">
                  <b>Aucun planning actif cette semaine</b>
                  <button type="button" className="mq-chip" onClick={() => navigate('/planning')} style={{ marginTop: 10 }}>
                    Créer un planning
                  </button>
                </div>
              ) : (
                <div className="mq-plan-grid">
                  <span aria-hidden="true" />
                  {JOURS_SEMAINE.slice(0, 6).map((jour) => (
                    <span key={jour} className="mq-plan-col">{jour}</span>
                  ))}
                  {LIGNES_PLANNING.map((libelleLigne, r) => (
                    <span
                      key={libelleLigne}
                      className="mq-plan-rowlabel"
                      style={{ gridRow: r + 2, gridColumn: 1 }}
                    >
                      {libelleLigne}
                    </span>
                  ))}
                  {cellulesPlanning.filter((c) => c.personnes > 0).map((c) => (
                    <div
                      key={`plan-${c.jour}`}
                      className="mq-plan-track"
                      style={{ '--row': c.row, '--col': c.jour + 1, '--span': 1 }}
                      title={`${JOURS_SEMAINE[c.jour - 1]} : ${c.libelle} personne${c.personnes > 1 ? 's' : ''} sur le planning`}
                    >
                      {c.libelle}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>

          {/* 5 — Heures enregistrées (barres Lun–Sam) */}
          <article className="mq-card mq-c4 tile" aria-label="Heures enregistrées">
            <div className="mq-card-head">
              <div className="titles">
                <h2>Heures enregistrées</h2>
                <div className="sub">7 derniers jours · Lun–Sam</div>
              </div>
            </div>
            {heuresJours.every((h) => h.valeur === 0) ? (
              <div className="mq-bars-empty">Aucun pointage sur la période</div>
            ) : (
              <div className="mq-bars" role="img" aria-label="Pointages d'entrée par jour, lundi à samedi">
                {heuresJours.map((h) => (
                  <div key={h.jour} className="mq-bar" title={`${h.jour} : ${h.valeur} pointages d'entrée`}>
                    <i
                      className={h.valeur === maxHeures ? 'terre' : 'cream'}
                      style={{ height: `${Math.max(8, Math.round((h.valeur / maxHeures) * 100))}%` }}
                    />
                    <span>{h.jour}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mq-foot">Basé sur les pointages d'entrée</div>
          </article>
        </div>
      </main>

      <DashboardDialogs layout={layout} data={dialogsData} />
      <KenteModalRapport
        ouvert={rapportOuvert}
        onFermer={() => setRapportOuvert(false)}
        rapport={rapport}
        copie={copie}
        onCopier={copierRapport}
      />
    </div>
  )
}
