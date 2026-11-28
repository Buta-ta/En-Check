// ═══════════════════════════════════════════════════════════════════════════
//  PRÉDICTIONS — la page en « registre » (maquette F, 02/12)
// ═══════════════════════════════════════════════════════════════════════════
//
//  ── Ce qui a changé, et pourquoi ──────────────────────────────────────────
//
//  Cette page était la SEULE de l'application en thème sombre néon : fond
//  #0A0A0F, halos ambre et indigo, cartes en verre dépoli (`backdrop-filter`),
//  dégradés, et une soixantaine de couleurs écrites en dur. Elle jurait avec
//  tout le reste, et elle ne suivait même pas le thème clair/sombre de
//  l'application : elle était sombre pour tout le monde.
//
//  Elle est maintenant en REGISTRE, comme la maquette F :
//
//    · papier ivoire, contour d'encre 2 px, ombre dure — aucune transparence,
//      aucun flou (C9 / D-016) ;
//    · les chiffres en chasse fixe, alignés à droite, avec les filets ;
//    · les alertes sont des LIGNES de grand livre, pas des cartes flottantes :
//      on en lit huit d'un coup d'œil au lieu de quatre ;
//    · les écarts sont signés (+38 % / −12 %), en rouge et vert d'état.
//
//  ── Ce qui n'a PAS changé ────────────────────────────────────────────────
//
//  Toute la logique : chargement, garde de fonctionnalité, filtres, et les
//  sept jeux de données du service. Aucun champ n'a été retiré — les blocs
//  que la maquette ne montrait pas (charge par employé, charge par équipe,
//  absences à impact) sont conservés, simplement mis au registre.
//
//  ── Le thème ─────────────────────────────────────────────────────────────
//
//  Les couleurs viennent des JETONS (`--charte-…`) : la page suit donc le
//  thème de l'application, clair comme sombre, sans une seule valeur en dur.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
/*  Seules les icônes encore posées sont importées : les sept autres
    (AlertTriangle, Users, Users2, Clock, TrendingUp, Activity, ArrowRight,
    Download) ne servaient plus depuis la refonte en registre. */
import { Sparkles, RefreshCw, ClipboardList, ShieldAlert, Building2, Filter, Target } from 'lucide-react'
import toast from 'react-hot-toast'

import FeatureService, { FEATURES } from '../services/featureService'
import { getPredictionDashboard } from '../services/predictionService'

const ENCRE = 'var(--charte-encre)'
const SURFACE = 'var(--charte-surface)'
const BORDURE = 'var(--charte-bordure)'
const DOUCE = 'var(--charte-douce)'
const TEXTE = 'var(--charte-texte)'
const TRAIT = 'var(--charte-trait)'
const MONO = 'var(--charte-mono)'

/*  Les trois sévérités. Le mot est toujours écrit — la couleur ne porte
    jamais l'information seule (règle C7 de la maison). */
const SEVERITES = {
  critical: { mot: 'Critique', couleur: 'var(--charte-erreur)', lettre: 'C' },
  warning: { mot: 'Attention', couleur: 'var(--charte-alerte)', lettre: 'A' },
  info: { mot: 'Info', couleur: 'var(--charte-texte)', lettre: 'I' },
}
const severite = (s) => SEVERITES[s] || SEVERITES.info

const minutes = (n) => {
  const v = Number(n) || 0
  if (v < 60) return `${v} min`
  const h = Math.floor(v / 60)
  const m = v % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

/*  Un nombre se lit en français : la virgule est le séparateur décimal, et
    le signe moins est un vrai moins typographique (U+2212), pas le trait
    d'union du clavier. Sans ça, un écart s'écrit « -12.5 % » — deux fautes
    dans quatre caractères. */
const decimal = (n, chiffres = 1) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return v.toLocaleString('fr-FR', {
    minimumFractionDigits: 0, maximumFractionDigits: chiffres, useGrouping: false,
  })
}
/*  Le signe est TOUJOURS écrit, même pour zéro : une colonne d'écarts dont
    certaines lignes n'ont pas de signe se lit mal, et la couleur ne doit
    jamais porter seule l'information (C7). */
const signe = (n, chiffres = 1) => {
  const v = Number(n) || 0
  const corps = decimal(Math.abs(v), chiffres)
  if (v > 0) return `+${corps}`
  if (v < 0) return `\u2212${corps}`
  return `0`
}

/*  `formatHours` existait déjà : on le garde tel quel, il est utilisé par
    trois blocs. */
