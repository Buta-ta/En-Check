// ═══════════════════════════════════════════════════════════
// 🧶 RECONNAISSANCE FACIALE — les fiches du visage et leurs règles
//
// Une seule page pour deux travaux qui n'en ont jamais fait qu'un :
//   · les enrôlements — la fiche faciale d'un employé, sa photo, son
//     état, et la décision à prendre : valider, refuser, ré-enrôler,
//     supprimer ;
//   · les réglages — le seuil de confiance, les contrôles (vivant,
//     validation, borne), ce qui se passe après un échec, et le mode
//     de pointage retenu pour l'entreprise.
//
// Le dessin est celui du velours kuba : terre brune, raphia, écru,
// losanges et chevrons. Le motif du bandeau (`planning-kuba.webp`) est
// posé par `PageCulturalBand` ; le blason de l'en-tête en est le signet.
// Le vocabulaire reste celui d'un service RH : un enrôlement, une
// validation, un seuil, un pointage. Aucune image d'atelier à l'écran.
//
// Toute la mécanique est conservée : mêmes tables (`face_enrollments`,
// `face_recognition_config`), mêmes champs, même `upsert` sur
// `enterprise_id`, même photo signée. Rien n'est inventé, rien n'est
// masqué : un chiffre absent s'écrit « — », un refus se dit en français.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Building2, Camera, CheckCircle2, Clock,
  Eye, ImageOff, ListChecks, Moon, RefreshCw, Save, ScanFace,
  Search, ShieldCheck, Sun, Trash2, X, XCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import PageCulturalBand from '../components/PageCulturalBand'
import RaccourcisPages from '../components/RaccourcisPages'
import PhotoSignee from '../components/PhotoSignee'
import { KubaEmblemeSvg } from '../components/KubaSvg'
import { useTheme } from '../contexts/ThemeContext'
import './ReconnaissanceFaciale.css'

// ── les états d'une fiche faciale, dits en clair ────────────
const STATUTS = {
  pending: { libelle: 'En attente', ton: 'attente' },
  approved: { libelle: 'Validée', ton: 'ok' },
  rejected: { libelle: 'Refusée', ton: 'alerte' },
}

const CLES_STATUT = [
  { cle: 'tous', libelle: 'Toutes' },
  { cle: 'pending', libelle: 'En attente' },
  { cle: 'approved', libelle: 'Validées' },
  { cle: 'rejected', libelle: 'Refusées' },
]

// ── les trois façons de pointer avec le visage ──────────────
const MODES = [
  {
    cle: 'free',
    nom: 'Libre',
    note: 'L’employé choisit son mode : code, QR ou visage.',
    ton: 'ok',
  },
  {
    cle: 'face_required',
    nom: 'Visage obligatoire',
    note: 'Le visage est le mode principal ; un autre mode reste possible après échec.',
    ton: 'attente',
  },
  {
    cle: 'face_exclusive',
    nom: 'Visage exclusif',
    note: 'Aucun autre mode : sans reconnaissance, pas de pointage.',
    ton: 'alerte',
  },
]

const CONFIG_DEFAUT = {
  confidence_threshold: 0.8,
  liveness_required: true,
  admin_approval_required: true,
  fallback_allowed: true,
  max_attempts: 3,
  kiosk_mode_enabled: false,
  pointage_mode: 'free',
}

const OSSATURE_CONFIG = Object.keys(CONFIG_DEFAUT)

function normaliserConfig(donnees) {
  const lue = donnees || {}
  return {
    confidence_threshold: Number(lue.confidence_threshold ?? CONFIG_DEFAUT.confidence_threshold),
    liveness_required: lue.liveness_required ?? CONFIG_DEFAUT.liveness_required,
    admin_approval_required: lue.admin_approval_required ?? CONFIG_DEFAUT.admin_approval_required,
    fallback_allowed: lue.fallback_allowed ?? CONFIG_DEFAUT.fallback_allowed,
    max_attempts: Number(lue.max_attempts ?? CONFIG_DEFAUT.max_attempts),
    kiosk_mode_enabled: lue.kiosk_mode_enabled ?? CONFIG_DEFAUT.kiosk_mode_enabled,
    pointage_mode: lue.pointage_mode ?? CONFIG_DEFAUT.pointage_mode,
  }
}

const configsIdentiques = (a, b) =>
  OSSATURE_CONFIG.every((cle) => String(a?.[cle]) === String(b?.[cle]))

function nomDe(enrolement) {
  const employe = enrolement?.employees
  const nom = [employe?.first_name, employe?.last_name].filter(Boolean).join(' ')
  return nom || 'Employé sans nom'
}

function initialesDe(enrolement) {
  const employe = enrolement?.employees
  const lettres = [employe?.first_name, employe?.last_name]
    .map((mot) => (mot ? String(mot).trim().charAt(0) : ''))
    .join('')
    .toUpperCase()
  return lettres || '—'
}

