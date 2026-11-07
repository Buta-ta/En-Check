import PageCulturalBand from './PageCulturalBand'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUp, ChevronDown, ChevronUp, RotateCcw, Sparkles, X } from 'lucide-react'
import { searchSpotlight } from '../services/spotlightService'
import { supabase } from '../lib/supabase'
import AssistantAnswer from './AssistantAnswer'
import AssistantStatus from './AssistantStatus'
import EnCheckBrandMark from './EnCheckBrandMark'
import { WovenKenteBadgeSvg } from './AfroCulturalSvg'
import { answerPublicChat, publicMessages, CHAT_ERRORS } from '../services/assistantChat'
import {
  conversationalRequest,
  buildConversationalFallback,
  looksLikeConversationalQuestion,
} from '../services/assistantConversation'
import { usesGeneralConversation } from '../services/assistantRouting'
import { resolveDialogue, dialogueScope, currentDialogue, SESSION_TTL } from '../services/assistantDialogue'
import { answerRhQuestion, parseRhQuestion } from '../services/assistantRh'
import { answerNaturalCompanyQuestion } from '../services/assistantNaturalRh'
import { answerExplanation, EXPLANATION_QUESTIONS } from '../services/assistantExplanation'
import HolidayService from '../services/holidayService'
import SearchResults from './SpotlightSearch/SearchResults'
import useAssistantExamples, { ASSISTANT_EXAMPLES } from '../hooks/useAssistantExamples'
// Preserve the existing result-card styles after removal of the standalone hub.
import '../styles/spotlight.css'
import '../styles/assistantDock.css'

const QRScanner = lazy(() => import('./SpotlightSearch/QRScanner'))

// RH stays local; general chat has its own explicit public-only input and memory.
export function readAssistantContext() {
  try { return JSON.parse(localStorage.getItem('admin') || 'null') } catch { return null }
}

const readChatScope = () => dialogueScope(readAssistantContext())

// La recherche intelligente se replie sur demande, et son état est retenu :
// une fois repliée, elle reste repliée d'une page à l'autre. Elle n'est
// jamais retirée — la pastille du bas la rouvre d'un clic.
const RECHERCHE_REPLIEE_KEY = 'ec_assistant_recherche_repliee'

const lireRechercheRepliee = () => {
  try { return localStorage.getItem(RECHERCHE_REPLIEE_KEY) === '1' } catch { return false }
}

const retenirRechercheRepliee = (repliee) => {
  try { localStorage.setItem(RECHERCHE_REPLIEE_KEY, repliee ? '1' : '0') } catch { /* stockage refusé : la barre reste utilisable */ }
}

const readActiveTheme = () => {
  try {
    if (typeof document !== 'undefined') {
      const domTheme = document.documentElement?.dataset?.theme || document.body?.dataset?.theme
      if (domTheme === 'light' || domTheme === 'dark') return domTheme
    }
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('encheck_admin_dark_mode_v2')
      if (saved === 'false') return 'light'
    }
  } catch {
    // Default to dark mode
  }
  return 'dark'
}

