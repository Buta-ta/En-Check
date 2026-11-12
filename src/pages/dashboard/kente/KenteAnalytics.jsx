// ═══════════════════════════════════════════════════════════
// 📊 LA CONSOLE KENTE — couche analytique du dashboard
//
// Maquette « Insighta » transposée à l'identité En-Check :
// fond sombre chaud permanent, accents terracotta/or, bande
// kente sur les cartes. Données : RPC encheck_dashboard_synthese
// (historique, heatmap, tendances, bornes, santé) + les stats
// du jour déjà chargées par le dashboard. Insights à règles en
// v1 (le LLM branchera les mêmes surfaces ensuite).
// Si la RPC est indisponible, la couche se retire discrètement
// : le dashboard classique continue de fonctionner.
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
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
import { Calendar, Share2, Sparkles } from 'lucide-react'
import KenteSanteHeatmap from './KenteSanteHeatmap'
import KenteModalRapport from './KenteModalRapport'
import {
  JOURS_FR,
  JOURS_OPTIONS,
  PALETTE_KENTE,
  choisirInsight,
  moyenne,
  notePrevision,
  noteSante,
  pctDelta,
  formatDelta,
} from './kenteUtils'
function BadgeTendance({ delta, neutre = false }) {
  if (delta === null || delta === undefined || neutre) {
    return <span className="dk-badge dk-badge--neutre">{neutre ? 'MàJ' : '—'}</span>
  }
  const positif = delta > 0
  return (
    <span className={`dk-badge ${positif ? 'dk-badge--up' : 'dk-badge--down'}`}>
      {positif ? '▲' : '▼'} {formatDelta(delta)}
    </span>
  )
}

