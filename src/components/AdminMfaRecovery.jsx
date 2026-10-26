import { accountRpc } from '../services/adminAccounts'
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
    <details className="aa-section">
      <summary>Récupération du second facteur</summary>
      <AdminExplication titre="Avant de retirer les facteurs">
        <p>
          Après vérification de l’identité du titulaire, retire les facteurs
          perdus. Votre propre MFA doit être vérifiée (AAL2). Le titulaire devra
          réinscrire un authentificateur. L’obligation MFA est conservée ou
          créée. Les sessions antérieures sont refusées par les contrôles
          intégrés ; les copies téléchargées et les liens déjà signés ne sont
          pas effacés.
        </p>
        <p>
          La confirmation de l’adresse ne prouve pas l’identité : vérifiez le
          titulaire par un canal connu avant cette intervention.
        </p>
      </AdminExplication>
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
            const result = await accountRpc('encheck_mfa_recovery_status_v2', {
              p_target_id: account.id,
            })
            const labels = {
              none: 'Aucune récupération enregistrée.',
              pending:
                'Intervention préparée. Ne la relancez pas : vérification opérateur requise si elle reste en attente.',
              running:
                'Intervention en cours ou interrompue. Ne la relancez pas sans vérification opérateur.',
              failed:
                'Intervention non confirmée ou partielle. L’accès reste bloqué ; vérifiez la cause avant une nouvelle demande.',
              completed:
                'Facteurs retirés. Le titulaire doit ouvrir une nouvelle session et réinscrire son authentificateur. L’obligation MFA reste active.',
            }
            if (!labels[result?.state]) throw Error()
            setMessage(labels[result.state])
          } catch {
            setMessage(
              'État indisponible. Aucun succès confirmé ; vérifiez votre MFA et la migration serveur.',
            )
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        Consulter l’état de récupération
      </button>
      <form
        className="aa-formulaire"
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
            if (error || data?.completed !== true) throw new Error()
            setEmail('')
            setReason('')
            setMessage(
              'Facteurs retirés. Le titulaire doit se reconnecter puis réinscrire son authentificateur. L’obligation MFA reste active.',
            )
          } catch {
            setMessage(
              'Récupération non confirmée. Consultez son état avant toute nouvelle demande ; ne relancez pas une intervention en attente ou en cours.',
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
        <div className="aa-formulaire-pied">
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
        </div>
      </form>
      {message && (
        <p role="status" className="aa-notice">{message}</p>
      )}
    </details>
  )
}
