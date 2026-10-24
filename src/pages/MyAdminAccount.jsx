import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  SunMoon,
  User,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import PageCulturalBand from '../components/PageCulturalBand'
import EmployeeProfilePhoto from '../components/EmployeeProfilePhoto'
import {
  currentAdminAccount,
  accountRpc,
  uploadAdminAvatar,
} from '../services/adminAccounts'
import './AdminAccounts.css'
import AdminAvatarCrop from '../components/AdminAvatarCrop'

export default function MyAdminAccount() {
  const { darkMode, toggleTheme } = useTheme()
  const [me, setMe] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const [first, setFirst] = useState(''),
    [last, setLast] = useState(''),
    [file, setFile] = useState(null)
  const [cropSource, setCropSource] = useState(null)
  const [preview, setPreview] = useState(''),
    [tab, setTab] = useState('profile'),
    [busy, setBusy] = useState(false)
  const [oldPassword, setOldPassword] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('')
  const [mfa, setMfa] = useState(null)
  const lock = useRef(false)
  useEffect(() => {
    let alive = true
    currentAdminAccount()
      .then((account) => {
        if (alive) {
          setMe(account)
          setFirst(account.first_name || '')
          setLast(account.last_name || '')
        }
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    let alive = true
    if (me)
      supabase.auth.mfa.listFactors().then(({ data, error: err }) => {
        if (alive)
          setMfa(err ? { error: err.message } : { factors: data.totp || [] })
      })
    return () => {
      alive = false
    }
  }, [me])
  async function run(action) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setNotice('')
    try {
      await action()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  async function save(event) {
    event.preventDefault()
    await run(async () => {
      let photo
      try {
        if (file) photo = await uploadAdminAvatar(file, me.user_id)
        await accountRpc('encheck_account_profile', {
          p_first_name: first.trim(),
          p_last_name: last.trim(),
          p_photo_url: photo?.url || null,
        })
      } catch (err) {
        if (photo)
          await supabase.storage.from('admin-avatars').remove([photo.path])
        throw err
      }
      const updated = {
        ...me,
        first_name: first.trim(),
        last_name: last.trim(),
        photo_url: photo?.url || me.photo_url,
      }
      setMe(updated)
      setFile(null)
      // Cosmetic cache only; authorization still comes from Auth and the server.
      try {
        const cached = JSON.parse(localStorage.getItem('admin') || 'null')
        if (cached?.id === me.id)
          localStorage.setItem(
            'admin',
            JSON.stringify({
              ...cached,
              first_name: updated.first_name,
              last_name: updated.last_name,
              photo_url: updated.photo_url,
            }),
          )
      } catch {
        /* local cache is optional */
      }
      setNotice('Votre profil a été enregistré.')
    })
  }
  async function changePassword(event) {
    event.preventDefault()
    await run(async () => {
      if (password.length < 12 || password !== confirm)
        throw new Error(
          'Les deux mots de passe doivent être identiques et contenir au moins 12 caractères.',
        )
      const verified = await supabase.auth.signInWithPassword({
        email: me.email,
        password: oldPassword,
      })
      if (verified.error || verified.data.user?.id !== me.user_id)
        throw new Error('Vérification du mot de passe actuel refusée.')
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setOldPassword('')
      setPassword('')
      setConfirm('')
      setNotice(
        'Mot de passe modifié. Vous pouvez également déconnecter les autres sessions ci-dessous.',
      )
    })
  }
  return (
    <main className={`aa-page ${darkMode ? 'aa-dark' : ''}`}>
      <nav className="aa-top">
        <Link to="/dashboard">
          <ArrowLeft size={16} /> Tableau de bord
        </Link>
        <button onClick={toggleTheme} aria-label="Changer le thème">
          <SunMoon size={18} />
        </button>
      </nav>
      <div className="aa-shell">
        <PageCulturalBand pathname="/admins" />
        <header className="aa-heading">
          <div>
            <span className="aa-eyebrow">VOTRE ESPACE PERSONNEL</span>
            <h1>
              Mon compte<span>.</span>
            </h1>
            <p>Votre identité, votre sécurité, vos préférences.</p>
          </div>
          {me?.role === 'super_admin' && (
            <Link to="/admins">Administration des accès →</Link>
          )}
        </header>
        {error ? (
          <p role="alert" className="aa-panel">
            {error} <Link to="/login">Se reconnecter</Link>
          </p>
        ) : !me ? (
          <p role="status" className="aa-panel">
            Vérification de votre compte…
          </p>
        ) : (
          <div className="aa-account-grid">
            <aside className="aa-panel aa-identity">
              <EmployeeProfilePhoto
                employee={{ ...me, photo_url: preview || me.photo_url }}
              />
              <h2>
                {me.first_name} {me.last_name}
              </h2>
              <p>{me.email}</p>
              <span className="aa-state is-active">
                {me.role === 'super_admin'
                  ? 'Superadministrateur'
                  : 'Administrateur'}
              </span>
              <div className="aa-account-nav">
                {[
                  ['profile', 'Mon profil', User],
                  ['security', 'Ma sécurité', ShieldCheck],
                  ['preferences', 'Mes préférences', SlidersHorizontal],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    aria-pressed={tab === key}
                    onClick={() => {
                      setTab(key)
                      setNotice('')
                    }}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </aside>
            <section className="aa-panel aa-account-form">
              {tab === 'profile' && (
                <form onSubmit={save}>
                  <h2>Mon profil</h2>
                  <p>Ces informations ne changent pas vos permissions.</p>
                  <label>
                    Prénom
                    <input
                      required
                      maxLength={80}
                      value={first}
                      onChange={(e) => setFirst(e.target.value)}
                    />
                  </label>
                  <label>
                    Nom
                    <input
                      required
                      maxLength={80}
                      value={last}
                      onChange={(e) => setLast(e.target.value)}
                    />
                  </label>
                  <label>
                    Photo de profil
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(e) => {
                        const chosen = e.target.files?.[0]
                        if (
                          chosen &&
                          (!['image/jpeg', 'image/png', 'image/webp'].includes(
                            chosen.type,
                          ) ||
                            chosen.size > 2 * 1024 * 1024)
                        ) {
                          setNotice('Image JPG, PNG ou WebP, maximum 2 Mo.')
                          e.target.value = ''
                          return
                        }
                        if (chosen) setCropSource(chosen)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <small>
                    JPG, PNG ou WebP, 2 Mo maximum. Recadrez avant de valider.
                    La photo sera publique après enregistrement du profil.
                  </small>
                  {file && (
                    <div className="aa-photo-pending">
                      <p role="status">
                        Nouvelle photo recadrée, pas encore enregistrée.
                      </p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setFile(null)}
                      >
                        Annuler le changement de photo
                      </button>
                    </div>
                  )}
                  <label>
                    Adresse de connexion
                    <input value={me.email || ''} readOnly />
                  </label>
                  <p className="aa-footnote">
                    Le changement d’adresse avec double vérification sera ajouté
                    dans un prochain lot.
                  </p>
                  <button className="aa-primary" disabled={busy}>
                    {busy ? 'Enregistrement…' : 'Enregistrer mon profil'}
                  </button>
                </form>
              )}
              {tab === 'security' && (
                <>
                  <form onSubmit={changePassword}>
                    <h2>Changer mon mot de passe</h2>
                    <label>
                      Mot de passe actuel
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                      />
                    </label>
                    <label>
                      Nouveau mot de passe
                      <input
                        type="password"
                        minLength={12}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                    <label>
                      Confirmer le nouveau mot de passe
                      <input
                        type="password"
                        minLength={12}
                        required
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                      />
                    </label>
                    <button disabled={busy || !me.email}>
                      Modifier mon mot de passe
                    </button>
                  </form>
                  <hr />
                  <h3>Double authentification</h3>
                  <p>
                    {!mfa
                      ? 'Lecture de la configuration…'
                      : mfa.error
                        ? 'Configuration indisponible.'
                        : mfa.factors.some((f) => f.status === 'verified')
                          ? 'Un facteur TOTP est enregistré.'
                          : 'Aucun facteur TOTP vérifié.'}
                  </p>
                  <p className="aa-footnote">
                    L’activation guidée et l’obligation de vérification à chaque
                    connexion nécessitent encore une intégration du parcours de
                    connexion.
                  </p>
                  <h3>Sessions de connexion</h3>
                  <p>
                    Déconnecter les autres sessions révoque leur renouvellement.
                    Un jeton déjà émis peut rester valable jusqu’à son
                    expiration.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Déconnecter vos autres sessions ?'))
                        run(async () => {
                          const { error: err } = await supabase.auth.signOut({
                            scope: 'others',
                          })
                          if (err) throw err
                          setNotice(
                            'Le renouvellement des autres sessions a été révoqué.',
                          )
                        })
                    }}
                  >
                    Déconnecter mes autres sessions
                  </button>
                  <p className="aa-footnote">
                    La liste des appareils et les alertes de connexion ne sont
                    pas encore disponibles dans cet espace.
                  </p>
                </>
              )}
              {tab === 'preferences' && (
                <>
                  <h2>Mes préférences</h2>
                  <p>
                    Le thème est enregistré sur cet appareil et partagé avec les
                    autres pages.
                  </p>
                  <button onClick={toggleTheme}>
                    {darkMode
                      ? 'Passer au thème clair'
                      : 'Passer au thème sombre'}
                  </button>
                  <h3>Mes accès</h3>
                  <p>
                    Rôle serveur : <strong>{me.role}</strong>. Les permissions
                    et les entreprises sont attribuées par le
                    superadministrateur.
                  </p>
                  <p className="aa-footnote">
                    Les préférences de notifications et de page d’accueil ne
                    sont pas encore configurables ici.
                  </p>
                </>
              )}
              {notice && (
                <p role="status" className="aa-notice">
                  {notice}
                </p>
              )}
            </section>
          </div>
        )}
        <PageCulturalBand pathname="/admins" placement="bottom" />
      </div>
      {cropSource && (
        <AdminAvatarCrop
          file={cropSource}
          darkMode={darkMode}
          onCancel={() => setCropSource(null)}
          onConfirm={(cropped) => {
            setFile(cropped)
            setCropSource(null)
            setNotice('Photo prête. Enregistrez votre profil pour la publier.')
          }}
        />
      )}
    </main>
  )
}
