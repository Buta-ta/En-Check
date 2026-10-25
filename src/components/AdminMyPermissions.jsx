import { useEffect, useState } from 'react'
import { accountRpc } from '../services/adminAccounts'
const labels = {
  employees: 'Employés',
  attendance: 'Pointages',
  planning: 'Planning',
  payroll: 'Paie',
  tasks: 'Tâches et équipes',
  read: 'Lire',
  create: 'Créer',
  update: 'Modifier',
  delete: 'Supprimer',
}
export default function AdminMyPermissions() {
  const [data, setData] = useState(null),
    [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    accountRpc('encheck_my_permissions', {})
      .then((result) => {
        if (
          !result ||
          typeof result.name !== 'string' ||
          (result.grants !== null && !Array.isArray(result.grants))
        )
          throw Error('Invalid permissions response')
        if (alive) setData(result)
      })
      .catch(() => {
        if (alive) setError('Permissions détaillées indisponibles.')
      })
    return () => {
      alive = false
    }
  }, [])
  return (
    <section>
      <h3>Mes permissions effectives</h3>
      {error && <p role="status">{error}</p>}
      {data && (
        <>
          <p>{data.name}</p>
          {data.grants ? (
            <>
              <p>
                Les restrictions existantes s’appliquent également. Les RPC
                métier non auditées et les canaux privés non couverts sont
                refusés.
              </p>
              <ul>
                {data.grants.map((g, i) => (
                  <li key={i}>
                    {labels[g.module]} ·{' '}
                    {g.actions.map((a) => labels[a]).join(', ')} · Entreprise :{' '}
                    <span>{g.enterprise_name || g.enterprise_id}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              Vos droits restent ceux du rôle historique et des entreprises
              attribuées.
            </p>
          )}
        </>
      )}
    </section>
  )
}
