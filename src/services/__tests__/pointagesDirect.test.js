// ═══════════════════════════════════════════════════════════
// 📡 LE DIRECT DES POINTAGES — CE QUI ÉTAIT CASSÉ, ET CE QUI
//    L'EMPÊCHE DE RECOMMENCER
//
// Le 24/10, un pointage fait dans l'app pointage n'apparaissait
// dans l'admin qu'après un rechargement complet. La cause n'était
// pas l'écriture (mesurée à 1,4 s) mais l'écoute :
//
//   · l'écran ouvrait UN canal pour DEUX tables ;
//   · `encheck_pauses` n'était pas dans la publication temps réel ;
//   · l'abonnement se négocie en bloc → le canal ENTIER était
//     refusé, y compris pour `attendances`, qui était publiée ;
//   · `.subscribe()` était appelé sans écouter son statut → échec
//     totalement silencieux. L'écran se croyait en direct.
//
// Les tests ci-dessous ne rejouent pas un vrai WebSocket (Vitest
// tourne ici sans navigateur). Ils tiennent les deux bouts :
// les règles pures, et le câblage réel dans la page.
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  DELAIS_RECONNEXION,
  PERIODE_SONDAGE_MS,
  TABLES_SUIVIES,
  aChange,
  agregerEtat,
  delaiReconnexion,
  doitSonder,
  etatAbonnement,
  presenterEtat,
} from '../../utils/directPointages'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const page = lire('src/pages/Pointages.jsx')
const hook = lire('src/hooks/useDirectPointages.js')

// ── 1. Les règles pures ─────────────────────────────────────────────

it('1. on retente de plus en plus espacé, sans jamais renoncer', () => {
  expect(delaiReconnexion(0)).toBe(2000)
  expect(delaiReconnexion(1)).toBe(5000)
  expect(delaiReconnexion(2)).toBe(15000)
  // au-delà, on ne monte plus : un écran resté ouvert des heures
  // doit continuer d'essayer, pas s'enterrer
  expect(delaiReconnexion(3)).toBe(30000)
  expect(delaiReconnexion(99)).toBe(30000)
  expect(delaiReconnexion(-5)).toBe(2000)
  expect(DELAIS_RECONNEXION).toHaveLength(4)
})

it('2. seul « SUBSCRIBED » veut dire direct', () => {
  expect(etatAbonnement('SUBSCRIBED')).toBe('direct')
  // CHANNEL_ERROR est exactement le refus silencieux d'une table
  // non publiée : c'est l'état qui ne devait jamais passer inaperçu
  expect(etatAbonnement('CHANNEL_ERROR')).toBe('fige')
  expect(etatAbonnement('TIMED_OUT')).toBe('fige')
  expect(etatAbonnement('CLOSED')).toBe('fige')
  expect(etatAbonnement('JOINING')).toBe('connexion')
  expect(etatAbonnement(undefined)).toBe('connexion')
})

it('3. l’écran affiche le PIRE de ses abonnements, pas la moyenne', () => {
  // deux tables, une seule muette → l'écran est figé. Afficher
  // « direct » ici, c'est le mensonge qui a coûté plusieurs jours.
  expect(agregerEtat({ attendances: 'direct', encheck_pauses: 'fige' })).toBe('fige')
  expect(agregerEtat({ attendances: 'direct', encheck_pauses: 'connexion' })).toBe('connexion')
  expect(agregerEtat({ attendances: 'direct', encheck_pauses: 'direct' })).toBe('direct')
  expect(agregerEtat({})).toBe('inactif')
})

it('4. le témoin dit la vérité, et dit quoi faire', () => {
  expect(presenterEtat('direct').libelle).toBe('Direct')
  expect(presenterEtat('connexion').libelle).toBe('Connexion…')
  expect(presenterEtat('fige').libelle).toBe('Figé')
  expect(presenterEtat('inactif').libelle).toBe('Inactif')
  // figé : on explique le filet de sécurité, sinon « figé » ne
  // veut rien dire pour un manager
  expect(presenterEtat('fige').aide).toMatch(/30 secondes/)
  expect(presenterEtat('fige').aide).toMatch(/retour sur cet onglet/)
  expect(presenterEtat('fige').ton).toBe('rouge')
})

it('5. le filet ne sonde jamais un onglet caché', () => {
  expect(doitSonder('visible')).toBe(true)
  expect(doitSonder('hidden')).toBe(false)
  expect(doitSonder(undefined)).toBe(false)
  expect(PERIODE_SONDAGE_MS).toBe(30000)
})

