import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import AssistantStatus from '../../components/AssistantStatus'

describe('Attente unifiée Assistant En-Check', () => {
  it('affiche une attente accessible sans fournisseur ni message technique', () => {
    const html = renderToStaticMarkup(<AssistantStatus busy message="Détail technique interne" />)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-atomic="true"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('ec-assistant-loading-icon')
    expect(html).toContain('Assistant En-Check')
    expect(html).toContain('Je prépare votre réponse…')
    expect(html).not.toMatch(/Gemini|Gemma|Google|Détail technique interne/)
  })
  it('retire le chargement au repos et garde les erreurs utiles', () => {
    const done = renderToStaticMarkup(<AssistantStatus busy={false} message="" />)
    expect(done).not.toContain('ec-assistant-loading')
    const error = renderToStaticMarkup(<AssistantStatus busy={false} message="Recherche indisponible" />)
    expect(error).toContain('Recherche indisponible')
    expect(error).not.toContain('ec-assistant-loading')
  })
  it('utilise le même état pendant les appels IA, RH et recherche', () => {
    const source = readFileSync(new URL('../../components/AssistantDock.jsx', import.meta.url), 'utf8')
    expect(source).toContain('<AssistantStatus busy={busy} message={message} />')
    expect(source.indexOf('setBusy(true)')).toBeLessThan(source.indexOf('await answerExplanation'))
    expect(source).toContain('finally { if (id === requestId.current) setBusy(false) }')
    expect(source.indexOf('<AssistantStatus')).toBeLessThan(source.indexOf('<AssistantAnswer answer={answer}'))
    const css = readFileSync(new URL('../../styles/assistantDock.css', import.meta.url), 'utf8')
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .ec-assistant-loading-icon { animation: none; } }')
  })
})
