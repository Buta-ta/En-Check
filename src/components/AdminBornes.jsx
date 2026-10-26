import { useEffect, useRef, useState } from 'react'
import { accountRpc } from '../services/adminAccounts'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
import AdminExplication from './AdminExplication'

export default function AdminBornes({ enterprises = [] }) {
  const [rows, setRows] = useState(null),
    [device, setDevice] = useState(''),
    [enterprise, setEnterprise] = useState(''),
    [days, setDays] = useState(30),
    [reason, setReason] = useState(''),
    [secret, setSecret] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const lock = useRef(false)
  const { ensureMfa, challenge } = useAdminMfaCheckpoint()
  useEffect(() => {
    if (!secret) return
    const timer = setTimeout(() => setSecret(null), 120000)
    const hide = () => {
      if (document.hidden) setSecret(null)
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [secret])
  async function load() {
    const data = await accountRpc('encheck_bornes_lister', {})
    if (data?.ok !== true || !Array.isArray(data.bornes)) throw Error('invalid')
    setRows(data.bornes)
  }
  async function run(name, args) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setSecret(null)
    setMessage('')
    try {
      await ensureMfa()
      if (name) {
        const result = await accountRpc(name, args)
        if (result?.ok !== true) throw Error('refused')
        if (result.secret)
          setSecret({ value: result.secret, id: result.borne_id })
        setMessage(
          'Intervention enregistrée. Le secret ne sera pas conservé dans cet écran.',
        )
      }
      try {
        await load()
      } catch {
        setMessage(
          name
            ? 'Intervention enregistrée, mais liste non actualisée. Ne répétez pas la création.'
            : 'Liste indisponible. Vérifiez la migration et votre session MFA dans Mon compte.',
        )
      }
    } catch {
      setMessage(
        'Intervention refusée ou non confirmée. Vérifiez votre session MFA et le catalogue avant de réessayer.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (challenge) return challenge
  const invalid = busy || reason.trim().length < 5 || reason.length > 500
  return (
    <section className="aa-panel aa-workflow">
      <details
        onToggle={(e) => {
          if (!e.currentTarget.open) setSecret(null)
        }}
      >
        <summary>Bornes de pointage autorisées</summary>
        <AdminExplication titre="Ce que cette autorisation permet">
          <p>
            Une borne peut recevoir les employés actifs et les gabarits
            approuvés de son entreprise. Réservez cette autorisation aux
            appareils contrôlés. MFA obligatoire.
          </p>
          <p>
            Une révocation bloque les prochaines requêtes, pas une copie déjà
            téléchargée hors ligne. Le cache doit expirer au plus tard à la date
            renvoyée par le serveur.
          </p>
        </AdminExplication>
        <button type="button" disabled={busy} onClick={() => run()}>
          Charger les bornes avec vérification MFA
        </button>
        <label>
          Motif de l’intervention
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : installation de la tablette d’accueil"
          />
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (
              invalid ||
              !device.trim() ||
              !enterprise ||
              days < 1 ||
              days > 90
            )
              return
            run('encheck_borne_creer', {
              p_device_id: device.trim(),
              p_enterprise_id: enterprise,
              p_expire_le: new Date(Date.now() + days * 86400000).toISOString(),
              p_motif: reason.trim(),
            })
          }}
        >
          <label>
            Identifiant de l’appareil
            <input
              required
              maxLength={128}
              value={device}
              disabled={busy}
              onChange={(e) => setDevice(e.target.value)}
              placeholder="Identifiant affiché par la tablette"
            />
          </label>
          <label>
            Entreprise de la borne
            <select
              required
              value={enterprise}
              disabled={busy}
              onChange={(e) => setEnterprise(e.target.value)}
            >
              <option value="">Choisir une entreprise</option>
              {enterprises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Validité en jours
            <input
              type="number"
              required
              min={1}
              max={90}
              value={days}
              disabled={busy}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <button
            type="submit"
            disabled={invalid || !device.trim() || !enterprise}
          >
            Autoriser la borne
          </button>
        </form>
        {secret && (
          <section role="status">
            <p>
              Secret présenté une seule fois pour la borne {secret.id}. Il sera
              masqué après deux minutes ou en quittant cet écran. Transmettez-le
              par un canal sécurisé, jamais dans le journal.
            </p>
            <label>
              Secret de la borne
              <input
                type="text"
                readOnly
                autoComplete="off"
                value={secret.value}
              />
            </label>
            <button type="button" onClick={() => setSecret(null)}>
              Masquer le secret
            </button>
          </section>
        )}
        {message && <p role="status">{message}</p>}
        {rows && rows.length === 0 && (
          <p role="status">Aucune borne autorisée pour l’instant.</p>
        )}
        {rows && (
          <ul>
            {rows.map((b) => (
              <li key={b.id}>
                <strong>{b.device_id}</strong> ·{' '}
                {enterprises.find((e) => e.id === b.enterprise_id)?.name ||
                  b.enterprise_id}{' '}
                ·{' '}
                {b.revoque_le
                  ? 'Révoquée'
                  : new Date(b.expire_le) <= new Date()
                    ? 'Expirée'
                    : 'Autorisée'}{' '}
                · {new Date(b.expire_le).toLocaleString('fr-FR')}
                <button
                  disabled={
                    invalid ||
                    !!b.revoque_le ||
                    new Date(b.expire_le) <= new Date()
                  }
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Renouveler le secret de ${b.device_id} et invalider ses sessions actuelles ?`,
                      )
                    )
                      run('encheck_borne_secret_renouveler', {
                        p_borne_id: b.id,
                        p_motif: reason.trim(),
                      })
                  }}
                >
                  Renouveler le secret
                </button>
                <button
                  disabled={invalid || !!b.revoque_le}
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Révoquer l’accès de ${b.device_id} ?`))
                      run('encheck_borne_revoquer', {
                        p_borne_id: b.id,
                        p_motif: reason.trim(),
                      })
                  }}
                >
                  Révoquer la borne
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  )
}
