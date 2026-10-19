import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useAssistantExamples, { ASSISTANT_EXAMPLES } from '../../hooks/useAssistantExamples'
const hooks = vi.hoisted(() => ({ effects: [], setIndex: vi.fn() }))
// Test timer lifecycle independently from the DOM renderer.
vi.mock('react', () => ({
  useState: initial => [initial, hooks.setIndex],
  useEffect: effect => hooks.effects.push(effect),
}))
let media, page, cleanup
beforeEach(() => {
  vi.useFakeTimers()
  hooks.effects.length = 0
  hooks.setIndex.mockClear()
  media = new EventTarget()
  media.matches = false
  page = new EventTarget()
  page.visibilityState = 'visible'
  vi.stubGlobal('document', page)
  vi.stubGlobal('window', { matchMedia: () => media })
})
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })
function mount(paused = false) {
  // React hooks are mocked above: this harness exercises only timer setup/cleanup.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const value = useAssistantExamples(paused)
  cleanup = hooks.effects[0]()
  return value
}
describe('Exemples déroulants — cycle et accessibilité', () => {
  it('efface le premier exemple puis écrit le suivant caractère par caractère', () => {
    expect(mount()).toBe(ASSISTANT_EXAMPLES[0])
    hooks.setIndex.mockClear()
    vi.advanceTimersByTime(2199)
    expect(hooks.setIndex).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(hooks.setIndex).toHaveBeenLastCalledWith(ASSISTANT_EXAMPLES[0].slice(0, -1))
    vi.advanceTimersByTime((ASSISTANT_EXAMPLES[0].length - 1) * 35)
    expect(hooks.setIndex).toHaveBeenLastCalledWith('')
    vi.advanceTimersByTime(350)
    expect(hooks.setIndex).toHaveBeenLastCalledWith(ASSISTANT_EXAMPLES[1][0])
    vi.advanceTimersByTime(75)
    expect(hooks.setIndex).toHaveBeenLastCalledWith(ASSISTANT_EXAMPLES[1].slice(0, 2))
  })
  it('ne tourne pas pendant saisie, focus, liste ouverte ou dialogue ouvert', () => {
    mount(true)
    hooks.setIndex.mockClear()
    vi.advanceTimersByTime(20000)
    expect(hooks.setIndex).not.toHaveBeenCalled()
  })
  it('respecte la réduction des animations et les changements de préférence', () => {
    media.matches = true
    mount()
    hooks.setIndex.mockClear()
    vi.advanceTimersByTime(20000)
    expect(hooks.setIndex).not.toHaveBeenCalled()
    media.matches = false
    media.dispatchEvent(new Event('change'))
    hooks.setIndex.mockClear()
    vi.advanceTimersByTime(2200)
    expect(hooks.setIndex).toHaveBeenCalledTimes(1)
  })
  it('suspend la rotation dans un onglet masqué et nettoie le timer', () => {
    mount()
    page.visibilityState = 'hidden'
    page.dispatchEvent(new Event('visibilitychange'))
    hooks.setIndex.mockClear()
    vi.advanceTimersByTime(20000)
    expect(hooks.setIndex).not.toHaveBeenCalled()
    page.visibilityState = 'visible'
    page.dispatchEvent(new Event('visibilitychange'))
    hooks.setIndex.mockClear()
    vi.advanceTimersByTime(2200)
    expect(hooks.setIndex).toHaveBeenCalledTimes(1)
    cleanup()
    vi.advanceTimersByTime(20000)
    expect(hooks.setIndex).toHaveBeenCalledTimes(1)
  })
})
