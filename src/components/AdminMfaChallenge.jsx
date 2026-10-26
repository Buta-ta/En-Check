import { adminMfaErrorMessage } from '../services/adminMfaErrors'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import '../pages/AdminAccounts.css'
export default function AdminMfaChallenge({ onVerified, onCancel }) {
  const [factors, setFactors] = useState([]),
    [factor, setFactor] = useState(''),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const lock = useRef(false)
  useEffect(() => {
    let alive = true
    supabase.auth.mfa
      .listFactors()
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) {
          setError('Impossible de lire les facteurs de sécurité.')
          return
        }
        const valid = (data?.totp || []).filter((f) => f.status === 'verified')
        setFactors(valid)
        setFactor(valid[0]?.id || '')
        if (!valid.length)
          setError(
            'Aucun facteur vérifié disponible. Contactez votre superadministrateur.',
          )
      })
      .catch(() => {
        if (alive) setError('Service de sécurité indisponible.')
      })
    return () => {
      alive = false
    }
  }, [])
  async function verify(event) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      if (!/^\d{6}$/.test(code) || !factors.some((f) => f.id === factor))
        throw { code: 'mfa_code_format' }
      const result = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      })
      if (result.error) throw result.error
      const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (level.error || level.data?.currentLevel !== 'aal2')
        throw { code: 'mfa_assurance_not_confirmed' }
      setCode('')
      await onVerified()
    } catch (err) {
      setCode('')
      setError(adminMfaErrorMessage(err))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <main className="aa-page">
      <section className="aa-panel aa-security-check">
        <span className="aa-eyebrow">VÉRIFICATION DE SÉCURITÉ</span>
        <h1>Confirmer votre connexion</h1>
        <p>
          Saisissez le code de votre application d’authentification. Aucun accès
          à la page n’est accordé avant validation.
        </p>
        <form onSubmit={verify}>
          {factors.length > 1 && (
            <label>
              Application
              <select
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                disabled={busy}
              >
                {factors.map((f) => (
                  <option value={f.id} key={f.id}>
                    {f.friendly_name || 'Authentificateur'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Code à six chiffres
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={busy}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="aa-primary" disabled={busy || !factor}>
            Vérifier
          </button>
          <button type="button" onClick={onCancel} disabled={busy}>
            Annuler et se déconnecter
          </button>
        </form>
      </section>
    </main>
  )
}
