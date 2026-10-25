import AdminAccountRetirement from './AdminAccountRetirement'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { accountRpc } from '../services/adminAccounts'
export default function AdminAccountOperations({
  account,
  accounts,
  enterprises,
  currentId,
  onSaved,
}) {
  const [role, setRole] = useState(account.role),
    [ids, setIds] = useState([]),
    [loaded, setLoaded] = useState(false)
  const [reason, setReason] = useState(''),
    [successor, setSuccessor] = useState(''),
    [delegate, setDelegate] = useState(''),
    [hours, setHours] = useState(2)
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [diagnostic, setDiagnostic] = useState(null)
  const lock = useRef(false)
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const { data, error } = await supabase
          .from('admin_entreprises')
          .select('enterprise_id,is_active')
          .eq('admin_id', account.id)
        if (error) throw error
        if (alive) {
          setIds([
            ...new Set(
              [
                ...(data || [])
                  .filter((x) => x.is_active)
                  .map((x) => x.enterprise_id),
                account.enterprise_id,
              ].filter(Boolean),
            ),
          ])
          setLoaded(true)
        }
      } catch {
        if (alive)
          setMessage(
            'Accès non chargés. Fermez puis rouvrez la fiche pour réessayer.',
          )
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [account.id, account.enterprise_id])
  async function run(name, args) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      const data = await accountRpc(name, args)
      if (name === 'encheck_account_diagnostic') setDiagnostic(data)
      else {
        setMessage('Opération enregistrée.')
        await onSaved?.()
      }
    } catch (e) {
      setMessage(e.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const invalid = busy || reason.trim().length < 5 || reason.trim().length > 500
  return (
    <section className="aa-workflow">
      <h3>Accès et cycle de vie</h3>
      <label>
        Motif de l’intervention
        <textarea
          minLength={5}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <details>
        <summary>Rôle et entreprises</summary>
        <p>
          Attribuez les rôles existants et les entreprises autorisées.
        </p>
        <label>
          Rôle
          <select
            value={role}
            disabled={busy || account.id === currentId}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="admin">Administrateur</option>
            <option value="manager">Responsable</option>
            <option value="super_admin">Superadministrateur</option>
          </select>
        </label>
        {enterprises.map((e) => (
          <label key={e.id}>
            <input
              type="checkbox"
              disabled={busy || account.id === currentId}
              checked={ids.includes(e.id)}
              onChange={(ev) =>
                setIds(
                  ev.target.checked
                    ? [...ids, e.id]
                    : ids.filter((id) => id !== e.id),
                )
              }
            />
            {e.name}
          </label>
        ))}
        <button
          disabled={invalid || !loaded || account.id === currentId}
          onClick={() =>
            run('encheck_account_access', {
              p_admin_id: account.id,
              p_role: role,
              p_enterprises: ids,
              p_reason: reason,
            })
          }
        >
          Enregistrer les accès
        </button>
      </details>
      <details>
        <summary>Archiver et transférer les accès</summary>
        <p>
          L’archivage désactive le compte et ses liens d’entreprise. Le
          transfert porte uniquement sur ces accès, pas sur les tâches ni les
          validations métier. L’historique est conservé.
        </p>
        <label>
          Repreneur des accès d’entreprise
          <select
            value={successor}
            onChange={(e) => setSuccessor(e.target.value)}
          >
            <option value="">Sans transfert</option>
            {accounts
              .filter((a) => a.id !== account.id && a.is_active)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
          </select>
        </label>
        <button
          disabled={invalid || account.id === currentId}
          onClick={() => {
            if (window.confirm('Archiver ce compte et désactiver ses accès ?'))
              run('encheck_account_archive', {
                p_admin_id: account.id,
                p_successor_id: successor || null,
                p_reason: reason,
              })
          }}
        >
          Archiver le compte
        </button>
        <button
          disabled={invalid}
          onClick={() =>
            run('encheck_account_restore', {
              p_admin_id: account.id,
              p_reason: reason,
            })
          }
        >
          Retirer de l’archive sans réactiver
        </button>
      </details>
      <details>
        <summary>Assistance et diagnostic limité</summary>
        <p>
          La délégation autorise seulement un diagnostic technique, sans accès
          aux données métier, aux secrets ou aux sessions du titulaire.
        </p>
        <button
          disabled={busy}
          onClick={() =>
            run('encheck_account_diagnostic', { p_target_id: account.id })
          }
        >
          Lancer le diagnostic
        </button>
        {diagnostic && (
          <dl>
            {Object.entries(diagnostic).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {{
                    active: 'Compte actif',
                    auth_linked: 'Identité Auth liée',
                    mfa_verified: 'Facteur vérifié',
                    archived: 'Compte archivé',
                    rest_guard_active: 'Contrôle REST/RPC actif',
                  }[key] || key}
                </dt>
                <dd>{value ? 'Oui' : 'Non'}</dd>
              </div>
            ))}
          </dl>
        )}
        <label>
          Intervenant
          <select
            value={delegate}
            onChange={(e) => setDelegate(e.target.value)}
          >
            <option value="">Choisir</option>
            {accounts
              .filter((a) => a.is_active)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Durée en heures (1–24)
          <input
            type="number"
            min={1}
            max={24}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
        </label>
        <button
          disabled={invalid || !delegate || hours < 1 || hours > 24}
          onClick={() =>
            run('encheck_support_grant', {
              p_target_id: account.id,
              p_delegate_id: delegate,
              p_hours: hours,
              p_reason: reason,
            })
          }
        >
          Déléguer le diagnostic
        </button>
        <button
          disabled={invalid}
          onClick={() =>
            run('encheck_support_revoke', {
              p_target_id: account.id,
              p_reason: reason,
            })
          }
        >
          Révoquer les délégations
        </button>
        <p>
          Lien à transmettre à l’intervenant :{' '}
          <code>/mon-compte?diagnostic={account.id}</code>
        </p>
      </details>
      <AdminAccountRetirement account={account} accounts={accounts} currentId={currentId} onSaved={onSaved} />
      {message && <p role="status">{message}</p>}
    </section>
  )
}
