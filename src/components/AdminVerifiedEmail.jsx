import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { accountRpc } from '../services/adminAccounts'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
import AdminExplication from './AdminExplication'
export default function AdminVerifiedEmail() {
  const [email, setEmail] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const lock = useRef(false),
    { ensureMfa, challenge } = useAdminMfaCheckpoint()
  async function run(action) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      await ensureMfa()
      await action()
    } catch {
      setMessage(
        'Opération non confirmée. Vérifiez votre session et réessayez.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (challenge) return challenge
  return (
    <section>
      <h3>Adresse e-mail vérifiée</h3>
      <AdminExplication titre="D’où vient l’adresse affichée">
        <p>
          La fiche utilise uniquement l’adresse confirmée dans Auth. Après
          confirmation des e-mails, synchronisez votre fiche.
        </p>
      </AdminExplication>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            const { error } = await supabase.auth.updateUser(
              { email: email.trim() },
              { emailRedirectTo: `${window.location.origin}/mon-compte` },
            )
            if (error) throw error
            setEmail('')
            setMessage(
              'Demande transmise. Suivez les liens de confirmation envoyés par le service d’authentification.',
            )
          })
        }}
      >
        <label>
          Nouvelle adresse
          <input
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="Ex. : awa.dossou@entreprise.bj"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button className="aa-bouton-plein" disabled={busy}>
          Demander le changement
        </button>
      </form>
      <button
        disabled={busy}
        onClick={() =>
          run(async () => {
            const confirmed = await accountRpc('encheck_account_sync_email', {})
            setMessage(`Adresse confirmée synchronisée : ${confirmed}`)
          })
        }
      >
        Synchroniser l’adresse confirmée
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
