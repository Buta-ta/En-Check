import { useTheme } from '../contexts/ThemeContext'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { accountRpc } from '../services/adminAccounts'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
import './AdminAccounts.css'

export default function AdminRecovery({ mode = 'request' }) {
  const { darkMode } = useTheme()
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [done, setDone] = useState(false)
  const lock = useRef(false)
  const { ensureMfa, challenge } = useAdminMfaCheckpoint()
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'request') {
        // Identical message whether an account exists or the provider rejects it.
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/admin/recuperation`,
        })
        setMessage(
          'Si cette adresse peut recevoir un lien, un e-mail de récupération lui sera envoyé. Consultez aussi les indésirables.',
        )
        setDone(true)
      } else {
        if (
          password !== confirm ||
          password.length < 12 ||
          new TextEncoder().encode(password).length > 72
        )
          throw new Error(
            'Choisissez deux mots de passe identiques, de 12 caractères minimum et 72 octets maximum.',
          )
        const { data, error } = await supabase.auth.getUser()
        if (error || !data.user)
          throw new Error('Lien expiré ou invalide. Demandez un nouveau lien.')
        await ensureMfa()
        const result = await supabase.auth.updateUser({ password })
        if (result.error)
          throw new Error(
            'Mot de passe non confirmé. Vérifiez le lien et les règles de sécurité.',
          )
        if (mode === 'invite') await accountRpc('encheck_invitation_accept', {})
        setPassword('')
        setConfirm('')
        const logout = await supabase.auth
          .signOut({ scope: 'local' })
          .catch(() => ({ error: true }))
        localStorage.removeItem('admin')
        setDone(true)
        if (logout.error) {
          setMessage(
            'Opération enregistrée, mais déconnexion non confirmée. Fermez cette session avant de vous reconnecter.',
          )
          return
        }
        setMessage(
          mode === 'invite'
            ? 'Compte activé. Vous pouvez maintenant vous connecter.'
            : 'Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe.',
        )
      }
    } catch (error) {
      setPassword('')
      setConfirm('')
      setMessage(
        mode === 'request'
          ? 'Si cette adresse peut recevoir un lien, un e-mail de récupération lui sera envoyé.'
          : error.message,
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (challenge) return challenge
  return (
    <main className={`aa-page ${darkMode ? 'aa-dark' : ''}`}>
      <section className="aa-panel aa-security-check">
        <span className="aa-eyebrow">ACCÈS AU COMPTE</span>
        <h1>
          {mode === 'invite' ? 'Activer mon compte' : 'Récupérer mon accès'}
        </h1>
        {!done && (
          <form onSubmit={submit}>
            {mode === 'request' ? (
              <label>
                Adresse e-mail
                <input
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={254}
                  placeholder="Ex. : awa.dossou@entreprise.bj"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            ) : (
              <>
                <p>
                  Choisissez votre mot de passe personnel. La vérification MFA
                  reste requise si elle est activée.
                </p>
                <label>
                  Nouveau mot de passe
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    placeholder="Au moins 12 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Confirmer le mot de passe
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    placeholder="Répétez le mot de passe"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              </>
            )}
            <button className="aa-primary" disabled={busy}>
              {busy
                ? 'Vérification…'
                : mode === 'request'
                  ? 'Recevoir un lien'
                  : 'Enregistrer et continuer'}
            </button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
        <Link to="/login">Retour à la connexion</Link>
        {mode !== 'request' && (
          <p>
            <Link to="/admin/mot-de-passe-oublie">
              Demander un nouveau lien
            </Link>
          </p>
        )}
      </section>
    </main>
  )
}
