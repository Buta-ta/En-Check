// src/pages/employee/EmployeeLogin.jsx
// ═══════════════════════════════════════════════════════════
// 🔐 PAGE DE CONNEXION EMPLOYÉ — SÉCURISÉE
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Footprints, User, Lock, LogIn, Eye, EyeOff, Phone, Mail, Zap, ShieldAlert, Clock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import EmployeeAuthService from '../../services/employeeAuthService'
import ConnectionLogService from '../../services/connectionLogService'

export default function EmployeeLogin() {
  // ═══════════════════════════════════════════════════════════
  // 📦 STATE
  // ═══════════════════════════════════════════════════════════
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // 🔒 État sécurité
  const [blocked, setBlocked] = useState(false)
  const [blockCountdown, setBlockCountdown] = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const navigate = useNavigate()
  const countdownRef = useRef(null)

  // ═══════════════════════════════════════════════════════════
  // 🔄 REDIRECT SI DÉJÀ CONNECTÉ + HORLOGE
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (EmployeeAuthService.isLoggedIn()) {
      navigate('/employee/dashboard', { replace: true })
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [navigate])

  // ═══════════════════════════════════════════════════════════
  // ⏱️ VÉRIFIER LE BLOCAGE QUAND L'IDENTIFIER CHANGE
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!identifier.trim()) {
      setBlocked(false)
      setBlockCountdown(0)
      setAttemptsLeft(null)
      setErrorMessage('')
      return
    }

    const status = EmployeeAuthService.getBlockStatus(identifier)

    if (status.blocked) {
      setBlocked(true)
      setErrorMessage('Compte temporairement bloqué suite à trop de tentatives.')
      startCountdown(status.remainingMs)
    } else {
      setBlocked(false)
      setBlockCountdown(0)
      if (status.attempts > 0) {
        setAttemptsLeft(5 - status.attempts)
      } else {
        setAttemptsLeft(null)
      }
    }
  }, [identifier])

  // ═══════════════════════════════════════════════════════════
  // ⏱️ COUNTDOWN DU BLOCAGE
  // ═══════════════════════════════════════════════════════════
  const startCountdown = useCallback((remainingMs) => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
    }

    const endTime = Date.now() + remainingMs

    const tick = () => {
      const left = Math.max(0, endTime - Date.now())
      setBlockCountdown(Math.ceil(left / 1000))

      if (left <= 0) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
        setBlocked(false)
        setBlockCountdown(0)
        setErrorMessage('')
        setAttemptsLeft(null)
      }
    }

    tick()
    countdownRef.current = setInterval(tick, 1000)
  }, [])

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════
  // 📝 FORMAT COUNTDOWN
  // ═══════════════════════════════════════════════════════════
  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ═══════════════════════════════════════════════════════════
  // 🔐 SOUMISSION DU FORMULAIRE
  // ═══════════════════════════════════════════════════════════
  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    // Double vérification du blocage avant envoi
    if (blocked) {
      setErrorMessage('Veuillez attendre la fin du blocage.')
      return
    }

    const blockStatus = EmployeeAuthService.getBlockStatus(identifier)
    if (blockStatus.blocked) {
      setBlocked(true)
      setErrorMessage('Compte temporairement bloqué.')
      startCountdown(blockStatus.remainingMs)
      return
    }

    // Validation côté UI
    const trimmedId = identifier.trim()
    const trimmedPwd = password.trim()

    if (!trimmedId || !trimmedPwd) {
      toast.error('Veuillez remplir tous les champs')
      return
    }

    if (trimmedPwd.length < 4) {
      setErrorMessage('Mot de passe trop court.')
      return
    }

    setLoading(true)

    try {
      const result = await EmployeeAuthService.login(trimmedId, trimmedPwd)

      if (result.success) {
        // ✅ Logger la connexion réussie
        await ConnectionLogService.logEmployeeConnection(result.employee, true)

        toast.success(`Bienvenue ${result.employee.first_name} !`)
        navigate('/employee/dashboard', { replace: true })
      } else {
        // ✅ Logger l'échec
        await ConnectionLogService.logEmployeeConnection(
          { email: trimmedId.includes('@') ? trimmedId : null, phone: trimmedId },
          false,
          result.error
        )

        setErrorMessage(result.error)

        if (result.blocked) {
          setBlocked(true)
          startCountdown(result.remainingMs || 5 * 60 * 1000)
          setAttemptsLeft(0)
        } else {
          // Extraire le nombre d'essais restants du message
          const match = result.error?.match(/(\d+) essai/)
          if (match) {
            setAttemptsLeft(parseInt(match[1], 10))
          }
        }

        toast.error(result.error)
      }
    } catch (err) {
      console.error('Erreur inattendue login:', err)
      toast.error('Erreur inattendue. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // Détecte si l'input est un email ou un téléphone
  const isEmail = identifier.includes('@')
  const isPhone = /^[+\d]/.test(identifier) && !identifier.includes('@')

  // Bouton désactivé si champs vides, loading ou bloqué
  const isSubmitDisabled = loading || blocked || !identifier.trim() || !password.trim()

  return (
    <>
      <style>{`
        @keyframes gradientFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes borderGlow {
          0%, 100% { border-color: rgba(16, 185, 129, 0.2); }
          50% { border-color: rgba(16, 185, 129, 0.5); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulseBlock {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes shakeError {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .emp-login-input:focus {
          border-color: #10B981 !important;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15) !important;
        }
        .emp-login-input::placeholder { color: #555; }
        .emp-login-btn:hover:not(:disabled) {
          transform: translateY(-2px) !important;
          box-shadow: 0 12px 40px rgba(16, 185, 129, 0.4) !important;
        }
        .emp-login-btn:active:not(:disabled) { transform: translateY(0) !important; }
        .emp-login-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .emp-eye-btn:hover {
          background: rgba(16, 185, 129, 0.15) !important;
          color: #10B981 !important;
        }
        .emp-login-card { animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
        .emp-admin-link:hover { color: #F59E0B !important; }
        .emp-error-shake { animation: shakeError 0.5s ease-in-out; }
        .emp-block-pulse { animation: pulseBlock 2s ease-in-out infinite; }
      `}</style>

      <div style={styles.container}>
        <div style={styles.bgBase}></div>
        <div style={styles.bgGrid}></div>
        <div style={styles.bgOrb1}></div>
        <div style={styles.bgOrb2}></div>

        <div className="emp-login-card" style={styles.card}>
          <div style={styles.cardGlow}></div>

          {/* ── LOGO ── */}
          <div style={styles.logoSection}>
            <div style={styles.logoOuter}>
              <div style={styles.logoRing}></div>
              <div style={styles.logoInner}>
                <Footprints size={36} color="#10B981" />
              </div>
            </div>

            <div style={styles.titleBlock}>
              <h1 style={styles.title}>EN-CHECK</h1>
              <div style={styles.subtitleRow}>
                <div style={styles.subtitleLine}></div>
                <span style={styles.subtitle}>ESPACE EMPLOYÉ</span>
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

          {/* ── SEPARATOR ── */}
          <div style={styles.separator}>
            <div style={styles.separatorLine}></div>
            <User size={14} color="#10B981" />
            <div style={styles.separatorLine}></div>
          </div>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* 🚨 BANNIÈRE BLOCAGE / ERREUR                          */}
          {/* ═══════════════════════════════════════════════════════ */}
          {(errorMessage || blocked) && (
            <div
              className={blocked ? 'emp-block-pulse' : 'emp-error-shake'}
              style={{
                ...styles.errorBanner,
                ...(blocked ? styles.errorBannerBlocked : styles.errorBannerWarning),
              }}
            >
              <div style={styles.errorHeader}>
                {blocked ? (
                  <ShieldAlert size={18} color="#EF4444" />
                ) : (
                  <AlertTriangle size={18} color="#F59E0B" />
                )}
                <span style={{
                  ...styles.errorText,
                  color: blocked ? '#FCA5A5' : '#FCD34D',
                }}>
                  {errorMessage}
                </span>
              </div>

              {/* Countdown si bloqué */}
              {blocked && blockCountdown > 0 && (
                <div style={styles.countdownSection}>
                  <Clock size={16} color="#EF4444" />
                  <span style={styles.countdownText}>
                    {formatCountdown(blockCountdown)}
                  </span>
                </div>
              )}

              {/* Barre d'essais restants */}
              {!blocked && attemptsLeft !== null && attemptsLeft > 0 && (
                <div style={styles.attemptsSection}>
                  <div style={styles.attemptsBar}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          ...styles.attemptDot,
                          background: i < attemptsLeft
                            ? 'rgba(245, 158, 11, 0.8)'
                            : 'rgba(239, 68, 68, 0.8)',
                          boxShadow: i < attemptsLeft
                            ? '0 0 6px rgba(245, 158, 11, 0.4)'
                            : '0 0 6px rgba(239, 68, 68, 0.3)',
                        }}
                      />
                    ))}
                  </div>
                  <span style={styles.attemptsText}>
                    {attemptsLeft} essai{attemptsLeft > 1 ? 's' : ''} restant{attemptsLeft > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── FORM ── */}
          <form onSubmit={handleLogin} style={styles.form} noValidate>
            {/* Identifier */}
            <div style={styles.fieldWrap}>
              <label style={styles.label}>
                {isPhone ? <Phone size={14} color="#10B981" /> : <Mail size={14} color="#10B981" />}
                <span>Email ou Téléphone</span>
              </label>
              <div style={{
                ...styles.inputWrap,
                borderColor: blocked
                  ? 'rgba(239, 68, 68, 0.2)'
                  : focusedField === 'identifier'
                    ? 'rgba(16, 185, 129, 0.5)'
                    : 'rgba(255,255,255,0.08)',
                opacity: blocked ? 0.5 : 1,
              }}>
                <input
                  className="emp-login-input"
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value)
                    setErrorMessage('')
                  }}
                  onFocus={() => setFocusedField('identifier')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="email@exemple.com ou +221 77..."
                  style={{
                    ...styles.input,
                    cursor: blocked ? 'not-allowed' : 'text',
                  }}
                  required
                  autoComplete="username"
                  disabled={loading || blocked}
                />
              </div>
              {identifier && !errorMessage && (
                <span style={styles.identifierHint}>
                  {isEmail ? '📧 Connexion par email' : isPhone ? '📱 Connexion par téléphone' : ''}
                </span>
              )}
            </div>

            {/* Password */}
            <div style={styles.fieldWrap}>
              <label style={styles.label}>
                <Lock size={14} color="#10B981" />
                <span>Mot de passe</span>
              </label>
              <div style={{
                ...styles.inputWrap,
                borderColor: blocked
                  ? 'rgba(239, 68, 68, 0.2)'
                  : focusedField === 'password'
                    ? 'rgba(16, 185, 129, 0.5)'
                    : 'rgba(255,255,255,0.08)',
                opacity: blocked ? 0.5 : 1,
              }}>
                <input
                  className="emp-login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrorMessage('')
                  }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  style={{
                    ...styles.input,
                    cursor: blocked ? 'not-allowed' : 'text',
                  }}
                  required
                  autoComplete="current-password"
                  disabled={loading || blocked}
                />
                <button
                  type="button"
                  className="emp-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  disabled={blocked}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="emp-login-btn"
              style={{
                ...styles.button,
                ...(loading ? styles.buttonLoading : {}),
                ...(blocked ? styles.buttonBlocked : {}),
              }}
              disabled={isSubmitDisabled}
            >
              {loading ? (
                <div style={styles.loadingInner}>
                  <div style={styles.spinner}></div>
                  <span>Connexion en cours...</span>
                </div>
              ) : blocked ? (
                <div style={styles.loadingInner}>
                  <ShieldAlert size={18} />
                  <span>Bloqué — {formatCountdown(blockCountdown)}</span>
                </div>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Se connecter</span>
                </>
              )}
            </button>
          </form>

          {/* ── FOOTER ── */}
          <div style={styles.cardFooter}>
            <div style={styles.footerLine}></div>
            <div style={styles.footerContent}>
              <Zap size={12} color="#10B981" />
              <span style={styles.footerText}>Espace dédié aux employés</span>
            </div>
            <p style={styles.footerDate}>
              {currentTime.toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>

            <button
              className="emp-admin-link"
              onClick={() => navigate('/login')}
              style={styles.adminLink}
            >
              Accès administrateur →
            </button>
          </div>
        </div>

        <div style={styles.bottomBrand}>
          <Footprints size={12} color="rgba(16, 185, 129, 0.4)" />
          <span>EN-CHECK v2.0</span>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
  },
  bgBase: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: '#06060B', zIndex: 0,
  },
  bgGrid: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `
      linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px', zIndex: 0,
  },
  bgOrb1: {
    position: 'fixed', top: '10%', left: '15%',
    width: '400px', height: '400px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%)',
    animation: 'float 15s ease-in-out infinite',
    pointerEvents: 'none', zIndex: 0,
  },
  bgOrb2: {
    position: 'fixed', bottom: '5%', right: '10%',
    width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.04) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  card: {
    background: 'rgba(12, 12, 20, 0.85)',
    backdropFilter: 'blur(40px)',
    borderRadius: '28px',
    border: '1px solid rgba(16, 185, 129, 0.12)',
    padding: 'clamp(28px, 6vw, 44px)',
    width: '100%', maxWidth: '420px',
    position: 'relative', zIndex: 10,
    boxShadow: `
      0 30px 80px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.03),
      inset 0 1px 0 rgba(255, 255, 255, 0.04)
    `,
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
    background: 'linear-gradient(90deg, transparent 10%, rgba(16, 185, 129, 0.5) 50%, transparent 90%)',
  },
  logoSection: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '16px', marginBottom: '24px',
  },
  logoOuter: {
    position: 'relative',
    width: '80px', height: '80px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoRing: {
    position: 'absolute', inset: '0', borderRadius: '20px',
    border: '2px solid rgba(16, 185, 129, 0.15)',
    animation: 'borderGlow 3s ease-in-out infinite',
  },
  logoInner: {
    width: '64px', height: '64px', borderRadius: '16px',
    background: 'rgba(16, 185, 129, 0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: 'float 6s ease-in-out infinite',
  },
  titleBlock: { textAlign: 'center' },
  title: {
    color: '#FFFFFF', fontSize: 'clamp(28px, 6vw, 36px)',
    fontWeight: '200', letterSpacing: '8px',
    margin: '0 0 8px 0', lineHeight: '1',
  },
  subtitleRow: {
    display: 'flex', alignItems: 'center',
    gap: '12px', justifyContent: 'center',
  },
  subtitleLine: {
    width: '24px', height: '1px',
    background: 'rgba(16, 185, 129, 0.3)',
  },
  subtitle: {
    color: '#10B981', fontSize: '10px',
    letterSpacing: '5px', fontWeight: '600',
  },
  timeDisplay: {
    display: 'flex', alignItems: 'baseline',
    gap: '2px', marginTop: '4px',
  },
  timeText: {
    color: 'rgba(255,255,255,0.3)', fontSize: '14px',
    fontWeight: '200', letterSpacing: '2px',
    fontVariantNumeric: 'tabular-nums',
  },
  timeSeconds: {
    color: 'rgba(16, 185, 129, 0.4)', fontSize: '11px', fontWeight: '500',
  },
  separator: {
    display: 'flex', alignItems: 'center',
    gap: '12px', marginBottom: '28px',
  },
  separatorLine: {
    flex: 1, height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
  },

  // ═══════════════════════════════════════════════════════
  // 🚨 STYLES ERREUR / BLOCAGE
  // ═══════════════════════════════════════════════════════
  errorBanner: {
    borderRadius: '14px',
    padding: '14px 16px',
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  errorBannerBlocked: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
  },
  errorBannerWarning: {
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
  },
  errorHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  errorText: {
    fontSize: '13px',
    lineHeight: '1.4',
    fontWeight: '500',
    flex: 1,
  },
  countdownSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px 0',
  },
  countdownText: {
    fontSize: '28px',
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#EF4444',
    letterSpacing: '3px',
  },
  attemptsSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  attemptsBar: {
    display: 'flex',
    gap: '4px',
    width: '100%',
  },
  attemptDot: {
    flex: 1,
    height: '4px',
    borderRadius: '2px',
    transition: 'all 0.3s ease',
  },
  attemptsText: {
    fontSize: '11px',
    color: 'rgba(245, 158, 11, 0.7)',
    letterSpacing: '0.5px',
  },

  // ═══════════════════════════════════════════════════════
  // 📝 FORM
  // ═══════════════════════════════════════════════════════
  form: {
    display: 'flex', flexDirection: 'column', gap: '20px',
  },
  fieldWrap: {
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  label: {
    display: 'flex', alignItems: 'center', gap: '8px',
    color: '#888', fontSize: '12px', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  inputWrap: {
    position: 'relative', borderRadius: '14px',
    border: '1px solid', background: 'rgba(255, 255, 255, 0.03)',
    transition: 'all 0.3s ease', overflow: 'hidden',
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '16px 18px', paddingRight: '50px',
    background: 'transparent', border: 'none', outline: 'none',
    color: '#E5E5E5', fontSize: '15px',
    fontFamily: 'inherit', letterSpacing: '0.3px',
  },
  identifierHint: {
    fontSize: '11px', color: '#10B981', opacity: 0.7,
    paddingLeft: '4px',
  },
  eyeBtn: {
    position: 'absolute', right: '6px', top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', padding: '8px',
    color: '#666', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  button: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', padding: '16px 24px',
    background: 'linear-gradient(135deg, #10B981, #059669, #047857)',
    backgroundSize: '200% 200%',
    animation: 'gradientFlow 4s ease infinite',
    color: '#FFF', borderRadius: '14px',
    fontSize: '15px', fontWeight: '700',
    border: 'none', cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    letterSpacing: '0.5px',
  },
  buttonLoading: {
    background: 'rgba(16, 185, 129, 0.3)',
    animation: 'none',
  },
  buttonBlocked: {
    background: 'rgba(239, 68, 68, 0.2)',
    animation: 'none',
    cursor: 'not-allowed',
  },
  loadingInner: {
    display: 'flex', alignItems: 'center', gap: '10px', color: '#10B981',
  },
  spinner: {
    width: '18px', height: '18px',
    border: '2px solid rgba(16, 185, 129, 0.3)',
    borderTopColor: '#10B981', borderRadius: '50%',
    animation: 'spinSlow 0.8s linear infinite',
  },
  cardFooter: {
    marginTop: '28px', textAlign: 'center',
  },
  footerLine: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.12), transparent)',
    marginBottom: '16px',
  },
  footerContent: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '6px', marginBottom: '6px',
  },
  footerText: {
    color: '#555', fontSize: '11px', letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  footerDate: {
    color: '#444', fontSize: '11px', margin: '0 0 16px 0',
    textTransform: 'capitalize',
  },
  adminLink: {
    background: 'none', border: 'none',
    color: '#555', fontSize: '11px',
    cursor: 'pointer', fontFamily: 'inherit',
    letterSpacing: '1px',
    transition: 'color 0.2s ease',
  },
  bottomBrand: {
    position: 'fixed', bottom: '20px',
    display: 'flex', alignItems: 'center', gap: '6px',
    color: 'rgba(255,255,255,0.15)',
    fontSize: '11px', letterSpacing: '2px', zIndex: 10,
  },
}