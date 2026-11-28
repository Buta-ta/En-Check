// src/components/__tests__/alerteHebdoCardSemaines.test.jsx
// ═══════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN NE DOIT PAS PRÊTER À UNE SEMAINE LA RÈGLE D'UNE AUTRE
//
//  Depuis la résolution par semaine, deux semaines affichées côte à côte
//  peuvent avoir des seuils DIFFÉRENTS. L'ancien rendu lisait `plafond.seuil`,
//  une valeur globale : la semaine du 5 octobre s'affichait « 46 h pour un
//  seuil de 45 h — dépassement de 6 h », alors que son seuil était 40 h.
//  Le chiffre du dépassement contredisait le seuil annoncé, de 5 h.
//
//  ⚠️ Valeurs FICTIVES (40 h, 45 h, 46 h). Aucune n'est une règle légale.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AlerteHebdoCard from '../AlerteHebdoCard'

const plafondAvec = (semaines, extra = {}) => ({
  disponible: true,
  seuil: 45,
  seuil_majeur: 48,
  source: 'entreprise',
  semaines,
  ...extra,
})

const semaine = (debut, fin, heures, seuil, depassement, source = 'entreprise') => ({
  debut, fin, heures,
  depasse: true,
  depassement_heures: depassement,
  seuil_applique: seuil,
  seuil_source: source,
})

describe('AlerteHebdoCard — un seuil par semaine', () => {
  it('chaque semaine affiche LE SIEN, pas celui de la dernière règle', () => {
    const html = renderToStaticMarkup(
      <AlerteHebdoCard plafond={plafondAvec([
        semaine('2026-10-05', '2026-10-11', 46, 40, 6),
        semaine('2026-10-12', '2026-10-18', 46, 45, 1),
      ])} />,
    )

    //  Le seuil annoncé et le dépassement chiffré parlent du MÊME barème.
    expect(html).toContain('46 h pour un seuil de 40 h — dépassement de 6 h')
    expect(html).toContain('46 h pour un seuil de 45 h — dépassement de 1 h')
  })

  it('le dépassement affiché est bien heures moins seuil, semaine par semaine', () => {
    const html = renderToStaticMarkup(
      <AlerteHebdoCard plafond={plafondAvec([
        semaine('2026-10-05', '2026-10-11', 50, 42, 8),
      ])} />,
    )
    expect(html).toContain('50 h pour un seuil de 42 h — dépassement de 8 h')
  })

  it('sans seuil par semaine (ancien format), on retombe sur le seuil global', () => {
    const html = renderToStaticMarkup(
      <AlerteHebdoCard plafond={plafondAvec([
        { debut: '2026-10-05', fin: '2026-10-11', heures: 46, depasse: true, depassement_heures: 1 },
      ])} />,
    )
    expect(html).toContain('46 h pour un seuil de 45 h')
  })

  it('une origine par semaine : on ne nomme pas une seule règle pour toutes', () => {
    const html = renderToStaticMarkup(
      <AlerteHebdoCard plafond={plafondAvec([
        semaine('2026-10-05', '2026-10-11', 40, 38, 2, 'employe'),
        semaine('2026-10-12', '2026-10-18', 46, 45, 1, 'entreprise'),
      ])} />,
    )
    //  Deux origines différentes : le bandeau le dit, sans en privilégier une.
    expect(html).toContain('origine différente')
  })

  it('une seule origine : elle est nommée normalement', () => {
    const html = renderToStaticMarkup(
      <AlerteHebdoCard plafond={plafondAvec([
        semaine('2026-10-05', '2026-10-11', 46, 40, 6, 'entreprise'),
      ])} />,
    )
    expect(html).toContain('seuil hebdomadaire d’entreprise')
  })

  it('aucune semaine dépassée : la carte ne dit rien', () => {
    const html = renderToStaticMarkup(<AlerteHebdoCard plafond={plafondAvec([])} />)
    expect(html).toBe('')
  })
})
