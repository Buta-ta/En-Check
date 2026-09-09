// src/lib/db.js
//
// ═══════════════════════════════════════════════════════════════════════════
// LIVRAISON 06.B.2b — LE SÉLECTEUR DE CLIENT
// ═══════════════════════════════════════════════════════════════════════════
//
// À QUOI ÇA SERT
// ────────────────────────────────────────────────────────────────────────────
// Beaucoup de services sont PARTAGÉS entre l'espace administrateur et l'espace
// employé : `featureService` (11 pages admin), `holidayService` (8 pages),
// `payrollService`, `taskService`, `leaveBalanceService`, `connectionLogService`.
//
// Ces services doivent lire avec la BONNE identité :
//   • appelés depuis une page admin     → session administrateur
//   • appelés depuis une page employé   → session employé
//
// Ils ne le savent pas tout seuls. `db()` le déduit de l'endroit où on se
// trouve : toutes les routes de l'espace employé commencent par `/employee`
// (vérifié dans `App.jsx` : /employee/dashboard, /employee/conges,
// /employee/heures, /employee/horaires, /employee/fiches-paie,
// /employee/taches, /employee/login).
//
// COMMENT L'UTILISER
// ────────────────────────────────────────────────────────────────────────────
//   import { db } from '../lib/db'
//
//   const { data } = await db().from('employees').select('*')
//   const { data } = await db().rpc('ma_fonction', { ... })
//
// ⚠️ ON APPELLE `db()` À CHAQUE FOIS, PAS UNE SEULE AU DÉBUT D'UN FICHIER.
//    `db()` est une fonction, pas un client : c'est ce qui lui permet de
//    savoir où on se trouve AU MOMENT de la requête. Si tu écris
//    `const client = db()` en haut d'un fichier, tu figes le choix au
//    chargement et le sélecteur ne sert plus à rien.
//
// POURQUOI PAS UN SECOND CLIENT PARTOUT
// ────────────────────────────────────────────────────────────────────────────
// Modifier les 37 tables verrouillées côté requêtes aurait demandé de revoir
// tout l'espace administrateur — qui fonctionne. Ici, l'espace admin continue
// d'importer `supabase` directement, sans aucun changement. Seul l'espace
// employé passe par le sélecteur.
//
// ═══════════════════════════════════════════════════════════════════════════

import { supabase, supabaseEmployee } from './supabase'

// Préfixe des routes de l'espace employé
const EMPLOYEE_PREFIX = '/employee'

/**
 * Renvoie le client Supabase correspondant à l'espace où l'on se trouve.
 *
 *   /employee/*  →  client employé   (session employé)
 *   partout ailleurs → client administrateur (session admin)
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function db() {
  try {
    // En dehors du navigateur (tests, pré-rendu) : on renvoie l'admin.
    if (typeof window === 'undefined' || !window.location) return supabase

    const path = window.location.pathname || ''
    if (path === EMPLOYEE_PREFIX || path.startsWith(EMPLOYEE_PREFIX + '/')) {
      return supabaseEmployee
    }
  } catch {
    // Si le chemin n'est pas lisible, on ne bloque jamais une requête :
    // on retombe sur le client administrateur.
  }

  return supabase
}

/**
 * True si l'on est dans l'espace employé.
 * Utile pour afficher un indicateur ou choisir un comportement.
 */
export function isEmployeeSpace() {
  try {
    if (typeof window === 'undefined' || !window.location) return false
    const path = window.location.pathname || ''
    return path === EMPLOYEE_PREFIX || path.startsWith(EMPLOYEE_PREFIX + '/')
  } catch {
    return false
  }
}

export default db
