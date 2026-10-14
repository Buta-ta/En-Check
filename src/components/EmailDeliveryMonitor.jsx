import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Archive,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  Mail,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const FUNCTION_VERSION = 'email-monitor-v1'
const LOG_PAGE_SIZE = 250
const DEFAULT_LINE = () => ({
  titre: 'Test d’envoi En-Check',
  detail: 'Vérification de la réception des alertes e-mail.',
  quand: new Date().toLocaleString('fr-FR'),
  gravite: 'info',
  type: 'essai',
})

const parseAddresses = (value) => [...new Set(
  String(value || '')
    .split(/[\n,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)),
)]

const statusOf = (log) => {
  if (log.statut) return log.statut
  if ((log.envoyes || 0) > 0 && (log.echecs || 0) > 0) return 'partial'
  return (log.envoyes || 0) > 0 ? 'accepted' : 'failed'
}

const statusMeta = {
  accepted: { label: 'Accepté par le fournisseur', color: '#34D399', Icon: CheckCircle2 },
  failed: { label: 'Échec fournisseur', color: '#F87171', Icon: XCircle },
  partial: { label: 'Partiel — à vérifier', color: '#FBBF24', Icon: AlertCircle },
  not_sent: { label: 'Non envoyé avant acceptation', color: '#FB923C', Icon: AlertCircle },
  blocked: { label: 'Bloqué — limite de sécurité', color: '#FBBF24', Icon: ShieldAlert },
}

const formatDate = (value) => {
  if (!value) return 'Date inconnue'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date inconnue'
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

async function functionErrorMessage(error) {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json()
      if (body?.detail) return body.detail
      if (body?.erreur) return body.erreur
      if (body?.error) return body.error
      if (body?.message) return body.message
    } catch {
      // La réponse d'erreur peut déjà avoir été lue par supabase-js.
    }
  }
  return error?.message || 'La fonction e-mail n’a pas répondu.'
}

function makeRequestBody(draft, previewOnly = false) {
  const body = {
    sujet: draft.subject.trim(),
    lien: draft.link.trim(),
    lignes: draft.lines
      .filter((line) => line.titre.trim() || line.detail.trim())
      .map((line) => ({ ...line })),
  }

  if (draft.mode === 'enterprise' && !draft.retryOf) {
    body.enterprise_id = draft.enterpriseId
  } else {
    body.destinataires = parseAddresses(draft.recipientsText)
    if (draft.enterpriseId) body.enterprise_id = draft.enterpriseId
  }

  if (draft.retryOf) body.retry_of = draft.retryOf
  if (previewOnly) body.preview_only = true
  return body
}

