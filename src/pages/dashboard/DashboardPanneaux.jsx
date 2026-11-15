// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — CARTE « ÉQUIPE EN DIRECT » (maquette v4)
// Derniers pointages du jour, état réel de chaque collaborateur
// (Actif / Pause / Sorti) et filtres. L'onglet « Retards »
// n'existe que si l'option payante est active, et le filtre
// retenu revient sur « Tous » s'il disparaît — jamais un état
// intermédiaire affiché.
// ═══════════════════════════════════════════════════════════
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

function heureLocale(time) {
  if (!time) return ''
  const d = new Date(time)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function initiales(employee) {
  return `${employee?.first_name?.[0] || ''}${employee?.last_name?.[0] || ''}`.toUpperCase() || '??'
}

export default function DashboardPanneaux({ layout, data }) {
  const { activityFilter, setActivityFilter } = layout
  const { recentActivity = [], retardsOptionActive = false, loadError, activePauses = [] } = data

  // L'état de chaque collaborateur vient des pointages réels du jour
  // (dernier pointage) et des pauses réellement ouvertes.
  const etats = new Map()
  for (const item of recentActivity) {
    const id = item.employee_id || item.employee?.id
    if (!id) continue
    etats.set(id, {
      id,
      employee: item.employee,
      lastType: String(item.type || '').toLowerCase(),
      lastTime: item.time,
      photoUrl: item.photoUrl,
      isLate: Boolean(item.isLate),
      matricule: item.employee?.matricule,
    })
  }
  for (const pause of activePauses) {
    const id = pause.employee_id
    if (id && etats.has(id)) etats.get(id).enPause = true
  }
  const lignes = [...etats.values()].sort(
    (a, b) => new Date(b.lastTime) - new Date(a.lastTime),
  ).slice(0, 6)

  const compte = {
    all: lignes.length,
    service: lignes.filter((l) => !l.enPause && l.lastType === 'in').length,
    pause: lignes.filter((l) => l.enPause).length,
    late: lignes.filter((l) => l.isLate).length,
  }

  // L'option « retards » peut être coupée par le module : le filtre retenu
  // revient alors sur « tout », sans passer par un état intermédiaire.
  const filtreActivite = !retardsOptionActive && activityFilter === 'late' ? 'all' : activityFilter

  const filtres = [
    { id: 'all', label: 'Tous' },
    { id: 'service', label: 'En service' },
    { id: 'pause', label: 'En pause' },
    ...(retardsOptionActive ? [{ id: 'late', label: 'Retards' }] : []),
  ]

  const lignesFiltrees = lignes.filter((ligne) => {
    if (filtreActivite === 'all') return true
    if (filtreActivite === 'late') return Boolean(ligne.isLate)
    if (filtreActivite === 'pause') return Boolean(ligne.enPause)
    return !ligne.enPause && ligne.lastType === 'in'
  })

  const badgeStatut = (ligne) => {
    if (ligne.enPause) return <span className="mq-status pause">Pause</span>
    if (ligne.lastType === 'in') return <span className="mq-status actif">Actif</span>
    return <span className="mq-status sorti">Sorti</span>
  }

  return (
    <article className="mq-card mq-c4" aria-label="Équipe en direct">
      <div className="mq-card-head">
        <div className="titles">
          <h2>Équipe en direct</h2>
          <div className="sub">Suivez les pointages en cours</div>
        </div>
        <div className="head-right">
          <span className="mq-badge-direct">EN DIRECT</span>
        </div>
      </div>

      <div className="mq-tabs" role="group" aria-label="Filtrer l'équipe">
        {filtres.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`mq-tab${filtreActivite === filter.id ? ' is-active' : ''}`}
            aria-pressed={filtreActivite === filter.id}
            onClick={() => setActivityFilter(filter.id)}
          >
            {filter.label}
            <span className="n">{compte[filter.id]}</span>
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="mq-team">
          <div className="mq-bars-empty">
            <b>Données indisponibles</b>
            L'équipe se remet à jour dès le rechargement.
          </div>
        </div>
      ) : lignesFiltrees.length === 0 ? (
        <div className="mq-team">
          <div className="mq-bars-empty">
            <b>Aucun pointage{filtreActivite === 'late' ? ' en retard' : ''} pour l'instant</b>
            L'équipe se met à jour en temps réel.
          </div>
        </div>
      ) : (
        <div className="mq-team">
          {lignesFiltrees.map((ligne) => (
            <Link
              className="mq-team-row"
              key={ligne.id}
              to={ligne.matricule ? `/pointages?q=${encodeURIComponent(ligne.matricule)}` : '/pointages'}
              title="Voir la journée dans Pointages"
            >
              {ligne.photoUrl ? (
                <img className="mq-team-ava" src={ligne.photoUrl} alt="" />
              ) : (
                <i className="mq-team-ava" aria-hidden="true">{initiales(ligne.employee)}</i>
              )}
              <span className="mq-team-copy">
                <b>{`${ligne.employee?.first_name || ''} ${ligne.employee?.last_name || ''}`.trim() || 'Employé'}</b>
                <span>
                  {ligne.enPause
                    ? 'Pause en cours'
                    : `Dernier pointage à ${heureLocale(ligne.lastTime) || '—'}`}
                </span>
              </span>
              {badgeStatut(ligne)}
              <ChevronRight size={15} className="mq-team-more" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}

      <div className="mq-foot">
        {recentActivity.length} pointage{recentActivity.length > 1 ? 's' : ''} aujourd'hui
        <Link to="/pointages" style={{ marginLeft: 'auto' }}>Tout l'historique du jour →</Link>
      </div>
    </article>
  )
}
