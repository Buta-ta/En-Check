// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — TUILE VEDETTE « SANTÉ KENTE »
// Bande tissée officielle, anneau de score, facteurs réels
// (assiduité, régularité, pointages 7 j, bornes) et insight
// du jour. Données : RPC encheck_dashboard_synthese.
// ═══════════════════════════════════════════════════════════
import { Activity, Share2 } from 'lucide-react'
import { JOURS_OPTIONS, formatDelta, moyenne, pctDelta } from './kente/kenteUtils'

const RAYON = 30
const CIRCONFERENCE = 2 * Math.PI * RAYON

function clamp(v, bas, haut) {
  return Math.max(bas, Math.min(haut, v))
}

export default function KenteHeroTile({
  serie = [],
  sante,
  tendances,
  bornes,
  insight,
  jours,
  setJours,
  scopeNom,
  onRapport,
}) {
  const score = sante ? Math.round((Number(sante.assiduite) + Number(sante.regularite)) / 2) : null
  const qualite = score === null ? null : score >= 80 ? 'bonne' : score >= 60 ? 'correcte' : 'en retrait'
  const qualiteClass = score === null ? '' : score >= 80 ? '' : score >= 60 ? ' est-moyen' : ' est-faible'
  const totalPointages = serie.reduce((a, p) => a + (Number(p.entrees) || 0), 0)
  const moy7 = Math.round(moyenne(serie.slice(-7).map((p) => p.entrees)))
  const deltaSemaine = pctDelta(tendances?.entrees_7j, tendances?.entrees_7j_prev)

  const facteurs = []
  if (sante) {
    facteurs.push({ nom: 'Assiduité', valeur: Number(sante.assiduite), classe: Number(sante.assiduite) >= 85 ? 'g' : 'o' })
    facteurs.push({ nom: 'Régularité', valeur: Number(sante.regularite), classe: Number(sante.regularite) >= 70 ? 'g' : 'o' })
  }
  if (tendances) {
    facteurs.push({
      nom: 'Pointages 7 j',
      valeur: deltaSemaine === null ? '—' : formatDelta(deltaSemaine),
      largeur: deltaSemaine === null ? 0 : clamp(100 + deltaSemaine, 15, 100),
      classe: deltaSemaine === null ? 'o' : deltaSemaine >= 0 ? 'g' : 'o',
      brut: Boolean(deltaSemaine === null),
    })
  }
  if (bornes?.total) {
    facteurs.push({
      nom: 'Bornes en ligne',
      valeur: `${bornes.actives}/${bornes.total}`,
      largeur: Math.round((bornes.actives / bornes.total) * 100),
      classe: bornes.actives === bornes.total ? 'g' : 'o',
      brut: true,
    })
  }

  return (
    <article className="tile tile-kente c5 r2" aria-label="Santé de la main-d'œuvre">
      <div className="tile-head">
        <span className="tile-ico gold"><Activity size={14} /></span>
        <span className="tile-title">Santé de la main-d'œuvre</span>
        <div className="kente-pilotes" role="group" aria-label="Période d'analyse">
          {JOURS_OPTIONS.map((j) => (
            <button
              key={j}
              type="button"
              className={`kente-pilote${j === jours ? ' est-active' : ''}`}
              aria-pressed={j === jours}
              onClick={() => setJours(j)}
            >
              {j} j
            </button>
          ))}
        </div>
      </div>

      <div className="kente-strip" role="img" aria-label="Bande kente tissée — motif En-Check" />

      <div className="kente-head">
        <div className="ring">
          <svg viewBox="0 0 74 74" aria-hidden="true">
            <defs>
              <linearGradient id="bentoGradGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e8cf9a" />
                <stop offset="100%" stopColor="#a37a35" />
              </linearGradient>
            </defs>
            <circle className="track" cx="37" cy="37" r={RAYON} fill="none" stroke-width="7" />
            {score !== null && (
              <circle
                className="prog"
                cx="37"
                cy="37"
                r={RAYON}
                fill="none"
                stroke-width="7"
                strokeDasharray={CIRCONFERENCE}
                strokeDashoffset={CIRCONFERENCE * (1 - score / 100)}
                transform="rotate(-90 37 37)"
              />
            )}
          </svg>
          <div className="core">
            <b>{score === null ? '—' : score}</b>
            <span>/ 100</span>
          </div>
        </div>
        <div className="kente-meta">
          <div className="lbl">
            Santé{' '}
            {qualite ? (
              <em className={qualiteClass}>{qualite}</em>
            ) : (
              <span style={{ color: 'var(--txt-3)' }}>en attente</span>
            )}
          </div>
          <div className="sub">
            {scopeNom || 'Toutes les entreprises'} · {totalPointages} pointages analysés{moy7 > 0 ? ` · moyenne ${moy7}/jour` : ''}
          </div>
          <div className="kente-factors">
            {facteurs.map((f) => (
              <div className="factor" key={f.nom}>
                <span>{f.nom}</span>
                <span className="bar"><i className={f.classe} style={{ '--w': `${f.largeur || 0}%` }} /></span>
                <span className="val">{f.brut ? f.valeur : f.valeur}</span>
              </div>
            ))}
            {facteurs.length === 0 && (
              <div className="factor">
                <span>Analyse</span>
                <span className="bar" />
                <span className="val">—</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {insight && (
        <p className="kente-insight"><b>Insight · </b>{insight}</p>
      )}

      <div className="foot">
        Synthèse {JOURS_OPTIONS.includes(jours) ? `${jours} jours` : ''}
        <button type="button" onClick={onRapport} style={{ marginLeft: 'auto' }} aria-haspopup="dialog">
          <Share2 size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
          Voir le rapport détaillé →
        </button>
      </div>
    </article>
  )
}
