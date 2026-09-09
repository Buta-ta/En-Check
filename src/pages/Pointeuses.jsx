// src/pages/Pointeuses.jsx
// ═══════════════════════════════════════════════════════════════════════════
//  Registre des pointeuses réseau (protocole ADMS)
// ═══════════════════════════════════════════════════════════════════════════
//
//  Cette page remplace toute intervention dans la base de données :
//
//    · enregistrer une machine et obtenir sa clé d'accès ;
//    · télécharger `appareils.json`, le fichier attendu par le receveur ;
//    · suivre l'état de chaque machine (en ligne, dernier contact, volume) ;
//    · lire le journal des envois et les numéros non reconnus ;
//    · mettre une machine en pause, ou la retirer du registre.
//
//  SÉCURITÉ
//  ────────
//  La clé d'accès d'une machine n'est visible que par un administrateur
//  connecté ayant accès à l'entreprise concernée. Le rôle `anon` ne dispose
//  d'aucun droit sur le registre : c'est le secret de la machine, et lui seul,
//  qui autorise un appareil à déposer des pointages.
//
//  PRÉ-REQUIS
//  ──────────
//    · les tables `adms_devices` et `adms_log` doivent exister ;
//    · la fonction `encheck_employes_sans_pin()` doit exister ;
//    · les droits d'écriture du registre doivent être accordés aux
//      administrateurs connectés.
//
//  Si une brique manque, la page se dégrade proprement : elle affiche ce
//  qu'elle peut, et le signale là où cela manque.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Copy, Check, Download, Eye, EyeOff, RefreshCw,
  AlertTriangle, CheckCircle2, Clock, X, Radio, Info,
  Server, PauseCircle, PlayCircle, Trash2, FileJson, Wifi, WifiOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

// Une machine est considérée en ligne si elle s'est manifestée depuis moins de
// dix minutes. Elle interroge le receveur toutes les dix à trente secondes :
// au-delà, elle est éteinte, débranchée, ou mal configurée.
const SEUIL_EN_LIGNE_MIN = 10

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
  return Array.from(octets).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Copie dans le presse-papiers, avec un repli pour les navigateurs plus anciens
// ou les accès en http:// (où `navigator.clipboard` est indisponible).
async function copierTexte(texte) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texte)
      return true
    }
  } catch (_) { /* repli ci-dessous */ }

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
  } catch (_) {
    return false
  }
}

