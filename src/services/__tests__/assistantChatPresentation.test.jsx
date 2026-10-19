import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AssistantChat from '../../components/AssistantChat'
import { resolveDialogue } from '../assistantDialogue'
vi.mock('../../lib/supabase', () => ({ supabase: {} }))
describe('Discussion générale et clarification', () => {
  it('ne traite plus comment comme une recherche de téléchargement', () => {
    expect(resolveDialogue('comment ?').query).toBeUndefined()
    expect(resolveDialogue('comment ?').answer.title).toBe('Précisons ensemble')
    expect(resolveDialogue('comment ?', { intent: 'retards' }).answer.choices).toContain('Comment sont calculés les retards ?')
  })
  it('présente un envoi explicite et non précoché, sans marque fournisseur', () => {
    const html = renderToStaticMarkup(<AssistantChat scope="demo" readScope={() => 'demo'} />)
    expect(html).toContain('Discussion générale')
    expect(html).toContain('service IA externe')
    expect(html).toContain('type="checkbox"')
    expect(html).not.toContain('checked=""')
    expect(html).toContain('disabled=""')
    expect(html).not.toMatch(/Gemini|Gemma|Google/)
    expect(html).toContain('ne garantit pas leur anonymisation')
    expect(html).toContain('Mémoire limitée')
  })
})
