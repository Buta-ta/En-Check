import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
import AdminExplication from './AdminExplication'
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
      <AdminExplication titre="Avant de retirer les facteurs">
        <p>
          Après vérification de l’identité du titulaire, retire les facteurs
          perdus. Votre propre MFA doit être vérifiée (AAL2). Le titulaire devra
          réinscrire un authentificateur. Ses sessions existantes seront bloquées
          pour REST/RPC, mais pas pour les autres canaux.
        </p>
      </AdminExplication>
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
            autoComplete="off"
            placeholder={account.email || 'adresse du titulaire'}
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
            placeholder="Ex. : téléphone perdu, identité vérifiée par appel au +229…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button
          className="aa-bouton-plein"
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
