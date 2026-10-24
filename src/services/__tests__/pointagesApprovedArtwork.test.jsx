// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import Screen, {
  POINTAGES_INTRO_MS,
} from '../../components/PointagesLoadingScreen'

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
const render = (props) => act(async () => root.render(<Screen {...props} />))
it('shows the chosen landscape image and starts decorative light only when loaded', async () => {
  await render({})
  expect(host.querySelector('img').getAttribute('src')).toBe(
    '/images/pointages-loading-approved.webp',
  )
  expect(host.querySelector('.is-loaded')).toBeNull()
  await act(async () =>
    host.querySelector('img').dispatchEvent(new Event('load')),
  )
  expect(host.querySelector('.is-loaded')).not.toBeNull()
  expect(host.querySelector('.pt-art-scene').getAttribute('aria-hidden')).toBe(
    'true',
  )
  expect(host.innerHTML).not.toMatch(/progressbar|CheckCircle|Étape 1/)
})
it('keeps the status and timer functional if the image fails', async () => {
  const done = vi.fn()
  await render({ onIntroDone: done })
  await act(async () =>
    host.querySelector('img').dispatchEvent(new Event('error')),
  )
  expect(host.querySelector('.pt-art-scene')).toBeNull()
  expect(host.querySelector('[role="status"]').textContent).toContain(
    'Lecture des pointages',
  )
  await act(async () => vi.advanceTimersByTime(POINTAGES_INTRO_MS))
  expect(done).toHaveBeenCalledTimes(1)
})
it('holds for six seconds without resetting when data arrives and never enables early skip', async () => {
  const done = vi.fn(),
    skip = vi.fn()
  await render({ onIntroDone: done, onSkip: skip })
  expect(host.querySelector('button').disabled).toBe(true)
  await act(async () => host.querySelector('button').click())
  expect(skip).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTime(3000))
  await render({ onIntroDone: done, onSkip: skip, dataReady: true })
  expect(host.textContent).toContain('Les pointages sont prêts')
  expect(host.querySelector('section').getAttribute('aria-busy')).toBe('false')
  await act(async () => vi.advanceTimersByTime(2999))
  expect(done).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTime(1))
  expect(done).toHaveBeenCalledTimes(1)
  await act(async () => host.querySelector('button').click())
  expect(skip).toHaveBeenCalledTimes(1)
})
it('cleans up the pending timer on navigation away', async () => {
  const done = vi.fn()
  await render({ onIntroDone: done })
  await act(async () => root.render(null))
  await act(async () => vi.advanceTimersByTime(9000))
  expect(done).not.toHaveBeenCalled()
})
it('skips the decorative hold and disables the effects for reduced motion', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const done = vi.fn()
  await render({ onIntroDone: done })
  expect(done).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
  const css = readFileSync('src/components/PointagesLoadingScreen.css', 'utf8')
  expect(css).toContain('prefers-reduced-motion:reduce')
  expect(css).toContain('animation:none!important')
  expect(css).not.toMatch(/filter\s*:/)
})
it('keeps a compact asset, durable source and error-safe real loading gate', () => {
  const image = 'public/images/pointages-loading-approved.webp'
  expect(readFileSync(image).subarray(8, 12).toString()).toBe('WEBP')
  expect(statSync(image).size).toBeLessThan(250 * 1024)
  expect(
    statSync('docs/design/pointages-approved-source.png').size,
  ).toBeGreaterThan(0)
  const page = readFileSync('src/pages/Pointages.jsx', 'utf8')
  expect(page).toContain(
    'if (!state.error && ((state.loading && !state.pointages.length) || !minLoadingDone))',
  )
  expect(page).toContain('dataReady={!state.loading}')
})
