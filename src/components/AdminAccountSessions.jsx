import { useEffect, useRef, useState } from 'react'
import { accountRpc } from '../services/adminAccounts'
import { supabase } from '../lib/supabase'
export default function AdminAccountSessions({ adminId = null }) {
  const [sessions, setSessions] = useState([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0),
    [selected, setSelected] = useState(null),
    [reason, setReason] = useState(''),
    [message, setMessage] = useState(''),
    [enabled, setEnabled] = useState(false),
    lock = useRef(false)
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    setSelected(null)
    setReason('')
    setMessage('')
    Promise.all([
      accountRpc('encheck_account_sessions', { p_admin_id: adminId }),
      accountRpc('encheck_account_security_status', {}),
    ])
      .then(([data, status]) => {
        if (alive) {
          setSessions(data || [])
          setEnabled(status?.rest_guard_active === true)
        }
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [adminId, attempt])
  async function revoke(event) {
    event.preventDefault()
    if (lock.current || !selected) return
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      await accountRpc('encheck_account_revoke_session', {
        p_session_id: selected.id,
        p_reason: reason.trim(),
      })
      if (selected.is_current) {
        await supabase.auth.signOut({ scope: 'local' })
        localStorage.removeItem('admin')
        window.location.assign('/login')
        return
      }
      setSessions((rows) =>
        rows.map((row) =>
          row.id === selected.id ? { ...row, revoked: true } : row,
        ),
      )
      setSelected(null)
      setReason('')
      setMessage(
        'Accès API révoqué pour cette session. Une nouvelle connexion reste possible si le compte est actif.',
      )
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  return (
    <section className="aa-sessions">
      <h3>Sessions de connexion</h3>
      {loading ? (
        <p role="status">Lecture des sessions…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)}>
            Réessayer les sessions
          </button>
        </div>
      ) : (
        <>
          {!enabled && (
            <p className="aa-notice">
              Révocation désactivée : le contrôle serveur REST/RPC doit d’abord
              être activé.
            </p>
          )}
          {sessions.length ? (
            <ul>
              {sessions.map((session) => (
                <li key={session.id}>
                  <strong>
                    {session.is_current ? 'Cette session' : 'Session connue'}
                    {session.revoked ? ' · Accès API révoqué' : ''}
                  </strong>
                  <p>{session.user_agent || 'Appareil non renseigné'}</p>
                  <small>
                    Créée le{' '}
                    {new Date(session.created_at).toLocaleString('fr-FR')} · IP{' '}
                    {session.ip || 'non renseignée'}
                  </small>
                  <button
                    className="aa-bouton-creux"
                    disabled={busy || session.revoked || !enabled}
                    onClick={() => {
                      setSelected(session)
                      setReason('')
                      setMessage('')
                    }}
                  >
                    Révoquer l’accès API
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucune session connue pour ce compte.</p>
          )}
          {selected && (
            <form onSubmit={revoke}>
              <label>
                Motif de révocation
                <textarea
                  minLength={5}
                  maxLength={500}
                  required
                  placeholder="Ex. : appareil perdu, connexion suspecte signalée…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy}
                />
              </label>
              <p>
                {selected.is_current
                  ? 'Vous serez déconnecté de cette page.'
                  : 'Cette session ne pourra plus utiliser les API REST/RPC protégées.'}
              </p>
              <div className="aa-formulaire-pied">
                <button className="aa-bouton-danger" disabled={busy}>
                  Confirmer la révocation
                </button>
                <button
                  type="button"
                  className="aa-bouton-creux"
                  disabled={busy}
                  onClick={() => setSelected(null)}
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
      <p className="aa-footnote">
        100 sessions au maximum. Le contrôle concerne REST/RPC ; il ne prétend
        pas révoquer les services externes, Storage ou les abonnements Realtime
        existants.
      </p>
    </section>
  )
}
