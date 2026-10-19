import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import AiConnectionTest from '../../pages/AiConnectionTest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../aiSmokeTest', async importOriginal => ({
  ...await importOriginal(), runAiSmokeTest: invoke,
}))
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('Page isolée de test IA (rendu serveur, pas un test navigateur)', () => {
  it('affiche la configuration et un bouton désactivé sans aucun appel au montage', () => {
    vi.stubGlobal('window', { location: { origin: 'https://admin.example' } })
    const html = renderToStaticMarkup(<MemoryRouter><AiConnectionTest /></MemoryRouter>)
    expect(html).toContain('https://admin.example')
    expect(html).toContain('AI_TEST_ALLOWED_ORIGINS')
    expect(html).toContain('AI_SMOKE_TEST_ENABLED')
    expect(html).toContain('Tester Gemma et Gemini')
    expect(html).toMatch(/class="ai-test-run" disabled=""/)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('sans frais')
    expect(invoke).not.toHaveBeenCalled()
  })
})
