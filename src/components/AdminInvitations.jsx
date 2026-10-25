import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { accountRpc } from '../services/adminAccounts'
import AdminExplication from './AdminExplication'
const labels = {
  sending: 'Envoi en cours',
  sent: 'Envoyée',
  failed: 'Échec d’envoi',
  cancelled: 'Annulée',
  accepted: 'Acceptée',
}
export default function AdminInvitations({ enterprises = [] }) {
  const [items, setItems] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('')
  const [email, setEmail] = useState(''),
    [first, setFirst] = useState(''),
    [last, setLast] = useState(''),
    [enterprise, setEnterprise] = useState('')
  const lock = useRef(false)
  const load = useCallback(async () => {
    const result = await supabase
      .from('admin_invitations')
      .select('id,email,state,expires_at,last_sent_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (result.error)
      throw new Error(
        'Registre des invitations indisponible : vérifiez la migration et vos droits.',
      )
    setItems(result.data || [])
  }, [])
  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])
  async function run(action) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function send(body) {
    const { data, error } = await supabase.functions.invoke(
      'admin-invitations',
      { body },
    )
    if (error || !data?.sent)
      throw new Error(
        'Envoi non confirmé. Actualisez le registre ; vérifiez le service e-mail et le délai de renvoi avant de réessayer.',
      )
    setNotice(
      'Invitation transmise au fournisseur e-mail. Activation valable sept jours, sous réserve de validité du lien Auth.',
    )
  }
  return (
    <details id="admin-invitations" className="aa-panel aa-workflow">
      <summary>Invitations par e-mail</summary>
      <AdminExplication titre="Ce que reçoit la personne invitée">
        <p>
          Crée un administrateur standard pour l’entreprise choisie, seulement
          après validation de l’adresse. Aucun mot de passe n’est envoyé : le
          lien d’activation expire de lui-même et se révoque.
        </p>
      </AdminExplication>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            await send({
              email,
              first_name: first,
              last_name: last,
              enterprise_id: enterprise,
            })
            setEmail('')
            setFirst('')
            setLast('')
          })
        }}
      >
        <label>
          Prénom
          <input
            required
            maxLength={80}
            autoComplete="given-name"
            placeholder="Ex. : Awa"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
        </label>
        <label>
          Nom
          <input
            required
            maxLength={80}
            autoComplete="family-name"
            placeholder="Ex. : Dossou"
            value={last}
            onChange={(e) => setLast(e.target.value)}
          />
        </label>
        <label>
          E-mail
          <input
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="Ex. : awa.dossou@entreprise.bj"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Entreprise
          <select
            required
            value={enterprise}
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
        <button className="aa-bouton-plein" disabled={busy}>
          Envoyer l’invitation
        </button>
      </form>
      <button className="aa-bouton-creux" disabled={busy} onClick={() => run(load)}>
        Actualiser
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {items.length > 0 && (
        <ul className="aa-invitations-liste">
          {items.map((item) => {
            const expiree =
              item.state === 'sent' && Date.parse(item.expires_at) < Date.now()
            return (
              <li className="aa-invitation" key={item.id}>
                <strong>{item.email}</strong>
                <span
                  className="aa-invitation-etat"
                  data-etat={expiree ? 'expired' : item.state}
                >
                  {expiree ? 'Expirée' : labels[item.state] || item.state}
                </span>
                <span className="aa-invitation-actions">
                  {['sent', 'failed'].includes(item.state) && (
                    <button
                      className="aa-bouton-creux"
                      disabled={
                        busy || Date.now() - Date.parse(item.last_sent_at) < 60000
                      }
                      onClick={() => run(() => send({ id: item.id }))}
                    >
                      Renvoyer
                    </button>
                  )}
                  {['sent', 'failed', 'sending'].includes(item.state) && (
                    <button
                      className="aa-bouton-creux"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          accountRpc('encheck_invitation_cancel', { p_id: item.id }),
                        )
                      }
                    >
                      Annuler
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </details>
  )
}
