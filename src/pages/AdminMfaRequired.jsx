import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AdminMfaSettings from '../components/AdminMfaSettings'
import { mfaObligationStatus } from '../services/adminMfaObligation'
export default function AdminMfaRequired() {
  const { ensureMfa, challenge } = useAdminMfaCheckpoint()
  const [ready, setReady] = useState(false),
    [message, setMessage] = useState('')
  useEffect(() => {
    let alive = true
    mfaObligationStatus()
      .then(() => {
        if (alive) setReady(true)
      })
      .catch(() => {
        if (alive)
          setMessage('Session indisponible. Reconnectez-vous pour poursuivre.')
      })
    return () => {
      alive = false
    }
  }, [])
  if (challenge) return challenge
  return (
    <main className="aa-panel">
      <h1>Double authentification obligatoire</h1>
      <p>
        Configurez votre authentificateur personnel et confirmez son code avant
        d’accéder aux données. Ne partagez ni QR ni clé.
      </p>
      {ready && <AdminMfaSettings statusRpc="encheck_mfa_obligation_statut" />}
      <button
        disabled={!ready}
        onClick={async () => {
          try {
            await ensureMfa()
            const status = await mfaObligationStatus()
            if (!status.satisfied) {
              setMessage(
                'Configurez et vérifiez votre facteur avant de continuer.',
              )
              return
            }
            // Login completes the existing profile/cache setup after native verification.
            window.location.assign('/login')
          } catch {
            setMessage('Vérification indisponible. Aucun accès accordé.')
          }
        }}
      >
        Vérifier et continuer
      </button>
      <button
        onClick={async () => {
          await supabase.auth.signOut({ scope: 'local' })
          localStorage.removeItem('admin')
          window.location.assign('/login')
        }}
      >
        Se déconnecter
      </button>
      {message && <p role="status">{message}</p>}
    </main>
  )
}
