import { useRef, useState } from 'react'
import { accountRpc } from '../services/adminAccounts'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
export default function AdminMfaRequirement({ account, currentId }) {
  const [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const lock = useRef(false)
  const { ensureMfa, challenge } = useAdminMfaCheckpoint()
  if (account.id === currentId) return null
  if (challenge) return challenge
  return (
    <details className="aa-section">
      <summary>Exiger la double authentification</summary>
      <p>
        L’accès aux données sera bloqué tant que ce compte n’aura pas configuré
        et vérifié son facteur. Les données déjà affichées ne sont pas effacées.
      </p>
      <button
        type="button"
        className="aa-bouton-creux"
        disabled={busy}
        onClick={async () => {
          if (lock.current) return
          lock.current = true
          setBusy(true)
          try {
            await ensureMfa()
            const status = await accountRpc('encheck_mfa_exigence_lire', {
              p_admin_id: account.id,
            })
            if (
              typeof status?.required !== 'boolean' ||
              typeof status?.configured !== 'boolean'
            )
              throw Error()
            setMessage(
              !status.required
                ? 'Non exigée.'
                : status.configured
                  ? 'Exigée — configurée. Chaque session reste vérifiée séparément.'
                  : 'Exigée — à configurer.',
            )
          } catch {
            setMessage(
              'État indisponible. Vérifiez votre session MFA et la migration serveur.',
            )
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        Consulter l’obligation
      </button>
      <form
        className="aa-formulaire"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            lock.current ||
            !window.confirm(
              'Exiger immédiatement la double authentification pour ce compte ?',
            )
          )
            return
          lock.current = true
          setBusy(true)
          setMessage('')
          try {
            await ensureMfa()
            const result = await accountRpc('encheck_mfa_exiger', {
              p_admin_id: account.id,
              p_motif: reason.trim(),
            })
            if (result?.ok !== true) throw Error()
            setMessage(
              'Double authentification exigée. Le titulaire doit configurer et vérifier son propre facteur.',
            )
          } catch {
            setMessage(
              'Obligation non confirmée. Vérifiez l’activation serveur et votre session MFA avant de réessayer.',
            )
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        <label>
          Motif
          <input
            required
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
        </label>
        <div className="aa-formulaire-pied">
          <button
            className="aa-bouton-plein"
            disabled={busy || reason.trim().length < 5}
          >
            Exiger la double authentification
          </button>
        </div>
      </form>
      {message && (
        <p role="status" className="aa-notice">{message}</p>
      )}
    </details>
  )
}
