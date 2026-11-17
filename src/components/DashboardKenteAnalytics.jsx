// ═══════════════════════════════════════════════════════════
// 📊 LA CONSOLE KENTE — couche analytique du dashboard (v2)
//
// « Vue d’ensemble » : KPI du jour + pointages entrants,
// santé RH, heatmap jour×heure, insight, donut de présence et
// jauge de taux. Thème : suit le clair/sombre de la page
// (mêmes variables que le dashboard, accents kente or/terre).
//
// PERSONNALISABLE : chaque carte (KPI ou tuile) peut être
// réordonnée (glisser-déposer ou flèches), masquée et réajoutée.
// La disposition est enregistrée localement puis synchronisée
// à distance, par compte et par entreprise (même service que le
// reste du tableau de bord, sur un périmètre dédié « ::kente »).
//
// Données : RPC encheck_dashboard_synthese (historique, heatmap,
// tendances, bornes, santé) + les stats du jour du dashboard.
// Insights à règles en v1 (deterministes, sans LLM).
// Si la RPC est indisponible, la couche se retire discrètement :
// le dashboard classique continue de fonctionner.
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BrainCircuit,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  GripVertical,
  MoveDown,
  MoveUp,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  X,
} from 'lucide-react'
import {
  addDashboardWidget,
  moveDashboardWidget,
  moveDashboardWidgetByOffset,
  normalizeDashboardWidgetIds,
  removeDashboardWidget,
} from '../utils/dashboardWidgets'
import {
  loadRemoteDashboardPreferences,
  saveRemoteDashboardPreferences,
} from '../services/dashboardPreferencesService'
import { nettoyerTexte } from '../lib/nettoyageTexte'
import {
  finPosteDepassee as finPosteDepasseeEntreprise,
  libelleSansPointage,
} from '../lib/etatPresence'
import './DashboardKenteAnalytics.css'

const JOURS_OPTIONS = [7, 30, 90]
const JOURS_FR = {
  7: '7 derniers jours',
  30: '30 derniers jours',
  90: '90 derniers jours',
}
const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const PALETTE_KENTE = ['#c9a961', '#a04a22', '#e0c88f', '#8b3e1d', '#6b4a2f', '#d1653a']

// ── Catalogue des cartes personnalisables (3 zones) ────────
const CATALOGUE_KPI = [
  { id: 'presents', label: 'Présents aujourd’hui', zone: 'Indicateurs' },
  { id: 'pointages', label: 'Pointages du jour', zone: 'Indicateurs' },
  { id: 'bornes', label: 'Bornes actives', zone: 'Indicateurs' },
]
const CATALOGUE_MILIEU = [
  { id: 'courbe', label: 'Pointages entrants', zone: 'Analytique' },
  { id: 'sante', label: 'Santé RH', zone: 'Analytique' },
  { id: 'heatmap', label: 'Présence par jour et heure', zone: 'Analytique' },
]
const CATALOGUE_BAS = [
  { id: 'insight', label: 'Insight du jour', zone: 'Détails' },
  { id: 'donut', label: 'Présence aujourd’hui', zone: 'Détails' },
  { id: 'jauge', label: 'Taux de présence', zone: 'Détails' },
]
const IDS_KPI = CATALOGUE_KPI.map((c) => c.id)
const IDS_MILIEU = CATALOGUE_MILIEU.map((c) => c.id)
const IDS_BAS = CATALOGUE_BAS.map((c) => c.id)

function pctDelta(actuel, precedent) {
  if (!precedent || precedent <= 0) return null
  // Règle du dictionnaire de données : sous 30 événements dans la
  // période, un pourcentage est du bruit, pas une tendance. On n'en
  // montre pas — les valeurs absolues restent lisibles ailleurs.
  if (Math.max(actuel || 0, precedent) < 30) return null
  return Math.round(((actuel - precedent) / precedent) * 100)
}

function formatDelta(delta) {
  if (delta === null || delta === undefined) return ''
  return `${delta > 0 ? '+' : ''}${delta} %`
}

function BadgeTendance({ delta, neutre = false, texte = 'MàJ' }) {
  if (delta === null || delta === undefined || neutre) {
    return <span className="dk-badge dk-badge--neutre">{neutre ? texte : '—'}</span>
  }
  const positif = delta > 0
  return (
    <span className={`dk-badge ${positif ? 'dk-badge--up' : 'dk-badge--down'}`}>
      {positif ? '▲' : '▼'} {formatDelta(delta)}
    </span>
  )
}

function couleurCellule(valeur, max) {
  if (!valeur) return 'var(--dk-heat-0)'
  if (!max) return 'var(--dk-heat-1)'
  const t = valeur / max
  if (t < 0.25) return 'var(--dk-heat-1)'
  if (t < 0.5) return 'var(--dk-heat-2)'
  if (t < 0.75) return 'var(--dk-heat-3)'
  return 'var(--dk-heat-4)'
}

