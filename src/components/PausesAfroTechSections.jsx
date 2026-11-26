import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Download,
  FileText,
  Hourglass,
  PieChart,
  Plus,
  Search,
  Timer,
  Users,
  X,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import PiedGrave from './PiedGrave'
import PhotoSignee from './PhotoSignee'
import { AdinkraWatermarkSvg, KenteWovenTapestrySvg, WovenKenteBadgeSvg } from './AfroCulturalSvg'
import {
  badgeAnomalieDetaillee,
  badgeMotifFermeture,
  estPausePresumee,
  estPauseReelleEffectuee,
  formatDuree,
  formaterTempsPauseEnDirect,
} from '../services/pausesService'
import { formaterHeureLocale, getHeuresMinutesLocales, jourLocal } from '../utils/timezoneUtils'
import '../pages/PointagesAfroTech.css'

function formatPeriodRangeLabel(selectedDate, viewMode = 'semaine') {
  if (!selectedDate) return ''
  const parsed = new Date(`${selectedDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return selectedDate

  if (viewMode === 'jour') {
    const raw = parsed.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  if (viewMode === 'mois') {
    const raw = parsed.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  const dayOfWeek = parsed.getDay()
  const monday = new Date(parsed)
  monday.setDate(parsed.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const d1 = monday.getDate()
  const d2 = sunday.getDate()
  const m1 = monday.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
  const m2 = sunday.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
  const year = sunday.getFullYear()
  const capM2 = m2.charAt(0).toUpperCase() + m2.slice(1)

  if (monday.getMonth() === sunday.getMonth()) {
    return `${d1} – ${d2} ${capM2} ${year}`
  }
  const capM1 = m1.charAt(0).toUpperCase() + m1.slice(1)
  return `${d1} ${capM1} – ${d2} ${capM2} ${year}`
}

function formatTableRowDate(dateStr) {
  if (!dateStr) return '—'
  const parsed = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateStr
  const raw = parsed.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function PausesCulturalHero({
  darkMode = true,
  viewMode = 'semaine',
  onViewModeChange,
  selectedDate,
  onShiftDate,
  onDateChange,
  entreprises = [],
  selectedEnterpriseId = 'all',
  onSelectEnterprise,
  isSuperAdmin = false,
  admin = null,
  onToggleTheme,
  onBackDashboard,
  onNavigate,
  onToggleAddForm,
  showAddForm = false,
  onExportCsv,
}) {
  const dateInputRef = useRef(null)
  /*  Le menu des trois modes. La maquette n'affiche qu'une pilule : c'est
      elle qu'on voit, et c'est elle qui ouvre le choix. Il se ferme au clic
      dehors et sur Échap, comme le panneau du mois sur /retards. */
  const [modesOuverts, setModesOuverts] = useState(false)
  const modesRef = useRef(null)
  useEffect(() => {
    if (!modesOuverts) return undefined
    const dehors = (e) => {
      if (modesRef.current && !modesRef.current.contains(e.target)) setModesOuverts(false)
    }
    const echap = (e) => { if (e.key === 'Escape') setModesOuverts(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', echap)
    return () => {
      document.removeEventListener('mousedown', dehors)
      document.removeEventListener('keydown', echap)
    }
  }, [modesOuverts])
  const periodLabel = useMemo(
    () => formatPeriodRangeLabel(selectedDate, viewMode),
    [selectedDate, viewMode]
  )

  const todayIso = jourLocal(new Date()) || new Date().toISOString().split('T')[0]
  const adminFullName = `${admin?.first_name || ''} ${admin?.last_name || ''}`.trim() || 'Administrateur'
  const adminRoleLabel = isSuperAdmin
    ? 'RH · Super Admin'
    : (admin?.selectedEnterprise?.name || 'RH · Siège')
  const adminInitials = `${admin?.first_name?.[0] || ''}${admin?.last_name?.[0] || ''}`.toUpperCase() || 'AD'

  const openDatePicker = () => {
    const el = dateInputRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker()
        return
      } catch {
        // Fallback ci-dessous
      }
    }
    el.focus()
    el.click()
  }

  return (
    <header aria-label="En-tête Pauses En-Check">
      <div className="pauses-v2-planche">
      <div className="pauses-v2-topbar">
        {/*  ═══ L'ENSEIGNE (25/11, maquette B) ═══
            Le pied s'ouvre en grand dans un cercle à double trait, le titre
            prend toute la hauteur, et le sticker « EN-CHECK » s'y accroche
            de travers avec son liseré kente. Géométrie mesurée sur la
            maquette — voir docs/maquettes/pauses-bandeau-spec.md.
            On garde les cibles : le cercle de retour et le bloc marque
            ramènent au tableau de bord, comme avant. */}
        <div className="pauses-v2-brand">
          {onBackDashboard && (
            <button
              type="button"
              className="pauses-v2-back-btn"
              onClick={onBackDashboard}
              title="Retour au Dashboard"
              aria-label="Retour au Dashboard"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div className="pauses-v2-sceau">
            <PiedGrave className="pauses-v2-pied" />
          </div>
          <div
            className="pauses-v2-marque"
            onClick={onBackDashboard}
            role={onBackDashboard ? 'button' : undefined}
            tabIndex={onBackDashboard ? 0 : undefined}
            title="Retour au Dashboard"
          >
            <span className="pauses-v2-titre-ligne">
              <span className="pauses-v2-titre">Pauses</span>
              <span className="pauses-v2-sticker" aria-hidden="true">En-Check</span>
            </span>
            <span className="pauses-v2-devise">Humain · Temps · Performance</span>
          </div>
        </div>

        {/*  ═══ LES ÉTIQUETTES DE PÉRIODE (25/11) ═══
            Le centre de l'en-tête n'est plus un alignement de contrôles :
            une étiquette de bagage pendue — œillet, double ficelle — et,
            dessous, le tampon du mode courant. La maquette n'en montre qu'un :
            « SEMAINE ». Décision du 25/11 : on garde CETTE pilule, et un clic
            ouvre Jour / Semaine / Mois (voir `pauses-v2-menu-modes`). */}
        <div className="pauses-v2-etiquettes">
          <div className="pauses-v2-pendue">
            <span className="pauses-v2-ficelle pauses-v2-ficelle--g" aria-hidden="true" />
            <span className="pauses-v2-ficelle pauses-v2-ficelle--d" aria-hidden="true" />
            <div className="pauses-v2-etiquette-date">
              <button
                type="button"
                className="pauses-v2-oeillet"
                onClick={() => onShiftDate && onShiftDate(-1)}
                aria-label="Période précédente"
                title="Période précédente"
              />
              <button
                type="button"
                className="pauses-v2-date-trigger"
                onClick={openDatePicker}
                title="Choisir une date au calendrier"
              >
                {periodLabel}
              </button>
              <button
                type="button"
                className="pauses-v2-oeillet pauses-v2-oeillet--d"
                onClick={() => onShiftDate && onShiftDate(1)}
                aria-label="Période suivante"
                title="Période suivante"
              />
            </div>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange && onDateChange(e.target.value)}
              aria-label="Choisir une date"
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />
            <div className="pauses-v2-sens" role="group" aria-label="Changer de période">
              <button
                type="button"
                className="pauses-v2-pastille"
                onClick={() => onShiftDate && onShiftDate(-1)}
                aria-label="Période précédente"
                title="Période précédente"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="pauses-v2-pastille"
                onClick={() => onShiftDate && onShiftDate(1)}
                aria-label="Période suivante"
                title="Période suivante"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/*  la pilule unique, et son menu des trois modes */}
          <div className="pauses-v2-modes" ref={modesRef}>
            <button
              type="button"
              className="pauses-v2-mode is-active"
              aria-haspopup="listbox"
              aria-expanded={modesOuverts}
              onClick={() => setModesOuverts((v) => !v)}
            >
              {viewMode}
            </button>
            {modesOuverts && (
              <div className="pauses-v2-menu-modes" role="listbox" aria-label="Mode de période">
                {['jour', 'semaine', 'mois'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="option"
                    aria-selected={viewMode === mode}
                    className={`pauses-v2-menu-mode${viewMode === mode ? ' is-active' : ''}`}
                    onClick={() => {
                      setModesOuverts(false)
                      onViewModeChange && onViewModeChange(mode)
                    }}
                  >
                    {mode}
                  </button>
                ))}
                {selectedDate !== todayIso && (
                  <button
                    type="button"
                    className="pauses-v2-menu-mode pauses-v2-menu-mode--auj"
                    onClick={() => {
                      setModesOuverts(false)
                      onDateChange && onDateChange(todayIso)
                    }}
                  >
                    Aujourd’hui
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="pauses-v2-annexes">
            {isSuperAdmin && entreprises.length > 0 && onSelectEnterprise && (
              <label className="pauses-v2-entreprise">
                <select
                  value={selectedEnterpriseId || 'all'}
                  onChange={(e) => onSelectEnterprise(e.target.value)}
                  aria-label="Sélectionner une entreprise"
                >
                  <option value="all">Toutes les entreprises</option>
                  {entreprises.map((ent) => (
                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                  ))}
                </select>
                <span className="pauses-v2-entreprise-chevron">
                  <ChevronRight size={18} aria-hidden="true" />
                </span>
              </label>
            )}
          </div>

          <div className="pauses-v2-annexes pauses-v2-annexes--csv">
            {onExportCsv && (
              <button
                type="button"
                className="pauses-v2-pastille pauses-v2-pastille--csv"
                onClick={onExportCsv}
                title="Exporter en CSV"
              >
                CSV
              </button>
            )}
          </div>
        </div>

        {/*  ═══ À DROITE : le profil AU-DESSUS, le tampon d'ajout dessous ═══
            L'ordre est celui de la maquette, et il n'est pas décoratif : le
            profil est une information, l'ajout une action — l'action est au
            plus près du pouce et du regard qui descend. */}
        <div className="pauses-v2-bord">
          <div className="pauses-v2-identite">
            <span className="pauses-v2-avatar">
              {/*  La même personne que dans le cercle de la table : son
                   visage, ou ses initiales à défaut. « Je parlais d'afficher
                   l'image du superadmin ici », 26/11. */}
              <PhotoSignee
                url={admin?.photo_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                fallback={<span aria-hidden="true">{adminInitials}</span>}
              />
            </span>
            <span className="pauses-v2-identite-texte">
              <span className="pauses-v2-carte pauses-v2-carte--nom">
                <strong>{adminFullName}</strong>
              </span>
              <span className="pauses-v2-carte pauses-v2-carte--role">
                <em>{adminRoleLabel}</em>
              </span>
            </span>
          </div>

          {onToggleAddForm && (
            <button
              type="button"
              className="pauses-v2-add-btn"
              onClick={onToggleAddForm}
            >
              <span className="pauses-v2-add-plus" aria-hidden="true">
                <Plus size={20} strokeWidth={2.6} />
              </span>
              <span>{showAddForm ? 'Fermer' : 'Ajouter une pause'}</span>
            </button>
          )}
        </div>
        </div>
      </div>
    </header>
  )
}


/*  ═══════════════════════════════════════════════════════════════════════
    LA TASSE DES QUATRE TUILES (26/11, maquette B « pause-café »)
    ═══════════════════════════════════════════════════════════════════════
    Une pause, c'est une tasse. Chaque tuile en porte une, en trait d'encre :
    la vapeur monte de la boîte, l'anse se décroche à droite, la ligne de
    niveau reste en pointillés tant qu'aucune pause n'est comptée. Le chiffre
    s'imprime SUR la porcelaine — c'est le seul endroit de la page où un
    nombre grandit là où on l'attend.

    Tout est en `currentColor` sauf la porcelaine : la tuile choisit sa
    teinte (`--pv-kpi-teinte`), le dessin suit. Aucune couleur écrite ici.
    ═══════════════════════════════════════════════════════════════════════ */
function TassePause({ niveau = 0, icone = null }) {
  return (
    <div className="pauses-v2-tasse-dessein">
      {/*  La vapeur : deux volutes qui partent du bord. Elles ne portent pas
          de donnée ici — c'est la pastille qui dit la nature du compteur. */}
      <svg className="pauses-v2-tasse-vapeur-svg" viewBox="0 0 60 40" fill="none" aria-hidden="true">
        <path d="M22 34c-6-6 4-9-1-15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M36 32c-5-5 3-8-1-12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>

      {/*  Le corps : parois légèrement rentrantes, fond bombé — une tasse de
          cantine, comme sur la maquette. */}
      <svg className="pauses-v2-tasse-corps-svg" viewBox="0 0 150 92" fill="none" aria-hidden="true">
        {/*  l'anse, pleine, à droite */}
        <path
          d="M112 36h5a14 14 0 0 1 0 30h-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M112 36h5a14 14 0 0 1 0 30h-8"
          fill="none"
          stroke="var(--pv-tasse-porcelaine)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/*  la panse */}
        <path
          d="M16 26h96l-3 30a22 22 0 0 1-22 20H41a22 22 0 0 1-22-20L16 26Z"
          fill="var(--pv-tasse-porcelaine)"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        {/*  le bord */}
        <path d="M12 26h104" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        {/*  la ligne de niveau : pointillés si vide, lavis si remplie */}
        <path
          d="M24 62h80"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={niveau > 0 ? '0' : '4 4'}
          opacity={niveau > 0 ? 0.9 : 0.5}
        />
        {niveau > 0 ? (
          <path d="M24 63h80l-2 14a16 16 0 0 1-16 12H42a16 16 0 0 1-16-12l-2-14Z" fill="currentColor" opacity="0.14" />
        ) : null}
      </svg>

      {/*  La soucoupe, large et plate, qui déborde sous la tasse. */}
      <svg className="pauses-v2-tasse-soucoupe" viewBox="0 0 190 26" fill="none" aria-hidden="true">
        <ellipse cx="95" cy="12" rx="92" ry="8" fill="var(--pv-tasse-porcelaine)" stroke="currentColor" strokeWidth="2.4" />
        <ellipse cx="95" cy="10" rx="60" ry="4" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
      </svg>

      {/*  La pastille d'icône, posée sur le bord comme sur la maquette. */}
      {icone ? <span className="pauses-v2-tasse-pastille">{icone}</span> : null}
    </div>
  )
}

export function PausesExecutiveKpis({
  paies = [],
  employesById = {},
  activeTab = 'all',
  subFilter = 'all',
  onSelectTab,
  onSelectSubFilter,
  nowMs = Date.now(),
}) {
  const activeRecords = useMemo(() => paies.filter((p) => p.statut !== 'ecartee'), [paies])
  const realPauses = useMemo(() => paies.filter((p) => estPauseReelleEffectuee(p)), [paies])
  const openPauses = useMemo(() => realPauses.filter((p) => p.ouverte), [realPauses])
  const presumedPending = useMemo(() => paies.filter((p) => p.statut === 'presumee'), [paies])
  const anomaliesPauses = useMemo(() => paies.filter((p) => Boolean(p.anomalie) && p.statut !== 'ecartee'), [paies])

  const realDurationMin = useMemo(
    () =>
      realPauses.reduce((acc, p) => {
        if (p.ouverte && p.debutISO) {
          const elapsedMin = Math.max(0, Math.round((nowMs - new Date(p.debutISO).getTime()) / 60000))
          return acc + elapsedMin
        }
        return acc + (Number(p.dureeMinutes) || 0)
      }, 0),
    [realPauses, nowMs]
  )

  const totalBase = Math.max(1, activeRecords.length)
  const openPct = activeRecords.length > 0 ? Math.min(100, Math.round((openPauses.length / Math.max(1, realPauses.length)) * 100)) : 0
  const realPct = activeRecords.length > 0 ? Math.min(100, Math.round((realPauses.length / totalBase) * 100)) : 0
  const presumedPct = activeRecords.length > 0 ? Math.min(100, Math.round((presumedPending.length / totalBase) * 100)) : 0
  const anomaliesPct = activeRecords.length > 0 ? Math.min(100, Math.round((anomaliesPauses.length / totalBase) * 100)) : 0

  /*  LE VISAGE DE QUI A PRIS LA PAUSE — « dans l'avatar du kpi (image 2),
      tu n'as pas affiché l'image de celui qui a fait cette pause », 26/11.

      La pastille de la tasse portait une icône de série (groupe, sablier,
      triangle). Elle porte maintenant le visage de la personne concernée, la
      PLUS RÉCENTE de chaque carte : celle qui est en pause pour « En pause en
      direct », la dernière à avoir pris une pause réelle, la dernière
      présumée en attente, la dernière en anomalie.

      « Plus récente » se lit sur la date de début, pas sur l'ordre du
      tableau — le tableau est trié par ce qu'on veut, la pastille doit
      montrer un visage précis.

      L'icône reste dessous : sans photo, ou si la photo rate, on retombe
      sur le pictogramme d'origine — la pastille n'est jamais vide. */
  const plusRecente = (liste) =>
    liste.reduce((recente, p) => {
      if (!recente) return p
      const a = new Date(p.debutISO || `${p.jour || p.date || ''}`).getTime() || 0
      const b = new Date(recente.debutISO || `${recente.jour || recente.date || ''}`).getTime() || 0
      return a >= b ? p : recente
    }, null)

  const pastillePause = (pause, Icone) => {
    if (!pause) return <Icone size={19} />
    const emp = employesById[pause.employe_id] || null
    if (!emp?.photo_url) return <Icone size={19} />
    const initiales = (pause.employe || emp.first_name || 'EC')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    return (
      <span className="pauses-v2-tasse-pastille-vide" title={pause.employe || undefined}>
        <PhotoSignee
          url={emp.photo_url}
          alt={pause.employe || ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          fallback={<span aria-hidden="true" className="pauses-v2-tasse-pastille-initiales">{initiales}</span>}
        />
      </span>
    )
  }

  return (
    <>
      {/* Bandeau Chronomètre Dynamique en Direct dès qu'une pause réelle est déclenchée */}
      {openPauses.length > 0 && (
        <section className="pauses-v2-live-banner" aria-label="Pauses réelles en cours en direct">
          <div className="pauses-v2-live-banner-left">
            <span className="pauses-v2-live-pulse-dot" />
            <strong style={{ fontSize: '0.88rem', color: 'var(--pv-text)' }}>
              {openPauses.length === 1
                ? '1 collaborateur est actuellement en pause réelle :'
                : `${openPauses.length} collaborateurs sont actuellement en pause réelle :`}
            </strong>
            {openPauses.map((op) => (
              <span key={op.id} className="pauses-v2-live-chip">
                <Timer size={14} color="#f59e0b" />
                <strong>{op.employe}</strong>
                {op.matricule && <span style={{ opacity: 0.72 }}>({op.matricule})</span>}
                <span style={{ opacity: 0.8 }}>depuis {op.debutHHMM}</span>
                <span className="pauses-v2-live-timer-mono">
                  ⏱️ {formaterTempsPauseEnDirect(op, nowMs)}
                </span>
              </span>
            ))}
          </div>
          <button
            type="button"
            className="pauses-v2-Ghost-btn"
            onClick={() => {
              onSelectTab && onSelectTab('reelles')
              onSelectSubFilter && onSelectSubFilter('en_direct')
            }}
          >
            Filtrer les pauses en direct
          </button>
        </section>
      )}

      {/* 4 Cartes KPI Exécutives (fidèles à redesign-pauses-v2.png) */}
      <section className="pauses-v2-kpi-grid" aria-label="Indicateurs exécutifs des pauses">
        {/* CARTE 1 : EN PAUSE EN DIRECT */}
        <button
          type="button"
          className={`pauses-v2-kpi-card is-amber${subFilter === 'en_direct' ? ' is-selected' : ''}`}
          onClick={() => {
            if (subFilter === 'en_direct') {
              onSelectTab && onSelectTab('all')
              onSelectSubFilter && onSelectSubFilter('all')
            } else {
              onSelectTab && onSelectTab('reelles')
              onSelectSubFilter && onSelectSubFilter('en_direct')
            }
          }}
        >
          <AdinkraWatermarkSvg className="pointages-kpi-watermark" />
          <div className="pauses-v2-tasse-boite" data-teinte="ambre">
            <TassePause niveau={openPauses.length} icone={pastillePause(plusRecente(openPauses), Coffee)} />
            <strong className="pauses-v2-kpi-number">
              {String(openPauses.length).padStart(2, '0')}
            </strong>
          </div>
          <div className="pauses-v2-kpi-top">
            <div>
              <span className="pauses-v2-kpi-label">En pause en direct</span>
              {openPauses.length > 0 && (
                <span className="pauses-v2-kpi-live-sub">
                  <Timer size={12} />
                  <span>
                    {openPauses[0].employe} · {formaterTempsPauseEnDirect(openPauses[0], nowMs)} (depuis {openPauses[0].debutHHMM})
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="pauses-v2-kpi-bar-row">
            <div className="pauses-v2-kpi-track">
              <span
                className="pauses-v2-kpi-fill"
                style={{
                  width: `${openPauses.length > 0 ? Math.max(16, openPct) : 0}%`,
                  background: 'var(--charte-aplat)',
                }}
              />
            </div>
            <span className="pauses-v2-kpi-pct">{openPct}%</span>
          </div>
        </button>

        {/* CARTE 2 : PAUSES RÉELLES */}
        <button
          type="button"
          className={`pauses-v2-kpi-card is-emerald${activeTab === 'reelles' && subFilter !== 'en_direct' ? ' is-selected' : ''}`}
          onClick={() => {
            onSelectTab && onSelectTab(activeTab === 'reelles' && subFilter === 'all' ? 'all' : 'reelles')
            onSelectSubFilter && onSelectSubFilter('all')
          }}
        >
          <AdinkraWatermarkSvg className="pointages-kpi-watermark" />
          <div className="pauses-v2-tasse-boite" data-teinte="emeraude">
            <TassePause niveau={realPauses.length} icone={pastillePause(plusRecente(realPauses), Users)} />
            <strong className="pauses-v2-kpi-number">
              {String(realPauses.length).padStart(2, '0')}
            </strong>
          </div>
          <div className="pauses-v2-kpi-top">
            <div>
              <span className="pauses-v2-kpi-label">
                Pauses réelles · {formatDuree(realDurationMin)}
              </span>
            </div>
          </div>
          <div className="pauses-v2-kpi-bar-row">
            <div className="pauses-v2-kpi-track">
              <span
                className="pauses-v2-kpi-fill"
                style={{
                  width: `${realPauses.length > 0 ? Math.max(12, realPct) : 0}%`,
                  background: 'var(--charte-succes)',
                }}
              />
            </div>
            <span className="pauses-v2-kpi-pct">{realPct}%</span>
          </div>
        </button>

        {/* CARTE 3 : PRÉSUMÉES À STATUER */}
        <button
          type="button"
          className={`pauses-v2-kpi-card is-copper${activeTab === 'presumees' ? ' is-selected' : ''}`}
          onClick={() => {
            onSelectTab && onSelectTab(activeTab === 'presumees' ? 'all' : 'presumees')
            onSelectSubFilter && onSelectSubFilter('presumees_a_statuer')
          }}
        >
          <AdinkraWatermarkSvg className="pointages-kpi-watermark" />
          <div className="pauses-v2-tasse-boite" data-teinte="terre">
            <TassePause niveau={presumedPending.length} icone={pastillePause(plusRecente(presumedPending), Hourglass)} />
            <strong className="pauses-v2-kpi-number">
              {String(presumedPending.length).padStart(2, '0')}
            </strong>
          </div>
          <div className="pauses-v2-kpi-top">
            <div>
              <span className="pauses-v2-kpi-label">Présumées à statuer</span>
            </div>
          </div>
          <div className="pauses-v2-kpi-bar-row">
            <div className="pauses-v2-kpi-track">
              <span
                className="pauses-v2-kpi-fill"
                style={{
                  width: `${presumedPending.length > 0 ? Math.max(12, presumedPct) : 0}%`,
                  background: 'var(--charte-texte)',
                }}
              />
            </div>
            <span className="pauses-v2-kpi-pct">{presumedPct}%</span>
          </div>
        </button>

        {/* CARTE 4 : ANOMALIES */}
        <button
          type="button"
          className={`pauses-v2-kpi-card is-coral${activeTab === 'anomalies' ? ' is-selected' : ''}`}
          onClick={() => {
            onSelectTab && onSelectTab(activeTab === 'anomalies' ? 'all' : 'anomalies')
            onSelectSubFilter && onSelectSubFilter('anomalies_toutes')
          }}
        >
          <AdinkraWatermarkSvg className="pointages-kpi-watermark" />
          <div className="pauses-v2-tasse-boite" data-teinte="corail">
            <TassePause niveau={anomaliesPauses.length} icone={pastillePause(plusRecente(anomaliesPauses), AlertTriangle)} />
            <strong className="pauses-v2-kpi-number">
              {String(anomaliesPauses.length).padStart(2, '0')}
            </strong>
          </div>
          <div className="pauses-v2-kpi-top">
            <div>
              <span className="pauses-v2-kpi-label">
                {anomaliesPauses.length > 1 ? 'Anomalies' : 'Anomalie'}
              </span>
            </div>
          </div>
          <div className="pauses-v2-kpi-bar-row">
            <div className="pauses-v2-kpi-track">
              <span
                className="pauses-v2-kpi-fill"
                style={{
                  width: `${anomaliesPauses.length > 0 ? Math.max(10, anomaliesPct) : 0}%`,
                  background: 'var(--charte-erreur)',
                }}
              />
            </div>
            <span className="pauses-v2-kpi-pct">{anomaliesPct}%</span>
          </div>
        </button>
      </section>
    </>
  )
}

export function PausesAnalyticsCharts({ paies = [], onSelectTab }) {
  const [chartScope, setChartScope] = useState('all')
  //  Tranche horaire parcourue dans l'histogramme (null = aucune sélection).
  const [activeHour, setActiveHour] = useState(null)

  // Histogramme horaire (08h -> 18h par défaut, étendu si pauses matinales/nocturnes)
  const { slots, maxCount } = useMemo(() => {
    const countsByHour = Array(24).fill(0)
    const pausesByHour = Array.from({ length: 24 }, () => [])

    for (const p of paies) {
      if (p.statut === 'ecartee') continue
      if (chartScope === 'reelles' && !estPauseReelleEffectuee(p)) continue
      if (chartScope === 'presumees' && !estPausePresumee(p)) continue

      let hour = null
      if (p.debutISO) {
        const parts = getHeuresMinutesLocales(p.debutISO)
        if (parts && Number.isFinite(parts.heures)) hour = parts.heures
      }
      if (hour === null && p.debutHHMM && /^\d{2}:\d{2}/.test(p.debutHHMM)) {
        hour = parseInt(p.debutHHMM.slice(0, 2), 10)
      }
      if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
        countsByHour[hour] += 1
        pausesByHour[hour].push(p)
      }
    }

    let minH = 8
    let maxH = 18
    for (let h = 0; h < 24; h++) {
      if (countsByHour[h] > 0) {
        if (h < minH) minH = h
        if (h > maxH) maxH = h
      }
    }

    const result = []
    for (let h = minH; h <= maxH; h++) {
      result.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}h`,
        count: countsByHour[h],
        pauses: pausesByHour[h] || [],
      })
    }

    const peak = Math.max(4, ...result.map((s) => s.count))
    return { slots: result, maxCount: peak }
  }, [paies, chartScope])

  // Statistiques du Donut (Réelles vs Présumées vs Anomalies)
  const donutStats = useMemo(() => {
    const active = paies.filter((p) => p.statut !== 'ecartee')
    const realList = active.filter((p) => estPauseReelleEffectuee(p))
    const presumedList = active.filter((p) => estPausePresumee(p))
    const anomalyList = active.filter((p) => Boolean(p.anomalie))

    const realMin = realList.reduce((acc, p) => acc + (Number(p.dureeMinutes) || 0), 0)
    const presumedMin = presumedList.reduce((acc, p) => acc + (Number(p.dureeMinutes) || 0), 0)
    const anomalyMin = anomalyList.reduce((acc, p) => acc + (Number(p.dureeMinutes) || 0), 0)

    const total = Math.max(1, realList.length + presumedList.length)
    const realPct = active.length > 0 ? Math.round((realList.length / total) * 100) : 0
    const presumedPct = active.length > 0 ? Math.max(0, 100 - realPct) : 0
    const anomalyPct = active.length > 0 ? Math.min(100, Math.round((anomalyList.length / total) * 100)) : 0

    return {
      realCount: realList.length,
      presumedCount: presumedList.length,
      anomalyCount: anomalyList.length,
      realMin,
      presumedMin,
      anomalyMin,
      realPct,
      presumedPct,
      anomalyPct,
      total,
    }
  }, [paies])

  const circumference = 2 * Math.PI * 46
  const realArc = (donutStats.realCount / donutStats.total) * circumference
  const presumedArc = (donutStats.presumedCount / donutStats.total) * circumference

  const yTicks = useMemo(() => {
    const top = Math.ceil(maxCount / 3) * 3
    return [
      { label: top, y: 26 },
      { label: Math.round((top * 2) / 3), y: 66 },
      { label: Math.round(top / 3), y: 106 },
      { label: 0, y: 146 },
    ]
  }, [maxCount])

  const chartTopVal = yTicks[0].label || 4

  //  La tranche sélectionnée est relue à chaque changement de `paies` :
  //  le panneau ne peut jamais afficher une pause qui n'est plus là.
  const activeSlot = useMemo(
    () => (activeHour === null ? null : slots.find((sl) => sl.hour === activeHour) || null),
    [activeHour, slots]
  )

  const dureeSlot = useMemo(
    () => (activeSlot ? activeSlot.pauses.reduce((acc, p) => acc + (Number(p.dureeMinutes) || 0), 0) : 0),
    [activeSlot]
  )

  return (
    <section className="pauses-v2-charts-grid" aria-label="Graphiques analytiques des pauses">
      {/* GRAPHIQUE GAUCHE : ACTIVITÉ DES PAUSES (HISTOGRAMME HORAIRE) */}
      <article className="pauses-v2-panel pauses-v2-planche-service">
        {/*  Les deux trous de la planche : c'est ce qui fait qu'on la
            reconnaît comme un objet de cuisine et non comme une carte. */}
        <span className="pauses-v2-planche-trou pauses-v2-planche-trou--g" aria-hidden="true" />
        <span className="pauses-v2-planche-trou pauses-v2-planche-trou--d" aria-hidden="true" />
        <div className="pauses-v2-panel-head">
          <div className="pauses-v2-panel-title-wrap">
            <div className="pauses-v2-panel-icon">
              <BarChart3 size={18} />
            </div>
            <div>
              <h3 className="pauses-v2-panel-title">Activité des pauses</h3>
              <p className="pauses-v2-panel-subtitle">Nombre de pauses par tranche horaire</p>
            </div>
          </div>

          <select
            className="pauses-v2-select"
            value={chartScope}
            onChange={(e) => setChartScope(e.target.value)}
            aria-label="Filtrer les pauses du graphique"
          >
            <option value="all">Toutes les pauses</option>
            <option value="reelles">Pauses réelles pointées</option>
            <option value="presumees">Pauses présumées</option>
          </select>
        </div>

        <svg
          viewBox="0 0 580 174"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label="Histogramme du nombre de pauses par tranche horaire"
        >

          {/* Lignes de grille horizontales */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <text x="8" y={t.y + 3} fontSize="10" fill="currentColor" opacity="0.55">
                {t.label}
              </text>
              <line
                x1="34"
                y1={t.y}
                x2="566"
                y2={t.y}
                stroke="currentColor"
                strokeOpacity="0.1"
              />
            </g>
          ))}

          {/* Barres horaires */}
          {slots.map((slot, idx) => {
            const slotWidth = 524 / Math.max(1, slots.length)
            const slotX = 38 + idx * slotWidth
            const xCenter = slotX + slotWidth / 2
            const barWidth = Math.min(28, Math.max(14, slotWidth * 0.56))
            const baseLine = 146
            const maxBarHeight = 116
            const rawHeight = (slot.count / chartTopVal) * maxBarHeight
            const barHeight = slot.count > 0 ? Math.max(8, rawHeight) : 2
            const isActiveSlot = activeHour === slot.hour

            return (
              <g
                key={slot.label}
                className={`pauses-v2-hour-slot${isActiveSlot ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${slot.label} : ${slot.count} pause(s) — voir le détail`}
                onClick={() => setActiveHour(isActiveSlot ? null : slot.hour)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveHour(isActiveSlot ? null : slot.hour)
                  } else if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    setActiveHour((prev) => {
                      if (prev === null) return slots[0]?.hour ?? null
                      const i = slots.findIndex((sl) => sl.hour === prev)
                      return slots[(i + 1) % slots.length]?.hour ?? prev
                    })
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    setActiveHour((prev) => {
                      if (prev === null) return slots[slots.length - 1]?.hour ?? null
                      const i = slots.findIndex((sl) => sl.hour === prev)
                      return slots[(i - 1 + slots.length) % slots.length]?.hour ?? prev
                    })
                  } else if (event.key === 'Escape') {
                    setActiveHour(null)
                  }
                }}
              >
                <rect
                  className="pauses-v2-hour-hit"
                  x={slotX}
                  y={22}
                  width={slotWidth}
                  height={148}
                  rx="6"
                />
                {/*  LA CUILLÈRE — comme sur la maquette. Douze cuillères
                    debout sur la planche, manche en bas, cuilleron en haut.

                    UN SEUL CHEMIN, pas un ovale posé sur une tige : c'est ce
                    qui rate quand on dessine une cuillère en deux morceaux —
                    on voit le raccord. Le contour part du talon, remonte à
                    gauche, s'évase dans le cuilleron, redescend à droite.

                    Vide = contour pointillé. Pleine = contour franc, lavis
                    dedans. La hauteur du cuilleron suivrait la donnée. */}
                <g className={`pauses-v2-cuillere${slot.count > 0 ? ' is-pleine' : ''}`}>
                  <title>{`${slot.label} · ${slot.count} pause(s)`}</title>
                  <path
                    className="pauses-v2-cuillere-corps"
                    d={`M${xCenter - 5} ${baseLine}
                        V${baseLine - 40}
                        C${xCenter - 5} ${baseLine - 52}, ${xCenter - 15} ${baseLine - 54}, ${xCenter - 15} ${baseLine - 66}
                        a15 22 0 1 1 30 0
                        C${xCenter + 15} ${baseLine - 54}, ${xCenter + 5} ${baseLine - 52}, ${xCenter + 5} ${baseLine - 40}
                        V${baseLine}Z`}
                    fill={slot.count > 0 ? 'var(--charte-surface)' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeDasharray={slot.count > 0 ? '0' : '3.5 3.5'}
                  />
                  {/*  Le reflet : un arc à gauche du cuilleron. */}
                  <path
                    d={`M${xCenter - 7} ${baseLine - 74}
                        a9 12 0 0 1 0 -12`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.45"
                  />
                </g>
                {slot.count > 0 && (
                  <text
                    x={xCenter}
                    y={baseLine - Math.max(26, barHeight) - 18}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="800"
                    fill="currentColor"
                    opacity="0.9"
                  >
                    {slot.count}
                  </text>
                )}
                <text
                  x={xCenter}
                  y="164"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="650"
                  fill="currentColor"
                  opacity="0.65"
                >
                  {slot.label}
                </text>
              </g>
            )
          })}
        </svg>

        {activeSlot ? (
          <div className="pauses-v2-hour-detail" role="status" aria-live="polite">
            <div className="pauses-v2-hour-detail-head">
              <strong>{activeSlot.label}</strong>
              <span>
                {activeSlot.pauses.length} pause{activeSlot.pauses.length > 1 ? 's' : ''} ·{' '}
                {dureeSlot} min au total
              </span>
              <button
                type="button"
                className="pauses-v2-hour-detail-close"
                onClick={() => setActiveHour(null)}
              >
                Fermer
              </button>
            </div>

            {activeSlot.pauses.length === 0 ? (
              <p className="pauses-v2-hour-detail-empty">
                Aucune pause démarrée entre {activeSlot.label} et{' '}
                {`${String((activeSlot.hour + 1) % 24).padStart(2, '0')}h`}.
              </p>
            ) : (
              <ul className="pauses-v2-hour-detail-list">
                {activeSlot.pauses.map((p) => (
                  <li key={p.id || `${p.employe_id}-${p.debutISO}`}>
                    <span
                      className={`pauses-v2-hour-detail-dot${estPauseReelleEffectuee(p) ? ' is-real' : ' is-presumed'}`}
                      aria-hidden="true"
                    />
                    <strong>{p.employe || 'Employé'}</strong>
                    {p.matricule ? <em>{p.matricule}</em> : null}
                    <span className="pauses-v2-hour-detail-time">
                      {p.debutHHMM || '--:--'} → {p.finHHMM || 'en cours'}
                    </span>
                    <span className="pauses-v2-hour-detail-nature">
                      {p.natureLabel || (estPauseReelleEffectuee(p) ? 'Pause réelle' : 'Pause présumée')}
                    </span>
                    <span className="pauses-v2-hour-detail-duree">{formatDuree(p.dureeMinutes)}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="pauses-v2-hour-detail-hint">
              Cliquez une tranche pour la lire · ← → pour parcourir · Échap pour quitter.
            </p>
          </div>
        ) : (
          <p className="pauses-v2-hour-detail-hint is-idle">
            Cliquez sur une tranche du graphique (ou utilisez ← →) pour lire qui a pris une pause, sur quelle plage et de quelle nature.
          </p>
        )}
      </article>

      {/* GRAPHIQUE DROITE : RÉPARTITION DES PAUSES (DONUT + LÉGENDE ALIGNÉE) */}
      <article className="pauses-v2-panel pauses-v2-panneau-tasse">
        <div className="pauses-v2-panel-head">
          <div className="pauses-v2-panel-title-wrap">
            <div className="pauses-v2-panel-icon">
              <PieChart size={18} />
            </div>
            <div>
              <h3 className="pauses-v2-panel-title">Répartition des pauses</h3>
              <p className="pauses-v2-panel-subtitle">Sur la période sélectionnée</p>
            </div>
          </div>
        </div>

        <div className="pauses-v2-donut-layout">
          <div className="pauses-v2-tasse-dessus">
            <svg
              className="pauses-v2-tasse-dessus-anse"
              viewBox="0 0 40 60"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M4 12c16-6 28 4 28 18s-12 24-28 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M4 12c16-6 28 4 28 18s-12 24-28 18"
                fill="none"
                stroke="var(--charte-surface)"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
            <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }} aria-hidden="true">
              {/*  LA CREMA : le café au lait dans le creux de la tasse.
                  C'est le fond du graphique — la part non consommée. */}
              <circle
                cx="60"
                cy="60"
                r="46"
                fill="none"
                stroke="var(--charte-surface2)"
                strokeWidth="14"
              />
              {/*  Le liseré de porcelaine, juste à l'intérieur du bord. */}
              <circle
                cx="60"
                cy="60"
                r="53.5"
                fill="none"
                stroke="var(--charte-encre)"
                strokeOpacity="0.22"
                strokeWidth="1.4"
              />
              {realArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke="var(--charte-succes)"
                  strokeWidth="14"
                  strokeDasharray={`${realArc} ${circumference}`}
                  transform="rotate(-90 60 60)"
                />
              )}
              {presumedArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke="var(--charte-aplat)"
                  strokeWidth="14"
                  strokeDasharray={`${presumedArc} ${circumference}`}
                  strokeDashoffset={-realArc}
                  transform="rotate(-90 60 60)"
                />
              )}
            </svg>
            <div className="pointages-donut-center">
              <strong style={{ fontSize: '1.5rem', fontWeight: 850 }}>{donutStats.realPct}%</strong>
              <span style={{ fontSize: '0.74rem', color: 'var(--pv-text-soft)', fontWeight: 700 }}>
                Pauses réelles
              </span>
            </div>
          </div>

          <div className="pauses-v2-donut-legend">
            <button
              type="button"
              className="pauses-v2-legend-item"
              onClick={() => onSelectTab && onSelectTab('reelles')}
            >
              <div className="pauses-v2-legend-left">
                <span className="pauses-v2-legend-dot" style={{ background: 'var(--charte-succes)' }} />
                <div>
                  <strong>Pauses réelles</strong>
                  <small>
                    {donutStats.realCount} pause{donutStats.realCount > 1 ? 's' : ''} · {formatDuree(donutStats.realMin)}
                  </small>
                </div>
              </div>
              <span className="pauses-v2-legend-pct">{donutStats.realPct}%</span>
            </button>

            <button
              type="button"
              className="pauses-v2-legend-item"
              onClick={() => onSelectTab && onSelectTab('presumees')}
            >
              <div className="pauses-v2-legend-left">
                <span className="pauses-v2-legend-dot" style={{ background: 'var(--charte-aplat)' }} />
                <div>
                  <strong>Pauses présumées</strong>
                  <small>
                    {donutStats.presumedCount} pause{donutStats.presumedCount > 1 ? 's' : ''} · {formatDuree(donutStats.presumedMin)}
                  </small>
                </div>
              </div>
              <span className="pauses-v2-legend-pct">{donutStats.presumedPct}%</span>
            </button>

            <button
              type="button"
              className="pauses-v2-legend-item"
              onClick={() => onSelectTab && onSelectTab('anomalies')}
              style={{ borderBottomColor: 'transparent' }}
            >
              <div className="pauses-v2-legend-left">
                <span className="pauses-v2-legend-dot" style={{ background: 'var(--charte-erreur)' }} />
                <div>
                  <strong>Anomalies</strong>
                  <small>
                    {donutStats.anomalyCount} pause{donutStats.anomalyCount > 1 ? 's' : ''} · {formatDuree(donutStats.anomalyMin)}
                  </small>
                </div>
              </div>
              <span className="pauses-v2-legend-pct">{donutStats.anomalyPct}%</span>
            </button>
          </div>
        </div>
      </article>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CORBEILLE — « supprimer une pause » existe enfin, mais rien ne se perd
   ═══════════════════════════════════════════════════════════════════════════
   Une pause supprimée est ARCHIVÉE (copie intégrale) avant l'effacement :
   elle reste consultable ici, et peut être remise dans la liste d'un clic.
   ═══════════════════════════════════════════════════════════════════════════ */
export function PausesCorbeille ({ lignes = [], onRestaurer }) {
  if (!lignes || lignes.length === 0) return null

  return (
    <section className="pauses-v2-panel pauses-v2-journal-panel" aria-label="Corbeille des pauses supprimées">
      <div className="pauses-v2-panel-head">
        <div className="pauses-v2-panel-title-wrap">
          <div className="pauses-v2-panel-icon">
            <Trash2 size={18} />
          </div>
          <div>
            <h3 className="pauses-v2-panel-title">Corbeille des pauses</h3>
            <p className="pauses-v2-panel-subtitle">
              Rien ne se perd : chaque pause supprimée est archivée ici, avec son
              contenu exact, et peut être remise dans la liste d’un seul clic.
            </p>
          </div>
        </div>
        <span className="pauses-v2-journal-count">
          {lignes.length} supprimée{lignes.length > 1 ? 's' : ''}
        </span>
      </div>

      <ul className="pauses-v2-journal-list">
        {lignes.map((l) => {
          const debut = l.debut ? formaterHeureLocale(l.debut).slice(0, 5) : '--:--'
          const fin = l.fin ? formaterHeureLocale(l.fin).slice(0, 5) : 'en cours'
          return (
            <li key={l.journal_id} className="pauses-v2-journal-row is-ecartee">
              <span className="pauses-v2-journal-pill">🗑️ Supprimée</span>
              <strong className="pauses-v2-journal-emp">
                {`${l.prenom || ''} ${l.nom || ''}`.trim() || 'Collaborateur'}
              </strong>
              {l.matricule ? <em className="pauses-v2-journal-mat">#{l.matricule}</em> : null}
              <span className="pauses-v2-journal-when">
                {formatTableRowDate(l.jour)} · {debut} → {fin}
              </span>
              <span className="pauses-v2-journal-nature">
                {l.source === 'presumee' ? 'Pause présumée' : 'Pause réelle'}
              </span>
              <span className="pauses-v2-journal-duree">{formatDuree(Number(l.duree_minutes) || 0)}</span>
              {l.restaurable && onRestaurer ? (
                <button
                  type="button"
                  className="pauses-v2-journal-btn"
                  onClick={() => onRestaurer(l)}
                  title="Remettre cette pause dans la liste"
                >
                  ♻️ Remettre
                </button>
              ) : (
                <span className="pauses-v2-journal-nature" title="Une pause existe déjà à cet instant pour cet employé">
                  Déjà restaurée
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   JOURNAL DES DÉCISIONS — « aucune décision n'efface une ligne »
   ═══════════════════════════════════════════════════════════════════════════
   Une pause VALIDÉE ou ÉCARTÉE reste listée ici, quelle que soit la vue.
   C'est la réponse à « je ne retrouve plus ma pause nulle part » : chaque
   décision est tracée, avec un bouton qui ramène la ligne dans le tableau.
   ═══════════════════════════════════════════════════════════════════════════ */
export function PausesJournalDecisions ({ paies = [], onVoir, onAnnuler }) {
  const decisions = useMemo(
    () =>
      (paies || [])
        .filter((p) => p.statut === 'validee' || p.statut === 'ecartee')
        .sort(
          (a, b) =>
            String(b.jour || '').localeCompare(String(a.jour || '')) ||
            String(b.debutHHMM || '').localeCompare(String(a.debutHHMM || ''))
        ),
    [paies]
  )

  return (
    <section
      className={`pauses-v2-panel pauses-v2-journal-panel${decisions.length === 0 ? ' is-vide' : ''}`}
      aria-label="Journal des décisions sur les pauses"
    >
      <div className="pauses-v2-panel-head">
        <div className="pauses-v2-panel-title-wrap">
          <div className="pauses-v2-panel-icon">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <h3 className="pauses-v2-panel-title">Journal des décisions</h3>
            <p className="pauses-v2-panel-subtitle">
              Toute pause validée ou écartée reste listée ici — Valider et Écarter
              changent le statut, jamais l’existence de la ligne.
            </p>
          </div>
        </div>
        <span className="pauses-v2-journal-count">
          {decisions.length} décision{decisions.length > 1 ? 's' : ''} sur la période
        </span>
      </div>

      {decisions.length === 0 ? (
        <p className="pauses-v2-journal-empty">
          Aucune décision enregistrée sur la période affichée. Dès qu’une pause est
          validée ou écartée, elle apparaît ici et reste retrouvable.
        </p>
      ) : (
        <ul className="pauses-v2-journal-list">
          {decisions.map((p) => {
            const validee = p.statut === 'validee'
            const estPresumee = estPausePresumee(p)
            return (
              <li
                key={p.id || `${p.employe_id}-${p.debutISO}`}
                className={`pauses-v2-journal-row ${validee ? 'is-validee' : 'is-ecartee'}`}
              >
                <span className="pauses-v2-journal-pill">
                  {validee ? '✓ Validée' : '🚫 Écartée'}
                </span>
                <strong className="pauses-v2-journal-emp">{p.employe || 'Collaborateur'}</strong>
                {p.matricule ? <em className="pauses-v2-journal-mat">#{p.matricule}</em> : null}
                <span className="pauses-v2-journal-when">
                  {formatTableRowDate(p.jour)} · {p.debutHHMM || '--:--'} → {p.finHHMM || 'en cours'}
                </span>
                <span className="pauses-v2-journal-nature">
                  {p.natureLabel || (estPresumee ? 'Pause présumée' : 'Pause réelle')}
                </span>
                <span className="pauses-v2-journal-duree">{formatDuree(p.dureeMinutes)}</span>
                {p.ouverte ? (
                  <span className="pauses-v2-journal-nature" title="Pause ouverte : l’employé n’a pas encore pointé sa reprise">
                    ⏱️ En cours
                  </span>
                ) : null}
                {p.recupereeDirecte ? (
                  <span
                    className="pauses-v2-journal-nature"
                    title="Cette ligne existe bien en base, mais la fonction de lecture ne la renvoyait pas — elle a été récupérée en lecture directe de la table."
                  >
                    ⌁ Lecture directe
                  </span>
                ) : null}
                {onVoir && (
                  <button
                    type="button"
                    className="pauses-v2-journal-btn"
                    onClick={() => onVoir(p)}
                    title="Afficher cette pause dans le tableau"
                  >
                    Voir dans la liste
                  </button>
                )}
                {onAnnuler && (
                  <button
                    type="button"
                    className="pauses-v2-journal-btn is-undo"
                    onClick={() => onAnnuler(p)}
                    title="Revenir sur la décision : la pause reprend son statut d’origine"
                  >
                    ↩ Annuler la décision
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function PausesCollaborateursSection({
  paies = [],
  employesById = {},
  activeTab = 'all',
  subFilter = 'all',
  searchTerm = '',
  onSearchChange,
  onSelectTab,
  onSelectSubFilter,
  onStatuer,
  onAnnulerDecision,
  onSupprimer,
  onOpenEmployeeFiche,
  onOpenPointages,
  //  La personne qui met la table, en haut du plateau : sa photo quand elle
  //  en a une. « Pareil pour le cercle du superadmin, fais apparaître son
  //  image », 26/11.
  admin = null,
  nowMs = Date.now(),
}) {
  const realPauses = useMemo(() => paies.filter((p) => estPauseReelleEffectuee(p)), [paies])
  const presumedPauses = useMemo(() => paies.filter((p) => estPausePresumee(p) && p.statut !== 'ecartee'), [paies])
  const presumedPending = useMemo(() => presumedPauses.filter((p) => p.statut === 'presumee'), [presumedPauses])
  const anomaliesPauses = useMemo(() => paies.filter((p) => Boolean(p.anomalie) && p.statut !== 'ecartee'), [paies])
  const openPauses = useMemo(() => realPauses.filter((p) => p.ouverte), [realPauses])

  const filteredList = useMemo(() => {
    let base = []
    if (activeTab === 'reelles') {
      base = realPauses
      if (subFilter === 'reelles_pointees') base = base.filter((p) => p.source === 'pointee')
      else if (subFilter === 'reelles_admin') base = base.filter((p) => p.source === 'admin')
      else if (subFilter === 'reelles_hors_planning') base = base.filter((p) => p.estNonPlanifiee)
      else if (subFilter === 'en_direct') base = base.filter((p) => p.ouverte)
    } else if (activeTab === 'presumees') {
      base = presumedPauses
      if (subFilter === 'presumees_a_statuer') base = base.filter((p) => p.statut === 'presumee')
      else if (subFilter === 'presumees_validees') base = base.filter((p) => p.statut === 'validee')
    } else if (activeTab === 'anomalies') {
      base = anomaliesPauses
      if (subFilter === 'anomalie_sans_reprise') base = base.filter((p) => p.anomalie === 'sans_reprise')
      else if (subFilter === 'anomalie_trop_longue') base = base.filter((p) => p.anomalie === 'trop_longue')
      else if (subFilter === 'anomalie_depassement') base = base.filter((p) => p.anomalie === 'depassement')
    } else {
      // Vue 'all' : pauses en direct en tête, puis réelles et présumées non
      // écartées. Le sous-filtre 'ecartees' est la porte de secours : une
      // pause écartée reste consultable, jamais volatilisée.
      base =
        subFilter === 'ecartees'
          ? paies.filter((p) => p.statut === 'ecartee')
          : paies.filter((p) => p.statut !== 'ecartee')
      if (subFilter === 'en_direct') base = base.filter((p) => p.ouverte)
      else if (subFilter === 'reelles_hors_planning') base = base.filter((p) => p.estNonPlanifiee)
    }

    const q = String(searchTerm || '').trim().toLowerCase()
    const searched = !q
      ? base
      : base.filter((p) => {
          const emp = employesById[p.employe_id]
          const dept = emp?.department || emp?.position || ''
          const hay = `${p.employe || ''} ${p.matricule || ''} ${p.entreprise_nom || ''} ${dept} ${p.motif || ''}`.toLowerCase()
          return hay.includes(q)
        })

    // Toujours mettre les pauses en cours en tout premier pour les voir immédiatement
    return [...searched].sort((a, b) => {
      if (a.ouverte && !b.ouverte) return -1
      if (!a.ouverte && b.ouverte) return 1
      return 0
    })
  }, [activeTab, subFilter, realPauses, presumedPauses, anomaliesPauses, paies, searchTerm, employesById])

  const selectDropdownValue = useMemo(() => {
    if (subFilter === 'en_direct') return 'en_direct'
    if (activeTab === 'reelles' && subFilter === 'reelles_pointees') return 'reelles_pointees'
    if (activeTab === 'reelles' && subFilter === 'reelles_admin') return 'reelles_admin'
    if (subFilter === 'reelles_hors_planning') return 'reelles_hors_planning'
    if (activeTab === 'reelles') return 'reelles_all'
    if (activeTab === 'presumees' && subFilter === 'presumees_a_statuer') return 'presumees_a_statuer'
    if (activeTab === 'presumees' && subFilter === 'presumees_validees') return 'presumees_validees'
    if (activeTab === 'presumees') return 'presumees_all'
    if (activeTab === 'anomalies') return 'anomalies_all'
    return 'all'
  }, [activeTab, subFilter])

  const handleStatusDropdownChange = (val) => {
    if (val === 'all') {
      onSelectTab && onSelectTab('all')
      onSelectSubFilter && onSelectSubFilter('all')
    } else if (val === 'en_direct') {
      onSelectTab && onSelectTab('reelles')
      onSelectSubFilter && onSelectSubFilter('en_direct')
    } else if (val === 'ecartees') {
      onSelectTab && onSelectTab('all')
      onSelectSubFilter && onSelectSubFilter('ecartees')
    } else if (val === 'reelles_all') {
      onSelectTab && onSelectTab('reelles')
      onSelectSubFilter && onSelectSubFilter('all')
    } else if (val === 'reelles_pointees' || val === 'reelles_admin' || val === 'reelles_hors_planning') {
      onSelectTab && onSelectTab('reelles')
      onSelectSubFilter && onSelectSubFilter(val)
    } else if (val === 'presumees_all') {
      onSelectTab && onSelectTab('presumees')
      onSelectSubFilter && onSelectSubFilter('all')
    } else if (val === 'presumees_a_statuer' || val === 'presumees_validees') {
      onSelectTab && onSelectTab('presumees')
      onSelectSubFilter && onSelectSubFilter(val)
    } else if (val === 'anomalies_all') {
      onSelectTab && onSelectTab('anomalies')
      onSelectSubFilter && onSelectSubFilter('anomalies_toutes')
    }
  }

  const adminInitiales = `${admin?.first_name?.[0] || ''}${admin?.last_name?.[0] || ''}`.toUpperCase() || 'AD'
  const adminNom = `${admin?.first_name || ''} ${admin?.last_name || ''}`.trim() || 'Administrateur'

  return (
    <section className="pauses-v2-panel pauses-v2-table-section" aria-label="Pauses des employés">
      {/* En-tête de la table — posé sur le papier, pas dans une carte. */}
      <div className="pauses-v2-panel-head pauses-v2-table-head">
        <div className="pauses-v2-panel-title-wrap">
          {/*  Le cercle portait l'icône « groupe » : il porte maintenant la
               personne qui tient la table. C'est un visage, pas un pictogramme. */}
          <div className="pauses-v2-panel-icon pauses-v2-panel-icon--hote">
            <PhotoSignee
              url={admin?.photo_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              fallback={<span aria-hidden="true">{adminInitiales}</span>}
            />
          </div>
          <div>
            <h2 className="pauses-v2-panel-title">Pauses des employés</h2>
            <p className="pauses-v2-panel-subtitle">
              <span className="pauses-v2-panel-hote">Suivi par {adminNom}</span>
              {' · '}
              {filteredList.length} pause{filteredList.length > 1 ? 's' : ''} affichée{filteredList.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Barre de recherche + Filtre de statut + Actions en lot */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {presumedPending.length > 1 && onStatuer && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="pauses-v2-btn-validate"
                onClick={() => onStatuer(presumedPending.map((p) => p.id), 'valider')}
                title="Valider toutes les pauses présumées en attente"
              >
                <Check size={13} />
                <span>Valider les {presumedPending.length} présumées</span>
              </button>
              <button
                type="button"
                className="pauses-v2-btn-reject"
                onClick={() => onStatuer(presumedPending.map((p) => p.id), 'ecarter')}
                title="Écarter toutes les pauses présumées en attente"
              >
                <X size={13} />
                <span>Tout écarter</span>
              </button>
            </div>
          )}

          {/* Recherche employé */}
          <label className="pauses-v2-search">
            <Search size={14} color="var(--pv-muted)" />
            <input
              type="search"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}

            />
          </label>

          {/* Menu déroulant Tous les statuts */}
          <select
            className="pauses-v2-select"
            value={selectDropdownValue}
            onChange={(e) => handleStatusDropdownChange(e.target.value)}
            aria-label="Filtrer par statut de pause"
          >
            <option value="all">Tous les statuts ({paies.filter((p) => p.statut !== 'ecartee').length})</option>
            <option value="en_direct">⏱️ En pause en direct ({openPauses.length})</option>
            <option value="reelles_all">✓ Pauses réelles ({realPauses.length})</option>
            <option value="ecartees">🗑️ Écartées ({paies.filter((p) => p.statut === 'ecartee').length})</option>
            <option value="reelles_pointees">📱 Réelles pointées ({realPauses.filter((p) => p.source === 'pointee').length})</option>
            <option value="reelles_admin">🛡️ Saisies par l’admin ({realPauses.filter((p) => p.source === 'admin').length})</option>
            <option value="reelles_hors_planning">⚡ Hors planning ({realPauses.filter((p) => p.estNonPlanifiee).length})</option>
            <option value="presumees_a_statuer">⏳ Présumées à statuer ({presumedPending.length})</option>
            <option value="presumees_all">📋 Toutes les présumées ({presumedPauses.length})</option>
            <option value="presumees_validees">✓ Présumées validées ({presumedPauses.filter((p) => p.statut === 'validee').length})</option>
            <option value="anomalies_all">⚠️ Anomalies ({anomaliesPauses.length})</option>
          </select>
        </div>
      </div>

      {/* Onglets rapides */}
      <div role="tablist" aria-label="Onglets rapides des pauses" className="pauses-v2-onglets">
        {[
          { id: 'all', label: `Toutes (${paies.filter((p) => p.statut !== 'ecartee').length})`, active: activeTab === 'all' && subFilter === 'all' },
          { id: 'en_direct', label: `⏱️ En direct (${openPauses.length})`, active: subFilter === 'en_direct' },
          { id: 'reelles', label: `✓ Pauses réelles (${realPauses.length})`, active: activeTab === 'reelles' && subFilter !== 'en_direct' },
          { id: 'presumees', label: `⏳ Présumées (${presumedPauses.length})`, active: activeTab === 'presumees' },
          { id: 'anomalies', label: `⚠️ Anomalies (${anomaliesPauses.length})`, active: activeTab === 'anomalies' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.active}
            className="pauses-v2-Ghost-btn"
            data-actif={t.active ? 'oui' : 'non'}
            onClick={() => {
              if (t.id === 'en_direct') {
                onSelectTab && onSelectTab('reelles')
                onSelectSubFilter && onSelectSubFilter('en_direct')
              } else {
                onSelectTab && onSelectTab(t.id)
                onSelectSubFilter && onSelectSubFilter('all')
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tableau RH des pauses — posé sur la Grande Table.

          Trois décors d'objet, relevés sur la maquette : les ronds d'eau
          laissés par les verres dans la marge gauche, l'assiette de service
          à cheval sur le bord droit, et le tissu kente qui pend sous le coin
          bas gauche. Ils sont purement décoratifs (`aria-hidden`) et
          n'existent qu'en grand écran : sous 700 px la table devient une
          pile de fiches et ces ornements n'auraient plus de sens. */}
      {filteredList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '42px 18px', color: 'var(--pv-muted)' }}>
          <Coffee size={36} color="var(--pv-gold)" style={{ opacity: 0.75, marginBottom: 8 }} />
          <h3 style={{ margin: '0 0 6px', color: 'var(--pv-text)', fontSize: '1rem', fontWeight: 800 }}>
            Aucune pause trouvée pour ce filtre
          </h3>
          <p style={{ margin: '0 auto', maxWidth: 460, fontSize: '0.82rem' }}>
            Changez la période en haut (Jour / Semaine / Mois) ou sélectionnez « Toutes » pour afficher l’ensemble des pauses.
          </p>
        </div>
      ) : (
        <div className="pauses-v2-table-scene">
          <span className="pauses-v2-table-service" aria-hidden="true" />
          <span className="pauses-v2-table-serviette" aria-hidden="true" />
          <div className="pauses-v2-table-wrap">
            <table className="pauses-v2-table">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Service</th>
                <th>Date</th>
                <th>Plage horaire</th>
                <th>Durée</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((p) => {
                const empObj = employesById[p.employe_id] || null
                const initials = (p.employe || 'EC')
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
                const serviceLabel =
                  empObj?.department ||
                  empObj?.position ||
                  p.entreprise_nom ||
                  'Équipe'
                const anomalie = badgeAnomalieDetaillee(p)
                const motifFermeture = badgeMotifFermeture(p)
                const isPresumed = estPausePresumee(p)
                const isReal = estPauseReelleEffectuee(p)
                const liveElapsed = p.ouverte ? formaterTempsPauseEnDirect(p, nowMs) : null

                return (
                  <tr key={p.id} className={p.ouverte ? 'is-live-row' : undefined}>
                    {/* 1. Employé */}
                    <td data-col="Employé">
                      <div className="pauses-v2-emp-cell">
                        <div className="pauses-v2-avatar">
                          {empObj?.photo_url ? (
                            <PhotoSignee
                              url={empObj.photo_url}
                              alt={p.employe}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              fallback={<span>{initials}</span>}
                            />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        <div>
                          <strong className="pauses-v2-emp-name">{p.employe || 'Collaborateur'}</strong>
                          <span className="pauses-v2-emp-mat">
                            {p.matricule ? `#${p.matricule}` : 'Collaborateur'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 2. Service */}
                    <td data-col="Service" style={{ color: 'var(--pv-text-soft)', fontWeight: 600 }}>
                      {serviceLabel}
                    </td>

                    {/* 3. Date */}
                    <td data-col="Date" style={{ color: 'var(--pv-text-soft)', whiteSpace: 'nowrap' }}>
                      {formatTableRowDate(p.jour)}
                    </td>

                    {/* 4. Plage horaire */}
                    <td data-col="Plage horaire" style={{ whiteSpace: 'nowrap', fontWeight: 800 }}>
                      {p.ouverte ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--pv-amber)' }}>
                          <span className="pauses-v2-live-pulse-dot" />
                          <span>{p.debutHHMM} → En cours</span>
                        </span>
                      ) : (
                        <span>
                          {p.debutHHMM} <span style={{ opacity: 0.5, margin: '0 3px' }}>→</span> {p.finHHMM || '--:--'}
                        </span>
                      )}
                    </td>

                    {/* 5. Durée (ou Timer Dynamique en Direct) */}
                    <td data-col="Durée" style={{ whiteSpace: 'nowrap' }}>
                      {p.ouverte ? (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                          <span
                            className="pauses-v2-live-timer-mono"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: '0.92rem',
                            }}
                          >
                            <Timer size={14} />
                            <span>{liveElapsed}</span>
                          </span>
                          <small style={{ fontSize: '0.69rem', color: 'var(--pv-muted)', fontWeight: 600 }}>
                            Depuis {p.debutHHMM}
                          </small>
                        </div>
                      ) : (
                        <strong style={{ fontWeight: 750 }}>{formatDuree(p.dureeMinutes)}</strong>
                      )}
                    </td>

                    {/* 6. Statut */}
                    <td data-col="Statut">
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        {p.ouverte ? (
                          <span className="pauses-v2-status-pill is-live">
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
                            <span>En pause en direct</span>
                          </span>
                        ) : isReal ? (
                          <span className="pauses-v2-status-pill is-real">
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--charte-succes)' }} />
                            <span>
                              {p.source === 'admin'
                                ? 'Pause réelle (admin)'
                                : p.statut === 'validee'
                                  ? 'Pause réelle validée'
                                  : 'Pause réelle pointée'}
                            </span>
                          </span>
                        ) : isPresumed ? (
                          <span className="pauses-v2-status-pill is-presumed">
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f0b254' }} />
                            <span>
                              {p.statut === 'validee' ? 'Présumée validée' : 'Pause présumée'}
                            </span>
                          </span>
                        ) : null}

                        {p.estNonPlanifiee && isReal && (
                          <span className="pauses-v2-status-pill is-presumed" title="Pause prise hors planning prévu">
                            ⚡ Hors planning
                          </span>
                        )}

                        {anomalie && (
                          <span
                            className={
                              p.anomalie === 'depassement'
                                ? 'pauses-v2-status-pill is-depassement'
                                : 'pauses-v2-status-pill is-anomaly'
                            }
                            title={anomalie.raison || undefined}
                          >
                            {anomalie.label}
                          </span>
                        )}

                        {/*  POURQUOI LA PAUSE S'EST FERMÉE — information
                            d'administration : ni l'employé ni la tablette ne
                            la voient. Absente quand la base ne sait pas
                            (pauses d'avant le 23/11) : on n'affiche pas un
                            badge vide, on n'affiche rien. */}
                        {!p.ouverte && motifFermeture && (
                          <span
                            className="pauses-v2-status-pill"
                            style={{ color: motifFermeture.color, borderColor: motifFermeture.color }}
                            title={
                              p.motifFermeture === 'sortie'
                                ? 'La sortie du salarié a refermé la pause'
                                : 'La pause s’est refermée quand le salarié a repris le service'
                            }
                          >
                            {motifFermeture.court}
                          </span>
                        )}

                        {p.recupereeDirecte && (
                          <span
                            className="pauses-v2-status-pill is-anomaly"
                            title="Ligne existante en base mais non renvoyée par la fonction de lecture — récupérée en lecture directe."
                          >
                            ⌁ Lecture directe
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 7. Actions */}
                    <td data-col="Actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div className="pauses-v2-row-actions">
                        {p.aStatuer && onStatuer ? (
                          <>
                            <button
                              type="button"
                              className="pauses-v2-btn-validate"
                              onClick={() => onStatuer([p.id], 'valider')}
                            >
                              <Check size={13} />
                              <span>Valider</span>
                            </button>
                            <button
                              type="button"
                              className="pauses-v2-btn-reject"
                              onClick={() => onStatuer([p.id], 'ecarter')}
                            >
                              <X size={13} />
                              <span>Écarter</span>
                            </button>
                          </>
                        ) : (p.statut === 'validee' || p.statut === 'ecartee') && onAnnulerDecision ? (
                          <>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: p.statut === 'validee' ? 'var(--pv-emerald)' : 'var(--pv-bad)',
                                fontWeight: 700,
                                marginRight: 4,
                              }}
                            >
                              {p.statut === 'validee' ? '✓ Validée' : '🚫 Écartée'}
                            </span>
                            <button
                              type="button"
                              className="pauses-v2-icon-btn"
                              onClick={() => onAnnulerDecision(p)}
                              title="Revenir sur la décision"
                            >
                              <RotateCcw size={13} />
                              <span>Annuler</span>
                            </button>
                          </>
                        ) : p.statut === 'validee' ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--pv-emerald)', fontWeight: 700, marginRight: 4 }}>
                            ✓ Validée
                          </span>
                        ) : null}

                        {onSupprimer && (
                          <button
                            type="button"
                            className="pauses-v2-icon-btn"
                            onClick={() => onSupprimer(p)}
                            title="Supprimer cette pause (archivée et restaurable)"
                          >
                            <Trash2 size={13} />
                            <span>Supprimer</span>
                          </button>
                        )}

                        {onOpenEmployeeFiche && empObj && (
                          <button
                            type="button"
                            className="pauses-v2-icon-btn"
                            onClick={() => onOpenEmployeeFiche(empObj)}
                            title="Ouvrir la fiche de l’employé"
                          >
                            <FileText size={13} />
                            <span>Fiche</span>
                          </button>
                        )}

                        {onOpenPointages && (
                          <button
                            type="button"
                            className="pauses-v2-icon-btn"
                            onClick={() => onOpenPointages(p)}
                            title="Voir le pointage de ce collaborateur à cette date"
                          >
                            <Clock size={13} />
                            <span>Pointages</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export { KenteWovenTapestrySvg }
