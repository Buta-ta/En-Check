// src/services/__tests__/alerteHebdoActiveeSql.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🗄️ LA COLONNE « M'ALERTER » (exécutée, pas seulement relue)
//
// La migration est jouée dans un vrai Postgres (PGlite). On vérifie :
//   1. la colonne naît à `false` — aucune entreprise n'est alertée par héritage ;
//   2. les lignes existantes prennent `false`, sans exception ;
//   3. la migration est rejouable (idempotente) ;
//   4. sur une base où la table n'existe pas, elle ne casse rien.
//
// ⚠️ `overtime_settings` n'a aucune migration de création dans ce dépôt : le
// test la crée donc à la main, avec le minimum de colonnes utiles. Il ne
// prétend pas décrire la table réelle, seulement vérifier l'effet de la
// migration sur une table qui a la bonne forme.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIGRATION = 'supabase/migrations/20261123000001_alerte_hebdo_activee.sql'
const sql = () => readFileSync(MIGRATION, 'utf8')

async function baseAvecTable() {
  const db = new PGlite()
  await db.exec(`
    create table overtime_settings (
      id uuid primary key default gen_random_uuid(),
      enterprise_id uuid not null,
      weekly_threshold numeric,
      weekly_threshold_major numeric
    );
    insert into overtime_settings (enterprise_id, weekly_threshold)
      values ('11111111-1111-4111-8111-111111111111', 45),
             ('22222222-2222-4222-8222-222222222222', 48),
             ('33333333-3333-4333-8333-333333333333', null);
  `)
  return db
}

describe('Migration : case d’alerte hebdomadaire', () => {
  it('naît à false et n’alerte donc aucune entreprise existante', async () => {
    const db = await baseAvecTable()
    try {
      await db.exec(sql())

      const { rows } = await db.query(
        'select alerte_hebdo_activee from overtime_settings order by enterprise_id',
      )
      expect(rows).toEqual([
        { alerte_hebdo_activee: false },
        { alerte_hebdo_activee: false },
        { alerte_hebdo_activee: false },
      ])
    } finally {
      await db.close()
    }
  })

  it('est rejouable sans erreur et sans perdre une activation déjà posée', async () => {
    const db = await baseAvecTable()
    try {
      await db.exec(sql())
      await db.exec(sql())

      await db.exec(
        "update overtime_settings set alerte_hebdo_activee = true where weekly_threshold = 45",
      )
      await db.exec(sql())

      const { rows } = await db.query(
        "select alerte_hebdo_activee from overtime_settings where weekly_threshold = 45",
      )
      expect(rows).toEqual([{ alerte_hebdo_activee: true }])
    } finally {
      await db.close()
    }
  })

  it('refuse le vide : la colonne est NOT NULL', async () => {
    const db = await baseAvecTable()
    try {
      await db.exec(sql())
      await expect(
        db.exec('update overtime_settings set alerte_hebdo_activee = null'),
      ).rejects.toThrow(/null/i)
    } finally {
      await db.close()
    }
  })

  it('ne casse rien sur une base où la table n’existe pas encore', async () => {
    const db = new PGlite()
    try {
      await db.exec('select 1') // base vierge
      await expect(db.exec(sql())).resolves.not.toThrow()
    } finally {
      await db.close()
    }
  })
})
