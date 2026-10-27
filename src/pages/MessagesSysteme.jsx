// ═══════════════════════════════════════════════════════════
// MESSAGES SYSTÈME — les annonces, les push, les courriels
//
// Deux pages tenaient la même promesse sans se parler : « Messages
// système » publiait des annonces affichées dans le tableau de bord,
// « Notifications push » envoyait des alertes aux téléphones. Elles
// font maintenant une page :
//
//   · Annonces — ce qui s’affiche sur les écrans, dans sa fenêtre
//     de dates ;
//   · Notifications push — ce qui part vers les téléphones, avec
//     l’historique des envois, les échecs et les relances ;
//   · E-mails — le contrôle des courriels d’alerte, déjà en place.
//
// Le dessin est la toile de korhogo, comme Entreprises, Analytics du
// site et Configuration pointeuse : mur de fumée, cartouches d’écru,
// lisière de chevrons. Aucun envoi ne part sans dire qui il touche.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Bell, CalendarClock, Check, CheckCircle2, Download, Info,
  Mail, Megaphone, Moon, RefreshCw, Send, Shield, Sun, Target, Trash2, Volume2, VolumeX,
  Wrench, X, XCircle, Zap,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import PageCulturalBand from '../components/PageCulturalBand'
import RaccourcisPages from '../components/RaccourcisPages'
import EmailDeliveryMonitor from '../components/EmailDeliveryMonitor'
import { KorhogoBlasonNuitSvg } from '../components/KorhogoSvg'
import { useTheme } from '../contexts/ThemeContext'
import {
  CIBLES, CIBLES_ENVOI, GRAVITES, LIBELLE_ETAT, MOT_CONFIRMATION, PERIODES, PRIORITES,
  TYPES_ANNONCE, compterAnnonces, confirmationValide, construireCSV,
  etatAnnonce, filtrerEnvois, graviteDe, libelleCible, libelleCibleLog,
  libelleGravite, libellePriorite, libelleType, nomPersonne, plageAnnonce,
  resumeCourriels, resumeDestinataires, resumeEnvois, tempsRelatif, trierAnnonces,
} from '../lib/messagesSysteme'
import './MessagesSysteme.css'

const VUES = [
  { cle: 'annonces', libelle: 'Annonces', icone: Megaphone },
  { cle: 'push', libelle: 'Notifications push', icone: Bell },
  { cle: 'emails', libelle: 'E-mails', icone: Mail },
]

const ICONE_TYPE = { info: Info, maintenance: Wrench, mise_a_jour: Zap }

const FORM_VIDE = {
  type: 'info',
  priorite: 'normale',
  cible: 'tous',
  date_debut: '',
  date_fin: '',
  titre: '',
  message: '',
}

const ENVOI_VIDE = {
  cible: 'all',
  entreprise: '',
  personne: '',
  gravite: 'info',
  titre: '',
  message: '',
  insistant: false,
}

const versIso = (valeur) => {
  if (!valeur) return null
  const date = new Date(valeur)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

// ── les petits morceaux ────────────────────────────────────

function Chargement({ texte = 'Lecture des messages…', note = 'Les annonces et les envois arrivent.' }) {
  return (
    <div className="ms-charge" role="status" aria-live="polite">
      <div className="ms-charge-chevrons" aria-hidden="true">
        <span /><span /><span />
      </div>
      <p className="ms-charge-texte">{texte}</p>
      <p className="ms-charge-note">{note}</p>
    </div>
  )
}

function Fenetre({ eyebrow, titre, labelledBy, surFermer, pied, children }) {
  const panneau = useRef(null)

  useEffect(() => {
    const surTouche = (evenement) => { if (evenement.key === 'Escape') surFermer() }
    window.addEventListener('keydown', surTouche)
    const ancien = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', surTouche)
      document.body.style.overflow = ancien
    }
  }, [surFermer])

  useEffect(() => {
    const premier = panneau.current?.querySelector('button, input, select, textarea, [tabindex]')
    if (premier) premier.focus({ preventScroll: true })
  }, [])

  return (
    <div
      className="ms-voile"
      onMouseDown={(evenement) => { if (evenement.target === evenement.currentTarget) surFermer() }}
    >
      <div className="ms-fenetre" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panneau}>
        <header className="ms-fenetre-tete">
          <div>
            {eyebrow && <p className="ms-eyebrow">{eyebrow}</p>}
            <h2 className="ms-fenetre-titre" id={labelledBy}>{titre}</h2>
          </div>
          <button type="button" className="ms-fenetre-fermer" onClick={surFermer} aria-label="Fermer">
            <X size={15} />
          </button>
        </header>
        <div className="ms-fenetre-corps">{children}</div>
        {pied && <footer className="ms-fenetre-pied">{pied}</footer>}
      </div>
    </div>
  )
}

function Etiquette({ ton = 'neutre', icone: Icone, children }) {
  return (
    <span className="ms-etiquette" data-ton={ton}>
      {Icone && <Icone size={11} aria-hidden="true" />}
      {children}
    </span>
  )
}

