// ═══════════════════════════════════════════════════════════
// 📣 ANNONCES D'ACCUEIL — le carrousel média de l'en-tête
//    de l'app Pointage (images, GIF, vidéos courtes).
//
//    Superadministrateur + MFA (AAL2) obligatoires.
//    Contrat : docs/ADMIN-ANNONCES-ACCUEIL-CONTRAT.md
//
//    Flux de publication :
//      1. vérifier le fichier (type, poids, durée si vidéo)
//      2. défi MFA AAL2 si besoin (useAdminMfaCheckpoint)
//      3. envoi vers le bucket `annonces-accueil`
//         (chemin {entreprise}/{annonce-uuid}/{fichier})
//      4. RPC encheck_annonce_accueil_mettre_a_jour (le serveur
//         re-vérifie MIME réel, taille, chemin, durée, cap de 8)
//    La lecture de la liste passe par encheck_annonce_accueil_lister
//    (la table est verrouillée RLS, aucun accès direct).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, CheckCircle2, Film,
  Image as ImageIcon, Megaphone, Pause, Pencil, Play, Power,
  RefreshCw, Repeat, SkipBack, SkipForward, Sun, Moon,
  Trash2, Upload, Users,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import PageCulturalBand from '../components/PageCulturalBand'
import { AbomeyBlasonSvg, AbomeyCoinSvg } from '../components/AbomeySvg'
import RaccourcisPages from '../components/RaccourcisPages'
import AdminExplication from '../components/AdminExplication'
import useAdminMfaCheckpoint from '../hooks/useAdminMfaCheckpoint'
import { currentAdminAccount, accountRpc } from '../services/adminAccounts'
import './AdminAccounts.css'
import './AnnoncesAccueil.css'

// ── Le catalogue des médias autorisés (réduit au même endroit ──
//    que les bornes serveur du contrat)
const TYPES = {
  image: {
    libelle: 'Image', icone: ImageIcon,
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    ext: ['jpg', 'jpeg', 'png', 'webp'],
    max: 512 * 1024, maxKo: '500 Ko', formats: 'JPEG · PNG · WebP',
  },
  gif: {
    libelle: 'GIF', icone: Repeat,
    mimes: ['image/gif'],
    ext: ['gif'],
    max: 2 * 1024 * 1024, maxKo: '2 Mo', formats: 'GIF animé',
  },
  video: {
    libelle: 'Vidéo', icone: Film,
    mimes: ['video/mp4', 'video/quicktime'],
    ext: ['mp4', 'mov'],
    max: 5 * 1024 * 1024, maxKo: '5 Mo', formats: 'MP4 · MOV (muette)',
  },
}
const MIME_VERS_TYPE = Object.fromEntries(
  Object.entries(TYPES).flatMap(([cle, m]) => m.mimes.map((mime) => [mime, cle])),
)
// Extension canonique par MIME réel (le type est dérivé du MIME, jamais choisi à la main)
const EXT_PAR_MIME = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/gif': '.gif', 'video/mp4': '.mp4', 'video/quicktime': '.mov',
}
const DUREE_MIN = 3, DUREE_MAX = 15, MAX_ANNONCES = 8, VIDEO_MAX_S = 30
const ACCEPT = Object.values(TYPES).flatMap((m) => m.mimes).join(',')

const STATUTS = {
  en_ligne: 'En ligne',
  programmee: 'Programmée',
  expinee: 'Expirée',
  inactive: 'Inactive',
}