import './kente.css'
import './kente-widgets.css'
export default function DashboardKenteAnalytics({
  admin,
  isSuperAdmin,
  stats = {},
  topEntreprises = [],
}) {
  const [jours, setJours] = useState(30)
  const [donnees, setDonnees] = useState(null)
  const [echec, setEchec] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [partageOuvert, setPartageOuvert] = useState(false)
  const [copie, setCopie] = useState(false)

  const scopeId = isSuperAdmin
    ? admin?.selectedEnterprise?.id || null
    : admin?.selectedEnterprise?.id || admin?.enterprise_id || null
  const fuseau = admin?.selectedEnterprise?.timezone || null
  const scopeCle = `${scopeId || 'global'}|${fuseau || 'utc'}`
  const scopeNom = admin?.selectedEnterprise?.name || (isSuperAdmin ? 'Toutes les entreprises' : admin?.enterprise_name || '')

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        name: e.name,
        value: e.presentsToday || 0,
        color: PALETTE_KENTE[i % PALETTE_KENTE.length],
      }))
      const reste = topEntreprises
        .slice(5)
        .reduce((a, e) => a + (e.presentsToday || 0), 0)
      if (reste > 0) top.push({ name: 'Autres', value: reste, color: PALETTE_KENTE[5] })
      return {
        titre: 'Présence par entreprise',
        sousTitre: 'Présents aujourd’hui par entreprise.',
        donnees: top,
      }
    }
    const parts = [
      { name: 'Présents', value: stats.presentsToday || 0, color: PALETTE_KENTE[0] },
      { name: 'Absents', value: stats.absentsToday || 0, color: PALETTE_KENTE[1] },
      { name: 'En congé', value: stats.congesToday || 0, color: PALETTE_KENTE[4] },
    ].filter((p) => p.value > 0)
    return {
      titre: 'Présence aujourd’hui',
      sousTitre: `Répartition sur ${stats.employes || 0} employé${(stats.employes || 0) > 1 ? 's' : ''}.`,
      donnees: parts,
    }
  }, [scopeId, topEntreprises, stats])
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
      `- Assiduité : ${sante?.assiduite ?? '—'} % · Régularité : ${sante?.regularite ?? '—'} %`,
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
        <div className="dk-kente" aria-hidden="true" />
        <div className="dk-squelette">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>
    )
  }
  if (!donnees || !serie.length) return null

  return (
    <section className="dk" aria-label="Analytique du tableau de bord">
      <div className="dk-kente" aria-hidden="true" />

      {/* En-tête : titre + période + partage */}
      <div className="dk-entete">
        <div>
          <h2 className="dk-titre">Vue d’ensemble</h2>
          <p className="dk-soustitre">
            <Calendar size={13} />
            {JOURS_FR[jours]} · {scopeNom || 'Toutes les entreprises'}
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
          <button
            type="button"
            className="dk-bouton-partage"
            onClick={() => setPartageOuvert(true)}
          >
            <Share2 size={14} />
            Partager le rapport
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="dk-kpis">
        <article className="dk-carte dk-kpi">
          <div className="dk-carte-kente" aria-hidden="true" />
          <span className="dk-kpi-label">Présents aujourd’hui</span>
          <strong className="dk-kpi-valeur">{stats.presentsToday ?? '—'}</strong>
          <div className="dk-kpi-pied">
            <span className="dk-kpi-caption">
              {stats.retardsToday ?? 0} retards · {stats.absentsToday ?? 0} absents
            </span>
            <BadgeTendance delta={deltaSemaine} />
          </div>
        </article>
        <article className="dk-carte dk-kpi">
          <div className="dk-carte-kente" aria-hidden="true" />
          <span className="dk-kpi-label">Pointages du jour</span>
          <strong className="dk-kpi-valeur">{entreesJour}</strong>
          <div className="dk-kpi-pied">
            <span className="dk-kpi-caption">moyenne 7 j : {moy7}/jour</span>
            <BadgeTendance delta={deltaSemaine} />
          </div>
        </article>
        <article className="dk-carte dk-kpi">
          <div className="dk-carte-kente" aria-hidden="true" />
          <span className="dk-kpi-label">Bornes actives</span>
          <strong className="dk-kpi-valeur">
            {bornes ? bornes.actives : '—'}
          </strong>
          <div className="dk-kpi-pied">
            <span className="dk-kpi-caption">
              sur {bornes ? bornes.total : '—'} autorisée{bornes?.total === 1 ? '' : 's'}
            </span>
            <BadgeTendance neutre />
          </div>
        </article>
      </div>

      {/* Milieu : courbe · santé RH · heatmap */}
      <div className="dk-grille-milieu">
        <article className="dk-carte">
          <div className="dk-carte-kente" aria-hidden="true" />
          <h3 className="dk-carte-titre">Pointages entrants</h3>
          <div className="dk-courbe">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={serie} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="dkGradOr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c9a961" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#c9a961" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="dkGradTerre" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c25a2b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#c25a2b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#9a8468', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(201, 169, 97, 0.15)' }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: '#9a8468', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#241813',
                    border: '1px solid rgba(201, 169, 97, 0.25)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#cbb8a0' }}
                  itemStyle={{ color: '#f2e8d5' }}
                />
                <Area
                  type="monotone"
                  dataKey="entrees"
                  name="Pointages"
                  stroke="#c9a961"
                  strokeWidth={2}
                  fill="url(#dkGradOr)"
                />
                <Area
                  type="monotone"
                  dataKey="presents"
                  name="Présents"
                  stroke="#c25a2b"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  fill="url(#dkGradTerre)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <KenteSanteHeatmap sante={sante} santeNote={santeNote} heatmap={heatmap} maxHeat={maxHeat} prevision={prevision} />
      </div>

      {/* Bas : insight héro · donut · jauge */}
      <div className="dk-grille-bas">
        <article className="dk-carte dk-carte-hero">
          <span className="dk-hero-puce">
            <Sparkles size={13} />
            Insight du jour
          </span>
          <p className="dk-hero-texte">{insight}</p>
          <span className="dk-hero-points" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <i key={i} className={i < 6 ? 'est-plein' : ''} />
            ))}
          </span>
        </article>

        <article className="dk-carte">
          <div className="dk-carte-kente" aria-hidden="true" />
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
                        background: '#241813',
                        border: '1px solid rgba(201, 169, 97, 0.25)',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      itemStyle={{ color: '#f2e8d5' }}
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
        </article>

        <article className="dk-carte">
          <div className="dk-carte-kente" aria-hidden="true" />
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
                    fill="#c9a961"
                    background={{ fill: 'rgba(201, 169, 97, 0.12)' }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="dk-jauge-centre">
                <strong>{stats.tauxPresence ?? '—'}%</strong>
                <span>aujourd’hui</span>
              </div>
            </div>
            <p className="dk-jauge-legende">
              {stats.presentsToday ?? 0} présent{Number(stats.presentsToday ?? 0) > 1 ? 's' : ''} sur{' '}
              {stats.employes ?? 0} employé{Number(stats.employes ?? 0) > 1 ? 's' : ''} actif
              {Number(stats.employes ?? 0) > 1 ? 's' : ''}.
            </p>
          </div>
        </article>
      </div>
      <KenteModalRapport ouvert={partageOuvert} onFermer={() => setPartageOuvert(false)} rapport={rapport} copie={copie} onCopier={copierRapport} />
    </section>
  )
}
