import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import IgnoredExitNotice from '../../components/IgnoredExitNotice'
it('explique la sortie filtrée sans affirmer une absence de badge', () => {
 const html=renderToStaticMarkup(<IgnoredExitNotice exits={[{id:'x',check_time:'2026-10-19T13:36:05Z',ecartSecondes:11.709,seuilSecondes:60}]} />)
 expect(html).toContain('Sortie enregistrée')
 expect(html).toContain('12 s après')
 expect(html).toContain('seuil 60 s')
 expect(html).toContain('le badge est conservé')
 expect(html).not.toContain('aucune sortie')
 expect(renderToStaticMarkup(<IgnoredExitNotice />)).toBe('')
})
