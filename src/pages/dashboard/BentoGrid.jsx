// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — GRILLE BENTO (maquette validée)
// Tuiles à gabarits variés : vedette kente, KPI en dégradés
// lumineux, flux direct, à traiter, pointages du jour, taux de
// présence, bornes, pause live, pointages 7 jours, pilotage
// multi-entreprises, aujourd'hui. Toutes les données sont
// réelles ; sans données, une tuile se retire ou affiche
// l'état honnête.
// ═══════════════════════════════════════════════════════════
import { Link } from 'react-router-dom'
import {
  Building2, CalendarClock, Clock, Coffee, Gauge, Loader2, Router, ShieldCheck,
  Sparkles, Timer,
} from 'lucide-react'
import KenteHeroTile from './KenteHeroTile'
import DashboardPanneaux from './DashboardPanneaux'
import { JOURS_SEMAINE } from './kente/kenteUtils'

function Sparkline({ values, id, color }) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const W = 108
  const H = 34
  const P = 3
  const pts = values.map((v, i) => [
    P + (i * (W - 2 * P)) / (values.length - 1),
    H - P - ((v - min) / range) * (H - 2 * P),
  ])
  const line = pts.map((p) => p.join(',')).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <polygon className="area" points={`${P},${H} ${line} ${W - P},${H}`} fill={`url(#${id})`} />
      <polyline className="line" pathLength="100" points={line} stroke={`url(#${id})`} />
      <circle className="pt" cx={last[0]} cy={last[1]} r="2.6" fill={color} style={{ color }} />
    </svg>
  )
}

function AnneauPresence({ valeur }) {
  const C = 2 * Math.PI * 30
  return (
    <div className="ring-sm">
      <svg viewBox="0 0 74 74" aria-hidden="true">
        <defs>
          <linearGradient id="bentoGradAnneau" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e0c88f" />
            <stop offset="0.55" stopColor="#c9a961" />
            <stop offset="1" stopColor="#c25a2b" />
          </linearGradient>
        </defs>
        <circle cx="37" cy="37" r="30" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
        <circle
          cx="37" cy="37" r="30" fill="none"
          stroke="url(#bentoGradAnneau)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.max(0, Math.min(100, valeur)) / 100)}
          transform="rotate(-90 37 37)"
          style={{ filter: 'drop-shadow(0 0 8px rgba(201,169,97,.65))', animation: 'bento-sweep 1.5s var(--ease) .3s backwards' }}
        />
      </svg>
      <div className="core">
        <b>{valeur}%</b>
        <span>taux</span>
      </div>
    </div>
  )
}

const ICONE_ACTION = {
  conflict: 'conflict',
  schedule: 'request',
  late: 'pause',
  missing: 'conflict',
}
const ICONES_ACTION = {
  conflict: ShieldCheck,
  schedule: CalendarClock,
  late: Coffee,
  missing: Clock,
}

