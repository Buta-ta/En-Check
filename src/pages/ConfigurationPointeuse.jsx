// ═══════════════════════════════════════════════════════════
// 🎨 CONFIGURATION POINTEUSE — la toile de Korhogo, une seule pièce
//
// Deux écrans vivaient côte à côte : le registre des pointeuses ADMS
// (machines à badge, clés d'accès, journal des envois) et la page du
// poste de pointage (la tablette de l'entrée). Ils parlent du même
// matériel et de la même entreprise : ils font maintenant une page.
//
//   · Pointeuses — enregistrer une machine, lire sa clé, exporter
//     `appareils.json`, mettre en pause, retirer du registre ;
//   · Journal des envois — ce que chaque machine a déposé, et les
//     numéros qui ne correspondent à aucun employé ;
//   · Poste de pointage — le code de l'entreprise, l'état de CET
//     appareil, l'installation et l'ouverture de l'écran du poste.
//
// Le dessin est la toile peinte sénoufo : coton écru, cadres tracés
// au noir de fumée, ocre brûlé, et dans chaque cartouche un emblème.
// Ici la toile est posée sur un mur de fumée : le registre reste un
// outil de service, pas une peinture. Aucune formule d'atelier.
//
// Rien de la mécanique n'est inventé : mêmes tables (`adms_devices`,
// `adms_log`), mêmes fonctions serveur, même fichier attendu par le
// receveur, même mémoire d'appareil que l'écran du poste.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Building2, Check, CheckCircle2, Clock, Copy,
  Download, Eye, EyeOff, FileJson, Info, KeyRound, MonitorSmartphone, Moon,
  PauseCircle, PlayCircle, Plus, Radio, RefreshCw, Server, Sun, Tablet,
  Trash2, Wifi, WifiOff, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import PageCulturalBand from '../components/PageCulturalBand'
import RaccourcisPages from '../components/RaccourcisPages'
import { KorhogoBlasonNuitSvg } from '../components/KorhogoSvg'
import { useTheme } from '../contexts/ThemeContext'
import { lirePoste, installerPoste, oublierPoste } from '../lib/postePointage'
import './ConfigurationPointeuse.css'

// Une machine est en ligne si elle s'est manifestée depuis moins de dix
// minutes : elle interroge le receveur toutes les dix à trente secondes.
const SEUIL_EN_LIGNE_MIN = 10

const VUES = [
  { cle: 'pointeuses', libelle: 'Pointeuses', icone: Server },
  { cle: 'journal', libelle: 'Journal des envois', icone: Radio },
  { cle: 'poste', libelle: 'Poste de pointage', icone: MonitorSmartphone },
]

