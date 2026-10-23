import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Sun, Moon, FileText, Landmark, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import EnCheckBrandMark from '../components/EnCheckBrandMark'
import RaccourcisPages from '../components/RaccourcisPages'
import PaieEntreprises from '../components/PaieEntreprises'
import ConfigurationFiscale from './ConfigurationFiscale'
import FichesPaie from './FichesPaie'
import './PaieAfroTech.css'
import './PaieWorkspace.css'

export const PAIE_SECTIONS = [
  { id: 'bulletins', label: 'Bulletins', icon: FileText, tabs: [['preparation', 'Préparation'], ['profiles', 'Profils salariés'], ['allowances', 'Primes & retenues'], ['imports', 'Import variables'], ['preview', 'Fiches calculées']] },
  { id: 'fiscal', label: 'Fiscalité', icon: Landmark, tabs: [['pays', 'Vue d’ensemble'], ['contributions', 'Cotisations'], ['taxes', 'Barème'], ['rules', 'Règles fiscales'], ['simulation', 'Simulation']] },
  { id: 'settings', label: 'Paramètres', icon: Settings, tabs: [['settings', 'Moteur & bulletin']] },
]
const LEGACY = { moteur: 'settings', apercu: 'pays', profils: 'profiles', primes: 'allowances', fiches: 'preview' }
export function paieAccess(enterprise, superAdmin) {
  return { fiscal: superAdmin || enterprise?.module_config_fiscale === true, bulletins: superAdmin || enterprise?.module_fiches_paie === true }
}

