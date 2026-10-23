// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import RetardsLoadingScreen, {
  RETARDS_INTRO_DURATION_MS,
} from '../../components/RetardsLoadingScreen'

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('ends the introductory hold at six seconds, not before', async () => {
  const done = vi.fn()
  await act(async () =>
    root.render(<RetardsLoadingScreen onMinimumDone={done} />),
  )
  await act(async () => vi.advanceTimersByTime(RETARDS_INTRO_DURATION_MS - 1))
  expect(done).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTime(1))
  expect(done).toHaveBeenCalledTimes(1)
})
it('cleans up the timer when the loading screen is removed', async () => {
  const done = vi.fn()
  await act(async () =>
    root.render(<RetardsLoadingScreen onMinimumDone={done} />),
  )
  await act(async () => root.render(null))
  await act(async () => vi.advanceTimersByTime(10000))
  expect(done).not.toHaveBeenCalled()
})
it('only permits skipping once the real data is ready and labels that state honestly', async () => {
  const skip = vi.fn()
  await act(async () => root.render(<RetardsLoadingScreen onSkip={skip} />))
  expect(host.querySelector('button').disabled).toBe(true)
  await act(async () => host.querySelector('button').click())
  expect(skip).not.toHaveBeenCalled()
  await act(async () =>
    root.render(<RetardsLoadingScreen onSkip={skip} dataReady />),
  )
  expect(host.textContent).toContain('Les arrivées sont prêtes')
  await act(async () => host.querySelector('button').click())
  expect(skip).toHaveBeenCalledTimes(1)
})
it('does not impose the introductory delay for reduced motion', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const done = vi.fn()
  await act(async () =>
    root.render(<RetardsLoadingScreen onMinimumDone={done} />),
  )
  expect(done).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
