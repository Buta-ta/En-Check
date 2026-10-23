import { beforeEach, it, expect, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../lib/db', () => ({ db: () => ({ rpc }) }))
import { ecrireReglesFiscales } from '../reglesFiscalesEcriture'
import { remplacerConfigurationFiscale } from '../fiscalTransactions'
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: true, error: null }) })
it('aucune écriture sans snapshot de lecture', async () => {
  await expect(ecrireReglesFiscales('E', { a: 1 })).rejects.toThrow('Rechargez')
  expect(rpc).not.toHaveBeenCalled()
})
it('le snapshot et les seules règles sont transmis au compare-and-set', async () => {
  expect(await ecrireReglesFiscales('E', { a: 1 }, { a: 0 })).toBe(true)
  expect(rpc).toHaveBeenCalledWith('paie_enregistrer_regles', { p_enterprise_id: 'E', p_rules: { a: 1 }, p_expected_rules: { a: 0 } })
})
it('null est un snapshot valide pour une configuration sans règles', async () => {
  await ecrireReglesFiscales('E', {}, null)
  expect(rpc.mock.calls[0][1].p_expected_rules).toBeNull()
})
it('pas de succès mensonger quand le serveur refuse', async () => {
  rpc.mockResolvedValue({ data: false })
  await expect(ecrireReglesFiscales('E', {}, null)).rejects.toThrow('non confirmé')
})
it('le conflit de version demande explicitement un rechargement', async () => {
  rpc.mockResolvedValue({ error: { code: '40001' } })
  await expect(ecrireReglesFiscales('E', {}, null)).rejects.toThrow('changé')
})
it('RPC absente : arrêt sûr, sans suppression locale de secours', async () => {
  rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
  await expect(remplacerConfigurationFiscale('E', { contributions: [], taxBrackets: [], rules: {} })).rejects.toThrow('non installée')
  expect(rpc).toHaveBeenCalledTimes(1)
})
it('aucune entreprise : aucune écriture', async () => {
  expect(await ecrireReglesFiscales(null, {}, null)).toBe(false)
  expect(rpc).not.toHaveBeenCalled()
})
