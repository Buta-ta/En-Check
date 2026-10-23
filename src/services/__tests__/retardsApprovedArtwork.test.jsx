// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { it, expect } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import RetardsLoadingScreen from '../../components/RetardsLoadingScreen'

async function withLoader(test) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<RetardsLoadingScreen />))
    await test(host, root)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
}
it('keeps the approved composition until all animation images have loaded', async () => {
  await withLoader(async (host) => {
    expect(
      host.querySelector('.rt-arrival-art').classList.contains('is-ready'),
    ).toBe(false)
    expect(host.querySelector('.rt-arrival-approved').getAttribute('src')).toBe(
      '/images/retards-arrival-approved.webp',
    )
    const images = [...host.querySelectorAll('img')]
    expect(images).toHaveLength(5)
    for (const image of images.slice(0, 4))
      await act(async () => image.dispatchEvent(new Event('load')))
    expect(
      host.querySelector('.rt-arrival-art').classList.contains('is-ready'),
    ).toBe(false)
    await act(async () => images[4].dispatchEvent(new Event('load')))
    expect(
      host.querySelector('.rt-arrival-art').classList.contains('is-ready'),
    ).toBe(true)
    await act(async () => images[4].dispatchEvent(new Event('load')))
    expect(
      host.querySelector('.rt-arrival-art').classList.contains('is-ready'),
    ).toBe(true)
  })
})
it('retains the still artwork if a cutout fails and retains the status if the original fails', async () => {
  await withLoader(async (host) => {
    const images = [...host.querySelectorAll('img')]
    await act(async () => images[0].dispatchEvent(new Event('error')))
    for (const image of images)
      await act(async () => image.dispatchEvent(new Event('load')))
    expect(
      host.querySelector('.rt-arrival-art').classList.contains('is-ready'),
    ).toBe(false)
    expect(host.querySelector('.rt-arrival-approved')).not.toBeNull()
    await act(async () =>
      host
        .querySelector('.rt-arrival-approved')
        .dispatchEvent(new Event('error')),
    )
    expect(host.querySelector('.rt-arrival-art')).toBeNull()
    expect(host.querySelector('[role="status"]').textContent).toContain(
      'Chargement des arrivées',
    )
  })
})
it('has a fixed approved reduced-motion image, without monochrome filters', () => {
  const css = readFileSync('src/components/RetardsLoadingScreen.css', 'utf8')
  expect(css).toContain('prefers-reduced-motion:reduce')
  expect(css).toContain('.rt-arrival-art .rt-arrival-motion{display:none}')
  expect(css).toContain('.rt-arrival-art .rt-arrival-approved{opacity:1}')
  expect(css).not.toMatch(/filter\s*:/)
})
it('ships the original composition and its lightweight high-resolution texture layers', () => {
  let bytes = 0
  for (const name of [
    'approved',
    'background',
    'upper',
    'front-leg',
    'back-leg',
  ]) {
    const path = `public/images/retards-arrival-${name}.webp`
    expect(readFileSync(path).subarray(8, 12).toString()).toBe('WEBP')
    bytes += statSync(path).size
  }
  expect(bytes).toBeLessThan(900 * 1024)
})
