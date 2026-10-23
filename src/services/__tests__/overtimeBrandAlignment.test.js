import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync('src/pages/HeuresSupplementaires.css', 'utf8')
const bands = readFileSync('src/components/PageCulturalBand.css', 'utf8')
it('limits overtime heading styles to their own content, not PageHeader', () => {
  expect(css).not.toMatch(/\.ot-page h[12]\s*\{/)
  expect(css).toMatch(/\.ot-heading h1,[\s\S]*?font-size: 27px/)
  expect(css).toMatch(/\.ot-panel h2\s*\{\s*font-size: 16px/)
  expect(css).toMatch(/\.ot-page \.afro-header-title\s*\{[\s\S]*?font-size: 20px/)
  expect(css).toContain('font-size: 24px')
  expect(css).toContain('font-size: 17px')
})
it('uses payroll warm surfaces and Segoe UI rather than a separate navy text theme', () => {
  for (const value of ['#FAF6F0', '#FFFFFF', '#231911', '#4E3D2E', '#15110E', '#1D1713', '#F5F2EB']) expect(css).toContain(value)
  expect(css).toContain("font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif")
})
it('uses a thin scalable vector only for the overtime band', () => {
  expect(bands).toContain("url('/images/heures-aso-oke.svg')")
  expect(bands).not.toContain("url('/images/heures-aso-oke.webp')")
  expect(bands).toContain(".ec-cultural-top[data-cultural-motif='aso-oke'] { height: 40px; }")
  expect(bands).toContain(".ec-cultural-top[data-cultural-motif='aso-oke'] { height: 32px; }")
  const svg = readFileSync('public/images/heures-aso-oke.svg', 'utf8')
  expect(svg).toContain('viewBox="0 0 240 40"')
  expect(svg).not.toMatch(/<image|data:image|<filter/)
})
