import AdminPermissionRoles from '../components/AdminPermissionRoles'
import AdminMfaRecovery from '../components/AdminMfaRecovery'
import AdminAccountOperations from '../components/AdminAccountOperations'
import AdminInvitations from '../components/AdminInvitations'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ShieldCheck, Users, ArrowLeft, SunMoon, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import PageCulturalBand from '../components/PageCulturalBand'
import EmployeeProfilePhoto from '../components/EmployeeProfilePhoto'
import {
  ADMIN_FIELDS,
  currentAdminAccount,
  accountRpc,
  filterAdminAccounts,
} from '../services/adminAccounts'
import './AdminAccounts.css'
import AdminAccountSessions from '../components/AdminAccountSessions'
import AdminAccountJournal from '../components/AdminAccountJournal'

const roleLabel = (role) =>
  ({
    super_admin: 'Superadministrateur',
    admin: 'Administrateur',
    manager: 'Responsable',
    viewer: 'Lecture seule',
  })[role] ||
  role ||
  'Non renseigné'
export default function AdminAccounts() {
  const { darkMode, toggleTheme } = useTheme()
  const [params] = useSearchParams()
  const [me, setMe] = useState(null),
    [rows, setRows] = useState([]),
    [enterprises, setEnterprises] = useState([])
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [search, setSearch] = useState('')
  const [enterprise, setEnterprise] = useState(params.get('enterprise') || ''),
    [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null),
    [tab, setTab] = useState('Profil'),
    [view, setView] = useState('accounts')
  const [events, setEvents] = useState([]),
    [eventError, setEventError] = useState(''),
    [historyLoading, setHistoryLoading] = useState(false)
  const [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [passwordReason, setPasswordReason] = useState('')
  const [passwordAcknowledged, setPasswordAcknowledged] = useState(false)
  const dialog = useRef(null),
    opener = useRef(null),
    actionLock = useRef(false),
    epoch = useRef(0)
  const load = useCallback(async () => {
    const request = ++epoch.current
    setLoading(true)
    setError('')
    try {
      const actor = await currentAdminAccount()
      if (actor.role !== 'super_admin')
        throw new Error('Cet espace est réservé au superadministrateur.')
      const [accounts, companies] = await Promise.all([
        supabase
          .from('admins')
          .select(ADMIN_FIELDS)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('enterprises')
          .select('id,name')
          .order('name')
          .limit(1000),
      ])
      if (accounts.error || companies.error)
        throw accounts.error || companies.error
      if (request !== epoch.current) return
      setMe(actor)
      setRows(accounts.data || [])
      setSelected(current => current ? (accounts.data || []).find(a => a.id === current.id) || null : null)
      setEnterprises(companies.data || [])
    } catch (err) {
      if (request === epoch.current) setError(err.message)
    } finally {
      if (request === epoch.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
    return () => {
      epoch.current++
    }
  }, [load])
  useEffect(() => {
    if (selected) dialog.current?.showModal()
  }, [selected])
  useEffect(() => {
    if (tab !== 'Historique' || !selected) return
    let cancelled = false
    setEvents([])
    setEventError('')
    setHistoryLoading(true)
    supabase
      .from('admin_account_events')
      .select('id,action,reason,created_at')
      .eq('target_id', selected.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err)
          setEventError(
            'Historique indisponible. La migration des comptes doit être installée, ou vos droits vérifiés.',
          )
        else setEvents(data || [])
        setHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected, tab])
  const filtered = useMemo(
    () => filterAdminAccounts(rows, search, enterprise, status),
    [rows, search, enterprise, status],
  )
  function clearPasswordForm() {
    setNewPassword('')
    setPasswordConfirmation('')
    setPasswordReason('')
    setPasswordAcknowledged(false)
  }
  async function changeAccountPassword(event) {
    event.preventDefault()
    if (actionLock.current) return
    setNotice('')
    if (!selected || selected.id === me?.id) {
      setNotice('Utilisez Mon compte pour votre propre mot de passe.')
      return
    }
    if (
      newPassword.length < 12 ||
      new TextEncoder().encode(newPassword).length > 72 ||
      newPassword !== passwordConfirmation
    ) {
      setNotice(
        'Saisissez deux mots de passe identiques, de 12 à 72 caractères (72 octets UTF-8 maximum).',
      )
      return
    }
    if (
      !passwordAcknowledged ||
      passwordReason.trim().length < 5 ||
      passwordReason.length > 500
    ) {
      setNotice(
        'Renseignez un motif et confirmez le remplacement pour ce compte.',
      )
      return
    }
    if (passwordReason.includes(newPassword)) {
      setNotice('Ne mettez jamais le mot de passe dans le motif.')
      return
    }
    actionLock.current = true
    setBusy(true)
    try {
      await accountRpc('encheck_account_password', {
        p_admin_id: selected.id,
        p_password: newPassword,
        p_reason: passwordReason.trim(),
      })
      clearPasswordForm()
      setNotice(
        'Mot de passe remplacé et intervention enregistrée. Aucun e-mail n’a été envoyé ; transmettez-le par un canal sécurisé. Les sessions existantes ne sont pas révoquées par cette action.',
      )
    } catch {
      // Do not display raw service errors that could inadvertently echo secrets.
      setNewPassword('')
      setPasswordConfirmation('')
      setPasswordAcknowledged(false)
      setNotice(
        'Modification non confirmée. Vérifiez le journal avant de réessayer. Le service sécurisé doit être installé et vos droits vérifiés. Aucun succès n’est présumé.',
      )
    } finally {
      actionLock.current = false
      setBusy(false)
    }
  }
  function close() {
    if (actionLock.current) return
    clearPasswordForm()
    dialog.current?.close()
    setSelected(null)
    opener.current?.focus()
  }
  async function changeStatus(event) {
    event.preventDefault()
    if (actionLock.current) return
    actionLock.current = true
    setBusy(true)
    setNotice('')
    try {
      await accountRpc('encheck_account_status', {
        p_admin_id: selected.id,
        p_active: !selected.is_active,
        p_reason: reason,
      })
      const updated = { ...selected, is_active: !selected.is_active }
      setSelected(updated)
      setRows((old) =>
        old.map((row) => (row.id === updated.id ? updated : row)),
      )
      setReason('')
      setNotice('État du compte mis à jour et intervention enregistrée.')
    } catch (err) {
      setNotice(err.message)
    } finally {
      actionLock.current = false
      setBusy(false)
    }
  }
  return (
    <main className={`aa-page aa-register ${darkMode ? 'aa-dark' : ''}`}>
      <nav className="aa-top">
        <Link to="/dashboard">
          <ArrowLeft size={16} /> Tableau de bord
        </Link>
        <div>
          <button onClick={toggleTheme} aria-label="Changer le thème">
            <SunMoon size={18} />
          </button>
          <Link to="/mon-compte">Mon compte</Link>
        </div>
      </nav>
      <div className="aa-shell">
        <PageCulturalBand pathname="/admins" />
        <header className="aa-heading">
          <div>
            <span className="aa-eyebrow">ADMINISTRATION</span>
            <h1>
              Comptes &amp; accès<span>.</span>
            </h1>
            <p>Le registre des administrateurs.</p>
          </div>
          <button className="aa-primary" onClick={() => {
            const invitations = document.getElementById('admin-invitations')
            if (invitations) { invitations.open = true; invitations.scrollIntoView({ behavior: 'smooth', block: 'start' }); invitations.querySelector('input')?.focus() }
          }}>Inviter un compte</button>
        </header>
        <AdminInvitations enterprises={enterprises} />
        <div className="aa-tabs">
          <button
            aria-pressed={view === 'accounts'}
            onClick={() => setView('accounts')}
          >
            Comptes
          </button>
          <button
            aria-pressed={view === 'roles'}
            onClick={() => setView('roles')}
          >
            Rôles
          </button>
          <button
            aria-pressed={view === 'journal'}
            onClick={() => setView('journal')}
          >
            Journal
          </button>
        </div>
        {error ? (
          <div role="alert" className="aa-panel">
            <p>{error}</p>
            <button onClick={load}>Réessayer</button>
          </div>
        ) : loading ? (
          <p role="status" className="aa-panel">
            Lecture des comptes et des accès…
          </p>
        ) : (
          <>
            <div className="aa-metrics">
              <article>
                <Users />
                <strong>{rows.filter((a) => a.is_active).length}</strong>
                <span>Comptes actifs</span>
              </article>
              <article>
                <ShieldCheck />
                <strong>{rows.filter((a) => !a.is_active).length}</strong>
                <span>Comptes inactifs</span>
              </article>
              <article>
                <ShieldCheck />
                <strong>
                  {
                    rows.filter((a) => a.role === 'super_admin' && a.is_active)
                      .length
                  }
                </strong>
                <span>Superadmins actifs</span>
              </article>
            </div>
            {view === 'journal' ? (
              <AdminAccountJournal accounts={rows} />
            ) : view === 'roles' ? (
              <AdminPermissionRoles accounts={rows} enterprises={enterprises} onSaved={load} />
            ) : (
              <>
                <section
                  className="aa-filters"
                  aria-label="Filtrer les administrateurs"
                >
                  <label>
                    <Search size={17} />
                    <input
                      aria-label="Rechercher un administrateur"
                      placeholder="Nom, prénom, adresse e-mail…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Entreprise"
                    value={enterprise}
                    onChange={(e) => setEnterprise(e.target.value)}
                  >
                    <option value="">Toutes les entreprises principales</option>
                    {enterprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="État du compte"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">Tous les états</option>
                    <option value="active">Actifs</option>
                    <option value="inactive">Inactifs</option>
                  </select>
                </section>
                <div className="aa-list">
                  <div className="aa-list-head">
                    <span>ADMINISTRATEUR</span>
                    <span>ENTREPRISE PRINCIPALE</span>
                    <span>RÔLE</span>
                    <span>ÉTAT</span>
                  </div>
                  {filtered.map((admin) => (
                    <button
                      className="aa-row"
                      aria-current={
                        selected?.id === admin.id ? 'true' : undefined
                      }
                      key={admin.id}
                      onClick={(e) => {
                        opener.current = e.currentTarget
                        clearPasswordForm()
                        setSelected(admin)
                        setTab('Profil')
                        setNotice('')
                        setReason('')
                      }}
                    >
                      <span className="aa-person">
                        <EmployeeProfilePhoto employee={admin} />
                        <span>
                          <strong>
                            {admin.first_name} {admin.last_name}
                          </strong>
                          <small>{admin.email || admin.username}</small>
                        </span>
                      </span>
                      <span>
                        {enterprises.find(
                          (ent) => ent.id === admin.enterprise_id,
                        )?.name ||
                          (admin.role === 'super_admin'
                            ? 'Toutes les entreprises'
                            : 'Non renseignée')}
                      </span>
                      <span>{roleLabel(admin.role)}</span>
                      <span
                        className={`aa-state ${admin.is_active ? 'is-active' : ''}`}
                      >
                        {admin.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </button>
                  ))}
                  {!filtered.length && (
                    <p className="aa-empty">
                      Aucun compte ne correspond à ces filtres.
                    </p>
                  )}
                </div>
                <p className="aa-footnote">
                  {filtered.length} compte(s) affiché(s).{' '}
                  {rows.length === 1000
                    ? 'Affichage limité aux 1 000 comptes les plus récents.'
                    : ''}{' '}
                  Les affectations multiples restent accessibles dans la gestion
                  existante.
                </p>
              </>
            )}
          </>
        )}
        <PageCulturalBand pathname="/admins" placement="bottom" />
      </div>
      <dialog
        ref={dialog}
        className={`aa-drawer ${darkMode ? 'aa-dark' : ''}`}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        aria-labelledby="aa-account-title"
      >
        {selected && (
          <>
            <PageCulturalBand pathname="/admins" placement="compact" />
            <header>
              <span className="aa-eyebrow">FICHE ADMINISTRATEUR</span>
              <button
                onClick={close}
                disabled={busy}
                aria-label="Fermer la fiche"
              >
                <X size={20} />
              </button>
            </header>
            <div className="aa-drawer-person">
              <EmployeeProfilePhoto employee={selected} />
              <h2 id="aa-account-title">
                {selected.first_name} {selected.last_name}
              </h2>
              <p>
                {roleLabel(selected.role)} ·{' '}
                {enterprises.find((ent) => ent.id === selected.enterprise_id)
                  ?.name ||
                  (selected.role === 'super_admin'
                    ? 'Toutes les entreprises'
                    : 'Entreprise non renseignée')}
              </p>
              <span
                className={`aa-state ${selected.is_active ? 'is-active' : ''}`}
              >
                {selected.is_active ? 'Compte actif' : 'Compte inactif'}
              </span>
            </div>
            <div className="aa-tabs">
              {['Profil', 'Accès', 'Sécurité', 'Historique'].map((name) => (
                <button
                  key={name}
                  aria-pressed={tab === name}
                  onClick={() => {
                    if (busy) return
                    clearPasswordForm()
                    setTab(name)
                    setNotice('')
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            {tab === 'Profil' && (
              <dl>
                <dt>Adresse de connexion</dt>
                <dd>{selected.email || 'Non renseignée'}</dd>
                <dt>Identifiant</dt>
                <dd>{selected.username || 'Non renseigné'}</dd>
                <dt>Création</dt>
                <dd>
                  {selected.created_at
                    ? new Date(selected.created_at).toLocaleDateString('fr-FR')
                    : 'Non renseignée'}
                </dd>
              </dl>
            )}
            {tab === 'Accès' && (
              <AdminAccountOperations key={selected.id} account={selected} accounts={rows} enterprises={enterprises} currentId={me?.id} onSaved={load} />
            )}
            {tab === 'Sécurité' && (
              <section>
                <h3>Intervenir sur ce compte</h3>
                <AdminMfaRecovery key={selected.id} account={selected} currentId={me?.id} />
                <p>Les mots de passe existants ne sont jamais affichés.</p>
                {selected.id === me?.id ? (
                  <Link className="aa-secondary" to="/mon-compte">
                    Modifier mon propre mot de passe
                  </Link>
                ) : (
                  <details
                    className="aa-password-section"
                    onToggle={(event) => {
                      if (!event.currentTarget.open) clearPasswordForm()
                    }}
                  >
                    <summary
                      onClick={(event) => {
                        if (busy) event.preventDefault()
                      }}
                    >
                      Définir un nouveau mot de passe
                    </summary>
                    <form
                      onSubmit={changeAccountPassword}
                      className="aa-password-form"
                    >
                      <h3>Remplacer le mot de passe</h3>
                      <p>
                        Compte concerné :{' '}
                        <strong>
                          {selected.email ||
                            selected.username ||
                            `${selected.first_name} ${selected.last_name}`}
                        </strong>
                      </p>
                      <label>
                        Nouveau mot de passe
                        <input
                          type="password"
                          required
                          minLength={12}
                          maxLength={72}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          disabled={busy}
                        />
                      </label>
                      <label>
                        Confirmer le nouveau mot de passe
                        <input
                          type="password"
                          required
                          minLength={12}
                          maxLength={72}
                          autoComplete="new-password"
                          value={passwordConfirmation}
                          onChange={(event) =>
                            setPasswordConfirmation(event.target.value)
                          }
                          disabled={busy}
                        />
                      </label>
                      <label>
                        Motif du changement
                        <textarea
                          required
                          minLength={5}
                          maxLength={500}
                          value={passwordReason}
                          onChange={(event) =>
                            setPasswordReason(event.target.value)
                          }
                          disabled={busy}
                        />
                      </label>
                      <small>
                        Le motif est conservé dans le journal. N’y inscrivez
                        aucun mot de passe.
                      </small>
                      <label className="aa-password-confirm">
                        <input
                          type="checkbox"
                          required
                          checked={passwordAcknowledged}
                          onChange={(event) =>
                            setPasswordAcknowledged(event.target.checked)
                          }
                          disabled={busy}
                        />
                        Je confirme le remplacement pour ce compte.
                      </label>
                      <button disabled={busy} type="submit">
                        {busy ? 'Enregistrement…' : 'Remplacer le mot de passe'}
                      </button>
                      <p className="aa-footnote">
                        Cette action n’envoie pas de lien de récupération,
                        n’impose pas de changement à la prochaine connexion et
                        ne ferme pas les sessions déjà ouvertes.
                      </p>
                    </form>
                  </details>
                )}
                <details className="aa-password-section"><summary>Sessions de connexion</summary><AdminAccountSessions adminId={selected.id}/></details>
                <div className="aa-security-availability"><div><strong>Double authentification</strong><span>Enrôlement personnel depuis Mon compte, après activation du contrôle serveur.</span></div></div>
                <details className="aa-help">
                  <summary>Comprendre les limites de ces actions</summary>
                  <p>
                    La révocation proposée couvre REST/RPC. Les invitations et le
                    dépannage délégué ne sont pas encore disponibles. Aucun état
                    de double authentification ou de session n’est inventé.
                  </p>
                </details>
                <details className="aa-danger-section">
                  <summary>
                    État du compte{' '}
                    <span>
                      {selected.is_active ? 'Désactiver' : 'Réactiver'}
                    </span>
                  </summary>
                  <form onSubmit={changeStatus} className="aa-sensitive">
                    <h3>État du compte</h3>
                    <p>
                      Une désactivation conserve l’historique. Ce n’est pas une
                      suppression définitive ni une garantie de révocation
                      immédiate des jetons déjà émis.
                    </p>
                    <label>
                      Motif de l’intervention
                      <textarea
                        required
                        minLength={5}
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <button
                      disabled={busy || selected.id === me?.id}
                      type="submit"
                    >
                      {busy
                        ? 'Enregistrement…'
                        : selected.is_active
                          ? 'Désactiver ce compte'
                          : 'Réactiver ce compte'}
                    </button>
                    {selected.id === me?.id && (
                      <p>Votre propre compte est protégé.</p>
                    )}
                  </form>
                </details>
              </section>
            )}
            {tab === 'Historique' && (
              <section>
                <h3>Interventions sur le compte</h3>
                {historyLoading ? (
                  <p role="status">Lecture du journal…</p>
                ) : eventError ? (
                  <p role="alert">{eventError}</p>
                ) : events.length ? (
                  <ol>
                    {events.map((item) => (
                      <li key={item.id}>
                        <strong>
                          {{
                            profile_updated: 'Profil modifié',
                            password_changed: 'Mot de passe remplacé',
                            suspended: 'Compte désactivé',
                            reactivated: 'Compte réactivé',
                          }[item.action] || item.action}
                        </strong>
                        <p>
                          {new Date(item.created_at).toLocaleString('fr-FR')}
                        </p>
                        <p>{item.reason}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>
                    Aucune intervention enregistrée dans ce nouveau journal.
                  </p>
                )}
                <p className="aa-footnote">
                  Ce journal couvre les nouvelles actions de profil, d’état et
                  de mot de passe de cette page, pas les anciennes opérations.
                </p>
              </section>
            )}
            {notice && (
              <p role="status" className="aa-notice">
                {notice}
              </p>
            )}
          </>
        )}
      </dialog>
    </main>
  )
}