export default function AssistantDock() {
  const [theme, setTheme] = useState(readActiveTheme)
  const [activation, setActivation] = useState(null)
  const activated = useRef(false)
  const publicHistory = useRef([])
  const chatAbort = useRef(null)
  const [draft, setDraft] = useState('')
  const [context, setContext] = useState(null)
  const [results, setResults] = useState([])
  const [message, setMessage] = useState('')
  const [answer, setAnswer] = useState(null)
  const [lastQuestion, setLastQuestion] = useState('')
  const [thread, setThread] = useState([])
  const rhContext = useRef(null)
  const dialogueSession = useRef(null)
  const activeScope = useRef(null)
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
    publicHistory.current = []
    chatAbort.current?.abort()
    setMessage('Badge lu. Envoyez la recherche pour consulter les résultats.')
  }, [])
  const [repliee, setRepliee] = useState(lireRechercheRepliee)
  const [focused, setFocused] = useState(false)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const placeholder = useAssistantExamples(opened || focused || examplesOpen || Boolean(draft))
  const dialog = useRef(null)
  const panelInput = useRef(null)
  const launcher = useRef(null)
  const resultsArea = useRef(null)
  const threadEnd = useRef(null)
  const restoreFocus = useRef(false)
  const requestId = useRef(0)
  const location = useLocation()
  const navigate = useNavigate()

  function close() {
    setDraft('')
    activeScope.current = null
    setActivation(null)
    activated.current = false
    publicHistory.current = []
    chatAbort.current?.abort()
    setScanning(false)
    setAnswer(null)
    rhContext.current = null
    dialogueSession.current = null
    setLastQuestion('')
    setThread([])
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
    activeScope.current = dialogueScope(admin)
    setContext(admin)
    setResults([])
    setMessage('')
    setOpened(true)
    if (!dialog.current?.open) dialog.current?.showModal()
    panelInput.current?.focus()
    return admin
  }

  useEffect(() => {
    setTheme(readActiveTheme())
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.documentElement) {
      return undefined
    }
    const observer = new MutationObserver(() => setTheme(readActiveTheme()))
    if (document.documentElement instanceof Node) {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    }
    if (document.body instanceof Node) {
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
    }
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!opened && restoreFocus.current) {
      launcher.current?.focus()
      restoreFocus.current = false
    }
  }, [opened])

  useEffect(() => {
    setActivation(null)
    activated.current = false
    publicHistory.current = []
    chatAbort.current?.abort()
    // No query/history survives a change of route or enterprise context.
    requestId.current++
    dialog.current?.close()
    setOpened(false)
    setBusy(false)
    setDraft('')
    setLastQuestion('')
    setThread([])
    setAnswer(null)
    rhContext.current = null
    dialogueSession.current = null
    setScanning(false)
    setResults([])
    setMessage('')
    // Compatibility for old hub bookmarks; dashboard remains Auth-protected.
    if (new URLSearchParams(location.search).get('assistant') === '1') open()
    return () => { requestId.current++; chatAbort.current?.abort() }
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
  }, [results, thread])

  useEffect(() => {
    if (opened) threadEnd.current?.scrollIntoView?.({ block: 'nearest' })
  }, [opened, answer, message, busy, thread.length, activation])

  async function search(event, followup, activate = false) {
    event?.preventDefault()
    if (busy) return
    const original = (followup || draft).trim()
    if (!original) return
    const admin = opened ? readAssistantContext() : open()
    const scope = dialogueScope(admin)
    const expired = dialogueSession.current && Date.now() - dialogueSession.current.at >= SESSION_TTL
    const previous = currentDialogue(dialogueSession.current, scope)
    if (!previous) rhContext.current = null
    if (!currentDialogue(dialogueSession.current, scope)) {
      // A null local state is normal after a general reply; check scope/age separately.
      if (dialogueSession.current?.scope !== scope || Date.now() - dialogueSession.current.at >= SESSION_TTL) {
        publicHistory.current = []; activated.current = false
      }
    }
    const general = usesGeneralConversation(original, publicHistory.current)
    const conversation = general ? { query: original, state: { general: true } } : resolveDialogue(original, previous)
    if (!general) publicHistory.current = []
    const query = conversation.query || original
    dialogueSession.current = { scope, at: Date.now(), state: conversation.state }
    if (activeScope.current !== scope || expired) setThread([])
    else if (!activation && lastQuestion && (answer || message || results.length)) {
      setThread(turns => [...turns, { question: lastQuestion, answer, message, results }].slice(-9))
    }
    setContext(admin)
    setAnswer(null)
    chatAbort.current?.abort()
    const id = ++requestId.current
    const isCurrent = () => id === requestId.current && scope === dialogueScope(readAssistantContext())
    setResults([])
    setLastQuestion(original)
    setDraft('')
    setActivation(null)
    if (conversation.answer) { setAnswer(conversation.answer); setMessage(''); return }
    if (!query) { setMessage('Saisissez un nom, un matricule ou une recherche.'); return }
    if (!admin || !(admin.selectedEnterprise?.id || admin.enterprise_id)) {
      setMessage('Sélectionnez une entreprise dans En-Check avant de rechercher.'); return
    }
    if (general && !activated.current && !activate) {
      setActivation(original)
      setMessage('')
      return
    }
    if (activate) activated.current = true
    setBusy(true)
    setMessage('')
    try {
      if (general) {
        const messages = publicMessages(publicHistory.current, original)
        const controller = new AbortController()
        chatAbort.current = controller
        const result = await answerPublicChat(messages, supabase, controller)
        if (!isCurrent()) return
        chatAbort.current = null
        if (result.error) {
          const fallback =
            resolveDialogue(original, previous)?.answer ||
            (['disabled', 'unavailable'].includes(result.error) ? buildConversationalFallback(original) : null)
          if (fallback) { setAnswer(fallback); return }
          setMessage(CHAT_ERRORS[result.error]); return
        }
        publicHistory.current = [...messages, { role: 'assistant', text: result.text }]
        setAnswer({ text: result.text,
          source: 'Réponse générée à partir de cette discussion, sans consultation des dossiers ni recherche web en direct.',
          notes: ['Cette réponse peut contenir des erreurs. Vérifiez les informations importantes.'] })
        return
      }
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
      const naturalRh = !parseRhQuestion(query, rhContext.current)?.intent
        ? await answerNaturalCompanyQuestion({ query: original, admin, client: supabase })
        : null
      if (id !== requestId.current) return
      if (!isCurrent()) return
      if (naturalRh) {
        setAnswer(conversation.greeting ? { ...naturalRh, text: `Bonjour ! ${naturalRh.text}` } : naturalRh)
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
      if (found?.length) {
        setAnswer({
          text: `J’ai trouvé ${found.length} résultat${found.length > 1 ? 's' : ''} correspondant à « ${original} » dans En-Check. Sélectionnez une fiche ci-dessous pour la consulter ou poursuivez notre échange.`,
        })
        setMessage('')
      } else if (looksLikeConversationalQuestion(original)) {
        setAnswer(conversationalRequest(original)?.answer || buildConversationalFallback(original))
        setMessage('')
      } else {
        setAnswer({
          text: `Je n’ai trouvé aucune fiche correspondant à « ${query} » dans cette entreprise. Vous pouvez m’indiquer le nom ou le matricule d’un collaborateur, me demander le point sur votre équipe (pointages, retards, sorties présumées) ou me poser une question générale !`,
          choices: ["Qui est en retard aujourd'hui", "Combien de pointages aujourd'hui", 'Sorties présumées à confirmer', 'Que peux-tu faire ?'],
        })
        setMessage('')
      }
    } catch {
      if (isCurrent()) {
        dialogueSession.current = { scope, at: Date.now(), state: null }
        setMessage('La recherche est momentanément indisponible. Vous pouvez toujours ouvrir les pages métier ci-dessous.')
      }
    } finally { if (id === requestId.current) setBusy(false) }
  }

  // Forget context on auth changes, cross-tab account changes and inactivity.
  // No RH result is sent to a model; general history stays in RAM between calls.
  useEffect(() => {
    const reset = () => {
      setActivation(null)
      activated.current = false
      publicHistory.current = []
      chatAbort.current?.abort()
      requestId.current++
      rhContext.current = null
      dialogueSession.current = null
      setAnswer(null)
      setResults([])
      setLastQuestion('')
      setThread([])
      setDraft('')
      setMessage('')
      setBusy(false)
      activeScope.current = readChatScope()
      setContext(readAssistantContext())
    }
    const onStorage = event => { if (event.key === 'admin' || event.key === null) reset() }
    const subscription = supabase.auth?.onAuthStateChange?.(event => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') reset()
    })
    const timer = setInterval(() => {
      const session = dialogueSession.current
      if (activeScope.current && activeScope.current !== readChatScope()) { reset(); return }
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
    const paths = { employee: '/employes', attendance: '/pointages', retard: '/retards', task: '/employes?vue=taches', payslip: '/paie?onglet=fiches', absence: '/absences', leave_request: '/absences', team: '/employes?vue=equipes', geofence: '/geopointage', schedule_request: '/planning', face_enrollment: '/reconnaissance-faciale' }
    const actions = { goDashboard: '/dashboard', goReports: '/rapports', goMap: '/geopointage', goPredictions: '/predictions' }
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

  function replierRecherche(etat) {
    setRepliee(etat)
    retenirRechercheRepliee(etat)
    if (etat) setExamplesOpen(false)
  }

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
    <div className={`ec-assistant-space${repliee ? ' is-repliee' : ''}`} aria-hidden="true" />
    {createPortal(<>
      <aside className={`ec-assistant-dock${repliee ? ' is-repliee' : ''}`} data-theme={theme} aria-label="Assistant En-Check" hidden={opened} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
        <div className="ec-assistant-weave" aria-hidden="true"><PageCulturalBand pathname={location.pathname} placement="compact"/></div>
        {repliee ? (
          <div className="ec-assistant-rangee">
            <button type="button" className="ec-assistant-rallumer" onClick={() => replierRecherche(false)} aria-expanded="false" aria-controls="ec-assistant-recherche">
              <Sparkles size={18} aria-hidden="true" />
              <span>Recherche intelligente</span>
              <ChevronUp size={16} aria-hidden="true" />
            </button>
            <span className="ec-assistant-rangee-note">Repliée — la rouvrir ne perd rien.</span>
          </div>
        ) : (
          <>
            <div className="ec-assistant-label">
              <span><EnCheckBrandMark size={18} /> ASSISTANT EN-CHECK · ON GÈRE !</span>
              <span className="ec-assistant-label-droite">
                <span className="ec-assistant-label-devise">Converser · Vérifier · Comprendre</span>
                <button type="button" className="ec-assistant-replier" onClick={() => replierRecherche(true)} aria-expanded="true" aria-controls="ec-assistant-recherche" title="Replier la barre de recherche — elle reste à portée de clic">
                  <ChevronDown size={15} aria-hidden="true" />
                  <span>Replier</span>
                </button>
              </span>
            </div>
            <div id="ec-assistant-recherche">
              <form className="ec-assistant-form" onSubmit={search}>
                <button ref={launcher} type="button" className="ec-assistant-open" onClick={open} aria-label="Ouvrir l’assistant En-Check" aria-haspopup="dialog"><Sparkles size={20} /></button>
                <input aria-label="Votre recherche En-Check" placeholder={placeholder} value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)} autoComplete="off" />
                <button type="submit" className="ec-assistant-send" aria-label="Rechercher"><ArrowUp size={21} /></button>
              </form>
              <details className="ec-assistant-examples" onToggle={event => setExamplesOpen(event.currentTarget.open)}>
                <summary>Exemples à demander</summary>
                {examples}
                <p>Choisissez un exemple, adaptez-le, puis envoyez.</p>
              </details>
            </div>
          </>
        )}
      </aside>
      <dialog ref={dialog} className="ec-assistant-panel" data-theme={theme} aria-labelledby="ec-assistant-title" onCancel={event => { event.preventDefault(); if (scanning) stopScanning(); else close() }} onClick={event => { if (event.target === dialog.current) close() }}>
        <div className="ec-assistant-weave" aria-hidden="true"><PageCulturalBand pathname={location.pathname} placement="compact"/></div>
        <header className="ec-assistant-panel-header">
          <div className="ec-assistant-panel-brand">
            <WovenKenteBadgeSvg variant={1} size={40} />
            <EnCheckBrandMark size={38} />
            <div>
              <h2 id="ec-assistant-title">Assistant En-Check</h2>
              <p>On gère ! · Votre entreprise, en conversation</p>
            </div>
          </div>
          <div className="ec-assistant-header-actions">
            <button type="button" className="ec-assistant-new" onClick={() => { close(); open() }}>
              <RotateCcw size={14} />
              <span>Nouvelle discussion</span>
            </button>
            <button type="button" className="ec-assistant-close" onClick={close} aria-label="Fermer l’assistant">
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="ec-assistant-content" ref={resultsArea} onKeyDown={event => {
          if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.result-card, .result-card-modern')) { event.preventDefault(); event.target.click() }
        }}>
          {scanning ? <Suspense fallback={<p>Ouverture du scanner…</p>}><QRScanner onClose={stopScanning} onScan={receiveScan} /></Suspense> : <>
          <p className="ec-assistant-context">Entreprise : {context?.selectedEnterprise?.name || (context?.enterprise_id ? 'entreprise de votre compte' : 'à sélectionner')}</p>
          {!lastQuestion && <div className="ec-dialogue-welcome">
            <span className="ec-dialogue-emblem" aria-hidden="true">✧</span>
            <h3>Bonjour ! Que souhaitez-vous vérifier ou comprendre aujourd’hui ?</h3>
            <p>Posez votre question, puis poursuivez naturellement la discussion.</p>
          </div>}
          <div className="ec-dialogue-thread" aria-label="Historique de la conversation">
            {thread.map((turn, index) => <div key={index} className="ec-dialogue-turn">
              <div className="ec-dialogue-user">{turn.question}</div>
              {turn.answer && <AssistantAnswer answer={turn.answer} onChoice={choice => search(null, choice)} onNavigate={go} live={false} />}
              {turn.message && <p>{turn.message}</p>}
              {turn.results?.length > 0 && <SearchResults results={turn.results} selectedIndex={-1} onSelect={select} />}
            </div>)}
          </div>
          {lastQuestion && <div className="ec-dialogue-user">{lastQuestion}</div>}
          <AssistantStatus busy={busy} message={message} />
          {activation && <section className="ec-assistant-activation" aria-label="Activer la conversation">
            <h3>Avant notre premier échange</h3>
            <p>Pour répondre aux questions générales, votre message et jusqu’à trois échanges précédents sont transmis à un service IA externe. Réservez ces échanges aux informations non personnelles et non confidentielles. Vos résultats métier ne sont pas transmis automatiquement.</p>
            <div className="ec-dialogue-followups">
              <button type="button" onClick={() => search(null, activation, true)}>Activer et poursuivre</button>
              <button type="button" onClick={() => { setDraft(activation); setActivation(null); setMessage('Vous pouvez préciser votre demande pour consulter En-Check. Aucun message envoyé au service externe.') }}>Pas maintenant</button>
            </div>
          </section>}
          {answer && <AssistantAnswer answer={answer} onChoice={choice => search(null, choice)} onNavigate={go} />}
          <details className="ec-assistant-examples">
            <summary>Idées de questions</summary>
            {examples}
            <div className="ec-assistant-example-list">{EXPLANATION_QUESTIONS.map(question => <button type="button" key={question} onClick={() => chooseExample(question)}>{question}</button>)}</div>
            <p>Un exemple remplit la saisie. Envoyez-le quand vous êtes prêt.</p>
          </details>
          <details className="ec-assistant-examples"><summary>Accès rapides</summary>{shortcuts}</details>
          <details className="ec-dialogue-sources ec-assistant-privacy"><summary>Confidentialité</summary><p>Les consultations métier restent soumises à vos droits. Après activation, les questions générales et jusqu’à trois échanges précédents sont traités par un service IA externe. N’y incluez aucune donnée personnelle ou confidentielle. Le routage technique ne garantit pas l’anonymisation. Le fournisseur et ses conditions sont décrits dans l’information de confidentialité du service. La mémoire est temporaire ; une nouvelle discussion l’efface. Les sources et limites de chaque réponse sont accessibles dans ses précisions.</p></details>
          {results.length > 0 && <div className="ec-assistant-results" ><SearchResults results={results} selectedIndex={-1} onSelect={select} /></div>}
          <div ref={threadEnd} />
          </>}
        </div>
        <form hidden={scanning} className="ec-assistant-form ec-assistant-panel-form" onSubmit={search}>
          <input ref={panelInput} aria-label="Rechercher dans En-Check" placeholder="Que souhaitez-vous savoir ?" value={draft} maxLength={2000} onChange={e => { requestId.current++; chatAbort.current?.abort(); setActivation(null); setBusy(false); setResults([]); setMessage(''); setDraft(e.target.value) }} autoComplete="off" />
          <button type="submit" className="ec-assistant-send" disabled={busy} aria-label={busy ? "Réponse en préparation" : "Lancer la recherche"}><ArrowUp size={21} /></button>
        </form>

      </dialog>
    </>, document.body)}
  </>
}
