import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
it('never falls back to cached Supabase authorization or data responses', () => {
  const config = readFileSync('vite.config.js', 'utf8')
  const rule = config.slice(
    config.indexOf('urlPattern:'),
    config.indexOf('urlPattern: /^https:\\/\\/unpkg'),
  )
  expect(rule).toContain("handler: 'NetworkOnly'")
  expect(rule).not.toContain('NetworkFirst')
  expect(config).not.toContain("cacheName: 'api-cache'")
  const registration = readFileSync('src/registerSW.js', 'utf8')
  expect(registration).toContain("caches.delete('api-cache')")
  expect(registration).toContain(
    "addEventListener('controllerchange', retireApiCache)",
  )
})
