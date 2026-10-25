import { useCallback, useEffect, useRef, useState } from 'react'
import { accountRpc } from '../services/adminAccounts'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
const modules = {
  employees: 'Employés',
  attendance: 'Pointages',
  planning: 'Planning',
  payroll: 'Paie',
  tasks: 'Tâches et équipes',
}
const actions = {
  read: 'Lire',
  create: 'Créer',
  update: 'Modifier',
  delete: 'Supprimer',
}
export default function AdminPermissionRoles({
  accounts,
  enterprises,
  onSaved,
}) {
  const [catalog, setCatalog] = useState(null),
    [name, setName] = useState(''),
    [reason, setReason] = useState(''),
    [rules, setRules] = useState([])
  const [enterprise, setEnterprise] = useState(''),
    [module, setModule] = useState('employees'),
    [permissions, setPermissions] = useState(['read'])
  const [target, setTarget] = useState(''),
    [role, setRole] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const lock = useRef(false),
    { ensureMfa, challenge } = useAdminMfaCheckpoint()
  const load = useCallback(async () => {
    const data = await accountRpc('encheck_permission_roles_list', {})
    if (
      !data ||
      !Array.isArray(data.roles) ||
      !Array.isArray(data.bindings) ||
      !Array.isArray(data.blockers) ||
      typeof data.enabled !== 'boolean'
    )
      throw Error('Catalogue de permissions indisponible.')
    setCatalog(data)
  }, [])
  useEffect(() => {
    let alive = true
    load().catch((e) => {
      if (alive) setError(e.message)
    })
    return () => {
      alive = false
    }
  }, [load])
  async function run(action) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await ensureMfa()
      await action()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (challenge) return challenge
  return (
    <section className="aa-panel aa-workflow">
      <h2>Rôles personnalisés</h2>
      <p>
        Permissions par module, action et entreprise, appliquées par le serveur.
        Les tables non couvertes et les opérations métier RPC non auditées sont
        refusées. Les droits s’ajoutent aux restrictions existantes, sans les
        remplacer.
      </p>
      <button disabled={busy} onClick={() => run(async () => {})}>
        Actualiser le catalogue
      </button>
      {catalog && !catalog.enabled && (
        <p className="aa-notice">
          Attribution désactivée jusqu’à l’activation serveur. Les restrictions
          déjà attribuées restent effectives.
        </p>
      )}
      {!!catalog?.blockers?.length && (
        <ul role="status">
          {catalog.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <details>
        <summary>Créer une version de rôle</summary>
        <p>
          Les versions sont conservées. Pour modifier les permissions, créez une
          nouvelle version puis réattribuez-la aux comptes concernés.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(async () => {
              await accountRpc('encheck_permission_role_create', {
                p_name: name,
                p_grants: rules,
                p_reason: reason,
              })
              setName('')
              setRules([])
              setNotice('Version créée. Aucune attribution automatique.')
            })
          }}
        >
          <label>
            Nom du rôle
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Entreprise
            <select
              value={enterprise}
              onChange={(e) => setEnterprise(e.target.value)}
            >
              <option value="">Choisir</option>
              {enterprises.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Module
            <select value={module} onChange={(e) => setModule(e.target.value)}>
              {Object.entries(modules).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="aa-permission-actions">
            <legend>Actions autorisées</legend>
            {Object.entries(actions).map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={permissions.includes(id)}
                  disabled={id === 'read'}
                  onChange={(e) =>
                    setPermissions(
                      e.target.checked
                        ? [...permissions, id]
                        : permissions.filter((p) => p !== id),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            disabled={!enterprise || busy || rules.length >= 100}
            onClick={() =>
              setRules([
                ...rules.filter(
                  (r) => r.enterprise_id !== enterprise || r.module !== module,
                ),
                { enterprise_id: enterprise, module, actions: permissions },
              ])
            }
          >
            Ajouter cette règle
          </button>
          <ul>
            {rules.map((r, i) => (
              <li key={`${r.enterprise_id}-${r.module}`}>
                {enterprises.find((e) => e.id === r.enterprise_id)?.name} ·{' '}
                {modules[r.module]} ·{' '}
                {r.actions.map((a) => actions[a]).join(', ')}{' '}
                <button
                  type="button"
                  onClick={() => setRules(rules.filter((_, j) => j !== i))}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
          <label>
            Motif
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button disabled={busy || !catalog || !rules.length}>
            Créer la version
          </button>
        </form>
      </details>
      <details>
        <summary>Attribuer ou retirer un rôle</summary>
        <p>
          Les superadministrateurs et les identités partagées avec un employé ne
          peuvent pas recevoir de rôle personnalisé. Le retrait rétablit les
          droits du rôle historique sur les entreprises actuellement affectées.
        </p>
        <label>
          Administrateur
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choisir</option>
            {accounts
              .filter((a) => a.is_active && a.role !== 'super_admin')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Version
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Retirer la restriction personnalisée</option>
            {catalog?.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Motif
          <textarea
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button
          disabled={
            busy ||
            !catalog ||
            !target ||
            reason.trim().length < 5 ||
            (!!role && (!catalog.enabled || !!catalog.blockers?.length))
          }
          onClick={() => {
            if (
              !window.confirm(
                role
                  ? 'Appliquer cette version et ses entreprises à ce compte ?'
                  : 'Retirer les restrictions personnalisées et rétablir les droits historiques de ce compte ?',
              )
            )
              return
            run(async () => {
              await accountRpc('encheck_permission_role_assign', {
                p_admin_id: target,
                p_role_id: role || null,
                p_reason: reason,
              })
              setNotice('Attribution enregistrée côté serveur.')
              await onSaved?.()
            })
          }}
        >
          Appliquer au compte
        </button>
      </details>
      <h3>Versions et attributions</h3>
      <ul>
        {catalog?.roles.map((r) => (
          <li key={r.id}>
            <strong>{r.name}</strong> ·{' '}
            {catalog.bindings.filter((b) => b.role_id === r.id).length}{' '}
            compte(s)
            <ul>
              {r.grants.map((g, i) => (
                <li key={i}>
                  {enterprises.find((e) => e.id === g.enterprise_id)?.name ||
                    g.enterprise_id}{' '}
                  · {modules[g.module]} ·{' '}
                  {g.actions.map((a) => actions[a]).join(', ')}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  )
}
