// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import AbsencesCulturalBand from '../../components/AbsencesCulturalBand'
import AbsenceFormulaire from '../../components/AbsenceFormulaire'
import AbsenceTiroir from '../../components/AbsenceTiroir'
const css = readFileSync('src/pages/AbsencesAfroTech.css','utf8')
let root, host
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
it('bandeaux décoratifs distincts en haut, en bas et dans les tiroirs', async () => {
  await act(async () => root.render(<><AbsencesCulturalBand/><AbsencesCulturalBand position="bottom"/><AbsencesCulturalBand drawer/></>))
  expect(host.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3)
  expect(host.querySelector('.abs-ndebele-bottom')).not.toBeNull()
  expect(host.querySelector('.abs-ndebele-drawer')).not.toBeNull()
  expect(css).toContain("url('/images/absences-ndebele.webp')")
  expect(css).toContain('background-size: auto 100%')
})
for (const darkMode of [false,true]) it(`les deux tiroirs portent leur thème et deux bandeaux : sombre=${darkMode}`, async () => {
  await act(async () => root.render(<AbsenceFormulaire ouvert darkMode={darkMode}/>))
  expect(host.querySelector('aside').dataset.theme).toBe(darkMode?'dark':'light')
  expect(host.querySelectorAll('.abs-ndebele-band')).toHaveLength(2)
  await act(async () => root.render(<AbsenceTiroir darkMode={darkMode} absence={{id:'a',reason:'conge',status:'approuve',start_date:'2026-10-01',end_date:'2026-10-02',created_at:'2026-10-01T12:00:00Z'}}/>))
  expect(host.querySelector('aside').dataset.theme).toBe(darkMode?'dark':'light')
  expect(host.querySelectorAll('.abs-ndebele-band')).toHaveLength(2)
})
const lum = hex => hex.match(/[0-9a-f]{2}/gi).map(h=>parseInt(h,16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4).reduce((a,c,i)=>a+c*[0.2126,0.7152,0.0722][i],0)
const contrast = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05)
it('textes, accents et onglets actifs dépassent 4,5:1 sur leur surface dans les deux thèmes', () => {
  const blocks = [css.match(/\.abs-page, \.abs-drawer-theme \{([\s\S]*?)\}/)[1], css.match(/\.abs-page\[data-theme='light'\], \.abs-drawer-theme\[data-theme='light'\] \{([\s\S]*?)\}/)[1]]
  for (const block of blocks) {
    const token = name => block.match(new RegExp(`--abs-${name}: (#[a-fA-F0-9]{6});`))[1]
    for (const name of ['text','text-soft','text-faint','amber','emerald','coral','indigo','violet']) expect(contrast(token(name),token('bg-elevated')),name).toBeGreaterThanOrEqual(4.5)
  }
})
it('les panneaux ne gardent aucun fond espresso fixé dans le mode clair', () => {
  for (const file of ['src/pages/Absences.jsx','src/components/AbsencesMotifsManager.jsx']) {
    expect(readFileSync(file,'utf8')).not.toMatch(/rgba\(29,\s*23,\s*19,\s*0?\.(?:8[025]?|6)\)/)
  }
  const page=readFileSync('src/pages/Absences.jsx','utf8')
  expect(page).toContain("aria-pressed={viewMode === 'calendar'}")
  expect(page).toContain('repeat(7,minmax(0,1fr))')
  expect(css).toContain("[data-testid='abs-soldes-liste'] { overflow-x: auto")
})
it('les demandes peuvent réorganiser leurs actions sans écraser l’identité', () => {
  const source=readFileSync('src/components/DemandeCongeCard.jsx','utf8')
  expect(source).toContain("flex: '1 1 190px'")
  expect(source).toContain('abs-request-actions')
  expect(css).toContain('.abs-request-actions { flex-basis: 100%')
})
