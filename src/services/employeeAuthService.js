// src/services/employeeAuthService.js
//
// ═══════════════════════════════════════════════════════════════════════════
// LIVRAISON 06.B.2 — LA CONNEXION EMPLOYÉ PASSE PAR SUPABASE AUTH
// ═══════════════════════════════════════════════════════════════════════════
//
// CE QUI CHANGE
// ────────────────────────────────────────────────────────────────────────────
// Avant : le mot de passe était vérifié DANS LE NAVIGATEUR (SHA-256 + sel
//         écrit en dur dans ce fichier), puis comparé au champ
//         `employees.password_hash`. N'importe qui lisait la table et voyait
//         tous les hachages.
//
// Après : le mot de passe est vérifié PAR SUPABASE. Le navigateur ne reçoit
//         qu'un jeton de session. Plus aucun hachage ne transite côté client.
//
// COMMENT ÇA MARCHE, ÉTAPE PAR ÉTAPE
// ────────────────────────────────────────────────────────────────────────────
//   1. L'employé tape son MATRICULE (ce qu'il connaît) + son mot de passe.
//   2. La base traduit le matricule en adresse de connexion
//      (`employee_login_precheck`) — il ne peut pas retenir
//      « emp002.e0000001@espace.encheck.local ».
//   3. Si la réponse est `mode: 'compte'` → Supabase vérifie le mot de passe.
//      Si la réponse est `mode: 'ancien'` → on garde l'ancienne méthode.
//
// LA TRANSITION EST PROGRESSIVE, ET C'EST VOLONTAIRE
// ────────────────────────────────────────────────────────────────────────────
// Tes 13 employés n'ont pas encore tous un compte. Ceux qui n'en ont pas
// continuent de se connecter exactement comme avant. **Personne n'est bloqué
// dehors pendant l'équipement.** On retirera l'ancienne méthode en 06.B.4,
// quand tout le monde aura son compte.
//
// ⭐ DEUX CLIENTS, DEUX SESSIONS SIMULTANÉES
// ────────────────────────────────────────────────────────────────────────────
//   `supabaseEmployee` → la session EMPLOYÉ (authentification)
//   `db()`             → le client de l'espace où l'on se trouve (lectures)
//
// L'administrateur et l'employé peuvent donc être connectés EN MÊME TEMPS dans
// le même navigateur : deux clés de stockage, deux sessions vivantes.
//
// Concrètement : tu restes super administrateur dans l'espace admin, et tu
// peux ouvrir l'espace employé dans un autre onglet pour voir exactement ce
// que voit un employé, ou intervenir directement à sa place.
//
// Voir `src/lib/supabase.js` et `src/lib/db.js` pour le détail.
//
// ═══════════════════════════════════════════════════════════════════════════

import { supabaseEmployee } from '../lib/supabase'
import { db } from '../lib/db'

const EMPLOYEE_SECURITY = {
  SESSION_DURATION_MS: 12 * 60 * 60 * 1000, // 12h
  MAX_ATTEMPTS: 5,
  BLOCK_DURATION_MS: 5 * 60 * 1000, // 5 min
  RATE_LIMIT_KEY: 'employee_login_attempts',
}

