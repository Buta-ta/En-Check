// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — TUILE « POINTAGES EN DIRECT » (maquette Bento)
// Flux des derniers pointages avec filtres (Tous / Entrées /
// Sorties / Retards). L'onglet « Retards » n'existe que si
// l'option payante est active, et le filtre retenu revient sur
// « Tous » s'il disparaît — jamais un état intermédiaire affiché.
// ═══════════════════════════════════════════════════════════
import { Camera, History } from 'lucide-react'
import { Link } from 'react-router-dom'

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
  const { recentActivity = [], retardsOptionActive = false, loadError } = data

  // L'option « retards » peut être coupée par le module : le filtre retenu
  // revient alors à « tout », sans passer par un état intermédiaire.
  const filtreActivite = !retardsOptionActive && activityFilter === 'late' ? 'all' : activityFilter

  const filtres = [
    { id: 'all', label: 'Tous' },
    { id: 'in', label: 'Entrées' },
    { id: 'out', label: 'Sorties' },
    ...(retardsOptionActive ? [{ id: 'late', label: 'Retards' }] : []),
  ]

  const itemsFiltres = recentActivity
    .filter((item) => {
      if (filtreActivite === 'all') return true
      if (filtreActivite === 'late') return Boolean(item.isLate)
      return String(item.type || '').toLowerCase() === filtreActivite
    })
    .slice(0, 6)

  return (
    <article className="tile c4 r3" aria-label="Pointages en direct">
      <div className="tile-head">
        <span className="tile-ico"><History size={14} /></span>
        <span className="tile-title">Pointages en direct</span>
        <span className="live-pill">LIVE</span>
      </div>

      <div className="bento-filters" role="group" aria-label="Filtrer l'activité">
        {filtres.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`bento-filter${filtreActivite === filter.id ? ' is-active' : ''}`}
            aria-pressed={filtreActivite === filter.id}
            onClick={() => setActivityFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="flow-vide">
          <b>Données indisponibles</b>
          Le flux se remet à jour dès le rechargement.
        </div>
      ) : itemsFiltres.length === 0 ? (
        <div className="flow-vide">
          <b>Aucun pointage{filtreActivite === 'late' ? ' en retard' : ''} pour l'instant</b>
          Le flux se met à jour en temps réel.
        </div>
      ) : (
        <div className="flow">
          {itemsFiltres.map((item) => {
            const entree = String(item.type || '').toLowerCase() === 'in'
            return (
              <div className="flow-row" key={item.id}>
                <span className="flow-ava" aria-hidden="true">{initiales(item.employee)}</span>
                <span className="flow-meta">
                  <b>{`${item.employee?.first_name || ''} ${item.employee?.last_name || ''}`.trim() || 'Employé'}</b>
                  <span>{item.employee?.matricule || '—'}</span>
                </span>
                {item.isLate && filtreActivite !== 'late' && <span className="tag late">RETARD</span>}
                <span className={`tag ${entree ? 'in' : 'out'}`}>{entree ? 'ENTRÉE' : 'SORTIE'}</span>
                <span className="flow-time">
                  {item.hasPhoto && <Camera size={12} aria-label="Preuve photo" style={{ color: 'var(--txt-3)' }} />}
                  {heureLocale(item.time)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="foot">
        {recentActivity.length} pointages aujourd'hui
        <Link to="/pointages" style={{ marginLeft: 'auto' }}>Tout l'historique du jour →</Link>
      </div>
    </article>
  )
}
