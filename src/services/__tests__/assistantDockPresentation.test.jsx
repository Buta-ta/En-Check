import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import AssistantDock, { readAssistantContext } from '../../components/AssistantDock'

vi.mock('react-dom', () => ({ createPortal: children => children }))
const { search } = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('../spotlightService', () => ({ searchSpotlight: search }))
vi.mock('../../components/SpotlightSearch/SearchResults', () => ({ default: () => null }))
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('Barre assistant — interface, sans modèle externe', () => {
  it('affiche barre basse, motifs et dialogue fermé, sans appel au chargement', () => {
    vi.stubGlobal('document', { body: {} })
    const html = renderToStaticMarkup(<MemoryRouter><AssistantDock /></MemoryRouter>)
    expect(html).toContain('ec-assistant-dock')
    expect(html).toContain('ec-assistant-weave')
    expect(html).toContain('Demandez à En-Check…')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-labelledby="ec-assistant-title"')
    expect(html).not.toContain('<dialog open')
    expect(html).toContain('ne sont pas encore connectées')
    expect(search).not.toHaveBeenCalled()
  })
  it('ne considère pas un profil absent ou corrompu comme un contexte', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{broken' })
    expect(readAssistantContext()).toBeNull()
    vi.stubGlobal('localStorage', { getItem: () => null })
    expect(readAssistantContext()).toBeNull()
  })
  it('monte uniquement après la protection admin, conserve la recherche détaillée', () => {
    const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8')
    expect(app).toContain('return <>{children}<AssistantDock /></>')
    expect(app).toContain('<Route path="/search" element={<AdminRoute><SpotlightSearch /></AdminRoute>} />')
    const dashboard = readFileSync(new URL('../../components/DashboardExperience.jsx', import.meta.url), 'utf8')
    expect(dashboard).not.toContain('SpotlightFAB')
  })
  it('ignore les réponses périmées et ne contient aucun appel fournisseur', () => {
    const source = readFileSync(new URL('../../components/AssistantDock.jsx', import.meta.url), 'utf8')
    expect(source).toContain('if (id !== requestId.current) return')
    expect(source).toContain('admin.selectedEnterprise?.id || admin.enterprise_id')
    expect(source).not.toMatch(/functions\.invoke|generateContent|GEMINI_API_KEY|saveSearchHistory/)
    expect(source).toContain('showModal()')
    expect(source).toContain('onCancel=')
  })
})