it('6. on ne recharge que si quelque chose a bougé', () => {
  const a = { attendances: '2026-10-24T09:33:20Z', pauses: '2026-10-24T09:00:00Z' }
  expect(aChange(a, { ...a })).toBe(false)
  expect(aChange(a, { ...a, attendances: '2026-10-24T10:00:00Z' })).toBe(true)
  expect(aChange(a, { ...a, pauses: '2026-10-24T10:00:00Z' })).toBe(true)
  // première sonde : on ne sait pas encore, donc on recharge
  expect(aChange(null, a)).toBe(true)
})

// ── 2. Le câblage dans la page ──────────────────────────────────────

it('7. un canal PAR table — c’est la cause du blocage en bloc', () => {
  expect(TABLES_SUIVIES).toEqual(['attendances', 'encheck_pauses'])
  expect(hook).toContain('TABLES_SUIVIES.forEach(abonner)')
  // l'ancienne forme : deux `.on()` sur un seul canal
  expect(page).not.toMatch(/\.channel\(`pointages_live_/)
  expect(page).toContain('useDirectPointages({')
})

it('8. l’abonnement écoute enfin son statut', () => {
  expect(hook).toContain('.subscribe((statut) => {')
  expect(hook).toContain('etatAbonnement(statut)')
  // et l'ancienne page, elle, ne s'abonnait à rien de visible
  expect(page).not.toContain(".on(\n        'postgres_changes'")
})

it('9. on se reconnecte tout seul', () => {
  expect(hook).toContain('delaiReconnexion(tentative)')
  expect(hook).toContain('setTentative((n) => n + 1)')
  // retour de veille, retour du réseau
  expect(hook).toContain("document.addEventListener('visibilitychange'")
  expect(hook).toContain("window.addEventListener('online'")
  // et le compteur retombe à zéro après une reconnexion réussie
  expect(hook).toContain("if (agregerEtat(etats) === 'direct' && tentative !== 0) setTentative(0)")
})

it('10. le canal porte un suffixe unique et se nettoie', () => {
  // réutiliser le même nom juste après une coupure fait échouer la
  // reconnexion : le serveur n'a pas encore libéré l'ancien
  expect(hook).toContain('Math.random().toString(36)')
  expect(hook).toContain('supabase.removeChannel(canal)')
})

it('11. la page recharge au retour sur l’onglet', () => {
  expect(page).toContain("document.addEventListener('visibilitychange'")
  expect(page).toContain("if (document.visibilityState === 'visible') recharger()")
})

it('12. le filet de sécurité sonde des horodatages, pas toute la table', () => {
  expect(page).toContain('PERIODE_SONDAGE_MS')
  expect(page).toMatch(/from\('attendances'\)\.select\('created_at'\)/)
  expect(page).toMatch(/from\('encheck_pauses'\)\.select\('updated_at'\)/)
  expect(page).toContain('.limit(1)')
  expect(page).toContain('if (aChange(empreinteRef.current, maintenant))')
})

it('13. un événement qui tombe pendant un chargement n’est plus jeté', () => {
  // deux badges rapprochés sur un réseau lent : le second disparaissait
  expect(page).toContain('rechargementEnAttente.current = true')
  expect(page).toContain('if (rechargementEnAttente.current) {')
  expect(page).not.toMatch(/const loadPointages = async \(\) => \{\n\s*if \(loadingRef\.current\) return\n/)
})

it('14. le témoin est visible, cliquable d’esprit, et suit la charte', () => {
  expect(page).toContain('data-testid="pointages-etat-direct"')
  expect(page).toContain('data-etat={etatDirect}')
  expect(page).toContain('presenterEtat(etatDirect).libelle')
  expect(page).toContain('presenterEtat(etatDirect).aide')
  // aucune couleur en dur : la charte Pointages porte ses jetons
  const debut = page.indexOf('data-testid="pointages-etat-direct"')
  const bloc = page.slice(debut, debut + 1200)
  expect(bloc).toContain('var(--pt-good-soft)')
  expect(bloc).not.toMatch(/#[0-9A-Fa-f]{6}/)
})

// ── 3. La base ──────────────────────────────────────────────────────

it('15. la migration publie les deux tables, et se rejoue sans casser', () => {
  const migration = lire(
    'supabase/migrations/20261024000001_publication_temps_reel_pauses.sql',
  )
  expect(migration).toContain("array['encheck_pauses', 'messages_systeme']")
  // rejouable : on ne republie pas une table déjà publiée (sinon erreur)
  expect(migration).toContain('déjà publiée')
  expect(migration).toContain("alter publication supabase_realtime add table public.%I")
  // et l'inverse est documenté, pour ne pas confondre avec un DROP TABLE
  expect(migration).toContain('drop table')
  expect(migration).toContain('SUPPRESSION')
})
