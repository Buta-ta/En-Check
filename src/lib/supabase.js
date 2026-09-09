// src/lib/supabase.js
//
// ═══════════════════════════════════════════════════════════════════════════
// LIVRAISON 06.B.2b — DEUX CLIENTS SUPABASE, DEUX SESSIONS SIMULTANÉES
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI DEUX CLIENTS
// ────────────────────────────────────────────────────────────────────────────
// Supabase range la session dans le navigateur sous une clé unique. Avec un
// seul client, se connecter en employé ÉCRASE la session administrateur.
//
// Or tu as besoin d'être super administrateur ET employé en même temps :
// pour tester les deux espaces, et pour intervenir directement.
//
// Deux clients = deux clés de stockage = deux sessions qui coexistent.
//
//   `supabase`         → session ADMINISTRATEUR   (tout l'espace admin)
//   `supabaseEmployee` → session EMPLOYÉ          (tout l'espace /employee)
//
// ⚠️ CE FICHIER NE CHANGE RIEN POUR L'ESPACE ADMIN.
//    L'export `supabase` est identique à avant, à la lettre près. Les 37
//    tables verrouillées, la connexion administrateur, le dashboard : rien
//    ne bouge. Le second client est ADDITIONNEL.
//
// ⚠️ POURQUOI PAS UN SEUL CLIENT AVEC LE RÔLE DÉDUIT DU CHEMIN ?
//    Parce que Supabase n'a qu'UN emplacement de session par client. Le
//    chemin d'URL ne change pas où la session est rangée. Il faut donc
//    réellement deux clients — c'est la seule façon d'avoir deux identités
//    vivantes en même temps.
//
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Vérification : si les clés manquent, on prévient le développeur
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Variables Supabase manquantes dans .env')
}

// ───────────────────────────────────────────────────────────────────────────
// CLIENT 1 — ADMINISTRATEUR (inchangé)
// ───────────────────────────────────────────────────────────────────────────
// Aucune option ajoutée : le comportement est exactement celui d'avant.
// Les sessions déjà ouvertes dans les navigateurs continuent de fonctionner.
// ───────────────────────────────────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ───────────────────────────────────────────────────────────────────────────
// CLIENT 2 — EMPLOYÉ
// ───────────────────────────────────────────────────────────────────────────
// `storageKey` est le point capital : c'est ce qui empêche les deux sessions
// de s'écraser mutuellement. Le nom est explicite pour qu'on le retrouve
// facilement dans les outils de développement du navigateur.
//
// `detectSessionInUrl: false` : l'espace employé n'utilise pas de lien de
// confirmation par email. Sans ça, le client tenterait de lire un fragment
// d'URL qui n'existe pas — et pourrait perturber la connexion administrateur.
// ───────────────────────────────────────────────────────────────────────────
export const supabaseEmployee = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'encheck-employee-auth-token',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

export default supabase
