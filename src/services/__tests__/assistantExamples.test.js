import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useAssistantExamples, { ASSISTANT_EXAMPLES } from '../../hooks/useAssistantExamples'
const hooks = vi.hoisted(() => ({ effects: [], setIndex: vi.fn() }))
// Test timer lifecycle independently from the DOM renderer.
vi.mock('react', () => ({
  useState: () => [0, hooks.setIndex],
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
  it('propose un exemple immédiatement et tourne toutes les 4,5 secondes', () => {
    expect(mount()).toBe(`Ex. : ${ASSISTANT_EXAMPLES[0]}`)
    vi.advanceTimersByTime(4499)
    expect(hooks.setIndex).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    const next = hooks.setIndex.mock.calls[0][0]
    expect(next(0)).toBe(1)
    expect(next(ASSISTANT_EXAMPLES.length - 1)).toBe(0)
  })
  it('ne tourne pas pendant saisie, focus, liste ouverte ou dialogue ouvert', () => {
    mount(true)
    vi.advanceTimersByTime(20000)
    expect(hooks.setIndex).not.toHaveBeenCalled()
  })
  it('respecte la réduction des animations et les changements de préférence', () => {
    media.matches = true
    mount()
    vi.advanceTimersByTime(20000)
    expect(hooks.setIndex).not.toHaveBeenCalled()
    media.matches = false
    media.dispatchEvent(new Event('change'))
    vi.advanceTimersByTime(4500)
    expect(hooks.setIndex).toHaveBeenCalledTimes(1)
  })
  it('suspend la rotation dans un onglet masqué et nettoie le timer', () => {
    mount()
    page.visibilityState = 'hidden'
    page.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(20000)
    expect(hooks.setIndex).not.toHaveBeenCalled()
    page.visibilityState = 'visible'
    page.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(4500)
    expect(hooks.setIndex).toHaveBeenCalledTimes(1)
    cleanup()
    vi.advanceTimersByTime(20000)
    expect(hooks.setIndex).toHaveBeenCalledTimes(1)
  })
})