export default function EmailDeliveryMonitor() {
  const [logs, setLogs] = useState([])
  const [hasMoreLogs, setHasMoreLogs] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const logsCountRef = useRef(0)
  const [enterprises, setEnterprises] = useState([])
  const [admins, setAdmins] = useState([])
  const [currentEmail, setCurrentEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [logError, setLogError] = useState('')
  const [functionHealth, setFunctionHealth] = useState({ state: 'checking', message: 'Vérification de la fonction e-mail…' })
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [workingId, setWorkingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [preview, setPreview] = useState(null)
  const [draft, setDraft] = useState(null)

  const loadLogs = useCallback(async (quiet = false, append = false) => {
    if (append) setLoadingMore(true)
    else if (quiet) setRefreshing(true)
    else setLoading(true)

    const from = append ? logsCountRef.current : 0
    const to = append
      ? from + LOG_PAGE_SIZE - 1
      : Math.max(LOG_PAGE_SIZE, logsCountRef.current) - 1
    const requestedCount = to - from + 1
    const { data, error } = await supabase
      .from('encheck_email_logs')
      .select('*')
      .order('cree_le', { ascending: false })
      .range(from, to)

    if (error) {
      setLogError(error.message || 'Impossible de lire l’historique des e-mails.')
      if (!append) setLogs([])
    } else {
      const rows = data || []
      setLogError('')
      setLogs((current) => append ? [...current, ...rows] : rows)
      logsCountRef.current = from + rows.length
      setHasMoreLogs(rows.length === requestedCount)
    }

    if (append) setLoadingMore(false)
    else if (quiet) setRefreshing(false)
    else setLoading(false)
  }, [])

  const checkFunction = useCallback(async () => {
    setFunctionHealth({ state: 'checking', message: 'Vérification de la fonction e-mail…' })
    const { data, error } = await supabase.functions.invoke('send-email', { method: 'GET' })
    if (error) {
      const message = await functionErrorMessage(error)
      const methodNotAllowed = error?.context?.status === 405 || /method_not_allowed/i.test(message)
      setFunctionHealth({
        state: 'old',
        message: methodNotAllowed
          ? 'La fonction actuellement déployée sur Supabase est une ancienne version (HTTP 405).'
          : 'La fonction e-mail de Supabase doit être mise à jour avant les tests.',
        detail: methodNotAllowed
          ? 'Elle ne reconnaît pas le contrôle de santé GET. Déploie la fonction « send-email » mise à jour depuis le dépôt, puis clique sur Actualiser. Les envois restent bloqués pour éviter un test sans aperçu fiable.'
          : message,
      })
      return
    }
    if (data?.version !== FUNCTION_VERSION) {
      setFunctionHealth({
        state: 'old',
        message: 'La fonction e-mail de Supabase doit être mise à jour avant les tests.',
        detail: 'La version active ne possède pas encore l’aperçu sans envoi et le journal. Déploie « send-email » depuis le dépôt, puis clique sur Actualiser.'
      })
      return
    }
    setFunctionHealth({
      state: 'ready',
      message: 'Fonction e-mail connectée.',
      configuration: data.configuration || {},
    })
  }, [])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      await loadLogs()
      const [enterpriseResult, adminResult, userResult] = await Promise.all([
        supabase.from('enterprises').select('id, name').eq('is_active', true).order('name'),
        supabase.from('admins')
          .select('id, first_name, last_name, email, role, is_active, alertes_email, enterprise_id, user_id')
          .eq('is_active', true)
          .order('first_name'),
        supabase.auth.getUser(),
      ])
      if (!mounted) return
      setEnterprises(enterpriseResult.data || [])
      setAdmins(adminResult.data || [])
      const localAdmin = (() => {
        try { return JSON.parse(localStorage.getItem('admin') || '{}') } catch { return {} }
      })()
      setCurrentEmail(userResult.data?.user?.email || localAdmin.email || '')
      await checkFunction()
    }
    init()
    const refreshTimer = window.setInterval(() => { if (mounted) loadLogs(true) }, 30000)
    return () => { mounted = false; window.clearInterval(refreshTimer) }
  }, [checkFunction, loadLogs])

  const enterpriseNames = useMemo(
    () => Object.fromEntries(enterprises.map((enterprise) => [enterprise.id, enterprise.name])),
    [enterprises],
  )

  const visibleLogs = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return logs.filter((log) => {
      if (Boolean(log.archived_at) !== showArchived) return false
      if (statusFilter !== 'all' && statusOf(log) !== statusFilter) return false
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false
      if (!needle) return true
      return [
        log.sujet,
        log.destinataires,
        log.erreur,
        enterpriseNames[log.enterprise_id],
        log.source,
      ].some((value) => String(value || '').toLowerCase().includes(needle))
    })
  }, [logs, showArchived, statusFilter, sourceFilter, search, enterpriseNames])

  const stats = useMemo(() => {
    const activeLogs = logs.filter((log) => !log.archived_at)
    const today = new Date().toLocaleDateString('en-CA')
    return {
      total: activeLogs.length,
      accepted: activeLogs.filter((log) => statusOf(log) === 'accepted').length,
      failed: activeLogs.filter((log) => statusOf(log) === 'failed').length,
      partial: activeLogs.filter((log) => statusOf(log) === 'partial').length,
      notSent: activeLogs.filter((log) => statusOf(log) === 'not_sent').length,
      blocked: activeLogs.filter((log) => statusOf(log) === 'blocked').length,
      today: activeLogs.filter((log) => new Date(log.cree_le).toLocaleDateString('en-CA') === today).length,
    }
  }, [logs])

  const openTest = () => {
    setPreview(null)
    setDraft({
      mode: 'self',
      enterpriseId: '',
      adminId: '',
      recipientsText: currentEmail,
      subject: 'Test d’envoi En-Check',
      link: `${window.location.origin}/pointages`,
      lines: [DEFAULT_LINE()],
      retryOf: null,
    })
    setModalOpen(true)
  }

  const openEditRetry = (log) => {
    const payload = log.payload || {}
    const lines = Array.isArray(payload.lignes) ? payload.lignes : []
    const savedRecipients = Array.isArray(payload.destinataires)
      ? payload.destinataires
      : Array.isArray(log.destinataires_json)
      ? log.destinataires_json
      : String(log.destinataires || '').split(',').map((email) => email.trim()).filter(Boolean)
    const outcomes = Array.isArray(log.resultats_destinataires)
      ? log.resultats_destinataires
      : Array.isArray(payload.resultats_destinataires)
      ? payload.resultats_destinataires
      : []
    const retryRecipients = statusOf(log) === 'partial' && outcomes.length > 0
      ? outcomes.filter((item) => ['failed', 'not_sent'].includes(item.statut)).map((item) => item.email).filter(Boolean)
      : savedRecipients

    const enterpriseId = log.enterprise_id || payload.enterprise_id || ''
    if (!lines.length || (!retryRecipients.length && !enterpriseId)) {
      toast.error('Cette ancienne tentative ne contient pas assez de détails pour être corrigée et relancée.')
      return
    }

    setPreview(null)
    setDraft({
      mode: retryRecipients.length ? 'retry' : 'manual',
      enterpriseId,
      adminId: '',
      recipientsText: retryRecipients.join(', '),
      subject: payload.sujet || '',
      link: payload.lien || `${window.location.origin}/pointages`,
      lines: lines.map((line) => ({
        titre: String(line.titre || ''),
        detail: String(line.detail || ''),
        quand: String(line.quand || ''),
        gravite: ['critique', 'attention', 'info'].includes(line.gravite) ? line.gravite : 'info',
        type: String(line.type || 'essai'),
        employe: String(line.employe || ''),
      })),
      retryOf: log.id,
    })
    setModalOpen(true)
  }

  const updateDraft = (key, value) => {
    setDraft((previous) => ({ ...previous, [key]: value }))
    setPreview(null)
  }

  const updateLine = (index, key, value) => {
    setDraft((previous) => ({
      ...previous,
      lines: previous.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line),
    }))
    setPreview(null)
  }

  const getDraftBody = (previewOnly = false) => {
    if (!draft) return null
    const prepared = { ...draft }
    if (prepared.mode === 'self') prepared.recipientsText = currentEmail
    if (prepared.mode === 'admin') {
      const selectedAdmin = admins.find((item) => item.id === prepared.adminId)
      prepared.recipientsText = selectedAdmin?.email || ''
    }
    return makeRequestBody(prepared, previewOnly)
  }

  const previewDraft = async () => {
    if (!draft) return
    const requestBody = getDraftBody(true)
    if (requestBody.destinataires && requestBody.destinataires.length === 0) {
      toast.error('Ajoute une adresse e-mail valide avant de continuer.')
      return
    }
    if (draft.mode === 'enterprise' && !draft.enterpriseId) {
      toast.error('Sélectionne d’abord une entreprise.')
      return
    }
    if (!requestBody.lignes.length) {
      toast.error('Ajoute au moins une ligne au message.')
      return
    }

    setWorkingId('preview')
    try {
      const { data, error } = await supabase.functions.invoke('send-email', { body: requestBody })
      if (error) throw new Error(await functionErrorMessage(error))
      if (data?.ok === true && Array.isArray(data.destinataires) && data.destinataires.length === 0) {
        setPreview({ recipients: [], enterprise: data.entreprise || '', note: data.note || 'Aucun destinataire éligible.', analysis: data.analyse_destinataires || [] })
        toast('Aucun destinataire éligible pour cette entreprise.', { icon: 'ℹ️' })
        return
      }
      if (data?.preview !== true) {
        throw new Error('La fonction active ne confirme pas l’aperçu sans envoi. Mets à jour la fonction Supabase avant de continuer.')
      }
      setPreview({ recipients: data.destinataires || [], enterprise: data.entreprise || '', note: data.note || '', analysis: data.analyse_destinataires || [] })
      if (!(data.destinataires || []).length) toast('Aucun destinataire éligible pour cette entreprise.', { icon: 'ℹ️' })
    } catch (error) {
      toast.error(error.message || 'Impossible de calculer les destinataires.')
    } finally {
      setWorkingId(null)
    }
  }

  const sendDraft = async () => {
    if (!draft) return
    const requestBody = getDraftBody(false)
    if (!preview) {
      toast.error('Clique d’abord sur « Voir les destinataires »; aucun e-mail ne partira sans cet aperçu.')
      return
    }
    if (!preview.recipients.length) {
      toast.error('Il n’y a aucun destinataire à contacter.')
      return
    }
    if (!requestBody.lignes.length) {
      toast.error('Ajoute au moins une ligne au message.')
      return
    }
    const recipientList = preview.recipients.join('\n• ')
    if (!window.confirm(`Un vrai e-mail va être envoyé à ${preview.recipients.length} destinataire(s) :\n\n• ${recipientList}\n\nContinuer ?`)) return

    setWorkingId('send')
    try {
      const { data, error } = await supabase.functions.invoke('send-email', { body: requestBody })
      if (error) throw new Error(await functionErrorMessage(error))
      const acceptedCount = Number(data?.envoyes || 0)
      const failureCount = Number(data?.echecs || 0)
      if (data?.ok !== true && acceptedCount === 0) throw new Error(data?.erreur || data?.error || data?.note || 'Échec de l’envoi.')
      const providerLabel = data?.fournisseur === 'brevo' ? 'Brevo' : data?.fournisseur === 'smtp' ? 'SMTP' : 'Le fournisseur'
      if (data.journalise === false) {
        toast.error(`${providerLabel} a accepté ${acceptedCount} envoi(s), mais le journal est indisponible. Ne relance pas tout de suite pour éviter un doublon.`)
      } else if (failureCount > 0) {
        toast('Envoi partiel : ' + acceptedCount + ' accepté(s), ' + failureCount + ' échec(s). Consulte le journal avant toute nouvelle action.', { icon: '⚠️' })
      } else {
        toast.success(`${providerLabel} a accepté l’envoi à ${acceptedCount} destinataire(s).`)
      }
      await loadLogs(true)
      setModalOpen(false)
      setDraft(null)
      setPreview(null)
    } catch (error) {
      toast.error(error.message || 'L’e-mail n’a pas été envoyé.')
      await loadLogs(true)
    } finally {
      setWorkingId(null)
    }
  }

  const retryDirectly = async (log) => {
    const payload = log.payload || {}
    const recipients = Array.isArray(payload.destinataires) ? payload.destinataires : []
    const lines = Array.isArray(payload.lignes) ? payload.lignes : []
    if (statusOf(log) !== 'failed' || (log.envoyes || 0) > 0) {
      toast.error('Pour éviter un doublon, la relance directe est réservée aux tentatives entièrement échouées.')
      return
    }
    if (!recipients.length || !lines.length) {
      toast.error('Cette ancienne tentative ne contient pas les détails nécessaires à une relance.')
      return
    }
    if (!window.confirm(`Relancer le message vers ${recipients.length} destinataire(s) ?\n\n${recipients.join('\n')}`)) return

    setWorkingId(log.id)
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          enterprise_id: payload.enterprise_id || log.enterprise_id || undefined,
          destinataires: recipients,
          sujet: payload.sujet || undefined,
          lien: payload.lien || undefined,
          lignes: lines,
          retry_of: log.id,
        },
      })
      if (error) throw new Error(await functionErrorMessage(error))
      const acceptedCount = Number(data?.envoyes || 0)
      const failureCount = Number(data?.echecs || 0)
      if (data?.ok !== true && acceptedCount === 0) throw new Error(data?.erreur || data?.error || 'La relance a échoué.')
      if (data.journalise === false) {
        toast.error(`Le fournisseur a accepté ${acceptedCount} envoi(s), mais le journal est indisponible. Ne relance pas tout de suite pour éviter un doublon.`)
      } else if (failureCount > 0) {
        toast('Relance partielle : ' + acceptedCount + ' accepté(s), ' + failureCount + ' échec(s). Consulte le journal.', { icon: '⚠️' })
      } else {
        toast.success(`Relance acceptée par le fournisseur pour ${acceptedCount} destinataire(s).`)
      }
      await loadLogs(true)
    } catch (error) {
      toast.error(error.message || 'Impossible de relancer cet e-mail.')
      await loadLogs(true)
    } finally {
      setWorkingId(null)
    }
  }

  const archiveLog = async (log, restore = false) => {
    const action = restore ? 'restaurer' : 'archiver'
    if (!window.confirm(`Veux-tu ${action} cette entrée ? L’archivage ne supprime ni ne rappelle l’e-mail.`)) return
    setWorkingId(log.id)
    const { error } = await supabase
      .from('encheck_email_logs')
      .update({ archived_at: restore ? null : new Date().toISOString() })
      .eq('id', log.id)
    if (error) toast.error(`Impossible d’${restore ? 'restaurer' : 'archiver'} l’entrée : ${error.message}`)
    else {
      const archivedAt = restore ? null : new Date().toISOString()
      setLogs((current) => current.map((item) => item.id === log.id ? { ...item, archived_at: archivedAt } : item))
      toast.success(restore ? 'Entrée restaurée.' : 'Entrée archivée. Elle reste conservée pour le contrôle.')
    }
    setWorkingId(null)
  }

  const addLine = () => {
    setDraft((previous) => ({ ...previous, lines: [...previous.lines, { titre: '', detail: '', quand: '', gravite: 'info', type: 'essai' }] }))
    setPreview(null)
  }

  const removeLine = (index) => {
    setDraft((previous) => ({ ...previous, lines: previous.lines.filter((_, lineIndex) => lineIndex !== index) }))
    setPreview(null)
  }

  const functionReady = functionHealth.state === 'ready'
  const secretsReady = functionHealth.configuration?.sender_configured && functionHealth.configuration?.provider_configured && functionHealth.configuration?.origin_allowed !== false
  const automaticReady = functionReady && secretsReady && functionHealth.configuration?.trigger_secret_configured
  const canSend = functionReady && secretsReady && !logError
  const filteredAdmins = admins.filter((admin) => admin.is_active && admin.email)

  return (
    <section className="email-monitor" style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.title}>Contrôle des e-mails</h2>
          <p style={styles.subtitle}>Historique, destinataires réels, erreurs et relances.</p>
        </div>
        <div style={styles.topActions}>
          <button type="button" onClick={() => { loadLogs(true); checkFunction() }} disabled={refreshing || functionHealth.state === 'checking'} style={styles.secondaryButton}>
            <RefreshCw size={16} className={refreshing ? 'email-spin' : ''} /> Actualiser
          </button>
          <button type="button" onClick={openTest} disabled={!canSend} style={styles.primaryButton} title={!canSend ? 'Vérifie la fonction, les secrets et la migration SQL.' : 'Prévisualiser puis envoyer un e-mail de test'}>
            <Send size={16} /> Tester / envoyer
          </button>
        </div>
      </div>

      <div style={{ ...styles.health, borderColor: automaticReady ? 'rgba(52,211,153,.35)' : functionHealth.state === 'old' ? 'rgba(248,113,113,.42)' : 'rgba(251,191,36,.3)' }}>
        {functionHealth.state === 'checking' ? <RefreshCw size={18} color="#FBBF24" className="email-spin" /> : automaticReady ? <ShieldCheck size={18} color="#34D399" /> : functionHealth.state === 'old' ? <AlertCircle size={18} color="#F87171" /> : <AlertCircle size={18} color="#FBBF24" />}
        <div>
          <strong>{functionHealth.message}</strong>
          {functionHealth.detail && <p>{functionHealth.detail}</p>}
          {functionReady && (
            <p>
              Expéditeur : {functionHealth.configuration?.sender_configured ? 'configuré' : 'MANQUANT'} ·
              {' '}Brevo/SMTP : {functionHealth.configuration?.provider_configured ? 'configuré' : 'MANQUANT'} ·
              {' '}Origine du site : {functionHealth.configuration?.origin_allowed ? 'autorisée' : 'À autoriser'} ·
              {' '}Secret SQL : {functionHealth.configuration?.trigger_secret_configured ? 'configuré' : 'MANQUANT'}
            </p>
          )}
        </div>
      </div>

      {logError ? (
        <div style={styles.setupError}>
          <AlertCircle size={22} />
          <div>
            <strong>L’historique e-mail n’est pas encore accessible.</strong>
            <p>La table de suivi ou ses droits ne sont pas installés dans Supabase. La migration à appliquer est <code>supabase/migrations/20261014000001_email_delivery_monitor.sql</code>.</p>
            <small>Détail technique : {logError}</small>
          </div>
        </div>
      ) : (
        <>
          <div style={styles.stats}>
            <StatCard label="Tentatives chargées" value={stats.total} color="#60A5FA" Icon={Mail} />
            <StatCard label="Acceptées par le fournisseur" value={stats.accepted} color="#34D399" Icon={CheckCircle2} />
            <StatCard label="Échecs à traiter" value={stats.failed} color="#F87171" Icon={XCircle} />
            <StatCard label="Partiels à vérifier" value={stats.partial} color="#FBBF24" Icon={AlertCircle} />
            <StatCard label="Non envoyés avant acceptation" value={stats.notSent} color="#FB923C" Icon={Users} />
            <StatCard label="Bloqués" value={stats.blocked} color="#FBBF24" Icon={ShieldAlert} />
            <StatCard label="Aujourd’hui (chargées)" value={stats.today} color="#A78BFA" Icon={Clock3} />
          </div>
          <small style={styles.historyNote}>Les indicateurs portent sur les tentatives actuellement chargées. Charge les pages plus anciennes pour étendre les chiffres et la recherche.</small>

          <div style={styles.notice}>
            <AlertCircle size={17} />
            « Accepté » signifie que le fournisseur a accepté la demande, pas que le message a forcément atteint la boîte de réception. Les événements de livraison et de rebond nécessitent le suivi du fournisseur.
          </div>

          <div style={styles.toolbar}>
            <label style={styles.searchBox}>
              <Search size={16} color="#94A3B8" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Chercher entreprise, adresse, erreur…" style={styles.searchInput} />
            </label>
            <label style={styles.selectBox}>
              <Filter size={15} color="#94A3B8" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}>
                <option value="all">Tous les statuts</option>
                <option value="accepted">Accepté par le fournisseur</option>
                <option value="failed">Échec</option>
                <option value="partial">Partiel</option>
                <option value="not_sent">Non envoyé avant acceptation</option>
                <option value="blocked">Bloqué</option>
              </select>
            </label>
            <label style={styles.selectBox}>
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} style={styles.select}>
                <option value="all">Toutes les sources</option>
                <option value="base">Automatique (base)</option>
                <option value="tableau_de_bord">Tableau de bord</option>
                <option value="relance">Relance</option>
              </select>
            </label>
            <button type="button" onClick={() => setShowArchived((value) => !value)} style={styles.secondaryButton}>
              <Archive size={15} /> {showArchived ? 'Voir les actifs' : 'Voir les archivés'}
            </button>
          </div>

          {loading ? (
            <div style={styles.empty}><RefreshCw className="email-spin" size={24} /> Chargement de l’historique…</div>
          ) : visibleLogs.length === 0 ? (
            <div style={styles.empty}>
              <Mail size={36} color="#64748B" />
              <strong>Aucun e-mail dans cette vue.</strong>
              <span>Les tentatives apparaîtront ici dès qu’un e-mail sera envoyé ou bloqué par la fonction.</span>
            </div>
          ) : (
            <div style={styles.logList}>
              {visibleLogs.map((log) => {
                const status = statusOf(log)
                const meta = statusMeta[status] || statusMeta.failed
                const Icon = meta.Icon
                const recipients = Array.isArray(log.destinataires_json)
                  ? log.destinataires_json
                  : String(log.destinataires || '').split(',').map((email) => email.trim()).filter(Boolean)
                const payload = log.payload || {}
                const recipientOutcomes = Array.isArray(log.resultats_destinataires)
                  ? log.resultats_destinataires
                  : Array.isArray(payload.resultats_destinataires)
                  ? payload.resultats_destinataires
                  : []
                const storedRecipients = Array.isArray(payload.destinataires) ? payload.destinataires.length : recipients.length
                const hasEditablePayload = Array.isArray(payload.lignes) && payload.lignes.length > 0
                const canRetry = status === 'failed' && (log.envoyes || 0) === 0 && hasEditablePayload && storedRecipients > 0
                const hasPartialFailures = recipientOutcomes.some((item) => ['failed', 'not_sent'].includes(item.statut) && item.email)
                const canEditRetry = (
                  ['failed', 'not_sent'].includes(status) && hasEditablePayload && (storedRecipients > 0 || log.enterprise_id || payload.enterprise_id)
                ) || (status === 'partial' && hasEditablePayload && hasPartialFailures)
                const isExpanded = expandedId === log.id
                return (
                  <article key={log.id} style={styles.logCard}>
                    <div style={styles.logMain}>
                      <div style={{ ...styles.statusIcon, color: meta.color, background: `${meta.color}18` }}><Icon size={18} /></div>
                      <div style={styles.logSummary}>
                        <div style={styles.logTitleRow}>
                          <strong>{log.sujet || 'E-mail sans sujet'}</strong>
                          <span style={{ ...styles.statusPill, color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}12` }}>{meta.label}</span>
                        </div>
                        <div style={styles.metaLine}>
                          <span><Clock3 size={13} /> {formatDate(log.cree_le)}</span>
                          <span><Building2 size={13} /> {enterpriseNames[log.enterprise_id] || (log.enterprise_id ? 'Entreprise' : 'Sans entreprise')}</span>
                          <span>{log.source === 'base' ? 'Automatique' : log.source === 'relance' ? 'Relance' : 'Test/tableau de bord'}</span>
                        </div>
                        <p style={styles.recipientLine}><Mail size={13} /> {recipients.length ? recipients.join(', ') : 'Aucun destinataire enregistré'}</p>
                        <div style={styles.counts}>
                          <span style={{ color: '#34D399' }}>{log.envoyes || 0} accepté(s)</span>
                          <span style={{ color: '#F87171' }}>{log.echecs || 0} échec(s)</span>
                          <span>{log.nb_alertes || 0} alerte(s)</span>
                        </div>
                        {log.erreur && <div style={styles.errorText}><AlertCircle size={14} /> {log.erreur}</div>}
                      </div>
                      <div style={styles.rowActions}>
                        <button type="button" onClick={() => setExpandedId(isExpanded ? null : log.id)} style={styles.iconButton} title="Voir les détails"><Eye size={16} /></button>
                        {!showArchived && canRetry && (
                          <button type="button" onClick={() => retryDirectly(log)} disabled={workingId === log.id || !canSend} style={styles.actionButton} title="Renvoyer à la même liste">
                            <RotateCcw size={15} /> Relancer
                          </button>
                        )}
                        {!showArchived && canEditRetry && (
                          <button type="button" onClick={() => openEditRetry(log)} disabled={!canSend} style={styles.iconButton} title="Corriger les destinataires ou le message, puis relancer"><Pencil size={16} /></button>
                        )}
                        <button type="button" onClick={() => archiveLog(log, showArchived)} disabled={workingId === log.id} style={styles.iconButton} title={showArchived ? 'Restaurer' : 'Archiver'}>
                          {showArchived ? <RotateCcw size={16} /> : <Archive size={16} />}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={styles.detailPanel}>
                        <div><b>Destinataires réels :</b> {recipients.length ? recipients.join(', ') : 'non conservés pour cette ancienne ligne'}</div>
                        <div><b>Fournisseur :</b> {log.fournisseur || 'non renseigné'} · <b>Identifiant fournisseur :</b> {log.provider_message_id || 'non disponible'}</div>
                        {recipientOutcomes.length > 0 ? (
                          <div style={styles.auditRows}>
                            <b>Résultat par adresse :</b>
                            {recipientOutcomes.map((item, index) => {
                              const label = item.statut === 'accepted'
                                ? 'Accepté par le fournisseur'
                                : item.statut === 'blocked'
                                ? 'Bloqué avant envoi'
                                : item.statut === 'not_sent'
                                ? 'Non envoyé / non confirmé'
                                : 'Échec destinataire'
                              const color = item.statut === 'accepted' ? '#A7F3D0' : item.statut === 'blocked' ? '#FCD34D' : '#FCA5A5'
                              return <div key={`${log.id}-outcome-${index}`} style={{ color }}>{item.statut === 'accepted' ? '✓' : '×'} {item.email} — {label}{item.erreur ? ` · ${item.erreur}` : ''}</div>
                            })}
                          </div>
                        ) : recipients.length > 0 && (
                          <div style={styles.detailHint}>Le détail individuel n’est pas disponible pour cette ancienne tentative.</div>
                        )}
                        <div><b>Durée :</b> {log.duree_ms != null ? `${log.duree_ms} ms` : 'non mesurée'} · <b>Source :</b> {log.source || 'ancienne version'}</div>
                        {Array.isArray(payload.lignes) && payload.lignes.length > 0 && (
                          <div style={styles.alertDetails}>
                            <b>Contenu enregistré :</b>
                            {payload.lignes.map((line, index) => <div key={`${log.id}-line-${index}`}>• {line.titre || 'Alerte'} — {line.detail || ''}</div>)}
                          </div>
                        )}
                        {Array.isArray(payload.analyse_destinataires) && payload.analyse_destinataires.length > 0 && (
                          <div style={styles.auditRows}>
                            <b>Contrôle du routage :</b>
                            {payload.analyse_destinataires.map((item, index) => (
                              <div key={`${log.id}-recipient-${index}`} style={{ color: item.inclus ? '#A7F3D0' : '#FCA5A5' }}>
                                {item.inclus ? '✓' : '×'} {item.nom || item.email_auth || item.email_fiche || 'Admin'} — {item.email_auth || item.email_fiche || 'aucune adresse'} — {item.raison}
                              </div>
                            ))}
                          </div>
                        )}
                        {log.archived_at && <div><b>Archivé le :</b> {formatDate(log.archived_at)}</div>}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
          {!loading && hasMoreLogs && (
            <div style={styles.loadMoreWrap}>
              <button type="button" onClick={() => loadLogs(false, true)} disabled={loadingMore || refreshing} style={styles.secondaryButton}>
                {loadingMore ? <RefreshCw size={15} className="email-spin" /> : <Archive size={15} />}
                {loadingMore ? 'Chargement…' : `Charger les ${LOG_PAGE_SIZE} tentatives plus anciennes`}
              </button>
            </div>
          )}
        </>
      )}

      {modalOpen && draft && (
        <div style={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && workingId !== 'send' && workingId !== 'preview') setModalOpen(false) }}>
          <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="email-test-title">
            <div style={styles.modalHeader}>
              <div>
                <h3 id="email-test-title">{draft.retryOf ? 'Modifier et relancer l’e-mail' : 'Tester le routage e-mail'}</h3>
                <p>Choisis les destinataires, vérifie la liste, puis confirme l’envoi réel.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} disabled={workingId === 'send' || workingId === 'preview'} style={styles.iconButton} aria-label="Fermer"><X size={18} /></button>
            </div>

            {!draft.retryOf && (
              <label style={styles.field}>
                <span>À qui envoyer le test ?</span>
                <select value={draft.mode} onChange={(event) => { updateDraft('mode', event.target.value); setPreview(null) }} style={styles.formControl}>
                  <option value="self">Mon adresse (superadmin connecté)</option>
                  <option value="admin">Un admin précis</option>
                  <option value="enterprise">Les admins éligibles d’une entreprise (règle automatique)</option>
                  <option value="manual">Adresses saisies</option>
                </select>
              </label>
            )}

            {draft.mode === 'admin' && !draft.retryOf && (
              <label style={styles.field}>
                <span>Admin destinataire</span>
                <select value={draft.adminId} onChange={(event) => { updateDraft('adminId', event.target.value); setPreview(null) }} style={styles.formControl}>
                  <option value="">Choisir un admin</option>
                  {filteredAdmins.map((item) => <option key={item.id} value={item.id}>{`${item.first_name || ''} ${item.last_name || ''}`.trim()} — {item.email}</option>)}
                </select>
              </label>
            )}

            {draft.mode === 'enterprise' && !draft.retryOf && (
              <label style={styles.field}>
                <span>Entreprise</span>
                <select value={draft.enterpriseId} onChange={(event) => { updateDraft('enterpriseId', event.target.value); setPreview(null) }} style={styles.formControl}>
                  <option value="">Choisir une entreprise</option>
                  {enterprises.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <small>L’aperçu suit le routage actuel : admins actifs, rattachés à l’entreprise, alertes e-mail activées et compte Auth lié. Le superadmin global n’est pas ajouté automatiquement par la règle actuelle.</small>
              </label>
            )}

            {(draft.mode === 'manual' || draft.mode === 'retry') && (
              <label style={styles.field}>
                <span>Destinataires (séparés par des virgules)</span>
                <textarea value={draft.recipientsText} onChange={(event) => updateDraft('recipientsText', event.target.value)} rows={2} style={styles.formControl} placeholder="admin@exemple.com, autre@exemple.com" />
              </label>
            )}

            <label style={styles.field}>
              <span>Sujet complémentaire (facultatif)</span>
              <input value={draft.subject} onChange={(event) => updateDraft('subject', event.target.value)} style={styles.formControl} maxLength={160} />
            </label>

            <label style={styles.field}>
              <span>Lien du tableau de bord (facultatif)</span>
              <input value={draft.link} onChange={(event) => updateDraft('link', event.target.value)} style={styles.formControl} />
            </label>

            <div style={styles.linesHeader}>
              <strong>Contenu du message</strong>
              <button type="button" onClick={addLine} style={styles.secondaryButton}><Users size={14} /> Ajouter une ligne</button>
            </div>
            <div style={styles.linesList}>
              {draft.lines.map((line, index) => (
                <div key={`draft-line-${index}`} style={styles.lineCard}>
                  <div style={styles.lineHeader}><strong>Alerte {index + 1}</strong>{draft.lines.length > 1 && <button type="button" onClick={() => removeLine(index)} style={styles.iconButton} aria-label="Retirer cette ligne"><Trash2 size={15} /></button>}</div>
                  <label style={styles.field}><span>Titre</span><input value={line.titre} onChange={(event) => updateLine(index, 'titre', event.target.value)} style={styles.formControl} maxLength={200} /></label>
                  <label style={styles.field}><span>Détail</span><textarea value={line.detail} onChange={(event) => updateLine(index, 'detail', event.target.value)} style={styles.formControl} rows={3} maxLength={500} /></label>
                  <label style={styles.field}><span>Gravité</span><select value={line.gravite} onChange={(event) => updateLine(index, 'gravite', event.target.value)} style={styles.formControl}><option value="info">Information</option><option value="attention">À vérifier</option><option value="critique">Critique</option></select></label>
                </div>
              ))}
            </div>

            {preview && (
              <div style={styles.previewBox}>
                <strong><CheckCircle2 size={16} /> Aperçu — aucun e-mail envoyé pour l’instant</strong>
                <span>{preview.enterprise ? `Entreprise : ${preview.enterprise}` : 'Destinataires directs'}</span>
                {preview.note && <span>{preview.note}</span>}
                <div>{preview.recipients.map((email) => <span key={email} style={styles.emailChip}>{email}</span>)}</div>
                {preview.analysis?.length > 0 && (
                  <div style={styles.auditRows}>
                    <b>Contrôle des fiches Admin :</b>
                    {preview.analysis.map((item, index) => (
                      <div key={`${item.admin_id || item.email_auth || 'recipient'}-${index}`} style={{ color: item.inclus ? '#A7F3D0' : '#FCA5A5' }}>
                        {item.inclus ? '✓' : '×'} {item.nom || item.email_auth || item.email_fiche || 'Adresse'} — {item.email_auth || item.email_fiche || 'aucune adresse'} — {item.raison}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={styles.modalFooter}>
              <button type="button" onClick={previewDraft} disabled={workingId === 'preview' || workingId === 'send' || !functionReady || !canSend} style={styles.secondaryButton}>
                {workingId === 'preview' ? <RefreshCw size={15} className="email-spin" /> : <Eye size={15} />} Voir les destinataires
              </button>
              <button type="button" onClick={sendDraft} disabled={workingId === 'send' || workingId === 'preview' || !preview || !canSend} style={styles.primaryButton}>
                {workingId === 'send' ? <RefreshCw size={15} className="email-spin" /> : <Send size={15} />} Confirmer l’envoi réel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes emailSpin { to { transform: rotate(360deg); } }.email-spin { animation: emailSpin 1s linear infinite; }.email-monitor button:disabled { opacity: .52; cursor: not-allowed; filter: saturate(.55); }.email-monitor button:not(:disabled):hover { filter: brightness(1.08); }.email-monitor button:focus-visible, .email-monitor input:focus-visible, .email-monitor select:focus-visible, .email-monitor textarea:focus-visible { outline: 2px solid rgba(245,158,11,.75); outline-offset: 2px; }`}</style>
    </section>
  )
}

function StatCard({ label, value, color, ...props }) {
  return (
    <div style={styles.statCard}>
      <span style={{ ...styles.statIcon, color, background: `${color}14` }}>{createElement(props.Icon, { size: 19 })}</span>
      <span style={styles.statText}>
        <strong style={styles.statValue}>{value}</strong>
        <small style={styles.statLabel}>{label}</small>
      </span>
    </div>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, color: '#E5E7EB' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  title: { color: '#F8FAFC', fontSize: 22, margin: 0 },
  subtitle: { color: '#94A3B8', fontSize: 13, margin: '5px 0 0' },
  topActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' },
  primaryButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 42, boxSizing: 'border-box', border: 0, borderRadius: 10, padding: '10px 15px', background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#111827', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 7px 20px rgba(217,119,6,.18)' },
  secondaryButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 42, boxSizing: 'border-box', border: '1px solid rgba(71,85,105,.7)', borderRadius: 10, padding: '9px 13px', background: 'rgba(15,23,42,.78)', color: '#E2E8F0', fontWeight: 650, cursor: 'pointer', whiteSpace: 'nowrap' },
  health: { display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px', background: 'linear-gradient(135deg,rgba(15,23,42,.95),rgba(17,24,39,.85))', border: '1px solid', borderRadius: 13, color: '#CBD5E1', fontSize: 13, lineHeight: 1.5 },
  setupError: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: 18, borderRadius: 14, background: 'rgba(127,29,29,.2)', border: '1px solid rgba(248,113,113,.32)', color: '#FCA5A5' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))', gap: 12 },
  historyNote: { color: '#94A3B8', fontSize: 11, marginTop: -8, lineHeight: 1.5 },
  statCard: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, padding: '15px 16px', border: '1px solid rgba(71,85,105,.48)', borderRadius: 14, background: 'linear-gradient(140deg,rgba(15,23,42,.96),rgba(17,24,39,.88))', boxShadow: '0 8px 22px rgba(0,0,0,.12)' },
  statIcon: { width: 42, height: 42, flex: '0 0 42px', display: 'grid', placeItems: 'center', borderRadius: 12 },
  statText: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },
  statValue: { display: 'block', color: '#F8FAFC', fontSize: 25, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  statLabel: { display: 'block', color: '#A8B3C4', fontSize: 11, lineHeight: 1.35, overflowWrap: 'anywhere' },
  notice: { display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', color: '#CBD5E1', background: 'rgba(59,130,246,.08)', border: '1px solid rgba(96,165,250,.2)', borderRadius: 11, fontSize: 12, lineHeight: 1.5 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  searchBox: { flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 8, minHeight: 38, padding: '0 10px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, background: 'rgba(255,255,255,.035)' },
  searchInput: { width: '100%', border: 0, outline: 0, color: '#E2E8F0', background: 'transparent', font: 'inherit' },
  selectBox: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', minHeight: 38, border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, background: 'rgba(255,255,255,.035)' },
  select: { border: 0, outline: 0, color: '#E2E8F0', background: '#111827', padding: '7px 5px', font: 'inherit' },
  empty: { minHeight: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 22, color: '#94A3B8', background: 'rgba(15,23,42,.55)', border: '1px dashed rgba(255,255,255,.12)', borderRadius: 14, textAlign: 'center' },
  logList: { display: 'flex', flexDirection: 'column', gap: 10 },
  loadMoreWrap: { display: 'flex', justifyContent: 'center', padding: '8px 0 4px' },
  logCard: { overflow: 'hidden', border: '1px solid rgba(255,255,255,.09)', borderRadius: 13, background: 'rgba(15,23,42,.64)' },
  logMain: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: 13 },
  statusIcon: { width: 36, height: 36, flex: '0 0 36px', display: 'grid', placeItems: 'center', borderRadius: 10 },
  logSummary: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  logTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', color: '#F8FAFC' },
  statusPill: { border: '1px solid', borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 750, whiteSpace: 'nowrap' },
  metaLine: { display: 'flex', gap: 12, flexWrap: 'wrap', color: '#94A3B8', fontSize: 11 },
  recipientLine: { display: 'flex', gap: 6, alignItems: 'flex-start', color: '#CBD5E1', fontSize: 12, margin: 0, wordBreak: 'break-word' },
  counts: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#94A3B8' },
  errorText: { display: 'flex', gap: 6, alignItems: 'flex-start', color: '#FCA5A5', background: 'rgba(127,29,29,.18)', borderRadius: 8, padding: '7px 9px', fontSize: 11, wordBreak: 'break-word' },
  rowActions: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  actionButton: { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(251,191,36,.28)', borderRadius: 8, padding: '7px 9px', color: '#FCD34D', background: 'rgba(251,191,36,.08)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' },
  iconButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#CBD5E1', background: 'rgba(255,255,255,.04)', cursor: 'pointer' },
  detailPanel: { display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 16px 14px 61px', borderTop: '1px solid rgba(255,255,255,.07)', color: '#CBD5E1', fontSize: 12, overflowWrap: 'anywhere' },
  detailHint: { color: '#94A3B8', fontSize: 11, fontStyle: 'italic' },
  alertDetails: { display: 'flex', flexDirection: 'column', gap: 5 },
  modalBackdrop: { position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(2,6,23,.78)' },
  modal: { width: 'min(760px, 100%)', maxHeight: '92vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 13, padding: 20, border: '1px solid rgba(255,255,255,.12)', borderRadius: 18, background: '#111827', boxShadow: '0 24px 80px rgba(0,0,0,.55)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, color: '#CBD5E1', fontSize: 12 },
  formControl: { width: '100%', boxSizing: 'border-box', padding: '10px 11px', color: '#F8FAFC', background: '#0B1220', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, outline: 'none', font: 'inherit' },
  linesHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, color: '#F8FAFC' },
  linesList: { display: 'flex', flexDirection: 'column', gap: 9 },
  lineCard: { display: 'grid', gridTemplateColumns: '1fr', gap: 9, padding: 11, border: '1px solid rgba(255,255,255,.08)', borderRadius: 11, background: 'rgba(255,255,255,.025)' },
  lineHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#FBBF24', fontSize: 12 },
  previewBox: { display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 10, border: '1px solid rgba(52,211,153,.25)', background: 'rgba(6,78,59,.16)', color: '#D1FAE5', fontSize: 12 },
  emailChip: { display: 'inline-block', margin: '3px 5px 0 0', borderRadius: 999, padding: '4px 8px', color: '#D1FAE5', background: 'rgba(16,185,129,.14)', border: '1px solid rgba(52,211,153,.2)', wordBreak: 'break-all' },
  auditRows: { display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 8, borderTop: '1px solid rgba(52,211,153,.15)', overflowWrap: 'anywhere' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', position: 'sticky', bottom: -20, padding: '11px 0 0', background: '#111827', borderTop: '1px solid rgba(255,255,255,.08)' },
}
