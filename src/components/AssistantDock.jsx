import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUp, Sparkles, X } from 'lucide-react'
import { searchSpotlight } from '../services/spotlightService'
import { supabase } from '../lib/supabase'
import AssistantAnswer from './AssistantAnswer'
import { resolveDialogue, dialogueScope, currentDialogue, SESSION_TTL } from '../services/assistantDialogue'
import { answerRhQuestion } from '../services/assistantRh'
import { answerExplanation, EXPLANATION_QUESTIONS } from '../services/assistantExplanation'
import HolidayService from '../services/holidayService'
import SearchResults from './SpotlightSearch/SearchResults'
import useAssistantExamples, { ASSISTANT_EXAMPLES } from '../hooks/useAssistantExamples'
// Preserve the existing result-card styles after removal of the standalone hub.
import '../styles/spotlight.css'
import '../styles/assistantDock.css'

const QRScanner = lazy(() => import('./SpotlightSearch/QRScanner'))

// Read-only: RH data stays in En-Check. Only approved public explanation topics can reach AI.
export function readAssistantContext() {
  try { return JSON.parse(localStorage.getItem('admin') || 'null') } catch { return null }
}

export default function AssistantDock() {
  const [draft, setDraft] = useState('')
  const [context, setContext] = useState(null)
  const [results, setResults] = useState([])
  const [message, setMessage] = useState('')
  const [answer, setAnswer] = useState(null)
  const [lastQuestion, setLastQuestion] = useState('')
  const rhContext = useRef(null)
  const dialogueSession = useRef(null)
  const [busy, setBusy] = useState(false)
  const [opened, setOpened] = useState(false)
  const [scanning, setScanning] = useState(false)
  const stopScanning = useCallback(() => setScanning(false), [])
  const receiveScan = useCallback(value => {
    setScanning(false)
    setDraft(value.slice(0, 300))
    setAnswer(null)
    rhContext.current = null
    dialogueSession.current = null
    setResults([])
    setBusy(false)
    setMessage('Badge lu. Envoyez la recherche pour consulter les résultats.')
  }, [])
  const [focused, setFocused] = useState(false)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const placeholder = useAssistantExamples(opened || focused || examplesOpen || Boolean(draft))
  const dialog = useRef(null)
  const panelInput = useRef(null)
  const launcher = useRef(null)
  const resultsArea = useRef(null)
  const restoreFocus = useRef(false)
  const requestId = useRef(0)
  const location = useLocation()
  const navigate = useNavigate()

  function close() {
    setScanning(false)
    setAnswer(null)
    rhContext.current = null
    dialogueSession.current = null
    setLastQuestion('')
    requestId.current++
    dialog.current?.close()
    setOpened(false)
    setBusy(false)
    setResults([])
    setMessage('')
    restoreFocus.current = true
  }

  function open() {
    const admin = readAssistantContext()
    setContext(admin)
    setResults([])
    setMessage('')
    setOpened(true)
    if (!dialog.current?.open) dialog.current?.showModal()
    panelInput.current?.focus()
    return admin
  }

  useEffect(() => {
    if (!opened && restoreFocus.current) {
      launcher.current?.focus()
      restoreFocus.current = false
    }
  }, [opened])

  useEffect(() => {
    // No query/history survives a change of route or enterprise context.
    requestId.current++
    dialog.current?.close()
    setOpened(false)
    setBusy(false)
    setDraft('')
    setLastQuestion('')
    setAnswer(null)
    rhContext.current = null
    dialogueSession.current = null
    setScanning(false)
    setResults([])
    setMessage('')
    // Compatibility for old hub bookmarks; dashboard remains Auth-protected.
    if (new URLSearchParams(location.search).get('assistant') === '1') open()
    return () => { requestId.current++ }
  }, [location.pathname, location.search])

  useEffect(() => {
    const onKey = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        // Do not steal focus from another modal or a pointage validation.
        if (document.querySelector('dialog[open], [role="dialog"], [aria-modal="true"]')) return
        event.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    resultsArea.current?.querySelectorAll('.result-card, .result-card-modern').forEach(card => {
      card.tabIndex = 0
      card.setAttribute('role', 'button')
    })
  }, [results])

  async function search(event, followup) {
    event?.preventDefault()
    if (busy) return
    const original = (followup || draft).trim()
    const admin = opened ? readAssistantContext() : open()
    const scope = dialogueScope(admin)
    const previous = currentDialogue(dialogueSession.current, scope)
    if (!previous) rhContext.current = null
    const conversation = resolveDialogue(original, previous)
    const query = conversation.query || original
    dialogueSession.current = { scope, at: Date.now(), state: conversation.state }
    setContext(admin)
    setAnswer(null)
    const id = ++requestId.current
    const isCurrent = () => id === requestId.current && scope === dialogueScope(readAssistantContext())
    setResults([])
    setLastQuestion(original)
    setDraft('')
    if (conversation.answer) { setAnswer(conversation.answer); setMessage(''); return }
    if (!query) { setMessage('Saisissez un nom, un matricule ou une recherche.'); return }
    if (!admin || !(admin.selectedEnterprise?.id || admin.enterprise_id)) {
      setMessage('Sélectionnez une entreprise dans En-Check avant de rechercher.'); return
    }
    setBusy(true)
    setMessage('Recherche dans les données En-Check…')
    try {
      const explanation = await answerExplanation(query, supabase)
      if (id !== requestId.current) return
      if (!isCurrent()) return
      if (explanation) {
        setAnswer(explanation)
        rhContext.current = null
        dialogueSession.current = { scope, at: Date.now(), state: null }
        setMessage('')
        return
      }
      const rh = await answerRhQuestion({ query, admin, client: supabase, previous: rhContext.current,
        loadHolidays: (enterprise, from, to) => HolidayService.getHolidaysForRange(enterprise, from, to, { strict: true }),
      })
      if (id !== requestId.current) return
      if (!isCurrent()) return
      if (rh) {
        setAnswer(conversation.greeting ? { ...rh, text: `Bonjour ! ${rh.text}` } : rh)
        rhContext.current = rh.context || null
        if (!rh.context) dialogueSession.current = { scope, at: Date.now(), state: null }
        setMessage('')
        return
      }
      rhContext.current = null
      dialogueSession.current = { scope, at: Date.now(), state: null }
      const found = await searchSpotlight(query, admin)
      if (id !== requestId.current) return
      if (!isCurrent()) return
      setResults(found || [])
      if (!found?.length) setAnswer({
        title: 'Pouvez-vous préciser ?',
        text: 'Je n’ai pas trouvé de résultat. Si vous cherchez une personne, précisez son nom ou son matricule. Si vous souhaitez un bilan, dites-moi quel sujet vous intéresse : pointages, retards ou sorties présumées. Je ne peux pas encore répondre librement à tous les sujets.',
        choices: ['Combien de pointages', 'Qui est en retard', 'Sorties présumées à confirmer'],
      })
      setMessage(found?.length
        ? 'Voici les résultats de la recherche En-Check. Sélectionnez une fiche pour la consulter.'
        : '')
    } catch {
      if (isCurrent()) {
        dialogueSession.current = { scope, at: Date.now(), state: null }
        setMessage('La recherche est momentanément indisponible. Vous pouvez toujours ouvrir les pages métier ci-dessous.')
      }
    } finally { if (id === requestId.current) setBusy(false) }
  }

  // Forget context on auth changes, cross-tab account changes and inactivity.
  // No conversation or RH result is written to storage or sent to a model.
  useEffect(() => {
    const reset = () => {
      requestId.current++
      rhContext.current = null
      dialogueSession.current = null
      setAnswer(null)
      setResults([])
      setLastQuestion('')
      setDraft('')
      setMessage('')
      setBusy(false)
      setContext(readAssistantContext())
    }
    const onStorage = event => { if (event.key === 'admin' || event.key === null) reset() }
    const subscription = supabase.auth?.onAuthStateChange?.(event => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') reset()
    })
    const timer = setInterval(() => {
      const session = dialogueSession.current
      if (session && (session.scope !== dialogueScope(readAssistantContext()) || Date.now() - session.at >= SESSION_TTL)) reset()
    }, 1000)
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(timer)
      window.removeEventListener('storage', onStorage)
      subscription?.data?.subscription?.unsubscribe()
    }
  }, [])

  function go(path) { close(); navigate(path) }
  function select(result) {
    if (result.type === 'action' && result.action === 'openScanner') { setScanning(true); return }
    const paths = { employee: '/employes', attendance: '/pointages', retard: '/retards', task: '/taches', payslip: '/fiches-paie', absence: '/absences', leave_request: '/absences', team: '/equipes', geofence: '/geofencing', schedule_request: '/planning', face_enrollment: '/enrollements-faciaux' }
    const actions = { goDashboard: '/dashboard', goReports: '/rapports', goMap: '/carte-temps-reel', goPredictions: '/predictions' }
    if (result.type === 'download_app' || result.type === 'hours_detail') return
    if (result.type === 'employee') return go(`/employes?id=${encodeURIComponent(result.id)}`)
    if (result.type === 'task') return go(`/taches/${encodeURIComponent(result.id)}`)
    const path = result.type === 'action' ? actions[result.action] : paths[result.type]
    if (path) go(path)
    else setMessage('Ce résultat est consultable ici. Pour poursuivre, ouvrez la page métier correspondante depuis En-Check.')
  }

  const shortcuts = <nav className="ec-assistant-shortcuts" aria-label="Raccourcis de l’assistant">
    <button type="button" onClick={() => go('/pointages')}>Pointages à vérifier</button>
    <button type="button" onClick={() => go('/planning')}>Ouvrir le planning</button>
    <button type="button" onClick={() => go('/rapports')}>Rapports et exports</button>
    <button type="button" onClick={() => { requestId.current++; setResults([]); setBusy(false); setScanning(true) }}>Scanner un badge</button>
  </nav>

  function chooseExample(example) {
    requestId.current++
    setBusy(false)
    setDraft(example)
    open()
    // Choosing an example only prepares the input. Submit remains explicit.
  }

  const examples = <div className="ec-assistant-example-list">
    {ASSISTANT_EXAMPLES.map(example => <button type="button" key={example} onClick={() => chooseExample(example)}>{example}<ArrowUp size={14} aria-hidden="true" /></button>)}
  </div>

  return <>
    <div className="ec-assistant-space" aria-hidden="true" />
    {createPortal(<>
      <aside className="ec-assistant-dock" aria-label="Assistant En-Check" hidden={opened} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
        <div className="ec-assistant-weave" aria-hidden="true" />
        <div className="ec-assistant-label"><span><Sparkles size={14} /> ASSISTANT EN-CHECK</span><span>Rechercher · Comprendre · Anticiper</span></div>
        <form className="ec-assistant-form" onSubmit={search}>
          <button ref={launcher} type="button" className="ec-assistant-open" onClick={open} aria-label="Ouvrir l’assistant En-Check" aria-haspopup="dialog"><Sparkles size={20} /></button>
          <input aria-label="Votre recherche En-Check" placeholder={placeholder} value={draft} maxLength={300} onChange={e => setDraft(e.target.value)} autoComplete="off" />
          <button type="submit" className="ec-assistant-send" aria-label="Rechercher"><ArrowUp size={21} /></button>
        </form>
        <details className="ec-assistant-examples" onToggle={event => setExamplesOpen(event.currentTarget.open)}>
          <summary>Exemples à demander</summary>
          {examples}
          <p>Choisissez un exemple, adaptez-le, puis envoyez.</p>
        </details>
      </aside>
      <dialog ref={dialog} className="ec-assistant-panel" aria-labelledby="ec-assistant-title" onCancel={event => { event.preventDefault(); if (scanning) stopScanning(); else close() }} onClick={event => { if (event.target === dialog.current) close() }}>
        <div className="ec-assistant-weave" aria-hidden="true" />
        <header className="ec-assistant-panel-header"><div><h2 id="ec-assistant-title">Assistant En-Check</h2><p>Votre entreprise, en conversation</p></div><button type="button" onClick={close} aria-label="Fermer l’assistant"><X size={22} /></button></header>
        <div className="ec-assistant-content">
          {scanning ? <Suspense fallback={<p>Ouverture du scanner…</p>}><QRScanner onClose={stopScanning} onScan={receiveScan} /></Suspense> : <>
          <p className="ec-assistant-context">Entreprise : {context?.selectedEnterprise?.name || (context?.enterprise_id ? 'entreprise de votre compte' : 'à sélectionner')}</p>
          {!lastQuestion && <div className="ec-dialogue-welcome">
            <span className="ec-dialogue-emblem" aria-hidden="true">✧</span>
            <h3>Bonjour, que souhaitez-vous vérifier ?</h3>
            <p>Vos pointages, vos retards ou une notion à comprendre : commençons par votre question.</p>
          </div>}
          {lastQuestion && <div className="ec-dialogue-user">{lastQuestion}</div>}
          {answer && <AssistantAnswer answer={answer} onChoice={choice => search(null, choice)} onNavigate={go} />}
          <details className="ec-assistant-examples">
            <summary>Idées de questions</summary>
            {examples}
            <div className="ec-assistant-example-list">{EXPLANATION_QUESTIONS.map(question => <button type="button" key={question} onClick={() => chooseExample(question)}>{question}</button>)}</div>
            <p>Un exemple remplit la saisie. Envoyez-le quand vous êtes prêt.</p>
          </details>
          <details className="ec-assistant-examples"><summary>Accès rapides</summary>{shortcuts}</details>
          <details className="ec-dialogue-sources"><summary>À propos de cet assistant</summary><p>Les chiffres viennent des règles En-Check. Seules les explications publiques peuvent être reformulées par IA. Le contexte de discussion est temporaire et reste dans En-Check. Je peux demander une précision ou reprendre une période. Le dialogue génératif libre et l’anticipation ne sont pas encore connectés. Aucun dossier RH n’est transmis aux modèles.</p></details>
          <div role="status" aria-live="polite" aria-busy={busy}>{message && <p>{message}</p>}</div>
          {results.length > 0 && <div className="ec-assistant-results" ref={resultsArea} onKeyDown={event => {
            if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.result-card, .result-card-modern')) { event.preventDefault(); event.target.click() }
          }}><SearchResults results={results} selectedIndex={-1} onSelect={select} /></div>}
          </>}
        </div>
        <form hidden={scanning} className="ec-assistant-form ec-assistant-panel-form" onSubmit={search}>
          <input ref={panelInput} aria-label="Rechercher dans En-Check" placeholder="Dites-moi ce que vous souhaitez vérifier…" value={draft} maxLength={300} onChange={e => { requestId.current++; setBusy(false); setResults([]); setMessage(''); setDraft(e.target.value) }} autoComplete="off" />
          <button type="submit" className="ec-assistant-send" disabled={busy} aria-label="Lancer la recherche"><ArrowUp size={21} /></button>
        </form>
        <footer>Aucune modification sans votre confirmation.</footer>
      </dialog>
    </>, document.body)}
  </>
}
