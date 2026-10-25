import { useEffect, useState } from 'react'
import { accountRpc } from '../services/adminAccounts'
export default function AdminSecurityAlerts() {
  const [alerts, setAlerts] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    accountRpc('encheck_account_session_alerts', {})
      .then((data) => {
        if (alive) setAlerts(data || [])
      })
      .catch(() => {
        if (alive) setError('Alertes de connexion indisponibles.')
      })
    return () => {
      alive = false
    }
  }, [])
  async function load(id = null) {
    setBusy(true)
    setError('')
    try {
      setAlerts(
        (await accountRpc('encheck_account_session_alerts', {
          p_acknowledge: id,
        })) || [],
      )
    } catch {
      setError('Alertes de connexion indisponibles.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="aa-workflow">
      <h3>Connexions à vérifier</h3>
      <p>
        Signal limité au navigateur déclaré par Auth, comparé aux connexions
        observées depuis l’activation. Ce n’est ni une géolocalisation ni une
        preuve d’intrusion. Aucun e-mail d’alerte n’est envoyé par ce contrôle.
      </p>
      <button disabled={busy} onClick={() => load()}>
        Actualiser les alertes
      </button>
      {error && <p role="alert">{error}</p>}
      {!error && !alerts.length && (
        <p>Aucune alerte en attente dans le registre chargé.</p>
      )}
      <ul>
        {alerts.map((a) => (
          <li key={a.session_id}>
            <strong>{new Date(a.created_at).toLocaleString('fr-FR')}</strong>
            <p>{a.user_agent}</p>
            <p>
              Si cette connexion est inconnue, vérifiez les sessions ci-dessous
              et changez votre mot de passe.
            </p>
            <button disabled={busy} onClick={() => load(a.session_id)}>
              J’ai vérifié cette connexion
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