export default function PaieFiscalite() {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()
  const [params, setParams] = useSearchParams()
  const [context, setContext] = useState(null)
  const [enterpriseId, setEnterpriseId] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [bulletinsBusy, setBulletinsBusy] = useState(false)
  const [fiscalBusy, setFiscalBusy] = useState(false)
  const busy = bulletinsBusy || fiscalBusy
  const [fiscalRevision, setFiscalRevision] = useState(0)
  const [visited, setVisited] = useState({})
  const requested = LEGACY[params.get('onglet')] || params.get('onglet') || 'preparation'
  const enterprise = context?.enterprises.find(e => e.id === enterpriseId)
  const access = paieAccess(enterprise, context?.admin.role === 'super_admin')
  const visible = PAIE_SECTIONS.filter(s => access[s.id === 'settings' ? 'bulletins' : s.id])
  const section = visible.find(s => s.tabs.some(([id]) => id === requested)) || visible[0]
  const tab = section?.tabs.some(([id]) => id === requested) ? requested : section?.tabs[0][0]
  const fiscal = section?.id === 'fiscal'

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      try {
        const admin = JSON.parse(localStorage.getItem('admin') || 'null')
        if (!admin) { navigate('/login'); return }
        const { data, error: failure } = await supabase.from('enterprises')
          .select('id, name, country_code, currency, module_config_fiscale, module_fiches_paie')
          .eq('is_active', true).order('name')
        if (failure) throw failure
        // Server RLS remains the authority; the local membership list only narrows the selector.
        const allowed = new Set([admin.enterprise_id, ...(admin.entreprises || []).map(e => e.id)])
        const enterprises = admin.role === 'super_admin' ? data : data.filter(e => allowed.has(e.id))
        if (!enterprises.length) throw new Error('Aucune entreprise accessible.')
        if (cancelled) return
        const preferred = admin.selectedEnterprise?.id || admin.enterprise_id
        setContext({ admin, enterprises })
        setEnterpriseId(current => enterprises.some(e => e.id === current) ? current : enterprises.find(e => e.id === preferred)?.id || enterprises[0].id)
      } catch (err) { if (!cancelled) setError(err.message || 'Chargement impossible.') }
    }
    load()
    return () => { cancelled = true }
  }, [navigate, retry])

  useEffect(() => {
    if (!section || !enterpriseId) return
    setVisited(v => ({ ...v, [`${enterpriseId}:${fiscal ? 'fiscal' : 'bulletins'}`]: true }))
  }, [section, fiscal, enterpriseId])

  function go(next) { setParams({ onglet: next }) }
  function changeEnterprise(id) {
    if (id === enterpriseId || busy) return
    if (!window.confirm('Changer d’entreprise ? Les saisies non enregistrées et les résultats de cette session seront abandonnés.')) return
    setVisited({})
    setEnterpriseId(id)
    const updated = { ...context.admin, selectedEnterprise: context.enterprises.find(e => e.id === id) }
    localStorage.setItem('admin', JSON.stringify(updated))
    localStorage.setItem(`last_enterprise_id_${context.admin.id}`, id)
  }

  return <div className="paie-page paie-workspace" data-theme={darkMode ? 'dark' : 'light'}>
    <header className="pw-header">
      <div className="pw-brand"><button className="paie-btn" aria-label="Retour au tableau de bord" onClick={() => { if (window.confirm('Quitter la paie ? Les saisies non enregistrées seront abandonnées.')) navigate('/dashboard') }}><ArrowLeft size={20}/></button><EnCheckBrandMark size={38}/><h1>En-Check · Paie & Fiscalité</h1></div>
      {context && <div className="pw-context">
        <select aria-label="Entreprise" value={enterpriseId || ''} disabled={busy} onChange={e => changeEnterprise(e.target.value)}>{context.enterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <span>{enterprise?.country_code || 'Pays non défini'} · {enterprise?.currency || 'Devise non définie'}</span>
      </div>}
      <button className="paie-btn" aria-label={darkMode ? 'Mode clair' : 'Mode sombre'} onClick={toggleTheme}>{darkMode ? <Sun size={20}/> : <Moon size={20}/>}</button>
      <div className="pw-shortcuts" onClickCapture={event => { if (event.target.closest('a,button') && !window.confirm('Quitter la paie ? Les saisies non enregistrées seront abandonnées.')) { event.preventDefault(); event.stopPropagation() } }}><RaccourcisPages /></div>
    </header>
    <div className="pw-bogolan pw-bogolan-top" aria-hidden="true" />
    {error ? <div className="pw-error" role="alert">{error}<button className="paie-btn" onClick={() => setRetry(n => n + 1)}>Réessayer</button></div>
      : !context ? <p className="pw-loading" role="status">Chargement des entreprises…</p>
      : !section ? <p className="pw-loading">Les modules Paie et Fiscalité ne sont pas activés pour cette entreprise.</p>
      : <>
        <nav className="pw-tabs" aria-label="Paie et fiscalité">{visible.map(s => { const Icon = s.icon; return <button key={s.id} aria-current={section.id === s.id ? 'page' : undefined} onClick={() => go(s.tabs[0][0])}><Icon size={20}/>{s.label}</button> })}</nav>
        <nav className="pw-subtabs" aria-label={`Rubriques ${section.label}`}>{section.tabs.map(([id, label]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>{label}</button>)}</nav>
        <main className="pw-main" key={enterpriseId}>
          {/* Keep both editors mounted across tabs: drafts and the chosen period survive navigation.
              A new enterprise gets a fresh keyed subtree; stale responses cannot paint into it. */}
          {access.bulletins && (visited[`${enterpriseId}:bulletins`] || !fiscal) && <div hidden={fiscal}>
            <FichesPaie integre entrepriseIdForce={enterpriseId} ongletExterne={fiscal ? 'preparation' : tab} onOngletChange={go} onBusyChange={setBulletinsBusy}/>
          </div>}
          {access.fiscal && (visited[`${enterpriseId}:fiscal`] || fiscal) && <div hidden={!fiscal}>
            {context.admin.role === 'super_admin' && fiscal && tab === 'pays' && <PaieEntreprises entreprises={context.enterprises} entrepriseCouranteId={enterpriseId} darkMode={darkMode} onCopieEffectuee={() => setFiscalRevision(n => n + 1)}/>}
            <ConfigurationFiscale refreshVersion={fiscalRevision} integre entrepriseIdForce={enterpriseId} ongletExterne={tab === 'simulation' ? 'preview' : fiscal ? tab : 'pays'} onContextChange={() => setRetry(n => n + 1)} onBusyChange={setFiscalBusy}/>
          </div>}
        </main>
      </>}
    <footer className="pw-footer"><div className="pw-bogolan pw-bogolan-bottom" aria-hidden="true"/><p>En-Check · Gestion des équipes</p></footer>
  </div>
}
