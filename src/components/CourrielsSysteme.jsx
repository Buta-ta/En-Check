// ═══════════════════════════════════════════════════════════
// LES COURRIELS — le registre des tentatives, repris de zéro
//
// L'ancien moniteur empilait sept cartes de chiffres, un bandeau
// bleu et une liste grise. Ici, la même matière tient dans la toile
// de korhogo : une lisière de santé, un registre de sept compteurs
// sur un seul trait, un journal de cartouches où chaque tentative
// dit son statut, ses adresses et son erreur, puis un composeur qui
// ne part jamais sans avoir montré qui il touche.
//
// Aucun envoi ne se fait à l'aveugle : aperçu obligatoire, puis
// saisie de « ENVOYER », puis le résultat du fournisseur est dit.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Archive, CheckCircle2, ChevronDown, Clock3, Download, Eye,
  Mail, Pencil, RefreshCw, RotateCcw, Search, Send, ShieldAlert, ShieldCheck,
  Trash2, XCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import FenetreModale from './FenetreModale'
import {
  GRAVITES_LIGNE, MOT_ENVOI, SOURCES_COURRIEL, STATUTS_COURRIEL, TAILLE_PAGE, VERSION_FONCTION,
  adressesDe, adressesRelance, adressesValides, analyseDe, brouillonRelance, brouillonVide,
  compteCourriels, confirmationEnvoiValide, construireCSV, dateCourriel,
  dureeCourriel, filtrerCourriels, ligneVide, lignesDe, metaSource, metaStatut,
  peutCorriger, peutRelancer, requeteCourriel, resumeBrouillon, resultatsDe, santeCourriels,
  sourceDe, statutCourriel,
} from '../lib/courriels'
import './CourrielsSysteme.css'

const messageErreur = async (erreur) => {
  if (erreur?.context && typeof erreur.context.json === 'function') {
    try {
      const corps = await erreur.context.json()
      if (corps?.detail) return corps.detail
      if (corps?.erreur) return corps.erreur
      if (corps?.error) return corps.error
      if (corps?.message) return corps.message
    } catch {
      // La réponse a parfois déjà été lue par supabase-js.
    }
  }
  return erreur?.message || 'La fonction e-mail n’a pas répondu.'
}

function Chargement({ texte = 'Lecture du journal…' }) {
  return (
    <div className="ms-charge" role="status" aria-live="polite">
      <div className="ms-charge-chevrons" aria-hidden="true">
        <span /><span /><span />
      </div>
      <p className="ms-charge-texte">{texte}</p>
      <p className="ms-charge-note">Les tentatives et leurs erreurs arrivent.</p>
    </div>
  )
}

