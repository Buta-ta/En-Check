import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AssistantAnswer from '../../components/AssistantAnswer'
import { conversationalRequest } from '../assistantConversation'
import { parseRhQuestion, rhPeriod, answerRhQuestion } from '../assistantRh'

describe('Dialogue et nouvelles cartes', () => {
  it('salue localement et ne masque pas une demande après bonjour', () => {
    expect(conversationalRequest('Bonjour !').answer.title).toBe('Bonjour !')
    expect(conversationalRequest('Merci beaucoup').answer.title).toBe('Avec plaisir !')
    const request = conversationalRequest('Bonjour, montre-moi les pointages cette semaine')
    expect(request.query).toBe('montre-moi les pointages cette semaine')
    expect(parseRhQuestion(request.query)).toEqual({ intent: 'pointages', period: 'cette semaine' })
    expect(conversationalRequest('BonjourDupont').query).toBe('BonjourDupont')
    expect(parseRhQuestion('les pointages de Sara cette semaine')).toEqual({ unsupported: true })
  })
  it('distingue semaine courante, précédente et sept derniers jours', () => {
    const now = new Date('2026-10-19T10:00:00Z')
    expect(rhPeriod('cette semaine','Africa/Porto-Novo',now)).toEqual({from:'2026-10-19',to:'2026-10-19'})
    expect(rhPeriod('les 7 derniers jours','Africa/Porto-Novo',now)).toEqual({from:'2026-10-13',to:'2026-10-19'})
    expect(rhPeriod('la semaine precedente','Africa/Porto-Novo',now)).toEqual({from:'2026-10-12',to:'2026-10-18'})
  })
  it('replie les détails mais laisse un avertissement important visible', () => {
    const html = renderToStaticMarkup(<AssistantAnswer answer={{title:'Pointages',text:'Une entrée.',warning:'Résultat partiel',source:'attendances',notes:['Détail technique'],rows:[{id:'1',label:'Test Fictif',detail:'08:02',badge:'Entrée'}]}} onChoice={()=>{}} onNavigate={()=>{}} />)
    expect(html).toContain('<details class="ec-dialogue-sources">')
    expect(html).not.toContain('<details open')
    expect(html.indexOf('Résultat partiel')).toBeLessThan(html.indexOf('<details'))
    expect(html).toContain('ec-dialogue-avatar')
    expect(html).toContain('08:02')
    expect(html).not.toContain('undefined')
  })
  it('affiche une vraie heure locale sans la propriété heuresTexte inexistante', async () => {
    let selected
    const builder = { select:()=>builder, eq:()=>builder, gte:()=>builder, lt:()=>builder, order:()=>builder,
      maybeSingle:async()=>({data:{name:'Démo',timezone:'Africa/Porto-Novo'}}),
      limit:async()=>({count:1,data:[{id:'one',check_time:'2026-10-19T07:02:00Z',check_type:'in',employees:{first_name:'Test',last_name:'Fictif'}}]}) }
    const client={auth:{getUser:async()=>({data:{user:{id:'user'}}})},rpc:async()=>({data:true}),from: name=>{selected=name;return builder}}
    const answer=await answerRhQuestion({query:'Pointages cette semaine',admin:{enterprise_id:'demo'},client,now:new Date('2026-10-19T10:00:00Z')})
    expect(selected).toBe('attendances')
    expect(answer.rows[0].detail).toContain('08:02')
    expect(answer.rows[0].badge).toBe('Entrée')
    expect(answer.periodHint).toContain('Nous sommes lundi')
    expect(JSON.stringify(answer)).not.toContain('undefined')
  })
})
