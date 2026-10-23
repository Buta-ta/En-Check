// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import EmployeeProfilePhoto from '../../components/EmployeeProfilePhoto'
import RetardsLoadingScreen from '../../components/RetardsLoadingScreen'
import { enrichRetardPhotos } from '../retardsPhotos'

it('shows stored photos, falls back on failure, and resets for a new URL or employee', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const person = {
    id: 'a',
    first_name: 'Amina',
    last_name: 'D.',
    photo_url: '/photo-a.jpg',
  }
  try {
    await act(async () =>
      root.render(<EmployeeProfilePhoto employee={person} />),
    )
    expect(host.querySelector('img').getAttribute('src')).toBe('/photo-a.jpg')
    await act(async () =>
      host.querySelector('img').dispatchEvent(new Event('error')),
    )
    expect(host.querySelector('img')).toBeNull()
    expect(host.textContent).toBe('AD')
    await act(async () =>
      root.render(
        <EmployeeProfilePhoto
          employee={{ ...person, photo_url: '/photo-b.jpg' }}
        />,
      ),
    )
    expect(host.querySelector('img').getAttribute('src')).toBe('/photo-b.jpg')
    await act(async () =>
      root.render(
        <EmployeeProfilePhoto
          employee={{ id: 'b', first_name: 'Koffi', last_name: 'A.' }}
        />,
      ),
    )
    expect(host.querySelector('img')).toBeNull()
    expect(host.textContent).toBe('KA')
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
function clientFor(data, error = null) {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    eq: vi.fn(() => query),
    then: (resolve, reject) =>
      Promise.resolve({ data, error }).then(resolve, reject),
  }
  return { from: vi.fn(() => query), query }
}
const rows = [
  { employee: { id: 'a', first_name: 'Amina' }, retardMinutes: 123 },
  { employee: { id: 'a' }, retardMinutes: 7 },
]
const sql = [{ employe_id: 'a', enterprise_id: 'ent' }]
it('enriches only the current SQL employees, deduplicated and company-scoped, without altering time data', async () => {
  const client = clientFor([
    { id: 'a', enterprise_id: 'ent', photo_url: '/avatar.jpg' },
  ])
  const output = await enrichRetardPhotos(rows, sql, client, 'ent')
  expect(client.query.select).toHaveBeenCalledWith('id,enterprise_id,photo_url')
  expect(client.query.in).toHaveBeenCalledWith('id', ['a'])
  expect(client.query.eq).toHaveBeenCalledWith('enterprise_id', 'ent')
  expect(output[0].employee.photo_url).toBe('/avatar.jpg')
  expect(output[1].employee.photo_url).toBe('/avatar.jpg')
  expect(output[0].retardMinutes).toBe(123)
  expect(rows[0].employee.photo_url).toBeUndefined()
})
it('ignores mismatched companies and retains rows when profiles are unavailable', async () => {
  for (const client of [
    clientFor([{ id: 'a', enterprise_id: 'other', photo_url: '/wrong.jpg' }]),
    clientFor(null, new Error('offline')),
    {
      from: () => {
        throw new Error('network')
      },
    },
  ]) {
    const output = await enrichRetardPhotos(rows, sql, client, 'all')
    expect(output).toHaveLength(2)
    expect(output[0].employee.photo_url).toBeNull()
  }
})
it('does not query for an empty result and splits large employee sets into bounded batches', async () => {
  const client = clientFor([])
  await enrichRetardPhotos([], [], client, 'all')
  expect(client.from).not.toHaveBeenCalled()
  await enrichRetardPhotos(
    Array.from({ length: 201 }, (_, i) => ({ employee: { id: String(i) } })),
    [],
    client,
    'all',
  )
  expect(client.from).toHaveBeenCalledTimes(3)
  expect(client.query.in.mock.calls.map((call) => call[1].length)).toEqual([
    100, 100, 1,
  ])
})
it('uses the approved artwork, not a schematic runner or fictitious result', () => {
  const html = renderToStaticMarkup(<RetardsLoadingScreen />)
  expect(html).toContain('role="status"')
  expect(html).toContain('Chargement des arrivées')
  expect(html).toContain('retards-arrival-approved.webp')
  expect(html).toContain('data-artwork="approved-illustration"')
  expect(html).toContain('aria-hidden="true"')
  expect(html).not.toContain('progressbar')
  expect(html).not.toContain('<svg')
  const css = readFileSync('src/components/RetardsLoadingScreen.css', 'utf8')
  expect(css).toContain('prefers-reduced-motion:reduce')
  expect(css).toContain('animation:none!important')
})