function Interrupteur({ actif, surClic, libelle }) {
  return (
    <button
      type="button"
      className="ms-interrupteur"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      data-actif={actif ? 'oui' : 'non'}
      onClick={surClic}
    >
      <span className="ms-interrupteur-piste" aria-hidden="true"><i /></span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// LA PAGE
// ═══════════════════════════════════════════════════════════

export default function MessagesSysteme() {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()
  const [parametres, setParametres] = useSearchParams()

  const [admin, setAdmin] = useState(null)
  const [avis, setAvis] = useState(null)
  const [vue, setVue] = useState(() => {
    const demandee = parametres.get('vue')
    return VUES.some((item) => item.cle === demandee) ? demandee : 'annonces'
  })
  const [periode, setPeriode] = useState(7)

  // ── les annonces ─────────────────────────────────────────
  const [annonces, setAnnonces] = useState([])
  const [chargeAnnonces, setChargeAnnonces] = useState(true)
  const [form, setForm] = useState(FORM_VIDE)
  const [publication, setPublication] = useState(false)

  // ── les envois ───────────────────────────────────────────
  const [envois, setEnvois] = useState([])
  const [chargeEnvois, setChargeEnvois] = useState(true)
  const [filtres, setFiltres] = useState({ gravite: 'all', cible: 'all' })
  const [envoi, setEnvoi] = useState(ENVOI_VIDE)
  const [expedition, setExpedition] = useState(false)
  const [son, setSon] = useState(true)

  // ── les listes de destinataires ──────────────────────────
  const [entreprises, setEntreprises] = useState([])
  const [admins, setAdmins] = useState([])
  const [employes, setEmployes] = useState([])

  // ── les courriels ────────────────────────────────────────
  const [courriels, setCourriels] = useState(null)

  // ── les suppressions ─────────────────────────────────────
  const [suppression, setSuppression] = useState(null)
  const [confirmation, setConfirmation] = useState('')
  const [travail, setTravail] = useState(false)
  const [rafraichir, setRafraichir] = useState(false)

  const changerVue = (cle) => {
    setVue(cle)
    setParametres(cle === 'annonces' ? {} : { vue: cle }, { replace: true })
  }

  // ── l'accès ───────────────────────────────────────────────
  useEffect(() => {
    const brut = localStorage.getItem('admin')
    if (!brut) { navigate('/login'); return }
    let parse
    try {
      parse = JSON.parse(brut)
    } catch {
      navigate('/login')
      return
    }
    if (parse.role !== 'super_admin') { navigate('/dashboard'); return }
    setAdmin(parse)
  }, [navigate])

  const chargerAnnonces = useCallback(async () => {
    if (!admin) return
    setChargeAnnonces(true)
    try {
      const { data, error } = await supabase
        .from('messages_systeme')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setAnnonces(data || [])
    } catch (probleme) {
      console.error(probleme)
      setAnnonces([])
      setAvis({ ton: 'erreur', texte: 'Les annonces n’ont pas pu être lues.' })
    } finally {
      setChargeAnnonces(false)
    }
  }, [admin])

  const chargerEnvois = useCallback(async () => {
    if (!admin) return
    setChargeEnvois(true)
    const depuis = new Date()
    depuis.setDate(depuis.getDate() - periode)
    try {
      const { data, error } = await supabase
        .from('push_logs')
        .select('*')
        .gte('created_at', depuis.toISOString())
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setEnvois(data || [])
    } catch (probleme) {
      console.error(probleme)
      setEnvois([])
      setAvis({ ton: 'erreur', texte: 'L’historique des envois n’a pas pu être lu.' })
    } finally {
      setChargeEnvois(false)
    }
  }, [admin, periode])

  const chargerListes = useCallback(async () => {
    if (!admin) return
    const [ents, adms, emps] = await Promise.all([
      supabase.from('enterprises').select('id, name').eq('is_active', true).order('name'),
      supabase.from('admins').select('id, first_name, last_name, email, enterprise_id').eq('is_active', true).order('first_name'),
      supabase.from('employees').select('id, first_name, last_name, email, enterprise_id').eq('is_active', true).order('first_name'),
    ])
    setEntreprises(ents.data || [])
    setAdmins(adms.data || [])
    setEmployes(emps.data || [])
  }, [admin])

  const chargerCourriels = useCallback(async () => {
    if (!admin) return
    try {
      const { data, error } = await supabase
        .from('encheck_email_logs')
        .select('statut, envoyes, echecs, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setCourriels(resumeCourriels(data || []))
    } catch {
      // La table de suivi peut ne pas être installée : la page le dit
      // sans casser le reste.
      setCourriels(null)
    }
  }, [admin])

  useEffect(() => { chargerAnnonces() }, [chargerAnnonces])
  useEffect(() => { chargerEnvois() }, [chargerEnvois])
  useEffect(() => { chargerListes() }, [chargerListes])
  useEffect(() => { chargerCourriels() }, [chargerCourriels])

  useEffect(() => {
    const pref = localStorage.getItem('push_sound_enabled')
    if (pref !== null) setSon(pref === 'true')
  }, [])

  // ── les chiffres ─────────────────────────────────────────
  const compteAnnonces = useMemo(() => compterAnnonces(annonces), [annonces])
  const resumePush = useMemo(() => resumeEnvois(envois), [envois])
  const annoncesTriees = useMemo(() => trierAnnonces(annonces), [annonces])
  const envoisAffiches = useMemo(() => filtrerEnvois(envois, filtres), [envois, filtres])

  const personnesCiblees = envoi.cible === 'admin'
    ? admins.filter((item) => item.id === envoi.personne).length
    : envoi.cible === 'employee'
      ? employes.filter((item) => item.id === envoi.personne).length
      : 0

  const resumeCible = resumeDestinataires({
    cible: envoi.cible,
    entreprise: entreprises.find((item) => item.id === envoi.entreprise)?.name,
    personnes: personnesCiblees,
    admins,
    employes,
  })

  // ── les gestes ────────────────────────────────────────────
  const rafraichirTout = async () => {
    setRafraichir(true)
    await Promise.all([chargerAnnonces(), chargerEnvois(), chargerCourriels()])
    setRafraichir(false)
    setAvis({ ton: 'ok', texte: 'Les chiffres sont à jour.' })
  }

  const publierAnnonce = async (evenement) => {
    evenement.preventDefault()
    if (!form.titre.trim() || !form.message.trim()) {
      setAvis({ ton: 'erreur', texte: 'Un titre et un message sont nécessaires.' })
      return
    }
    setPublication(true)
    try {
      const { error } = await supabase.from('messages_systeme').insert([{
        type: form.type,
        titre: form.titre.trim(),
        message: form.message.trim(),
        date_debut: versIso(form.date_debut),
        date_fin: versIso(form.date_fin),
        priorite: form.priorite,
        cible: form.cible,
        created_by: admin.id,
        is_active: true,
      }])
      if (error) throw error
      setForm(FORM_VIDE)
      setAvis({ ton: 'ok', texte: 'L’annonce est publiée : elle s’affiche sur les écrans visés.' })
      await chargerAnnonces()
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'L’annonce n’a pas pu être publiée.' })
    } finally {
      setPublication(false)
    }
  }

  const basculerAnnonce = async (annonce) => {
    try {
      const { error } = await supabase
        .from('messages_systeme')
        .update({ is_active: !annonce.is_active })
        .eq('id', annonce.id)
      if (error) throw error
      setAvis({ ton: 'ok', texte: annonce.is_active ? 'Annonce coupée.' : 'Annonce rallumée.' })
      await chargerAnnonces()
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'Le changement n’a pas été enregistré.' })
    }
  }

  const envoyerPush = async (evenement) => {
    evenement.preventDefault()
    if (!envoi.titre.trim() || !envoi.message.trim()) {
      setAvis({ ton: 'erreur', texte: 'Un titre et un message sont nécessaires.' })
      return
    }
    if ((envoi.cible === 'enterprise' && !envoi.entreprise)
      || (envoi.cible === 'admin' && !envoi.personne)
      || (envoi.cible === 'employee' && !envoi.personne)) {
      setAvis({ ton: 'erreur', texte: 'Choisissez d’abord le destinataire.' })
      return
    }

    setExpedition(true)
    try {
      const charge = {
        user_type: envoi.cible === 'admins' ? 'admin' : envoi.cible === 'employees' ? 'employee' : null,
        enterprise_id: envoi.cible === 'enterprise' ? envoi.entreprise : null,
        user_ids: (envoi.cible === 'admin' || envoi.cible === 'employee') && envoi.personne ? [envoi.personne] : null,
        title: envoi.titre.trim(),
        body: envoi.message.trim(),
        url: '/',
        tag: 'manual-push',
        severity: envoi.gravite,
        requireInteraction: envoi.insistant,
        vibrate: envoi.gravite === 'critical' ? [250, 100, 250, 100, 250]
          : envoi.gravite === 'warning' ? [200, 80, 200] : [200, 100, 200],
      }

      const { data: session } = await supabase.auth.getSession()
      if (!session?.session) {
        setAvis({ ton: 'erreur', texte: 'Session expirée : reconnectez-vous pour envoyer.' })
        return
      }

      const reponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify(charge),
      })
      const resultat = await reponse.json()
      if (!reponse.ok) throw new Error(resultat.error || 'Erreur d’envoi')

      if (son) {
        const audio = new Audio('/sounds/success.mp3')
        audio.volume = 0.5
        audio.play()?.catch(() => {})
      }

      setAvis({
        ton: 'ok',
        texte: `${resultat.sent || 0} notification${(resultat.sent || 0) > 1 ? 's' : ''} envoyée${(resultat.sent || 0) > 1 ? 's' : ''}${resultat.failed ? ` · ${resultat.failed} échec${resultat.failed > 1 ? 's' : ''}` : ''}.`,
      })
      setEnvoi(ENVOI_VIDE)
      await chargerEnvois()
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: probleme.message || 'L’envoi a échoué.' })
    } finally {
      setExpedition(false)
    }
  }

  const basculerSon = () => {
    const suivant = !son
    setSon(suivant)
    localStorage.setItem('push_sound_enabled', String(suivant))
    setAvis({ ton: 'ok', texte: suivant ? 'Le son de confirmation est activé.' : 'Le son de confirmation est coupé.' })
  }

  const ouvrirSuppression = (cible) => {
    setConfirmation('')
    setSuppression(cible)
  }

  const supprimer = async () => {
    if (!suppression) return
    setTravail(true)
    try {
      if (suppression.type === 'annonce') {
        const { error } = await supabase.from('messages_systeme').delete().eq('id', suppression.annonce.id)
        if (error) throw error
        setAvis({ ton: 'ok', texte: 'Annonce supprimée : elle quitte les écrans.' })
        await chargerAnnonces()
      } else if (suppression.type === 'envoi') {
        const { error } = await supabase.from('push_logs').delete().eq('id', suppression.envoi.id)
        if (error) throw error
        setAvis({ ton: 'ok', texte: 'Entrée retirée de l’historique.' })
        await chargerEnvois()
      } else if (suppression.type === 'historique') {
        const { error } = await supabase
          .from('push_logs')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')
        if (error) throw error
        setEnvois([])
        setAvis({ ton: 'ok', texte: 'L’historique des envois est vidé.' })
        await chargerEnvois()
      }
      setSuppression(null)
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'La suppression a échoué. Rien n’a été effacé.' })
    } finally {
      setTravail(false)
    }
  }

  const exporterEnvois = () => {
    if (envoisAffiches.length === 0) {
      setAvis({ ton: 'erreur', texte: 'Aucun envoi à exporter.' })
      return
    }
    const csv = construireCSV(envoisAffiches)
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `envois_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(lien)
    lien.click()
    document.body.removeChild(lien)
    URL.revokeObjectURL(url)
    setAvis({ ton: 'ok', texte: `${envoisAffiches.length} envois exportés.` })
  }

  const apercuAnnonce = form.titre || form.message

  if (!admin) return null

  const steles = [
    {
      libelle: 'Annonces actives',
      valeur: compteAnnonces.actives,
      note: `${compteAnnonces.total} publiée${compteAnnonces.total > 1 ? 's' : ''} · ${compteAnnonces.hautes} en priorité haute`,
      ton: 'or',
      icone: Megaphone,
    },
    {
      libelle: `Envois push · ${periode} j`,
      valeur: resumePush.total,
      note: `${resumePush.aujourdhui} aujourd’hui · ${resumePush.envoyes} téléphones atteints`,
      ton: 'ocre',
      icone: Send,
    },
    {
      libelle: 'Acceptés au fournisseur',
      valeur: `${resumePush.taux} %`,
      note: `${resumePush.echecs} échec${resumePush.echecs > 1 ? 's' : ''} à traiter`,
      ton: resumePush.echecs > 0 ? 'attente' : 'vert',
      icone: CheckCircle2,
    },
    {
      libelle: 'Courriels en échec',
      valeur: courriels ? courriels.echecs + courriels.partiels : '—',
      note: courriels
        ? `${courriels.acceptees} acceptés · ${courriels.partiels} partiels`
        : 'suivi e-mail non installé',
      ton: courriels && courriels.echecs + courriels.partiels > 0 ? 'alerte' : 'vert',
      icone: Mail,
    },
  ]

  return (
    <div className={`ms-page${darkMode ? '' : ' ms-clair'}`}>
      <PageCulturalBand pathname="/system-messages" />
      <div className="ms-lisiere" aria-hidden="true" />

      <header className="ms-entete">
        <button
          type="button"
          className="ms-retour"
          onClick={() => navigate('/dashboard')}
          aria-label="Revenir au tableau de bord"
          title="Tableau de bord"
        >
          <ArrowLeft size={16} />
        </button>

        <KorhogoBlasonNuitSvg size={54} />

        <div className="ms-titre-bloc">
          <p className="ms-eyebrow">Supervision · annonces et envois</p>
          <h1 className="ms-titre">Messages système<span>.</span></h1>
          <p className="ms-sous-titre">
            Ce qui s’affiche sur les écrans, ce qui part sur les téléphones, ce qui arrive par courriel.
          </p>
        </div>

        <div className="ms-entete-droite">
          <span className="ms-pastille" title="Annonces affichées en ce moment">
            <i aria-hidden="true" data-etat={compteAnnonces.actives > 0 ? 'ok' : 'faible'} />
            {compteAnnonces.actives === 0
              ? 'aucune annonce à l’écran'
              : `${compteAnnonces.actives} annonce${compteAnnonces.actives > 1 ? 's' : ''} à l’écran`}
          </span>
          <button
            type="button"
            className="ms-theme"
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

      <main className="ms-coque">
        {/* ── le seuil ───────────────────────────────────── */}
        <section className="ms-seuil" aria-label="Période et accès rapides">
          <div className="ms-seuil-groupe">
            <span className="ms-seuil-libelle">Période des envois</span>
            <div className="ms-segments" role="group" aria-label="Période analysée">
              {PERIODES.map((item) => (
                <button
                  key={item.jours}
                  type="button"
                  className="ms-segment"
                  data-actif={periode === item.jours ? 'oui' : 'non'}
                  aria-pressed={periode === item.jours}
                  onClick={() => setPeriode(item.jours)}
                >
                  {item.libelle}
                </button>
              ))}
            </div>
          </div>

          <div className="ms-raccourcis">
            <span className="ms-seuil-libelle">Aller à</span>
            <RaccourcisPages compact />
          </div>

          <button
            type="button"
            className="ms-bouton-creux ms-rafraichir"
            onClick={rafraichirTout}
            disabled={rafraichir}
          >
            <RefreshCw size={13} aria-hidden="true" className={rafraichir ? 'ms-tourne' : undefined} />
            {rafraichir ? 'Actualisation…' : 'Actualiser'}
          </button>
        </section>

        {avis && (
          <p className="ms-avis" data-ton={avis.ton} role="status">
            {avis.ton === 'ok'
              ? <CheckCircle2 size={13} aria-hidden="true" />
              : <AlertTriangle size={13} aria-hidden="true" />}
            {avis.texte}
            <button type="button" className="ms-avis-fermer" onClick={() => setAvis(null)} aria-label="Masquer ce message">
              <X size={12} />
            </button>
          </p>
        )}

        {/* ── les stèles ─────────────────────────────────── */}
        <section className="ms-steles" aria-label="Chiffres de la période">
          {steles.map((item) => {
            const Icone = item.icone
            return (
              <div className="ms-stele" data-ton={item.ton} key={item.libelle}>
                <span className="ms-stele-marque"><Icone size={16} aria-hidden="true" /></span>
                <span className="ms-stele-texte">
                  <span className="ms-stele-nombre">{item.valeur}</span>
                  <span className="ms-stele-libelle">{item.libelle}</span>
                  <span className="ms-stele-note">{item.note}</span>
                </span>
              </div>
            )
          })}
        </section>

        {/* ── le sommaire ────────────────────────────────── */}
        <div className="ms-sommaire">
          <p className="ms-sommaire-titre">Sommaire</p>
          <div className="ms-sommaire-liste" role="tablist" aria-label="Vues des messages système">
            {VUES.map((item) => {
              const Icone = item.icone
              const actif = vue === item.cle
              const compte = item.cle === 'annonces' ? compteAnnonces.total
                : item.cle === 'push' ? resumePush.total
                  : courriels ? courriels.tentatives : 0
              return (
                <button
                  key={item.cle}
                  type="button"
                  role="tab"
                  id={`ms-onglet-${item.cle}`}
                  aria-selected={actif}
                  aria-controls={`ms-vue-${item.cle}`}
                  className="ms-onglet"
                  data-actif={actif ? 'oui' : 'non'}
                  onClick={() => changerVue(item.cle)}
                >
                  <Icone size={14} aria-hidden="true" />
                  {item.libelle}
                  <span className="ms-onglet-compte">{compte}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ═══ 1. ANNONCES ═══ */}
        {vue === 'annonces' && (
          <section className="ms-vue" id="ms-vue-annonces" role="tabpanel" aria-labelledby="ms-onglet-annonces">
            <header className="ms-vue-tete">
              <div>
                <h2 className="ms-vue-titre">Les annonces</h2>
                <p className="ms-vue-note">
                  {compteAnnonces.actives} à l’écran · {compteAnnonces.total} publiée{compteAnnonces.total > 1 ? 's' : ''} ·
                  {' '}le bandeau suit sa fenêtre de dates et sa cible
                </p>
              </div>
            </header>

            <div className="ms-annonces-grille">
              <form className="ms-cartouche-ecru ms-formulaire" onSubmit={publierAnnonce}>
                <p className="ms-cartouche-titre">Nouvelle annonce</p>

                <div className="ms-champs-ligne">
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Type</span>
                    <select value={form.type} onChange={(evenement) => setForm({ ...form, type: evenement.target.value })}>
                      {TYPES_ANNONCE.map((item) => <option key={item.cle} value={item.cle}>{item.libelle}</option>)}
                    </select>
                  </label>
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Priorité</span>
                    <select value={form.priorite} onChange={(evenement) => setForm({ ...form, priorite: evenement.target.value })}>
                      {PRIORITES.map((item) => <option key={item.cle} value={item.cle}>{item.libelle}</option>)}
                    </select>
                  </label>
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Cible</span>
                    <select value={form.cible} onChange={(evenement) => setForm({ ...form, cible: evenement.target.value })}>
                      {CIBLES.map((item) => <option key={item.cle} value={item.cle}>{item.libelle}</option>)}
                    </select>
                  </label>
                </div>

                <div className="ms-champs-ligne">
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Du</span>
                    <input type="datetime-local" value={form.date_debut} onChange={(evenement) => setForm({ ...form, date_debut: evenement.target.value })} />
                  </label>
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Au</span>
                    <input type="datetime-local" value={form.date_fin} onChange={(evenement) => setForm({ ...form, date_fin: evenement.target.value })} />
                  </label>
                </div>

                <label className="ms-champ">
                  <span className="ms-champ-libelle">Titre</span>
                  <input
                    value={form.titre}
                    onChange={(evenement) => setForm({ ...form, titre: evenement.target.value })}
                    placeholder="Maintenance du serveur de pointage"
                    maxLength={120}
                  />
                </label>

                <label className="ms-champ">
                  <span className="ms-champ-libelle">Message</span>
                  <textarea
                    value={form.message}
                    onChange={(evenement) => setForm({ ...form, message: evenement.target.value })}
                    placeholder="Les pointages seront indisponibles samedi de 22 h à 23 h."
                    rows={4}
                    maxLength={400}
                  />
                </label>

                <button type="submit" className="ms-bouton" disabled={publication}>
                  <Send size={14} aria-hidden="true" />
                  {publication ? 'Publication…' : 'Publier l’annonce'}
                </button>

                <div className="ms-apercu">
                  <p className="ms-apercu-titre">Aperçu du bandeau</p>
                  <div className="ms-apercu-bandeau" data-type={form.type} data-priorite={form.priorite}>
                    <span className="ms-apercu-marque" aria-hidden="true">
                      {(() => { const Icone = ICONE_TYPE[form.type] || Info; return <Icone size={15} /> })()}
                    </span>
                    <span>
                      <strong>{apercuAnnonce ? form.titre || 'Sans titre' : 'Votre titre apparaîtra ici'}</strong>
                      <small>{form.message || 'Le message de l’annonce s’affichera sous le titre.'}</small>
                    </span>
                  </div>
                </div>
              </form>

              <div className="ms-liste-annonces">
                {chargeAnnonces ? (
                  <Chargement texte="Lecture des annonces…" note="Chaque annonce arrive avec sa fenêtre." />
                ) : annoncesTriees.length === 0 ? (
                  <div className="ms-vide">
                    <Megaphone size={30} aria-hidden="true" />
                    <p className="ms-vide-titre">Aucune annonce publiée</p>
                    <p className="ms-vide-texte">
                      Publiez la première : elle s’affichera dans le tableau de bord des personnes visées.
                    </p>
                  </div>
                ) : (
                  annoncesTriees.map((annonce) => {
                    const Icone = ICONE_TYPE[annonce.type] || Info
                    const etat = etatAnnonce(annonce)
                    return (
                      <article className="ms-annonce" data-etat={etat} key={annonce.id}>
                        <div className="ms-annonce-haut">
                          <span className="ms-annonce-marque" data-type={annonce.type}>
                            <Icone size={14} aria-hidden="true" />
                          </span>
                          <span className="ms-annonce-tags">
                            <span className="ms-annonce-type">{libelleType(annonce.type)}</span>
                            <Etiquette ton={annonce.priorite === 'haute' ? 'alerte' : annonce.priorite === 'basse' ? 'vert' : 'attente'}>
                              {libellePriorite(annonce.priorite)}
                            </Etiquette>
                            <Etiquette ton="or">{libelleCible(annonce.cible)}</Etiquette>
                            <Etiquette ton={etat === 'active' ? 'vert' : etat === 'a_venir' ? 'or' : 'neutre'}>
                              {LIBELLE_ETAT[etat]}
                            </Etiquette>
                          </span>
                          <span className="ms-annonce-gestes">
                            <Interrupteur
                              actif={annonce.is_active !== false}
                              surClic={() => basculerAnnonce(annonce)}
                              libelle={annonce.is_active === false ? 'Rallumer cette annonce' : 'Couper cette annonce'}
                            />
                            <button
                              type="button"
                              className="ms-icon-bouton"
                              onClick={() => ouvrirSuppression({ type: 'annonce', annonce })}
                              aria-label={`Supprimer l’annonce ${annonce.titre}`}
                              title="Supprimer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </span>
                        </div>
                        <h3 className="ms-annonce-titre">{annonce.titre}</h3>
                        <p className="ms-annonce-texte">{annonce.message}</p>
                        <p className="ms-annonce-plage">
                          <CalendarClock size={12} aria-hidden="true" />
                          {plageAnnonce(annonce)}
                        </p>
                      </article>
                    )
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {/* ═══ 2. NOTIFICATIONS PUSH ═══ */}
        {vue === 'push' && (
          <section className="ms-vue" id="ms-vue-push" role="tabpanel" aria-labelledby="ms-onglet-push">
            <header className="ms-vue-tete">
              <div>
                <h2 className="ms-vue-titre">Les notifications push</h2>
                <p className="ms-vue-note">
                  {resumePush.total} envoi{resumePush.total > 1 ? 's' : ''} sur {periode} jours ·
                  {' '}{resumePush.envoyes} téléphones atteints · {resumePush.echecs} échec{resumePush.echecs > 1 ? 's' : ''}
                </p>
              </div>
              <div className="ms-vue-gestes">
                <button type="button" className="ms-bouton-creux" onClick={exporterEnvois}>
                  <Download size={14} /> Exporter
                </button>
                <button
                  type="button"
                  className="ms-bouton ms-bouton--danger"
                  onClick={() => ouvrirSuppression({ type: 'historique' })}
                  disabled={envois.length === 0}
                >
                  <Trash2 size={14} /> Vider l’historique
                </button>
              </div>
            </header>

            <div className="ms-annonces-grille">
              <form className="ms-cartouche-ecru ms-formulaire" onSubmit={envoyerPush}>
                <div className="ms-cartouche-entete">
                  <p className="ms-cartouche-titre">Composer un envoi</p>
                  <button
                    type="button"
                    className="ms-son"
                    onClick={basculerSon}
                    aria-pressed={son}
                    title={son ? 'Couper le son de confirmation' : 'Activer le son de confirmation'}
                  >
                    {son ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
                    {son ? 'Son activé' : 'Son coupé'}
                  </button>
                </div>

                <label className="ms-champ">
                  <span className="ms-champ-libelle">Destinataires</span>
                  <select
                    value={envoi.cible}
                    onChange={(evenement) => setEnvoi({ ...envoi, cible: evenement.target.value, entreprise: '', personne: '' })}
                  >
                    {CIBLES_ENVOI.map((item) => <option key={item.cle} value={item.cle}>{item.libelle}</option>)}
                  </select>
                </label>

                {envoi.cible === 'enterprise' && (
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Entreprise</span>
                    <select value={envoi.entreprise} onChange={(evenement) => setEnvoi({ ...envoi, entreprise: evenement.target.value })}>
                      <option value="">Choisir une entreprise</option>
                      {entreprises.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                )}

                {envoi.cible === 'admin' && (
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Administrateur</span>
                    <select value={envoi.personne} onChange={(evenement) => setEnvoi({ ...envoi, personne: evenement.target.value })}>
                      <option value="">Choisir un administrateur</option>
                      {admins.map((item) => <option key={item.id} value={item.id}>{nomPersonne(item)}</option>)}
                    </select>
                  </label>
                )}

                {envoi.cible === 'employee' && (
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Employé</span>
                    <select value={envoi.personne} onChange={(evenement) => setEnvoi({ ...envoi, personne: evenement.target.value })}>
                      <option value="">Choisir un employé</option>
                      {employes.map((item) => <option key={item.id} value={item.id}>{nomPersonne(item)}</option>)}
                    </select>
                  </label>
                )}

                <div className="ms-champ">
                  <span className="ms-champ-libelle">Gravité</span>
                  <div className="ms-segments" role="group" aria-label="Gravité de la notification">
                    {GRAVITES.map((item) => (
                      <button
                        key={item.cle}
                        type="button"
                        className="ms-segment"
                        data-actif={envoi.gravite === item.cle ? 'oui' : 'non'}
                        data-gravite={item.cle}
                        aria-pressed={envoi.gravite === item.cle}
                        onClick={() => setEnvoi({ ...envoi, gravite: item.cle })}
                      >
                        {item.libelle}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="ms-case-ligne">
                  <button
                    type="button"
                    className="ms-case"
                    role="checkbox"
                    aria-checked={envoi.insistant}
                    aria-label="Sonne même en veille"
                    onClick={() => setEnvoi({ ...envoi, insistant: !envoi.insistant })}
                  >
                    {envoi.insistant && <Check size={11} strokeWidth={3} />}
                  </button>
                  <span>
                    <strong>Sonne même en veille</strong>
                    <small>La notification reste affichée jusqu’à ce qu’on la touche.</small>
                  </span>
                </label>

                <label className="ms-champ">
                  <span className="ms-champ-libelle">Titre</span>
                  <input
                    value={envoi.titre}
                    onChange={(evenement) => setEnvoi({ ...envoi, titre: evenement.target.value })}
                    placeholder="Coupure de pointage ce soir"
                    maxLength={100}
                  />
                </label>

                <label className="ms-champ">
                  <span className="ms-champ-libelle">Message</span>
                  <textarea
                    value={envoi.message}
                    onChange={(evenement) => setEnvoi({ ...envoi, message: evenement.target.value })}
                    placeholder="Les pointages seront indisponibles de 22 h à 23 h. Pointez avant 22 h."
                    rows={4}
                    maxLength={300}
                  />
                </label>

                <div className="ms-apercu">
                  <p className="ms-apercu-titre">Aperçu sur le téléphone</p>
                  <div className="ms-apercu-push" data-gravite={envoi.gravite}>
                    <span className="ms-apercu-appli" aria-hidden="true">EC</span>
                    <span className="ms-apercu-contenu">
                      <span className="ms-apercu-entete">EN-CHECK · maintenant</span>
                      <strong>{envoi.titre || 'Le titre de la notification'}</strong>
                      <small>{envoi.message || 'Le message s’affichera ici, sur le téléphone.'}</small>
                    </span>
                  </div>
                </div>

                <p className="ms-destinataires">
                  <Target size={13} aria-hidden="true" />
                  {resumeCible}
                </p>

                <button type="submit" className="ms-bouton" disabled={expedition}>
                  <Send size={14} aria-hidden="true" />
                  {expedition ? 'Envoi…' : `Envoyer · ${resumeCible}`}
                </button>
              </form>

              <div className="ms-liste-envois">
                <div className="ms-barre">
                  <span className="ms-barre-titre">L’historique</span>
                  <label className="ms-date">
                    <span>Gravité</span>
                    <select value={filtres.gravite} onChange={(evenement) => setFiltres({ ...filtres, gravite: evenement.target.value })}>
                      <option value="all">Toutes</option>
                      {GRAVITES.map((item) => <option key={item.cle} value={item.cle}>{item.libelle}</option>)}
                    </select>
                  </label>
                  <label className="ms-date">
                    <span>Cible</span>
                    <select value={filtres.cible} onChange={(evenement) => setFiltres({ ...filtres, cible: evenement.target.value })}>
                      <option value="all">Toutes</option>
                      <option value="broadcast">Diffusion générale</option>
                      <option value="admins">Admins</option>
                      <option value="employees">Employés</option>
                      <option value="enterprise">Entreprise</option>
                      <option value="individual">Individuel</option>
                    </select>
                  </label>
                  <span className="ms-compte">{envoisAffiches.length}</span>
                </div>

                {chargeEnvois ? (
                  <Chargement texte="Lecture de l’historique…" note="Les envois de la période arrivent." />
                ) : envoisAffiches.length === 0 ? (
                  <div className="ms-vide">
                    <Bell size={30} aria-hidden="true" />
                    <p className="ms-vide-titre">Aucun envoi sur cette période</p>
                    <p className="ms-vide-texte">
                      Élargissez la période, changez de filtre, ou composez le premier envoi.
                    </p>
                  </div>
                ) : (
                  <ul className="ms-envois">
                    {envoisAffiches.map((log) => {
                      const gravite = graviteDe(log)
                      return (
                        <li className="ms-envoi" data-gravite={gravite} key={log.id}>
                          <span className="ms-envoi-marque" data-gravite={gravite} aria-hidden="true">
                            {gravite === 'critical' ? <AlertTriangle size={14} /> : gravite === 'warning' ? <Bell size={14} /> : <Info size={14} />}
                          </span>
                          <span className="ms-envoi-texte">
                            <span className="ms-envoi-haut">
                              <span className="ms-envoi-gravite">{libelleGravite(gravite)}</span>
                              <strong>{log.title}</strong>
                            </span>
                            <span className="ms-envoi-corps">{log.body}</span>
                            <span className="ms-envoi-bas">
                              <span>{libelleCibleLog(log)}</span>
                              <span className="ms-envoi-compte" data-ok="oui">
                                <CheckCircle2 size={11} aria-hidden="true" /> {log.success_count || 0}
                              </span>
                              {(log.failed_count || 0) > 0 && (
                                <span className="ms-envoi-compte" data-ok="non">
                                  <XCircle size={11} aria-hidden="true" /> {log.failed_count}
                                </span>
                              )}
                              <span className="ms-envoi-quand">{tempsRelatif(log.created_at)}</span>
                            </span>
                          </span>
                          <button
                            type="button"
                            className="ms-icon-bouton"
                            onClick={() => ouvrirSuppression({ type: 'envoi', envoi: log })}
                            aria-label={`Retirer l’envoi ${log.title} de l’historique`}
                            title="Retirer de l’historique"
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {resumePush.parGravite.critical > 0 && (
                  <p className="ms-note-bas">
                    <AlertTriangle size={12} aria-hidden="true" />
                    {resumePush.parGravite.critical} envoi{resumePush.parGravite.critical > 1 ? 's' : ''} critique
                    {resumePush.parGravite.critical > 1 ? 's' : ''} sur la période.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ═══ 3. E-MAILS ═══ */}
        {vue === 'emails' && (
          <section className="ms-vue" id="ms-vue-emails" role="tabpanel" aria-labelledby="ms-onglet-emails">
            <header className="ms-vue-tete">
              <div>
                <h2 className="ms-vue-titre">Les courriels</h2>
                <p className="ms-vue-note">
                  Ce que le fournisseur a accepté, ce qui a échoué, et les relances — le moniteur reste maître de ses envois.
                </p>
              </div>
              {courriels && (
                <div className="ms-vue-gestes">
                  <Etiquette ton="or">{courriels.tentatives} tentatives lues</Etiquette>
                  <Etiquette ton={courriels.echecs > 0 ? 'alerte' : 'vert'}>{courriels.echecs} échecs</Etiquette>
                  <Etiquette ton={courriels.partiels > 0 ? 'attente' : 'neutre'}>{courriels.partiels} partiels</Etiquette>
                </div>
              )}
            </header>

            <div className="ms-moniteur">
              <EmailDeliveryMonitor />
            </div>
          </section>
        )}
      </main>

      <footer className="ms-pied">
        <span className="ms-pied-marque">MESSAGES SYSTÈME</span>
        <span className="ms-pied-sep">·</span>
        <span>En-Check, toile de korhogo</span>
        <span className="ms-pied-sep">·</span>
        <span>
          {compteAnnonces.actives} annonces à l’écran · {resumePush.total} envois
          {courriels ? ` · ${courriels.tentatives} courriels` : ''}
        </span>
      </footer>

      <PageCulturalBand pathname="/system-messages" placement="bottom" />

      {/* ── les fenêtres de suppression ─────────────────── */}
      {suppression?.type === 'annonce' && (
        <Fenetre
          eyebrow="Suppression · annonce"
          titre="Supprimer cette annonce ?"
          labelledBy="ms-titre-annonce"
          surFermer={() => setSuppression(null)}
          pied={(
            <>
              <button type="button" className="ms-bouton-creux" onClick={() => setSuppression(null)}>Annuler</button>
              <button type="button" className="ms-bouton ms-bouton--danger" onClick={supprimer} disabled={travail}>
                <Trash2 size={14} /> {travail ? 'Suppression…' : 'Supprimer'}
              </button>
            </>
          )}
        >
          <p className="ms-note">
            « {suppression.annonce.titre} » disparaît des écrans à l’instant. Les personnes qui l’ont lue ne la
            reverront pas ; les autres ne la verront jamais.
          </p>
          <p className="ms-note ms-note--forte">Cette action est définitive.</p>
        </Fenetre>
      )}

      {suppression?.type === 'envoi' && (
        <Fenetre
          eyebrow="Suppression · historique"
          titre="Retirer cette entrée ?"
          labelledBy="ms-titre-envoi"
          surFermer={() => setSuppression(null)}
          pied={(
            <>
              <button type="button" className="ms-bouton-creux" onClick={() => setSuppression(null)}>Annuler</button>
              <button type="button" className="ms-bouton ms-bouton--danger" onClick={supprimer} disabled={travail}>
                <Trash2 size={14} /> {travail ? 'Suppression…' : 'Retirer'}
              </button>
            </>
          )}
        >
          <p className="ms-note">
            « {suppression.envoi.title} » quitte l’historique. Le téléphone qui l’a reçue la garde, et les
            compteurs de la période baissent d’autant.
          </p>
        </Fenetre>
      )}

      {suppression?.type === 'historique' && (
        <Fenetre
          eyebrow="Suppression · notifications"
          titre={`Vider ${envois.length} envoi${envois.length > 1 ? 's' : ''} de l’historique ?`}
          labelledBy="ms-titre-historique"
          surFermer={() => setSuppression(null)}
          pied={(
            <>
              <button type="button" className="ms-bouton-creux" onClick={() => setSuppression(null)}>Annuler</button>
              <button
                type="button"
                className="ms-bouton ms-bouton--danger"
                onClick={supprimer}
                disabled={travail || !confirmationValide(confirmation)}
              >
                <Trash2 size={14} /> {travail ? 'Suppression…' : 'Supprimer'}
              </button>
            </>
          )}
        >
          <div className="ms-fenetre-alerte">
            <p className="ms-fenetre-alerte-titre">Ce qui sera effacé</p>
            <p>
              {envois.length} entrée{envois.length > 1 ? 's' : ''} de l’historique des notifications push,
              avec leurs compteurs d’envoi et d’échec.
            </p>
            <p className="ms-fenetre-alerte-note">
              Les annonces, les courriels, les comptes et les pointages ne sont pas touchés.
              Les téléphones gardent les notifications déjà reçues.
            </p>
          </div>

          <label className="ms-champ">
            <span className="ms-champ-libelle">Pour confirmer, tapez « {MOT_CONFIRMATION} »</span>
            <input
              className="ms-champ-confirmation"
              value={confirmation}
              onChange={(evenement) => setConfirmation(evenement.target.value)}
              placeholder={MOT_CONFIRMATION}
              autoComplete="off"
            />
          </label>

          <p className="ms-fenetre-trace">
            <Shield size={13} aria-hidden="true" />
            Cette action est définitive et ne peut pas être annulée.
          </p>
        </Fenetre>
      )}
    </div>
  )
}
