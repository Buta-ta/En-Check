import AdminPermissionRoles from '../components/AdminPermissionRoles'
import AdminMfaRecovery from '../components/AdminMfaRecovery'
import AdminAccountOperations from '../components/AdminAccountOperations'
import AdminInvitations from '../components/AdminInvitations'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search, ShieldCheck, Users, X,
  Plus, History, Building2, KeyRound, User,
  Sun, Moon, ArrowUpRight, Lock, UserPlus,
  Crown, UserCog, Eye,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import PageCulturalBand from '../components/PageCulturalBand'
import {
  AbomeyBlasonSvg, AbomeyCoinSvg, CourbeOnduleeSvg, CaurisEtatSvg,
} from '../components/AbomeySvg'
import EmployeeProfilePhoto from '../components/EmployeeProfilePhoto'
import AdminsLoadingScreen from '../components/AdminsLoadingScreen'
import RaccourcisPages from '../components/RaccourcisPages'
import AdminExplication from '../components/AdminExplication'
import AdminSceau from '../components/AdminSceau'
import {
  ADMIN_FIELDS,
  currentAdminAccount,
  accountRpc,
  filterAdminAccounts,
} from '../services/adminAccounts'
import './AdminAccounts.css'
import AdminAccountSessions from '../components/AdminAccountSessions'
import AdminAccountJournal from '../components/AdminAccountJournal'
import {
  ROLES, entreprisesCouvertes, entreprisesDuCompte, etatAcces, filtrerParRole,
  cumuler, formaterDerniereConnexion, libelleEtatAcces, libelleRole, serieMensuelle, tonRole,
} from '../utils/adminsPresentation'

// ── Une icône par rôle : la pastille se lit avant d'être lue ──
const ICONES_ROLE = {
  super_admin: Crown,
  admin: ShieldCheck,
  manager: UserCog,
  viewer: Eye,
}

// ── Les mois, pour les fiches ─────────────────────────────
const MOIS_COURT = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin',
  'juil', 'août', 'sept', 'oct', 'nov', 'déc']

