import { LoaderCircle } from 'lucide-react'

// One user-facing status for every asynchronous answer path, regardless of provider.
export default function AssistantStatus({ busy, message }) {
  return <div className="ec-assistant-status" role="status" aria-live="polite" aria-atomic="true">
    {busy ? <div className="ec-assistant-loading">
      <LoaderCircle className="ec-assistant-loading-icon" size={20} aria-hidden="true" />
      <div><span className="ec-dialogue-speaker">Assistant En-Check</span><p>Je prépare votre réponse…</p></div>
    </div> : message ? <p>{message}</p> : null}
  </div>
}
