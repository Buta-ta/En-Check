import { useEffect, useRef, useState } from 'react'
import { accountRpc } from '../services/adminAccounts'
export const ADMIN_HOME_PATHS = [
  '/dashboard',
  '/mon-compte',
  '/pointages',
  '/planning',
  '/employes',
]
export default function AdminAccountPreferences() {
  const [values, setValues] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [attempt, setAttempt] = useState(0),
    lock = useRef(false)
  useEffect(() => {
    let alive = true
    setError('')
    accountRpc('encheck_account_preferences', { p_values: null })
      .then((data) => {
        if (alive) setValues(data)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [attempt])
  async function save(event) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      const result = await accountRpc('encheck_account_preferences', {
        p_values: values,
      })
      setValues(result)
      setMessage('Informations et préférences enregistrées.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  if (error)
    return (
      <section role="alert">
        <p>{error}</p>
        <button onClick={() => setAttempt((n) => n + 1)}>
          Réessayer les préférences
        </button>
      </section>
    )
  if (!values) return <p role="status">Lecture des préférences…</p>
  return (
    <form onSubmit={save} className="aa-preferences">
      <h3>Informations complémentaires</h3>
      <label>
        Téléphone
        <input
          type="tel"
          maxLength={40}
          inputMode="tel"
          autoComplete="tel"
          placeholder="Ex. : +229 01 97 00 00 00"
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
        />
      </label>
      <label>
        Fonction affichée
        <input
          maxLength={100}
          placeholder="Ex. : Responsable des ressources humaines"
          value={values.job_title}
          onChange={(e) => setValues({ ...values, job_title: e.target.value })}
        />
      </label>
      <p>Votre fonction affichée n’attribue aucune permission.</p>
      <label>
        Page après connexion
        <select
          value={values.home_path}
          onChange={(e) => setValues({ ...values, home_path: e.target.value })}
        >
          {ADMIN_HOME_PATHS.map((path) => (
            <option key={path} value={path}>
              {
                {
                  '/dashboard': 'Tableau de bord',
                  '/mon-compte': 'Mon compte',
                  '/pointages': 'Pointages',
                  '/planning': 'Planning',
                  '/employes': 'Employés',
                }[path]
              }
            </option>
          ))}
        </select>
      </label>
      <p>Les contrôles d’accès de la page choisie restent applicables.</p>
      <AdminSceau
        checked={values.email_notifications}
        onChange={(e) =>
          setValues({ ...values, email_notifications: e.target.checked })
        }
      >
        Recevoir les alertes e-mail existantes
      </AdminSceau>
      <button className="aa-bouton-plein" disabled={busy}>
        Enregistrer mes préférences
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  )
}
