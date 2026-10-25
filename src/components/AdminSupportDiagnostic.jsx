import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { accountRpc } from '../services/adminAccounts'
export default function AdminSupportDiagnostic() {
  const [params] = useSearchParams(),
    id = params.get('diagnostic')
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [result, setResult] = useState(null)
  if (!id) return null
  return (
    <section className="aa-panel">
      <h2>Diagnostic délégué</h2>
      <p>
        Consultation technique seulement. Le serveur vérifie l’autorisation, son
        expiration et sa révocation.
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setMessage('')
          setResult(null)
          try {
            setResult(
              await accountRpc('encheck_account_diagnostic', {
                p_target_id: id,
              }),
            )
          } catch {
            setMessage('Diagnostic non autorisé ou indisponible.')
          } finally {
            setBusy(false)
          }
        }}
      >
        Consulter le diagnostic
      </button>
      {message && <p role="alert">{message}</p>}
      {result && (
        <dl>
          {Object.entries(result).map(([key, value]) => (
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
    </section>
  )
}
