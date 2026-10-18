// ═══════════════════════════════════════════════════════════
// 🔐 PAGE DE CONNEXION - AFROFUTURISTE + SÉCURISÉE
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  User, Lock, LogIn, Eye, EyeOff,
  Zap, Shield, AlertTriangle, Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConnectionLogService from '../services/connectionLogService'
import EnCheckBrandMark from '../components/EnCheckBrandMark'

// ═══════════════════════════════════════════════════════════
// 🔒 CONSTANTES DE SÉCURITÉ
// ═══════════════════════════════════════════════════════════
const SECURITY = {
  MAX_ATTEMPTS: 5,
  BLOCK_DURATION_MS: 5 * 60 * 1000,
  SESSION_DURATION_MS: 8 * 60 * 60 * 1000,
  RATE_LIMIT_KEY: 'admin_login_attempts',
}

// ═══════════════════════════════════════════════════════════
// 🛡️ HELPERS RATE LIMITING
// ═══════════════════════════════════════════════════════════
function getRateLimitData(identifier) {
  try {
    const raw = localStorage.getItem(SECURITY.RATE_LIMIT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data[identifier] || null
  } catch { return null }
}

function setRateLimitData(identifier, attempts, blockedUntil = null) {
  try {
    const raw = localStorage.getItem(SECURITY.RATE_LIMIT_KEY)
    const data = raw ? JSON.parse(raw) : {}
    data[identifier] = { attempts, blockedUntil, lastAttempt: Date.now() }
    localStorage.setItem(SECURITY.RATE_LIMIT_KEY, JSON.stringify(data))
  } catch { }
}

function clearRateLimitData(identifier) {
  try {
    const raw = localStorage.getItem(SECURITY.RATE_LIMIT_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    delete data[identifier]
    localStorage.setItem(SECURITY.RATE_LIMIT_KEY, JSON.stringify(data))
  } catch { }
}

function isBlocked(identifier) {
  const data = getRateLimitData(identifier)
  if (!data) return { blocked: false, remainingMs: 0, attempts: 0 }

  if (data.blockedUntil && Date.now() < data.blockedUntil) {
    return {
      blocked: true,
      remainingMs: data.blockedUntil - Date.now(),
      attempts: data.attempts,
    }
  }

  if (data.blockedUntil && Date.now() >= data.blockedUntil) {
    clearRateLimitData(identifier)
  }

  return { blocked: false, remainingMs: 0, attempts: data?.attempts || 0 }
}

function recordFailedAttempt(identifier) {
  const data = getRateLimitData(identifier)
  const attempts = (data?.attempts || 0) + 1

  if (attempts >= SECURITY.MAX_ATTEMPTS) {
    const blockedUntil = Date.now() + SECURITY.BLOCK_DURATION_MS
    setRateLimitData(identifier, attempts, blockedUntil)
    return { blocked: true, attempts, blockedUntil }
  }

  setRateLimitData(identifier, attempts, null)
  return { blocked: false, attempts, blockedUntil: null }
}

// ═══════════════════════════════════════════════════════════
// ⏱️ HOOK COMPTE À REBOURS
// ═══════════════════════════════════════════════════════════
function useCountdown(targetMs) {
  const [remaining, setRemaining] = useState(targetMs)

  useEffect(() => {
    if (!targetMs) return
    const interval = setInterval(() => {
      const diff = targetMs - Date.now()
      if (diff <= 0) {
        setRemaining(0)
        clearInterval(interval)
      } else {
        setRemaining(diff)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [targetMs])

  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════
// 🔐 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  const [blockState, setBlockState] = useState({
    blocked: false, blockedUntil: null, attempts: 0,
  })
  const countdown = useCountdown(blockState.blockedUntil)

  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Vérifier session existante
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const adminRaw = localStorage.getItem('admin')
        if (!adminRaw) return
        const admin = JSON.parse(adminRaw)
        if (!admin.expiresAt || Date.now() > admin.expiresAt) {
          localStorage.removeItem('admin')
          localStorage.removeItem('last_enterprise_id')
          return
        }
        const { data: { session } } = await supabase.auth.getSession()
        if (session && admin.id) navigate('/dashboard')
      } catch {
        localStorage.removeItem('admin')
      }
    }
    checkExistingSession()
  }, [navigate])

  // Vérifier blocage au montage
  useEffect(() => {
    if (identifier) {
      const { blocked, remainingMs, attempts } = isBlocked(identifier.toLowerCase().trim())
      setBlockState({
        blocked,
        blockedUntil: blocked ? Date.now() + remainingMs : null,
        attempts,
      })
    }
  }, [identifier])

  const checkBlockState = useCallback((id) => {
    const normalizedId = id.toLowerCase().trim()
    if (!normalizedId) {
      setBlockState({ blocked: false, blockedUntil: null, attempts: 0 })
      return false
    }
    const { blocked, remainingMs, attempts } = isBlocked(normalizedId)
    setBlockState({
      blocked,
      blockedUntil: blocked ? Date.now() + remainingMs : null,
      attempts,
    })
    return blocked
  }, [])

  const handleIdentifierChange = (e) => {
    const val = e.target.value
    setIdentifier(val)
    if (val.length > 3) checkBlockState(val)
  }

  // ═══════════════════════════════════════════════════════════
  // 🚀 HANDLE LOGIN — corrections des appels ConnectionLogService
  // ═══════════════════════════════════════════════════════════
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    const normalizedId = identifier.toLowerCase().trim()

    try {
      // 1. Vérifier rate limiting
      const { blocked, remainingMs, attempts } = isBlocked(normalizedId)
      if (blocked) {
        const minutes = Math.ceil(remainingMs / 60000)
        toast.error(`Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`)
        setBlockState({ blocked: true, blockedUntil: Date.now() + remainingMs, attempts })
        setLoading(false)
        return
      }

      // 2. Validation basique
      if (!identifier.trim() || !password.trim()) {
        toast.error('Veuillez remplir tous les champs')
        setLoading(false)
        return
      }

      if (password.length < 4) {
        toast.error('Mot de passe trop court')
        setLoading(false)
        return
      }

      // 3. ⭐ LIVRAISON 05.C.1 — L'IDENTIFIANT EST RÉSOLU CÔTÉ SERVEUR
      // ─────────────────────────────────────────────────────────────────────
      // AVANT : on lisait la table `admins` depuis le navigateur, avec la clé
      // publique. C'est ce qui OBLIGEAIT à laisser cette table lisible par
      // n'importe qui — donc à exposer les comptes administrateurs.
      //
      // MAINTENANT : une fonction serveur répond. Elle vérifie au passage
      // l'état du compte, et surtout le BLOCAGE APRÈS 5 ÉCHECS, compté dans
      // la base : il vaut pour tous les navigateurs, pas seulement le tien.
      //
      // ⚠️ REPLI : si la fonction n'existe pas encore en base (livraison 05.C.1
      // non appliquée), on retombe sur l'ancienne lecture. La connexion ne peut
      // donc pas être cassée par l'absence de cette livraison.
      let adminCheck = null
      let essaisRestants = null

      const { data: precheck, error: precheckError } = await supabase.rpc(
        'admin_login_precheck',
        { p_identifier: identifier.trim() },
      )

      if (!precheckError && precheck) {
        if (!precheck.ok) {
          const raison = precheck.raison

          if (raison === 'verrouille') {
            const minutes = precheck.minutes_restantes ?? 5
            toast.error(
              `Trop de tentatives. Réessaie dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
            )
            setBlockState({
              blocked: true,
              blockedUntil: Date.now() + minutes * 60000,
              attempts: SECURITY.MAX_ATTEMPTS,
            })
          } else {
            recordFailedAttempt(normalizedId)
            toast.error(precheck.message || 'Identifiant ou mot de passe incorrect')
            setBlockState({ blocked: false, blockedUntil: null, attempts: 0 })
          }

          await ConnectionLogService.logAdminConnection(
            precheck.admin_id ?? null,
            false,
            raison === 'verrouille'
              ? 'Compte bloqué après trop de tentatives'
              : raison === 'inactif'
                ? 'Compte désactivé'
                : 'Identifiant introuvable',
          )

          setLoading(false)
          return
        }

        adminCheck = { id: precheck.admin_id, email: precheck.email }
        essaisRestants = precheck.essais_restants ?? null
      } else {
        if (precheckError && precheckError.code !== 'PGRST202') {
          console.warn('[En-Check] Résolution serveur indisponible, repli local :', precheckError.message)
        }
        const { data: repliAdmin, error: checkError } = await supabase
          .from('admins')
          .select('id, email, username, is_active')
          .or(`email.eq.${normalizedId},username.eq.${identifier.trim()}`)
          .eq('is_active', true)
          .maybeSingle()
        adminCheck = checkError ? null : repliAdmin
      }

      if (!adminCheck) {
        const result = recordFailedAttempt(normalizedId)
        const remaining = SECURITY.MAX_ATTEMPTS - result.attempts

        // ✅ CORRIGÉ : on passe null (pas d'admin identifié)
        await ConnectionLogService.logAdminConnection(
          null,
          false,
          'Identifiant introuvable'
        )

        if (result.blocked) {
          toast.error('Compte temporairement bloqué après trop de tentatives (5 min)')
          setBlockState({ blocked: true, blockedUntil: result.blockedUntil, attempts: result.attempts })
        } else {
          toast.error(`Identifiant ou mot de passe incorrect (${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''})`)
          setBlockState({ blocked: false, blockedUntil: null, attempts: result.attempts })
        }

        setLoading(false)
        return
      }

      // 4. Authentification Supabase Auth (le mot de passe est vérifié
      //    côté serveur par le service d'authentification de Supabase)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: adminCheck.email,
        password: password,
      })

      if (authError || !authData.session) {
        const result = recordFailedAttempt(normalizedId)
        const remaining = SECURITY.MAX_ATTEMPTS - result.attempts

        // ✅ CORRIGÉ : on passe adminCheck.id (on connaît l'admin)
        await ConnectionLogService.logAdminConnection(
          adminCheck.id,
          false,
          'Mot de passe incorrect'
        )

        // ⭐ LIVRAISON 05.C.1 : l'échec est compté dans la BASE, sur le compte.
        // Le compteur du navigateur reste en place, mais il n'est plus la
        // seule barrière : effacer son localStorage ne remet plus le compteur
        // à zéro côté serveur.
        let serveurLock = null
        try {
          const { data: suivi } = await supabase.rpc('admin_login_result', {
            p_admin_id: adminCheck.id,
            p_success: false,
            p_reason: 'Mot de passe incorrect',
          })
          serveurLock = suivi?.verrouille_jusqu_a ? 5 : null
        } catch (e) {
          console.warn('[En-Check] Compteur serveur indisponible :', e?.message)
        }

        if (serveurLock || result.blocked) {
          toast.error('Compte temporairement bloqué après trop de tentatives (5 min)')
          setBlockState({
            blocked: true,
            blockedUntil: Date.now() + 5 * 60000,
            attempts: SECURITY.MAX_ATTEMPTS,
          })
        } else {
          const restants = essaisRestants !== null && essaisRestants > 1
            ? essaisRestants - 1
            : remaining
          toast.error(`Mot de passe incorrect (${restants} essai${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''})`)
          setBlockState({ blocked: false, blockedUntil: null, attempts: result.attempts })
        }

        setLoading(false)
        return
      }

      // ⭐ LIVRAISON 05.C.1 : connexion réussie → on remet le compteur
      // serveur à zéro (et on note la date de dernière connexion).
      try {
        await supabase.rpc('admin_login_result', {
          p_admin_id: adminCheck.id,
          p_success: true,
        })
      } catch (e) {
        console.warn('[En-Check] Compteur serveur indisponible :', e?.message)
      }

      // 5. Récupérer le profil complet
      const { data: admin, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('id', adminCheck.id)
        .single()

      if (adminError || !admin) {
        toast.error('Erreur de chargement du profil')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      // 6. Succès → effacer rate limiting
      clearRateLimitData(normalizedId)
      setBlockState({ blocked: false, blockedUntil: null, attempts: 0 })

      // 7. Charger les entreprises
      let entreprises = []

      if (admin.role === 'super_admin') {
        const { data: allEntreprises } = await supabase
          .from('enterprises')
          .select('*')
          .eq('is_active', true)
          .order('name')
        entreprises = allEntreprises || []
      } else {
        // ⚠️ LIVRAISON 04 : toute colonne absente de ce « select » est
        // INVISIBLE pour un administrateur normal (erreur muette : la valeur
        // vaut undefined, l'application retombe sur UTC sans rien signaler).
        // `timezone` doit donc figurer ici, sinon les heures restent en UTC
        // pour tous les admins non super_admin.
        let { data: adminEntreprises, error: errEntreprises } = await supabase
          .from('admin_entreprises')
          .select(`
            id, role, is_active, enterprise_id,
            enterprises ( id, name, code, logo_url, matricule_prefix, timezone, country_code, currency )
          `)
          .eq('admin_id', admin.id)
          .eq('is_active', true)

        // ⚠️ SÉCURITÉ DE DÉPLOIEMENT — ne supprime pas ce bloc.
        // Si la livraison 04 n'est pas encore appliquée en base, la colonne
        // `timezone` n'existe pas : PostgREST refuse alors la requête ENTIÈRE
        // (400) et l'administrateur ne peut plus se connecter du tout.
        // On retente donc sans cette colonne. L'application fonctionne
        // normalement, les heures restent simplement en UTC.
        // C'est ce qui rend l'ordre « SQL puis code » non obligatoire.
        if (errEntreprises) {
          console.warn(
            '[En-Check] Colonne `timezone` absente : la livraison 04 n\'est pas appliquée en base. ' +
              'Repli sur la requête d\'origine, les heures resteront en UTC.',
            errEntreprises.message
          )
          const repli = await supabase
            .from('admin_entreprises')
            .select(`
              id, role, is_active, enterprise_id,
              enterprises ( id, name, code, logo_url, matricule_prefix )
            `)
            .eq('admin_id', admin.id)
            .eq('is_active', true)
          adminEntreprises = repli.data
        }

        entreprises = adminEntreprises?.map(ae => ({
          ...ae.enterprises,
          admin_role: ae.role,
        })) || []
      }

      let selectedEnterprise = null
      const lastEnterpriseId = localStorage.getItem('last_enterprise_id')
      if (lastEnterpriseId) {
        selectedEnterprise = entreprises.find(e => e.id === lastEnterpriseId)
      }
      if (!selectedEnterprise && entreprises.length > 0) {
        selectedEnterprise = entreprises[0]
      }

      // 8. Stocker la session (SANS password_hash)
      const adminData = {
        id: admin.id,
        email: admin.email,
        username: admin.username,
        first_name: admin.first_name,
        last_name: admin.last_name,
        role: admin.role,
        enterprise_id: admin.enterprise_id,
        photo_url: admin.photo_url,
        entreprises,
        selectedEnterprise,
        isMultiEntreprise: entreprises.length > 1,
        sessionToken: authData.session.access_token.slice(-16),
        expiresAt: Date.now() + SECURITY.SESSION_DURATION_MS,
        loginAt: new Date().toISOString(),
      }

      localStorage.setItem('admin', JSON.stringify(adminData))

      // 10. ✅ S'ABONNER AUX NOTIFICATIONS PUSH
      try {
        const pushService = (await import('../services/pushNotificationService')).default
        if (pushService.isSupported()) {
          await pushService.subscribe({
            userType: 'admin',
            userId: admin.id, // ⚠️ C'est l'UUID de la table admins
            enterpriseId: selectedEnterprise?.id || admin.enterprise_id || null,
          })
        }
      } catch (pushErr) {
        console.warn('Push subscription failed:', pushErr)
        // Ne pas bloquer la connexion si push échoue
      }
      if (selectedEnterprise) {
        localStorage.setItem('last_enterprise_id', selectedEnterprise.id)
      }

      // 9. ✅ CORRIGÉ : logger avec admin.id (UUID)
      await ConnectionLogService.logAdminConnection(
        admin.id,
        true,
        null
      )

      toast.success(`Bienvenue ${admin.first_name} ! 👋`)
      if (entreprises.length > 1) {
        toast(`🏢 ${entreprises.length} entreprises disponibles`, { icon: '📋' })
      }

      // ✅ REDIRECTION VERS DASHBOARD
      navigate('/dashboard')


    } catch (err) {
      console.error('Erreur login:', err)

      const result = recordFailedAttempt(normalizedId)
      setBlockState({
        blocked: result.blocked,
        blockedUntil: result.blockedUntil,
        attempts: result.attempts,
      })

      // ✅ CORRIGÉ : null car erreur inattendue
      await ConnectionLogService.logAdminConnection(
        null,
        false,
        err.message || 'Erreur technique'
      )

      toast.error('Erreur de connexion. Réessayez.')
    }

    setLoading(false)
  }

  const attemptsRemaining = SECURITY.MAX_ATTEMPTS - blockState.attempts
  const isFormDisabled = loading || blockState.blocked

  return (
    <>
      <style>{`
        @keyframes gradientFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-8px) rotate(1deg); }
          66% { transform: translateY(4px) rotate(-1deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -20px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(10px, -30px) scale(1.05); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-40px, 15px) scale(0.95); }
          50% { transform: translate(25px, -25px) scale(1.08); }
          75% { transform: translate(-15px, 35px) scale(1); }
        }
        @keyframes borderGlow {
          0%, 100% { border-color: rgba(245, 158, 11, 0.2); }
          50% { border-color: rgba(245, 158, 11, 0.5); }
        }
        @keyframes borderGlowRed {
          0%, 100% { border-color: rgba(239, 68, 68, 0.3); }
          50% { border-color: rgba(239, 68, 68, 0.6); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .login-input:focus {
          border-color: #F59E0B !important;
          box-shadow: 0 0 0 3px rgba(245,158,11,0.15), 0 4px 20px rgba(245,158,11,0.1) !important;
        }
        .login-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .login-input::placeholder { color: #555; }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px) !important;
          box-shadow: 0 12px 40px rgba(245,158,11,0.4) !important;
        }
        .login-btn:active:not(:disabled) { transform: translateY(0) !important; }
        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .eye-btn:hover {
          background: rgba(245,158,11,0.15) !important;
          color: #F59E0B !important;
        }
        .login-card { animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
        .particle {
          position: absolute;
          border-radius: 50%;
          animation: float 8s ease-in-out infinite;
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.bgBase}></div>
        <div style={styles.bgGrid}></div>
        <div style={styles.bgOrb1}></div>
        <div style={styles.bgOrb2}></div>
        <div style={styles.bgOrb3}></div>

        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              background: 'rgba(245,158,11,0.3)',
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${6 + Math.random() * 8}s`,
              opacity: 0.2 + Math.random() * 0.3,
            }}
          />
        ))}

        <div style={styles.diagonalLine1}></div>
        <div style={styles.diagonalLine2}></div>

        <div className="login-card" style={styles.card}>
          <div style={styles.cardGlow}></div>

          {/* ── LOGO ── */}
          <div style={styles.logoSection}>
            <div style={styles.logoOuter}>
              <div style={{
                ...styles.logoRing,
                animation: blockState.blocked
                  ? 'borderGlowRed 1s ease-in-out infinite'
                  : 'borderGlow 3s ease-in-out infinite',
              }}></div>
              <div style={styles.logoInner}>
                <EnCheckBrandMark size={54} loading={loading} />
              </div>
            </div>

            <div style={styles.titleBlock}>
              <h1 style={styles.title}>EN-CHECK</h1>
              <div style={styles.subtitleRow}>
                <div style={styles.subtitleLine}></div>
                <span style={styles.subtitle}>ON GÈRE ! · ADMINISTRATION</span>
                <div style={styles.subtitleLine}></div>
              </div>
            </div>

            <div style={styles.timeDisplay}>
              <span style={styles.timeText}>
                {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={styles.timeSeconds}>
                :{currentTime.toLocaleTimeString('fr-FR', { second: '2-digit' }).split(':').pop()}
              </span>
            </div>
          </div>

          <div style={styles.separator}>
            <div style={styles.separatorLine}></div>
            <Shield size={14} color={blockState.blocked ? '#EF4444' : '#F59E0B'} />
            <div style={styles.separatorLine}></div>
          </div>

          {/* ── BANNIÈRE BLOCAGE ── */}
          {blockState.blocked && (
            <div style={styles.blockBanner}>
              <div style={styles.blockBannerIcon}>
                <Clock size={20} color="#EF4444" />
              </div>
              <div>
                <p style={styles.blockBannerTitle}>Accès temporairement bloqué</p>
                <p style={styles.blockBannerSub}>
                  Trop de tentatives échouées. Réessayez dans{' '}
                  <span style={{ color: '#EF4444', fontWeight: '700', fontFamily: 'monospace' }}>
                    {countdown}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* ── AVERTISSEMENT TENTATIVES ── */}
          {!blockState.blocked && blockState.attempts > 0 && blockState.attempts < SECURITY.MAX_ATTEMPTS && (
            <div style={styles.warningBanner}>
              <AlertTriangle size={14} color="#F59E0B" />
              <span>
                {attemptsRemaining} tentative{attemptsRemaining > 1 ? 's' : ''} restante{attemptsRemaining > 1 ? 's' : ''} avant blocage
              </span>
            </div>
          )}

          {/* ── FORMULAIRE ── */}
          <form onSubmit={handleLogin} style={styles.form}>

            {/* Identifiant */}
            <div style={styles.fieldWrap}>
              <label style={styles.label}>
                <User size={14} color={blockState.blocked ? '#555' : '#F59E0B'} />
                <span>Identifiant</span>
              </label>
              <div style={{
                ...styles.inputWrap,
                borderColor: blockState.blocked
                  ? 'rgba(239,68,68,0.3)'
                  : focusedField === 'identifier'
                    ? 'rgba(245,158,11,0.5)'
                    : 'rgba(255,255,255,0.08)',
                opacity: blockState.blocked ? 0.6 : 1,
              }}>
                <input
                  className="login-input"
                  type="text"
                  value={identifier}
                  onChange={handleIdentifierChange}
                  onFocus={() => setFocusedField('identifier')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Email ou nom d'utilisateur"
                  style={styles.input}
                  required
                  disabled={isFormDisabled}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div style={styles.fieldWrap}>
              <label style={styles.label}>
                <Lock size={14} color={blockState.blocked ? '#555' : '#F59E0B'} />
                <span>Mot de passe</span>
              </label>
              <div style={{
                ...styles.inputWrap,
                borderColor: blockState.blocked
                  ? 'rgba(239,68,68,0.3)'
                  : focusedField === 'password'
                    ? 'rgba(245,158,11,0.5)'
                    : 'rgba(255,255,255,0.08)',
                opacity: blockState.blocked ? 0.6 : 1,
              }}>
                <input
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  style={styles.input}
                  required
                  disabled={isFormDisabled}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  disabled={isFormDisabled}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Bouton submit */}
            <button
              type="submit"
              className="login-btn"
              style={{
                ...styles.button,
                ...(loading ? styles.buttonLoading : {}),
                ...(blockState.blocked ? styles.buttonBlocked : {}),
              }}
              disabled={isFormDisabled}
            >
              {loading ? (
                <div style={styles.loadingInner}>
                  <div style={styles.spinner}></div>
                  <span>Connexion en cours...</span>
                </div>
              ) : blockState.blocked ? (
                <div style={styles.loadingInner}>
                  <Clock size={18} color="#EF4444" />
                  <span style={{ color: '#EF4444' }}>Bloqué · {countdown}</span>
                </div>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Se connecter</span>
                  <ArrowIndicator />
                </>
              )}
            </button>
          </form>

          {/* ── FOOTER ── */}
          <div style={styles.cardFooter}>
            <div style={styles.footerLine}></div>
            <div style={styles.footerContent}>
              <Zap size={12} color="#F59E0B" />
              <span style={styles.footerText}>Système de pointage intelligent</span>
            </div>
            <p style={styles.footerDate}>
              {currentTime.toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div style={styles.bottomBrand}>
          <EnCheckBrandMark size={16} />
          <span>EN-CHECK · On gère !</span>
        </div>
      </div>
    </>
  )
}

// ─── Flèche décorative dans le bouton ───
function ArrowIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px', opacity: 0.7 }}>
      <div style={{
        width: '16px', height: '2px',
        background: 'rgba(0,0,0,0.3)', borderRadius: '1px', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', right: '-2px', top: '-3px',
          width: '8px', height: '8px',
          borderTop: '2px solid rgba(0,0,0,0.3)',
          borderRight: '2px solid rgba(0,0,0,0.3)',
          transform: 'rotate(45deg)',
        }}></div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden', padding: '20px',
  },
  bgBase: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: '#06060B', zIndex: 0,
  },
  bgGrid: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `
      linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px', zIndex: 0,
  },
  bgOrb1: {
    position: 'fixed', top: '10%', left: '15%',
    width: '400px', height: '400px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
    animation: 'orbFloat1 15s ease-in-out infinite',
    pointerEvents: 'none', zIndex: 0,
  },
  bgOrb2: {
    position: 'fixed', bottom: '5%', right: '10%',
    width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)',
    animation: 'orbFloat2 18s ease-in-out infinite',
    pointerEvents: 'none', zIndex: 0,
  },
  bgOrb3: {
    position: 'fixed', top: '50%', left: '60%',
    width: '300px', height: '300px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)',
    animation: 'orbFloat1 12s ease-in-out infinite reverse',
    pointerEvents: 'none', zIndex: 0,
  },
  diagonalLine1: {
    position: 'fixed', top: '-50%', left: '30%',
    width: '1px', height: '200%',
    background: 'linear-gradient(180deg, transparent, rgba(245,158,11,0.06), transparent)',
    transform: 'rotate(35deg)', pointerEvents: 'none', zIndex: 0,
  },
  diagonalLine2: {
    position: 'fixed', top: '-50%', right: '25%',
    width: '1px', height: '200%',
    background: 'linear-gradient(180deg, transparent, rgba(99,102,241,0.04), transparent)',
    transform: 'rotate(-25deg)', pointerEvents: 'none', zIndex: 0,
  },
  card: {
    background: 'rgba(12,12,20,0.85)',
    backdropFilter: 'blur(40px)',
    borderRadius: '28px',
    border: '1px solid rgba(245,158,11,0.12)',
    padding: 'clamp(28px, 6vw, 44px)',
    width: '100%', maxWidth: '420px',
    position: 'relative', zIndex: 10,
    boxShadow: `
      0 30px 80px rgba(0,0,0,0.5),
      0 0 0 1px rgba(255,255,255,0.03),
      inset 0 1px 0 rgba(255,255,255,0.04)
    `,
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
    background: 'linear-gradient(90deg, transparent 10%, rgba(245,158,11,0.5) 50%, transparent 90%)',
  },
  logoSection: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '16px', marginBottom: '24px',
  },
  logoOuter: {
    position: 'relative', width: '80px', height: '80px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoRing: {
    position: 'absolute', inset: '0', borderRadius: '20px',
    border: '2px solid rgba(245,158,11,0.15)',
  },
  logoInner: {
    width: '64px', height: '64px', borderRadius: '16px',
    background: 'rgba(245,158,11,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: 'float 6s ease-in-out infinite',
  },
  titleBlock: { textAlign: 'center' },
  title: {
    color: '#FFFFFF',
    fontSize: 'clamp(28px, 6vw, 36px)',
    fontWeight: '200', letterSpacing: '8px',
    margin: '0 0 8px 0', lineHeight: '1',
  },
  subtitleRow: {
    display: 'flex', alignItems: 'center',
    gap: '12px', justifyContent: 'center',
  },
  subtitleLine: { width: '24px', height: '1px', background: 'rgba(245,158,11,0.3)' },
  subtitle: { color: '#F59E0B', fontSize: '10px', letterSpacing: '5px', fontWeight: '600' },
  timeDisplay: { display: 'flex', alignItems: 'baseline', gap: '2px', marginTop: '4px' },
  timeText: {
    color: 'rgba(255,255,255,0.3)', fontSize: '14px', fontWeight: '200',
    letterSpacing: '2px', fontVariantNumeric: 'tabular-nums',
  },
  timeSeconds: { color: 'rgba(245,158,11,0.4)', fontSize: '11px', fontWeight: '500' },
  separator: {
    display: 'flex', alignItems: 'center',
    gap: '12px', marginBottom: '20px',
  },
  separatorLine: {
    flex: 1, height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
  },
  blockBanner: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 16px', marginBottom: '16px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '14px',
    animation: 'fadeIn 0.3s ease',
  },
  blockBannerIcon: {
    width: '36px', height: '36px', borderRadius: '10px',
    background: 'rgba(239,68,68,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  blockBannerTitle: { color: '#EF4444', fontSize: '13px', fontWeight: '700', margin: '0 0 4px 0' },
  blockBannerSub: { color: '#888', fontSize: '12px', margin: 0, lineHeight: '1.4' },
  warningBanner: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', marginBottom: '16px',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '10px',
    color: '#F59E0B', fontSize: '12px', fontWeight: '600',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: {
    display: 'flex', alignItems: 'center', gap: '8px',
    color: '#888', fontSize: '12px', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  inputWrap: {
    position: 'relative', borderRadius: '14px', border: '1px solid',
    background: 'rgba(255,255,255,0.03)', transition: 'all 0.3s ease', overflow: 'hidden',
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '16px 18px', paddingRight: '50px',
    background: 'transparent', border: 'none', outline: 'none',
    color: '#E5E5E5', fontSize: '15px', fontFamily: 'inherit', letterSpacing: '0.3px',
  },
  eyeBtn: {
    position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', padding: '8px', color: '#666', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease',
  },
  button: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', padding: '16px 24px',
    background: 'linear-gradient(135deg, #F59E0B, #D97706, #B45309)',
    backgroundSize: '200% 200%', animation: 'gradientFlow 4s ease infinite',
    color: '#000', borderRadius: '14px', fontSize: '15px', fontWeight: '700',
    border: 'none', cursor: 'pointer', marginTop: '8px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', letterSpacing: '0.5px',
    position: 'relative', overflow: 'hidden', fontFamily: 'inherit',
  },
  buttonLoading: {
    background: 'rgba(245,158,11,0.3)', animation: 'none',
  },
  buttonBlocked: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    animation: 'none', color: '#EF4444',
  },
  loadingInner: { display: 'flex', alignItems: 'center', gap: '10px', color: '#F59E0B' },
  spinner: {
    width: '18px', height: '18px',
    border: '2px solid rgba(245,158,11,0.3)',
    borderTopColor: '#F59E0B', borderRadius: '50%',
    animation: 'spinSlow 0.8s linear infinite',
  },
  cardFooter: { marginTop: '28px', textAlign: 'center' },
  footerLine: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.12), transparent)',
    marginBottom: '16px',
  },
  footerContent: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '6px', marginBottom: '6px',
  },
  footerText: { color: '#555', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' },
  footerDate: { color: '#444', fontSize: '11px', margin: 0, textTransform: 'capitalize' },
  bottomBrand: {
    position: 'fixed', bottom: '20px',
    display: 'flex', alignItems: 'center', gap: '6px',
    color: 'rgba(255,255,255,0.15)', fontSize: '11px', letterSpacing: '2px', zIndex: 10,
  },
}