function fmtKo(n) {
  if (!Number.isFinite(n)) return ''
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(n / 1024)} Ko`
}
function fmtDate(iso) {
  if (!iso || iso === 'null') return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
// valeur `datetime-local` ← instant ISO (heure locale)
function pourChampDateTime(iso) {
  if (!iso || iso === 'null') return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE').slice(0, 16)
}

export default function AnnoncesAccueil() {
  const { darkMode, toggleTheme } = useTheme()
  const { ensureMfa, challenge } = useAdminMfaCheckpoint()

  const [me, setMe] = useState(null)
  const [enterprises, setEnterprises] = useState([])
  const [entreprise, setEntreprise] = useState('')
  const [annonces, setAnnonces] = useState(null) // null = non chargé
  const [journal, setJournal] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('medias')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  // formulaire
  const [fichier, setFichier] = useState(null)
  const [apercu, setApercu] = useState(null)
  const [apercuEst, setApercuEst] = useState(null) // type du média d'aperçu
  const [typeMedia, setTypeMedia] = useState('')
  const [avertissement, setAvertissement] = useState('')
  const [duree, setDuree] = useState(5)
  const [debuteLe, setDebuteLe] = useState('')
  const [termineLe, setTermineLe] = useState('')
  const [publier, setPublier] = useState(true)
  const [enEdition, setEnEdition] = useState(null)
  const [ordonne, setOrdonne] = useState(1)
  const [confirmationSuppression, setConfirmationSuppression] = useState(null)

  // aperçu carrousel
  const [previewIndex, setPreviewIndex] = useState(0)
  const [lecture, setLecture] = useState(true)

  const epoch = useRef(0)
  const lock = useRef(false)
  const fileInput = useRef(null)

  // Deuxième barrière, lisible : le défi MFA (ensureMfa) puis une relecture
  // du niveau de la session. Si la session n'est pas à l'assurance AAL2,
  // on explique au lieu de laisser le serveur renvoyer un refus opaque.
  async function securite() {
    await ensureMfa()
    const { data: nivAal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!nivAal || nivAal.currentLevel !== 'aal2')
      throw new Error('Second facteur requis (AAL2) : votre session n’est pas vérifiée. Si le défi ne s’ouvre pas, vérifiez vos facteurs MFA dans Mon compte → Sécurité.')
  }

  // ── Comptes + entreprises (une seule fois) ──
  const charger = useCallback(async () => {
    const req = ++epoch.current
    setLoading(true)
    setError('')
    try {
      const actor = await currentAdminAccount()
      if (actor.role !== 'super_admin')
        throw new Error('Cet espace est réservé au superadministrateur.')
      const comps = await supabase
        .from('enterprises')
        .select('id,name')
        .eq('is_active', true)
        .order('name')
        .limit(500)
      if (comps.error) throw comps.error
      if (req !== epoch.current) return
      setMe(actor)
      setEnterprises(comps.data || [])
      setEntreprise((prev) => prev || (comps.data || [])[0]?.id || '')
    } catch (e) {
      if (req === epoch.current) setError(e.message)
    } finally {
      if (req === epoch.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    charger()
    return () => { epoch.current++ }
  }, [charger])

  // ── Les annonces de l'entreprise choisie (RPC, MFA requis) ──
  const chargerAnnonces = useCallback(async () => {
    if (!entreprise) return
    setAnnonces(null)
    setNotice(null)
    try {
      await securite()
      const data = await accountRpc('encheck_annonce_accueil_lister', { p_enterprise_id: entreprise })
      if (data?.ok !== true)
        throw new Error(data?.raison === 'entreprise_inconnue' ? 'Entreprise inconnue.' : 'Lecture refusée. Vérifiez votre session MFA.')
      setAnnonces(data.annonces || [])
      setJournal(data.journal || [])
    } catch (e) {
      // annulation du défi MFA = la session est déjà gérée (déconnexion)
      if (e.message === 'Connexion annulée.' || e.message === 'Vérification interrompue.') return
      setAnnonces([])
      setJournal([])
      setNotice({ ton: 'alerte', texte: e.message })
    }
  }, [entreprise, ensureMfa])
  useEffect(() => { chargerAnnonces() }, [chargerAnnonces])

  // ── Le carrousel suit l'entreprise et sa liste ──
  const enLigne = useMemo(
    () => (annonces || []).filter((a) => a.statut === 'en_ligne'),
    [annonces],
  )
  useEffect(() => { setPreviewIndex(0) }, [entreprise])
  useEffect(() => {
    if (!lecture || enLigne.length < 2) return undefined
    const courant = enLigne[Math.min(previewIndex, enLigne.length - 1)]
    if (!courant) return undefined
    const t = window.setTimeout(
      () => setPreviewIndex((i) => (i + 1) % enLigne.length),
      courant.duree_affichage_ms || 5000,
    )
    return () => window.clearTimeout(t)
  }, [lecture, previewIndex, enLigne])

  // ── Choisir un fichier ──
  function analyserFichier(f) {
    setAvertissement('')
    if (!f) return
    const cle = MIME_VERS_TYPE[f.type]
    if (!cle) {
      setAvertissement('Format non autorisé. Formats : image JPEG/PNG/WebP, GIF animé, vidéo MP4/MOV.')
      return
    }
    const meta = TYPES[cle]
    if (f.size > meta.max) {
      setAvertissement(`Fichier trop lourd : ${fmtKo(f.size)} (maximum ${meta.maxKo} pour une ${meta.libelle.toLowerCase()}).`)
      return
    }
    const url = URL.createObjectURL(f)
    setApercu(url)
    setApercuEst(cle)
    setTypeMedia(cle)
    if (cle === 'video') {
      // durée réelle lue depuis les métadonnées, avant l'envoi
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        if (video.duration && Number.isFinite(video.duration) && video.duration > VIDEO_MAX_S) {
          URL.revokeObjectURL(url)
          setApercu(null); setApercuEst(null); setTypeMedia(''); setFichier(null)
          setAvertissement(`Vidéo trop longue : ${Math.round(video.duration)} s (maximum ${VIDEO_MAX_S} s).`)
        } else setFichier(f)
      }
      video.onerror = () => setFichier(f) // métadonnées illisibles : le serveur re-contrôle
      video.src = url
    } else if (cle === 'image') {
      setFichier(f)
      const img = new Image()
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight
          && Math.abs(img.naturalWidth / img.naturalHeight - 16 / 9) > 0.06)
          setAvertissement('Image non 16:9 : elle sera recadrée dans l’en-tête (le cadre de l’app ne change jamais de dimensions).')
      }
      img.src = url
    } else {
      setFichier(f)
    }
  }
  function viderForm() {
    if (apercu) URL.revokeObjectURL(apercu)
    setFichier(null); setApercu(null); setApercuEst(null); setTypeMedia('')
    setAvertissement(''); setDuree(5); setDebuteLe(''); setTermineLe('')
    setPublier(true); setEnEdition(null)
    setOrdonne(Math.max(0, ...(annonces || []).map((a) => a.ordre_publication)) + 1)
    if (fileInput.current) fileInput.current.value = ''
  }
  function ouvrirEdition(a) {
    viderForm()
    setEnEdition(a)
    if (a.url) { setApercu(a.url); setApercuEst(a.type) } // aperçu = média actuel (pas de copie locale à révoquer)
    setTypeMedia(a.type)
    setDuree(Math.round(a.duree_affichage_ms / 1000))
    setOrdonne(a.ordre_publication)
    setDebuteLe(pourChampDateTime(a.debute_le))
    setTermineLe(pourChampDateTime(a.termine_le))
    setPublier(a.is_active)
  }

  // ── Publication / mise à jour (MFA AAL2 avant l'envoi) ──
  const peutEnvoyer = !!(
    entreprise && (fichier || enEdition) && typeMedia
    && duree >= DUREE_MIN && duree <= DUREE_MAX && ordonne >= 1
    && (!debuteLe || !termineLe || new Date(termineLe) > new Date(debuteLe))
    && !(enEdition === null && (annonces || []).length >= MAX_ANNONCES)
  )
  async function envoyer() {
    if (lock.current || !peutEnvoyer) return
    lock.current = true
    setBusy(true)
    setNotice(null)
    try {
      await securite()
      const id = enEdition ? enEdition.id : crypto.randomUUID()
      let chemin = enEdition?.media_path
      if (fichier) {
        // Chemin de stockage : caractères sûrs, troncature qui ne coupe
        // JAMAIS l'extension, et extension forcée au format réel du fichier
        // (dérivé du MIME) si le nom du fichier en manque une ou diverge —
        // le serveur exige une extension cohérente avec le type de média.
        const brut = (fichier.name || 'media').replace(/[^A-Za-z0-9._-]/g, '-')
        const iPoint = brut.lastIndexOf('.')
        const nomPartie = (iPoint > 0 ? brut.slice(0, iPoint) : brut).slice(0, 96) || 'media'
        const extActuelle = iPoint > 0 ? brut.slice(iPoint).toLowerCase() : ''
        const extValides = ((TYPES[typeMedia] || {}).ext || []).map((e) => `.${e}`.toLowerCase())
        const extFinale = extValides.includes(extActuelle) ? brut.slice(iPoint) : (EXT_PAR_MIME[fichier.type] || '')
        chemin = `${entreprise}/${id}/${nomPartie}${extFinale}`
        const { error: errUp } = await supabase.storage
          .from('annonces-accueil')
          .upload(chemin, fichier, { contentType: fichier.type, upsert: true })
        if (errUp)
          throw new Error('Envoi du fichier refusé : ' + (errUp.message || 'vérifiez le format et le poids du fichier.'))
      }
      const res = await accountRpc('encheck_annonce_accueil_mettre_a_jour', {
        p_enterprise_id: entreprise,
        p_id: id,
        p_type_media: typeMedia,
        p_media_path: chemin,
        p_duree_affichage_ms: duree * 1000,
        p_ordre_publication: ordonne,
        p_is_active: publier,
        p_debute_le: debuteLe ? new Date(debuteLe).toISOString() : null,
        p_termine_le: termineLe ? new Date(termineLe).toISOString() : null,
      })
      if (res?.ok !== true) throw new Error('Publication refusée par le serveur.')
      // Le fichier remplacé est nettoyé par le RPC (plus de remove côté client).
      setNotice({ ton: 'ok', texte: enEdition ? 'Annonce mise à jour.' : 'Annonce publiée.' })
      viderForm()
      await chargerAnnonces()
    } catch (e) {
      if (e.message === 'Connexion annulée.' || e.message === 'Vérification interrompue.') return
      setNotice({ ton: 'alerte', texte: e.message })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  // ── Activer / désactiver / supprimer / réordonner ──
  async function basculer(a) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setNotice(null)
    try {
      await securite()
      const res = await accountRpc('encheck_annonce_accueil_mettre_a_jour', {
        p_enterprise_id: entreprise,
        p_id: a.id,
        p_type_media: a.type,
        p_media_path: a.media_path,
        p_duree_affichage_ms: a.duree_affichage_ms,
        p_ordre_publication: a.ordre_publication,
        p_is_active: !a.is_active,
        p_debute_le: a.debute_le === 'null' ? null : a.debute_le,
        p_termine_le: a.termine_le === 'null' ? null : a.termine_le,
      })
      if (res?.ok !== true) throw new Error('Changement refusé par le serveur.')
      setNotice({ ton: 'ok', texte: a.is_active ? 'Annonce désactivée.' : 'Annonce activée.' })
      await chargerAnnonces()
    } catch (e) {
      if (e.message === 'Connexion annulée.' || e.message === 'Vérification interrompue.') return
      setNotice({ ton: 'alerte', texte: e.message })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function supprimer(a) {
    if (lock.current || confirmationSuppression !== a.id) return
    lock.current = true
    setBusy(true)
    setNotice(null)
    try {
      await securite()
      const res = await accountRpc('encheck_annonce_accueil_supprimer', {
        p_enterprise_id: entreprise,
        p_id: a.id,
      })
      if (res?.ok !== true) throw new Error('Suppression refusée par le serveur.')
      // Le fichier de stockage est supprimé par le RPC (aucun remove client).
      setNotice({ ton: 'ok', texte: 'Annonce supprimée.' })
      setConfirmationSuppression(null)
      if (enEdition?.id === a.id) viderForm()
      await chargerAnnonces()
    } catch (e) {
      if (e.message === 'Connexion annulée.' || e.message === 'Vérification interrompue.') return
      setNotice({ ton: 'alerte', texte: e.message })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function deplacer(a, dir) {
    if (lock.current) return
    const liste = [...(annonces || [])].sort((x, y) => x.ordre_publication - y.ordre_publication)
    const i = liste.findIndex((x) => x.id === a.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= liste.length) return
    const [premier, second] = dir > 0 ? [liste[i], liste[j]] : [liste[j], liste[i]]
    const ordreMax = Math.max(...liste.map((x) => x.ordre_publication))
    // Échange en trois temps : un simple A↔B créerait un ordre double
    // interdit par l'index unique (entreprise, ordre_publication).
    const pas = [
      [premier, ordreMax + 1],                       // 1. premier → case libre temporaire
      [second, premier.ordre_publication],           // 2. second ← place de premier
      [premier, second.ordre_publication],           // 3. premier ← place de second
    ]
    lock.current = true
    setBusy(true)
    setNotice(null)
    try {
      await securite()
      for (const [ligne, ordreCible] of pas) {
        const res = await accountRpc('encheck_annonce_accueil_mettre_a_jour', {
          p_enterprise_id: entreprise,
          p_id: ligne.id,
          p_type_media: ligne.type,
          p_media_path: ligne.media_path,
          p_duree_affichage_ms: ligne.duree_affichage_ms,
          p_ordre_publication: ordreCible,
          p_is_active: ligne.is_active,
          p_debute_le: ligne.debute_le === 'null' ? null : ligne.debute_le,
          p_termine_le: ligne.termine_le === 'null' ? null : ligne.termine_le,
        })
        if (res?.ok !== true) throw new Error('Réordonnancement refusé par le serveur.')
      }
      await chargerAnnonces()
    } catch (e) {
      if (e.message === 'Connexion annulée.' || e.message === 'Vérification interrompue.') return
      setNotice({ ton: 'alerte', texte: e.message })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  // ── Petits nombres pour les mesures ──
  const enProgrammation = (annonces || []).filter((a) => a.statut === 'programmee').length
  const expirees = (annonces || []).filter((a) => a.statut === 'expinee').length
  const triees = useMemo(
    () => [...(annonces || [])].sort((x, y) => x.ordre_publication - y.ordre_publication),
    [annonces],
  )
  const courantApercu = enLigne[Math.min(previewIndex, enLigne.length - 1)] || null

  if (challenge) return challenge

  return (
    <main className={`aa-page aa-register ${darkMode ? 'aa-dark' : ''}`}>
      {/* ═══ LA BANDE TISSÉE — pleine largeur, haute ═══ */}
      <div className="aa-bande">
        <PageCulturalBand pathname="/annonces-accueil" />
      </div>

      <div className="aa-grille">
        <div className="aa-colonne">
          {/* ── La barre de titre ── */}
          <header className="aa-heading">
            <div className="aa-heading-gauche">
              <Link
                className="aa-retour"
                to="/dashboard"
                aria-label="Retour au tableau de bord"
                title="Retour au tableau de bord"
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </Link>
              <div className="aa-marque">
                <AbomeyBlasonSvg size={52} />
                <div className="aa-marque-texte">
                  <h1>Annonces d’accueil</h1>
                  <p>Le carrousel média de l’en-tête Pointage</p>
                </div>
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

          {/* ── Les raccourcis ── */}
          <div className="aa-raccourcis">
            <span className="aa-raccourcis-libelle">Aller à</span>
            <RaccourcisPages compact excludePaths={['/annonces-accueil', '/mon-compte']} />
          </div>

          {error ? (
            <div role="alert" className="aa-panel">
              <p>{error}</p>
              <button onClick={charger}>Réessayer</button>
            </div>
          ) : loading ? (
            <div role="status" className="aa-panel aa-chargement">
              <AbomeyBlasonSvg size={40} />
              <p>Préparation des annonces…</p>
            </div>
          ) : (
            <>
              {/* ── L'entreprise ciblée ── */}
              <section className="aa-panel aa-ann-entreprise" aria-label="Entreprise ciblée">
                <label className="aa-puce-select">
                  <Megaphone size={13} />
                  <select
                    aria-label="Entreprise des annonces"
                    value={entreprise}
                    onChange={(e) => setEntreprise(e.target.value)}
                  >
                    <option value="" disabled>Choisir une entreprise…</option>
                    {enterprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="aa-recharge" disabled={busy || annonces === null} onClick={chargerAnnonces}>
                  <RefreshCw size={13} />
                  Actualiser
                </button>
                <AdminExplication titre="Comment ça marche sur l’app Pointage">
                  <p>
                    L’en-tête de l’accueil affiche la photo par défaut immédiatement.
                    S’il existe des annonces actives pour cette entreprise, elles défilent
                    dans un cadre fixe, dans l’ordre choisi ici, pour la durée choisie ici.
                  </p>
                  <p>
                    La vidéo est lue en muette et en boucle ; le GIF se lit tout seul.
                    Zéro annonce, réseau coupé ou média en échec : la photo par défaut,
                    jamais de zone vide, jamais de pointage bloqué.
                  </p>
                  <p>
                    Chaque publication, modification ou suppression passe par votre
                    second facteur (MFA) et est tracée dans le journal.
                  </p>
                </AdminExplication>
              </section>

              {/* ── Les trois chiffres ── */}
              <section className="aa-metrics" aria-label="État des annonces">
                <article className="aa-metrique">
                  <span className="aa-metrique-coin aa-metrique-coin--haut" aria-hidden="true">
                    <AbomeyCoinSvg variante="indigo" coin="haut" size={78} />
                  </span>
                  <span className="aa-metrique-coin aa-metrique-coin--bas" aria-hidden="true">
                    <AbomeyCoinSvg variante="terre" coin="bas" size={78} />
                  </span>
                  <span className="aa-metrique-libelle">En ligne</span>
                  <div className="aa-metrique-valeur">
                    <strong>{enLigne.length}</strong>
                    <span className="aa-metrique-total">/ {annonces === null ? '…' : annonces.length}</span>
                  </div>
                  <span className="aa-metrique-pied">
                    {enLigne.length === 0 ? 'Photo par défaut affichée' : 'Diffusées dans l’en-tête'}
                  </span>
                </article>
                <article className={`aa-metrique${enProgrammation > 0 || expirees > 0 ? ' aa-metrique--alerte' : ''}`}>
                  <span className="aa-metrique-coin aa-metrique-coin--haut" aria-hidden="true">
                    <AbomeyCoinSvg variante="or" coin="haut" size={78} />
                  </span>
                  <span className="aa-metrique-coin aa-metrique-coin--bas" aria-hidden="true">
                    <AbomeyCoinSvg variante="indigo" coin="bas" size={78} />
                  </span>
                  <span className="aa-metrique-libelle">Programmées · Expirées</span>
                  <div className="aa-metrique-valeur">
                    <strong>{enProgrammation}</strong>
                    <span className="aa-metrique-total">· {expirees}</span>
                  </div>
                  <span className="aa-metrique-pied">
                    {enProgrammation === 0 && expirees === 0 ? 'Rien à venir, rien de périmé' : 'Contrôlées à la date serveur'}
                  </span>
                </article>
                <article className={`aa-metrique${(annonces || []).length >= MAX_ANNONCES ? ' aa-metrique--alerte' : ''}`}>
                  <span className="aa-metrique-coin aa-metrique-coin--haut" aria-hidden="true">
                    <AbomeyCoinSvg variante="ivoire" coin="haut" size={78} />
                  </span>
                  <span className="aa-metrique-coin aa-metrique-coin--bas" aria-hidden="true">
                    <AbomeyCoinSvg variante="or" coin="bas" size={78} />
                  </span>
                  <span className="aa-metrique-libelle">Places utilisées</span>
                  <div className="aa-metrique-valeur">
                    <strong>{annonces === null ? '…' : annonces.length}</strong>
                    <span className="aa-metrique-total">/ {MAX_ANNONCES}</span>
                  </div>
                  <div className="aa-ann-jauge" aria-hidden="true">
                    <span
                      className={(annonces || []).length >= MAX_ANNONCES ? 'est-plein' : ''}
                      style={{ width: `${Math.min(100, ((annonces || []).length / MAX_ANNONCES) * 100)}%` }}
                    />
                  </div>
                </article>
              </section>

              {/* ── Les onglets ── */}
              <div className="aa-tabs" role="tablist" aria-label="Sections">
                <button role="tab" aria-pressed={view === 'medias'} onClick={() => setView('medias')}>
                  Médias<span className="aa-tabs-n">{annonces === null ? '' : annonces.length}</span>
                </button>
                <button role="tab" aria-pressed={view === 'apercu'} onClick={() => setView('apercu')}>
                  Aperçu<span className="aa-tabs-n">{enLigne.length}</span>
                </button>
                <button role="tab" aria-pressed={view === 'journal'} onClick={() => setView('journal')}>
                  Journal<span className="aa-tabs-n">{journal.length || ''}</span>
                </button>
              </div>

              {notice && (
                <div role="status" className={`aa-ann-notice ton-${notice.ton}`}>
                  {notice.ton === 'ok' ? <CheckCircle2 size={15} /> : <Megaphone size={15} />}
                  <span>{notice.texte}</span>
                </div>
              )}

              {view === 'medias' && (
                <>
                  {/* ── Le formulaire ── */}
                  <section className="aa-panel aa-workflow" aria-label={enEdition ? 'Modifier l’annonce' : 'Ajouter une annonce'}>
                    <details onToggle={(e) => { if (!e.currentTarget.open) viderForm() }}>
                      <summary>{enEdition ? 'Modifier l’annonce choisie' : `Ajouter un média (${MAX_ANNONCES - (annonces || []).length} place${MAX_ANNONCES - (annonces || []).length > 1 ? 's' : ''} restante${MAX_ANNONCES - (annonces || []).length > 1 ? 's' : ''})`}</summary>
                      <div className="aa-ann-forme">
                        <label className="aa-ann-upload">
                          <input
                            ref={fileInput}
                            type="file"
                            accept={ACCEPT}
                            disabled={busy}
                            onChange={(e) => analyserFichier(e.target.files?.[0] || null)}
                          />
                          <span className="aa-ann-upload-icone">
                            {(() => {
                              const I = apercuEst ? TYPES[apercuEst]?.icone : null
                              return I ? <I size={20} /> : <Upload size={20} />
                            })()}
                          </span>
                          <span className="aa-ann-upload-texte">
                            <strong>{fichier ? fichier.name : enEdition ? 'Conserver le média actuel ou en choisir un autre' : 'Choisir le fichier'}</strong>
                            <small>{fichier ? `${TYPES[typeMedia]?.libelle || ''} · ${fmtKo(fichier.size)}` : 'Image, GIF ou vidéo — contrôlé avant l’envoi'}</small>
                          </span>
                          {apercu && (
                            <span className="aa-ann-upload-apercu" aria-hidden="true">
                              {apercuEst === 'video'
                                ? <video src={apercu} muted loop playsInline autoPlay />
                                : <img src={apercu} alt="" />}
                            </span>
                          )}
                        </label>

                        {avertissement && (
                          <div role="alert" className="aa-ann-notice ton-alerte">
                            <Megaphone size={15} />
                            <span>{avertissement}</span>
                          </div>
                        )}

                        <div className="aa-ann-grille-champs">
                          <label>
                            Durée d’affichage (secondes)
                            <input
                              type="number"
                              min={DUREE_MIN}
                              max={DUREE_MAX}
                              value={duree}
                              disabled={busy}
                              onChange={(e) => setDuree(Number(e.target.value))}
                            />
                          </label>
                          <label>
                            Ordre de diffusion
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={ordonne}
                              disabled={busy}
                              onChange={(e) => setOrdonne(Number(e.target.value))}
                            />
                          </label>
                          <label>
                            Début de diffusion (facultatif)
                            <input
                              type="datetime-local"
                              value={debuteLe}
                              disabled={busy}
                              onChange={(e) => setDebuteLe(e.target.value)}
                            />
                          </label>
                          <label>
                            Fin de diffusion (facultatif)
                            <input
                              type="datetime-local"
                              value={termineLe}
                              disabled={busy}
                              onChange={(e) => setTermineLe(e.target.value)}
                            />
                          </label>
                        </div>

                        <label className="aa-ann-case">
                          <input
                            type="checkbox"
                            checked={publier}
                            disabled={busy}
                            onChange={(e) => setPublier(e.target.checked)}
                          />
                          Publier immédiatement (sinon rangée inactive, à activer plus tard)
                        </label>

                        <dl className="aa-ann-regles" aria-label="Règles des fichiers">
                          <div><dt>Image</dt><dd>JPEG · PNG · WebP — ≤ 500 Ko</dd></div>
                          <div><dt>GIF</dt><dd>animé — ≤ 2 Mo · ≤ 30 s</dd></div>
                          <div><dt>Vidéo</dt><dd>MP4 · MOV muette — ≤ 5 Mo · ≤ 30 s</dd></div>
                          <div><dt>Durée</dt><dd>{DUREE_MIN} à {DUREE_MAX} s par média · max {MAX_ANNONCES} par entreprise</dd></div>
                          <div><dt>Format</dt><dd>16:9 recommandé (recadrage sinon) · largeur ≤ 1600 px</dd></div>
                        </dl>

                        <div className="aa-ann-envoi">
                          <button type="button" className="aa-primary" disabled={!peutEnvoyer || busy} onClick={envoyer}>
                            {busy ? 'Publication en cours…' : enEdition ? 'Enregistrer les modifications' : 'Publier'}
                          </button>
                          {(enEdition || fichier) && (
                            <button type="button" disabled={busy} onClick={viderForm}>
                              Annuler
                            </button>
                          )}
                        </div>
                      </div>
                    </details>
                  </section>

                  {/* ── La liste ── */}
                  <section className="aa-panel" aria-label="Les annonces de l’entreprise">
                    {annonces === null ? (
                      <p className="aa-ann-attente">Lecture des annonces (second facteur requis si nécessaire)…</p>
                    ) : annonces.length === 0 ? (
                      <p className="aa-ann-attente">
                        Aucune annonce pour cette entreprise. L’en-tête Pointage affiche la photo par défaut.
                      </p>
                    ) : (
                      triees.map((a, i) => {
                        const Meta = TYPES[a.type]
                        return (
                          <div className="aa-ann-media" key={a.id}>
                            <span className="aa-ann-vignette">
                              {a.type === 'video'
                                ? <video src={a.url} muted loop playsInline preload="metadata" />
                                : <img src={a.url} alt="" loading="lazy" />}
                              <span className="aa-ann-mini-t">{Meta ? Meta.libelle : a.type}</span>
                            </span>
                            <span className="aa-ann-media-infos">
                              <span className="aa-ann-media-ligne1">
                                <span className="aa-ann-ordre-n">{a.ordre_publication}°</span>
                                <span className={`aa-ann-puce st-${a.statut}`}>
                                  <span className="aa-ann-pastille" aria-hidden="true" />
                                  {STATUTS[a.statut] || a.statut}
                                </span>
                                <span>{Math.round(a.duree_affichage_ms / 1000)} s</span>
                              </span>
                              <span className="aa-ann-media-detail">
                                {Meta ? Meta.libelle : a.type}
                                {a.debute_le !== 'null' ? ` · depuis ${fmtDate(a.debute_le)}` : ''}
                                {a.termine_le !== 'null' ? ` · jusqu’au ${fmtDate(a.termine_le)}` : ''}
                                {a.publie_le !== 'null' ? ` · publiée le ${fmtDate(a.publie_le)}` : ''}
                              </span>
                            </span>
                            <span className="aa-ann-media-actions">
                              <button type="button" title="Monter dans l’ordre" aria-label="Monter dans l’ordre" disabled={busy || i === 0} onClick={() => deplacer(a, -1)}>
                                <ArrowUp size={14} />
                              </button>
                              <button type="button" title="Descendre dans l’ordre" aria-label="Descendre dans l’ordre" disabled={busy || i === triees.length - 1} onClick={() => deplacer(a, 1)}>
                                <ArrowDown size={14} />
                              </button>
                              <button type="button" title="Modifier" aria-label="Modifier" disabled={busy} onClick={() => ouvrirEdition(a)}>
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                title={a.is_active ? 'Désactiver' : 'Activer'}
                                aria-label={a.is_active ? 'Désactiver' : 'Activer'}
                                disabled={busy}
                                onClick={() => basculer(a)}
                              >
                                <Power size={14} />
                              </button>
                              {confirmationSuppression === a.id ? (
                                <button type="button" className="est-confirm" disabled={busy} onClick={() => supprimer(a)}>
                                  Confirmer la suppression
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="est-danger"
                                  title="Supprimer"
                                  aria-label="Supprimer"
                                  disabled={busy}
                                  onClick={() => {
                                    setConfirmationSuppression(a.id)
                                    window.setTimeout(() => setConfirmationSuppression((c) => (c === a.id ? null : c)), 5000)
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </section>
                </>
              )}

              {view === 'apercu' && (
                <section className="aa-panel" aria-label="Aperçu du carrousel">
                  <div className="aa-ann-cadre">
                    {enLigne.length === 0 ? (
                      <div className="aa-ann-vide">
                        <ImageIcon size={34} />
                        <span>
                          Aucune annonce en ligne pour cette entreprise.<br />
                          L’app Pointage affiche la photo par défaut.
                        </span>
                      </div>
                    ) : (
                      <>
                        {enLigne.map((a, i) => (
                          <div
                            key={a.id}
                            className={`aa-ann-slide${i === Math.min(previewIndex, enLigne.length - 1) ? ' is-visible' : ''}`}
                            aria-hidden={i !== Math.min(previewIndex, enLigne.length - 1)}
                          >
                            {a.type === 'video'
                              ? <video src={a.url} autoPlay muted loop playsInline />
                              : <img src={a.url} alt="" />}
                          </div>
                        ))}
                        <span className="aa-ann-compteur">
                          {Math.min(previewIndex, enLigne.length - 1) + 1} / {enLigne.length}
                        </span>
                        {enLigne.length > 1 && courantApercu && (
                          <span
                            key={`p-${previewIndex}`}
                            className="aa-ann-progress"
                            style={{ animationDuration: `${courantApercu.duree_affichage_ms || 5000}ms`, animationPlayState: lecture ? 'running' : 'paused' }}
                          />
                        )}
                      </>
                    )}
                  </div>
                  {enLigne.length > 1 && (
                    <div className="aa-ann-controles" role="group" aria-label="Contrôles de l’aperçu">
                      <button type="button" onClick={() => setPreviewIndex((i) => (i - 1 + enLigne.length) % enLigne.length)}>
                        <SkipBack size={15} />
                        <span>Précédent</span>
                      </button>
                      <button type="button" className="principal" onClick={() => setLecture((v) => !v)}>
                        {lecture ? <Pause size={16} /> : <Play size={16} />}
                        <span>{lecture ? 'Pause' : 'Lecture'}</span>
                      </button>
                      <button type="button" onClick={() => setPreviewIndex((i) => (i + 1) % enLigne.length)}>
                        <SkipForward size={15} />
                        <span>Suivant</span>
                      </button>
                    </div>
                  )}
                  <p className="aa-ann-attente">
                    {enLigne.length === 0
                      ? 'Aucune annonce en ligne : l’app affiche la photo par défaut.'
                      : enLigne.length === 1
                        ? 'Un seul média : affichage fixe, sans rotation — c’est ce que verra l’app.'
                        : `Simulation du carrousel de l’app : chaque média s’affiche ${Math.round((courantApercu?.duree_affichage_ms || 5000) / 1000)} s. Utilisez Précédent, Pause et Suivant pour tester la rotation.`}
                  </p>
                </section>
              )}

              {view === 'journal' && (
                <section className="aa-panel" aria-label="Journal des interventions">
                  {journal.length === 0 ? (
                    <p className="aa-ann-attente">Aucune intervention enregistrée pour cette entreprise.</p>
                  ) : (
                    <div className="aa-ann-journal">
                      {journal.map((j, i) => (
                        <div key={i}>
                          <span className="aa-ann-j-temps">{fmtDate(j.created_at)}</span>
                          <span className="aa-ann-j-action">{String(j.action || '').replace('annonce_accueil_', '')}</span>
                          <span className="aa-ann-j-detail">
                            {j.details?.type_media ? `${j.details.type_media} · ordre ${j.details.ordre ?? '—'} · ${Math.round((j.details.duree_ms || 0) / 1000)} s` : ''}
                            {j.details?.active === false ? ' · désactivée' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
