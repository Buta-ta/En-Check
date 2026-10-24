import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
const labels = {
  profile_updated: 'Profil modifié',
  password_changed: 'Mot de passe remplacé',
  suspended: 'Compte désactivé',
  reactivated: 'Compte réactivé',
}
export default function AdminAccountJournal({ accounts }) {
  const [events, setEvents] = useState([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    async function load() {
      try {
        const result = await supabase
          .from('admin_account_events')
          .select('id,actor_id,target_id,action,reason,created_at')
          .order('created_at', { ascending: false })
          .limit(50)
        if (result.error) throw result.error
        if (!cancelled) setEvents(result.data || [])
      } catch {
        if (!cancelled)
          setError(
            'Journal indisponible. Vérifiez vos droits et l’installation de la migration des comptes.',
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [attempt])
  const name = (id) => {
    const account = accounts.find((a) => a.id === id)
    return account
      ? `${account.first_name || ''} ${account.last_name || ''}`.trim() ||
          account.email ||
          'Compte sans nom'
      : 'Compte hors du registre affiché'
  }
  return (
    <section className="aa-panel aa-journal">
      <header>
        <span className="aa-eyebrow">TRAÇABILITÉ</span>
        <h2>Le journal des interventions</h2>
        <p>
          Les 50 dernières actions du nouveau journal. Les opérations des
          anciens écrans n’y figurent pas toutes.
        </p>
      </header>
      {loading ? (
        <p role="status">Lecture du journal…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)}>Réessayer</button>
        </div>
      ) : events.length ? (
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              <time dateTime={event.created_at}>
                {new Date(event.created_at).toLocaleString('fr-FR')}
              </time>
              <div>
                <strong>{labels[event.action] || event.action}</strong>
                <p>
                  {name(event.actor_id)} → {name(event.target_id)}
                </p>
                {event.reason && <p>{event.reason}</p>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p>Aucune intervention enregistrée dans ce journal.</p>
      )}
    </section>
  )
}