/** « il y a 4 mois » / « il y a 1 an » */
function depuis(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const mois = Math.max(0, Math.round((Date.now() - d.getTime()) / 2629800000))
  if (mois < 1) return 'ce mois-ci'
  if (mois < 12) return `il y a ${mois} mois`
  const ans = Math.round(mois / 12)
  return `il y a ${ans} an${ans > 1 ? 's' : ''}`
}

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
    [view, setView] = useState('accounts'),
    [roleFiltre, setRoleFiltre] = useState('tous'),
    [fiche, setFiche] = useState(null),
    [actionRapide, setActionRapide] = useState(false)
  const plein = useRef(null)
  const actionRapideRef = useRef(null)
  const [chargeur, setChargeur] = useState(false)
  const [chargeurSaute, setChargeurSaute] = useState(false)
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
  const actionLock = useRef(false),
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
          .select(`${ADMIN_FIELDS},admin_entreprises(enterprise_id,is_active,created_at)`)
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
      setFiche(current => {
        if (!current) return null
        const updated = (accounts.data || []).find(a => a.id === current.admin.id)
        return updated ? { ...current, admin: updated } : null
      })
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
    if (fiche?.onglet !== 'Historique') return
    let cancelled = false
    setEvents([])
    setEventError('')
    setHistoryLoading(true)
    supabase
      .from('admin_account_events')
      .select('id,action,reason,created_at')
      .eq('target_id', fiche.admin.id)
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
  }, [fiche?.admin.id, fiche?.onglet])
  // Les deux boîtes de dialogue suivent leur état : on ouvre en `showModal`,
  // on referme par `close` — sinon la fiche resterait affichée au-dessus
  // d'une page dont l'état dit déjà « fermée ».
  useEffect(() => {
    const boite = plein.current
    if (!boite) return
    if (fiche && !boite.open) boite.showModal()
    if (!fiche && boite.open) boite.close()
  }, [fiche])

  useEffect(() => {
    const boite = actionRapideRef.current
    if (!boite) return
    if (actionRapide && !boite.open) boite.showModal()
    if (!actionRapide && boite.open) boite.close()
  }, [actionRapide])

  // Un écran de chargement qui clignote est pire que pas d'écran du tout :
  // on ne l'affiche qu'au-delà de 300 ms, et « Passer » ne le ramène jamais.
  useEffect(() => {
    if (!loading || error || me) {
      setChargeur(false)
      return undefined
    }
    const minuterie = window.setTimeout(() => setChargeur(true), 300)
    return () => window.clearTimeout(minuterie)
  }, [loading, error, me])

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
    const target = fiche?.admin
    if (!target || target.id === me?.id) {
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
        p_admin_id: target.id,
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
  async function changeStatus(event) {
    event.preventDefault()
    if (actionLock.current) return
    const target = fiche?.admin
    if (!target || target.id === me?.id) return
    actionLock.current = true
    setBusy(true)
    setNotice('')
    try {
      await accountRpc('encheck_account_status', {
        p_admin_id: target.id,
        p_active: !target.is_active,
        p_reason: reason,
      })
      const updated = { ...target, is_active: !target.is_active }
      setSelected(current => current?.id === updated.id ? updated : current)
      setFiche(current => current?.admin.id === updated.id ? { ...current, admin: updated } : current)
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
  // ── Ce que la page raconte ─────────────────────────────────
  const parRole = useMemo(
    () => ROLES.map((r) => ({ role: r, n: rows.filter((a) => a.role === r).length })),
    [rows],
  )
  const actifs = useMemo(() => rows.filter((a) => a.is_active), [rows])
  const sansAcces = actifs.filter((a) => etatAcces(a) === 'non_lie')
  const couvertes = entreprisesCouvertes(rows)
  const filtres = useMemo(() => filtrerParRole(filtered, roleFiltre), [filtered, roleFiltre])
  // Le nombre affiché sur chaque pastille suit les filtres déjà posés
  // (recherche, entreprise, état) — il ne promet jamais plus qu'il n'y a.
  const compteParRole = useMemo(() => {
    const compte = { tous: filtered.length }
    for (const role of ROLES) compte[role] = filtered.filter((a) => a.role === role).length
    return compte
  }, [filtered])

  // Les courbes cumulent DOUZE mois réels de créations : aucune valeur
  // n'est inventée, et la forme ondule au lieu de tracer un pic unique.
  const serieActifs = useMemo(
    () => cumuler(serieMensuelle(rows, (a) => a.is_active)),
    [rows],
  )
  const serieSansAcces = useMemo(
    () => cumuler(serieMensuelle(rows, (a) => a.is_active && etatAcces(a) === 'non_lie')),
    [rows],
  )
  // La couverture se compte au jour du PREMIER administrateur de chaque
  // entreprise : on ne recompte pas la deuxième recrue comme une nouvelle.
  const serieEntreprises = useMemo(() => {
    const premiers = new Map()
    rows.forEach((a) => {
      if (a.role === 'super_admin') return
      entreprisesDuCompte(a).forEach(id => {
        const lien = a.admin_entreprises?.find(l => l.enterprise_id === id && l.is_active)
        const date = lien?.created_at || a.created_at
        if (!date) return
        const t = new Date(date).getTime()
        if (!Number.isFinite(t)) return
        const connu = premiers.get(id)
        if (!connu || t < connu.t) premiers.set(id, { t, row: { created_at: date } })
      })
    })
    return cumuler(serieMensuelle([...premiers.values()].map((v) => v.row)))
  }, [rows])

  function fermerFiche() {
    if (actionLock.current) return
    clearPasswordForm()
    setReason('')
    setNotice('')
    setFiche(null)
  }

  function ouvrirFiche(admin, onglet = 'Profil', evenement = null) {
    if (actionLock.current) return
    if (evenement) {
      evenement.stopPropagation()
      evenement.preventDefault()
    }
    clearPasswordForm()
    setEvents([])
    setEventError('')
    setFiche({ admin, onglet })
    setNotice('')
    setReason('')
  }

  // Quitter l'onglet Sécurité efface les secrets saisis, jamais conservés
  // en mémoire plus longtemps que l'écran qui les demande.
  function changerOngletFiche(nom) {
    if (actionLock.current || !fiche || fiche.onglet === nom) return
    if (fiche.onglet === 'Sécurité') {
      clearPasswordForm()
      setNotice('')
    }
    setFiche({ ...fiche, onglet: nom })
  }

  function choisirPourLeTiroir(admin) {
    clearPasswordForm()
    // Recliquer la ligne déjà choisie rend le panneau à son propre compte.
    setSelected((current) => (current?.id === admin.id ? null : admin))
    setNotice('')
    setReason('')
  }

  function nomEntreprise(admin) {
    if (admin.role === 'super_admin') return 'Toutes les entreprises'
    return entreprisesDuCompte(admin).map(id => enterprises.find(ent => ent.id === id)?.name || 'Entreprise non disponible').join(', ') || 'Non renseignée'
  }

  // Le tiroir travaille toujours sur quelqu'un : la sélection, sinon soi.
  const auTiroir = selected || me || null
  const cible = auTiroir

  // ═══ L'ÉCRAN DE CHARGEMENT — la case des cauris ═══
  if (chargeur && !chargeurSaute) {
    return (
      <AdminsLoadingScreen
        darkMode={darkMode}
        onSkip={() => {
          setChargeurSaute(true)
          setChargeur(false)
        }}
      />
    )
  }

  return (
    <main className={`aa-page aa-register ${darkMode ? 'aa-dark' : ''}`}>
      {/* ═══ LA BANDE TISSÉE — pleine largeur, haute ═══ */}
      <div className="aa-bande">
        <PageCulturalBand pathname="/admins" />
      </div>

      {/* ═══ LA GRILLE : contenu à gauche, tiroir permanent à droite ═══ */}
      <div className="aa-grille">
        <div className="aa-colonne">
          {/* ── La barre de titre ── */}
          <header className="aa-heading">
            <div className="aa-marque">
              <AbomeyBlasonSvg size={52} />
              <div className="aa-marque-texte">
                <h1>Administrateurs</h1>
                <p>Gestion des accès</p>
              </div>
            </div>
            <div className="aa-heading-actions">
              <Link className="aa-lien-compte" to="/mon-compte">
                <span className="aa-lien-compte-icone"><Users size={14} /></span>
                <span className="aa-lien-compte-texte">
                  <strong>Mon compte</strong>
                  <small>Profil, mot de passe, sécurité</small>
                </span>
                <ArrowUpRight size={14} />
              </Link>
              <button className="aa-primary" onClick={() => setActionRapide(true)}>
                <Plus size={15} />
                Nouveau
              </button>
              <button
                type="button"
                className="aa-bascule"
                role="switch"
                aria-checked={darkMode}
                onClick={toggleTheme}
                aria-label={darkMode ? 'Passer en thème clair' : 'Passer en thème sombre'}
                title={darkMode ? 'Thème clair' : 'Thème sombre'}
              >
                <span className="aa-bascule-pastille">
                  {darkMode ? <Moon size={10} /> : <Sun size={10} />}
                </span>
              </button>
            </div>
          </header>

          {/* ── Les raccourcis : sortir de la page sans repasser par l'accueil ── */}
          <div className="aa-raccourcis">
            <span className="aa-raccourcis-libelle">Aller à</span>
            <RaccourcisPages compact excludePaths={['/admins', '/mon-compte']} />
          </div>

          {/* ── Les trois chiffres ── */}
          {error ? (
            <div role="alert" className="aa-panel">
              <p>{error}</p>
              <button onClick={load}>Réessayer</button>
            </div>
          ) : loading ? (
            <div role="status" className="aa-panel aa-chargement">
              <AbomeyBlasonSvg size={40} />
              <p>Lecture des comptes et des accès…</p>
            </div>
          ) : (
            <>
              <section className="aa-metrics" aria-label="État des accès">
                <article className="aa-metrique">
                  <span className="aa-metrique-coin aa-metrique-coin--haut" aria-hidden="true">
                    <AbomeyCoinSvg variante="indigo" coin="haut" size={78} />
                  </span>
                  <span className="aa-metrique-coin aa-metrique-coin--bas" aria-hidden="true">
                    <AbomeyCoinSvg variante="terre" coin="bas" size={78} />
                  </span>
                  <span className="aa-metrique-libelle">Administrateurs actifs</span>
                  <div className="aa-metrique-valeur">
                    <strong>{actifs.length}</strong>
                    <span className="aa-metrique-total">/ {rows.length}</span>
                  </div>
                  <div className="aa-metrique-courbe" role="img" aria-label="Cumul sur les douze derniers mois">
                    <CourbeOnduleeSvg valeurs={serieActifs} hauteur={46} ton="clair" />
                  </div>
                  <span className="aa-metrique-pied">
                    {parRole.filter((r) => r.n > 0).map((r) => `${r.n} ${libelleRole(r.role).toLowerCase()}`).join(' · ') || 'Aucun compte'}
                  </span>
                </article>

                <article className={`aa-metrique${sansAcces.length > 0 ? ' aa-metrique--alerte' : ''}`}>
                  <span className="aa-metrique-coin aa-metrique-coin--haut" aria-hidden="true">
                    <AbomeyCoinSvg variante="or" coin="haut" size={78} />
                  </span>
                  <span className="aa-metrique-coin aa-metrique-coin--bas" aria-hidden="true">
                    <AbomeyCoinSvg variante="indigo" coin="bas" size={78} />
                  </span>
                  <span className="aa-metrique-libelle">Comptes non liés</span>
                  <div className="aa-metrique-valeur">
                    <strong>{sansAcces.length}</strong>
                  </div>
                  <div className="aa-metrique-courbe" role="img" aria-label="Cumul sur les douze derniers mois">
                    <CourbeOnduleeSvg valeurs={serieSansAcces} hauteur={46} ton="terre" />
                  </div>
                  <span className="aa-metrique-pied">
                    {sansAcces.length === 0 ? 'Tous ont un accès de connexion' : 'Sans moyen de connexion'}
                  </span>
                </article>

                <article className="aa-metrique">
                  <span className="aa-metrique-coin aa-metrique-coin--haut" aria-hidden="true">
                    <AbomeyCoinSvg variante="ivoire" coin="haut" size={78} />
                  </span>
                  <span className="aa-metrique-coin aa-metrique-coin--bas" aria-hidden="true">
                    <AbomeyCoinSvg variante="or" coin="bas" size={78} />
                  </span>
                  <span className="aa-metrique-libelle">Entreprises couvertes</span>
                  <div className="aa-metrique-valeur">
                    <strong>{couvertes}</strong>
                  </div>
                  <div className="aa-metrique-courbe" role="img" aria-label="Cumul sur les douze derniers mois">
                    <CourbeOnduleeSvg valeurs={serieEntreprises} hauteur={46} ton="clair" />
                  </div>
                  <span className="aa-metrique-pied">
                    {enterprises.length - couvertes > 0
                      ? `${enterprises.length - couvertes} sans administrateur`
                      : 'Chaque entreprise a un administrateur'}
                  </span>
                </article>
              </section>

              {/* ── Recherche et filtres ── */}
              <section className="aa-outils" aria-label="Filtrer les administrateurs">
                <label className="aa-recherche">
                  <Search size={16} />
                  <input
                    aria-label="Rechercher un administrateur"
                    placeholder="Nom, e-mail ou entreprise…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch('')}>
                      <X size={14} />
                    </button>
                  )}
                </label>

                <div className="aa-puces" role="group" aria-label="Filtrer par rôle">
                  <button
                    type="button"
                    aria-pressed={roleFiltre === 'tous'}
                    onClick={() => setRoleFiltre('tous')}
                    title="Tous les rôles"
                  >
                    <Users size={12} />
                    Tous
                    <span className="aa-puce-n">{compteParRole.tous}</span>
                  </button>
                  {ROLES.map((role) => {
                    const IconeRole = ICONES_ROLE[role] || User
                    return (
                      <button
                        key={role}
                        type="button"
                        aria-pressed={roleFiltre === role}
                        onClick={() => setRoleFiltre(role)}
                        title={`Afficher les comptes : ${libelleRole(role)}`}
                      >
                        <IconeRole size={12} />
                        {libelleRole(role)}
                        <span className="aa-puce-n">{compteParRole[role]}</span>
                      </button>
                    )
                  })}
                  <label className="aa-puce-select">
                    <Building2 size={13} />
                    <select
                      aria-label="Entreprise"
                      value={enterprise}
                      onChange={(e) => setEnterprise(e.target.value)}
                    >
                      <option value="">Toutes les entreprises</option>
                      {enterprises.map((ent) => (
                        <option key={ent.id} value={ent.id}>{ent.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              {/* ── Les onglets ── */}
              <div className="aa-tabs" role="tablist" aria-label="Sections">
                <button role="tab" aria-pressed={view === 'accounts'} onClick={() => setView('accounts')}>
                  Comptes<span className="aa-tabs-n">{rows.length}</span>
                </button>
                <button role="tab" aria-pressed={view === 'roles'} onClick={() => setView('roles')}>
                  Rôles
                </button>
                <button role="tab" aria-pressed={view === 'journal'} onClick={() => setView('journal')}>
                  Journal
                </button>
                <button
                  type="button"
                  role="tab"
                  className="aa-tabs-filtre"
                  aria-pressed={status !== ''}
                  aria-label={
                    status === 'active'
                      ? 'Afficher tous les états'
                      : 'N’afficher que les comptes actifs'
                  }
                  onClick={() => setStatus(status === '' ? 'active' : '')}
                  title="Basculer entre tous les états et les seuls comptes actifs"
                >
                  <span className="aa-tabs-filtre-piste" aria-hidden="true">
                    <span className="aa-tabs-filtre-pastille" />
                  </span>
                  {status === 'active' ? 'Actifs' : 'Tous les états'}
                </button>
              </div>

              {view === 'journal' ? (
                <AdminAccountJournal accounts={rows} />
              ) : view === 'roles' ? (
                <AdminPermissionRoles accounts={rows} enterprises={enterprises} onSaved={load} />
              ) : (
                <>
                  {/* ── Le tableau ── */}
                  <div className="aa-list">
                    <div className="aa-list-head" role="row">
                      <span>Administrateur</span>
                      <span className="aa-col-role">Rôle</span>
                      <span className="aa-col-ent">Entreprise</span>
                      <span className="aa-col-actions">Action</span>
                    </div>

                    {filtres.map((admin) => {
                      const acces = etatAcces(admin)
                      const roleSecondaire =
                        admin.role === 'super_admin' ? 'Toutes' : admin.role === 'admin' ? 'Manager' : null
                      return (
                        <div
                          className={`aa-row${selected?.id === admin.id ? ' is-choisi' : ''}`}
                          key={admin.id}
                          onClick={() => choisirPourLeTiroir(admin)}
                        >
                          <span className="aa-person">
                            <span className="aa-avatar">
                              <EmployeeProfilePhoto employee={admin} />
                            </span>
                            <span className="aa-person-texte">
                              <button
                                type="button"
                                className="aa-person-nom"
                                onClick={(e) => ouvrirFiche(admin, 'Profil', e)}
                              >
                                {admin.first_name} {admin.last_name}
                              </button>
                              <small className="aa-person-sub">
                                {nomEntreprise(admin)} · {formaterDerniereConnexion(admin.last_login_at)}
                                {!admin.is_active && ' · inactif'}
                              </small>
                            </span>
                          </span>

                          <span className="aa-col-role">
                            <span className={`aa-badge aa-badge--${tonRole(admin.role)}`}>
                              {libelleRole(admin.role)}
                            </span>
                            {roleSecondaire && (
                              <span className="aa-badge aa-badge--second">
                                {roleSecondaire}
                              </span>
                            )}
                          </span>

                          <span className="aa-col-ent">
                            <span className="aa-jeton" title={nomEntreprise(admin)}>
                              {nomEntreprise(admin)}
                            </span>
                          </span>

                          <span className="aa-col-actions">
                            <button
                              type="button"
                              className="aa-tuile"
                              onClick={(e) => { e.stopPropagation(); choisirPourLeTiroir(admin) }}
                              aria-label={`Modifier ${admin.first_name} ${admin.last_name}`}
                              title="Modifier dans le panneau"
                            >
                              <ArrowUpRight size={15} />
                            </button>
                            <button
                              type="button"
                              className="aa-tuile"
                              onClick={(e) => ouvrirFiche(admin, 'Profil', e)}
                              aria-label={`Ouvrir la fiche de ${admin.first_name} ${admin.last_name}`}
                              title="Ouvrir la fiche complète"
                            >
                              <ShieldCheck size={15} />
                            </button>
                          </span>
                        </div>
                      )
                    })}

                    {!filtres.length && (
                      <div className="aa-empty">
                        <AbomeyBlasonSvg size={34} />
                        <p>{rows.length ? 'Aucun compte ne correspond à ces filtres.' : 'Aucun compte administrateur pour le moment.'}</p>
                        {(search || roleFiltre !== 'tous' || enterprise || status) && (
                          <button
                            type="button"
                            className="aa-secondary"
                            onClick={() => { setSearch(''); setRoleFiltre('tous'); setEnterprise(''); setStatus('') }}
                          >
                            Effacer les filtres
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="aa-footnote">
                    {filtres.length} sur {rows.length}
                    {rows.length === 1000 ? ' — affichage limité aux 1 000 comptes les plus récents' : ''}
                  </p>
                </>
              )}
            </>
          )}
        </div>

        {/* ═══ LE TIROIR PERMANENT ═══ */}
        <aside className="aa-panneau" aria-label="Panneau du compte sélectionné">
          {!cible ? (
            <div className="aa-panneau-vide">
              <AbomeyBlasonSvg size={38} />
              <p>Choisissez un compte dans la liste.</p>
            </div>
          ) : (
            <>
              <header className="aa-panneau-tete">
                <div>
                  <span className="aa-panneau-eyebrow">
                    {cible.id === me?.id ? 'Votre compte' : 'Compte sélectionné'}
                  </span>
                  <h2>
                    {cible.id === me?.id && !selected
                      ? 'Votre accès'
                      : `Modifier ${cible.first_name}`}
                  </h2>
                </div>
                <button
                  type="button"
                  className="aa-tuile"
                  onClick={() => ouvrirFiche(cible, 'Profil')}
                  aria-label="Ouvrir la fiche complète"
                  title="Fiche complète"
                >
                  <ArrowUpRight size={15} />
                </button>
              </header>

              <div className="aa-panneau-corps">
                {/* Identité */}
                <div className="aa-panneau-identite">
                  <span className="aa-avatar aa-avatar--grand">
                    <EmployeeProfilePhoto employee={cible} />
                  </span>
                  <div>
                    <strong>{cible.first_name} {cible.last_name}</strong>
                    <small>{cible.email || cible.username || 'Aucun identifiant'}</small>
                    <span className={`aa-badge aa-badge--${tonRole(cible.role)}`}>
                      {libelleRole(cible.role)}
                    </span>
                  </div>
                </div>

                {/* Champs en lecture, à la manière de la maquette */}
                <dl className="aa-champs">
                  <div>
                    <dt>Rôle</dt>
                    <dd>{libelleRole(cible.role)}</dd>
                  </div>
                  <div>
                    <dt>Entreprise</dt>
                    <dd>{nomEntreprise(cible)}</dd>
                  </div>
                  <div>
                    <dt>Dernière connexion</dt>
                    <dd>{formaterDerniereConnexion(cible.last_login_at)}</dd>
                  </div>
                  <div>
                    <dt>Accès de connexion</dt>
                    <dd>
                      <CaurisEtatSvg etat={etatAcces(cible)} size={11} />
                      {libelleEtatAcces(etatAcces(cible))}
                    </dd>
                  </div>
                  <div>
                    <dt>Compte créé</dt>
                    <dd>
                      {cible.created_at
                        ? `${MOIS_COURT[new Date(cible.created_at).getMonth()]} ${new Date(cible.created_at).getFullYear()}`
                        : 'Non renseigné'}
                      <em>{depuis(cible.created_at)}</em>
                    </dd>
                  </div>
                </dl>

                {/* La zone photo, comme dans la maquette */}
                <div className="aa-zone-photo">
                  <span className="aa-avatar aa-avatar--grand">
                    <EmployeeProfilePhoto employee={cible} />
                  </span>
                  <span>Photo du compte</span>
                  <div className="aa-zone-photo-trait" aria-hidden="true" />
                </div>
              </div>

              <footer className="aa-panneau-pied">
                <button
                  type="button"
                  className="aa-bouton-plein"
                  onClick={() => ouvrirFiche(cible, 'Accès')}
                >
                  Accès &amp; permissions
                </button>
                <button
                  type="button"
                  className="aa-bouton-creux"
                  onClick={() => ouvrirFiche(cible, 'Sécurité')}
                >
                  <Lock size={14} />
                  Sécurité du compte
                </button>
              </footer>
            </>
          )}
        </aside>
      </div>

      {/* ═══ LA BANDE BASSE — insérée et arrondie ═══ */}
      <div className="aa-bande-basse">
        <div className="aa-bande-basse-cadre">
          <PageCulturalBand pathname="/admins" placement="bottom" />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          LA FICHE COMPLÈTE — plein écran
          ═══════════════════════════════════════════════════════ */}
      <dialog
        ref={plein}
        className={`aa-fiche ${darkMode ? 'aa-dark' : ''}`}
        onCancel={(event) => { event.preventDefault(); fermerFiche() }}
        aria-labelledby="aa-fiche-titre"
      >
        {fiche && (
          <>
            <header className="aa-fiche-tete">
              <div className="aa-fiche-marque">
                <span className="aa-avatar aa-avatar--grand">
                  <EmployeeProfilePhoto employee={fiche.admin} />
                </span>
                <div>
                  <span className="aa-fiche-eyebrow">Fiche administrateur</span>
                  <h2 id="aa-fiche-titre">{fiche.admin.first_name} {fiche.admin.last_name}</h2>
                  <p>
                    {libelleRole(fiche.admin.role)} · {nomEntreprise(fiche.admin)}
                  </p>
                </div>
              </div>
              <nav className="aa-fiche-onglets" role="tablist" aria-label="Rubriques de la fiche">
                {[
                  ['Profil', User],
                  ['Accès', KeyRound],
                  ['Sécurité', ShieldCheck],
                  ['Historique', History],
                ].map(([nom, Icone]) => (
                  <button
                    key={nom}
                    type="button"
                    role="tab"
                    aria-pressed={fiche.onglet === nom}
                    onClick={() => changerOngletFiche(nom)}
                  >
                    <Icone size={13} />
                    {nom}
                  </button>
                ))}
              </nav>

              <div className="aa-fiche-actions">
                <span className={`aa-etat ${fiche.admin.is_active ? 'is-actif' : ''}`}>
                  {fiche.admin.is_active ? 'Actif' : 'Inactif'}
                </span>
                <button
                  type="button"
                  className="aa-tuile"
                  onClick={fermerFiche}
                  aria-label="Fermer la fiche"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="aa-fiche-corps">
              {fiche.onglet === 'Profil' && (
                <dl className="aa-champs aa-champs--large">
                  <div><dt>Prénom</dt><dd>{fiche.admin.first_name || '—'}</dd></div>
                  <div><dt>Nom</dt><dd>{fiche.admin.last_name || '—'}</dd></div>
                  <div><dt>Adresse de connexion</dt><dd>{fiche.admin.email || 'Non renseignée'}</dd></div>
                  <div><dt>Identifiant</dt><dd>{fiche.admin.username || 'Non renseigné'}</dd></div>
                  <div><dt>Rôle</dt><dd>{libelleRole(fiche.admin.role)}</dd></div>
                  <div><dt>Entreprise</dt><dd>{nomEntreprise(fiche.admin)}</dd></div>
                  <div><dt>Dernière connexion</dt><dd>{formaterDerniereConnexion(fiche.admin.last_login_at)}</dd></div>
                  <div>
                    <dt>Compte créé</dt>
                    <dd>
                      {fiche.admin.created_at
                        ? new Date(fiche.admin.created_at).toLocaleDateString('fr-FR')
                        : 'Non renseigné'}
                      <em>{depuis(fiche.admin.created_at)}</em>
                    </dd>
                  </div>
                </dl>
              )}

              {fiche.onglet === 'Accès' && (
                <AdminAccountOperations
                  key={fiche.admin.id}
                  account={fiche.admin}
                  accounts={rows}
                  enterprises={enterprises}
                  currentId={me?.id}
                  onSaved={load}
                />
              )}

              {fiche.onglet === 'Sécurité' && (
                <div className="aa-fiche-section">
                  <AdminMfaRecovery key={fiche.admin.id} account={fiche.admin} currentId={me?.id} />
                  <p className="aa-aide">Les mots de passe existants ne sont jamais affichés.</p>

                  {fiche.admin.id === me?.id ? (
                    <Link className="aa-bouton-creux" to="/mon-compte">
                      Modifier mon propre mot de passe
                    </Link>
                  ) : (
                    <details className="aa-section aa-password-section">
                      <summary>Définir un nouveau mot de passe</summary>
                      <form onSubmit={(e) => { e.preventDefault(); changeAccountPassword(e) }} className="aa-formulaire aa-password-form">
                        <p>
                          Compte concerné :{' '}
                          <strong>{fiche.admin.email || fiche.admin.username || `${fiche.admin.first_name} ${fiche.admin.last_name}`}</strong>
                        </p>
                        <label>
                          Nouveau mot de passe
                          <input
                            type="password" required minLength={12} maxLength={72}
                            autoComplete="new-password"
                            placeholder="Au moins 12 caractères, par exemple une phrase de passe"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={busy}
                          />
                        </label>
                        <label>
                          Confirmer le nouveau mot de passe
                          <input
                            type="password" required minLength={12} maxLength={72}
                            autoComplete="new-password"
                            placeholder="Répétez-le à l’identique"
                            value={passwordConfirmation}
                            onChange={(e) => setPasswordConfirmation(e.target.value)}
                            disabled={busy}
                          />
                        </label>
                        <label>
                          Motif du changement
                          <textarea
                            required minLength={5} maxLength={500}
                            placeholder="Ex. : compte compromis, demande du titulaire, départ de l’équipe…"
                            value={passwordReason}
                            onChange={(e) => setPasswordReason(e.target.value)}
                            disabled={busy}
                          />
                        </label>
                        <small>Le motif est conservé dans le journal. N’y inscrivez aucun mot de passe.</small>
                        <AdminSceau
                          checked={passwordAcknowledged}
                          onChange={(e) => setPasswordAcknowledged(e.target.checked)}
                          disabled={busy}
                          required
                        >
                          Je confirme le remplacement pour ce compte.
                        </AdminSceau>
                        <div className="aa-formulaire-pied">
                          <button className="aa-bouton-plein" disabled={busy} type="submit">
                            {busy ? 'Enregistrement…' : 'Remplacer le mot de passe'}
                          </button>
                        </div>
                        <AdminExplication titre="Ce que cette action fait — et ne fait pas">
                          <p>
                            Elle n’envoie pas de lien de récupération, n’impose pas de changement à la
                            prochaine connexion et ne ferme pas les sessions déjà ouvertes.
                          </p>
                        </AdminExplication>
                      </form>
                    </details>
                  )}

                  <details className="aa-section">
                    <summary>Sessions de connexion</summary>
                    <AdminAccountSessions adminId={fiche.admin.id} />
                  </details>

                  <div className="aa-avis aa-avis--info">
                    <ShieldCheck size={15} />
                    <div>
                      <strong>Double authentification</strong>
                      <span>Enrôlement personnel depuis « Mon compte », après activation du contrôle serveur.</span>
                    </div>
                  </div>

                  <details className="aa-section aa-danger-section">
                    <summary>Désactiver ce compte</summary>
                    <form onSubmit={changeStatus} className="aa-formulaire">
                      <label>
                        Motif de l’intervention
                        <textarea
                          required minLength={5} maxLength={500}
                          placeholder="Ex. : fin de mission, remplacement par la responsable paie…"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <AdminExplication titre="Ce qu’une désactivation conserve">
                        <p>
                          Une désactivation conserve l’historique. Ce n’est ni une suppression définitive
                          ni une révocation immédiate des jetons déjà émis.
                        </p>
                      </AdminExplication>
                      <div className="aa-formulaire-pied">
                        <button
                          className="aa-bouton-danger"
                          disabled={busy || fiche.admin.id === me?.id}
                          type="submit"
                        >
                          {busy ? 'Enregistrement…' : fiche.admin.is_active ? 'Désactiver ce compte' : 'Réactiver ce compte'}
                        </button>
                      </div>
                      {fiche.admin.id === me?.id && <p className="aa-aide">Votre propre compte est protégé.</p>}
                    </form>
                  </details>

                  {notice && <p role="status" className="aa-notice">{notice}</p>}
                </div>
              )}

              {fiche.onglet === 'Historique' && (
                <div className="aa-fiche-section">
                  {historyLoading ? (
                    <p role="status">Lecture du journal…</p>
                  ) : eventError ? (
                    <p role="alert">{eventError}</p>
                  ) : events.length ? (
                    <ol className="aa-journal-liste">
                      {events.map((item) => (
                        <li key={item.id}>
                          <time>{new Date(item.created_at).toLocaleString('fr-FR')}</time>
                          <div>
                            <strong>
                              {{
                                profile_updated: 'Profil modifié',
                                password_changed: 'Mot de passe remplacé',
                                suspended: 'Compte désactivé',
                                reactivated: 'Compte réactivé',
                              }[item.action] || item.action}
                            </strong>
                            <p>{item.reason}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="aa-aide">Aucune intervention enregistrée sur ce compte.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </dialog>

      {/* ═══════════════════════════════════════════════════════
          CONSERVER LA LECTURE DE L'HISTORIQUE POUR LA FICHE
          ═══════════════════════════════════════════════════════ */}
      <dialog
        ref={actionRapideRef}
        className={`aa-fiche aa-fiche--etroite ${darkMode ? 'aa-dark' : ''}`}
        onCancel={(event) => { event.preventDefault(); setActionRapide(false) }}
        aria-labelledby="aa-action-titre"
      >
        {actionRapide && (
          <>
            <header className="aa-fiche-tete">
              <div className="aa-fiche-marque">
                <UserPlus size={22} />
                <div>
                  <span className="aa-fiche-eyebrow">Nouveau compte</span>
                  <h2 id="aa-action-titre">Inviter un administrateur</h2>
                  <p>Un e-mail et un mot de passe ouvrent l’accès.</p>
                </div>
              </div>
              <button type="button" className="aa-tuile" onClick={() => setActionRapide(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </header>
            <div className="aa-fiche-corps">
              <div className="aa-avis aa-avis--attention">
                <KeyRound size={15} />
                <div>
                  <strong>Une invitation, pas un mot de passe partagé</strong>
                  <span>
                    L’invitation part par e-mail, expire d’elle-même et se révoque. Le registre
                    ci-dessous montre son état réel : envoyée, acceptée, annulée.
                  </span>
                </div>
              </div>

              <AdminInvitations enterprises={enterprises} />

              <div className="aa-formulaire-pied">
                <button type="button" className="aa-bouton-creux" onClick={() => setActionRapide(false)}>
                  Fermer
                </button>
              </div>
            </div>
          </>
        )}
      </dialog>
    </main>
  )
}
