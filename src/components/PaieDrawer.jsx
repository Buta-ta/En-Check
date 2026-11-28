import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../contexts/ThemeContext'
import '../pages/PaieAfroTech.css'
import './PaieInteriors.css'

/** Shared fiscal/payroll drawer: portal, focus trap, Escape, inert background.
 * Existing forms and save callbacks stay intact inside the drawer. */
export default function PaieDrawer({ title, help, example, onClose, busy = false, children }) {
  const { darkMode } = useTheme()
  const panel = useRef(null)
  const layer = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  const pending = useRef(busy)
  pending.current = busy
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const siblings = [...document.body.children].filter(el => el !== layer.current && !el.contains(layer.current))
    const inert = siblings.map(el => [el, el.inert])
    siblings.forEach(el => { el.inert = true })
    panel.current?.focus({ preventScroll: true })
    if (panel.current) panel.current.scrollTop = 0
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!pending.current) close.current?.(); return }
      if (event.key !== 'Tab') return
      const focusable = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(el => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length)
      const first = focusable[0], last = focusable.at(-1)
      if (!first) { event.preventDefault(); panel.current.focus(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown, true)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      document.body.style.overflow = overflow
      inert.forEach(([el, value]) => { el.inert = value })
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  if (typeof document === 'undefined') return null
  return createPortal(<div ref={layer} className="paie-page pw-drawer-layer" data-theme={darkMode ? 'dark' : 'light'} onClick={event => { if (event.target === event.currentTarget && !busy) onClose?.() }}>
    <section ref={panel} className="pw-drawer" role="dialog" aria-modal="true" aria-label={title} aria-busy={busy} tabIndex={-1}>
      <div className="pw-drawer-frise" aria-hidden="true"/>
      {(help || example) && <div className="pw-action-help">{help && <p>{help}</p>}{example && <details><summary>Voir un exemple</summary><small>{example}</small></details>}</div>}
      <fieldset className="pw-drawer-content" disabled={busy}>{children}</fieldset>
    </section>
  </div>, document.body)
}
