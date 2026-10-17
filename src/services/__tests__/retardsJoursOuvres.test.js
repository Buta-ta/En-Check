import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
vi.mock('../../lib/supabase', () => ({ supabase: {}, supabaseEmployee: {} }))
import { __internal, compterRetardsDuJour } from '../hoursCalculator'
import { setActiveTimezone, resetActiveTimezone } from '../../utils/timezoneUtils'
const { resolveScheduleLikeRetards, computeRetardsAlignedRetardsJSX } = __internal
const general = { enterprise_id: 'ent', start_time: '08:00', late_tolerance_minutes: 15, work_days: [1,2,3,4,5] }
const perso = { employee_id: 'emp', use_custom_hours: true, custom_start_time: '09:00', custom_work_days: [1,2,3,4,5] }
const punch = (day, time='10:00', type='in') => ({ employee_id:'emp', enterprise_id:'ent',check_type:type, check_time:`${day}T${time}:00+01:00` })
const calc = (day, p=perso, g=general, time='10:00') => computeRetardsAlignedRetardsJSX({ attendances:[punch(day,time)], scheduleResolved:resolveScheduleLikeRetards(p,g),startDate:day,endDate:day })
describe('Retard applicable uniquement un jour de service prévu', () => {
 beforeEach(() => setActiveTimezone('Africa/Porto-Novo'))
 afterEach(() => resetActiveTimezone())
 it('samedi hors planning personnel et général : aucun retard', () => {
   expect(calc('2026-10-17').count).toBe(0)
   expect(compterRetardsDuJour([punch('2026-10-17')],[perso],[general],'2026-10-17')).toBe(0)
 })
 it('ne retombe pas sur un samedi travaillé général si le personnel est au repos', () => {
   expect(calc('2026-10-17',perso,{...general,work_days:[1,2,3,4,5,6]}).count).toBe(0)
 })
 it('vendredi travaillé : le vrai retard est conservé', () => {
   expect(calc('2026-10-16')).toMatchObject({count:1,total_minutes:60})
 })
 it('samedi explicitement prévu par une affectation personnelle : retard applicable', () => {
   expect(calc('2026-10-17',{...perso,custom_work_days:[6]}).count).toBe(1)
 })
 it('grille liée prioritaire et liste vide conservée', () => {
   expect(calc('2026-10-17',{schedule_id:'s',work_schedules:{...general,work_days:[]}}).count).toBe(0)
 })
 it('sans personnel, le général lundi-vendredi ne juge pas le samedi', () => {
   expect(calc('2026-10-17',null).count).toBe(0)
 })
 it('aucune grille : pas de 08:00 inventé ni de planning d’une autre entreprise', () => {
   expect(compterRetardsDuJour([punch('2026-10-16')],[],[{...general,enterprise_id:'autre'}],'2026-10-16')).toBe(0)
 })
 it('affectation datée du samedi prioritaire sur celle terminée vendredi', () => {
   const exception={...perso,id:'exception',valide_du:'2026-10-17',valide_au:'2026-10-17',custom_work_days:[6]}
   const ancienne={...perso,id:'ancienne',valide_du:'2026-01-01',valide_au:'2026-10-16'}
   expect(compterRetardsDuJour([punch('2026-10-17')],[exception,ancienne],[general],'2026-10-17')).toBe(1)
 })
 it('une sortie ne crée jamais un retard', () => {
   expect(compterRetardsDuJour([punch('2026-10-16','18:00','out')],[perso],[general],'2026-10-16')).toBe(0)
 })
 it('tolérance zéro respectée', () => {
   expect(calc('2026-10-16',{...perso,custom_late_tolerance_minutes:0},general,'09:01').count).toBe(1)
 })
 it('samedi 00:30 rattaché au service du vendredi par sa bascule : retard jugé sur vendredi', () => {
   const night={...perso,custom_start_time:'22:00',custom_bascule:'06:00'}
   const scheduleResolved=resolveScheduleLikeRetards(night,general)
   const result=computeRetardsAlignedRetardsJSX({attendances:[punch('2026-10-17','00:30')],scheduleResolved,startDate:'2026-10-16',endDate:'2026-10-16'})
   expect(result).toMatchObject({count:1,total_minutes:150})
 })
 it('un service commencé vendredi ne compte pas à nouveau comme retard samedi', () => {
   const night={...perso,custom_start_time:'22:00',custom_bascule:'06:00'}
   expect(compterRetardsDuJour([punch('2026-10-16','22:00'),punch('2026-10-17','00:30')],[night],[general],'2026-10-17')).toBe(0)
 })
})