export default function CourrielsSysteme({ onJournal }) {
  const [logs, setLogs] = useState([])
  const [charge, setCharge] = useState(true)
  const [chargePlus, setChargePlus] = useState(false)
  const [plusAnciens, setPlusAnciens] = useState(false)
  const [erreurJournal, setErreurJournal] = useState('')
  const [entreprises, setEntreprises] = useState([])
  const [admins, setAdmins] = useState([])
  const [adresseCourante, setAdresseCourante] = useState('')
  const [controle, setControle] = useState({ etat: 'verification', message: 'Vérification de la fonction e-mail…' })
  const [filtres, setFiltres] = useState({ statut: 'all', source: 'all', recherche: '' })
  const [archives, setArchives] = useState(false)
  const [ouvert, setOuvert] = useState(null)
  const [travail, setTravail] = useState(null)
  const [action, setAction] = useState(null)
  const [avis, setAvis] = useState(null)
  const [brouillon, setBrouillon] = useState(null)
  const [apercu, setApercu] = useState(null)
  const [etape, setEtape] = useState('edition')
  const [confirmation, setConfirmation] = useState('')

  const nombreLus = useRef(0)
  const dispose = useRef(true)

  const chargerJournal = useCallback(async (discret = false, ajouter = false) => {
    if (!discret && !ajouter) setCharge(true)
    if (ajouter) setChargePlus(true)

    const depuis = ajouter ? nombreLus.current : 0
    const jusqua = ajouter ? depuis + TAILLE_PAGE - 1 : TAILLE_PAGE - 1
    const { data, error } = await supabase
      .from('encheck_email_logs')
      .select('*')
      .order('cree_le', { ascending: false })
      .range(depuis, jusqua)

    if (!dispose.current) return
    if (error) {
      setErreurJournal(error.message || 'Impossible de lire l’historique des e-mails.')
      if (!ajouter) setLogs([])
    } else {
      const lignes = data || []
      setErreurJournal('')
      setLogs((courant) => (ajouter ? [...courant, ...lignes] : lignes))
      nombreLus.current = depuis + lignes.length
      setPlusAnciens(lignes.length === TAILLE_PAGE)
    }
    setCharge(false)
    setChargePlus(false)
  }, [])

  const verifierFonction = useCallback(async () => {
    setControle({ etat: 'verification', message: 'Vérification de la fonction e-mail…' })
    const { data, error } = await supabase.functions.invoke('send-email', { method: 'GET' })
    if (error) {
      const message = await messageErreur(error)
      const mauvaiseMethode = error?.context?.status === 405 || /method_not_allowed/i.test(message)
      setControle({
        etat: 'ancienne',
        message: mauvaiseMethode
          ? 'La version déployée ne répond pas au contrôle de santé.'
          : 'La fonction e-mail ne répond pas comme prévu.',
        detail: mauvaiseMethode
          ? 'Déploie la fonction « send-email » du dépôt depuis Supabase, puis actualise. Les envois restent bloqués tant que l’aperçu n’est pas fiable.'
          : message,
      })
      return
    }
    if (data?.version !== VERSION_FONCTION) {
      setControle({
        etat: 'ancienne',
        message: 'La fonction déployée est une ancienne version.',
        detail: 'L’aperçu sans envoi et le journal manquent. Déploie « send-email » depuis le dépôt, puis actualise.',
      })
      return
    }
    setControle({
      etat: 'prete',
      message: 'Fonction e-mail connectée.',
      configuration: data.configuration || {},
    })
  }, [])

  useEffect(() => {
    dispose.current = true
    const demarrer = async () => {
      await chargerJournal()
      const [resultatEntreprises, resultatAdmins, session] = await Promise.all([
        supabase.from('enterprises').select('id, name').eq('is_active', true).order('name'),
        supabase.from('admins')
          .select('id, first_name, last_name, email, is_active')
          .eq('is_active', true)
          .order('first_name'),
        supabase.auth.getUser(),
      ])
      if (!dispose.current) return
      setEntreprises(resultatEntreprises.data || [])
      setAdmins(resultatAdmins.data || [])
      let local = {}
      try { local = JSON.parse(localStorage.getItem('admin') || '{}') } catch { local = {} }
      setAdresseCourante(session.data?.user?.email || local.email || '')
      await verifierFonction()
    }
    demarrer()

    const horloge = window.setInterval(() => {
      if (dispose.current) chargerJournal(true)
    }, 30000)

    return () => {
      dispose.current = false
      window.clearInterval(horloge)
    }
  }, [chargerJournal, verifierFonction])

  const nomsEntreprises = useMemo(
    () => Object.fromEntries(entreprises.map((item) => [item.id, item.name])),
    [entreprises],
  )

  const actives = useMemo(() => logs.filter((log) => !log.archived_at), [logs])
  const chiffres = useMemo(() => compteCourriels(actives), [actives])
  const visibles = useMemo(
    () => filtrerCourriels(logs, { ...filtres, archives, nomsEntreprises }),
    [logs, filtres, archives, nomsEntreprises],
  )
  const sante = useMemo(() => santeCourriels(controle), [controle])

  const dire = (ton, texte) => setAvis({ ton, texte })

  const basculerDetail = (id) => setOuvert((courant) => (courant === id ? null : id))

  // ── relancer, archiver, restaurer ────────────────────────
  const demander = (type, log) => setAction({ type, id: log.id })

  const relancer = async (log) => {
    const corps = {
      enterprise_id: log.payload?.enterprise_id || log.enterprise_id || undefined,
      destinataires: adressesDe(log),
      sujet: log.payload?.sujet || undefined,
      lien: log.payload?.lien || undefined,
      lignes: lignesDe(log),
      retry_of: log.id,
    }
    setTravail(log.id)
    setAction(null)
    try {
      const { data, error } = await supabase.functions.invoke('send-email', { body: corps })
      if (error) throw new Error(await messageErreur(error))
      const acceptes = Number(data?.envoyes || 0)
      const echecs = Number(data?.echecs || 0)
      if (data?.ok !== true && acceptes === 0) throw new Error(data?.erreur || data?.error || 'La relance a échoué.')
      if (data?.journalise === false) {
        dire('alerte', `${acceptes} envoi(s) accepté(s), mais le journal n’a pas reçu la ligne. Ne relance pas tout de suite.`)
      } else if (echecs > 0) {
        dire('attente', `Relance partielle : ${acceptes} accepté(s), ${echecs} échec(s). Consulte la nouvelle ligne.`)
      } else {
        dire('ok', `Relance acceptée par le fournisseur pour ${acceptes} destinataire(s).`)
      }
      await chargerJournal(true)
      onJournal?.()
    } catch (probleme) {
      dire('erreur', probleme.message || 'Impossible de relancer cet e-mail.')
    } finally {
      setTravail(null)
    }
  }

  const archiver = async (log, restaurer = false) => {
    setTravail(log.id)
    setAction(null)
    const maintenant = restaurer ? null : new Date().toISOString()
    const { error } = await supabase
      .from('encheck_email_logs')
      .update({ archived_at: maintenant })
      .eq('id', log.id)
    if (error) {
      dire('erreur', `Impossible de ${restaurer ? 'restaurer' : 'archiver'} l’entrée : ${error.message}`)
    } else {
      setLogs((courant) => courant.map((item) => (item.id === log.id ? { ...item, archived_at: maintenant } : item)))
      dire('ok', restaurer
        ? 'Entrée restaurée : elle revient dans les tentatives actives.'
        : 'Entrée archivée : elle reste consultable, l’e-mail n’est ni supprimé ni rappelé.')
      onJournal?.()
    }
    setTravail(null)
  }

  const confirmerAction = (log) => {
    if (action?.type === 'relancer') relancer(log)
    else if (action?.type === 'archiver') archiver(log, false)
    else if (action?.type === 'restaurer') archiver(log, true)
  }

  const libelleAction = () => {
    if (action?.type === 'relancer') return 'Relancer'
    if (action?.type === 'restaurer') return 'Restaurer'
    return 'Archiver'
  }

  const phraseAction = (log) => {
    if (action?.type === 'relancer') {
      return `Relancer vers ${adressesRelance(log).length} adresse(s) ? Une nouvelle ligne datée sera créée.`
    }
    if (action?.type === 'restaurer') return 'Restaurer cette entrée dans les tentatives actives ?'
    return 'Archiver cette entrée ? Elle restera conservée pour le contrôle.'
  }

  // ── exporter le journal ──────────────────────────────────
  const exporter = () => {
    if (!visibles.length) {
      dire('erreur', 'Aucune ligne à exporter dans cette vue.')
      return
    }
    const blob = new Blob([`\ufeff${construireCSV(visibles, nomsEntreprises)}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `courriels_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(lien)
    lien.click()
    document.body.removeChild(lien)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    dire('ok', `${visibles.length} ligne(s) exportée(s) en CSV.`)
  }

  // ── le composeur ─────────────────────────────────────────
  const ouvrirComposeur = () => {
    setApercu(null)
    setEtape('edition')
    setConfirmation('')
    setBrouillon(brouillonVide({ adresse: adresseCourante, origine: window.location.origin }))
  }

  const ouvrirCorrection = (log) => {
    const relance = brouillonRelance(log, window.location.origin)
    if (!relance) {
      dire('erreur', 'Cette ancienne tentative ne garde pas assez de détails pour être corrigée.')
      return
    }
    setApercu(null)
    setEtape('edition')
    setConfirmation('')
    setBrouillon(relance)
  }

  const fermerComposeur = () => {
    if (travail === 'envoi' || travail === 'apercu') return
    setBrouillon(null)
    setApercu(null)
    setEtape('edition')
    setConfirmation('')
  }

  const modifierBrouillon = (cle, valeur) => {
    setBrouillon((courant) => ({ ...courant, [cle]: valeur }))
    setApercu(null)
    setEtape('edition')
  }

  const modifierLigne = (index, cle, valeur) => {
    setBrouillon((courant) => ({
      ...courant,
      lines: courant.lines.map((ligne, rang) => (rang === index ? { ...ligne, [cle]: valeur } : ligne)),
    }))
    setApercu(null)
    setEtape('edition')
  }

  const ajouterLigne = () => {
    setBrouillon((courant) => ({ ...courant, lines: [...courant.lines, ligneVide()] }))
    setApercu(null)
    setEtape('edition')
  }

  const retirerLigne = (index) => {
    setBrouillon((courant) => ({ ...courant, lines: courant.lines.filter((_, rang) => rang !== index) }))
    setApercu(null)
    setEtape('edition')
  }

  const resume = useMemo(
    () => (brouillon ? resumeBrouillon(brouillon, { adresseCourante, admins }) : null),
    [brouillon, adresseCourante, admins],
  )

  const previsualiser = async () => {
    if (!brouillon) return
    if (!resume.lignes) { dire('erreur', 'Ajoute au moins une ligne au message.'); return }
    if (!resume.complet) { dire('erreur', 'Choisis d’abord les destinataires de cet envoi.'); return }
    setTravail('apercu')
    try {
      const corps = requeteCourriel(brouillon, { previewOnly: true, adresseCourante, admins })
      const { data, error } = await supabase.functions.invoke('send-email', { body: corps })
      if (error) throw new Error(await messageErreur(error))
      if (data?.preview !== true) throw new Error('La fonction active ne confirme pas l’aperçu sans envoi.')
      setApercu({
        destinataires: data.destinataires || [],
        entreprise: data.entreprise || '',
        note: data.note || '',
        analyse: data.analyse_destinataires || [],
      })
      if (!(data.destinataires || []).length) dire('attente', 'Aucun destinataire éligible pour cette entreprise.')
    } catch (probleme) {
      dire('erreur', probleme.message || 'Impossible de calculer les destinataires.')
    } finally {
      setTravail(null)
    }
  }

  const envoyer = async () => {
    if (!brouillon || !apercu) return
    if (!confirmationEnvoiValide(confirmation)) return
    setTravail('envoi')
    try {
      const corps = requeteCourriel(brouillon, { adresseCourante, admins })
      const { data, error } = await supabase.functions.invoke('send-email', { body: corps })
      if (error) throw new Error(await messageErreur(error))
      const acceptes = Number(data?.envoyes || 0)
      const echecs = Number(data?.echecs || 0)
      if (data?.ok !== true && acceptes === 0) throw new Error(data?.erreur || data?.error || data?.note || 'L’envoi a échoué.')
      const fournisseur = data?.fournisseur === 'brevo' ? 'Brevo' : data?.fournisseur === 'smtp' ? 'SMTP' : 'Le fournisseur'
      if (data?.journalise === false) {
        dire('alerte', `${fournisseur} a accepté ${acceptes} envoi(s), mais le journal est indisponible. Ne relance pas tout de suite.`)
      } else if (echecs > 0) {
        dire('attente', `Envoi partiel : ${acceptes} accepté(s), ${echecs} échec(s). La ligne est dans le journal.`)
      } else {
        dire('ok', `${fournisseur} a accepté l’envoi à ${acceptes} destinataire(s).`)
      }
      setBrouillon(null)
      setApercu(null)
      setEtape('edition')
      setConfirmation('')
      await chargerJournal(true)
      onJournal?.()
    } catch (probleme) {
      dire('erreur', probleme.message || 'L’e-mail n’a pas été envoyé.')
      await chargerJournal(true)
    } finally {
      setTravail(null)
    }
  }

  const bloque = !sante.peutEnvoyer

  return (
    <div className="ms-courriels">
      <header className="ms-courriels-tete">
        <div>
          <h2 className="ms-vue-titre">Les courriels</h2>
          <p className="ms-vue-note">
            Ce que le fournisseur a accepté, ce qui a échoué, et ce qui se relance — un registre, pas une mosaïque de chiffres.
          </p>
        </div>
        <div className="ms-courriels-gestes">
          <button
            type="button"
            className="ms-bouton-creux"
            onClick={() => { chargerJournal(true); verifierFonction() }}
            disabled={charge}
          >
            <RefreshCw size={13} aria-hidden="true" className={charge ? 'ms-tourne' : undefined} />
            Actualiser
          </button>
          <button
            type="button"
            className="ms-bouton"
            onClick={ouvrirComposeur}
            disabled={bloque}
            title={bloque ? 'La fonction e-mail doit être prête avant tout envoi.' : 'Prévisualiser puis envoyer un e-mail de contrôle'}
          >
            <Send size={13} aria-hidden="true" />
            Tester / envoyer
          </button>
        </div>
      </header>

      {/* ── la lisière de santé ─────────────────────────── */}
      <div className="ms-sante" data-ton={sante.ton} role="status" aria-live="polite">
        <div className="ms-sante-verdict">
          {sante.ton === 'vert'
            ? <ShieldCheck size={16} aria-hidden="true" />
            : sante.ton === 'alerte'
              ? <ShieldAlert size={16} aria-hidden="true" />
              : <AlertTriangle size={16} aria-hidden="true" />}
          <span>
            <strong>{sante.verdict}</strong>
            {sante.detail && <span className="ms-sante-detail">{sante.detail}</span>}
          </span>
        </div>
        {sante.criteres.length > 0 && (
          <ul className="ms-sante-criteres">
            {sante.criteres.map((critere) => (
              <li key={critere.cle} data-ok={critere.ok ? 'oui' : 'non'}>
                <span className="ms-sante-point" aria-hidden="true" />
                <span className="ms-sante-libelle">{critere.libelle}</span>
                <span className="ms-sante-valeur">{critere.valeur}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {erreurJournal && (
        <div className="ms-avis" data-ton="erreur" role="alert">
          <AlertTriangle size={13} aria-hidden="true" />
          <span>
            Le journal des courriels n’est pas accessible. La migration
            <code> supabase/migrations/20261014000001_email_delivery_monitor.sql </code>
            doit être appliquée. Détail : {erreurJournal}
          </span>
        </div>
      )}

      {/* ── le registre des sept compteurs ──────────────── */}
      <section className="ms-registre" aria-label="Compteurs des tentatives chargées">
        {[
          { cle: 'total', valeur: chiffres.total, libelle: 'tentatives', ton: 'neutre' },
          { cle: 'accepted', valeur: chiffres.accepted, libelle: 'acceptés', ton: 'vert' },
          { cle: 'failed', valeur: chiffres.failed, libelle: 'échecs', ton: 'alerte' },
          { cle: 'partial', valeur: chiffres.partial, libelle: 'partiels', ton: 'attente' },
          { cle: 'notSent', valeur: chiffres.notSent, libelle: 'non envoyés', ton: 'lete' },
          { cle: 'blocked', valeur: chiffres.blocked, libelle: 'bloqués', ton: 'or' },
          { cle: 'today', valeur: chiffres.today, libelle: 'aujourd’hui', ton: 'faible' },
        ].map((cellule) => (
          <div className="ms-registre-cellule" data-ton={cellule.ton} key={cellule.cle}>
            <span className="ms-registre-nombre">{cellule.valeur}</span>
            <span className="ms-registre-libelle">{cellule.libelle}</span>
          </div>
        ))}
      </section>

      <p className="ms-lecture">
        Les chiffres portent sur les {chiffres.total} tentatives chargées : charge les pages plus anciennes pour les étendre.
        « Accepté » veut dire que le fournisseur a pris la demande, pas que le message est arrivé.
      </p>

      {/* ── la barre de lecture ─────────────────────────── */}
      <div className="ms-courriels-barre">
        <label className="ms-courriels-recherche">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={filtres.recherche}
            onChange={(evenement) => setFiltres({ ...filtres, recherche: evenement.target.value })}
            placeholder="Chercher un sujet, une adresse, une erreur…"
            aria-label="Chercher dans le journal des courriels"
          />
        </label>
        <label className="ms-date">
          <span>Statut</span>
          <select value={filtres.statut} onChange={(evenement) => setFiltres({ ...filtres, statut: evenement.target.value })}>
            <option value="all">Tous les statuts</option>
            {STATUTS_COURRIEL.map((item) => <option key={item.cle} value={item.cle}>{item.libelle}</option>)}
          </select>
        </label>
        <label className="ms-date">
          <span>Source</span>
          <select value={filtres.source} onChange={(evenement) => setFiltres({ ...filtres, source: evenement.target.value })}>
            <option value="all">Toutes les sources</option>
            {SOURCES_COURRIEL.map((item) => <option key={item.cle} value={item.cle}>{item.libelle}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="ms-bouton-creux"
          aria-pressed={archives}
          onClick={() => setArchives((courant) => !courant)}
        >
          <Archive size={13} aria-hidden="true" />
          {archives ? 'Voir les actives' : 'Voir les archivés'}
        </button>
        <button
          type="button"
          className="ms-icon-bouton"
          onClick={exporter}
          aria-label="Exporter le journal en CSV"
          title="Exporter cette vue en CSV"
        >
          <Download size={14} aria-hidden="true" />
        </button>
        <span className="ms-compte">{visibles.length} à l’écran</span>
      </div>

      {avis && (
        <p className="ms-avis" data-ton={avis.ton} role="status">
          {avis.ton === 'ok' ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
          {avis.texte}
        </p>
      )}

      {/* ── le journal ──────────────────────────────────── */}
      {charge ? (
        <Chargement />
      ) : visibles.length === 0 ? (
        <div className="ms-vide">
          <Mail size={30} aria-hidden="true" />
          <p className="ms-vide-titre">Aucune tentative dans cette vue</p>
          <p className="ms-vide-texte">
            {logs.length
              ? 'Change le statut, la source ou la recherche : le journal chargé contient d’autres lignes.'
              : 'Les tentatives apparaîtront ici dès qu’un e-mail sera envoyé ou bloqué par la fonction.'}
          </p>
        </div>
      ) : (
        <div className="ms-courriels-liste">
          {visibles.map((log) => {
            const statut = statutCourriel(log)
            const meta = metaStatut(statut)
            const adresses = adressesDe(log)
            const resultats = resultatsDe(log)
            const lignes = lignesDe(log)
            const analyse = analyseDe(log)
            const entreprise = nomsEntreprises[log.enterprise_id] || (log.enterprise_id ? 'Entreprise' : 'Sans entreprise')
            const enAction = action?.id === log.id
            const occupe = travail === log.id
            return (
              <article className="ms-courriel" data-ton={meta.ton} key={log.id}>
                <div className="ms-courriel-tete">
                  <span className="ms-etiquette" data-ton={meta.ton}>{meta.court}</span>
                  <h3 className="ms-courriel-sujet">{log.sujet || 'E-mail sans sujet'}</h3>
                  <span className="ms-courriel-date">{dateCourriel(log.cree_le)}</span>
                </div>

                <p className="ms-courriel-meta">
                  <span>{entreprise}</span>
                  <span aria-hidden="true">·</span>
                  <span>{metaSource(sourceDe(log)).court}</span>
                  <span aria-hidden="true">·</span>
                  <span>{adresses.length ? `${adresses.length} adresse${adresses.length > 1 ? 's' : ''}` : 'adresses non conservées'}</span>
                </p>

                <p className="ms-courriel-comptes">
                  <span data-ton="vert">{Number(log.envoyes) || 0} accepté(s)</span>
                  <span aria-hidden="true">·</span>
                  <span data-ton="alerte">{Number(log.echecs) || 0} échec(s)</span>
                  <span aria-hidden="true">·</span>
                  <span>{Number(log.nb_alertes) || 0} alerte(s)</span>
                </p>

                {log.erreur && (
                  <p className="ms-courriel-erreur">
                    <AlertTriangle size={12} aria-hidden="true" />
                    <span>{log.erreur}</span>
                  </p>
                )}

                {enAction ? (
                  <div className="ms-courriel-confirme" role="group" aria-label="Confirmer cette action">
                    <span>{phraseAction(log)}</span>
                    <button type="button" className="ms-bouton ms-bouton--petit" onClick={() => confirmerAction(log)} disabled={occupe}>
                      {libelleAction()}
                    </button>
                    <button type="button" className="ms-bouton-creux" onClick={() => setAction(null)}>Annuler</button>
                  </div>
                ) : (
                  <div className="ms-courriel-gestes">
                    <button
                      type="button"
                      className="ms-bouton-creux ms-bouton--petit"
                      aria-expanded={ouvert === log.id}
                      onClick={() => basculerDetail(log.id)}
                    >
                      <ChevronDown size={13} aria-hidden="true" className={ouvert === log.id ? 'ms-pivote' : undefined} />
                      {ouvert === log.id ? 'Réduire' : 'Détail'}
                    </button>
                    {!archives && peutRelancer(log) && (
                      <button type="button" className="ms-bouton ms-bouton--petit" onClick={() => demander('relancer', log)} disabled={bloque}>
                        <RotateCcw size={13} aria-hidden="true" /> Relancer
                      </button>
                    )}
                    {!archives && peutCorriger(log) && (
                      <button type="button" className="ms-bouton-creux ms-bouton--petit" onClick={() => ouvrirCorrection(log)} disabled={bloque}>
                        <Pencil size={13} aria-hidden="true" /> Corriger
                      </button>
                    )}
                    <button
                      type="button"
                      className="ms-bouton-creux ms-bouton--petit"
                      onClick={() => demander(archives ? 'restaurer' : 'archiver', log)}
                    >
                      {archives ? <RotateCcw size={13} aria-hidden="true" /> : <Archive size={13} aria-hidden="true" />}
                      {archives ? 'Restaurer' : 'Archiver'}
                    </button>
                  </div>
                )}

                {ouvert === log.id && (
                  <div className="ms-courriel-detail">
                    <div className="ms-courriel-panneau">
                      <p className="ms-eyebrow">Destinataires réels</p>
                      {adresses.length === 0 && <p className="ms-courriel-vide">Aucune adresse conservée pour cette ancienne ligne.</p>}
                      {adresses.length > 0 && resultats.length === 0 && (
                        <p className="ms-courriel-adresse">{adresses.join(', ')}</p>
                      )}
                      {resultats.length > 0 && (
                        <ul className="ms-courriel-resultats">
                          {resultats.map((resultat, index) => (
                            <li data-ok={resultat.statut === 'accepted' ? 'oui' : 'non'} key={`${log.id}-res-${index}`}>
                              <span className="ms-courriel-signe" aria-hidden="true">
                                {resultat.statut === 'accepted' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              </span>
                              <span>{resultat.email}</span>
                              <span className="ms-courriel-raison">
                                {resultat.statut === 'accepted' ? 'accepté'
                                  : resultat.statut === 'blocked' ? 'bloqué avant envoi'
                                    : resultat.statut === 'not_sent' ? 'non envoyé'
                                      : 'échec destinataire'}
                                {resultat.erreur ? ` · ${resultat.erreur}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="ms-courriel-panneau">
                      <p className="ms-eyebrow">Trace technique</p>
                      <dl className="ms-courriel-trace">
                        <div><dt>Fournisseur</dt><dd>{log.fournisseur || 'non renseigné'}</dd></div>
                        <div><dt>Identifiant</dt><dd>{log.provider_message_id || 'non disponible'}</dd></div>
                        <div><dt>Durée</dt><dd>{dureeCourriel(log.duree_ms)}</dd></div>
                        <div><dt>Source</dt><dd>{metaSource(sourceDe(log)).libelle}</dd></div>
                        {log.archived_at && <div><dt>Archivé le</dt><dd>{dateCourriel(log.archived_at)}</dd></div>}
                      </dl>
                    </div>

                    {lignes.length > 0 && (
                      <div className="ms-courriel-panneau ms-courriel-panneau--large">
                        <p className="ms-eyebrow">Contenu enregistré</p>
                        <ul className="ms-courriel-contenu">
                          {lignes.map((ligne, index) => (
                            <li key={`${log.id}-ligne-${index}`}>
                              <strong>{ligne.titre || 'Alerte'}</strong>
                              {ligne.detail ? ` — ${ligne.detail}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analyse.length > 0 && (
                      <div className="ms-courriel-panneau ms-courriel-panneau--large">
                        <p className="ms-eyebrow">Contrôle du routage</p>
                        <ul className="ms-courriel-resultats">
                          {analyse.map((item, index) => (
                            <li data-ok={item.inclus ? 'oui' : 'non'} key={`${log.id}-ana-${index}`}>
                              <span className="ms-courriel-signe" aria-hidden="true">
                                {item.inclus ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              </span>
                              <span>{item.nom || item.email_auth || item.email_fiche || 'Adresse'}</span>
                              <span className="ms-courriel-raison">{item.email_auth || item.email_fiche || 'aucune adresse'} — {item.raison}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {!charge && plusAnciens && (
        <button
          type="button"
          className="ms-courriels-plus"
          onClick={() => chargerJournal(true, true)}
          disabled={chargePlus}
        >
          <Clock3 size={14} aria-hidden="true" />
          Charger les {TAILLE_PAGE} tentatives plus anciennes
        </button>
      )}

      {brouillon && (
        <FenetreModale
          taille="large"
          eyebrow={brouillon.retryOf ? 'Relance · envoi réel' : 'Test · envoi réellement parti'}
          titre={brouillon.retryOf ? 'Corriger et relancer l’e-mail' : 'Tester le routage e-mail'}
          labelledBy="ms-titre-courriel"
          surFermer={fermerComposeur}
          pied={(
            <>
              <span className="ms-fenetre-note">
                {bloque
                  ? 'Envoi bloqué : la fonction e-mail n’est pas prête.'
                  : resume?.nombre
                    ? `${resume.nombre} destinataire(s) après aperçu`
                    : 'Aperçu obligatoire avant tout envoi'}
              </span>
              <button
                type="button"
                className="ms-bouton-creux"
                onClick={previsualiser}
                disabled={travail === 'apercu' || travail === 'envoi' || bloque}
              >
                <Eye size={13} aria-hidden="true" />
                {travail === 'apercu' ? 'Calcul…' : 'Voir les destinataires'}
              </button>
              <button
                type="button"
                className="ms-bouton"
                onClick={() => { setEtape('confirmation'); setConfirmation('') }}
                disabled={!apercu || travail === 'envoi' || bloque || etape === 'confirmation'}
              >
                <Send size={13} aria-hidden="true" />
                Envoyer réellement
              </button>
            </>
          )}
        >
          <div className="ms-composeur">
            <div className="ms-composeur-grille">
              <div className="ms-composeur-colonne">
                {!brouillon.retryOf && (
                  <div className="ms-champ">
                    <span className="ms-champ-libelle">À qui</span>
                    <div className="ms-segments" role="group" aria-label="Destinataires du test">
                      {[
                        { cle: 'self', libelle: 'Mon adresse' },
                        { cle: 'admin', libelle: 'Un administrateur' },
                        { cle: 'manual', libelle: 'Des adresses' },
                        { cle: 'enterprise', libelle: 'Une entreprise' },
                      ].map((mode) => (
                        <button
                          key={mode.cle}
                          type="button"
                          className="ms-segment"
                          data-actif={brouillon.mode === mode.cle ? 'oui' : 'non'}
                          aria-pressed={brouillon.mode === mode.cle}
                          onClick={() => modifierBrouillon('mode', mode.cle)}
                        >
                          {mode.libelle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {brouillon.mode === 'admin' && !brouillon.retryOf && (
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Administrateur destinataire</span>
                    <select value={brouillon.adminId} onChange={(evenement) => modifierBrouillon('adminId', evenement.target.value)}>
                      <option value="">Choisir un administrateur</option>
                      {admins.filter((item) => item.email).map((item) => (
                        <option key={item.id} value={item.id}>
                          {`${item.first_name || ''} ${item.last_name || ''}`.trim()} — {item.email}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {brouillon.mode === 'enterprise' && !brouillon.retryOf && (
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Entreprise</span>
                    <select value={brouillon.entrepriseId} onChange={(evenement) => modifierBrouillon('entrepriseId', evenement.target.value)}>
                      <option value="">Choisir une entreprise</option>
                      {entreprises.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <span className="ms-champ-note">
                      L’aperçu suit le routage réel : admins actifs, rattachés, alertes ouvertes et compte lié.
                    </span>
                  </label>
                )}

                {(brouillon.mode === 'manual' || brouillon.retryOf) && (
                  <label className="ms-champ">
                    <span className="ms-champ-libelle">Destinataires</span>
                    <textarea
                      rows={2}
                      value={brouillon.recipientsText}
                      onChange={(evenement) => modifierBrouillon('recipientsText', evenement.target.value)}
                      placeholder="admin@exemple.com, autre@exemple.com"
                    />
                    <span className="ms-champ-note">
                      {adressesValides(brouillon.recipientsText).length} adresse(s) retenue(s), séparées par des virgules.
                    </span>
                  </label>
                )}

                <label className="ms-champ">
                  <span className="ms-champ-libelle">Sujet complémentaire</span>
                  <input
                    type="text"
                    maxLength={160}
                    value={brouillon.subject}
                    onChange={(evenement) => modifierBrouillon('subject', evenement.target.value)}
                  />
                </label>

                <label className="ms-champ">
                  <span className="ms-champ-libelle">Lien du tableau de bord</span>
                  <input
                    type="text"
                    value={brouillon.link}
                    onChange={(evenement) => modifierBrouillon('link', evenement.target.value)}
                  />
                </label>

                <div className="ms-lignes-tete">
                  <span className="ms-champ-libelle">Contenu du message</span>
                  <button type="button" className="ms-bouton-creux ms-bouton--petit" onClick={ajouterLigne}>
                    <Pencil size={12} aria-hidden="true" /> Ajouter une ligne
                  </button>
                </div>

                <div className="ms-lignes">
                  {brouillon.lines.map((ligne, index) => (
                    <fieldset className="ms-ligne" key={`ligne-${index}`}>
                      <legend>Alerte {index + 1}</legend>
                      <label className="ms-champ">
                        <span className="ms-champ-libelle">Titre</span>
                        <input
                          type="text"
                          maxLength={200}
                          value={ligne.titre}
                          onChange={(evenement) => modifierLigne(index, 'titre', evenement.target.value)}
                        />
                      </label>
                      <label className="ms-champ">
                        <span className="ms-champ-libelle">Détail</span>
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={ligne.detail}
                          onChange={(evenement) => modifierLigne(index, 'detail', evenement.target.value)}
                        />
                      </label>
                      <label className="ms-champ">
                        <span className="ms-champ-libelle">Gravité</span>
                        <select value={ligne.gravite} onChange={(evenement) => modifierLigne(index, 'gravite', evenement.target.value)}>
                          {GRAVITES_LIGNE.map((item) => <option key={item.cle} value={item.cle}>{item.libelle}</option>)}
                        </select>
                      </label>
                      {brouillon.lines.length > 1 && (
                        <button
                          type="button"
                          className="ms-icon-bouton ms-ligne-retirer"
                          onClick={() => retirerLigne(index)}
                          aria-label={`Retirer l’alerte ${index + 1}`}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      )}
                    </fieldset>
                  ))}
                </div>
              </div>

              <aside className="ms-apercu-courriel" aria-live="polite">
                <p className="ms-eyebrow">Aperçu · aucun e-mail envoyé</p>
                {apercu ? (
                  <>
                    <p className="ms-apercu-courriel-titre">
                      {apercu.entreprise ? `Entreprise : ${apercu.entreprise}` : 'Destinataires directs'}
                    </p>
                    {apercu.destinataires.length ? (
                      <ul className="ms-puces">
                        {apercu.destinataires.map((adresse) => <li key={adresse}>{adresse}</li>)}
                      </ul>
                    ) : (
                      <p className="ms-courriel-vide">Aucun destinataire éligible.</p>
                    )}
                    {apercu.note && <p className="ms-apercu-courriel-note">{apercu.note}</p>}
                    {apercu.analyse.length > 0 && (
                      <>
                        <p className="ms-eyebrow">Contrôle des fiches</p>
                        <ul className="ms-courriel-resultats">
                          {apercu.analyse.map((item, index) => (
                            <li data-ok={item.inclus ? 'oui' : 'non'} key={`${item.admin_id || item.email_auth || 'fiche'}-${index}`}>
                              <span className="ms-courriel-signe" aria-hidden="true">
                                {item.inclus ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              </span>
                              <span>{item.nom || item.email_auth || item.email_fiche || 'Adresse'}</span>
                              <span className="ms-courriel-raison">
                                {item.email_auth || item.email_fiche || 'aucune adresse'} — {item.raison}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <p className="ms-apercu-courriel-pied">
                      « Accepté » au fournisseur ne vaut pas « reçu ». Les événements de livraison demandent le suivi Brevo.
                    </p>
                  </>
                ) : (
                  <p className="ms-apercu-courriel-vide">
                    Demande l’aperçu pour voir exactement qui recevra ce message. Rien ne part avant la confirmation.
                  </p>
                )}
              </aside>
            </div>

            {avis && (
              <p className="ms-avis" data-ton={avis.ton} role="status">
                {avis.ton === 'ok' ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
                {avis.texte}
              </p>
            )}

            {etape === 'confirmation' && apercu && (
              <div className="ms-confirmation-envoi">
                <p>
                  <strong>{apercu.destinataires.length} destinataire(s) réels.</strong>
                  {' '}Tape <code>{MOT_ENVOI}</code> pour que le fournisseur parte.
                </p>
                <input
                  type="text"
                  value={confirmation}
                  onChange={(evenement) => setConfirmation(evenement.target.value)}
                  aria-label={`Taper ${MOT_ENVOI} pour confirmer l’envoi`}
                  placeholder={MOT_ENVOI}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="ms-bouton ms-bouton--danger"
                  onClick={envoyer}
                  disabled={!confirmationEnvoiValide(confirmation) || travail === 'envoi'}
                >
                  <Send size={13} aria-hidden="true" />
                  {travail === 'envoi' ? 'Envoi…' : 'Confirmer l’envoi'}
                </button>
                <button type="button" className="ms-bouton-creux" onClick={() => setEtape('edition')}>
                  Revenir au brouillon
                </button>
              </div>
            )}
          </div>
        </FenetreModale>
      )}
    </div>
  )
}
