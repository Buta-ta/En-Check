import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { accountRpc } from '../services/adminAccounts'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
export default function AdminMfaSettings() {
  const [factors, setFactors] = useState([]),
    [enrollment, setEnrollment] = useState(null),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true)
  const [serverReady, setServerReady] = useState(false)
  const lock = useRef(false),
    { ensureMfa, challenge } = useAdminMfaCheckpoint()
  async function load() {
    const [{ data, error: err }, status] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      accountRpc('encheck_account_security_status', {}),
    ])
    if (err) throw new Error('Lecture des facteurs indisponible.')
    setFactors(data?.totp || [])
    setServerReady(status?.rest_guard_active === true)
  }
  useEffect(() => {
    let alive = true
    accountRpc('encheck_account_security_status', {})
      .then((status) => {
        if (alive) setServerReady(status?.rest_guard_active === true)
      })
      .catch(() => {
        if (alive) setServerReady(false)
      })
    supabase.auth.mfa
      .listFactors()
      .then(({ data, error: err }) => {
        if (alive) {
          if (err) setError('Lecture des facteurs indisponible.')
          else setFactors(data?.totp || [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (alive) {
          setError('Service indisponible.')
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [])
  async function run(action) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await action()
    } catch {
      setError(
        'Opération non confirmée. Vérifiez votre connexion et réessayez.',
      )
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  const start = () =>
    run(async () => {
      if (!serverReady)
        throw new Error('Activer le contrôle serveur avant inscription.')
      await ensureMfa()
      const result = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `En-Check ${new Date().toISOString().slice(0, 19)}`,
      })
      if (result.error) throw result.error
      setEnrollment(result.data)
      setCode('')
    })
  async function verify(event) {
    event.preventDefault()
    await run(async () => {
      if (!/^\d{6}$/.test(code)) throw Error()
      const result = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.id,
        code,
      })
      if (result.error) throw result.error
      setEnrollment(null)
      setCode('')
      await load()
    })
  }
  const remove = (id) =>
    run(async () => {
      await ensureMfa()
      const result = await supabase.auth.mfa.unenroll({ factorId: id })
      if (result.error) throw result.error
      setEnrollment(null)
      setCode('')
      await load()
    })
  if (challenge) return challenge
  const qr = enrollment?.totp?.qr_code
  return (
    <section className="aa-mfa-settings">
      <h3>Double authentification</h3>
      {!serverReady && (
        <p className="aa-notice">
          Nouvelle inscription désactivée tant que le contrôle serveur REST/RPC
          n’est pas activé.
        </p>
      )}
      <button type="button" disabled={busy} onClick={() => run(load)}>
        Actualiser la configuration
      </button>
      <p>
        Utilisez une application d’authentification. Conservez un second facteur
        vérifié si vous souhaitez une solution de secours.
      </p>
      {loading ? (
        <p role="status">Lecture des facteurs…</p>
      ) : (
        <ul>
          {factors.map((f) => (
            <li key={f.id}>
              <span>
                {f.friendly_name || 'Authentificateur'} ·{' '}
                {f.status === 'verified' ? 'Vérifié' : 'À terminer'}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      'Retirer ce facteur ? Gardez un moyen de connexion disponible.',
                    )
                  )
                    remove(f.id)
                }}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
      {enrollment ? (
        <form onSubmit={verify}>
          <p>
            QR code confidentiel : scannez-le avec votre application, puis
            confirmez le code.
          </p>
          {qr && (
            <img
              className="aa-mfa-qr"
              alt="QR code confidentiel d’inscription à la double authentification"
              src={
                qr.startsWith('data:image/')
                  ? qr
                  : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`
              }
            />
          )}
          <details>
            <summary>Clé de configuration manuelle</summary>
            <code>{enrollment.totp.secret}</code>
          </details>
          <label>
            Code de vérification
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <button disabled={busy}>Activer ce facteur</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => remove(enrollment.id)}
          >
            Annuler l’inscription
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={busy || loading || !!error || !serverReady}
          onClick={start}
        >
          Ajouter un authentificateur
        </button>
      )}
      <p className="aa-footnote">
        Un facteur non confirmé ne protège pas la connexion. Aucun secret n’est
        enregistré dans les préférences du navigateur. La récupération sans
        aucun facteur nécessite une intervention vérifiée ; aucun contournement
        n’est proposé ici.
      </p>
    </section>
  )
}
