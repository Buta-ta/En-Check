import { describe, it, expect, vi, afterEach } from 'vitest'
vi.mock('../../lib/supabase', () => ({ supabase: {}, supabaseEmployee: {} }))
import { findMissingExitEntries } from '../missingExits'
import { loadNotificationRetardContext } from '../notificationRetardContext'
import { resoudrePointagesJournee } from '../hoursCalculator'
import { SEUILS_PAR_DEFAUT } from '../seuilsPointage'
import { setActiveTimezone, resetActiveTimezone } from '../../utils/timezoneUtils'

afterEach(() => resetActiveTimezone())
const punch = (id, type, time, employee='a', enterprise='one') => ({ id, check_type:type, check_time:`2026-10-19T${time}+01:00`, employee_id:employee, enterprise_id:enterprise })
function clientFor(tables, failed) {
 const calls=[]
 return { calls, from(name) {
   calls.push(name)
   let rows=[...(tables[name] || [])]
   const q={select:()=>q,order:()=>q,
    in:(key,values)=>{rows=rows.filter(row=>values.includes(row[key]));return q},
    eq:(key,value)=>{rows=rows.filter(row=>row[key]===value);return q},
    then:resolve=>Promise.resolve({data:rows,error:failed===name?new Error('failed'):null}).then(resolve)}
   return q
 } }
}
describe('Cohérence présence / sorties / alertes', () => {
 it('seuil configuré 12h : pas d’alerte après seulement 8h, seuil inclus', async () => {
   const rows=[punch('i','in','10:00:00')]
   const loadThresholds=vi.fn(async()=>({oubliSortieHeures:12}))
   expect(await findMissingExitEntries(rows,{now:Date.parse('2026-10-19T19:00:00+01:00'),loadThresholds})).toHaveLength(0)
   expect(await findMissingExitEntries(rows,{now:Date.parse('2026-10-19T22:00:00+01:00'),loadThresholds})).toHaveLength(1)
 })
 it('chaque entreprise conserve son seuil ; une sortie ferme le candidat brut',async()=>{
   const rows=[punch('i','in','10:00:00'),punch('j','in','10:00:00','b','two'),punch('k','in','08:00:00','c'),punch('o','out','09:00:00','c')]
   const result=await findMissingExitEntries(rows,{now:Date.parse('2026-10-19T20:00:00+01:00'),loadThresholds:async id=>({oubliSortieHeures:id==='one'?12:9})})
   expect(result.map(d=>d.row.employee_id)).toEqual(['b'])
 })
 it('aucun calcul sur des seuils invalides ni badge sans périmètre',async()=>{
   expect(await findMissingExitEntries([punch('i','in','10:00:00')],{loadThresholds:async()=>({oubliSortieHeures:0})})).toHaveLength(0)
 })
 it('modules désactivés : aucun planning lu, aucune personne évaluable',async()=>{
   const client=clientFor({enterprises:[{id:'one',module_planning:false,module_retards:false}]})
   const context=await loadNotificationRetardContext(client,[{id:'a',enterprise_id:'one'}])
   expect(context.employees).toEqual([]);expect(client.calls).toEqual(['enterprises'])
 })
 it('module retard désactivé suffit à exclure une entreprise',async()=>{
   const client=clientFor({enterprises:[{id:'one',module_planning:true,module_retards:false}]})
   expect((await loadNotificationRetardContext(client,[{id:'a',enterprise_id:'one'}])).employees).toEqual([])
 })
 it('affectations et grilles inactives exclues ; pas de grille liée étrangère',async()=>{
   const client=clientFor({enterprises:[{id:'one',module_planning:true,module_retards:true,timezone:'Africa/Douala'}],
     employee_schedules:[{id:'1',employee_id:'a',is_active:false,schedule_id:'old'},{id:'2',employee_id:'b',is_active:true,schedule_id:'old'},{id:'3',employee_id:'c',is_active:true,schedule_id:'foreign'}],
     work_schedules:[{id:'old',enterprise_id:'one',is_active:false,is_default:true},{id:'foreign',enterprise_id:'other',is_active:true,is_default:true}]})
   const result=await loadNotificationRetardContext(client,['a','b','c'].map(id=>({id,enterprise_id:'one'})))
   expect(result.employeeSchedulesMap.a).toBeUndefined()
   expect(result.employeeSchedulesMap.b.work_schedule).toBeNull()
   expect(result.employeeSchedulesMap.c.work_schedule).toBeNull()
   expect(result.defaultScheduleByEnterprise).toEqual({})
   expect(result.timezones.one).toBe('Africa/Douala')
 })
 it('planning actif conservé et erreurs de lecture non assimilées à des résultats',async()=>{
   const tables={enterprises:[{id:'one',module_planning:true,module_retards:true}],employee_schedules:[{id:'1',employee_id:'a',is_active:true,schedule_id:'ok'}],work_schedules:[{id:'ok',enterprise_id:'one',is_active:true,is_default:true,late_tolerance_minutes:0}]}
   const candidates=[{id:'a',enterprise_id:'one'}]
   const result=await loadNotificationRetardContext(clientFor(tables),candidates)
   expect(result.employeeSchedulesMap.a.work_schedule.id).toBe('ok')
   expect(result.defaultScheduleByEnterprise.one.late_tolerance_minutes).toBe(0)
   await expect(loadNotificationRetardContext(clientFor(tables,'employee_schedules'),candidates)).rejects.toThrow('failed')
 })
 it('signale le badge de sortie filtré sans changer les badges ni les heures',()=>{
   setActiveTimezone('Africa/Douala')
   const rows=[punch('i','in','14:35:53'),punch('o','out','14:36:05')]
   const before=JSON.stringify(rows)
   const result=resoudrePointagesJournee(rows,'2026-10-19',{enableAutoClose:false,seuils:SEUILS_PAR_DEFAUT,referenceNow:'2026-10-19T20:00:00+01:00'})
   expect(result.lastOut).toBeNull();expect(result.totalSecondes).toBe(0)
   expect(result.sortiesNonRetenues).toEqual([{id:'o',check_time:rows[1].check_time,entry_id:'i',ecartSecondes:12,seuilSecondes:60,raison:'anti_rebond'}])
   expect(result.attendances.map(a=>a.id)).toContain('o')
   expect(JSON.stringify(rows)).toBe(before)
   const corrected=resoudrePointagesJournee([rows[0],{...rows[1],modifie_le:'2026-10-19T19:00:00Z'}],'2026-10-19',{enableAutoClose:false,seuils:SEUILS_PAR_DEFAUT})
   expect(corrected.sortiesNonRetenues).toEqual([]);expect(corrected.lastOut.id).toBe('o')
 })
 it('ne confond pas deux entrées consécutives avec une sortie filtrée',()=>{
   setActiveTimezone('Africa/Douala')
   const result=resoudrePointagesJournee([punch('i','in','14:35:53'),punch('i2','in','14:36:05')],'2026-10-19',{enableAutoClose:false})
   expect(result.sortiesNonRetenues).toEqual([])
 })
})
