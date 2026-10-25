import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { accountRpc } from '../services/adminAccounts'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
import AdminExplication from './AdminExplication'

const stateLabel = {
  requested: 'Approbation distincte requise',
  cancelled: 'Annulée',
  auth_pending: 'Profil clôturé · nettoyage à terminer',
  shared_identity_preserved: 'Identité partagée conservée',
  completed: 'Clôture terminée',
}
export default function AdminAccountRetirement({
  account,
  accounts,
  currentId,
  onSaved,
}) {
  const [requests, setRequests] = useState([]),
    [reason, setReason] = useState(''),
    [successor, setSuccessor] = useState(''),
    [inventory, setInventory] = useState(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const lock = useRef(false),
    { ensureMfa, challenge } = useAdminMfaCheckpoint()
  const load = useCallback(async () => {
    const result = await supabase
      .from('admin_retirement_requests')
      .select('id,target_id,requested_by,state,created_at,assets_cleaned_at')
      .eq('target_id', account.id)
      .order('created_at', { ascending: false })
    if (result.error)
      throw new Error(
        'Demandes indisponibles. Vérifiez la migration et vos droits.',
      )
    setRequests(result.data || [])
  }, [account.id])
  useEffect(() => {
    let active = true
    load().catch((e) => {
      if (active) setError(e.message)
    })
    return () => {
      active = false
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
    <section className="aa-workflow">
      <details>
        <summary>Transférer les responsabilités métier</summary>
        <button
          disabled={busy}
          onClick={() =>
            run(async () =>
              setInventory(
                await accountRpc('encheck_account_responsibilities', {
                  p_target_id: account.id,
                }),
              ),
            )
          }
        >
          Vérifier les responsabilités
        </button>
        {inventory && (
          <p>{inventory.open_prospects} prospect(s) encore ouvert(s).</p>
        )}
        <label>
          Superadministrateur repreneur
          <select
            value={successor}
            onChange={(e) => setSuccessor(e.target.value)}
          >
            <option value="">Choisir</option>
            {accounts
              .filter(
                (a) =>
                  a.is_active &&
                  a.role === 'super_admin' &&
                  a.id !== account.id,
              )
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Motif du transfert
          <textarea
            value={reason}
            minLength={5}
            maxLength={500}
            placeholder="Ex. : départ du superadministrateur, passation de la paie…"
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button
          disabled={busy || !successor || reason.trim().length < 5}
          onClick={() =>
            run(async () => {
              const count = await accountRpc(
                'encheck_account_transfer_responsibilities',
                {
                  p_target_id: account.id,
                  p_successor_id: successor,
                  p_reason: reason,
                },
              )
              setInventory(null)
              setNotice(`${count} prospect(s) transféré(s).`)
            })
          }
        >
          Transférer les prospects ouverts
        </button>
        <AdminExplication titre="Ce qui est transféré, et ce qui ne l’est pas">
          <p>
            Transfère les prospects encore ouverts. Les prospects signés ou
            perdus, les auteurs des tâches et les validations passées restent
            inchangés. Les tâches sont affectées à des employés, pas à ce compte
            administrateur.
          </p>
        </AdminExplication>
      </details>
      <details>
        <summary>Clôture définitive du profil</summary>
        <label>
          Motif de clôture
          <textarea
            value={reason}
            minLength={5}
            maxLength={500}
            placeholder="Ex. : compte de test devenu inutile, demande de la direction…"
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button
          disabled={
            busy ||
            account.id === currentId ||
            account.is_active ||
            reason.trim().length < 5
          }
          onClick={() =>
            run(async () => {
              await accountRpc('encheck_retirement_request', {
                p_target_id: account.id,
                p_reason: reason,
              })
              setNotice(
                'Demande enregistrée. Un autre superadministrateur doit la valider.',
              )
            })
          }
        >
          Demander la clôture définitive
        </button>
        <button className="aa-bouton-creux" disabled={busy} onClick={() => run(async () => {})}>
          Actualiser les demandes
        </button>
        <AdminExplication titre="Les conditions d’une clôture définitive">
          <p>
            Compte inactif, archivé depuis sept jours, puis validation par deux
            superadministrateurs distincts avec MFA. La fiche est pseudonymisée et
            devient non réactivable. Son identifiant et l’historique métier sont
            conservés.
          </p>
          <p>
            Les photos du dossier admin sont nettoyées. L’identité Auth n’est
            supprimée que si elle n’est pas partagée avec un employé ou un autre
            compte. Les textes libres de l’historique ne sont pas effacés.
          </p>
        </AdminExplication>
        <ul>
          {requests.map((job) => (
            <li key={job.id}>
              <strong>{stateLabel[job.state]}</strong>
              {job.state === 'requested' && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      accountRpc('encheck_retirement_cancel', {
                        p_request_id: job.id,
                      }),
                    )
                  }
                >
                  Annuler la demande
                </button>
              )}
              {(['requested', 'auth_pending'].includes(job.state) ||
                (job.state === 'shared_identity_preserved' &&
                  !job.assets_cleaned_at)) && (
                <button
                  disabled={
                    busy ||
                    job.requested_by === currentId ||
                    account.id === currentId
                  }
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Confirmer la clôture irréversible de ce profil ? L’historique sera conservé et l’identité Auth partagée sera protégée.',
                      )
                    )
                      return
                    run(async () => {
                      const { data, error } = await supabase.functions.invoke(
                        'admin-retirement',
                        { body: { request_id: job.id } },
                      )
                      if (error || !data?.completed)
                        throw new Error(
                          'Clôture ou nettoyage non confirmé. Actualisez l’état avant de réessayer.',
                        )
                      setNotice(
                        data.shared_identity_preserved
                          ? 'Profil clôturé ; identité employé/partagée conservée.'
                          : 'Profil clôturé et nettoyage confirmé.',
                      )
                      await onSaved?.()
                    })
                  }}
                >
                  {job.state === 'requested'
                    ? 'Approuver et clôturer'
                    : 'Reprendre le nettoyage'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </details>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  )
}