function moyenne(arr) {
  if (!arr?.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ── Insights à règles (déterministes, sans LLM) ────────────
function choisirInsight({ serie, heatmap, tendance, stats }) {
  const dSemaine = pctDelta(tendance?.entrees_7j, tendance?.entrees_7j_prev)
  const entreesJour = serie?.length ? serie[serie.length - 1].entrees : 0
  const moy7 = moyenne(serie?.slice(-7).map((p) => p.entrees) || [])
  const dJour = pctDelta(entreesJour, moy7)

  // Pic du matin sur la heatmap
  let heurePic = null
  let totalHeures = 0
  let totalMatin = 0
  if (Array.isArray(heatmap)) {
    const parHeure = new Array(24).fill(0)
    for (const ligne of heatmap) {
      ligne.forEach((v, h) => {
        parHeure[h] += v
        totalHeures += v
      })
    }
    totalMatin = parHeure.slice(0, 12).reduce((a, b) => a + b, 0)
    let idx = 0
    parHeure.forEach((v, h) => {
      if (v > parHeure[idx]) idx = h
    })
    if (parHeure[idx] > 0) heurePic = idx
  }
  const pctMatin = totalHeures ? Math.round((totalMatin / totalHeures) * 100) : null

  if (dSemaine !== null && Math.abs(dSemaine) >= 8) {
    return `Pointages ${dSemaine > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(dSemaine)} % sur 7 jours : ${tendance.entrees_7j} pointages contre ${tendance.entrees_7j_prev} la semaine précédente.`
  }
  if (heurePic !== null && pctMatin !== null && pctMatin >= 55) {
    return `Le pic d’arrivées se situe vers ${heurePic} h : ${pctMatin} % des pointages tombent le matin (avant midi) sur la période.`
  }
  if (dJour !== null && Math.abs(dJour) >= 20 && entreesJour > 0) {
    return dJour > 0
      ? `Journée forte : ${entreesJour} pointages contre une moyenne de ${Math.round(moy7)} par jour sur les 7 derniers jours.`
      : `Journée calme : ${entreesJour} pointages contre une moyenne de ${Math.round(moy7)} par jour sur les 7 derniers jours.`
  }
  // Meilleur / plus calme jour de la semaine (7 derniers jours)
  if (serie?.length >= 5) {
    const parSemaine = new Map()
    serie.slice(-7).forEach((p) => {
      const j = p.jourSemaine
      parSemaine.set(j, (parSemaine.get(j) || 0) + p.entrees)
    })
    const entrees = [...parSemaine.entries()]
    entrees.sort((a, b) => b[1] - a[1])
    if (entrees.length >= 2 && entrees[0][1] > 0 && entrees[entrees.length - 1][1] >= 0) {
      const [meilleur, vMeilleur] = entrees[0]
      const [calme, vCalme] = entrees[entrees.length - 1]
      if (meilleur !== calme) {
        return `${JOURS_SEMAINE[meilleur]} est le jour le plus fréquenté (${vMeilleur} pointages sur 7 jours), ${JOURS_SEMAINE[calme]} le plus calme (${vCalme}).`
      }
    }
  }
  const taux = stats?.tauxPresence
  if (typeof taux === 'number' && taux > 0) {
    const manquants = (stats.absentsToday || 0) + (stats.congesToday || 0)
    return `Taux de présence aujourd’hui : ${taux} %${manquants > 0 ? ` — ${manquants} employé${manquants > 1 ? 's' : ''} manquant${manquants > 1 ? 's' : ''} (absents et congés).` : ' — effectif complet.'}`
  }
  return 'Pas assez de données sur la période pour dégager une tendance.'
}

function notePrevision({ heatmap, jours }) {
  if (!Array.isArray(heatmap) || !heatmap.length) return null
  let total = 0
  let totalWeekend = 0
  const parJour = new Array(7).fill(0)
  heatmap.forEach((ligne, j) => {
    ligne.forEach((v) => {
      total += v
      parJour[j] += v
      if (j >= 5) totalWeekend += v
    })
  })
  if (!total) return null
  const jourMax = parJour.indexOf(Math.max(...parJour))
  const pctWeekend = Math.round((totalWeekend / total) * 100)
  return `Sur ${jours} jours, le flux est le plus dense le ${JOURS_SEMAINE[jourMax]} ; le week-end pèse ${pctWeekend} % du total des pointages.`
}

function noteSante({ sante, serie }) {
  if (!sante) return null
  const { assiduite, regularite } = sante
  // Moins de 3 jours d'activité : aucune valeur calculable — pas de note.
  if (assiduite == null && regularite == null) return null
  if (assiduite >= 85 && regularite != null && regularite >= 70) {
    return `Assiduité saine (${assiduite} %) et activité régulière sur la semaine glissante : la présence tient ses niveaux.`
  }
  if (assiduite < 70) {
    return `Assiduité en retrait : ${assiduite} % des effectifs ont pointé sur la semaine glissante.`
  }
  if (regularite != null && regularite < 55) {
    return `Activité irrégulière : l’effectif présent fluctue fortement d’un jour à l’autre (régularité ${regularite} %).`
  }
  if (regularite == null) {
    return `Assiduité ${assiduite} % sur la semaine glissante — pas encore assez de jours d’activité pour juger la régularité.`
  }
  return `Assiduité ${assiduite} %, régularité ${regularite} % — surveiller les jours les plus calmes du calendrier.`
}

// ── Persistance locale de la disposition des cartes ────────
function lireKenteIds(cleStockage, idsParDefaut) {
  try {
    const sauvegarde = window.localStorage.getItem(cleStockage)
    return normalizeDashboardWidgetIds(sauvegarde ? JSON.parse(sauvegarde) : null, idsParDefaut, idsParDefaut)
  } catch {
    return [...idsParDefaut]
  }
}

export default function DashboardKenteAnalytics({
  admin,
  isSuperAdmin,
  stats = {},
  topEntreprises = [],
  // Le mode de personnalisation des cartes est piloté par la sidebar
  // (point d'entrée unique « Personnalisation »), plus par ce rapport.
  kenteCustomise = false,
  surBasculerKente = () => {},
}) {
  const [jours, setJours] = useState(30)
  // La case de la heatmap survolée (lecture dynamique jour × heure).
  const [survolHeat, setSurvolHeat] = useState(null)
  const [donnees, setDonnees] = useState(null)
  const [echec, setEchec] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [partageOuvert, setPartageOuvert] = useState(false)
  const [copie, setCopie] = useState(false)

  // ── Personnalisation : disposition des 9 cartes (3 zones) ──
  // L'état est porté par le tableau de bord (sidebar) : ici on ne fait
  // que le refléter. En quittant le mode, la modale « Ajouter une carte »
  // se referme d'elle-même.
  const isKenteCustomizing = kenteCustomise
  const [catalogueOuvert, setCatalogueOuvert] = useState(false)
  const [carteDraquee, setCarteDraquee] = useState(null)
  useEffect(() => {
    if (!isKenteCustomizing) setCatalogueOuvert(false)
  }, [isKenteCustomizing])

  const scopeId = isSuperAdmin
    ? admin?.selectedEnterprise?.id || null
    : admin?.selectedEnterprise?.id || admin?.enterprise_id || null
  const fuseau = admin?.selectedEnterprise?.timezone || null
  const scopeCle = `${scopeId || 'global'}|${fuseau || 'utc'}`
  const scopeNom = admin?.selectedEnterprise?.name || (isSuperAdmin ? 'Toutes les entreprises' : admin?.enterprise_name || '')

  // ── Vérité de l'état « pas encore pointé » vs « absent » ──
  // Tant que la fin du poste n'est pas dépassée (heure locale de
  // l'entreprise, seuil auto_close_time sinon 18 h), un salarié sans
  // pointage est « pas encore pointé ». Le mot « absent » n'apparaît
  // qu'après la fin du poste : avant, c'est une absence
  // d'information, pas une accusation.
  const finPosteDepassee = useMemo(
    () => finPosteDepasseeEntreprise(admin?.selectedEnterprise),
    [admin?.selectedEnterprise?.auto_close_time, fuseau]
  )
  const libelleAbsence = libelleSansPointage(finPosteDepassee)

  const clePere = `${admin?.id || 'preview'}:${scopeId || 'all'}`
  const cleKpi = `encheck_dashboard_kente_v1:kpi:${clePere}`
  const cleMilieu = `encheck_dashboard_kente_v1:milieu:${clePere}`
  const cleBas = `encheck_dashboard_kente_v1:bas:${clePere}`

  const [kpiIds, setKpiIds] = useState(() => lireKenteIds(cleKpi, IDS_KPI))
  const [milieuIds, setMilieuIds] = useState(() => lireKenteIds(cleMilieu, IDS_MILIEU))
  const [basIds, setBasIds] = useState(() => lireKenteIds(cleBas, IDS_BAS))

  useEffect(() => {
    try {
      window.localStorage.setItem(cleKpi, JSON.stringify(kpiIds))
    } catch {
      // Le stockage local peut être bloqué : la disposition reste en mémoire.
    }
  }, [cleKpi, kpiIds])
  useEffect(() => {
    try {
      window.localStorage.setItem(cleMilieu, JSON.stringify(milieuIds))
    } catch {
      // Idem.
    }
  }, [cleMilieu, milieuIds])
  useEffect(() => {
    try {
      window.localStorage.setItem(cleBas, JSON.stringify(basIds))
    } catch {
      // Idem.
    }
  }, [cleBas, basIds])

  // Synchronisation distante (périmètre dédié « ::kente » pour ne pas
  // écraser les préférences du reste du tableau de bord). Comme le
  // reste du dashboard : dépendances en SIGNATURES + chargement une
  // seule fois par périmètre, pour qu'un rechargement distant ne
  // réapplique jamais une liste qu'on vient de modifier.
  const kpiSignature = kpiIds.join('|')
  const milieuSignature = milieuIds.join('|')
  const basSignature = basIds.join('|')
  const kenteRemoteScope = `${scopeId || 'all'}::kente`
  const remoteKenteLoadedRef = useRef('')

  useEffect(() => {
    let annule = false
    if (!admin?.id) return undefined
    const clePerimetre = `${admin.id}:${kenteRemoteScope}:${kpiSignature}:${milieuSignature}:${basSignature}`
    if (remoteKenteLoadedRef.current === clePerimetre) return undefined
    loadRemoteDashboardPreferences(admin.id, kenteRemoteScope).then((remote) => {
      if (annule || !remote) return
      remoteKenteLoadedRef.current = clePerimetre
      if (Array.isArray(remote.kpiIds)) setKpiIds(normalizeDashboardWidgetIds(remote.kpiIds, IDS_KPI, IDS_KPI))
      if (Array.isArray(remote.milieuIds)) setMilieuIds(normalizeDashboardWidgetIds(remote.milieuIds, IDS_MILIEU, IDS_MILIEU))
      if (Array.isArray(remote.basIds)) setBasIds(normalizeDashboardWidgetIds(remote.basIds, IDS_BAS, IDS_BAS))
    })
    return () => {
      annule = true
    }
  }, [admin?.id, kenteRemoteScope, kpiSignature, milieuSignature, basSignature])

  useEffect(() => {
    if (!admin?.id) return undefined
    const minuteur = window.setTimeout(() => {
      saveRemoteDashboardPreferences(admin.id, kenteRemoteScope, { kpiIds, milieuIds, basIds })
    }, 650)
    return () => window.clearTimeout(minuteur)
  }, [admin?.id, kenteRemoteScope, kpiIds, milieuIds, basIds])

  const actionsZone = (setIds, zone) => {
    const ids = zone === 'kpi' ? kpiIds : (zone === 'milieu' ? milieuIds : basIds)
    const disponibles = zone === 'kpi' ? IDS_KPI : (zone === 'milieu' ? IDS_MILIEU : IDS_BAS)
    return {
      deplacer: (id, offset) => setIds((courant) => moveDashboardWidgetByOffset(courant, id, offset)),
      masquerer: (id) => setIds((courant) => removeDashboardWidget(courant, id)),
      dragStart: (event, id) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', id)
        setCarteDraquee({ zone, id })
      },
      drop: (event, cibleId) => {
        event.preventDefault()
        event.stopPropagation()
        const sourceId = event.dataTransfer.getData('text/plain')
          || (carteDraquee && carteDraquee.zone === zone ? carteDraquee.id : null)
        if (sourceId && disponibles.includes(sourceId)) {
          setIds((courant) => moveDashboardWidget(courant, sourceId, cibleId))
        }
        setCarteDraquee(null)
      },
      position: (id) => ids.indexOf(id),
      nombre: ids.length,
    }
  }

  const ajouterCarte = (carte) => {
    if (carte.zone === 'Indicateurs') setKpiIds((c) => addDashboardWidget(c, carte.id))
    else if (carte.zone === 'Analytique') setMilieuIds((c) => addDashboardWidget(c, carte.id))
    else setBasIds((c) => addDashboardWidget(c, carte.id))
  }
  const reinitialiserKente = () => {
    setKpiIds([...IDS_KPI])
    setMilieuIds([...IDS_MILIEU])
    setBasIds([...IDS_BAS])
  }
  const cartesMasquees = [
    ...CATALOGUE_KPI.filter((c) => !kpiIds.includes(c.id)),
    ...CATALOGUE_MILIEU.filter((c) => !milieuIds.includes(c.id)),
    ...CATALOGUE_BAS.filter((c) => !basIds.includes(c.id)),
  ]

  // ── Données de la synthèse ────────────────────────────────
  useEffect(() => {
    let actif = true
    setChargement(true)
    setEchec(false)
    supabase
      .rpc('encheck_dashboard_synthese', {
        p_enterprise_id: scopeId,
        p_jours: jours,
        p_fuseau: fuseau,
      })
      .then(({ data, error }) => {
        if (!actif) return
        if (error || !data?.ok) {
          setEchec(true)
          setDonnees(null)
        } else {
          setDonnees(data)
        }
      })
      .catch(() => {
        if (actif) setEchec(true)
      })
      .finally(() => {
        if (actif) setChargement(false)
      })
    return () => {
      actif = false
    }
  }, [scopeCle, jours])

  // Série pour la courbe : dates lisibles + jour de semaine (pour les règles)
  const serie = useMemo(() => {
    if (!donnees?.serie?.length) return []
    return donnees.serie.map((j) => ({
      date: j.d,
      label: new Date(`${j.d}T00:00:00`).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
      }),
      jourSemaine: j.jour_semaine,
      entrees: j.entrees,
      presents: j.presents,
    }))
  }, [donnees])

  const heatmap = donnees?.heatmap || null
  const maxHeat = useMemo(() => {
    if (!Array.isArray(heatmap)) return 0
    return Math.max(...heatmap.flat())
  }, [heatmap])

  const tendances = donnees?.tendance || null
  const sante = donnees?.sante || null
  const bornes = donnees?.bornes || null

  const deltaSemaine = pctDelta(tendances?.entrees_7j, tendances?.entrees_7j_prev)
  const entreesJour = serie.length ? serie[serie.length - 1].entrees : 0
  const moy7 = Math.round(moyenne(serie.slice(-7).map((p) => p.entrees)))

  const insight = useMemo(
    () =>
      donnees
        ? choisirInsight({ serie, heatmap, tendance: tendances, stats })
        : null,
    [donnees, serie, heatmap, tendances, stats],
  )
  const prevision = useMemo(() => notePrevision({ heatmap, jours }), [heatmap, jours])
  const santeNote = useMemo(() => noteSante({ sante, serie }), [sante, serie])

  // Donut : par entreprise (vue globale) ou par situation du jour (vue entreprise)
  const donneesDonut = useMemo(() => {
    if (scopeId === null && topEntreprises?.length) {
      const top = topEntreprises.slice(0, 5).map((e, i) => ({
        name: nettoyerTexte(e.name),
        value: e.presentsToday || 0,
        color: PALETTE_KENTE[i % PALETTE_KENTE.length],
      }))
      const reste = topEntreprises
        .slice(5)
        .reduce((a, e) => a + (e.presentsToday || 0), 0)
      if (reste > 0) top.push({ name: 'Autres', value: reste, color: PALETTE_KENTE[5] })
      return {
        titre: 'Présence par entreprise',
        sousTitre: 'Présents aujourd’hui — toutes les entreprises.',
        donnees: top,
      }
    }
    const parts = [
      { name: 'Présents', value: stats.presentsToday || 0, color: PALETTE_KENTE[0] },
      { name: finPosteDepassee ? 'Absents' : 'Pas encore pointés', value: stats.absentsToday || 0, color: PALETTE_KENTE[1] },
      { name: 'En congé', value: stats.congesToday || 0, color: PALETTE_KENTE[4] },
    ].filter((p) => p.value > 0)
    return {
      titre: 'Présence aujourd’hui',
      sousTitre: `Répartition sur ${stats.employes || 0} employé${(stats.employes || 0) > 1 ? 's' : ''} — aujourd’hui.`,
      donnees: parts,
    }
  }, [scopeId, topEntreprises, stats, finPosteDepassee])
  const totalDonut = donneesDonut.donnees.reduce((a, p) => a + p.value, 0)

  // Rapport partageable (texte brut)
  const rapport = useMemo(() => {
    if (!donnees) return ''
    const lignes = [
      'En-Check — Synthèse du tableau de bord',
      `Généré le ${new Date().toLocaleDateString('fr-FR')} · ${scopeNom || 'Toutes les entreprises'}`,
      `Période : ${JOURS_FR[jours]}`,
      '',
      "Aujourd'hui",
      `- Présents : ${stats.presentsToday ?? '—'} (taux de présence ${stats.tauxPresence ?? '—'} %)`,
      `- Retards : ${stats.retardsToday ?? '—'} · Absents : ${stats.absentsToday ?? '—'} · En congé : ${stats.congesToday ?? '—'}`,
      `- Pointages : ${entreesJour} (moyenne 7 jours : ${moy7}/jour)`,
      '',
      'Tendance',
      `- Pointages 7 jours : ${tendances?.entrees_7j ?? '—'} (semaine précédente : ${tendances?.entrees_7j_prev ?? '—'}${deltaSemaine !== null ? ` → ${formatDelta(deltaSemaine)}` : ''})`,
      `- Assiduité : ${sante?.assiduite != null ? `${sante.assiduite} %` : '—'} · Régularité : ${sante?.regularite != null ? `${sante.regularite} %` : '—'}`,
      '',
      'Bornes',
      `- ${bornes?.actives ?? '—'} borne(s) active(s) sur ${bornes?.total ?? '—'}`,
      '',
      'Insight du jour',
      insight || '—',
    ]
    return lignes.join('\n')
  }, [donnees, scopeNom, jours, stats, entreesJour, moy7, tendances, deltaSemaine, sante, bornes, insight])

  async function copierRapport() {
    try {
      await navigator.clipboard.writeText(rapport)
      setCopie(true)
      setTimeout(() => setCopie(false), 2500)
    } catch {
      // Le presse-papiers peut être bloqué : on n'échoue pas le rapport.
    }
  }

  // La couche se retire discrètement si la synthèse est indisponible :
  // le dashboard classique reste intact.
  if (echec) return null
  if (chargement && !donnees) {
    return (
      <section className="dk" aria-label="Analytique (chargement)">
        <div className="dk-squelette" aria-hidden="true">
          <span className="dk-squelette-kpi" /><span className="dk-squelette-kpi" /><span className="dk-squelette-kpi" />
          <span className="dk-squelette-tile" /><span className="dk-squelette-tile" /><span className="dk-squelette-tile" />
          <span className="dk-squelette-tile" /><span className="dk-squelette-tile" /><span className="dk-squelette-tile" />
        </div>
      </section>
    )
  }
  if (!donnees || !serie.length) return null

  // ── Cartes des 3 zones (catalogue + ids visibles) ─────────
  const kpiZ = actionsZone(setKpiIds, 'kpi')
  const milieuZ = actionsZone(setMilieuIds, 'milieu')
  const basZ = actionsZone(setBasIds, 'bas')

  const controlesCarte = (actions, zone, id, label) => {
    if (!isKenteCustomizing) return null
    const index = actions.position(id)
    const total = actions.nombre
    return (
      <div className="dk-controles" aria-label={`Contrôles de ${label}`}>
        <button
          type="button"
          className="dk-ctrl dk-ctrl--poignee"
          draggable="true"
          onDragStart={(event) => actions.dragStart(event, id)}
          onDragEnd={() => setCarteDraquee(null)}
          aria-label={`Déplacer ${label}`}
          title="Faire glisser pour déplacer"
        >
          <GripVertical size={14} />
        </button>
        <button type="button" className="dk-ctrl" onClick={() => actions.deplacer(id, -1)} disabled={index <= 0} aria-label={`Déplacer ${label} vers le début`} title="Monter"><MoveUp size={13} /></button>
        <button type="button" className="dk-ctrl" onClick={() => actions.deplacer(id, 1)} disabled={index >= total - 1} aria-label={`Déplacer ${label} vers la fin`} title="Descendre"><MoveDown size={13} /></button>
        <button type="button" className="dk-ctrl dk-ctrl--retirer" onClick={() => actions.masquerer(id)} disabled={total <= 1} aria-label={`Masquer ${label}`} title={total <= 1 ? 'Conservez au moins une carte' : 'Masquer la carte'}><X size={13} /></button>
      </div>
    )
  }

  const coquilleCarte = (actions, zone, id, classes = '', contenu) => (
    <article
      className={`dk-carte ${classes}${carteDraquee && carteDraquee.zone === zone && carteDraquee.id === id ? ' is-dragging' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => actions.drop(event, id)}
    >
      {controlesCarte(actions, zone, id, contenu.label)}
      {contenu.corps}
    </article>
  )

  // Contenus des cartes KPI
  const carteKpi = (id) => {
    if (id === 'presents') {
      const effectif = Number(stats.employes) || 0
      return {
        label: 'Présents aujourd’hui',
        corps: (
          <>
            <span className="dk-kpi-label">Présents aujourd’hui</span>
            <strong className="dk-kpi-valeur">{effectif ? (stats.presentsToday ?? 0) : '—'}</strong>
            <div className="dk-kpi-pied">
              <span className="dk-kpi-caption">
                {effectif
                  ? `sur ${effectif} · ${stats.retardsToday ?? 0} retards · ${stats.absentsToday ?? 0} ${libelleAbsence}`
                  : 'Aucun employé actif'}
              </span>
              {/* Le jour en cours ne se compare pas à des journées complètes :
                  aucun %, juste l'état du moment. */}
              <BadgeTendance delta={null} neutre texte="jour en cours" />
            </div>
          </>
        ),
      }
    }
    if (id === 'pointages') {
      return {
        label: 'Pointages du jour',
        corps: (
          <>
            <span className="dk-kpi-label">Pointages du jour</span>
            <strong className="dk-kpi-valeur">{entreesJour}</strong>
            <div className="dk-kpi-pied">
              <span className="dk-kpi-caption">moyenne 7 j : {moy7}/jour · {scopeNom || 'toutes entreprises'}</span>
              <BadgeTendance delta={null} neutre texte="jour en cours" />
            </div>
          </>
        ),
      }
    }
    return {
      label: 'Bornes actives',
      corps: (
        <>
          <span className="dk-kpi-label">Bornes actives</span>
          <strong className="dk-kpi-valeur">{bornes ? bornes.actives : '—'}</strong>
          <div className="dk-kpi-pied">
            <span className="dk-kpi-caption">
              sur {bornes ? bornes.total : '—'} autorisée{bornes?.total === 1 ? '' : 's'}
            </span>
            <BadgeTendance neutre />
          </div>
        </>
      ),
    }
  }

  // Contenus des tuiles « Analytique »
  const carteMilieu = (id) => {
    if (id === 'courbe') {
      return {
        label: 'Pointages entrants',
        corps: (
          <>
            <h3 className="dk-carte-titre">Pointages entrants</h3>
            <div className="dk-courbe">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={serie} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dkGradOr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: 'var(--dk-or)', stopOpacity: 0.4 }} />
                      <stop offset="100%" style={{ stopColor: 'var(--dk-or)', stopOpacity: 0.02 }} />
                    </linearGradient>
                    <linearGradient id="dkGradTerre" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: 'var(--dk-terre)', stopOpacity: 0.3 }} />
                      <stop offset="100%" style={{ stopColor: 'var(--dk-terre)', stopOpacity: 0.02 }} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--dk-axe)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--dk-ligne)' }}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fill: 'var(--dk-axe)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--dk-tooltip-fond)',
                      border: '1px solid var(--dk-tooltip-ligne)',
                      borderRadius: 10,
                      fontSize: 12,
                      color: 'var(--dk-texte)',
                    }}
                    labelStyle={{ color: 'var(--dk-ink)' }}
                    itemStyle={{ color: 'var(--dk-ink)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="entrees"
                    name="Pointages"
                    stroke="var(--dk-or)"
                    strokeWidth={2}
                    fill="url(#dkGradOr)"
                  />
                  <Area
                    type="monotone"
                    dataKey="presents"
                    name="Présents"
                    stroke="var(--dk-terre)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    fill="url(#dkGradTerre)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="dk-courbe-legende" aria-hidden="true">
              <span><i className="dk-legende dk-legende--pleine" />Pointages</span>
              <span><i className="dk-legende dk-legende--pointillee" />Présents</span>
            </div>
          </>
        ),
      }
    }
    if (id === 'sante') {
      return {
        label: 'Santé RH',
        corps: (
          <>
            <h3 className="dk-carte-titre">Santé RH</h3>
            <p className="dk-carte-soustitre">Semaine glissante · {scopeNom || 'toutes les entreprises'}</p>
            <div className="dk-sante">
              <div className="dk-sante-score">
                <div>
                  <span className="dk-sante-nom">Assiduité</span>
                  <strong>{sante?.assiduite != null ? `${sante.assiduite} %` : '—'}</strong>
                </div>
                <div>
                  <span className="dk-sante-nom">Régularité</span>
                  <strong>{sante?.regularite != null ? `${sante.regularite} %` : '—'}</strong>
                </div>
              </div>
              <div className="dk-sante-barres">
                <div className="dk-sante-barre">
                  <span style={{ width: `${Math.min(100, sante?.assiduite || 0)}%` }} />
                </div>
                <div className="dk-sante-barre dk-sante-barre--or">
                  <span style={{ width: `${Math.min(100, sante?.regularite || 0)}%` }} />
                </div>
              </div>
              {santeNote && (
                <p className="dk-note-ia">
                  <BrainCircuit size={14} />
                  {santeNote}
                </p>
              )}
            </div>
          </>
        ),
      }
    }
    return {
      label: 'Présence par jour et heure',
      corps: (
        <>
          <h3 className="dk-carte-titre">Présence par jour et heure</h3>
          <div
            className="dk-heatmap"
            role="img"
            aria-label="Heatmap des pointages par jour de semaine et heure"
            onMouseLeave={() => setSurvolHeat(null)}
          >
            {Array.isArray(heatmap) &&
              heatmap.map((ligne, j) => (
                <div className={`dk-heatmap-ligne${survolHeat?.j === j ? ' is-survolee' : ''}`} key={j}>
                  <span className="dk-heatmap-label">{JOURS_SEMAINE[j]}</span>
                  <div className="dk-heatmap-cellules">
                    {ligne.map((v, h) => (
                      <span
                        key={h}
                        className={`dk-heatmap-cellule${survolHeat?.j === j && survolHeat?.h === h ? ' is-survolee' : ''}`}
                        title={`${JOURS_SEMAINE[j]} ${h} h — ${v} pointage${v > 1 ? 's' : ''}`}
                        onMouseEnter={() => setSurvolHeat({ j, h })}
                        style={{ background: couleurCellule(v, maxHeat) }}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
          <div className="dk-heatmap-legende">
            <span className="dk-heatmap-chevrons" aria-hidden="true">
              <i className="dk-heat-0" /><i className="dk-heat-1" /><i className="dk-heat-2" /><i className="dk-heat-3" /><i className="dk-heat-4" />
            </span>
            <span className="dk-heatmap-lecture">
              {survolHeat && Array.isArray(heatmap) && heatmap[survolHeat.j]?.[survolHeat.h] !== undefined
                ? `${JOURS_SEMAINE[survolHeat.j]} · ${survolHeat.h} h — ${heatmap[survolHeat.j][survolHeat.h]} pointage${heatmap[survolHeat.j][survolHeat.h] > 1 ? 's' : ''}`
                : 'moins → plus de pointages'}
            </span>
          </div>
          {prevision && (
            <p className="dk-note-ia">
              <BrainCircuit size={14} />
              {prevision}
            </p>
          )}
        </>
      ),
    }
  }

  // Contenus des tuiles « Détails »
  const carteBas = (id) => {
    if (id === 'insight') {
      return {
        label: 'Insight du jour',
        corps: (
          <div className="dk-hero-corps">
            <span className="dk-hero-puce">
              <Sparkles size={13} />
              Insight du jour
            </span>
            <p className="dk-hero-texte">{insight}</p>
            <span className="dk-hero-fil" aria-hidden="true" />
          </div>
        ),
      }
    }
    if (id === 'donut') {
      return {
        label: donneesDonut.titre,
        corps: (
          <>
            <h3 className="dk-carte-titre">{donneesDonut.titre}</h3>
            <p className="dk-carte-soustitre">{donneesDonut.sousTitre}</p>
            <div className="dk-donut">
              <div className="dk-donut-graphique">
                {totalDonut > 0 ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={donneesDonut.donnees}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {donneesDonut.donnees.map((p, i) => (
                          <Cell key={i} fill={p.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'var(--dk-tooltip-fond)',
                          border: '1px solid var(--dk-tooltip-ligne)',
                          borderRadius: 10,
                          fontSize: 12,
                          color: 'var(--dk-texte)',
                        }}
                        itemStyle={{ color: 'var(--dk-ink)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dk-donut-vide">Aucune donnée</div>
                )}
                <div className="dk-donut-centre">
                  <strong>{totalDonut}</strong>
                  <span>total</span>
                </div>
              </div>
              <ul className="dk-donut-legende">
                {donneesDonut.donnees.slice(0, 5).map((p, i) => (
                  <li key={i}>
                    <span className="dk-donut-point" style={{ background: p.color }} />
                    {p.name}
                    <i className="dk-donut-fil" />
                    <strong>
                      {totalDonut ? Math.round((p.value / totalDonut) * 100) : 0} %
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ),
      }
    }
    return {
      label: 'Taux de présence',
      corps: (
        <>
          <h3 className="dk-carte-titre">Taux de présence</h3>
          <div className="dk-jauge">
            <div className="dk-jauge-graphique">
              <ResponsiveContainer width="100%" height={130}>
                <RadialBarChart
                  innerRadius="72%"
                  outerRadius="100%"
                  data={[{ valeur: stats.tauxPresence || 0 }]}
                  startAngle={180}
                  endAngle={0}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar
                    dataKey="valeur"
                    angleAxisId={0}
                    cornerRadius={9}
                    fill="var(--dk-or)"
                    background={{ fill: 'var(--dk-jauge-fond)' }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="dk-jauge-centre">
                <strong>{Number(stats.employes) ? `${stats.tauxPresence ?? 0} %` : '—'}</strong>
                <span>aujourd’hui</span>
              </div>
            </div>
            <p className="dk-jauge-legende">
              {Number(stats.employes)
                ? `${stats.presentsToday ?? 0} présent${Number(stats.presentsToday ?? 0) > 1 ? 's' : ''} sur ${stats.employes} employé${Number(stats.employes) > 1 ? 's' : ''} actif${Number(stats.employes) > 1 ? 's' : ''}.`
                : 'Aucun employé actif — le taux s’activera au premier effectif.'}
            </p>
          </div>
        </>
      ),
    }
  }

  return (
    <section className={`dk${isKenteCustomizing ? ' is-personnalisation' : ''}`} aria-label="Analytique du tableau de bord">
      {/* En-tête : titre + période + personnalisation + partage */}
      <div className="dk-entete">
        <div>
          <h2 className="dk-titre">Vue d’ensemble</h2>
          <p className="dk-soustitre">
            <Calendar size={13} />
            {scopeNom || 'Toutes les entreprises'} · analyse {JOURS_FR[jours]}
          </p>
        </div>
        <div className="dk-entete-actions">
          <div className="dk-pilotes" role="group" aria-label="Période d’analyse">
            {JOURS_OPTIONS.map((j) => (
              <button
                key={j}
                type="button"
                className={`dk-pilote${j === jours ? ' est-active' : ''}`}
                aria-pressed={j === jours}
                onClick={() => setJours(j)}
              >
                {j} j
              </button>
            ))}
          </div>
          {/* La personnalisation des cartes s'ouvre depuis la sidebar
              (point d'entrée unique « Personnalisation ») ; en mode actif,
              ne restent que les commandes du mode. */}
          {isKenteCustomizing && (
            <>
              <button
                type="button"
                className="dk-bouton-icone est-active"
                onClick={() => surBasculerKente()}
                aria-pressed="true"
                aria-label="Terminer la personnalisation des cartes"
                title="Terminer la personnalisation"
              >
                <CheckCircle2 size={15} />
                <span>Terminer</span>
              </button>
              <button
                type="button"
                className="dk-bouton-icone"
                onClick={() => setCatalogueOuvert(true)}
                aria-haspopup="dialog"
                aria-expanded={catalogueOuvert}
              >
                <Plus size={15} />
                <span>Ajouter une carte</span>
              </button>
              <button type="button" className="dk-bouton-icone" onClick={reinitialiserKente} title="Revenir à la disposition d’origine">
                <RotateCcw size={15} />
                <span>Réinitialiser</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="dk-bouton-partage"
            onClick={() => setPartageOuvert(true)}
          >
            <Share2 size={14} />
            <span>Partager le rapport</span>
          </button>
        </div>
      </div>

      {isKenteCustomizing && (
        <p className="dk-mode-hint" role="status">
          Glisse les cartes ou utilise les flèches pour les réordonner. Masque ce qui ne t’intéresse pas, réajoute-le à tout moment.
        </p>
      )}

      {/* KPI du jour */}
      <div className="dk-kpis">
        {kpiIds.map((id) => coquilleCarte(kpiZ, 'kpi', id, 'dk-kpi', carteKpi(id)))}
      </div>

      {/* Analytique : courbe · santé RH · heatmap */}
      <div className="dk-grille-milieu">
        {milieuIds.map((id) => coquilleCarte(milieuZ, 'milieu', id, 'dk-carte-milieu', carteMilieu(id)))}
      </div>

      {/* Détails : insight · donut · jauge */}
      <div className="dk-grille-bas">
        {basIds.map((id) => coquilleCarte(basZ, 'bas', id, 'dk-carte-bas', carteBas(id)))}
      </div>

      {/* Modale : ajouter une carte masquée */}
      {catalogueOuvert && (
        <div
          className="dk-voile"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCatalogueOuvert(false)
          }}
        >
          <div className="dk-modal dk-modal--catalogue" role="dialog" aria-modal="true" aria-labelledby="dk-catalogue-titre">
            <div className="dk-modal-entete">
              <h3 id="dk-catalogue-titre">Ajouter une carte</h3>
              <button
                type="button"
                className="dk-modal-fermer"
                aria-label="Fermer"
                onClick={() => setCatalogueOuvert(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="dk-catalogue-corps">
              {cartesMasquees.length === 0 ? (
                <div className="dk-catalogue-vide">
                  <CheckCircle2 size={20} />
                  <strong>Toutes les cartes sont déjà affichées.</strong>
                  <span>Utilise « Réinitialiser » pour revenir à la disposition d’origine.</span>
                </div>
              ) : (
                <ul className="dk-catalogue-liste">
                  {cartesMasquees.map((carte) => (
                    <li key={carte.id}>
                      <span className="dk-catalogue-nom">{carte.label}</span>
                      <span className="dk-catalogue-zone">{carte.zone}</span>
                      <button
                        type="button"
                        className="dk-catalogue-ajout"
                        onClick={() => ajouterCarte(carte)}
                        aria-label={`Afficher à nouveau ${carte.label}`}
                      >
                        <Plus size={13} />
                        Afficher
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="dk-catalogue-note">La disposition est enregistrée sur cet appareil, puis synchronisée pour ce compte et cette entreprise.</p>
            </div>
          </div>
        </div>
      )}

      {/* Modale de partage du rapport */}
      {partageOuvert && (
        <div
          className="dk-voile"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPartageOuvert(false)
          }}
        >
          <div
            className="dk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dk-rapport-titre"
          >
            <div className="dk-modal-entete">
              <h3 id="dk-rapport-titre">Rapport de synthèse</h3>
              <button
                type="button"
                className="dk-modal-fermer"
                aria-label="Fermer"
                onClick={() => setPartageOuvert(false)}
              >
                <X size={16} />
              </button>
            </div>
            <pre className="dk-rapport">{rapport}</pre>
            <div className="dk-modal-pied">
              <button type="button" className="dk-bouton-secondaire" onClick={() => setPartageOuvert(false)}>
                Fermer
              </button>
              <button type="button" className="dk-bouton-partage" onClick={copierRapport}>
                {copie ? (
                  <>
                    <Check size={14} />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copier le rapport
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
