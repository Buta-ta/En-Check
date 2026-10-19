import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { answerPublicChat, publicMessages, CHAT_ERRORS } from '../services/assistantChat'
import { SESSION_TTL } from '../services/assistantDialogue'
import AssistantStatus from './AssistantStatus'

export default function AssistantChat({ scope, readScope }) {
  const [history, setHistory] = useState([])
  const [draft, setDraft] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState('')
  const [message, setMessage] = useState('')
  const request = useRef(0)
  const controller = useRef(null)
  const activity = useRef(Date.now())
  function reset() {
    request.current++
    controller.current?.abort()
    controller.current = null
    setHistory([]); setDraft(''); setConfirmed(false); setBusy(false); setPending(''); setMessage('')
    activity.current = Date.now()
  }
  useEffect(() => {
    const clear = () => {
      request.current++
      controller.current?.abort()
      controller.current = null
      setHistory([]); setDraft(''); setConfirmed(false); setBusy(false); setPending('')
      setMessage('Discussion effacée. Vous pouvez commencer un nouvel échange général.')
      activity.current = Date.now()
    }
    const timer = setInterval(() => {
      if (readScope() !== scope || Date.now() - activity.current >= SESSION_TTL) clear()
    }, 1000)
    const subscription = supabase.auth?.onAuthStateChange?.(event => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) clear()
    })
    return () => {
      clearInterval(timer)
      subscription?.data?.subscription?.unsubscribe()
      request.current++
      controller.current?.abort()
    }
  }, [scope, readScope])

  async function submit(event) {
    event.preventDefault()
    if (controller.current || !confirmed || !draft.trim() || scope !== readScope()) return
    const text = draft.trim()
    const messages = publicMessages(history, text)
    const id = ++request.current
    const abort = new AbortController()
    controller.current = abort
    setBusy(true); setPending(text); setMessage(''); setConfirmed(false)
    activity.current = Date.now()
    const result = await answerPublicChat(messages, supabase, abort)
    if (id !== request.current || scope !== readScope()) return
    controller.current = null
    setBusy(false); setPending('')
    if (result.error) { setMessage(CHAT_ERRORS[result.error]); return }
    setHistory([...messages, { role: 'assistant', text: result.text }])
    setDraft('')
  }

  return <section className="ec-public-chat" aria-label="Discussion générale">
    <p>Posez une question générale ou demandez un conseil. Cette discussion ne consulte pas vos dossiers En-Check et ne réalise aucune action.</p>
    <p className="ec-dialogue-warning">N’envoyez aucun nom de salarié, salaire individuel, donnée de santé, secret ou information confidentielle. Les messages et les trois derniers échanges de cette discussion sont transmis à un service IA externe. Le filtre technique ne garantit pas leur anonymisation.</p>
    <button type="button" className="ec-dialogue-open" onClick={reset}>Nouvelle discussion</button>
    <div aria-label="Échanges généraux">
      {history.map((m, i) => <div key={i} className={m.role === 'user' ? 'ec-dialogue-user' : 'ec-dialogue-answer'}>
        {m.role === 'assistant' && <><div className="ec-dialogue-speaker">✧ Assistant En-Check</div><p className="ec-dialogue-provenance">Réponse IA générale · à vérifier</p></>}
        <p className="ec-public-chat-text">{m.text}</p>
      </div>)}
      {pending && <div className="ec-dialogue-user">{pending}</div>}
    </div>
    <AssistantStatus busy={busy} message={message} />
    <form onSubmit={submit}>
      <label htmlFor="ec-general-message">Votre message général</label>
      <textarea id="ec-general-message" maxLength={2000} rows={3} value={draft} disabled={busy}
        onChange={event => { setDraft(event.target.value); setConfirmed(false); activity.current = Date.now() }} />
      <label className="ec-public-chat-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />Je confirme que ce message ne contient pas de données personnelles ou confidentielles.</label>
      <button type="submit" className="ec-dialogue-open" disabled={busy || !confirmed || !draft.trim()}>Envoyer</button>
    </form>
    <p className="ec-dialogue-scope">Mémoire limitée à trois échanges précédents, effacée à la fermeture, au changement de mode ou après 15 minutes d’inactivité. Sans recherche web en direct.</p>
  </section>
}
