import AdminMyPermissions from '../components/AdminMyPermissions'
import AdminSecurityAlerts from '../components/AdminSecurityAlerts'
import AdminSupportDiagnostic from '../components/AdminSupportDiagnostic'
import AdminVerifiedEmail from '../components/AdminVerifiedEmail'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  User,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import PageCulturalBand from '../components/PageCulturalBand'
import { AbomeyBlasonSvg } from '../components/AbomeySvg'
import AdminsLoadingScreen from '../components/AdminsLoadingScreen'
import RaccourcisPages from '../components/RaccourcisPages'
import AdminExplication from '../components/AdminExplication'
import EmployeeProfilePhoto from '../components/EmployeeProfilePhoto'
import {
  currentAdminAccount,
  accountRpc,
  uploadAdminAvatar,
} from '../services/adminAccounts'
import './AdminAccounts.css'
import AdminAvatarCrop from '../components/AdminAvatarCrop'
import AdminMfaSettings from '../components/AdminMfaSettings'
import AdminAccountSessions from '../components/AdminAccountSessions'
import AdminAccountPreferences from '../components/AdminAccountPreferences'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
import { formaterDerniereConnexion, libelleRole } from '../utils/adminsPresentation'

export default function MyAdminAccount() {
  const { darkMode, toggleTheme } = useTheme()
  const { ensureMfa, challenge } = useAdminMfaCheckpoint()
  const [me, setMe] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const [first, setFirst] = useState(''),
    [last, setLast] = useState(''),
    [file, setFile] = useState(null)
  const [cropSource, setCropSource] = useState(null)
  const [chargeur, setChargeur] = useState(false)
  const [chargeurSaute, setChargeurSaute] = useState(false)
  const [preview, setPreview] = useState(''),
    [tab, setTab] = useState('profile'),
    [busy, setBusy] = useState(false)
  const [oldPassword, setOldPassword] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('')
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
    if (me || error) {
      setChargeur(false)
      return undefined
    }
    const minuterie = window.setTimeout(() => setChargeur(true), 300)
    return () => window.clearTimeout(minuterie)
  }, [me, error])
  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
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
      await ensureMfa()
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
  function choisirPhoto(event) {
    const chosen = event.target.files?.[0]
    const acceptes = ['image/jpeg', 'image/png', 'image/webp']
    if (chosen && (!acceptes.includes(chosen.type) || chosen.size > 2 * 1024 * 1024)) {
      setNotice('Image JPG, PNG ou WebP, maximum 2 Mo.')
      event.target.value = ''
      return
    }
    if (chosen) setCropSource(chosen)
    event.target.value = ''
  }
  if (challenge) return challenge
  if (chargeur && !chargeurSaute) {
    return (
      <AdminsLoadingScreen
        darkMode={darkMode}
        variante="compte"
        onSkip={() => {
          setChargeurSaute(true)
          setChargeur(false)
        }}
      />
    )
  }
  const nomComplet =
    [me?.first_name, me?.last_name].filter(Boolean).join(' ') || 'Compte administrateur'
  const rubriques = [
    ['profile', 'Mon profil', User],
    ['security', 'Ma sécurité', ShieldCheck],
    ['preferences', 'Mes préférences', SlidersHorizontal],
  ]

  return (
    <main className={`aa-page aa-compte ${darkMode ? 'aa-dark' : ''}`}>
      {/* Une bande courte : un en-tête de pièce, pas un frontispice. */}
      <div className="aa-compte-bande">
        <PageCulturalBand pathname="/admins" />
      </div>

      <div className="aa-compte-shell">
        <nav className="aa-compte-barre" aria-label="Navigation du compte">
          {/* Superadmin : on revient d'où l'on vient, dans l'administration.
              Les autres gardent leur tableau de bord. */}
          {me?.role === 'super_admin' ? (
            <Link className="aa-compte-retour" to="/admins">
              <ArrowLeft size={14} />
              Administration des accès
            </Link>
          ) : (
            <Link className="aa-compte-retour" to="/dashboard">
              <ArrowLeft size={14} />
              Tableau de bord
            </Link>
          )}
          <div className="aa-compte-barre-actions">
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
        </nav>

        <header className="aa-compte-entete">
          <AbomeyBlasonSvg size={46} />
          <div>
            <span className="aa-compte-eyebrow">Votre espace personnel</span>
            <h1>
              Mon compte<span>.</span>
            </h1>
            <p>Votre identité, votre sécurité, vos préférences.</p>
          </div>
        </header>

        {/* Les raccourcis : les mêmes que sur l'accueil de l'administration */}
        <div className="aa-raccourcis">
          <span className="aa-raccourcis-libelle">Aller à</span>
          <RaccourcisPages compact excludePaths={['/admins', '/mon-compte']} />
        </div>

        {error ? (
          <div role="alert" className="aa-compte-vide">
            <AbomeyBlasonSvg size={34} />
            <p>{error}</p>
            <Link className="aa-bouton-creux" to="/login">
              Se reconnecter
            </Link>
          </div>
        ) : !me ? (
          <div role="status" className="aa-compte-vide">
            <AbomeyBlasonSvg size={34} />
            <p>Vérification de votre compte…</p>
          </div>
        ) : (
          <div className="aa-compte-grille">
            <aside className="aa-compte-identite" aria-label="Votre identité">
              <EmployeeProfilePhoto
                employee={{ ...me, photo_url: preview || me.photo_url }}
              />
              <h2>{nomComplet}</h2>
              <p>{me.email}</p>
              <span className="aa-compte-role">{libelleRole(me.role)}</span>
              <dl className="aa-compte-meta">
                <div>
                  <dt>Dernière connexion</dt>
                  <dd>{formaterDerniereConnexion(me.last_login_at)}</dd>
                </div>
                <div>
                  <dt>Rôle</dt>
                  <dd>{libelleRole(me.role)}</dd>
                </div>
              </dl>
            </aside>

            <div className="aa-compte-contenu">
              <nav
                className="aa-compte-onglets"
                role="tablist"
                aria-label="Rubriques du compte"
              >
                {rubriques.map(([cle, libelle, Icone]) => (
                  <button
                    key={cle}
                    type="button"
                    role="tab"
                    aria-pressed={tab === cle}
                    onClick={() => {
                      setTab(cle)
                      setNotice('')
                    }}
                  >
                    <Icone size={14} />
                    {libelle}
                  </button>
                ))}
              </nav>

              <section className="aa-compte-panneau">
                {tab === 'profile' && (
                  <form className="aa-compte-formulaire" onSubmit={save}>
                    <div className="aa-compte-section-tete">
                      <h2>Mon profil</h2>
                      <p>Ces informations ne changent pas vos permissions.</p>
                    </div>

                    <div className="aa-compte-champs">
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
                    </div>

                    <div className="aa-compte-photo">
                      <EmployeeProfilePhoto
                        employee={{ ...me, photo_url: preview || me.photo_url }}
                      />
                      <div className="aa-compte-photo-texte">
                        <strong>Photo de profil</strong>
                        <small>JPG, PNG ou WebP, 2 Mo maximum.</small>
                        <div className="aa-compte-photo-actions">
                          <label>
                            {file ? 'Changer la photo' : 'Choisir une image'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={busy}
                              onChange={choisirPhoto}
                            />
                          </label>
                          {file && (
                            <button
                              type="button"
                              className="aa-compte-lien-discret"
                              disabled={busy}
                              onClick={() => setFile(null)}
                            >
                              Annuler le changement
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <AdminExplication titre="Comment la photo est publiée">
                      <p>
                        Recadrez avant de valider. La photo sera publique après
                        enregistrement du profil ; tant que vous n’enregistrez
                        pas, rien n’est publié.
                      </p>
                    </AdminExplication>
                    {file && (
                      <p role="status" className="aa-compte-note">
                        Nouvelle photo recadrée, pas encore enregistrée.
                      </p>
                    )}

                    <label>
                      Adresse de connexion
                      <input value={me.email || ''} readOnly placeholder="Adresse donnée par l’invitation" />
                    </label>
                    <p className="aa-compte-note">
                      Le changement d’adresse avec double vérification sera
                      ajouté dans un prochain lot.
                    </p>

                    <div className="aa-compte-pied">
                      <button
                        type="submit"
                        className="aa-bouton-plein"
                        disabled={busy}
                      >
                        {busy ? 'Enregistrement…' : 'Enregistrer mon profil'}
                      </button>
                    </div>
                  </form>
                )}

                {tab === 'security' && (
                  <div className="aa-compte-sections">
                    <form onSubmit={changePassword}>
                      <div className="aa-compte-section-tete">
                        <h2>Changer mon mot de passe</h2>
                      </div>
                      <AdminExplication titre="Ce que ce changement ne ferme pas" ouvert>
                        <p>
                          Douze caractères minimum. Les sessions déjà ouvertes ne
                          sont pas fermées par ce changement : révoquez-les
                          ci-dessous si nécessaire.
                        </p>
                      </AdminExplication>
                      <label>
                        Mot de passe actuel
                        <input
                          type="password"
                          required
                          autoComplete="current-password"
                          placeholder="Votre mot de passe actuel"
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
                          placeholder="Au moins 12 caractères"
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
                          placeholder="Répétez le nouveau mot de passe"
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                        />
                      </label>
                      <div className="aa-compte-pied">
                        <button
                          type="submit"
                          className="aa-bouton-plein"
                          disabled={busy || !me.email}
                        >
                          {busy ? 'Enregistrement…' : 'Modifier mon mot de passe'}
                        </button>
                      </div>
                    </form>

                    <AdminVerifiedEmail />
                    <AdminMfaSettings />
                    <AdminSecurityAlerts />
                    <AdminAccountSessions />
                  </div>
                )}

                {tab === 'preferences' && (
                  <div className="aa-compte-sections">
                    <div className="aa-compte-section-tete">
                      <h2>Mes préférences</h2>
                      <p>
                        Le thème est enregistré sur cet appareil et partagé avec
                        les autres pages.
                      </p>
                    </div>
                    <div className="aa-compte-reglage">
                      <div>
                        <strong>Thème sombre</strong>
                        <small>
                          Indigo nuit, terre cuite et fil doré — l’identité de la
                          maison.
                        </small>
                      </div>
                      <button
                        type="button"
                        className="aa-bascule"
                        role="switch"
                        aria-checked={darkMode}
                        onClick={toggleTheme}
                        aria-label="Thème sombre"
                      >
                        <span className="aa-bascule-pastille">
                          {darkMode ? <Moon size={10} /> : <Sun size={10} />}
                        </span>
                      </button>
                    </div>
                    <AdminAccountPreferences />
                    <AdminMyPermissions />
                    <AdminSupportDiagnostic />
                  </div>
                )}

                {notice && (
                  <p role="status" className="aa-notice">
                    {notice}
                  </p>
                )}
              </section>
            </div>
          </div>
        )}
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