function formatHours(hours) {
  if (hours == null || isNaN(hours) || hours <= 0) return '0 min'
  const totalMinutes = Math.round(hours * 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

/* ── les briques ─────────────────────────────────────────────────────────── */

/*  Un tampon : un mot, une lettre, un contour. Jamais une couleur seule. */
function Tampon({ severite: s }) {
  const v = severite(s)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 8px', border: `1px solid ${v.couleur}`, borderRadius: 0,
      color: v.couleur, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 14, height: 14, border: `1px solid ${v.couleur}`, fontSize: 9, lineHeight: 1 }}>{v.lettre}</span>
      {v.mot}
    </span>
  )
}

/*  La carte du registre : coin carré, contour d'encre, ombre dure, titre
    souligné d'un filet pointillé. */
function Registre({ titre, action, children, style }) {
  return (
    <section style={{
      border: `1px solid ${ENCRE}`, borderRadius: 0, backgroundColor: SURFACE,
      boxShadow: '4px 4px 0 0 var(--charte-encre)', marginBottom: 20, ...style,
    }}>
      <header style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', padding: '12px 16px 8px',
        borderBottom: `1px dotted ${ENCRE}`,
      }}>
        <h2 style={{ margin: 0, color: ENCRE, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {titre}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function Vide({ texte }) {
  return (
    <p style={{ margin: 0, padding: '20px 16px', color: DOUCE, fontSize: 13, fontStyle: 'italic' }}>
      {texte}
    </p>
  )
}

/*  Une ligne de grand livre : le titre, des points de conduite, la valeur.
    C'est ce qui remplace les cartes flottantes — on lit la colonne d'un trait. */
function Ligne({ titre, sous, valeur, fin, couleur }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 16px', borderTop: `1px solid ${BORDURE}`,
    }}>
      <div style={{ flex: '0 1 auto', minWidth: 0 }}>
        <div style={{ color: ENCRE, fontSize: 13.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{titre}</div>
        {sous && <div style={{ color: DOUCE, fontSize: 11, marginTop: 1 }}>{sous}</div>}
      </div>
      {/* les points de conduite du grand livre */}
      <span aria-hidden="true" style={{ flex: '1 1 20px', minWidth: 20, alignSelf: 'flex-end', marginBottom: 4, borderBottom: `1px dotted ${BORDURE}` }} />
      {valeur != null && (
        <span style={{ flex: '0 0 auto', color: couleur || ENCRE, fontFamily: MONO, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {valeur}
        </span>
      )}
      {fin}
    </div>
  )
}

const BOUTON = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  minHeight: 38, padding: '0 14px', border: `1px solid ${ENCRE}`, borderRadius: 0,
  backgroundColor: SURFACE, color: ENCRE, fontFamily: 'inherit',
  fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
  boxShadow: '2px 2px 0 0 var(--charte-encre)',
}

const FILTRE = {
  ...BOUTON,
  minHeight: 36, padding: '0 10px', fontWeight: 600, cursor: 'pointer',
  boxShadow: 'none', appearance: 'none',
}

/* ── la page ─────────────────────────────────────────────────────────────── */

export default function Predictions() {
  const navigate = useNavigate()

  const [admin, setAdmin] = useState(null)
  const [enterpriseId, setEnterpriseId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    summary: {
      critical_alerts: 0, warning_alerts: 0, overloaded_employees: 0,
      risky_teams: 0, impactful_absences: 0, staffing_needs: 0, avg_duration_variance_percent: 0,
    },
    alerts: [], durations: [], employee_workloads: [],
    team_workloads: [], absence_impact: [], staffing_needs: [],
  })

  const [severityFilter, setSeverityFilter] = useState('')
  const [viewFilter, setViewFilter] = useState('all')

  useEffect(() => {
    const init = async () => {
      try {
        const adminData = JSON.parse(localStorage.getItem('admin') || '{}')
        setAdmin(adminData)
        const entId = adminData.selectedEnterprise?.id || adminData.enterprise_id
        setEnterpriseId(entId)
        if (!entId && adminData.role !== 'super_admin') { toast.error('Aucune entreprise sélectionnée'); navigate('/dashboard'); return }
        if (adminData.role !== 'super_admin') {
          const hasAccess = await FeatureService.hasFeature(entId, FEATURES.PREDICTIONS)
          if (!hasAccess) { toast.error("Le module Prédictions n'est pas activé"); navigate('/dashboard'); return }
        }
        await loadPredictions(entId)
      } catch (error) { console.error(error); toast.error('Erreur de chargement des prédictions'); navigate('/dashboard') }
    }
    init()
  }, [navigate])

  const loadPredictions = async (entId = enterpriseId) => {
    if (!entId && admin?.role !== 'super_admin') return
    setLoading(true)
    try {
      const targetEnterpriseId = entId || admin?.selectedEnterprise?.id || admin?.enterprise_id
      const { data: predictionData, error } = await getPredictionDashboard(targetEnterpriseId)
      if (error) throw error
      setData(predictionData)
    } catch (error) { console.error('Erreur loadPredictions:', error); toast.error('Impossible de charger les prédictions') } finally { setLoading(false) }
  }

  const filteredAlerts = useMemo(() => {
    let list = data.alerts || []
    if (severityFilter) list = list.filter(a => a.severity === severityFilter)
    if (viewFilter !== 'all') {
      if (viewFilter === 'employees') list = list.filter(a => a.target_type === 'employee')
      else if (viewFilter === 'teams') list = list.filter(a => a.target_type === 'team')
      else if (viewFilter === 'staffing') list = list.filter(a => a.prediction_type === 'staffing_need')
      else if (viewFilter === 'absence') list = list.filter(a => a.prediction_type === 'absence_impact')
    }
    return list
  }, [data.alerts, severityFilter, viewFilter])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--charte-sable)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Sparkles size={34} color="var(--charte-aplat)" />
          <p style={{ margin: 0, color: DOUCE, fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Lecture des signaux…
          </p>
        </div>
      </div>
    )
  }

  const s = data.summary || {}

  /*  Le bilan : six cases, chiffre au-dessus, mot en dessous. Les deux
      premières portent un filet rouge : ce sont les alertes. */
  const bilan = [
    { n: s.critical_alerts, l: 'critiques', alerte: true },
    { n: s.warning_alerts, l: 'attention', alerte: true },
    { n: s.overloaded_employees, l: 'surchargés' },
    { n: s.risky_teams, l: 'équipes à risque' },
    { n: s.impactful_absences, l: 'absences' },
    { n: `${signe(s.avg_duration_variance_percent)} %`, l: 'écart moyen' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--charte-sable)', padding: 'clamp(14px, 3vw, 28px)' }}>
      <main style={{ maxWidth: 1280, margin: '0 auto' }}>

        {/* ── l'onglet, au-dessus de la feuille ─────────────────────────── */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', border: `1px solid ${ENCRE}`, borderBottom: 'none', backgroundColor: ENCRE, color: SURFACE }}>
          <Sparkles size={13} aria-hidden="true" />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em' }}>PRÉDICTIONS</span>
          <span style={{ marginLeft: 4, padding: '1px 6px', border: `1px solid ${SURFACE}`, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>IA ACTIVE</span>
        </div>

        <div style={{ border: `1px solid ${ENCRE}`, borderTop: `1px solid ${ENCRE}`, backgroundColor: SURFACE, boxShadow: '6px 6px 0 0 var(--charte-encre)', padding: 'clamp(16px, 3vw, 26px)' }}>

          {/* ── le titre ───────────────────────────────────────────────── */}
          <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, color: ENCRE, fontSize: 'clamp(24px, 3.4vw, 34px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Prédictions
              </h1>
              <p style={{ margin: '8px 0 0', color: TEXTE, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Analyse des charges, des besoins et des tendances
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => navigate('/dashboard')} style={BOUTON}>
                <Building2 size={15} aria-hidden="true" />
                <span>Tableau de bord</span>
              </button>
              <button type="button" onClick={() => loadPredictions()} style={{ ...BOUTON, backgroundColor: ENCRE, color: SURFACE }}>
                <RefreshCw size={15} aria-hidden="true" />
                <span>Rafraîchir</span>
              </button>
            </div>
          </header>

          {/* ── le bilan ───────────────────────────────────────────────── */}
          <Registre titre="Bilan">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              {bilan.map((c, i) => (
                <div
                  key={c.l}
                  style={{
                    padding: '14px 16px 16px',
                    borderLeft: i === 0 ? 'none' : `1px solid ${BORDURE}`,
                    /*  les deux premières cases portent le rouge des alertes */
                    boxShadow: c.alerte ? 'inset 3px 0 0 0 var(--charte-erreur)' : 'none',
                  }}
                >
                  <span style={{ display: 'block', color: c.alerte ? 'var(--charte-erreur)' : ENCRE, fontFamily: MONO, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
                    {c.n}
                  </span>
                  <span style={{ display: 'block', marginTop: 6, color: DOUCE, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {c.l}
                  </span>
                </div>
              ))}
            </div>
          </Registre>

          {/* ── les alertes ────────────────────────────────────────────── */}
          <Registre
            titre="Alertes intelligentes"
            action={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <ShieldAlert size={13} aria-hidden="true" color={DOUCE} />
                <select aria-label="Filtrer par sévérité" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={FILTRE}>
                  <option value="">Toutes sévérités</option>
                  <option value="critical">Critique</option>
                  <option value="warning">Attention</option>
                  <option value="info">Info</option>
                </select>
                <Filter size={13} aria-hidden="true" color={DOUCE} />
                <select aria-label="Filtrer par objet" value={viewFilter} onChange={(e) => setViewFilter(e.target.value)} style={FILTRE}>
                  <option value="all">Toutes les alertes</option>
                  <option value="employees">Employés</option>
                  <option value="teams">Équipes</option>
                  <option value="absence">Absences</option>
                  <option value="staffing">Renfort</option>
                </select>
                <span style={{ color: DOUCE, fontFamily: MONO, fontSize: 11 }}>{filteredAlerts.length} signal{filteredAlerts.length > 1 ? 'x' : ''}</span>
              </div>
            )}
          >
            {filteredAlerts.length === 0 ? (
              <Vide texte="Aucune alerte ne correspond aux filtres." />
            ) : (
              filteredAlerts.map((alert, index) => (
                <Ligne
                  key={`${alert.prediction_type}-${alert.target_id || index}`}
                  titre={alert.title}
                  sous={alert.message}
                  fin={<Tampon severite={alert.severity} />}
                />
              ))
            )}
          </Registre>

          {/* ── deux colonnes : durées / renfort ────────────────────────── */}
          <div className="pred-two" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
            <Registre titre="Durées : prévu / réel">
              {(data.durations || []).length === 0 ? (
                <Vide texte="Pas assez d’historique pour analyser les durées." />
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, padding: '8px 16px', color: DOUCE, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    <span>Catégorie</span><span style={{ textAlign: 'right' }}>Prévu</span><span style={{ textAlign: 'right' }}>Réel</span><span style={{ textAlign: 'right' }}>Écart</span>
                  </div>
                  {(data.durations || []).slice(0, 8).map((row) => {
                    const v = Number(row.variance_percent) || 0
                    return (
                      <div key={row.category_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '8px 16px', borderTop: `1px solid ${BORDURE}` }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: ENCRE, fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>{row.category_name}</div>
                          <div style={{ color: DOUCE, fontSize: 10.5 }}>{row.completed_count} tâche(s)</div>
                        </div>
                        <span style={{ textAlign: 'right', color: ENCRE, fontFamily: MONO, fontSize: 12.5 }}>{minutes(row.expected_avg_minutes)}</span>
                        <span style={{ textAlign: 'right', color: ENCRE, fontFamily: MONO, fontSize: 12.5 }}>{minutes(row.actual_avg_minutes)}</span>
                        {/*  le signe est écrit, pas seulement la couleur (C7) */}
                        <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: v > 0 ? 'var(--charte-erreur)' : v < 0 ? 'var(--charte-succes)' : ENCRE }}>
                          {signe(v)} %
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Registre>

            <Registre titre="Besoins de renfort">
              {(data.staffing_needs || []).length === 0 ? (
                <Vide texte="Aucun besoin de renfort détecté pour le moment." />
              ) : (
                (data.staffing_needs || []).slice(0, 6).map((item, i) => (
                  <div key={item.team_id || i} style={{ padding: '10px 16px', borderTop: i === 0 ? 'none' : `1px solid ${BORDURE}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ color: ENCRE, fontSize: 13.5, fontWeight: 700 }}>{item.team_name}</span>
                      <Tampon severite={item.severity} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 5, color: ENCRE, fontFamily: MONO, fontSize: 11.5 }}>
                      <span>{item.open_tasks} tâche(s)</span>
                      <span aria-hidden="true" style={{ color: BORDURE }}>·</span>
                      <span>{formatHours(item.load_per_member_hours)}/membre</span>
                      <span aria-hidden="true" style={{ color: BORDURE }}>·</span>
                      <span>+{item.estimated_additional_people} pers.</span>
                      <span aria-hidden="true" style={{ color: BORDURE }}>·</span>
                      <span>{item.overdue_tasks} retard(s)</span>
                      <span aria-hidden="true" style={{ color: BORDURE }}>·</span>
                      <span>{decimal(item.completion_rate, 0)} %</span>
                    </div>
                    {item.recommendation && (
                      <p style={{ margin: '6px 0 0', color: TEXTE, fontSize: 12, fontStyle: 'italic', lineHeight: 1.5 }}>
                        {item.recommendation}
                      </p>
                    )}
                  </div>
                ))
              )}
            </Registre>
          </div>

          {/* ── charge par employé ─────────────────────────────────────── */}
          <Registre titre="Charge par employé">
            {(data.employee_workloads || []).length === 0 ? (
              <Vide texte="Aucune charge employé à analyser." />
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr .7fr 1fr 1fr 1fr', gap: 8, padding: '8px 16px', color: DOUCE, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <span>Employé</span><span style={{ textAlign: 'right' }}>Tâches</span><span style={{ textAlign: 'right' }}>Prévu</span><span style={{ textAlign: 'right' }}>Estimé</span><span style={{ textAlign: 'right' }}>Risque</span>
                </div>
                {(data.employee_workloads || []).slice(0, 10).map((row) => (
                  <Ligne
                    key={row.employee_id}
                    titre={row.employee_name}
                    sous={row.position || row.department || 'Employé'}
                    valeur={`${row.open_tasks} · ${minutes(row.planned_minutes)} · ${formatHours(row.predicted_real_hours)}`}
                    fin={<Tampon severite={row.severity} />}
                  />
                ))}
              </div>
            )}
          </Registre>

          {/* ── deux colonnes : équipes / absences ─────────────────────── */}
          <div className="pred-two" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
            <Registre titre="Charge par équipe">
              {(data.team_workloads || []).length === 0 ? (
                <Vide texte="Aucune charge équipe à analyser." />
              ) : (
                (data.team_workloads || []).slice(0, 8).map((team, i) => {
                  /*  La jauge : une barre plate, et le chiffre à côté. Une barre
                      seule ne dit rien à qui ne voit pas la couleur (C7). */
                  const taux = Math.max(0, Math.min(100, Number(team.completion_rate) || 0))
                  return (
                    <div key={team.team_id || i} style={{ padding: '10px 16px', borderTop: i === 0 ? 'none' : `1px solid ${BORDURE}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ color: ENCRE, fontSize: 13.5, fontWeight: 700 }}>{team.team_name}</span>
                        <Tampon severite={team.severity} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        <div style={{ flex: '1 1 auto', height: 10, border: `1px solid ${ENCRE}`, backgroundColor: SURFACE }}>
                          <div style={{ width: `${taux}%`, height: '100%', backgroundColor: 'var(--charte-aplat)' }} />
                        </div>
                        <span style={{ flex: '0 0 auto', color: ENCRE, fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>{decimal(team.completion_rate, 0)} %</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 5, color: DOUCE, fontFamily: MONO, fontSize: 11 }}>
                        <span>{team.member_count} membre(s)</span>
                        <span>{team.open_tasks} tâche(s)</span>
                        <span>{formatHours(team.load_per_member_hours)}/membre</span>
                      </div>
                    </div>
                  )
                })
              )}
            </Registre>

            <Registre titre="Absences à impact">
              {(data.absence_impact || []).length === 0 ? (
                <Vide texte="Aucune absence impactante prévue." />
              ) : (
                (data.absence_impact || []).slice(0, 8).map((item, i) => (
                  <div key={item.team_id || i} style={{ padding: '10px 16px', borderTop: i === 0 ? 'none' : `1px solid ${BORDURE}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ color: ENCRE, fontSize: 13.5, fontWeight: 700 }}>{item.team_name}</span>
                      <Tampon severite={item.severity} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 5, color: ENCRE, fontFamily: MONO, fontSize: 11.5 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Target size={11} aria-hidden="true" color={TEXTE} />
                        {item.absent_count} absence(s)
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <ClipboardList size={11} aria-hidden="true" color={TEXTE} />
                        {item.impacted_tasks} tâche(s) impactée(s)
                      </span>
                      <span>{item.direct_tasks} directe(s)</span>
                    </div>
                    {item.message && (
                      <p style={{ margin: '6px 0 0', color: TEXTE, fontSize: 12, fontStyle: 'italic', lineHeight: 1.5 }}>{item.message}</p>
                    )}
                  </div>
                ))
              )}
            </Registre>
          </div>

          {/* ── la perforation, et le timbre d'édition ─────────────────── */}
          <div aria-hidden="true" style={{ borderTop: `1px dashed ${ENCRE}`, marginTop: 8 }} />
          <p style={{ margin: '10px 0 0', textAlign: 'right', color: DOUCE, fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Édité le {new Date().toLocaleDateString('fr-FR')} · {data.alerts?.length || 0} signal(aux)
          </p>
        </div>
      </main>

      {/*  deux colonnes seulement quand la place existe : en dessous, tout
          s'empile et reste lisible. */}
      <style>{`
        @media (max-width: 900px) {
          .pred-two { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