export default function BentoGrid({
  layout,
  employeeCount,
  presentCount,
  absentCount,
  lateCount,
  leaveCount,
  presenceRate,
  stats = {},
  retardsOptionActive = false,
  isSuperAdmin = false,
  loadError,
  reviewItems = [],
  reviewCount,
  topEntreprises = [],
  todayHoliday,
  recentActivity = [],
  activePauses = [],
  realPausesToday = [],
  unplannedPauses = [],
  nowMs,
  bornes,
  serie = [],
  kente,
  onItemAction,
  processingScheduleRequestId,
  formaterPause,
}) {
  const pauseEnCours = activePauses[0]
  const dernieresEntrees = serie.slice(-7).map((p) => p.entrees)
  const maxEntrees = Math.max(...dernieresEntrees, 1)

  return (
    <section className="bento-grid" aria-label="Indicateurs du jour">

      {/* ── Santé kente (vedette) ── */}
      {kente && !kente.echec && (
        <KenteHeroTile
          donnees={kente.donnees}
          serie={kente.serie}
          sante={kente.sante}
          tendances={kente.tendances}
          bornes={kente.bornes}
          insight={kente.insight}
          jours={kente.jours}
          setJours={kente.setJours}
          scopeNom={kente.scopeNom}
          onRapport={kente.onRapport}
        />
      )}

      {/* ── Présents ── */}
      <article className="tile c4 r1" aria-label="Présents aujourd'hui">
        <div className="tile-head">
          <span className="tile-title"><span className="status-dot g" aria-hidden="true" />Présents</span>
        </div>
        <Sparkline values={serie.slice(-7).map((p) => p.presents)} id="bentoSparkPresent" color="#30d158" />
        <div className="kpi-value v-green">{loadError ? '—' : presentCount}</div>
        <span className={`delta ${presenceRate >= 90 ? 'up' : 'flat'}`}>
          {loadError ? 'Données indisponibles' : `${presenceRate} % des ${employeeCount} employés`}
        </span>
      </article>

      {/* ── Retards (option payante) ── */}
      {retardsOptionActive && (
        <article className="tile c4 r1" aria-label="Retards du jour">
          <div className="tile-head">
            <span className="tile-title"><span className="status-dot o" aria-hidden="true" />Retards</span>
            <span className="badge-paid">OPTION ACTIVE</span>
          </div>
          <div className="kpi-value v-orange">{loadError ? '—' : lateCount}</div>
          <span className={`delta ${lateCount > 0 ? 'warn' : 'up'}`}>
            {loadError ? 'Données indisponibles' : lateCount > 0 ? `${lateCount} à consulter aujourd'hui` : 'Aucun retard aujourd’hui'}
          </span>
        </article>
      )}

      {/* ── Absents ── */}
      <article className="tile c3 r1" aria-label="Absents aujourd’hui">
        <div className="tile-head">
          <span className="tile-title"><span className="status-dot r" aria-hidden="true" />Absents</span>
        </div>
        <div className="kpi-value v-red">{loadError ? '—' : absentCount}</div>
        <span className="delta flat">
          {loadError ? 'Données indisponibles' : `${leaveCount} en congé ou maladie`}
        </span>
      </article>

      {/* ── Pointages en direct ── */}
      <DashboardPanneaux
        layout={layout}
        data={{ recentActivity, retardsOptionActive, loadError }}
      />

      {/* ── À traiter ── */}
      <article className="tile c4 r2" aria-label="Situations à traiter">
        <div className="tile-head">
          <span className="tile-title">À traiter</span>
          {reviewCount > 0 && <span className="bento-nav-badge hot" style={{ marginLeft: 4 }}>{reviewCount}</span>}
          <Sparkles size={14} style={{ marginLeft: 'auto', color: 'var(--or-clair)', opacity: .6 }} />
        </div>
        {reviewItems.length === 0 ? (
          <div className="empty-tile">
            <b>Tout est en ordre</b>
            Aucune situation à examiner pour le moment.
          </div>
        ) : (
          reviewItems.slice(0, 3).map((item) => {
            const Icone = ICONES_ACTION[item.kind] || ShieldCheck
            const enCours = item.quickScheduleRequest && processingScheduleRequestId === item.quickScheduleRequest.id
            return (
              <div className="action-row" key={item.key}>
                <span className={`action-ico ${ICONE_ACTION[item.kind] || 'conflict'}`}><Icone size={15} /></span>
                <span className="action-meta">
                  <b>{item.title}</b>
                  <span>{item.description}</span>
                </span>
                <button
                  type="button"
                  className={`mini-btn ${item.kind === 'schedule' ? 'ok' : 'gold'}`}
                  disabled={enCours}
                  onClick={() => onItemAction(item)}
                >
                  {enCours && <Loader2 size={13} style={{ animation: 'bento-spin 1s linear infinite', display: 'inline', verticalAlign: '-2px' }} />}
                  {enCours ? 'Envoi…' : item.actionLabel}
                </button>
              </div>
            )
          })
        )}
        <div className="foot">
          Résolution en 1 geste
          <Link to="/pointages" style={{ marginLeft: 'auto' }}>{reviewCount > 0 ? `${reviewCount} en attente →` : 'Voir les pointages →'}</Link>
        </div>
      </article>

      {/* ── Pointages du jour ── */}
      <article className="tile c3 r1" aria-label="Pointages du jour">
        <div className="tile-head"><span className="tile-title">Pointages du jour</span></div>
        <div className="kpi-value v-gold">{loadError ? '—' : Number(stats.pointages) || 0}</div>
        <div className="kpi-sub">entrées et sorties enregistrées</div>
      </article>

      {/* ── Taux de présence ── */}
      <article className="tile c3 r1" aria-label="Taux de présence">
        <div className="tile-head"><span className="tile-title">Taux de présence</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minHeight: 0 }}>
          <AnneauPresence valeur={loadError ? 0 : presenceRate} />
          <div className="ring-side">
            <div className="big">{loadError ? 'Indisponible' : presenceRate >= 95 ? 'Objectif atteint' : 'En progression'}</div>
            <div className="sm">{loadError ? 'Réessayez après le rechargement' : `${presentCount} présent${presentCount > 1 ? 's' : ''} sur ${employeeCount} employé${employeeCount > 1 ? 's' : ''} actif${employeeCount > 1 ? 's' : ''}`}</div>
          </div>
        </div>
      </article>

      {/* ── Bornes ── */}
      <article className="tile c4 r2" aria-label="Bornes de pointage">
        <div className="tile-head">
          <span className="tile-ico"><Router size={14} /></span>
          <span className="tile-title">Bornes</span>
          {bornes?.total > 0 && (
            <span className={`delta ${bornes.actives === bornes.total ? 'up' : 'warn'}`} style={{ marginLeft: 'auto', marginTop: 0 }}>
              {bornes.actives} / {bornes.total} EN LIGNE
            </span>
          )}
        </div>
        {bornes?.total > 0 ? (
          <>
            <div className="borne-compteur">
              <div className="kpi-value v-gold">{bornes.actives}<small> / {bornes.total}</small></div>
            </div>
            <div className="borne-legende">
              borne{bornes.total > 1 ? 's' : ''} active{bornes.actives > 1 ? 's' : ''} autorisée{bornes.total > 1 ? 's' : ''} · synthèse kente
            </div>
          </>
        ) : (
          <div className="empty-tile">
            <b>Données en attente</b>
            Le nombre de bornes arrive avec la synthèse.
          </div>
        )}
        <div className="foot">
          <Gauge size={13} style={{ color: 'var(--txt-3)' }} />
          Synchronisation continue
          <Link to="/configuration-pointeuse" style={{ marginLeft: 'auto' }}>Gérer les bornes →</Link>
        </div>
      </article>

      {/* ── Pause live ── */}
      <article className="tile c4 r1" aria-label="Pauses en cours">
        <div className="tile-head">
          <span className="tile-title">Pause en cours</span>
          {pauseEnCours && <span className="pulse" style={{ marginLeft: 'auto' }} aria-hidden="true" />}
        </div>
        {pauseEnCours ? (
          <div className="pause-now">
            <span className="pause-timer">{formaterPause ? formaterPause(pauseEnCours, nowMs) : pauseEnCours.debutHHMM || '—'}</span>
            <span className="pause-nom">
              {pauseEnCours.employe || 'Employé'}
              <span>depuis {pauseEnCours.debutHHMM || '—'}{pauseEnCours.estNonPlanifiee ? ' · hors planning' : ''}</span>
            </span>
          </div>
        ) : realPausesToday.length > 0 ? (
          <div className="pause-now">
            <span className="pause-nom" style={{ marginLeft: 0 }}>
              {realPausesToday.length} pause{realPausesToday.length > 1 ? 's' : ''} réelle{realPausesToday.length > 1 ? 's' : ''} aujourd'hui
              <span>{unplannedPauses.length > 0 ? `${unplannedPauses.length} hors planning` : 'selon planning'}</span>
            </span>
            <Link to="/pauses" className="mini-btn gold" style={{ marginLeft: 'auto' }}>Voir</Link>
          </div>
        ) : (
          <div className="pause-now">
            <span className="pause-nom" style={{ marginLeft: 0 }}>
              Aucune pause en cours
              <span>Les pauses réelles apparaîtront ici en direct</span>
            </span>
          </div>
        )}
      </article>

      {/* ── Pointages 7 jours ── */}
      <article className="tile c4 r1" aria-label="Pointages des 7 derniers jours">
        <div className="tile-head">
          <span className="tile-title">Pointages — 7 jours</span>
          <span className="badge-paid">SYNTHÈSE</span>
        </div>
        {dernieresEntrees.length >= 2 ? (
          <div className="bars">
            {serie.slice(-7).map((p) => (
              <div className={`b${p.entrees === maxEntrees && maxEntrees > 0 ? ' peak' : ''}`} key={p.date}>
                <i style={{ height: `${Math.max(8, Math.round((p.entrees / maxEntrees) * 100))}%` }} />
                <span>{(JOURS_SEMAINE[p.jourSemaine] || '?').slice(0, 1)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flow-vide"><b>Données insuffisantes</b>La barre se remplit dès que la synthèse arrive.</div>
        )}
        <div className="foot">
          {dernieresEntrees.length >= 2 ? `Pic : ${Math.max(...dernieresEntrees)} pointages/jour` : '—'}
          <Link to="/rapports" style={{ marginLeft: 'auto' }}>Détail →</Link>
        </div>
      </article>

      {/* ── Pilotage multi-entreprises ── */}
      {isSuperAdmin && topEntreprises.length > 0 && (
        <article className="tile c8 r2" aria-label="Pilotage multi-entreprises">
          <div className="tile-head">
            <span className="tile-ico"><Building2 size={14} /></span>
            <span className="tile-title">Pilotage multi-entreprises</span>
          </div>
          <div className="ent-head">
            <div aria-hidden="true"></div>
            <div>Entreprise</div>
            <div style={{ textAlign: 'right' }}>Taux</div>
            <div style={{ textAlign: 'right' }}>Présents</div>
            <div style={{ textAlign: 'right' }}>Répartition</div>
          </div>
          {topEntreprises.map((ent, i) => (
            <Link className="ent-row" to={`/dashboard?entreprise=${ent.id}`} key={ent.id} title={`Afficher ${ent.name}`}>
              <span className={`rank${i === 0 ? ' doree' : ''}`}>{i + 1}</span>
              <span className="name">
                <b>{ent.name}</b>
                <span>{ent.employeesCount} employé{ent.employeesCount > 1 ? 's' : ''}</span>
              </span>
              <span className="kpi"><span className={ent.tauxPresence >= 95 ? 'ok' : 'warn'}>{ent.tauxPresence} %</span></span>
              <span className="kpi">{ent.presentsToday}</span>
              <div className="minibar"><i className={ent.tauxPresence >= 95 ? 'g' : 'w'} style={{ '--w': `${Math.max(0, Math.min(100, ent.tauxPresence))}%` }} /></div>
            </Link>
          ))}
        </article>
      )}

      {/* ── Aujourd'hui ── */}
      <article className="tile c4 r1" aria-label="Journée d'aujourd'hui">
        <div className="tile-head"><span className="tile-title">Aujourd'hui</span></div>
        <div className="info-line">
          {todayHoliday ? (
            <>
              <span className="info-ico gold"><Timer size={15} /></span>
              <span><b>{todayHoliday.name}</b> — fête officielle, journée exceptionnelle.</span>
            </>
          ) : (
            <>
              <span className="info-ico"><Clock size={15} /></span>
              <span><b>Journée normale</b> — aucune fête officielle aujourd'hui.</span>
            </>
          )}
        </div>
      </article>

    </section>
  )
}
