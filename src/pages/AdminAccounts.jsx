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
import AdminAccountRail from '../components/AdminAccountRail'

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
  function close() {
    if (actionLock.current) return
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
    <main className={`aa-page aa-with-rail ${darkMode ? 'aa-dark' : ''}`}>
      <AdminAccountRail />
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
            <span className="aa-eyebrow">LES ACCÈS EN CONFIANCE</span>
            <h1>
              Administration des accès<span>.</span>
            </h1>
            <p>Les bonnes permissions, pour les bonnes personnes.</p>
          </div>
          <Link className="aa-primary" to="/admins/gestion-existante">
            Gérer / créer un compte
          </Link>
        </header>
        <div className="aa-tabs">
          <button
            aria-pressed={view === 'accounts'}
            onClick={() => setView('accounts')}
          >
            Comptes administrateurs
          </button>
          <button
            aria-pressed={view === 'roles'}
            onClick={() => setView('roles')}
          >
            Rôles et permissions
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
            {view === 'roles' ? (
              <section className="aa-panel">
                <h2>Les rôles actuellement attribués</h2>
                <div className="aa-role-grid">
                  {[...new Set(rows.map((a) => a.role))].map((role) => (
                    <article key={role}>
                      <ShieldCheck />
                      <h3>{roleLabel(role)}</h3>
                      <p>
                        {rows.filter((a) => a.role === role).length} compte(s)
                      </p>
                    </article>
                  ))}
                </div>
                <p>
                  Les droits effectifs restent ceux du serveur et des
                  affectations d’entreprise. La création de rôles personnalisés
                  et les permissions détaillées nécessitent un chantier serveur
                  distinct ; elles ne sont pas encore disponibles ici.
                </p>
              </section>
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
              <p>{roleLabel(selected.role)}</p>
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
              <section>
                <h3>{roleLabel(selected.role)}</h3>
                <p>
                  Les droits ne peuvent pas être modifiés par le titulaire du
                  compte.
                </p>
                <Link to="/admins/gestion-existante">
                  Gérer les rôles et les entreprises existants →
                </Link>
                <p className="aa-footnote">
                  Les rôles personnalisés et accès temporaires ne sont pas
                  encore déployés.
                </p>
              </section>
            )}
            {tab === 'Sécurité' && (
              <section>
                <h3>Intervenir sur ce compte</h3>
                <p>Les mots de passe existants ne sont jamais affichés.</p>
                <Link className="aa-secondary" to="/admins/gestion-existante">
                  Ouvrir la gestion du mot de passe
                </Link>
                <p className="aa-footnote">
                  La révocation distante des sessions, les invitations et le
                  dépannage délégué ne sont pas encore disponibles. Aucun état
                  de double authentification ou de session n’est inventé.
                </p>
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
                  Ce journal couvre les nouvelles actions de profil et d’état de
                  cette page, pas les anciennes opérations.
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