function depuis(iso) {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  const min = Math.floor(ms / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  if (j < 31) return `il y a ${j} j`
  return new Date(iso).toLocaleDateString('fr-FR')
}

function dateHeure(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function dateCourte(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Même règle de normalisation que le receveur et le moteur d'import :
// « AAA-0001 » et « aaa0001 » désignent la même machine.
function normaliserCle(valeur) {
  return String(valeur ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.'_-]/g, '')
    .replace(/^0+/, '')
}

// 24 octets aléatoires en hexadécimal : la même entropie que côté serveur.
function cleAleatoire() {
  const octets = new Uint8Array(24)
  crypto.getRandomValues(octets)
  return Array.from(octets).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Copie dans le presse-papiers, avec un repli pour les navigateurs plus anciens
// ou les accès en http:// (où `navigator.clipboard` est indisponible).
async function copierTexte(texte) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texte)
      return true
    }
  } catch {
    /* repli ci-dessous */
  }

  try {
    const zone = document.createElement('textarea')
    zone.value = texte
    zone.style.position = 'fixed'
    zone.style.opacity = '0'
    document.body.appendChild(zone)
    zone.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(zone)
    return ok
  } catch {
    return false
  }
}

const etatAppareil = (appareil) => {
  if (appareil.is_active === false) {
    return { texte: 'En pause', ton: 'neutre', icone: PauseCircle, court: 'En pause' }
  }
  if (!appareil.last_seen_at) {
    return { texte: 'Jamais connectée', ton: 'attente', icone: WifiOff, court: 'Jamais connectée' }
  }
  const min = (Date.now() - new Date(appareil.last_seen_at).getTime()) / 60000
  if (min < SEUIL_EN_LIGNE_MIN) return { texte: 'En ligne', ton: 'ok', icone: Wifi, court: 'En ligne' }
  return {
    texte: `Hors ligne — ${depuis(appareil.last_seen_at)}`,
    ton: 'alerte',
    icone: WifiOff,
    court: 'Hors ligne',
  }
}

// ═══════════════════════════════════════════════════════════
// LES PETITES PIÈCES
// ═══════════════════════════════════════════════════════════

function Chargement({ texte = 'Chargement du registre…', note = 'Les machines arrivent du serveur.' }) {
  return (
    <div className="cp-charge" role="status" aria-live="polite">
      <span className="cp-charge-tresse" aria-hidden="true">
        {[0, 1, 2, 3].map((rang) => (
          <span className="cp-charge-cheuron" key={rang} data-rang={rang} />
        ))}
      </span>
      <p className="cp-charge-texte">{texte}</p>
      <span className="cp-charge-note">{note}</span>
    </div>
  )
}

function Fenetre({ eyebrow, titre, onClose, children, pied, labelledBy, etroit = false }) {
  return (
    <div
      className="cp-voile"
      onClick={(evenement) => {
        if (evenement.target === evenement.currentTarget) onClose()
      }}
    >
      <div
        className={`cp-fenetre${etroit ? ' cp-fenetre--etroit' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <header className="cp-fenetre-tete">
          <div>
            <p className="cp-eyebrow">{eyebrow}</p>
            <h2 className="cp-fenetre-titre" id={labelledBy}>{titre}</h2>
          </div>
          <button type="button" className="cp-fermer" onClick={onClose} aria-label="Fermer la fenêtre">
            <X size={15} />
          </button>
        </header>
        <div className="cp-fenetre-corps">{children}</div>
        {pied && <footer className="cp-fenetre-pied">{pied}</footer>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// LA PAGE
// ═══════════════════════════════════════════════════════════

export default function ConfigurationPointeuse() {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()

  const [admin, setAdmin] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [entreprisesChargees, setEntreprisesChargees] = useState(false)
  const [selectedEntId, setSelectedEntId] = useState(null)

  const [entreprise, setEntreprise] = useState(null)
  const [appareils, setAppareils] = useState([])
  const [journal, setJournal] = useState([])
  const [sansPin, setSansPin] = useState([])
  const [loading, setLoading] = useState(true)
  const [rafraichir, setRafraichir] = useState(false)

  const [vue, setVue] = useState('pointeuses')
  const [showAjout, setShowAjout] = useState(false)
  const [form, setForm] = useState({ serial: '', label: '' })
  const [enregistrement, setEnregistrement] = useState(false)
  const [secretCree, setSecretCree] = useState(null)
  const [reveles, setReveles] = useState({})
  const [copie, setCopie] = useState(null)
  const [aSupprimer, setASupprimer] = useState(null)
  const [traitement, setTraitement] = useState(null)
  const [avis, setAvis] = useState(null)
  const [ouvrirDepannage, setOuvrirDepannage] = useState(false)

  // La session réellement ouverte : `localStorage` n'en est qu'une copie.
  const [sessionOk, setSessionOk] = useState(null)

  // Le poste de pointage retenu par CET appareil.
  const [poste, setPoste] = useState(null)
  const [codePoste, setCodePoste] = useState('')
  const [installationPoste, setInstallationPoste] = useState(false)
  const [erreurPoste, setErreurPoste] = useState('')

  const estSuperAdmin = admin?.role === 'super_admin'

  const marquer = useCallback((texte, ton = 'ok') => setAvis({ texte, ton }), [])

  // ═══════════════════════════════════════════════════════════
  // LE CHARGEMENT
  // ═══════════════════════════════════════════════════════════
  const verifierSession = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession()
      setSessionOk(!!data?.session)
      return !!data?.session
    } catch {
      setSessionOk(false)
      return false
    }
  }, [])

  const chargerEntreprises = useCallback(async () => {
    const { data, error } = await supabase
      .from('enterprises')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')

    setEntreprisesChargees(true)
    if (error) {
      marquer('La liste des entreprises n’a pas pu être lue. Réessayez dans un instant.', 'alerte')
      setLoading(false)
      return
    }
    const liste = data || []
    setEntreprises(liste)

    // L'en-tête de l'administration retient l'entreprise en cours : on y
    // revient si elle est toujours active, sinon on prend la première.
    const retenue = localStorage.getItem('selected_enterprise_id')
    const trouvee = liste.find((ent) => ent.id === retenue)
    if (trouvee) setSelectedEntId(trouvee.id)
    else if (liste.length > 0) setSelectedEntId(liste[0].id)
    else setLoading(false)
  }, [marquer])

  useEffect(() => {
    verifierSession()
    setPoste(lirePoste())

    const brut = localStorage.getItem('admin')
    if (!brut) { navigate('/login'); return }

    let parsed = null
    try { parsed = JSON.parse(brut) } catch { navigate('/login'); return }
    setAdmin(parsed)

    if (parsed.role === 'super_admin') {
      chargerEntreprises()
    } else {
      const entId = localStorage.getItem('selected_enterprise_id')
        || parsed.selectedEnterprise?.id
        || parsed.enterprise_id
      setSelectedEntId(entId || null)
      setEntreprisesChargees(true)
    }
  }, [navigate, verifierSession, chargerEntreprises])

  const chargerTout = useCallback(async (entId) => {
    if (!entId) { setLoading(false); return }
    setLoading(true)

    const [resEnt, resApp, resLog, resPin] = await Promise.all([
      supabase
        .from('enterprises')
        .select('id, name, code, timezone')
        .eq('id', entId)
        .maybeSingle(),
      supabase
        .from('adms_devices')
        .select('*')
        .eq('enterprise_id', entId)
        .order('created_at', { ascending: false }),
      supabase
        .from('adms_log')
        .select('*')
        .eq('enterprise_id', entId)
        .order('recu_le', { ascending: false })
        .limit(25),
      supabase.rpc('encheck_employes_sans_pin', { p_enterprise_id: entId }),
    ])

    setEntreprise(resEnt.data || null)

    if (resApp.error) {
      console.warn('[Configuration pointeuse] registre indisponible :', resApp.error.message)
      marquer('Le registre des pointeuses n’est pas disponible pour le moment.', 'alerte')
      setAppareils([])
    } else {
      setAppareils(resApp.data || [])
    }

    if (resLog.error) {
      console.warn('[Configuration pointeuse] journal indisponible :', resLog.error.message)
      setJournal([])
    } else {
      setJournal(resLog.data || [])
    }

    if (resPin.error) {
      console.warn('[Configuration pointeuse] liste des numéros :', resPin.error.message)
      setSansPin([])
    } else {
      setSansPin(Array.isArray(resPin.data) ? resPin.data : [])
    }

    setLoading(false)
    setRafraichir(false)
  }, [marquer])

  useEffect(() => {
    if (selectedEntId) chargerTout(selectedEntId)
  }, [selectedEntId, chargerTout])

  const actualiser = () => {
    setRafraichir(true)
    chargerTout(selectedEntId)
  }

  // ── les chiffres de la page ──────────────────────────────
  const stats = useMemo(() => {
    const enLigne = appareils.filter((a) => {
      if (a.is_active === false || !a.last_seen_at) return false
      return (Date.now() - new Date(a.last_seen_at).getTime()) / 60000 < SEUIL_EN_LIGNE_MIN
    }).length
    return {
      machines: appareils.length,
      enLigne,
      enPause: appareils.filter((a) => a.is_active === false).length,
      sansPin: sansPin.length,
      journal: journal.length,
      pointages: appareils.reduce((somme, a) => somme + (Number(a.punch_count) || 0), 0),
    }
  }, [appareils, journal, sansPin])

  const nomAffiche = useMemo(() => {
    if (entreprise?.name) return entreprise.name
    if (!selectedEntId) return 'Aucune entreprise'
    if (estSuperAdmin) {
      return entreprises.find((e) => e.id === selectedEntId)?.name || 'Entreprise choisie'
    }
    return admin?.selectedEnterprise?.name || admin?.enterprise_name || 'Entreprise non renseignée'
  }, [entreprise, selectedEntId, estSuperAdmin, entreprises, admin])

  const codeEntreprise = entreprise?.code || null
  const fuseauRenseigne = !!entreprise?.timezone

  // ═══════════════════════════════════════════════════════════
  // OUTILS
  // ═══════════════════════════════════════════════════════════
  const copier = async (texte, cle) => {
    if (!texte) { marquer('Il n’y a rien à copier pour l’instant.', 'alerte'); return }
    const ok = await copierTexte(texte)
    if (!ok) {
      marquer('Copie impossible : sélectionnez le texte à la main.', 'alerte')
      return
    }
    setCopie(cle)
    marquer('Copié dans le presse-papiers.')
    setTimeout(() => setCopie((c) => (c === cle ? null : c)), 2000)
  }

  const blocJson = (a) => JSON.stringify(
    { serial: a.serial_number, secret: a.secret, label: a.label || '' },
    null,
    2,
  )

  const telechargerAppareilsJson = (liste = appareils) => {
    const actifs = liste.filter((a) => a.is_active !== false)
    if (actifs.length === 0) {
      marquer('Aucune machine active à exporter : mettez-en une en service, ou réactivez-la.', 'alerte')
      return
    }
    const contenu = JSON.stringify(
      actifs.map((a) => ({ serial: a.serial_number, secret: a.secret, label: a.label || '' })),
      null,
      2,
    )
    const blob = new Blob([contenu], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = 'appareils.json'
    document.body.appendChild(lien)
    lien.click()
    document.body.removeChild(lien)
    URL.revokeObjectURL(url)
    marquer(`appareils.json téléchargé : ${actifs.length} machine${actifs.length > 1 ? 's' : ''}. Déposez-le à côté du receveur.`)
  }

  // ═══════════════════════════════════════════════════════════
  // ENREGISTRER UNE MACHINE
  // ═══════════════════════════════════════════════════════════
  const creerDirectement = async (serial) => {
    const { data, error } = await supabase
      .from('adms_devices')
      .insert({
        enterprise_id: selectedEntId,
        serial_number: serial,
        label: form.label.trim() || null,
        secret: cleAleatoire(),
      })
      .select('serial_number, label, secret')
      .single()

    if (!error) {
      setSecretCree({ serial: data.serial_number, label: data.label, secret: data.secret })
      setForm({ serial: '', label: '' })
      setShowAjout(false)
      chargerTout(selectedEntId)
      return
    }

    // Ce numéro de série existe déjà : on retrouve la machine et sa clé,
    // comme le fait la fonction serveur.
    if (error.code === '23505') {
      const { data: lignes } = await supabase
        .from('adms_devices')
        .select('serial_number, label, secret, enterprise_id')

      const cible = (lignes || []).find(
        (l) => normaliserCle(l.serial_number) === normaliserCle(serial),
      )

      if (cible && cible.enterprise_id !== selectedEntId) {
        marquer(
          'Ce numéro de série est déjà rattaché à une autre entreprise. Une machine ne peut pas servir deux entreprises.',
          'alerte',
        )
        return
      }
      if (cible) {
        setSecretCree({
          serial: cible.serial_number,
          label: cible.label,
          secret: cible.secret,
          dejaPresente: true,
        })
        setForm({ serial: '', label: '' })
        setShowAjout(false)
        chargerTout(selectedEntId)
        return
      }
    }

    if (error.code === '42501' || /policy|permission/i.test(String(error.message || ''))) {
      marquer(
        'Votre compte n’est pas autorisé à modifier le registre des pointeuses. Demandez à un administrateur l’accès à cette entreprise.',
        'alerte',
      )
      return
    }

    console.error('[Configuration pointeuse] enregistrement :', error)
    marquer('L’enregistrement a échoué. Réessayez dans un instant.', 'alerte')
  }

  const enregistrerAppareil = async () => {
    const serial = form.serial.trim()
    if (!serial) { marquer('Le numéro de série est obligatoire.', 'alerte'); return }
    if (!selectedEntId) { marquer('Choisissez d’abord une entreprise.', 'alerte'); return }

    const ouverte = await verifierSession()
    if (!ouverte) {
      marquer('Votre session a expiré : reconnectez-vous pour enregistrer une pointeuse.', 'alerte')
      return
    }

    setEnregistrement(true)
    setAvis(null)
    const { data, error } = await supabase.rpc('encheck_adms_appareil_ajouter', {
      p_enterprise_id: selectedEntId,
      p_serial: serial,
      p_label: form.label.trim() || null,
    })
    setEnregistrement(false)

    // Si la fonction serveur n'est pas joignable (service non relu après une
    // mise à jour, ou appel indisponible), on n'immobilise pas l'installateur.
    if (error && (error.code === 'PGRST202' || error.status === 404 || error.code === '42883'
      || /schema cache/i.test(String(error.message || ''))
      || /does not exist/i.test(String(error.message || '')))) {
      console.warn('[Configuration pointeuse] fonction serveur indisponible, écriture directe :', error.message)
      await creerDirectement(serial)
      return
    }

    if (error) {
      const message = String(error.message || '')
      const { data: { session } } = await supabase.auth.getSession()
      setSessionOk(!!session)

      if (!session) {
        marquer('Votre session a expiré : reconnectez-vous pour continuer.', 'alerte')
        return
      }
      if (/schema cache/i.test(message)) {
        console.error('[Configuration pointeuse] service indisponible (A-404) :', message)
        marquer(
          'Enregistrement momentanément indisponible (A-404). Réessayez dans un instant ; si cela persiste, signalez ce code à votre administrateur.',
          'alerte',
        )
        return
      }
      console.error('[Configuration pointeuse] enregistrement :', error)
      marquer('L’enregistrement a échoué. Réessayez dans un instant.', 'alerte')
      return
    }

    if (data?.ok === false) {
      const motifs = {
        non_connecte: 'Votre session a expiré : reconnectez-vous.',
        acces_refuse: 'Vous n’avez pas accès à cette entreprise.',
        numero_de_serie_manquant: 'Le numéro de série est obligatoire.',
        numero_de_serie_deja_pris: 'Ce numéro de série est déjà rattaché à une autre entreprise.',
      }
      marquer(motifs[data.reason] || 'L’enregistrement a été refusé.', 'alerte')
      return
    }

    setSecretCree({
      serial: data.serial_number || serial,
      label: form.label.trim(),
      secret: data.secret,
      dejaPresente: data.action === 'deja_present',
    })
    setForm({ serial: '', label: '' })
    setShowAjout(false)
    chargerTout(selectedEntId)
  }

  // ═══════════════════════════════════════════════════════════
  // PAUSE · RÉACTIVATION · SUPPRESSION
  // ═══════════════════════════════════════════════════════════
  const basculerActivation = async (appareil) => {
    const cible = appareil.is_active === false
    setTraitement(appareil.id)

    const { error } = await supabase
      .from('adms_devices')
      .update({ is_active: cible, updated_at: new Date().toISOString() })
      .eq('id', appareil.id)

    setTraitement(null)

    if (error) {
      console.error('[Configuration pointeuse] mise en pause :', error)
      marquer('L’opération a échoué. Réessayez dans un instant.', 'alerte')
      return
    }

    marquer(
      cible
        ? 'Machine réactivée : elle peut de nouveau déposer ses pointages.'
        : 'Machine mise en pause : ses envois sont refusés jusqu’à sa réactivation.',
    )
    chargerTout(selectedEntId)
  }

  const supprimerAppareil = async () => {
    if (!aSupprimer) return
    setTraitement(aSupprimer.id)

    const { error } = await supabase
      .from('adms_devices')
      .delete()
      .eq('id', aSupprimer.id)

    setTraitement(null)

    if (error) {
      console.error('[Configuration pointeuse] suppression :', error)
      marquer('La suppression a échoué. Réessayez dans un instant.', 'alerte')
      return
    }

    marquer(`« ${aSupprimer.label || aSupprimer.serial_number} » a été retirée du registre.`)
    setASupprimer(null)
    chargerTout(selectedEntId)
  }

  // ═══════════════════════════════════════════════════════════
  // LE POSTE DE POINTAGE
  // ═══════════════════════════════════════════════════════════
  const installerCetAppareil = async () => {
    setInstallationPoste(true)
    setErreurPoste('')
    const reponse = await installerPoste(codePoste)
    setInstallationPoste(false)

    if (reponse.erreur) {
      setErreurPoste(reponse.erreur)
      return
    }
    setPoste(reponse.config)
    setCodePoste('')
    marquer(`Cet appareil est maintenant le poste de pointage de ${reponse.config.nom}.`)
  }

  const detacherAppareil = () => {
    oublierPoste()
    setPoste(null)
    marquer('Cet appareil n’est plus un poste de pointage. La tablette demandera de nouveau le code.')
  }

  // ── les fenêtres se ferment à Échap, le fond ne défile plus ──
  const fenetreOuverte = Boolean(showAjout || aSupprimer)
  useEffect(() => {
    if (!fenetreOuverte) return undefined
    const surTouche = (evenement) => {
      if (evenement.key !== 'Escape') return
      setShowAjout(false)
      setASupprimer(null)
    }
    const ancien = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
      document.body.style.overflow = ancien
    }
  }, [fenetreOuverte])

  // ═══════════════════════════════════════════════════════════
  // 🖥️ L'ÉCRAN
  // ═══════════════════════════════════════════════════════════

  const vuRegistre = (() => {
    if (loading) return <Chargement />
    if (appareils.length === 0) {
      return (
        <div className="cp-vide">
          <span className="cp-vide-sceau" aria-hidden="true"><Server size={19} /></span>
          <p className="cp-vide-titre">Aucune pointeuse enregistrée pour cette entreprise.</p>
          <p className="cp-vide-note">
            Le numéro de série est inscrit sur la machine : <strong>Menu → Info → Serial Number</strong>.
            Enregistrez-la, sa clé d’accès s’affiche aussitôt.
          </p>
          <button
            type="button"
            className="cp-bouton"
            onClick={() => { setAvis(null); setShowAjout(true) }}
          >
            <Plus size={14} aria-hidden="true" />
            Enregistrer une pointeuse
          </button>
        </div>
      )
    }
    return (
      <ul className="cp-appareils">
        {appareils.map((appareil, index) => {
          const etat = etatAppareil(appareil)
          const Icone = etat.icone
          const visible = !!reveles[appareil.id]
          const occupe = traitement === appareil.id
          const enPause = appareil.is_active === false
          return (
            <li className="cp-appareil" key={appareil.id} data-ton={etat.ton} data-occupe={occupe ? 'oui' : 'non'}>
              <span className="cp-appareil-index">{String(index + 1).padStart(2, '0')}</span>

              <div className="cp-appareil-entete">
                <span className="cp-appareil-marque" aria-hidden="true"><Icone size={16} /></span>
                <div className="cp-appareil-identite">
                  <h3 className="cp-appareil-nom">{appareil.label || '(sans nom)'}</h3>
                  <p className="cp-appareil-serie">{appareil.serial_number}</p>
                </div>
                <span className="cp-sceau" data-ton={etat.ton}>{etat.texte}</span>
              </div>

              <dl className="cp-appareil-chiffres">
                <div>
                  <dt>Dernier contact</dt>
                  <dd>{depuis(appareil.last_seen_at) || 'jamais'}</dd>
                </div>
                <div>
                  <dt>Dernier pointage</dt>
                  <dd>{depuis(appareil.last_punch_at) || 'aucun'}</dd>
                </div>
                <div>
                  <dt>Pointages reçus</dt>
                  <dd>{appareil.punch_count || 0}</dd>
                </div>
                <div>
                  <dt>Enregistrée le</dt>
                  <dd>{dateCourte(appareil.created_at)}</dd>
                </div>
              </dl>

              <div className="cp-appareil-pied">
                <div className="cp-cle">
                  <KeyRound size={12} aria-hidden="true" className="cp-cle-icone" />
                  <code>{visible ? appareil.secret : '•'.repeat(Math.min((appareil.secret || '').length, 32))}</code>
                  <button
                    type="button"
                    className="cp-cle-oeil"
                    aria-pressed={visible}
                    title={visible ? 'Masquer la clé d’accès' : 'Afficher la clé d’accès'}
                    aria-label={visible ? 'Masquer la clé d’accès' : 'Afficher la clé d’accès'}
                    onClick={() => setReveles((r) => ({ ...r, [appareil.id]: !visible }))}
                  >
                    {visible ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>

                <div className="cp-appareil-gestes">
                  <button type="button" className="cp-lien" onClick={() => copier(appareil.secret, `secret-${appareil.id}`)}>
                    {copie === `secret-${appareil.id}` ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                    {copie === `secret-${appareil.id}` ? 'Copié' : 'Copier la clé'}
                  </button>
                  <button type="button" className="cp-lien" onClick={() => copier(blocJson(appareil), `bloc-${appareil.id}`)}>
                    <FileJson size={12} aria-hidden="true" />
                    {copie === `bloc-${appareil.id}` ? 'Bloc copié' : 'Bloc JSON'}
                  </button>
                  <button
                    type="button"
                    className="cp-lien"
                    disabled={occupe}
                    onClick={() => basculerActivation(appareil)}
                  >
                    {enPause
                      ? <><PlayCircle size={12} aria-hidden="true" />Réactiver</>
                      : <><PauseCircle size={12} aria-hidden="true" />Mettre en pause</>}
                  </button>
                  <button
                    type="button"
                    className="cp-lien cp-lien--danger"
                    disabled={occupe}
                    onClick={() => setASupprimer(appareil)}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    )
  })()

  const vuJournal = (() => {
    if (loading) return <Chargement texte="Chargement du journal…" note="Les vingt-cinq derniers envois arrivent du serveur." />
    if (journal.length === 0) {
      return (
        <div className="cp-vide">
          <span className="cp-vide-sceau" aria-hidden="true"><Radio size={19} /></span>
          <p className="cp-vide-titre">Aucun envoi pour le moment.</p>
          <p className="cp-vide-note">
            Ce journal se remplit à chaque fois qu’une machine s’adresse au receveur : sa présence,
            ses pointages, et ce qui a été écarté.
          </p>
        </div>
      )
    }
    return (
      <div className="cp-tableau-cadre">
        <table className="cp-tableau">
          <thead>
            <tr>
              <th scope="col">Quand</th>
              <th scope="col">Pointeuse</th>
              <th scope="col">Type</th>
              <th scope="col" className="cp-num">Reçues</th>
              <th scope="col" className="cp-num">Acceptées</th>
              <th scope="col">Numéros non attribués</th>
            </tr>
          </thead>
          <tbody>
            {journal.map((ligne) => {
              const inconnus = ligne.pins_inconnus && typeof ligne.pins_inconnus === 'object'
                ? Object.keys(ligne.pins_inconnus)
                : []
              const pointages = ligne.payload_kind === 'ATTLOG'
              return (
                <tr key={ligne.id}>
                  <td>{dateHeure(ligne.recu_le)}</td>
                  <td className="cp-serie">{ligne.serial_number}</td>
                  <td>
                    <span className="cp-type" data-genre={pointages ? 'pointages' : 'presence'}>
                      {pointages
                        ? 'Pointages'
                        : (ligne.kind === 'getrequest' ? 'Présence' : (ligne.payload_kind || ligne.kind))}
                    </span>
                  </td>
                  <td className="cp-num">{ligne.lignes ?? '—'}</td>
                  <td className="cp-num" data-ton={(ligne.acceptees || 0) > 0 ? 'ok' : 'faible'}>
                    {ligne.acceptees ?? '—'}
                  </td>
                  <td>
                    {inconnus.length === 0 ? (
                      <span className="cp-faible">—</span>
                    ) : (
                      <span className="cp-inconnu">
                        {inconnus.map((pin) => `${pin} (×${ligne.pins_inconnus[pin]})`).join(', ')}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="cp-aide-tableau">
          <strong>Lecture du tableau.</strong> « Présence » : la machine signale qu’elle est en service
          (toutes les dix à trente secondes). « Pointages » : elle dépose des passages. Des
          <strong> numéros non attribués</strong> signifient que ces numéros ne correspondent à aucun
          employé : aucun pointage n’a pu être rattaché.
        </p>
      </div>
    )
  })()

  return (
    <div className={`cp-page${darkMode ? '' : ' cp-clair'}`}>
      <PageCulturalBand pathname="/configuration-pointeuse" />
      <div className="cp-lisiere" aria-hidden="true" />

      <header className="cp-entete">
        <button
          type="button"
          className="cp-retour"
          onClick={() => navigate('/dashboard')}
          aria-label="Revenir au tableau de bord"
          title="Tableau de bord"
        >
          <ArrowLeft size={16} />
        </button>

        <KorhogoBlasonNuitSvg size={52} />

        <div className="cp-titre-bloc">
          <p className="cp-eyebrow">Collecteurs · pointage</p>
          <h1 className="cp-titre">Configuration pointeuse<span>.</span></h1>
          <p className="cp-sous-titre">
            Les machines à badge, leur journal, et l’écran du poste — dans la même pièce.
          </p>
        </div>

        <div className="cp-entete-droite">
          <span className="cp-pastille" title="Machines vues il y a moins de dix minutes">
            <i aria-hidden="true" data-etat={stats.enLigne > 0 ? 'ok' : 'faible'} />
            {stats.enLigne > 0
              ? `${stats.enLigne} machine${stats.enLigne > 1 ? 's' : ''} en ligne`
              : 'aucune machine en ligne'}
          </span>
          <button
            type="button"
            className="cp-theme"
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

      <main className="cp-coque">
        {/* ── le seuil : l'entreprise, son code, les autres écrans ── */}
        <section className="cp-seuil" aria-label="Entreprise et accès rapides">
          <div className="cp-seuil-entreprise">
            {estSuperAdmin && entreprises.length > 0 ? (
              <label className="cp-champ cp-champ-select cp-champ-seuil">
                <span className="cp-seuil-libelle">Entreprise</span>
                <select
                  value={selectedEntId || ''}
                  onChange={(evenement) => { setAvis(null); setSelectedEntId(evenement.target.value) }}
                  aria-label="Choisir l’entreprise"
                >
                  {entreprises.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name}{ent.code ? ` (${ent.code})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <span className="cp-seuil-libelle">Entreprise</span>
                <span className="cp-seuil-nom">{nomAffiche}</span>
              </>
            )}
            <span className="cp-seuil-fait">
              {codeEntreprise
                ? <>Code <strong>{codeEntreprise}</strong> · </>
                : <>Code non renseigné · </>}
              {fuseauRenseigne ? entreprise.timezone : 'fuseau à renseigner'}
            </span>
          </div>

          <div className="cp-raccourcis">
            <span className="cp-seuil-libelle">Aller à</span>
            <RaccourcisPages compact />
          </div>
        </section>

        {avis && (
          <p className="cp-avis" data-ton={avis.ton} role="status">
            {avis.ton === 'ok'
              ? <CheckCircle2 size={13} aria-hidden="true" />
              : <AlertTriangle size={13} aria-hidden="true" />}
            {avis.texte}
            <button
              type="button"
              className="cp-avis-fermer"
              onClick={() => setAvis(null)}
              aria-label="Masquer ce message"
            >
              <X size={12} />
            </button>
          </p>
        )}

        {sessionOk === false && (
          <div className="cp-alerte" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <div>
              <p className="cp-alerte-titre">Votre session a expiré</p>
              <p className="cp-alerte-texte">
                Reconnectez-vous pour enregistrer une machine ou modifier le registre.
                Les informations affichées peuvent être incomplètes.
              </p>
            </div>
            <button type="button" className="cp-bouton cp-bouton--danger" onClick={() => navigate('/login')}>
              Se reconnecter
            </button>
          </div>
        )}

        {entreprisesChargees && !selectedEntId && !loading && (
          <div className="cp-vide">
            <span className="cp-vide-sceau" aria-hidden="true"><Building2 size={19} /></span>
            <p className="cp-vide-titre">Aucune entreprise à configurer.</p>
            <p className="cp-vide-note">
              Une pointeuse appartient à une entreprise : créez-la d’abord, puis revenez enregistrer
              la machine.
            </p>
          </div>
        )}

        {/* ── les registres de chiffres ── */}
        <section className="cp-registres" aria-label="Les chiffres de la configuration pointeuse">
          {[
            { icone: Server, ton: 'ocre', valeur: stats.machines, libelle: 'Pointeuses', note: stats.enPause > 0 ? `${stats.enPause} en pause` : 'toutes en service' },
            { icone: Wifi, ton: 'ok', valeur: stats.enLigne, libelle: 'En ligne', note: 'vu il y a moins de 10 min' },
            { icone: KeyRound, ton: 'attente', valeur: stats.sansPin, libelle: 'Numéros manquants', note: stats.sansPin > 0 ? 'pointage non rattaché' : 'tout est attribué' },
            { icone: Radio, ton: 'or', valeur: stats.journal, libelle: 'Envois au journal', note: 'les 25 derniers' },
          ].map(({ icone: Icone, ton, valeur, libelle, note }) => (
            <div className="cp-stele" key={libelle} data-ton={ton}>
              <span className="cp-stele-marque"><Icone size={17} aria-hidden="true" /></span>
              <span className="cp-stele-texte">
                <span className="cp-stele-nombre">{valeur}</span>
                <span className="cp-stele-libelle">{libelle}</span>
                <span className="cp-stele-note">{note}</span>
              </span>
            </div>
          ))}
        </section>

        {/* ── le fuseau : la seule chose qui peut tout faire échouer ── */}
        <p className="cp-fanion" data-etat={fuseauRenseigne ? 'ok' : 'alerte'}>
          {fuseauRenseigne ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
          {fuseauRenseigne ? (
            <>
              <strong>Fuseau horaire : {entreprise.timezone}.</strong>
              {' '}Renseigné — sans lui, les pointages de cette entreprise seraient écartés à l’arrivée.
            </>
          ) : (
            <>
              <strong>Fuseau horaire à renseigner.</strong>
              {' '}Sans fuseau, l’heure des pointages ne peut pas être interprétée : les envois de
              cette entreprise sont écartés. Renseignez-le depuis la page <strong>Entreprises</strong>.
            </>
          )}
        </p>

        {/* ── le sommaire : trois vues, une page ── */}
        <div className="cp-sommaire">
          <p className="cp-sommaire-titre">Sommaire</p>
          <div className="cp-sommaire-liste" role="tablist" aria-label="Vues de la configuration pointeuse">
            {VUES.map(({ cle, libelle, icone: Icone }) => (
              <button
                key={cle}
                type="button"
                role="tab"
                id={`cp-onglet-${cle}`}
                aria-selected={vue === cle}
                aria-controls={`cp-vue-${cle}`}
                className="cp-onglet"
                onClick={() => setVue(cle)}
              >
                <Icone size={14} aria-hidden="true" />
                {libelle}
                <span className="cp-onglet-nombre">
                  {cle === 'pointeuses' ? stats.machines : cle === 'journal' ? stats.journal : poste ? 1 : 0}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="cp-bouton-creux cp-onglet-action"
            onClick={actualiser}
            disabled={rafraichir || loading}
          >
            <RefreshCw size={13} aria-hidden="true" className={rafraichir || loading ? 'cp-tourne' : undefined} />
            Actualiser
          </button>
        </div>

        {/* ═══ VUE 1 — LES POINTEUSES ═══ */}
        {vue === 'pointeuses' && (
          <section
            className="cp-vue"
            id="cp-vue-pointeuses"
            role="tabpanel"
            aria-labelledby="cp-onglet-pointeuses"
          >
            <div className="cp-folio">
              <p className="cp-marque"><strong>En-Check</strong> · Configuration pointeuse</p>
              <p className="cp-folio-droite">Les machines à badge</p>
            </div>

            <header className="cp-vue-tete">
              <div>
                <p className="cp-eyebrow">Les machines du réseau</p>
                <h2 className="cp-titre-vue">Pointeuses<span>.</span></h2>
              </div>
              <dl className="cp-colophon">
                <div className="cp-chiffre">
                  <dd className="cp-chiffre-valeur">{stats.machines}</dd>
                  <dt className="cp-chiffre-libelle">Machines</dt>
                </div>
                <div className="cp-chiffre" data-ton="ok">
                  <dd className="cp-chiffre-valeur">{stats.enLigne}</dd>
                  <dt className="cp-chiffre-libelle">En ligne</dt>
                </div>
                <div className="cp-chiffre" data-ton={stats.enPause > 0 ? 'attente' : undefined}>
                  <dd className="cp-chiffre-valeur">{stats.enPause}</dd>
                  <dt className="cp-chiffre-libelle">En pause</dt>
                </div>
              </dl>
            </header>

            <div className="cp-actions">
              <button
                type="button"
                className="cp-bouton"
                onClick={() => { setAvis(null); setShowAjout(true) }}
                disabled={!selectedEntId}
              >
                <Plus size={14} aria-hidden="true" />
                Enregistrer une pointeuse
              </button>
              <button
                type="button"
                className="cp-bouton-creux"
                onClick={() => telechargerAppareilsJson()}
                disabled={appareils.length === 0}
              >
                <Download size={14} aria-hidden="true" />
                Télécharger appareils.json
              </button>
              <span className="cp-actions-note">
                {stats.pointages > 0
                  ? `${stats.pointages.toLocaleString('fr-FR')} pointages reçus par ces machines`
                  : 'Aucun pointage reçu pour l’instant'}
              </span>
            </div>

            {secretCree && (
              <div className="cp-secret" role="status">
                <div className="cp-secret-tete">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <div>
                    <p className="cp-secret-titre">
                      {secretCree.dejaPresente
                        ? `« ${secretCree.label || secretCree.serial} » était déjà enregistrée : voici sa clé d’accès`
                        : `« ${secretCree.label || secretCree.serial} » est enregistrée`}
                    </p>
                    <p className="cp-secret-texte">
                      {secretCree.dejaPresente
                        ? 'Rien n’a été modifié : c’est la même clé qu’à la première installation. La régénérer déconnecterait la machine en service.'
                        : 'Voici sa clé d’accès. Copiez-la maintenant, ou téléchargez appareils.json : elle y figure.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="cp-fermer"
                    onClick={() => setSecretCree(null)}
                    aria-label="Masquer la clé d’accès"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="cp-secret-cle">
                  <code>{secretCree.secret}</code>
                  <button
                    type="button"
                    className="cp-bouton-creux"
                    onClick={() => copier(secretCree.secret, 'nouveau')}
                  >
                    {copie === 'nouveau' ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                    {copie === 'nouveau' ? 'Copié' : 'Copier'}
                  </button>
                </div>

                <div className="cp-secret-gestes">
                  <button
                    type="button"
                    className="cp-bouton-creux"
                    onClick={() => copier(blocJson({
                      serial_number: secretCree.serial,
                      secret: secretCree.secret,
                      label: secretCree.label,
                    }), 'bloc-nouveau')}
                  >
                    <FileJson size={13} aria-hidden="true" />
                    {copie === 'bloc-nouveau' ? 'Bloc copié' : 'Copier le bloc JSON'}
                  </button>
                  <button
                    type="button"
                    className="cp-bouton-creux"
                    onClick={() => telechargerAppareilsJson()}
                  >
                    <Download size={13} aria-hidden="true" />
                    Télécharger appareils.json
                  </button>
                </div>
              </div>
            )}

            {vuRegistre}

            <p className="cp-note">
              Une machine en pause garde sa clé : elle reprend dès sa réactivation. La supprimer détruit
              sa clé et l’oblige à être enregistrée de nouveau — les pointages déjà reçus, eux, restent.
            </p>
          </section>
        )}

        {/* ═══ VUE 2 — LE JOURNAL ═══ */}
        {vue === 'journal' && (
          <section
            className="cp-vue"
            id="cp-vue-journal"
            role="tabpanel"
            aria-labelledby="cp-onglet-journal"
          >
            <div className="cp-folio">
              <p className="cp-marque"><strong>En-Check</strong> · Configuration pointeuse</p>
              <p className="cp-folio-droite">Les 25 derniers envois</p>
            </div>

            <header className="cp-vue-tete">
              <div>
                <p className="cp-eyebrow">Ce que les machines ont déposé</p>
                <h2 className="cp-titre-vue">Journal des envois<span>.</span></h2>
              </div>
              <p className="cp-tete-note">
                <Clock size={11} aria-hidden="true" />
                {journal.length > 0 ? `du ${dateHeure(journal[journal.length - 1].recu_le)} au ${dateHeure(journal[0].recu_le)}` : 'aucun envoi'}
              </p>
            </header>

            {vuJournal}

            <div className="cp-depannage">
              <button
                type="button"
                className="cp-depannage-bouton"
                aria-expanded={ouvrirDepannage}
                onClick={() => setOuvrirDepannage((v) => !v)}
              >
                <Info size={13} aria-hidden="true" />
                Dépannage rapide
                <span className="cp-depannage-chevron" aria-hidden="true" data-ouvert={ouvrirDepannage ? 'oui' : 'non'} />
              </button>

              {ouvrirDepannage && (
                <ul className="cp-depannage-liste">
                  <li>
                    <strong>Rien n’apparaît dans le journal</strong> — la machine n’atteint pas le
                    receveur. Vérifiez l’adresse saisie dans <code>Cloud Server Setting</code> (celle du
                    poste qui exécute le receveur), et autorisez ce poste à recevoir des connexions
                    entrantes.
                  </li>
                  <li>
                    <strong>Des pointages reçus, aucun accepté</strong> — consultez la colonne
                    « Numéros non attribués » : ce sont ces numéros qu’il faut rattacher aux employés,
                    depuis la fiche de l’employé, champ « Numéro sur la pointeuse ».
                  </li>
                  <li>
                    <strong>« Jamais connectée » après la configuration</strong> — le numéro de série
                    ne correspond pas. Actualisez, puis comparez le numéro affiché ici avec celui de la
                    machine (<code>Menu → Info</code>).
                  </li>
                  <li>
                    <strong>Un pointage à un horaire décalé</strong> — c’est le fuseau de l’entreprise,
                    et non la machine.
                  </li>
                </ul>
              )}
            </div>
          </section>
        )}

        {/* ═══ VUE 3 — LE POSTE DE POINTAGE ═══ */}
        {vue === 'poste' && (
          <section
            className="cp-vue"
            id="cp-vue-poste"
            role="tabpanel"
            aria-labelledby="cp-onglet-poste"
          >
            <div className="cp-folio">
              <p className="cp-marque"><strong>En-Check</strong> · Configuration pointeuse</p>
              <p className="cp-folio-droite">La tablette de l’entrée</p>
            </div>

            <header className="cp-vue-tete">
              <div>
                <p className="cp-eyebrow">Pas de pointeuse, pas d’installation</p>
                <h2 className="cp-titre-vue">Poste de pointage<span>.</span></h2>
              </div>
              <p className="cp-tete-note">
                <Tablet size={11} aria-hidden="true" />
                un appareil par entrée
              </p>
            </header>

            <div className="cp-poste">
              <div className="cp-cartouche">
                <p className="cp-cartouche-titre">Le code à saisir sur la tablette</p>
                <div className="cp-code">
                  {codeEntreprise ? (
                    <>
                      <code>{codeEntreprise}</code>
                      <button
                        type="button"
                        className="cp-bouton-creux"
                        onClick={() => copier(codeEntreprise, 'code')}
                      >
                        {copie === 'code' ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                        {copie === 'code' ? 'Copié' : 'Copier'}
                      </button>
                    </>
                  ) : (
                    <p className="cp-code-vide">
                      Aucun code d’entreprise n’est renseigné. Il se définit sur la fiche de
                      l’entreprise, et sert à installer un poste.
                    </p>
                  )}
                </div>
                <p className="cp-aide">
                  Ce code ne se saisit qu’une fois par appareil. Il se lit aussi sur la fiche de
                  l’entreprise.
                </p>

                <ol className="cp-etapes">
                  <li>Ouvrez <strong>/poste</strong> sur la tablette de l’entrée.</li>
                  <li>Saisissez le code de l’entreprise : l’appareil s’installe et retient son identifiant.</li>
                  <li>Autorisez la caméra, puis laissez l’écran allumé. Le poste travaille seul.</li>
                </ol>

                <button
                  type="button"
                  className="cp-bouton"
                  onClick={() => navigate('/poste')}
                >
                  <MonitorSmartphone size={14} aria-hidden="true" />
                  Ouvrir le poste
                </button>
              </div>

              <div className="cp-cartouche">
                <p className="cp-cartouche-titre">Cet appareil est-il déjà un poste ?</p>

                {poste ? (
                  <>
                    <p className="cp-sceau" data-ton="ok">Poste installé ici</p>
                    <dl className="cp-poste-fiche">
                      <div>
                        <dt>Entreprise</dt>
                        <dd>{poste.nom || 'Entreprise non nommée'}</dd>
                      </div>
                      <div>
                        <dt>Identifiant du poste</dt>
                        <dd><code>{poste.device_id}</code></dd>
                      </div>
                      <div>
                        <dt>Installé le</dt>
                        <dd>{poste.installe_le ? dateCourte(poste.installe_le) : '—'}</dd>
                      </div>
                      <div>
                        <dt>Écart d’horloge</dt>
                        <dd>
                          {Number(poste.ecart_horloge) > 0
                            ? `${Math.round(Number(poste.ecart_horloge) / 60)} min à corriger`
                            : 'aucun'}
                        </dd>
                      </div>
                    </dl>
                    <div className="cp-poste-gestes">
                      <button type="button" className="cp-bouton" onClick={() => navigate('/poste')}>
                        <MonitorSmartphone size={14} aria-hidden="true" />
                        Ouvrir le poste
                      </button>
                      <button type="button" className="cp-bouton-creux" onClick={detacherAppareil}>
                        Détacher cet appareil
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="cp-aide">
                      Cet appareil n’est pas encore un poste. Installez-le ici si c’est la tablette
                      de l’entrée ; sinon, donnez le code ci-contre à l’appareil qui le sera.
                    </p>
                    <label className="cp-champ cp-champ-large">
                      <span className="cp-etiquette">Code de l’entreprise</span>
                      <input
                        type="text"
                        value={codePoste}
                        onChange={(evenement) => {
                          setCodePoste(evenement.target.value)
                          if (erreurPoste) setErreurPoste('')
                        }}
                        onKeyDown={(evenement) => {
                          if (evenement.key === 'Enter' && !installationPoste) installerCetAppareil()
                        }}
                        placeholder="ex. ENC-229"
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                    {erreurPoste && <p className="cp-erreur" role="alert">{erreurPoste}</p>}
                    <div className="cp-poste-gestes">
                      <button
                        type="button"
                        className="cp-bouton"
                        onClick={installerCetAppareil}
                        disabled={installationPoste || !codePoste.trim()}
                      >
                        <Tablet size={14} aria-hidden="true" />
                        {installationPoste ? 'Installation…' : 'Installer cet appareil'}
                      </button>
                      <button type="button" className="cp-bouton-creux" onClick={() => navigate('/poste')}>
                        Ouvrir le poste
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <p className="cp-note">
              Le poste ne demande ni photo ni empreinte : c’est un poste de bonne foi. Le geste double,
              le pointage hors zone et la sortie manquante remontent dans la cloche, comme pour les
              autres collecteurs. Son identifiant d’appareil vit dans la mémoire de la tablette et ne
              change pas tant qu’on ne la réinstalle pas.
            </p>
          </section>
        )}
      </main>

      <div className="cp-pied">
        <PageCulturalBand pathname="/configuration-pointeuse" placement="bottom" />
      </div>

      {/* ── enregistrer une pointeuse ── */}
      {showAjout && (
        <Fenetre
          eyebrow="Machine à badge"
          titre="Enregistrer une pointeuse"
          labelledBy="cp-fenetre-ajout"
          onClose={() => !enregistrement && setShowAjout(false)}
          pied={(
            <>
              <button
                type="button"
                className="cp-bouton-creux"
                onClick={() => setShowAjout(false)}
                disabled={enregistrement}
              >
                Annuler
              </button>
              <button
                type="button"
                className="cp-bouton"
                onClick={enregistrerAppareil}
                disabled={enregistrement}
              >
                <Plus size={14} aria-hidden="true" />
                {enregistrement ? 'Enregistrement…' : 'Enregistrer et afficher la clé'}
              </button>
            </>
          )}
        >
          <p className="cp-fenetre-texte">
            Le numéro de série est inscrit sur la machine : <code>Menu → Info → Serial Number</code>.
            Il figure aussi dans le journal du receveur dès qu’une machine inconnue s’y présente.
          </p>

          <label className="cp-champ cp-champ-large">
            <span className="cp-etiquette">Numéro de série *</span>
            <input
              type="text"
              value={form.serial}
              onChange={(evenement) => setForm((f) => ({ ...f, serial: evenement.target.value }))}
              placeholder="AANF123456789"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label className="cp-champ cp-champ-large">
            <span className="cp-etiquette">Nom de la pointeuse</span>
            <input
              type="text"
              value={form.label}
              onChange={(evenement) => setForm((f) => ({ ...f, label: evenement.target.value }))}
              placeholder="Pointeuse entrée dépôt"
              autoComplete="off"
            />
          </label>

          <p className="cp-fenetre-aide">
            Un numéro de série déjà rattaché à une <strong>autre</strong> entreprise est refusé : une
            machine ne peut pas servir deux entreprises. Le même numéro, redonné à la même entreprise,
            affiche la clé existante sans la modifier.
          </p>
        </Fenetre>
      )}

      {/* ── supprimer une pointeuse ── */}
      {aSupprimer && (
        <Fenetre
          eyebrow="Machine à badge"
          titre="Retirer cette pointeuse du registre ?"
          labelledBy="cp-fenetre-suppression"
          etroit
          onClose={() => traitement !== aSupprimer.id && setASupprimer(null)}
          pied={(
            <>
              <button
                type="button"
                className="cp-bouton-creux"
                onClick={() => setASupprimer(null)}
                disabled={traitement === aSupprimer.id}
              >
                Annuler
              </button>
              <button
                type="button"
                className="cp-bouton-creux"
                disabled={traitement === aSupprimer.id}
                onClick={() => { const appareil = aSupprimer; setASupprimer(null); basculerActivation(appareil) }}
              >
                <PauseCircle size={14} aria-hidden="true" />
                Mettre en pause plutôt
              </button>
              <button
                type="button"
                className="cp-bouton cp-bouton--danger"
                disabled={traitement === aSupprimer.id}
                onClick={supprimerAppareil}
              >
                <Trash2 size={14} aria-hidden="true" />
                {traitement === aSupprimer.id ? 'Suppression…' : 'Supprimer la machine'}
              </button>
            </>
          )}
        >
          <p className="cp-fenetre-nom">
            {aSupprimer.label || '(sans nom)'}
            <code>{aSupprimer.serial_number}</code>
          </p>
          <ul className="cp-avertissements">
            <li><strong>Sa clé d’accès sera détruite.</strong> La machine ne pourra plus déposer de pointages tant qu’elle n’aura pas été enregistrée de nouveau.</li>
            <li><strong>Les pointages déjà reçus sont conservés.</strong> Rien n’est effacé de l’historique des présences.</li>
            <li>Pour interrompre ses envois sans rien détruire, choisissez <strong>Mettre en pause</strong> : la clé reste valable.</li>
          </ul>
        </Fenetre>
      )}
    </div>
  )
}
