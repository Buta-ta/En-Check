import { it, expect } from 'vitest'
import {
  entreprisesDuCompte,
  entreprisesCouvertes,
  etatAcces,
  libelleEtatAcces,
} from '../../utils/adminsPresentation'
it('summarizes active links without counting duplicates or inactive extra links', () => {
  const row = {
    enterprise_id: 'a',
    role: 'admin',
    admin_entreprises: [
      { enterprise_id: 'a', is_active: true },
      { enterprise_id: 'b', is_active: true },
      { enterprise_id: 'c', is_active: false },
    ],
  }
  expect(entreprisesDuCompte(row)).toEqual(['a', 'b'])
  expect(entreprisesCouvertes([row, { ...row, role: 'super_admin' }])).toBe(2)
})
it('does not label a disabled linked account as active', () => {
  expect(etatAcces({ user_id: 'u', is_active: false })).toBe('inactif')
  expect(libelleEtatAcces('inactif')).toBe('Compte désactivé')
  expect(
    etatAcces({ user_id: 'u', is_active: true, locked_until: '2099-01-01' }),
  ).toBe('verrouille')
})
