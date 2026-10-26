import { adminMfaErrorMessage } from '../services/adminMfaErrors'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import AdminExplication from './AdminExplication'
import { accountRpc } from '../services/adminAccounts'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
export default function AdminMfaSettings({
  statusRpc = 'encheck_account_security_status',
}) {
  const [factors, setFactors] = useState([]),
    [enrollment, setEnrollment] = useState(null),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true)
  const [serverReady, setServerReady] = useState(false)
  const lock = useRef(false),
    { ensureMfa, challenge } = useAdminMfaCheckpoint()
  async function load() {
    const [{ data, error: err }, status] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      accountRpc(statusRpc, {}),
    ])
    if (err) throw new Error('Lecture des facteurs indisponible.')
    setFactors(data?.totp || [])
    setServerReady(status?.rest_guard_active === true)
  }
  useEffect(() => {
    let alive = true
    accountRpc(statusRpc, {})
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
  }, [statusRpc])
  async function run(action) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (err) {
      setError(adminMfaErrorMessage(err))
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
      try {
        if (!/^\d{6}$/.test(code)) throw { code: 'mfa_code_format' }
        const result = await supabase.auth.mfa.challengeAndVerify({
          factorId: enrollment.id,
          code,
        })
        if (result.error) throw result.error
        const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (level.error || level.data?.currentLevel !== 'aal2')
          throw { code: 'mfa_assurance_not_confirmed' }
        setEnrollment(null)
        setNotice(
          'Facteur vérifié. Gardez cette session ouverte pendant le test de votre prochaine connexion.',
        )
        try {
          await load()
        } catch {
          setError(
            'Le facteur a été vérifié, mais la liste ou les services Admin n’ont pas pu être actualisés. Actualisez la configuration ; ne recréez pas le facteur pour cette seule erreur.',
          )
        }
      } finally {
        setCode('')
      }
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
  // Reprise d’une inscription déjà scannée (QR perdu après rechargement) :
  // seule la saisie du code reste nécessaire, sans nouveau QR.
  const resume = (f) => {
    setEnrollment({ id: f.id, totp: null })
    setCode('')
    setError('')
    setNotice('')
  }
  const pending = factors.some((f) => f.status !== 'verified')
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
      <AdminExplication titre="Quelle application, et comment la garder">
        <p>
          Utilisez une application d’authentification. Conservez un second
          facteur vérifié si vous souhaitez une solution de secours.
        </p>
      </AdminExplication>
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
              {f.status !== 'verified' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => resume(f)}
                >
                  Saisir le code
                </button>
              )}
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
      {pending && !enrollment && !loading && (
        <p className="aa-notice">
          Inscription en attente : si vous avez déjà scanné le QR, choisissez
          « Saisir le code » dans la liste. Sinon retirez l’ancienne entrée,
          puis « Ajouter un authentificateur ».
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {enrollment ? (
        <form onSubmit={verify}>
          <AdminExplication
            titre={
              enrollment.totp
                ? 'Comment inscrire l’authentificateur'
                : 'Terminer l’inscription déjà scannée'
            }
            ouvert
          >
            {enrollment.totp ? (
              <p>
                QR code confidentiel : scannez-le avec votre application, puis
                confirmez le code à six chiffres de cette même entrée, pas celui
                d’une ancienne inscription. Vérifiez que le téléphone utilise
                la date et l’heure automatiques.
              </p>
            ) : (
              <p>
                Utilisez l’entrée déjà présente dans votre application
                d’authentification (même nom que le facteur « À terminer ») et
                saisissez son code à six chiffres. Vérifiez que le téléphone
                utilise la date et l’heure automatiques.
              </p>
            )}
          </AdminExplication>
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
          {enrollment.totp && (
            <details>
              <summary>
                Le scan ne passe pas ? Saisie manuelle de la clé
              </summary>
              <p>
                Dans votre application d’authentification, choisissez
                « ajout manuel / TOTP » et saisissez cette clé telle quelle :
              </p>
              <code>{enrollment.totp.secret}</code>
            </details>
          )}
          <label>
            Code de vérification
            <input
              disabled={busy}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              maxLength={6}
              placeholder="123 456"
              aria-label="Code de vérification à six chiffres"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <button
            className="aa-bouton-plein"
            disabled={busy || code.length !== 6}
          >
            Activer ce facteur
          </button>
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
