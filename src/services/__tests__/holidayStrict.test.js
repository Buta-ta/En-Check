import { afterEach, describe, expect, it, vi } from 'vitest'
import HolidayService from '../holidayService'
const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/db', () => ({ db: () => ({ from }) }))
afterEach(() => { vi.restoreAllMocks(); from.mockReset(); HolidayService._cache.clear(); HolidayService._cacheExpiry.clear() })
describe('Fériés stricts pour assistant RH', () => {
  it('propage une panne au lieu d’inventer une liste vide, même avec cache', async () => {
    HolidayService._cache.set('e_2026', [{ date: '2026-01-01' }])
    HolidayService._cacheExpiry.set('e_2026', Date.now() + 60000)
    const builder = { select: () => builder, is: () => builder, order: async () => ({ error: Error('database unavailable') }) }
    from.mockReturnValue(builder)
    await expect(HolidayService.getHolidaysForRange('e', '2026-01-01', '2026-01-05', { strict: true })).rejects.toThrow('database unavailable')
  })
  it('inclut les deux années pour une semaine à cheval sur le nouvel an', async () => {
    const read = vi.spyOn(HolidayService, 'getHolidaysForEnterprise').mockImplementation(async (_, year) => year === 2027 ? [{ date: '2027-01-01' }] : [])
    expect(await HolidayService.getHolidaysForRange('e', '2026-12-28', '2027-01-03', { strict: true })).toEqual([{ date: '2027-01-01' }])
    expect(read).toHaveBeenCalledWith('e', 2026, { strict: true })
    expect(read).toHaveBeenCalledWith('e', 2027, { strict: true })
  })
  it('conserve le comportement historique non strict des autres écrans', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(HolidayService, 'getHolidaysForEnterprise').mockRejectedValue(Error('unavailable'))
    expect(await HolidayService.getHolidaysForRange('e', '2026-01-01', '2026-01-02')).toEqual([])
  })
})