export default function Pointeuses() {
  const navigate = useNavigate()

  const [admin, setAdmin]               = useState(null)
  const [enterprises, setEnterprises]   = useState([])
  const [selectedEntId, setSelectedEntId] = useState(null)

  const [appareils, setAppareils]   = useState([])
  const [journal, setJournal]       = useState([])
  const [entreprise, setEntreprise] = useState(null)
  const [sansPin, setSansPin]       = useState([])

  const [loading, setLoading]       = useState(true)
  const [rafraichir, setRafraichir] = useState(false)
  const [showAjout, setShowAjout]   = useState(false)
  const [form, setForm]             = useState({ serial: '', label: '' })
  const [enregistrement, setEnregistrement] = useState(false)
  const [secretCree, setSecretCree] = useState(null)
  const [reveles, setReveles]       = useState({})
  const [copie, setCopie]           = useState(null)
  const [onglet, setOnglet]         = useState('appareils')
  const [aSupprimer, setASupprimer] = useState(null)   // machine visée par la suppression
  const [traitement, setTraitement] = useState(null)   // identifiant en cours d'opération

  // Session réellement ouverte ? `localStorage` n'en est qu'une copie locale :
  // seule la session Supabase décide de ce que le serveur accepte.
  //   null = vérification en cours · true = ouverte · false = expirée
  const [sessionOk, setSessionOk] = useState(null)

  const estSuperAdmin = admin?.role === 'super_admin'

  // ═══════════════════════════════════════════════════════════
  //  CHARGEMENT
  // ═══════════════════════════════════════════════════════════
  const verifierSession = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession()
      setSessionOk(!!data?.session)
      return !!data?.session
    } catch (_) {
      setSessionOk(false)
      return false
    }
  }, [])

  useEffect(() => {
    verifierSession()

    const brut = localStorage.getItem('admin')
    if (!brut) { navigate('/login'); return }

    let parsed
    try { parsed = JSON.parse(brut) } catch (_) { navigate('/login'); return }

    setAdmin(parsed)

    if (parsed.role === 'super_admin') {
      chargerEntreprises()
    } else {
      const entId = parsed.selectedEnterprise?.id || parsed.enterprise_id
      setSelectedEntId(entId)
    }
  }, [navigate, verifierSession])

  const chargerEntreprises = async () => {
    const { data, error } = await supabase
      .from('enterprises')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')

    if (error) {
      toast.error('Impossible de charger la liste des entreprises.')
      setLoading(false)
      return
    }
    setEnterprises(data || [])
    if (data && data.length > 0) setSelectedEntId(data[0].id)
    else setLoading(false)
  }

  const chargerTout = useCallback(async (entId) => {
    if (!entId) return
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
      console.warn('[Pointeuses] registre indisponible :', resApp.error.message)
      toast.error("Le registre des pointeuses n'est pas disponible pour le moment.")
      setAppareils([])
    } else {
      setAppareils(resApp.data || [])
    }

    if (resLog.error) {
      console.warn('[Pointeuses] journal indisponible :', resLog.error.message)
      setJournal([])
    } else {
      setJournal(resLog.data || [])
    }

    if (resPin.error) {
      console.warn('[Pointeuses] liste des numéros :', resPin.error.message)
      setSansPin([])
    } else {
      setSansPin(Array.isArray(resPin.data) ? resPin.data : [])
    }

    setLoading(false)
    setRafraichir(false)
  }, [])

  useEffect(() => {
    if (selectedEntId) chargerTout(selectedEntId)
  }, [selectedEntId, chargerTout])

  // ═══════════════════════════════════════════════════════════
  //  ENREGISTREMENT D'UNE MACHINE
  // ═══════════════════════════════════════════════════════════

  // Voie directe : écriture dans le registre, avec une clé fabriquée ici.
  // Utilisée en secours si la fonction serveur n'est pas disponible — le
  // résultat est identique pour l'installateur.
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
        l => normaliserCle(l.serial_number) === normaliserCle(serial),
      )

      if (cible && cible.enterprise_id !== selectedEntId) {
        toast.error(
          "Ce numéro de série est déjà rattaché à une autre entreprise. "
          + 'Une machine ne peut pas servir deux entreprises.',
          { duration: 9000 },
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
      toast.error(
        "Votre compte n'est pas autorisé à modifier le registre des pointeuses. "
        + "Demandez à un administrateur l'accès à cette entreprise.",
        { duration: 10000 },
      )
      return
    }

    console.error('[Pointeuses] enregistrement :', error)
    toast.error("L'enregistrement a échoué. Réessayez dans un instant.")
  }

  const enregistrerAppareil = async () => {
    const serial = form.serial.trim()
    if (!serial) { toast.error('Le numéro de série est obligatoire.'); return }

    const ouverte = await verifierSession()
    if (!ouverte) {
      toast.error("Votre session a expiré : reconnectez-vous pour enregistrer une pointeuse.",
                  { duration: 9000 })
      return
    }

    setEnregistrement(true)
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
      console.warn('[Pointeuses] fonction serveur indisponible, écriture directe :', error.message)
      await creerDirectement(serial)
      return
    }

    if (error) {
      const message = String(error.message || '')
      const { data: { session } } = await supabase.auth.getSession()
      setSessionOk(!!session)

      if (!session) {
        toast.error('Votre session a expiré : reconnectez-vous pour continuer.',
                    { duration: 9000 })
        return
      }
      if (error.code === 'PGRST202' || error.status === 404 || /schema cache/i.test(message)) {
        console.error('[Pointeuses] service indisponible (A-404) :', message)
        toast.error(
          'Enregistrement momentanément indisponible (A-404). Réessayez dans un instant ; '
          + 'si cela persiste, signalez ce code à votre administrateur.',
          { duration: 12000 },
        )
        return
      }
      console.error('[Pointeuses] enregistrement :', error)
      toast.error("L'enregistrement a échoué. Réessayez dans un instant.")
      return
    }

    if (data?.ok === false) {
      const motifs = {
        non_connecte:              'Votre session a expiré : reconnectez-vous.',
        acces_refuse:              "Vous n'avez pas accès à cette entreprise.",
        numero_de_serie_manquant:  'Le numéro de série est obligatoire.',
        numero_de_serie_deja_pris: 'Ce numéro de série est déjà rattaché à une autre entreprise.',
      }
      toast.error(motifs[data.reason] || "L'enregistrement a été refusé.")
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
  //  MISE EN PAUSE · RÉACTIVATION · SUPPRESSION
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
      console.error('[Pointeuses] mise en pause :', error)
      toast.error("L'opération a échoué. Réessayez dans un instant.")
      return
    }

    toast.success(
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
      console.error('[Pointeuses] suppression :', error)
      toast.error("La suppression a échoué. Réessayez dans un instant.")
      return
    }

    toast.success(
      `« ${aSupprimer.label || aSupprimer.serial_number} » a été retirée du registre.`,
    )
    setASupprimer(null)
    chargerTout(selectedEntId)
  }

  // ═══════════════════════════════════════════════════════════
  //  OUTILS
  // ═══════════════════════════════════════════════════════════

  const copier = async (texte, cle) => {
    const ok = await copierTexte(texte)
    if (ok) {
      setCopie(cle)
      toast.success('Copié')
      setTimeout(() => setCopie(c => (c === cle ? null : c)), 2000)
    } else {
      toast.error('Copie impossible : sélectionnez le texte à la main.')
    }
  }

  const blocJson = (a) => JSON.stringify(
    { serial: a.serial_number, secret: a.secret, label: a.label || '' },
    null, 2,
  )

  const telechargerAppareilsJson = (liste) => {
    const actifs = liste.filter(a => a.is_active !== false)
    if (actifs.length === 0) {
      toast.error('Aucune machine active à exporter.')
      return
    }
    const contenu = JSON.stringify(
      actifs.map(a => ({
        serial: a.serial_number,
        secret: a.secret,
        label: a.label || '',
      })),
      null, 2,
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
    toast.success('appareils.json téléchargé : déposez-le à côté du receveur.')
  }

  const etatAppareil = (a) => {
    if (a.is_active === false) {
      return { texte: 'En pause', couleur: '#6B7280', icone: PauseCircle }
    }
    if (!a.last_seen_at) {
      return { texte: 'Jamais connectée', couleur: '#F59E0B', icone: WifiOff }
    }
    const min = (Date.now() - new Date(a.last_seen_at).getTime()) / 60000
    if (min < SEUIL_EN_LIGNE_MIN) return { texte: 'En ligne', couleur: '#10B981', icone: Wifi }
    return { texte: 'Hors ligne — ' + depuis(a.last_seen_at), couleur: '#EF4444', icone: WifiOff }
  }

  const fuseauRenseigne = !!entreprise?.timezone

  // ═══════════════════════════════════════════════════════════
  //  RENDU
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <PageHeader
        title="Pointeuses"
        subtitle="Les machines à badge qui déposent leurs pointages toute seules"
      />

      <div style={S.conteneur}>

        {estSuperAdmin && enterprises.length > 0 && (
          <div style={S.carte}>
            <div style={{ ...S.ligne, gap: 12, flexWrap: 'wrap' }}>
              <span style={S.label}>Entreprise</span>
              <select
                style={S.select}
                value={selectedEntId || ''}
                onChange={(e) => setSelectedEntId(e.target.value)}
              >
                {enterprises.map(e => (
                  <option key={e.id} value={e.id}>{e.name}{e.code ? ` (${e.code})` : ''}</option>
                ))}
              </select>
              <button
                style={S.btnFantome}
                onClick={() => { setRafraichir(true); chargerTout(selectedEntId) }}
                disabled={rafraichir}
              >
                <RefreshCw size={16} className={rafraichir ? 'spin' : ''} />
                <span>Rafraîchir</span>
              </button>
            </div>
          </div>
        )}

        {sessionOk === false && (
          <div style={S.alerte}>
            <AlertTriangle size={22} color="#B91C1C" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#991B1B', marginBottom: 4 }}>
                Votre session a expiré
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.75, color: '#7F1D1D' }}>
                Reconnectez-vous pour enregistrer une machine ou modifier le registre.
                Les informations affichées ci-dessous peuvent être incomplètes.
              </div>
              <button
                style={{ ...S.btnPrimaire, marginTop: 12, background: '#DC2626' }}
                onClick={() => navigate('/login')}
              >
                Se reconnecter
              </button>
            </div>
          </div>
        )}

        <div style={S.bandeau}>
          <Info size={20} color="#6366F1" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              Quatre gestes, et la machine est en service.
            </div>
            <div style={S.bandeauTexte}>
              <strong>①</strong> Enregistrez la pointeuse : son numéro de série se lit sur la machine,
              et sa clé d'accès s'affiche aussitôt.
              <br />
              <strong>②</strong> Téléchargez <em>appareils.json</em> et déposez-le à côté du receveur.
              <br />
              <strong>③</strong> Démarrez le receveur sur le poste qui restera allumé.
              <br />
              <strong>④</strong> Sur la machine : <code style={S.code}>Menu → Comm → Cloud Server Setting</code>,
              activez-la et saisissez l'adresse de ce poste.
            </div>
          </div>
        </div>

        <div style={S.grilleSante}>
          <div style={{ ...S.carteSante, borderLeftColor: fuseauRenseigne ? '#10B981' : '#EF4444' }}>
            <Clock size={18} color={fuseauRenseigne ? '#10B981' : '#EF4444'} />
            <div>
              <div style={S.santeTitre}>Fuseau horaire de l'entreprise</div>
              {fuseauRenseigne ? (
                <div style={S.santeValeur}>{entreprise.timezone}</div>
              ) : (
                <div style={{ ...S.santeValeur, color: '#EF4444' }}>
                  À renseigner — <strong>les pointages seront refusés</strong>
                  <div style={S.santeNote}>
                    Sans fuseau, l'heure des pointages ne peut pas être interprétée :
                    les envois de cette entreprise sont écartés.
                    Renseignez-le depuis la page <strong>Entreprises</strong>.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ ...S.carteSante, borderLeftColor: appareils.length > 0 ? '#10B981' : '#F59E0B' }}>
            <Server size={18} color={appareils.length > 0 ? '#10B981' : '#F59E0B'} />
            <div>
              <div style={S.santeTitre}>Pointeuses enregistrées</div>
              <div style={S.santeValeur}>
                {appareils.length === 0
                  ? 'Aucune pour le moment'
                  : `${appareils.length} machine${appareils.length > 1 ? 's' : ''}`}
              </div>
            </div>
          </div>

          <div style={{ ...S.carteSante, borderLeftColor: sansPin.length > 0 ? '#F59E0B' : '#10B981' }}>
            {sansPin.length > 0 ? <AlertTriangle size={18} color="#F59E0B" /> : <CheckCircle2 size={18} color="#10B981" />}
            <div>
              <div style={S.santeTitre}>Employés sans numéro de machine</div>
              <div style={S.santeValeur}>
                {sansPin.length === 0
                  ? 'Tous les employés ont leur numéro'
                  : `${sansPin.length} employé${sansPin.length > 1 ? 's' : ''}`}
              </div>
              {sansPin.length > 0 && (
                <div style={S.santeNote}>
                  Une pointeuse envoie des numéros (1, 2, 3…), pas des matricules.
                  Un numéro non attribué est signalé dans le journal et{' '}
                  <strong>ignoré</strong> : le pointage n'est rattaché à personne.
                  <br />
                  Attribuez-les depuis la page <strong>Employés</strong> : ouvrez la fiche
                  de l'employé, champ « Numéro sur la pointeuse ».
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ ...S.ligne, gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <button style={S.btnPrimaire} onClick={() => setShowAjout(true)}>
            <Plus size={18} />
            <span>Enregistrer une pointeuse</span>
          </button>
          <button
            style={S.btnSecondaire}
            onClick={() => telechargerAppareilsJson(appareils)}
            disabled={appareils.length === 0}
          >
            <Download size={18} />
            <span>Télécharger appareils.json</span>
          </button>
        </div>

        {secretCree && (
          <div style={S.carteSecret}>
            <div style={{ ...S.ligne, justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ ...S.ligne, gap: 10 }}>
                <CheckCircle2 size={20} color="#10B981" />
                <div>
                  <div style={{ fontWeight: 800, color: '#065F46' }}>
                    {secretCree.dejaPresente
                      ? `« ${secretCree.label || secretCree.serial} » était déjà enregistrée : voici sa clé d'accès`
                      : `« ${secretCree.label || secretCree.serial} » est enregistrée`}
                  </div>
                  <div style={{ fontSize: 13, color: '#047857', marginTop: 2 }}>
                    {secretCree.dejaPresente
                      ? "Rien n'a été modifié : c'est la même clé qu'à la première installation. "
                        + 'La régénérer déconnecterait la machine en service.'
                      : "Voici sa clé d'accès. Copiez-la maintenant, ou téléchargez appareils.json : elle y figure."}
                  </div>
                </div>
              </div>
              <button style={S.btnFermer} onClick={() => setSecretCree(null)} title="Fermer">
                <X size={18} />
              </button>
            </div>

            <div style={S.secretBoite}>
              <code style={S.secretTexte}>{secretCree.secret}</code>
              <button style={S.btnCopier} onClick={() => copier(secretCree.secret, 'nouveau')}>
                {copie === 'nouveau' ? <Check size={16} /> : <Copy size={16} />}
                <span>{copie === 'nouveau' ? 'Copié' : 'Copier'}</span>
              </button>
            </div>

            <div style={{ ...S.ligne, gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                style={S.btnSecondaire}
                onClick={() => copier(blocJson({
                  serial_number: secretCree.serial,
                  secret: secretCree.secret,
                  label: secretCree.label,
                }), 'bloc-nouveau')}
              >
                <FileJson size={16} />
                <span>{copie === 'bloc-nouveau' ? 'Bloc copié' : 'Copier le bloc JSON'}</span>
              </button>
              <button style={S.btnSecondaire} onClick={() => telechargerAppareilsJson(appareils)}>
                <Download size={16} />
                <span>Télécharger appareils.json</span>
              </button>
            </div>
          </div>
        )}

        <div style={S.onglets}>
          <button
            style={{ ...S.onglet, ...(onglet === 'appareils' ? S.ongletActif : {}) }}
            onClick={() => setOnglet('appareils')}
          >
            <Server size={16} />
            <span>Pointeuses ({appareils.length})</span>
          </button>
          <button
            style={{ ...S.onglet, ...(onglet === 'journal' ? S.ongletActif : {}) }}
            onClick={() => setOnglet('journal')}
          >
            <Radio size={16} />
            <span>Journal des envois ({journal.length})</span>
          </button>
          <button
            style={{ ...S.btnFantome, marginLeft: 'auto' }}
            onClick={() => { setRafraichir(true); chargerTout(selectedEntId) }}
          >
            <RefreshCw size={16} className={rafraichir ? 'spin' : ''} />
            <span>Actualiser</span>
          </button>
        </div>

        {loading ? (
          <div style={S.vide}>Chargement…</div>
        ) : onglet === 'appareils' ? (

          appareils.length === 0 ? (
            <div style={S.vide}>
              <Server size={40} color="#D1D5DB" />
              <div style={{ fontWeight: 700, marginTop: 12 }}>Aucune pointeuse enregistrée</div>
              <div style={{ fontSize: 14, color: '#6B7280', marginTop: 6, maxWidth: 520 }}>
                Commencez par <strong>Enregistrer une pointeuse</strong>. Le numéro de série
                est inscrit sur la machine : <code style={S.code}>Menu → Info → Serial Number</code>.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {appareils.map(a => {
                const etat = etatAppareil(a)
                const Icone = etat.icone
                const visible = !!reveles[a.id]
                const occupe = traitement === a.id
                const enPause = a.is_active === false

                return (
                  <div key={a.id} style={{ ...S.carte, borderLeft: `4px solid ${etat.couleur}` }}>
                    <div style={{ ...S.ligne, justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ ...S.ligne, gap: 12 }}>
                        <Icone size={20} color={etat.couleur} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>
                            {a.label || '(sans nom)'}
                          </div>
                          <div style={{ fontSize: 13, color: '#6B7280', fontFamily: 'ui-monospace, monospace' }}>
                            {a.serial_number}
                          </div>
                        </div>
                      </div>
                      <span style={{ ...S.badge, background: etat.couleur + '22', color: etat.couleur }}>
                        {etat.texte}
                      </span>
                    </div>

                    <div style={S.statsAppareil}>
                      <div>
                        <div style={S.statLabel}>Dernier contact</div>
                        <div style={S.statValeur}>{depuis(a.last_seen_at) || 'jamais'}</div>
                      </div>
                      <div>
                        <div style={S.statLabel}>Dernier pointage</div>
                        <div style={S.statValeur}>{depuis(a.last_punch_at) || 'aucun'}</div>
                      </div>
                      <div>
                        <div style={S.statLabel}>Pointages reçus</div>
                        <div style={S.statValeur}>{a.punch_count || 0}</div>
                      </div>
                      <div>
                        <div style={S.statLabel}>Enregistrée le</div>
                        <div style={S.statValeur}>{dateHeure(a.created_at)}</div>
                      </div>
                    </div>

                    <div style={{ ...S.ligne, gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                      <div style={S.secretMini}>
                        <code style={{ ...S.secretTexte, fontSize: 12 }}>
                          {visible ? a.secret : '•'.repeat(Math.min((a.secret || '').length, 32))}
                        </code>
                        <button
                          style={S.btnIcone}
                          title={visible ? "Masquer la clé d'accès" : "Afficher la clé d'accès"}
                          onClick={() => setReveles(r => ({ ...r, [a.id]: !visible }))}
                        >
                          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <button style={S.btnMini} onClick={() => copier(a.secret, 'secret-' + a.id)}>
                        {copie === 'secret-' + a.id ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copie === 'secret-' + a.id ? 'Copié' : "Copier la clé"}</span>
                      </button>
                      <button style={S.btnMini} onClick={() => copier(blocJson(a), 'bloc-' + a.id)}>
                        <FileJson size={14} />
                        <span>{copie === 'bloc-' + a.id ? 'Bloc copié' : 'Copier le bloc JSON'}</span>
                      </button>

                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          style={S.btnMini}
                          disabled={occupe}
                          onClick={() => basculerActivation(a)}
                        >
                          {enPause
                            ? <><PlayCircle size={14} /><span>Réactiver</span></>
                            : <><PauseCircle size={14} /><span>Mettre en pause</span></>}
                        </button>
                        <button
                          style={{ ...S.btnMini, color: '#B91C1C', borderColor: '#FECACA', background: '#FEF2F2' }}
                          disabled={occupe}
                          onClick={() => setASupprimer(a)}
                        >
                          <Trash2 size={14} />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )

        ) : (

          journal.length === 0 ? (
            <div style={S.vide}>
              <Radio size={40} color="#D1D5DB" />
              <div style={{ fontWeight: 700, marginTop: 12 }}>Aucun envoi pour le moment</div>
              <div style={{ fontSize: 14, color: '#6B7280', marginTop: 6, maxWidth: 520 }}>
                Ce journal se remplit à chaque fois qu'une machine s'adresse au receveur :
                sa présence, ses pointages, et ce qui a été écarté.
              </div>
            </div>
          ) : (
            <div style={S.carte}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Quand</th>
                    <th style={S.th}>Pointeuse</th>
                    <th style={S.th}>Type</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Reçues</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Acceptées</th>
                    <th style={S.th}>Numéros non attribués</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.map(l => {
                    const inconnus = l.pins_inconnus && typeof l.pins_inconnus === 'object'
                      ? Object.keys(l.pins_inconnus)
                      : []
                    return (
                      <tr key={l.id}>
                        <td style={S.td}>{dateHeure(l.recu_le)}</td>
                        <td style={{ ...S.td, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                          {l.serial_number}
                        </td>
                        <td style={S.td}>
                          {l.payload_kind === 'ATTLOG'
                            ? <span style={{ ...S.badge, background: '#6366F122', color: '#4F46E5' }}>pointages</span>
                            : <span style={{ ...S.badge, background: '#6B728022', color: '#4B5563' }}>
                                {l.kind === 'getrequest' ? 'présence' : (l.payload_kind || l.kind)}
                              </span>}
                        </td>
                        <td style={{ ...S.td, textAlign: 'right' }}>{l.lignes ?? '—'}</td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: (l.acceptees || 0) > 0 ? '#10B981' : '#9CA3AF' }}>
                          {l.acceptees ?? '—'}
                        </td>
                        <td style={S.td}>
                          {inconnus.length === 0 ? (
                            <span style={{ color: '#9CA3AF' }}>—</span>
                          ) : (
                            <span style={{ ...S.badge, background: '#F59E0B22', color: '#B45309' }}>
                              {inconnus.map(p => `${p} (×${l.pins_inconnus[p]})`).join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={S.aideJournal}>
                <strong>Lecture du tableau.</strong> « Présence » : la machine signale qu'elle est
                en service (toutes les dix à trente secondes). « Pointages » : elle dépose des
                passages. Des <strong>numéros non attribués</strong> signifient que ces numéros
                ne correspondent à aucun employé : aucun pointage n'a pu être rattaché.
              </div>
            </div>
          )
        )}

        <div style={{ ...S.carte, marginTop: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>
            Dépannage rapide
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.9, color: '#374151' }}>
            <li>
              <strong>Rien n'apparaît dans le journal</strong> — la machine n'atteint pas le
              receveur. Vérifiez l'adresse saisie dans <code style={S.code}>Cloud Server Setting</code>
              {' '}(celle du poste qui exécute le receveur), et autorisez ce poste à recevoir
              des connexions entrantes.
            </li>
            <li>
              <strong>Des pointages reçus, aucun accepté</strong> — consultez la colonne
              « Numéros non attribués » : ce sont ces numéros qu'il faut rattacher aux employés.
            </li>
            <li>
              <strong>« Jamais connectée » après la configuration</strong> — le numéro de série
              ne correspond pas. Cliquez sur <em>Actualiser</em>, puis comparez le numéro affiché
              ici avec celui de la machine (<code style={S.code}>Menu → Info</code>).
            </li>
            <li>
              <strong>Un pointage à un horaire décalé</strong> — c'est le fuseau de l'entreprise
              (première carte ci-dessus), et non la machine.
            </li>
          </ul>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 10 }}>
            Pour une assistance complète, contactez votre administrateur En-Check.
          </div>
        </div>
      </div>

      {/* ═══ MODALE — ENREGISTRER UNE POINTEUSE ═══ */}
      {showAjout && (
        <div style={S.voile} onClick={() => !enregistrement && setShowAjout(false)}>
          <div style={S.modale} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...S.ligne, justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Enregistrer une pointeuse</div>
              <button style={S.btnFermer} onClick={() => setShowAjout(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={S.aide}>
              Le numéro de série est inscrit sur la machine :
              <code style={S.code}>Menu → Info → Serial Number</code>.
              Il figure aussi dans le journal du receveur dès qu'une machine inconnue
              s'y présente.
            </div>

            <label style={S.label}>Numéro de série *</label>
            <input
              style={S.input}
              value={form.serial}
              placeholder="AANF123456789"
              onChange={(e) => setForm(f => ({ ...f, serial: e.target.value }))}
              autoFocus
            />

            <label style={S.label}>Nom de la pointeuse</label>
            <input
              style={S.input}
              value={form.label}
              placeholder="Pointeuse entrée dépôt"
              onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
            />

            <div style={{ ...S.ligne, gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                style={S.btnFantome}
                onClick={() => setShowAjout(false)}
                disabled={enregistrement}
              >
                Annuler
              </button>
              <button style={S.btnPrimaire} onClick={enregistrerAppareil} disabled={enregistrement}>
                {enregistrement ? 'Enregistrement…' : "Enregistrer et afficher la clé d'accès"}
              </button>
            </div>

            <div style={{ ...S.aide, marginTop: 14, marginBottom: 0 }}>
              Un numéro de série déjà rattaché à une <strong>autre</strong> entreprise est refusé :
              une machine ne peut pas servir deux entreprises. Le même numéro, redonné à la même
              entreprise, affiche la clé existante sans la modifier.
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODALE — SUPPRIMER UNE POINTEUSE ═══ */}
      {aSupprimer && (
        <div style={S.voile} onClick={() => traitement !== aSupprimer.id && setASupprimer(null)}>
          <div style={S.modale} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...S.ligne, gap: 12, marginBottom: 10 }}>
              <AlertTriangle size={22} color="#DC2626" />
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                Retirer cette pointeuse du registre ?
              </div>
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {aSupprimer.label || '(sans nom)'}
              <span style={{ ...S.code, marginLeft: 8 }}>{aSupprimer.serial_number}</span>
            </div>

            <div style={S.avertissement}>
              <div><strong>Sa clé d'accès sera détruite.</strong> La machine ne pourra plus
                déposer de pointages tant qu'elle n'aura pas été enregistrée de nouveau.</div>
              <div style={{ marginTop: 8 }}>
                <strong>Les pointages déjà reçus sont conservés.</strong> Rien n'est effacé
                de l'historique des présences.
              </div>
              <div style={{ marginTop: 8 }}>
                Si vous souhaitez seulement interrompre ses envois, utilisez
                <strong> Mettre en pause</strong> : l'opération est réversible, et la clé
                d'accès reste valable.
              </div>
            </div>

            <div style={{ ...S.ligne, gap: 10, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                style={S.btnFantome}
                onClick={() => setASupprimer(null)}
                disabled={traitement === aSupprimer.id}
              >
                Annuler
              </button>
              <button
                style={S.btnSecondaire}
                disabled={traitement === aSupprimer.id}
                onClick={() => { const a = aSupprimer; setASupprimer(null); basculerActivation(a) }}
              >
                <PauseCircle size={16} />
                <span>Mettre en pause plutôt</span>
              </button>
              <button
                style={{ ...S.btnPrimaire, background: '#DC2626' }}
                disabled={traitement === aSupprimer.id}
                onClick={supprimerAppareil}
              >
                <Trash2 size={16} />
                <span>{traitement === aSupprimer.id ? 'Suppression…' : 'Supprimer définitivement'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════
const CSS = `
  @keyframes encheck-spin { to { transform: rotate(360deg); } }
  .spin { animation: encheck-spin 1s linear infinite; }
`

const S = {
  page: {
    minHeight: '100vh',
    background: '#F9FAFB',
    paddingBottom: 60,
  },
  conteneur: {
    maxWidth: 1080,
    margin: '0 auto',
    padding: '0 16px',
  },
  carte: {
    background: '#FFF',
    borderRadius: 14,
    padding: 18,
    boxShadow: '0 1px 3px rgba(0,0,0,.08)',
    marginBottom: 14,
  },
  ligne: {
    display: 'flex',
    alignItems: 'center',
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 700,
    color: '#374151',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '11px 13px',
    borderRadius: 10,
    border: '1px solid #D1D5DB',
    fontSize: 15,
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    boxSizing: 'border-box',
    outline: 'none',
  },
  select: {
    padding: '9px 12px',
    borderRadius: 10,
    border: '1px solid #D1D5DB',
    fontSize: 15,
    background: '#FFF',
    minWidth: 240,
  },
  code: {
    background: '#F3F4F6',
    padding: '1px 6px',
    borderRadius: 5,
    fontSize: '0.92em',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  },
  bandeau: {
    display: 'flex',
    gap: 12,
    background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)',
    border: '1px solid #C7D2FE',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  bandeauTexte: {
    fontSize: 14,
    lineHeight: 1.9,
    color: '#3730A3',
  },
  alerte: {
    display: 'flex',
    gap: 12,
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  grilleSante: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
    marginBottom: 18,
  },
  carteSante: {
    display: 'flex',
    gap: 12,
    background: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderLeft: '4px solid #10B981',
    boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  },
  santeTitre: { fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' },
  santeValeur: { fontSize: 16, fontWeight: 800, color: '#111827', marginTop: 3 },
  santeNote: { fontSize: 12.5, color: '#6B7280', marginTop: 6, lineHeight: 1.7 },
  btnPrimaire: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#6366F1',
    color: '#FFF',
    border: 'none',
    borderRadius: 10,
    padding: '11px 18px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnSecondaire: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#FFF',
    color: '#374151',
    border: '1px solid #D1D5DB',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnFantome: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    color: '#4B5563',
    border: '1px solid #E5E7EB',
    borderRadius: 10,
    padding: '8px 14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnMini: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#4B5563',
    cursor: 'pointer',
  },
  btnIcone: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#6B7280',
    display: 'flex',
    alignItems: 'center',
    padding: 4,
  },
  btnCopier: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#10B981',
    color: '#FFF',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnFermer: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#6B7280',
    padding: 4,
    display: 'flex',
  },
  carteSecret: {
    background: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)',
    border: '1px solid #A7F3D0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
  },
  secretBoite: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#FFF',
    border: '1px solid #A7F3D0',
    borderRadius: 10,
    padding: '12px 14px',
    marginTop: 14,
    flexWrap: 'wrap',
  },
  secretMini: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    padding: '6px 10px',
    minWidth: 200,
  },
  secretTexte: {
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    fontSize: 13,
    wordBreak: 'break-all',
    flex: 1,
    color: '#374151',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  statsAppareil: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid #F3F4F6',
  },
  statLabel: { fontSize: 11.5, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' },
  statValeur: { fontSize: 14, fontWeight: 700, color: '#374151', marginTop: 2 },
  onglets: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  onglet: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 10,
    padding: '9px 15px',
    fontSize: 14,
    fontWeight: 700,
    color: '#6B7280',
    cursor: 'pointer',
  },
  ongletActif: {
    background: '#FFF',
    border: '1px solid #E5E7EB',
    color: '#111827',
    boxShadow: '0 1px 2px rgba(0,0,0,.06)',
  },
  vide: {
    background: '#FFF',
    borderRadius: 14,
    padding: '46px 24px',
    textAlign: 'center',
    color: '#374151',
    boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: {
    textAlign: 'left',
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    color: '#9CA3AF',
    padding: '8px 10px',
    borderBottom: '1px solid #F3F4F6',
  },
  td: { padding: '10px', borderBottom: '1px solid #F9FAFB', color: '#374151', verticalAlign: 'top' },
  aide: {
    background: '#F9FAFB',
    border: '1px solid #F3F4F6',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.8,
    color: '#4B5563',
    marginTop: 14,
  },
  avertissement: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    padding: 14,
    fontSize: 13.5,
    lineHeight: 1.7,
    color: '#7F1D1D',
  },
  aideJournal: {
    marginTop: 14,
    paddingTop: 12,
    borderTop: '1px solid #F3F4F6',
    fontSize: 13,
    lineHeight: 1.8,
    color: '#6B7280',
  },
  voile: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17,24,39,.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 1000,
  },
  modale: {
    background: '#FFF',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 560,
    boxShadow: '0 20px 40px rgba(0,0,0,.2)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
}