class EmployeeAuthService {
  // ═══════════════════════════════════════════════════════════
  // 🔐 HASH PASSWORD (ancien système, conservé pour la transition)
  // ═══════════════════════════════════════════════════════════
  // ⚠️ Ce hachage reste utilisé UNIQUEMENT pour les employés qui n'ont pas
  //    encore de compte Supabase. Il disparaîtra en 06.B.4.
  static async hashPassword(password) {
    const sel = 'EnCheck_Employee_2024'
    const contenu = `${sel}${password}${sel}`
    const encoder = new TextEncoder()
    const data = encoder.encode(contenu)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // ═══════════════════════════════════════════════════════════
  // 🧱 HELPERS RATE LIMITING
  // ═══════════════════════════════════════════════════════════
  static _normalizeIdentifier(identifier) {
    return (identifier || '').trim().toLowerCase()
  }

  static _cleanPhone(identifier) {
    return (identifier || '').replace(/[\s\-\.\(\)]/g, '')
  }

  static _getRateLimitStore() {
    try {
      const raw = localStorage.getItem(EMPLOYEE_SECURITY.RATE_LIMIT_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  static _setRateLimitStore(data) {
    try {
      localStorage.setItem(EMPLOYEE_SECURITY.RATE_LIMIT_KEY, JSON.stringify(data))
    } catch {
      // silence
    }
  }

  static _getRateLimitData(identifier) {
    const store = this._getRateLimitStore()
    return store[identifier] || null
  }

  static _setRateLimitData(identifier, payload) {
    const store = this._getRateLimitStore()
    store[identifier] = payload
    this._setRateLimitStore(store)
  }

  static _clearRateLimitData(identifier) {
    const store = this._getRateLimitStore()
    delete store[identifier]
    this._setRateLimitStore(store)
  }

  static getBlockStatus(identifier) {
    const normalized = this._normalizeIdentifier(identifier)
    if (!normalized) {
      return { blocked: false, remainingMs: 0, attempts: 0 }
    }

    const data = this._getRateLimitData(normalized)
    if (!data) {
      return { blocked: false, remainingMs: 0, attempts: 0 }
    }

    if (data.blockedUntil && Date.now() < data.blockedUntil) {
      return {
        blocked: true,
        remainingMs: data.blockedUntil - Date.now(),
        attempts: data.attempts || 0,
      }
    }

    if (data.blockedUntil && Date.now() >= data.blockedUntil) {
      this._clearRateLimitData(normalized)
      return { blocked: false, remainingMs: 0, attempts: 0 }
    }

    return {
      blocked: false,
      remainingMs: 0,
      attempts: data.attempts || 0,
    }
  }

  static recordFailedAttempt(identifier) {
    const normalized = this._normalizeIdentifier(identifier)
    const current = this._getRateLimitData(normalized)
    const attempts = (current?.attempts || 0) + 1

    if (attempts >= EMPLOYEE_SECURITY.MAX_ATTEMPTS) {
      const blockedUntil = Date.now() + EMPLOYEE_SECURITY.BLOCK_DURATION_MS
      this._setRateLimitData(normalized, {
        attempts,
        blockedUntil,
        lastAttempt: Date.now(),
      })
      return { blocked: true, attempts, blockedUntil }
    }

    this._setRateLimitData(normalized, {
      attempts,
      blockedUntil: null,
      lastAttempt: Date.now(),
    })

    return { blocked: false, attempts, blockedUntil: null }
  }

  static clearFailedAttempts(identifier) {
    const normalized = this._normalizeIdentifier(identifier)
    this._clearRateLimitData(normalized)
  }

  // ═══════════════════════════════════════════════════════════
  // 🎫 SESSION HELPERS
  // ═══════════════════════════════════════════════════════════
  static _generateSessionToken() {
    return `${Date.now()}_${Math.random().toString(36).slice(2)}_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`
  }

  static _buildEmployeeSession(employee) {
    const features = {
      conges: employee.enterprises?.module_conges || false,
      heures_supplementaires: employee.enterprises?.module_heures_supplementaires || false,
      planning: employee.enterprises?.module_planning || false,
      fiches_paie: employee.enterprises?.module_fiches_paie || false,
      gestion_taches: employee.enterprises?.module_taches || false,
    }

    return {
      id: employee.id,
      enterprise_id: employee.enterprise_id,
      matricule: employee.matricule,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      phone: employee.phone,
      photo_url: employee.photo_url,
      department: employee.department,
      position: employee.position,
      enterprise: {
        id: employee.enterprises.id,
        name: employee.enterprises.name,
        code: employee.enterprises.code,
        logo_url: employee.enterprises.logo_url,
        primary_color: employee.enterprises.primary_color,
      },
      features,
      loginAt: new Date().toISOString(),
      expiresAt: Date.now() + EMPLOYEE_SECURITY.SESSION_DURATION_MS,
      sessionToken: this._generateSessionToken(),
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ⭐ 06.B.2 — ABONNEMENT AUX NOTIFICATIONS PUSH
  // ═══════════════════════════════════════════════════════════
  // Extrait de `login()` pour être utilisé par les DEUX voies de connexion.
  // Ne bloque jamais : tout échec est silencieux.
  static async _subscribeToPush(employee) {
    // ⚠️ Désactivé en développement HTTP (fonctionne seulement en HTTPS)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      console.log('ℹ️ Push notifications nécessitent HTTPS (désactivé en dev HTTP)')
      return
    }

    try {
      if (!('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window)) {
        console.log('ℹ️ Push notifications non supportées par ce navigateur')
        return
      }

      if (Notification.permission !== 'granted') {
        console.log('ℹ️ Notifications non autorisées (sera proposé via popup)')
        return
      }

      const pushService = (await import('./pushNotificationService')).default

      if (!pushService.isSupported()) return

      const subscriptionPromise = pushService.subscribe({
        userType: 'employee',
        userId: employee.id,
        enterpriseId: employee.enterprise_id || null,
      })

      // Timeout de 3 secondes pour éviter de bloquer la connexion
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Push timeout')), 3000)
      )

      await Promise.race([subscriptionPromise, timeoutPromise])
        .then(() => console.log('✅ Push subscription réussie (employé)'))
        .catch((err) => console.warn('⚠️ Push subscription timeout/error:', err.message))
    } catch (pushErr) {
      // Ne jamais bloquer la connexion
      console.warn('⚠️ Push subscription failed:', pushErr.message || pushErr)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ⭐ 06.B.2 — TRADUIRE L'IDENTIFIANT
  // ═══════════════════════════════════════════════════════════
  // L'employé tape son matricule, son téléphone ou son email. La base
  // renvoie quelle méthode utiliser. Renvoie `null` si la base n'a pas
  // répondu — on retombe alors sur l'ancien système.
  static async _precheckLogin(identifier) {
    try {
      const { data, error } = await db().rpc('employee_login_precheck', {
        p_identifier: identifier,
      })
      if (error) {
        // La fonction n'existe pas encore (livraison 06.B.2 non appliquée) :
        // on retombe proprement sur l'ancien système.
        console.warn('ℹ️ employee_login_precheck indisponible:', error.message)
        return null
      }
      return data
    } catch (err) {
      console.warn('ℹ️ employee_login_precheck injoignable:', err?.message || err)
      return null
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ⭐ 06.B.2 — CONNEXION PAR LE COMPTE SUPABASE
  // ═══════════════════════════════════════════════════════════
  // Renvoie :
  //   • { success: true, employee }        → connecté
  //   • { success: false, error, blocked } → refus définitif
  //   • null                               → problème technique, on retombe
  //                                          sur l'ancien système
  static async _loginWithSupabaseAccount(loginEmail, password, normalizedId) {
    try {
      // ── 1. Supabase vérifie le mot de passe ──────────────────────────────
      const { data: authData, error: authError } = await supabaseEmployee.auth.signInWithPassword({
        email: loginEmail,
        password: password.trim(),
      })

      if (authError || !authData?.user) {
        const fail = this.recordFailedAttempt(normalizedId)
        const remaining = Math.max(EMPLOYEE_SECURITY.MAX_ATTEMPTS - fail.attempts, 0)

        if (fail.blocked) {
          return {
            success: false,
            blocked: true,
            remainingMs: EMPLOYEE_SECURITY.BLOCK_DURATION_MS,
            error: 'Compte temporairement bloqué après trop de tentatives (5 min)',
          }
        }

        return {
          success: false,
          blocked: false,
          error: `Identifiant ou mot de passe incorrect (${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''})`,
        }
      }

      // ── 2. On lit la fiche employé (le compte est maintenant authentifié) ─
      const { data: employees, error: readError } = await db()
        .from('employees')
        .select(`
          *,
          enterprises (
            id, name, code, logo_url, primary_color, is_active,
            module_conges, module_heures_supplementaires,
            module_planning, module_espace_employe,
            module_fiches_paie,
            module_taches
          )
        `)
        .eq('user_id', authData.user.id)
        .maybeSingle()

      if (readError || !employees) {
        console.error('Fiche employé introuvable pour ce compte:', readError?.message)
        await supabaseEmployee.auth.signOut().catch(() => {})
        return {
          success: false,
          error: "Votre fiche employé est introuvable. Contactez votre administrateur.",
        }
      }

      // ── 3. Les contrôles d'état, APRÈS authentification ──────────────────
      // ⚠️ Volontairement ici et pas avant : l'ancien système ne révélait
      //    aucun de ces états avant d'avoir vérifié le mot de passe.
      if (employees.is_active === false) {
        await supabaseEmployee.auth.signOut().catch(() => {})
        return { success: false, error: 'Votre compte employé est désactivé. Contactez votre administrateur.' }
      }

      if (!employees.enterprises?.is_active) {
        await supabaseEmployee.auth.signOut().catch(() => {})
        return { success: false, error: 'Votre entreprise est actuellement inactive' }
      }

      if (!employees.enterprises?.module_espace_employe) {
        await supabaseEmployee.auth.signOut().catch(() => {})
        return {
          success: false,
          error: "L'espace employé n'est pas activé pour votre entreprise. Contactez votre administrateur.",
        }
      }

      if (!employees.employee_portal_enabled) {
        await supabaseEmployee.auth.signOut().catch(() => {})
        return {
          success: false,
          error: "Votre accès à l'espace employé n'est pas encore activé. Contactez votre administrateur.",
        }
      }

      this.clearFailedAttempts(normalizedId)

      // ── 4. ⭐ L'ADMINISTRATEUR N'EST PLUS DÉCONNECTÉ ─────────────────────
      // Avec deux clients séparés, la session administrateur vit dans une
      // autre clé de stockage : elle reste intacte. C'est ce qui permet de
      // tester les deux espaces en même temps.

      // ── 5. La session applicative, au même format qu'avant ───────────────
      const employeeData = this._buildEmployeeSession(employees)
      employeeData.method = 'supabase'      // ⭐ sert au logout et au changement de mot de passe
      employeeData.loginEmail = loginEmail  // ⭐ nécessaire pour revérifier l'ancien mot de passe

      localStorage.setItem('employee', JSON.stringify(employeeData))

      await this._subscribeToPush(employeeData)

      return { success: true, employee: employeeData, method: 'supabase' }
    } catch (err) {
      console.error('Erreur connexion par compte:', err)
      return null // → on retombe sur l'ancien système
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🔑 LOGIN
  // ═══════════════════════════════════════════════════════════
  static async login(identifier, password) {
    try {
      const normalizedId = this._normalizeIdentifier(identifier)
      const cleanPhone = this._cleanPhone(identifier)

      // Vérification rate limit
      const blockStatus = this.getBlockStatus(normalizedId)
      if (blockStatus.blocked) {
        const minutes = Math.ceil(blockStatus.remainingMs / 60000)
        return {
          success: false,
          error: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
          blocked: true,
          remainingMs: blockStatus.remainingMs,
        }
      }

      if (!normalizedId || !password?.trim()) {
        return { success: false, error: 'Veuillez remplir tous les champs' }
      }

      if (password.trim().length < 4) {
        return { success: false, error: 'Mot de passe invalide' }
      }

      // ═══════════════════════════════════════════════════════════════════
      // ⭐ 06.B.2 — NOUVELLE VOIE : le compte Supabase
      // ═══════════════════════════════════════════════════════════════════
      const precheck = await this._precheckLogin(identifier)

      if (precheck) {
        if (precheck.mode === 'ambigu' || precheck.mode === 'incoherent') {
          return { success: false, error: precheck.message }
        }

        if (precheck.mode === 'compte' && precheck.login_email) {
          const viaCompte = await this._loginWithSupabaseAccount(
            precheck.login_email,
            password,
            normalizedId
          )

          // Un refus est définitif : l'employé a un compte, sa fiche fait foi.
          // On ne retombe PAS sur l'ancien mot de passe — un seul mot de passe
          // valide à la fois, sinon on double les façons d'entrer.
          if (viaCompte) return viaCompte
        }

        // `mode: 'ancien'` ou problème technique → on continue plus bas,
        // avec l'ancien système, exactement comme avant.
      }

      // ═══════════════════════════════════════════════════════════════════
      // ANCIEN SYSTÈME — inchangé. Il ne concerne plus que les employés qui
      // n'ont pas encore de compte. Il disparaîtra en 06.B.4.
      // ═══════════════════════════════════════════════════════════════════
      const passwordHash = await this.hashPassword(password)

      let query = db()
        .from('employees')
        .select(`
          *,
          enterprises (
            id, name, code, logo_url, primary_color, is_active,
            module_conges, module_heures_supplementaires,
            module_planning, module_espace_employe,
            module_fiches_paie,
            module_taches

          )
        `)
        .eq('password_hash', passwordHash)
        .eq('is_active', true)

      const { data: employees, error } = await query.or(
        `email.ilike.${normalizedId},phone.eq.${cleanPhone},phone.eq.${identifier.trim()}`
      )

      if (error) throw error

      const employee = employees?.[0]

      if (!employee) {
        const fail = this.recordFailedAttempt(normalizedId)
        const remaining = Math.max(EMPLOYEE_SECURITY.MAX_ATTEMPTS - fail.attempts, 0)

        if (fail.blocked) {
          return {
            success: false,
            error: 'Compte temporairement bloqué après trop de tentatives (5 min)',
            blocked: true,
            remainingMs: EMPLOYEE_SECURITY.BLOCK_DURATION_MS,
          }
        }

        return {
          success: false,
          error: `Identifiant ou mot de passe incorrect (${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''})`,
          blocked: false,
        }
      }

      if (!employee.enterprises?.is_active) {
        return { success: false, error: 'Votre entreprise est actuellement inactive' }
      }

      if (!employee.enterprises?.module_espace_employe) {
        return {
          success: false,
          error: "L'espace employé n'est pas activé pour votre entreprise. Contactez votre administrateur."
        }
      }

      if (!employee.employee_portal_enabled) {
        return {
          success: false,
          error: "Votre accès à l'espace employé n'est pas encore activé. Contactez votre administrateur."
        }
      }

      // Succès login → reset rate limit
      this.clearFailedAttempts(normalizedId)

      const employeeData = this._buildEmployeeSession(employee)
      employeeData.method = 'legacy' // ⭐ logout ne touchera pas à la session Supabase
      localStorage.setItem('employee', JSON.stringify(employeeData))

      await this._subscribeToPush(employeeData)

      return { success: true, employee: employeeData, method: 'legacy' }

    } catch (err) {
      console.error('Erreur login employé:', err)
      return { success: false, error: 'Erreur de connexion. Réessayez.' }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ SESSION CHECK
  // ═══════════════════════════════════════════════════════════
  static isLoggedIn() {
    const data = localStorage.getItem('employee')
    if (!data) return false

    try {
      const employee = JSON.parse(data)

      if (!employee?.id || !employee?.enterprise_id) {
        this.logout()
        return false
      }

      if (!employee.expiresAt || Date.now() > employee.expiresAt) {
        this.logout()
        return false
      }

      return true
    } catch {
      this.logout()
      return false
    }
  }

  static getEmployee() {
    try {
      const employee = JSON.parse(localStorage.getItem('employee') || 'null')
      if (!employee) return null

      if (!employee.expiresAt || Date.now() > employee.expiresAt) {
        this.logout()
        return null
      }

      return employee
    } catch {
      this.logout()
      return null
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🚪 LOGOUT
  // ═══════════════════════════════════════════════════════════
  // ⚠️ POINT DÉLICAT : on ne ferme la session Supabase QUE si elle a été
  //    ouverte par un employé. Sinon, un administrateur qui visite par erreur
  //    une page employé se ferait déconnecter de son propre espace.
  //    D'où le marqueur `method: 'supabase'` posé au moment de la connexion.
  static logout() {
    let session = null
    try {
      session = JSON.parse(localStorage.getItem('employee') || 'null')
    } catch {
      session = null
    }

    localStorage.removeItem('employee')

    if (session?.method === 'supabase') {
      supabaseEmployee.auth.signOut().catch((err) => {
        console.warn('⚠️ Déconnexion Supabase impossible:', err?.message || err)
      })
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🔄 REFRESH FEATURES + REFRESH SESSION TTL
  // ═══════════════════════════════════════════════════════════
  static async refreshFeatures() {
    const employee = this.getEmployee()
    if (!employee) return null

    try {
      const { data: enterprise } = await db()
        .from('enterprises')
        .select(`
          module_conges,
          module_heures_supplementaires,
          module_planning,
          module_espace_employe,
          module_fiches_paie,
          module_taches,
          is_active
        `)
        .eq('id', employee.enterprise_id)
        .single()

      if (!enterprise || !enterprise.is_active || !enterprise.module_espace_employe) {
        this.logout()
        return null
      }

      employee.features = {
        conges: enterprise.module_conges || false,
        heures_supplementaires: enterprise.module_heures_supplementaires || false,
        planning: enterprise.module_planning || false,
        fiches_paie: enterprise.module_fiches_paie || false,
        gestion_taches: enterprise.module_taches || false,
      }

      // Prolonge la session si l'utilisateur est actif
      employee.expiresAt = Date.now() + EMPLOYEE_SECURITY.SESSION_DURATION_MS

      localStorage.setItem('employee', JSON.stringify(employee))
      return employee
    } catch (err) {
      console.error('Erreur refresh features:', err)
      return employee
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🔁 CHANGE PASSWORD
  // ═══════════════════════════════════════════════════════════
  static async changePassword(employeeId, oldPassword, newPassword) {
    try {
      if (!oldPassword || !newPassword) {
        return { success: false, error: 'Tous les champs sont requis' }
      }

      if (newPassword.length < 6) {
        return { success: false, error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' }
      }

      // ⭐ 06.B.2 — employé avec un compte Supabase
      const session = this.getEmployee()
      if (session?.method === 'supabase' && session.loginEmail) {
        // On revérifie l'ancien mot de passe en tentant une reconnexion.
        // C'est la seule façon fiable de le vérifier côté serveur.
        const { error: reauthError } = await supabaseEmployee.auth.signInWithPassword({
          email: session.loginEmail,
          password: oldPassword,
        })

        if (reauthError) {
          return { success: false, error: 'Ancien mot de passe incorrect' }
        }

        const { error: updateError } = await supabaseEmployee.auth.updateUser({ password: newPassword })
        if (updateError) throw updateError

        return { success: true }
      }

      // ── Ancien système (employés pas encore équipés) ─────────────────────
      const oldHash = await this.hashPassword(oldPassword)

      const { data: employee } = await db()
        .from('employees')
        .select('id')
        .eq('id', employeeId)
        .eq('password_hash', oldHash)
        .single()

      if (!employee) {
        return { success: false, error: 'Ancien mot de passe incorrect' }
      }

      const newHash = await this.hashPassword(newPassword)

      const { error } = await db()
        .from('employees')
        .update({
          password_hash: newHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', employeeId)

      if (error) throw error

      return { success: true }
    } catch (err) {
      console.error('Erreur changement mot de passe:', err)
      return { success: false, error: 'Erreur lors du changement' }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 👨‍💼 SET PASSWORD BY ADMIN
  // ═══════════════════════════════════════════════════════════
  static async setPasswordByAdmin(employeeId, newPassword) {
    try {
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' }
      }

      // ⭐ 06.B.2 — si l'employé a un compte Supabase, on change AUSSI son mot
      // de passe là-bas. Sans ça, l'administrateur croirait avoir réinitialisé
      // un mot de passe que l'employé ne pourrait toujours pas utiliser.
      // La fonction lève une erreur s'il n'y a pas de compte : on l'ignore.
      try {
        const { error: rpcError } = await db().rpc('set_employee_password', {
          p_employee_id: employeeId,
          p_password: newPassword,
        })
        if (rpcError) {
          console.warn('ℹ️ set_employee_password:', rpcError.message)
        }
      } catch (rpcErr) {
        console.warn('ℹ️ set_employee_password injoignable:', rpcErr?.message || rpcErr)
      }

      // L'ancien hachage est mis à jour dans tous les cas : il reste la
      // méthode de secours tant que l'employé n'est pas équipé.
      const passwordHash = await this.hashPassword(newPassword)

      const { error } = await db()
        .from('employees')
        .update({
          password_hash: passwordHash,
          employee_portal_enabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', employeeId)

      if (error) throw error

      return { success: true }
    } catch (err) {
      console.error('Erreur définition mot de passe:', err)
      return { success: false, error: 'Erreur lors de la sauvegarde' }
    }
  }
}

export default EmployeeAuthService
