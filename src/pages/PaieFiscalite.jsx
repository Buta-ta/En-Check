import PaieWalletLoader from '../components/PaieWalletLoader'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, Landmark, Settings, Building2, ChevronDown, Globe2, Users, Gift, Upload, ClipboardCheck, SlidersHorizontal, Percent, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import PaieCoin from '../components/PaieCoin'
import PageCulturalBand from '../components/PageCulturalBand'
import EnCheckBrandMark from '../components/EnCheckBrandMark'
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
const TAB_ICONS = { preparation: ClipboardCheck, profiles: Users, allowances: Gift, imports: Upload, preview: FileText, pays: Globe2, contributions: Landmark, taxes: Percent, rules: SlidersHorizontal, simulation: Eye, settings: Settings }

const LEGACY = { moteur: 'settings', apercu: 'pays', profils: 'profiles', primes: 'allowances', fiches: 'preview' }
export function paieAccess(enterprise, superAdmin) {
  return { fiscal: superAdmin || enterprise?.module_config_fiscale === true, bulletins: superAdmin || enterprise?.module_fiches_paie === true }
}

export default function PaieFiscalite() {
  const navigate = useNavigate()
  /*  Le thème n'est plus piloté d'ici : le bouton clair / sombre a quitté
      le bandeau le 27/11, il vit dans le rail, une seule fois. On ne garde
      que la valeur, pour l'attribut `data-theme` de la page. */
  const { darkMode } = useTheme()
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

  /*  Le retour et l'entreprise partagent la même garde : quitter la paie ou
      changer d'entreprise abandonne les saisies en cours, il faut le dire
      avant, pas après. */
  const confirmerSortie = () => {
    if (window.confirm('Quitter la paie ? Les saisies non enregistrées seront abandonnées.')) navigate('/dashboard')
  }

  return <div className="paie-page paie-workspace" data-theme={darkMode ? 'dark' : 'light'}>
    {/* ═══ LE BLOC DE TÊTE : un cadre bogolan, comme la page Retards ═══

        Sa demande du 27/11 : « transforme ce bloc qu'il ressemble exactement
        comme au bloc de la page retards, un bloc encerclé du bandeau bogolan ».
        Et deux retraits dans la même phrase : les raccourcis de pages, et le
        bouton clair / sombre.

        Ce ne sont pas deux oublis, c'est la même leçon qu'aux Retards le
        25/11 : une page n'a pas à se refaire menu — le rail s'en charge — et
        le thème est un choix de l'application, pas d'une page. Le bouton de
        thème vivait ici en double ; il reste au rail, une seule fois.

        Le motif ne se pose plus AU-DESSUS de la page : il l'ENTOURE. Une
        seule toile, `placement="cadre"`, et la planche posée par-dessus —
        c'est elle qui masque le milieu, donc le bogolan ne se voit qu'en
        lisière. Une seule bande par page : celle du haut, qui ouvrait la
        page, disparaît avec ce placement. */}
    <div className="pw-cadre">
      <PageCulturalBand pathname="/paie" placement="cadre" />
      <div className="pw-planche">
        <header className="pw-bandeau">
          <button
            type="button"
            className="pw-retour"
            onClick={confirmerSortie}
            title="Retour au tableau de bord"
            aria-label="Retour au tableau de bord"
          >
            <ArrowLeft size={17} aria-hidden="true" />
          </button>

          <span className="pw-marque" aria-hidden="true">
            <EnCheckBrandMark size={34} />
          </span>

          <div className="pw-bandeau-titre">
            <h1>En-Check · Paie &amp; Fiscalité</h1>
            <p>Vos équipes. Votre rythme.</p>
          </div>

          {/*  L'entreprise reste ICI : c'est elle qui décide de tout ce que la
              page montre ensuite, et la changer abandonne les saisies. Elle
              prend la place de la période des Retards, à droite du bandeau. */}
          {context && (
            <label className="pw-bandeau-entreprise">
              <span className="pw-bandeau-entreprise-icone" aria-hidden="true">
                <Building2 size={17} />
              </span>
              <span className="pw-bandeau-entreprise-corps">
                <span className="pw-eyebrow">Entreprise</span>
                <select
                  aria-label="Entreprise"
                  value={enterpriseId || ''}
                  disabled={busy}
                  onChange={e => changeEnterprise(e.target.value)}
                >
                  {context.enterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </label>
          )}

          {/*  Le pays fiscal et la devise restent affichés : ils ne se règlent
              pas ici, mais ils décident de tout ce qui se calcule. Ils
              prennent la seconde place à droite, comme la période des
              Retards — une étiquette, une valeur, rien de plus. */}
          {context && (
            <div className="pw-bandeau-pays" aria-label="Pays fiscal et devise">
              <span className="pw-bandeau-pays-icone" aria-hidden="true">
                <Globe2 size={17} />
              </span>
              <span className="pw-bandeau-entreprise-corps">
                <span className="pw-eyebrow">Pays · devise</span>
                <strong>
                  {enterprise?.country_code || 'Non défini'}
                  <span aria-hidden="true"> / </span>
                  {enterprise?.currency || 'Non définie'}
                </strong>
              </span>
            </div>
          )}
        </header>
      </div>
    </div>
    {error ? <div className="pw-error" role="alert">{error}<button className="paie-btn" onClick={() => setRetry(n => n + 1)}>Réessayer</button></div>
      : !context ? <PaieWalletLoader label="Chargement de votre espace Paie & Fiscalité…"/>
      : !section ? <p className="pw-loading">Les modules Paie et Fiscalité ne sont pas activés pour cette entreprise.</p>
      : <>
        <nav className="pw-tabs" aria-label="Paie et fiscalité">{visible.map(s => { const Icon = s.icon; return <button key={s.id} aria-current={section.id === s.id ? 'page' : undefined} onClick={() => go(s.tabs[0][0])}><Icon size={20}/>{s.label}</button> })}</nav>
        <nav className="pw-subtabs" aria-label={`Rubriques ${section.label}`}>{section.tabs.map(([id, label], index) => { const Icon = TAB_ICONS[id] || FileText; return <button key={id} className="pw-coin-tab" aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}><PaieCoin variant={index}><Icon size={21}/></PaieCoin><span className="pw-coin-label">{label}</span><span className="pw-tab-active-mark" aria-hidden="true"/></button> })}</nav>
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
