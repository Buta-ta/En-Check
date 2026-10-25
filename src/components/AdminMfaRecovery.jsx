import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
export default function AdminMfaRecovery({ account, currentId }) {
  const [email, setEmail] = useState(''),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const lock = useRef(false),
    { ensureMfa, challenge } = useAdminMfaCheckpoint()
  if (account.id === currentId) return null
  if (challenge) return challenge
  return (
    <details>
      <summary>Récupération du second facteur</summary>
      <p>
        Après vérification de l’identité du titulaire, retire les facteurs
        perdus. Votre propre MFA doit être vérifiée (AAL2). Le titulaire devra
        réinscrire un authentificateur. Ses sessions existantes seront bloquées
        pour REST/RPC, mais pas pour les autres canaux.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (lock.current) return
          if (
            !window.confirm(
              'Retirer les facteurs de sécurité de ce compte après vérification de son titulaire ?',
            )
          )
            return
          lock.current = true
          setBusy(true)
          setMessage('')
          try {
            await ensureMfa()
            const { data, error } = await supabase.functions.invoke(
              'admin-mfa-recovery',
              { body: { target_id: account.id, confirm_email: email, reason } },
            )
            if (error || !data?.completed) throw new Error()
            setEmail('')
            setReason('')
            setMessage(
              'Facteurs retirés. Invitez le titulaire à réinscrire un authentificateur et vérifiez ses sessions.',
            )
          } catch {
            setMessage(
              'Récupération non confirmée. Vérifiez votre MFA, le délai de deux minutes et le journal avant de réessayer.',
            )
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        <label>
          Confirmer l’adresse du titulaire
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Motif et vérification effectuée
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button
          disabled={
            busy ||
            email.trim().toLowerCase() !== account.email?.toLowerCase() ||
            reason.trim().length < 5
          }
        >
          Retirer les facteurs perdus
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  )
}