function formaterDate(valeur) {
  if (!valeur) return '—'
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

function formaterHeure(valeur) {
  if (!valeur) return ''
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

// ═══════════════════════════════════════════════════════════
// LES PETITES PIÈCES DE LA PAGE
// ═══════════════════════════════════════════════════════════

// l'attente : cinq losanges qui s'allument en tournant, dessinés en CSS
function Chargement({ texte = 'Chargement des fiches faciales…', note = 'Les enrôlements arrivent du serveur.' }) {
  return (
    <div className="rf-charge" role="status" aria-live="polite">
      <span className="rf-charge-tresse" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((rang) => (
          <span className="rf-charge-losange" key={rang} data-rang={rang} />
        ))}
      </span>
      <p className="rf-charge-texte">{texte}</p>
      <span className="rf-charge-note">{note}</span>
    </div>
  )
}

// l'interrupteur : un contrôle dessiné, cliquable au clavier comme à la main
function Interrupteur({ titre, note, actif, onChange, id }) {
  return (
    <div className="rf-interrupteur">
      <div className="rf-interrupteur-texte">
        <p className="rf-interrupteur-titre" id={id}>{titre}</p>
        <p className="rf-interrupteur-note">{note}</p>
      </div>
      <button
        type="button"
        className="rf-bascule"
        role="switch"
        aria-checked={actif}
        aria-labelledby={id}
        onClick={() => onChange(!actif)}
      >
        <span className="rf-bascule-piste" aria-hidden="true">
          <span className="rf-bascule-pouce" />
        </span>
        <span className="rf-bascule-etat">{actif ? 'Activé' : 'Désactivé'}</span>
      </button>
    </div>
  )
}

// la fenêtre : un seul dessin pour la photo, le refus et la suppression
function Fenetre({ eyebrow, titre, onClose, children, pied, etroit = false, labelledBy }) {
  return (
    <div
      className="rf-voile"
      onClick={(evenement) => {
        if (evenement.target === evenement.currentTarget) onClose()
      }}
    >
      <div
        className={`rf-fenetre${etroit ? ' rf-fenetre--etroit' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <header className="rf-fenetre-tete">
          <div className="rf-fenetre-titres">
            <p className="rf-eyebrow">{eyebrow}</p>
            <h2 className="rf-fenetre-titre" id={labelledBy}>{titre}</h2>
          </div>
          <button type="button" className="rf-fermer" onClick={onClose} aria-label="Fermer la fenêtre">
            <X size={15} />
          </button>
        </header>
        <div className="rf-fenetre-corps">{children}</div>
        {pied && <footer className="rf-fenetre-pied">{pied}</footer>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// LA PAGE
// ═══════════════════════════════════════════════════════════

export default function ReconnaissanceFaciale() {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()

  const [admin, setAdmin] = useState(null)
  const [vue, setVue] = useState('enrolements')
  const [entreprises, setEntreprises] = useState([])
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')

  const [enrolements, setEnrolements] = useState([])
  const [chargementEnrolements, setChargementEnrolements] = useState(true)
  const [cleStatut, setCleStatut] = useState('tous')
  const [recherche, setRecherche] = useState('')

  const [config, setConfig] = useState(CONFIG_DEFAUT)
  const [configEnregistree, setConfigEnregistree] = useState(CONFIG_DEFAUT)
  const [chargementConfig, setChargementConfig] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)

  const [photoOuverte, setPhotoOuverte] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [motifRefus, setMotifRefus] = useState('')
  const [erreurRefus, setErreurRefus] = useState('')
  const [enCours, setEnCours] = useState(null)
  const [avis, setAvis] = useState(null)

  // ── l'identité de l'admin, et les entreprises ────────────
  useEffect(() => {
    const brut = localStorage.getItem('admin')
    if (!brut) { navigate('/login'); return }
    let adminData = null
    try {
      adminData = JSON.parse(brut)
    } catch {
      navigate('/login')
      return
    }
    setAdmin(adminData)

    // L'en-tête de l'administration retient l'entreprise en cours :
    // on y revient, sauf si elle vaut « toutes ».
    const stockee = localStorage.getItem('selected_enterprise_id')

    if (adminData.role === 'super_admin') {
      supabase.from('enterprises').select('id, name').eq('is_active', true).order('name')
        .then(({ data }) => setEntreprises(data || []))
      if (stockee && stockee !== 'all') setSelectedEntrepriseId(stockee)
    } else {
      const entId = stockee || adminData.selectedEnterprise?.id || adminData.enterprise_id
      setSelectedEntrepriseId(entId || 'all')
    }
  }, [navigate])

  const entrepriseAffichee = useMemo(() => {
    if (admin?.role === 'super_admin' && selectedEntrepriseId === 'all') return 'Toutes les entreprises'
    return admin?.selectedEnterprise?.name || admin?.enterprise_name || 'Entreprise non renseignée'
  }, [admin, selectedEntrepriseId])

  // Une règle de reconnaissance appartient à une entreprise : « toutes »
  // n'en a pas. Le super administrateur en choisit donc une pour régler.
  const entrepriseDesReglages = useMemo(() => {
    if (selectedEntrepriseId && selectedEntrepriseId !== 'all') return selectedEntrepriseId
    if (admin && admin.role !== 'super_admin') {
      return admin.selectedEnterprise?.id || admin.enterprise_id || null
    }
    return null
  }, [admin, selectedEntrepriseId])

  const nomEntrepriseDesReglages = useMemo(() => {
    if (!entrepriseDesReglages) return ''
    const trouvee = entreprises.find((ent) => ent.id === entrepriseDesReglages)
    return trouvee?.name || entrepriseAffichee
  }, [entrepriseDesReglages, entreprises, entrepriseAffichee])

  // ═══════════════════════════════════════════════════════════
  // LES ENRÔLEMENTS
  // ═══════════════════════════════════════════════════════════

  const chargerEnrolements = useCallback(async ({ silencieux = false } = {}) => {
    if (!admin) return
    if (!silencieux) setChargementEnrolements(true)
    try {
      const cible = admin.role === 'super_admin'
        ? selectedEntrepriseId
        : admin.selectedEnterprise?.id || admin.enterprise_id

      let requete = supabase
        .from('face_enrollments')
        .select(`
          *,
          employees (id, first_name, last_name, matricule, photo_url),
          enterprises (id, name)
        `)
        .order('created_at', { ascending: false })

      if (cible && cible !== 'all') requete = requete.eq('enterprise_id', cible)

      const { data, error } = await requete
      if (error) throw error
      setEnrolements(data || [])
    } catch (erreur) {
      console.error('Chargement des enrôlements :', erreur)
      setAvis({
        ton: 'alerte',
        texte: 'Les fiches faciales n’ont pas pu être chargées. Vérifiez la connexion, puis actualisez.',
      })
    } finally {
      setChargementEnrolements(false)
    }
  }, [admin, selectedEntrepriseId])

  useEffect(() => {
    if (admin) chargerEnrolements()
  }, [admin, chargerEnrolements])

  // ── les réglages de l'entreprise choisie ─────────────────
  const chargerConfig = useCallback(async () => {
    if (!entrepriseDesReglages) {
      setConfig(CONFIG_DEFAUT)
      setConfigEnregistree(CONFIG_DEFAUT)
      return
    }
    setChargementConfig(true)
    try {
      const { data, error } = await supabase
        .from('face_recognition_config')
        .select('*')
        .eq('enterprise_id', entrepriseDesReglages)
        .maybeSingle()
      if (error) throw error
      const lue = normaliserConfig(data)
      setConfig(lue)
      setConfigEnregistree(lue)
    } catch (erreur) {
      console.error('Chargement des réglages :', erreur)
      setAvis({
        ton: 'alerte',
        texte: 'Les réglages de reconnaissance n’ont pas pu être lus. Ils restent modifiables, mais mieux vaut réessayer.',
      })
    } finally {
      setChargementConfig(false)
    }
  }, [entrepriseDesReglages])

  useEffect(() => {
    if (admin) chargerConfig()
  }, [admin, chargerConfig])

  // ── les chiffres de la page : comptés sur la liste entière ──
  const stats = useMemo(() => ({
    total: enrolements.length,
    attente: enrolements.filter((enr) => enr.status === 'pending').length,
    validees: enrolements.filter((enr) => enr.status === 'approved').length,
    refusees: enrolements.filter((enr) => enr.status === 'rejected').length,
    actives: enrolements.filter((enr) => enr.status === 'approved' && enr.is_active !== false).length,
  }), [enrolements])

  const enrolementsAffiches = useMemo(() => {
    const requete = recherche.trim().toLowerCase()
    return enrolements.filter((enr) => {
      if (cleStatut !== 'tous' && enr.status !== cleStatut) return false
      if (!requete) return true
      return [
        nomDe(enr),
        enr.employees?.matricule,
        enr.enterprises?.name,
      ].filter(Boolean).some((valeur) => String(valeur).toLowerCase().includes(requete))
    })
  }, [cleStatut, enrolements, recherche])

  // ── les décisions ─────────────────────────────────────────
  const marquer = (texte, ton = 'ok') => setAvis({ texte, ton })

  const approuver = async (enr) => {
    setEnCours(enr.id)
    setAvis(null)
    try {
      const maintenant = new Date().toISOString()
      const { error } = await supabase
        .from('face_enrollments')
        .update({
          status: 'approved',
          approved_by: admin?.id || null,
          approved_at: maintenant,
          updated_at: maintenant,
        })
        .eq('id', enr.id)
      if (error) throw error
      await chargerEnrolements({ silencieux: true })
      marquer(`La fiche de ${nomDe(enr)} est validée : son visage sert désormais au pointage.`)
    } catch (erreur) {
      console.error('Validation :', erreur)
      marquer(`La fiche de ${nomDe(enr)} n’a pas pu être validée. Réessayez dans un instant.`, 'alerte')
    } finally {
      setEnCours(null)
    }
  }

  const confirmerRefus = async () => {
    if (!confirmation?.enr) return
    const motif = motifRefus.trim()
    if (!motif) {
      setErreurRefus('Indiquez un motif : c’est ce que l’employé devra corriger.')
      return
    }
    const enr = confirmation.enr
    setEnCours(enr.id)
    setErreurRefus('')
    try {
      const { error } = await supabase
        .from('face_enrollments')
        .update({
          status: 'rejected',
          rejection_reason: motif,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enr.id)
      if (error) throw error
      setConfirmation(null)
      setMotifRefus('')
      await chargerEnrolements({ silencieux: true })
      marquer(`La fiche de ${nomDe(enr)} est refusée. Le motif est enregistré.`)
    } catch (erreur) {
      console.error('Refus :', erreur)
      setErreurRefus('Le refus n’a pas pu être enregistré. Réessayez dans un instant.')
    } finally {
      setEnCours(null)
    }
  }

  const reEnroler = async (enr) => {
    setEnCours(enr.id)
    setAvis(null)
    try {
      const { error } = await supabase
        .from('face_enrollments')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', enr.id)
      if (error) throw error
      await chargerEnrolements({ silencieux: true })
      marquer(`Ré-enrôlement demandé pour ${nomDe(enr)} : sa fiche est désactivée jusqu’à la nouvelle photo.`)
    } catch (erreur) {
      console.error('Ré-enrôlement :', erreur)
      marquer(`Le ré-enrôlement de ${nomDe(enr)} n’a pas pu être demandé.`, 'alerte')
    } finally {
      setEnCours(null)
    }
  }

  const confirmerSuppression = async () => {
    if (!confirmation?.enr) return
    const enr = confirmation.enr
    setEnCours(enr.id)
    try {
      const { error } = await supabase.from('face_enrollments').delete().eq('id', enr.id)
      if (error) throw error
      setConfirmation(null)
      await chargerEnrolements({ silencieux: true })
      marquer(`La fiche de ${nomDe(enr)} est supprimée. ${nomDe(enr)} devra se ré-enrôler.`)
    } catch (erreur) {
      console.error('Suppression :', erreur)
      setConfirmation(null)
      marquer(`La fiche de ${nomDe(enr)} n’a pas pu être supprimée.`, 'alerte')
    } finally {
      setEnCours(null)
    }
  }

  // ── les réglages ──────────────────────────────────────────
  const reglagesModifies = useMemo(
    () => !configsIdentiques(config, configEnregistree),
    [config, configEnregistree],
  )

  const modifierConfig = (cle, valeur) => {
    setAvis(null)
    setConfig((precedente) => ({ ...precedente, [cle]: valeur }))
  }

  const revenirAuxReglages = () => {
    setConfig(configEnregistree)
    setAvis(null)
  }

  const enregistrerConfig = async () => {
    if (!entrepriseDesReglages) {
      marquer('Choisissez une entreprise : ses règles de reconnaissance lui appartiennent.', 'alerte')
      return
    }
    setEnregistrement(true)
    setAvis(null)
    try {
      const { error } = await supabase
        .from('face_recognition_config')
        .upsert({
          enterprise_id: entrepriseDesReglages,
          ...config,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'enterprise_id' })
      if (error) throw error
      setConfigEnregistree(config)
      marquer(`Réglages enregistrés pour ${nomEntrepriseDesReglages || 'cette entreprise'}. Ils s’appliquent au prochain pointage.`)
    } catch (erreur) {
      console.error('Enregistrement des réglages :', erreur)
      marquer('Les réglages n’ont pas pu être enregistrés. Réessayez dans un instant.', 'alerte')
    } finally {
      setEnregistrement(false)
    }
  }

  // ── la fenêtre se ferme à Échap, le fond ne défile plus ──
  const fenetreOuverte = Boolean(photoOuverte || confirmation)
  useEffect(() => {
    if (!fenetreOuverte) return undefined
    const surTouche = (evenement) => {
      if (evenement.key !== 'Escape') return
      setPhotoOuverte(null)
      setConfirmation(null)
      setMotifRefus('')
      setErreurRefus('')
    }
    const ancien = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
      document.body.style.overflow = ancien
    }
  }, [fenetreOuverte])

  const fermerConfirmation = () => {
    setConfirmation(null)
    setMotifRefus('')
    setErreurRefus('')
  }

  // ═══════════════════════════════════════════════════════════
  // 🖥️ L'ÉCRAN
  // ═══════════════════════════════════════════════════════════

  return (
    <div className={`rf-page${darkMode ? '' : ' rf-clair'}`}>
      <PageCulturalBand pathname="/reconnaissance-faciale" />
      <div className="rf-lisiere" aria-hidden="true" />

      <header className="rf-entete">
        <button
          type="button"
          className="rf-retour"
          onClick={() => navigate('/dashboard')}
          aria-label="Revenir au tableau de bord"
          title="Tableau de bord"
        >
          <ArrowLeft size={16} />
        </button>

        <KubaEmblemeSvg size={50} />

        <div className="rf-titre-bloc">
          <p className="rf-eyebrow">Biométrie · pointage</p>
          <h1 className="rf-titre">Reconnaissance faciale<span>.</span></h1>
          <p className="rf-sous-titre">
            Les fiches du visage à valider, et les règles qui s’appliquent au pointage.
          </p>
        </div>

        <div className="rf-entete-droite">
          {stats.attente > 0 && (
            <span className="rf-pastille" title="Fiches en attente d’une décision">
              <i aria-hidden="true" />
              {stats.attente} à valider
            </span>
          )}
          <button
            type="button"
            className="rf-theme"
            role="switch"
            aria-checked={darkMode}
            onClick={toggleTheme}
            aria-label={darkMode ? 'Passer en thème clair' : 'Passer en thème sombre'}
            title={darkMode ? 'Thème clair' : 'Thème sombre'}
          >
            {darkMode ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="rf-coque">
        {/* ── le seuil : l'entreprise et les autres écrans ── */}
        <section className="rf-seuil" aria-label="Entreprise et accès rapides">
          <div className="rf-seuil-entreprise">
            <span className="rf-seuil-libelle">Entreprise</span>
            <span className="rf-seuil-nom">{entrepriseAffichee}</span>
            <span className="rf-seuil-fait">
              <ScanFace size={11} aria-hidden="true" />
              {stats.total} fiche{stats.total > 1 ? 's' : ''} faciale{stats.total > 1 ? 's' : ''}
              {stats.actives > 0 ? ` · ${stats.actives} active${stats.actives > 1 ? 's' : ''}` : ''}
            </span>
          </div>

          <div className="rf-raccourcis">
            <span className="rf-seuil-libelle">Aller à</span>
            <RaccourcisPages compact />
          </div>
        </section>

        {avis && (
          <p className="rf-avis" data-ton={avis.ton} role="status">
            {avis.ton === 'ok'
              ? <CheckCircle2 size={13} aria-hidden="true" />
              : <AlertTriangle size={13} aria-hidden="true" />}
            {avis.texte}
          </p>
        )}

        {/* ── les registres de la biométrie ── */}
        <section className="rf-registres" aria-label="Les chiffres de la reconnaissance faciale">
          {[
            { icone: ScanFace, ton: 'raphia', valeur: stats.total, libelle: 'Fiches faciales', note: stats.total > 0 ? `${stats.actives} active${stats.actives > 1 ? 's' : ''}` : '—' },
            { icone: Clock, ton: 'attente', valeur: stats.attente, libelle: 'À valider', note: stats.attente > 0 ? 'une décision attend' : 'rien à décider' },
            { icone: ShieldCheck, ton: 'ok', valeur: stats.validees, libelle: 'Validées', note: stats.validees > 0 ? 'visage utilisable' : '—' },
            { icone: XCircle, ton: 'alerte', valeur: stats.refusees, libelle: 'Refusées', note: stats.refusees > 0 ? 'à ré-enrôler' : '—' },
          ].map(({ icone: Icone, ton, valeur, libelle, note }) => (
            <div className="rf-stele" key={libelle} data-ton={ton}>
              <span className="rf-stele-marque">
                <Icone size={17} aria-hidden="true" />
              </span>
              <span className="rf-stele-texte">
                <span className="rf-stele-nombre">{valeur}</span>
                <span className="rf-stele-libelle">{libelle}</span>
                <span className="rf-stele-note">{note}</span>
              </span>
            </div>
          ))}
        </section>

        {/* ── les deux vues d'une seule page ── */}
        <div className="rf-onglets">
          <p className="rf-onglets-titre">Sommaire</p>
          <div className="rf-onglets-liste" role="tablist" aria-label="Vues de la reconnaissance faciale">
            <button
              type="button"
              role="tab"
              id="rf-onglet-enrolements"
              aria-selected={vue === 'enrolements'}
              aria-controls="rf-vue-enrolements"
              className="rf-onglet"
              onClick={() => setVue('enrolements')}
            >
              <ListChecks size={14} aria-hidden="true" />
              Enrôlements
              <span className="rf-onglet-nombre">{stats.total}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="rf-onglet-reglages"
              aria-selected={vue === 'reglages'}
              aria-controls="rf-vue-reglages"
              className="rf-onglet"
              onClick={() => setVue('reglages')}
            >
              <ShieldCheck size={14} aria-hidden="true" />
              Réglages
              {reglagesModifies && <span className="rf-onglet-point" title="Réglages modifiés" />}
            </button>
          </div>
        </div>

        {vue === 'enrolements' ? (
          <section
            className="rf-vue"
            id="rf-vue-enrolements"
            role="tabpanel"
            aria-labelledby="rf-onglet-enrolements"
          >
            <div className="rf-folio">
              <p className="rf-marque"><strong>En-Check</strong> · Reconnaissance faciale</p>
              <p className="rf-folio-droite">Fiches du visage</p>
            </div>

            <header className="rf-tete">
              <div>
                <p className="rf-eyebrow">Les visages enrôlés</p>
                <h2 className="rf-titre-vue">Enrôlements<span>.</span></h2>
              </div>
              <dl className="rf-colophon">
                <div className="rf-chiffre">
                  <dd className="rf-chiffre-valeur">{stats.total}</dd>
                  <dt className="rf-chiffre-libelle">Fiches</dt>
                </div>
                <div className="rf-chiffre" data-ton="attente">
                  <dd className="rf-chiffre-valeur">{stats.attente}</dd>
                  <dt className="rf-chiffre-libelle">En attente</dt>
                </div>
                <div className="rf-chiffre" data-ton="ok">
                  <dd className="rf-chiffre-valeur">{stats.validees}</dd>
                  <dt className="rf-chiffre-libelle">Validées</dt>
                </div>
              </dl>
            </header>

            <div className="rf-outils">
              <label className="rf-champ rf-champ-recherche">
                <Search size={13} aria-hidden="true" />
                <input
                  type="search"
                  value={recherche}
                  onChange={(evenement) => setRecherche(evenement.target.value)}
                  placeholder="Chercher un nom ou un matricule"
                  aria-label="Chercher un employé dans les fiches"
                />
              </label>

              {admin?.role === 'super_admin' && (
                <label className="rf-champ rf-champ-select">
                  <span className="rf-etiquette">
                    <Building2 size={11} aria-hidden="true" />
                    Entreprise
                  </span>
                  <select
                    value={selectedEntrepriseId}
                    onChange={(evenement) => setSelectedEntrepriseId(evenement.target.value)}
                    aria-label="Choisir l’entreprise"
                  >
                    <option value="all">Toutes les entreprises</option>
                    {entreprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="rf-champ rf-champ-cles">
                <span className="rf-etiquette">Statut</span>
                <div className="rf-cles" role="group" aria-label="Filtrer par état de la fiche">
                  {CLES_STATUT.map(({ cle, libelle }) => (
                    <button
                      key={cle}
                      type="button"
                      className="rf-cle"
                      aria-pressed={cleStatut === cle}
                      onClick={() => setCleStatut(cle)}
                    >
                      <i aria-hidden="true" data-statut={cle} />
                      {libelle}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="rf-bouton-creux rf-actualiser"
                onClick={() => chargerEnrolements()}
                disabled={chargementEnrolements}
                title="Relire les fiches depuis le serveur"
              >
                <RefreshCw size={13} aria-hidden="true" className={chargementEnrolements ? 'rf-tourne' : undefined} />
                Actualiser
              </button>
            </div>

            {chargementEnrolements ? (
              <Chargement />
            ) : enrolementsAffiches.length === 0 ? (
              <div className="rf-vide">
                <span className="rf-vide-sceau" aria-hidden="true">
                  {enrolements.length === 0 ? <ImageOff size={19} /> : <Search size={19} />}
                </span>
                <p className="rf-vide-titre">
                  {enrolements.length === 0
                    ? 'Aucune fiche faciale pour cette entreprise.'
                    : 'Aucune fiche ne correspond à ces filtres.'}
                </p>
                <p className="rf-vide-note">
                  {enrolements.length === 0
                    ? 'Une fiche apparaît ici dès qu’un employé a enregistré son visage depuis le poste de pointage.'
                    : 'Changez l’état recherché, l’entreprise, ou videz la recherche.'}
                </p>
              </div>
            ) : (
              <ul className="rf-registre">
                {enrolementsAffiches.map((enr, index) => {
                  const statut = STATUTS[enr.status] || { libelle: 'État inconnu', ton: 'neutre' }
                  const occupee = enCours === enr.id
                  const desactivee = enr.is_active === false
                  return (
                    <li
                      className="rf-entree"
                      key={enr.id}
                      data-statut={enr.status}
                      data-active={desactivee ? 'non' : 'oui'}
                      data-occupee={occupee ? 'oui' : 'non'}
                    >
                      <span className="rf-entree-index">{String(index + 1).padStart(2, '0')}</span>

                      <div className="rf-cellule-identite">
                        <button
                          type="button"
                          className="rf-portrait"
                          onClick={() => setPhotoOuverte(enr)}
                          aria-label={`Voir la photo d’enrôlement de ${nomDe(enr)}`}
                          title="Voir la photo"
                        >
                          {enr.enrollment_photo_url ? (
                            <PhotoSignee url={enr.enrollment_photo_url} alt="" />
                          ) : (
                            <span className="rf-portrait-vide">
                              <Camera size={16} aria-hidden="true" />
                              <span>{initialesDe(enr)}</span>
                            </span>
                          )}
                          <span className="rf-portrait-loupe" aria-hidden="true"><Eye size={11} /></span>
                        </button>

                        <div className="rf-identite-texte">
                          <h3 className="rf-entree-titre">{nomDe(enr)}</h3>
                          <p className="rf-entree-meta">
                            {enr.employees?.matricule || 'Matricule non renseigné'}
                            {enr.enterprises?.name ? ` · ${enr.enterprises.name}` : ''}
                          </p>
                          <p className="rf-entree-note">
                            Enregistrée le {formaterDate(enr.created_at)}
                            {formaterHeure(enr.created_at) ? ` à ${formaterHeure(enr.created_at)}` : ''}
                            {enr.status === 'approved' && (
                              <>
                                {' · '}
                                {desactivee ? 'désactivée, en attente de ré-enrôlement' : 'active pour le pointage'}
                              </>
                            )}
                          </p>
                          {enr.status === 'rejected' && enr.rejection_reason && (
                            <p className="rf-entree-motif">
                              <AlertTriangle size={11} aria-hidden="true" />
                              Motif du refus : {enr.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rf-cellule-etat">
                        <span className="rf-sceau" data-ton={statut.ton}>{statut.libelle}</span>
                        {enr.is_active === false && enr.status !== 'approved' && (
                          <span className="rf-sceau" data-ton="neutre">Désactivée</span>
                        )}
                      </div>

                      <div className="rf-entree-actions">
                        {enr.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="rf-lien"
                              onClick={() => approuver(enr)}
                              disabled={occupee}
                            >
                              <CheckCircle2 size={12} aria-hidden="true" />
                              Valider
                            </button>
                            <button
                              type="button"
                              className="rf-lien"
                              onClick={() => {
                                setMotifRefus('')
                                setErreurRefus('')
                                setConfirmation({ type: 'refus', enr })
                              }}
                              disabled={occupee}
                            >
                              <XCircle size={12} aria-hidden="true" />
                              Refuser
                            </button>
                          </>
                        )}

                        {(enr.status === 'approved' || enr.status === 'rejected') && (
                          <button
                            type="button"
                            className="rf-lien"
                            onClick={() => reEnroler(enr)}
                            disabled={occupee || desactivee}
                            title={desactivee ? 'Le ré-enrôlement est déjà demandé' : 'Demander une nouvelle photo'}
                          >
                            <RefreshCw size={12} aria-hidden="true" className={occupee ? 'rf-tourne' : undefined} />
                            Ré-enrôler
                          </button>
                        )}

                        <button
                          type="button"
                          className="rf-lien rf-lien--danger"
                          onClick={() => setConfirmation({ type: 'suppression', enr })}
                          disabled={occupee}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                          Supprimer
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="rf-note">
              Une fiche validée sert au pointage par visage. « Ré-enrôler » la désactive
              jusqu’à ce que l’employé enregistre une nouvelle photo.
            </p>
          </section>
        ) : (
          <section
            className="rf-vue"
            id="rf-vue-reglages"
            role="tabpanel"
            aria-labelledby="rf-onglet-reglages"
          >
            <div className="rf-folio">
              <p className="rf-marque"><strong>En-Check</strong> · Reconnaissance faciale</p>
              <p className="rf-folio-droite">Règles du pointage</p>
            </div>

            <header className="rf-tete">
              <div>
                <p className="rf-eyebrow">Ce que la reconnaissance accepte</p>
                <h2 className="rf-titre-vue">Réglages<span>.</span></h2>
              </div>
              {entrepriseDesReglages && (
                <p className="rf-tete-note">
                  <Building2 size={11} aria-hidden="true" />
                  {nomEntrepriseDesReglages || 'Entreprise choisie'}
                </p>
              )}
            </header>

            {!entrepriseDesReglages ? (
              <div className="rf-vide">
                <span className="rf-vide-sceau" aria-hidden="true"><Building2 size={19} /></span>
                <p className="rf-vide-titre">Choisissez une entreprise pour régler sa reconnaissance.</p>
                <p className="rf-vide-note">
                  Un seuil, un mode de pointage appartiennent à une entreprise : ils ne se
                  règlent pas pour toutes à la fois.
                </p>
                {admin?.role === 'super_admin' && entreprises.length > 0 && (
                  <label className="rf-champ rf-champ-select rf-champ-vide">
                    <span className="rf-etiquette">
                      <Building2 size={11} aria-hidden="true" />
                      Entreprise
                    </span>
                    <select
                      value={selectedEntrepriseId}
                      onChange={(evenement) => setSelectedEntrepriseId(evenement.target.value)}
                      aria-label="Choisir l’entreprise dont on règle la reconnaissance"
                    >
                      <option value="all">Toutes les entreprises</option>
                      {entreprises.map((ent) => (
                        <option key={ent.id} value={ent.id}>{ent.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ) : chargementConfig ? (
              <Chargement texte="Chargement des réglages…" note="Les règles de l’entreprise arrivent du serveur." />
            ) : (
              <>
                <div className="rf-feuillets">
                  {/* ── la sécurité ── */}
                  <section className="rf-feuillet" aria-labelledby="rf-feuillet-securite">
                    <header className="rf-feuillet-tete">
                      <span className="rf-feuillet-marque" aria-hidden="true"><ShieldCheck size={15} /></span>
                      <h3 className="rf-feuillet-titre" id="rf-feuillet-securite">La sécurité</h3>
                      <span className="rf-feuillet-note">Ce que le système accepte</span>
                    </header>

                    <div className="rf-champ rf-champ-large">
                      <div className="rf-champ-tete">
                        <label className="rf-etiquette" htmlFor="rf-seuil">Seuil de confiance</label>
                        <output className="rf-valeur" htmlFor="rf-seuil">
                          {Math.round(config.confidence_threshold * 100)} %
                        </output>
                      </div>
                      <input
                        id="rf-seuil"
                        type="range"
                        min="0.6"
                        max="0.95"
                        step="0.01"
                        value={config.confidence_threshold}
                        onChange={(evenement) => modifierConfig('confidence_threshold', Number(evenement.target.value))}
                      />
                      <div className="rf-bornes">
                        <span>60 % · souple</span>
                        <span>80 % · recommandé</span>
                        <span>95 % · strict</span>
                      </div>
                      <p className="rf-aide">
                        Score minimum pour accepter un visage. Plus il est haut, plus le
                        pointage est sûr — et plus il rejette de vrais visages.
                      </p>
                    </div>

                    <Interrupteur
                      id="rf-interrupteur-vivant"
                      titre="Vérifier que le visage est vivant"
                      note="Refuse une photo, un écran ou un masque : seul un visage réel fait foi."
                      actif={config.liveness_required}
                      onChange={(valeur) => modifierConfig('liveness_required', valeur)}
                    />
                  </section>

                  {/* ── l'enrôlement ── */}
                  <section className="rf-feuillet" aria-labelledby="rf-feuillet-enrolement">
                    <header className="rf-feuillet-tete">
                      <span className="rf-feuillet-marque" aria-hidden="true"><CheckCircle2 size={15} /></span>
                      <h3 className="rf-feuillet-titre" id="rf-feuillet-enrolement">L’enrôlement</h3>
                      <span className="rf-feuillet-note">Ce qu’il faut avant de pointer</span>
                    </header>

                    <Interrupteur
                      id="rf-interrupteur-validation"
                      titre="Validation par un administrateur"
                      note="Chaque nouvelle fiche doit être validée avant de servir au pointage."
                      actif={config.admin_approval_required}
                      onChange={(valeur) => modifierConfig('admin_approval_required', valeur)}
                    />

                    <Interrupteur
                      id="rf-interrupteur-borne"
                      titre="Mode borne (tablette partagée)"
                      note="Un appareil commun à tous : les visages enrôlés y sont chargés localement."
                      actif={config.kiosk_mode_enabled}
                      onChange={(valeur) => modifierConfig('kiosk_mode_enabled', valeur)}
                    />
                  </section>

                  {/* ── en cas d'échec ── */}
                  <section className="rf-feuillet" aria-labelledby="rf-feuillet-echec">
                    <header className="rf-feuillet-tete">
                      <span className="rf-feuillet-marque" aria-hidden="true"><AlertTriangle size={15} /></span>
                      <h3 className="rf-feuillet-titre" id="rf-feuillet-echec">En cas d’échec</h3>
                      <span className="rf-feuillet-note">Quand le visage n’est pas reconnu</span>
                    </header>

                    <div className="rf-champ rf-champ-large">
                      <div className="rf-champ-tete">
                        <span className="rf-etiquette" id="rf-tentatives">Tentatives avant un autre mode</span>
                        <div className="rf-compteur" role="group" aria-labelledby="rf-tentatives">
                          <button
                            type="button"
                            onClick={() => modifierConfig('max_attempts', Math.max(1, config.max_attempts - 1))}
                            aria-label="Retirer une tentative"
                            disabled={config.max_attempts <= 1}
                          >
                            −
                          </button>
                          <output aria-live="polite">{config.max_attempts}</output>
                          <button
                            type="button"
                            onClick={() => modifierConfig('max_attempts', Math.min(10, config.max_attempts + 1))}
                            aria-label="Ajouter une tentative"
                            disabled={config.max_attempts >= 10}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="rf-aide">
                        Nombre d’essais avant de proposer un autre mode de pointage.
                      </p>
                    </div>

                    <Interrupteur
                      id="rf-interrupteur-fallback"
                      titre="Autre mode autorisé après échec"
                      note="L’employé peut alors pointer par code ou par QR, selon ce qu’il a."
                      actif={config.fallback_allowed}
                      onChange={(valeur) => modifierConfig('fallback_allowed', valeur)}
                    />

                    {!config.fallback_allowed && (
                      <p className="rf-alerte-inline" role="status">
                        <AlertTriangle size={13} aria-hidden="true" />
                        Sans autre mode, un employé non reconnu ne peut pas pointer du tout.
                        À réserver aux sites où le visage est le seul accès prévu.
                      </p>
                    )}
                  </section>

                  {/* ── le mode de pointage ── */}
                  <section className="rf-feuillet rf-feuillet--large" aria-labelledby="rf-feuillet-mode">
                    <header className="rf-feuillet-tete">
                      <span className="rf-feuillet-marque" aria-hidden="true"><ScanFace size={15} /></span>
                      <h3 className="rf-feuillet-titre" id="rf-feuillet-mode">Le mode de pointage</h3>
                      <span className="rf-feuillet-note">La place du visage dans la journée</span>
                    </header>

                    <div className="rf-modes" role="radiogroup" aria-labelledby="rf-feuillet-mode">
                      {MODES.map((mode) => {
                        const choisi = config.pointage_mode === mode.cle
                        return (
                          <label
                            key={mode.cle}
                            className="rf-mode"
                            data-actif={choisi ? 'oui' : 'non'}
                            data-ton={mode.ton}
                          >
                            <input
                              type="radio"
                              name="rf-mode-pointage"
                              value={mode.cle}
                              checked={choisi}
                              onChange={() => modifierConfig('pointage_mode', mode.cle)}
                            />
                            <span className="rf-mode-puce" aria-hidden="true" />
                            <span className="rf-mode-texte">
                              <span className="rf-mode-nom">{mode.nom}</span>
                              <span className="rf-mode-note">{mode.note}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>

                    <p className="rf-aide">
                      Ce réglage décrit la place du visage, pas le matériel : une borne reste
                      une borne, quel que soit le mode retenu.
                    </p>
                  </section>
                </div>

                <div className="rf-enregistrement">
                  <p className="rf-enregistrement-etat" data-modifie={reglagesModifies ? 'oui' : 'non'}>
                    {reglagesModifies ? 'Réglages modifiés, pas encore enregistrés.' : 'Réglages à jour.'}
                  </p>
                  <button
                    type="button"
                    className="rf-bouton-creux"
                    onClick={revenirAuxReglages}
                    disabled={!reglagesModifies || enregistrement}
                  >
                    Annuler les changements
                  </button>
                  <button
                    type="button"
                    className="rf-bouton"
                    onClick={enregistrerConfig}
                    disabled={!reglagesModifies || enregistrement}
                  >
                    <Save size={14} aria-hidden="true" />
                    {enregistrement ? 'Enregistrement…' : 'Enregistrer les réglages'}
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <div className="rf-pied">
        <PageCulturalBand pathname="/reconnaissance-faciale" placement="bottom" />
      </div>

      {/* ── la photo en grand ── */}
      {photoOuverte && (
        <Fenetre
          eyebrow="Fiche faciale"
          titre={nomDe(photoOuverte)}
          labelledBy="rf-fenetre-photo"
          onClose={() => setPhotoOuverte(null)}
          pied={(
            <>
              <p className="rf-fenetre-aide">
                {photoOuverte.employees?.matricule || 'Matricule non renseigné'}
                {' · '}
                enregistrée le {formaterDate(photoOuverte.created_at)}
              </p>
              <button type="button" className="rf-bouton" onClick={() => setPhotoOuverte(null)}>
                Fermer
              </button>
            </>
          )}
        >
          <div className="rf-photo-cadre">
            {photoOuverte.enrollment_photo_url ? (
              <PhotoSignee
                url={photoOuverte.enrollment_photo_url}
                alt={`Photo d’enrôlement de ${nomDe(photoOuverte)}`}
                className="rf-photo"
              />
            ) : (
              <p className="rf-photo-vide">
                <Camera size={20} aria-hidden="true" />
                Aucune photo n’est enregistrée pour cette fiche.
              </p>
            )}
          </div>
          <p className="rf-fenetre-aide">
            La photo sert de référence au pointage. Elle est lue par un administrateur
            connecté, jamais publiée.
          </p>
        </Fenetre>
      )}

      {/* ── refuser : le motif est obligatoire ── */}
      {confirmation?.type === 'refus' && (
        <Fenetre
          eyebrow="Fiche faciale"
          titre={`Refuser la fiche de ${nomDe(confirmation.enr)}`}
          labelledBy="rf-fenetre-refus"
          etroit
          onClose={fermerConfirmation}
          pied={(
            <>
              <button type="button" className="rf-bouton-creux" onClick={fermerConfirmation}>
                Annuler
              </button>
              <button
                type="button"
                className="rf-bouton rf-bouton--danger"
                onClick={confirmerRefus}
                disabled={enCours === confirmation.enr.id}
              >
                <XCircle size={14} aria-hidden="true" />
                {enCours === confirmation.enr.id ? 'Enregistrement…' : 'Confirmer le refus'}
              </button>
            </>
          )}
        >
          <p className="rf-fenetre-texte">
            L’employé verra ce motif : écrivez ce qu’il doit corriger sur sa photo.
          </p>
          <label className="rf-champ rf-champ-large">
            <span className="rf-etiquette">Motif du refus</span>
            <textarea
              className="rf-zone-texte"
              value={motifRefus}
              onChange={(evenement) => {
                setMotifRefus(evenement.target.value)
                if (erreurRefus) setErreurRefus('')
              }}
              placeholder="Photo floue, visage masqué, cadrage incomplet…"
              rows={3}
              aria-invalid={erreurRefus ? 'true' : undefined}
              aria-describedby={erreurRefus ? 'rf-erreur-refus' : undefined}
            />
          </label>
          {erreurRefus && (
            <p className="rf-erreur" id="rf-erreur-refus" role="alert">{erreurRefus}</p>
          )}
        </Fenetre>
      )}

      {/* ── supprimer : une fois, et pour de bon ── */}
      {confirmation?.type === 'suppression' && (
        <Fenetre
          eyebrow="Fiche faciale"
          titre={`Supprimer la fiche de ${nomDe(confirmation.enr)}`}
          labelledBy="rf-fenetre-suppression"
          etroit
          onClose={fermerConfirmation}
          pied={(
            <>
              <button type="button" className="rf-bouton-creux" onClick={fermerConfirmation}>
                Annuler
              </button>
              <button
                type="button"
                className="rf-bouton rf-bouton--danger"
                onClick={confirmerSuppression}
                disabled={enCours === confirmation.enr.id}
              >
                <Trash2 size={14} aria-hidden="true" />
                {enCours === confirmation.enr.id ? 'Suppression…' : 'Supprimer la fiche'}
              </button>
            </>
          )}
        >
          <p className="rf-fenetre-texte">
            La photo et le gabarit du visage seront supprimés. Cette action ne se défait pas :
            {' '}
            {nomDe(confirmation.enr)} devra se ré-enrôler pour pointer par le visage.
          </p>
          <p className="rf-fenetre-aide">
            Les pointages déjà enregistrés restent dans l’historique, sans lien avec cette fiche.
          </p>
        </Fenetre>
      )}
    </div>
  )
}
