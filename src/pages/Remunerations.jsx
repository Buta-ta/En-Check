// src/pages/Remunerations.jsx
// ═══════════════════════════════════════════════════════════════════════════
//  LES RÉMUNÉRATIONS — contrat et rémunération
// ═══════════════════════════════════════════════════════════════════════════
//
//  C'est la pièce sans laquelle aucun chiffre n'est calculable : combien gagne
//  la personne, sur quelle base (mois, jour ou heure), pour combien d'heures
//  prévues, et avec quels compléments.
//
//  CE QUI EST ÉCRIT (inchangé)
//  ───────────────────────────
//    · `employee_payroll_profiles` : le type de rémunération, la base, les
//      taux horaire et journalier, les compléments, la prime fixe, les heures
//      et les jours du contrat ;
//    · `employees.contract_type` : la nature du contrat (CDI, CDD…).
//
//  Rien d'autre n'est touché. Le barème fiscal suit le pays déclaré sur
//  l'entreprise : c'est lui qui décide des retenues, pas cette page.
//
//  CE QUI CHANGE (la refonte)
//  ──────────────────────────
//    · le tableau de treize colonnes devient une ligne par salarié, avec
//      une jauge de complétude : on voit ce qui manque sans lire ;
//    · « Enregistrer (n) » ne compte plus les saisies mais les VRAIS écarts
//      avec ce qui est en base — revenir sur sa frappe ne salit plus la page ;
//    · « Reprendre pour… » recopie les compléments et le rythme d'une ligne
//      sur d'autres salariés, sans jamais copier un salaire par accident ;
//    · l'action principale est collée en bas, au centre, et répond à ⌘S.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Wallet, RefreshCw, AlertTriangle, Info, Save, CheckCircle2, Users,
  Clock, TrendingUp, Sun, Moon, Building2, Search, Copy, X, Check, ArrowRight,
  TriangleAlert, Coins,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import useLoadingMinimum from '../hooks/useLoadingMinimum'
import PageCulturalBand from '../components/PageCulturalBand'
import RaccourcisPages from '../components/RaccourcisPages'
import RemunerationsLoading from '../components/RemunerationsLoading'
import {
  BogolanMedaillonSvg, BogolanTeinture, BogolanLosangeSvg, BogolanPanSvg,
} from '../components/RemunerationsBogolan'
import './Remunerations.css'

// ───────────────────────────────────────────────────────────────────────────
//  LES CONTRATS ET LES RYTHMES
// ───────────────────────────────────────────────────────────────────────────
const TYPES_CONTRAT = ['CDI', 'CDD', 'Journalier', 'Stage', 'Prestation', 'Autre']

const TYPES_REMUNERATION = [
  { id: 'monthly', libelle: 'Mensuel',   unite: 'mois' },
  { id: 'daily',   libelle: 'Journalier', unite: 'jour' },
  { id: 'hourly',  libelle: 'Horaire',   unite: 'heure' },
]

//  Ce qu'il faut pour que le coût soit calculable, par rythme.
//  Deux nombres et la nature du contrat : trois cases de complétude.
const ATTENDUS = {
  monthly: ['base_salary', 'contract_hours_per_month'],
  daily:   ['daily_rate', 'contract_days_per_month'],
  hourly:  ['hourly_rate', 'contract_hours_per_month'],
}

const LIBELLES = {
  base_salary: 'la base mensuelle',
  hourly_rate: 'le taux horaire',
  daily_rate: 'le taux journalier',
  contract_hours_per_month: 'les heures du mois',
  contract_days_per_month: 'les jours du mois',
}

const COMPLEMENTS = ['transport_allowance', 'housing_allowance', 'fixed_bonus']

// ───────────────────────────────────────────────────────────────────────────
//  OUTILS
// ───────────────────────────────────────────────────────────────────────────
function nombre(v) {
  const n = Number(String(v ?? '').toString().replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

const rempli = (v) => v !== '' && v !== null && v !== undefined && nombre(v) > 0

function formaterMontant(v, devise) {
  if (v === null || v === undefined || Number.isNaN(Number(v)) || Number(v) === 0) return '—'
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(v))
  return devise ? `${n} ${devise}` : n
}

function formaterEntier(v, devise) {
  if (!Number.isFinite(v) || v === 0) return '—'
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)
  return devise ? `${n} ${devise}` : n
}

function ligneVide() {
  return {
    salary_type: 'monthly',
    base_salary: '',
    hourly_rate: '',
    daily_rate: '',
    transport_allowance: '',
    housing_allowance: '',
    fixed_bonus: '',
    contract_hours_per_month: '',
    contract_days_per_month: '',
    overtime_eligible: true,
  }
}

const identique = (a, b) => String(a ?? '') === String(b ?? '')

const initiales = (prenom, nom) => {
  const a = String(prenom || '').trim()
  const b = String(nom || '').trim()
  const l = (s) => (s ? s[0].toUpperCase() : '')
  return `${l(a)}${l(b)}` || '—'
}

const nomComplet = (e) => [e.first_name, e.last_name].filter(Boolean).join(' ') || '—'

// ═══════════════════════════════════════════════════════════════════════════
//  LA PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function Remunerations() {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()
  const { minLoadingDone, skipLoading } = useLoadingMinimum(1400)

  const [admin, setAdmin] = useState(null)
  const [societes, setSocietes] = useState([])
  const [selectedEntId, setSelectedEntId] = useState(null)
  const [entreprise, setEntreprise] = useState(null)

  const [employes, setEmployes] = useState([])
  const [formulaires, setFormulaires] = useState({})
  const [contracts, setContracts] = useState({})
  const [reference, setReference] = useState({})
  const [connus, setConnus] = useState({})

  const [loading, setLoading] = useState(true)
  const [rafraichir, setRafraichir] = useState(false)
  const [enregistrement, setEnregistrement] = useState(null)
  const [enregistrementTout, setEnregistrementTout] = useState(false)

  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState('TOUS')

  const [appliquer, setAppliquer] = useState(null)

  const estSuperAdmin = admin?.role === 'super_admin'
  const devise = entreprise?.currency || ''

  // ─────────────────────────────────────────────────────────
  //  CHARGEMENT
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const brut = localStorage.getItem('admin')
    if (!brut) { navigate('/login'); return }

    let parsed
    try { parsed = JSON.parse(brut) } catch { navigate('/login'); return }

    setAdmin(parsed)

    if (parsed.role === 'super_admin') chargerEntreprises()
    else setSelectedEntId(parsed.selectedEnterprise?.id || parsed.enterprise_id)
  }, [navigate])

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
    setSocietes(data || [])
    if (data && data.length > 0) setSelectedEntId(data[0].id)
    else setLoading(false)
  }

  const chargerTout = useCallback(async (entId) => {
    if (!entId) return
    setLoading(true)

    const [resEnt, resEmp, resProf] = await Promise.all([
      supabase
        .from('enterprises')
        .select('id, name, code, currency, country_code')
        .eq('id', entId)
        .maybeSingle(),
      supabase
        .from('employees')
        .select('id, first_name, last_name, matricule, position, department, contract_type')
        .eq('enterprise_id', entId)
        .eq('is_active', true)
        .order('last_name'),
      supabase
        .from('employee_payroll_profiles')
        .select('*')
        .eq('enterprise_id', entId)
        .eq('is_active', true),
    ])

    if (resEnt.data) setEntreprise(resEnt.data)

    if (resEmp.error) {
      toast.error('Impossible de charger les salariés.')
      setLoading(false)
      return
    }

    const liste = resEmp.data || []
    setEmployes(liste)

    const profils = {}
    const deja = {}
    ;(resProf.data || []).forEach(p => {
      profils[p.employee_id] = {
        salary_type: p.salary_type || 'monthly',
        base_salary: p.base_salary ?? '',
        hourly_rate: p.hourly_rate ?? '',
        daily_rate: p.daily_rate ?? '',
        transport_allowance: p.transport_allowance ?? '',
        housing_allowance: p.housing_allowance ?? '',
        fixed_bonus: p.fixed_bonus ?? '',
        contract_hours_per_month: p.contract_hours_per_month ?? '',
        contract_days_per_month: p.contract_days_per_month ?? '',
        overtime_eligible: p.overtime_eligible !== false,
      }
      deja[p.employee_id] = true
    })

    const formulairesInit = {}
    const contratsInit = {}
    const referenceInit = {}

    liste.forEach(e => {
      const profil = profils[e.id] || ligneVide()
      formulairesInit[e.id] = { ...profil }
      contratsInit[e.id] = e.contract_type || ''
      //  la référence sert à savoir si une ligne a VRAIMENT changé :
      //  revenir sur sa frappe ne doit pas laisser la page sale
      referenceInit[e.id] = { form: { ...profil }, contrat: e.contract_type || '' }
    })

    setFormulaires(formulairesInit)
    setContracts(contratsInit)
    setReference(referenceInit)
    setConnus(deja)
    setLoading(false)
    setRafraichir(false)
  }, [])

  useEffect(() => {
    if (selectedEntId) chargerTout(selectedEntId)
    //  un compte sans entreprise n'a rien à charger : sans cette sortie,
    //  la page resterait sur son écran de chargement indéfiniment
    else if (admin) setLoading(false)
  }, [selectedEntId, chargerTout, admin])

  const modifier = (id, champ, valeur) => {
    setFormulaires(f => ({ ...f, [id]: { ...(f[id] || ligneVide()), [champ]: valeur } }))
  }

  // ─────────────────────────────────────────────────────────
  //  CE QUI A VRAIMENT CHANGÉ
  // ─────────────────────────────────────────────────────────
  const modifie = useCallback((id) => {
    const f = formulaires[id]
    const ref = reference[id]
    if (!f || !ref) return false
    if (!identique(contracts[id], ref.contrat)) return true
    return Object.keys(ligneVide()).some(champ => !identique(f[champ], ref.form[champ]))
  }, [formulaires, contracts, reference])

  const modifications = employes.filter(e => modifie(e.id)).length

  // ─────────────────────────────────────────────────────────
  //  LES CALCULS
  // ─────────────────────────────────────────────────────────
  const coutMensuel = useCallback((f) => {
    if (!f) return 0
    const comp = COMPLEMENTS.reduce((s, c) => s + nombre(f[c]), 0)
    if (f.salary_type === 'hourly') return nombre(f.hourly_rate) * nombre(f.contract_hours_per_month) + comp
    if (f.salary_type === 'daily') return nombre(f.daily_rate) * nombre(f.contract_days_per_month) + comp
    return nombre(f.base_salary) + comp
  }, [])

  const tauxHoraire = useCallback((f) => {
    if (!f) return 0
    const heures = nombre(f.contract_hours_per_month)
    if (f.salary_type === 'hourly') return nombre(f.hourly_rate)
    if (!heures) return 0
    if (f.salary_type === 'daily') {
      return (nombre(f.daily_rate) * nombre(f.contract_days_per_month)) / heures
    }
    return nombre(f.base_salary) / heures
  }, [])

  const manquants = useCallback((id) => {
    const f = formulaires[id]
    if (!f) return ['la rémunération']
    const liste = (ATTENDUS[f.salary_type] || ATTENDUS.monthly)
      .filter(champ => !rempli(f[champ]))
      .map(champ => LIBELLES[champ])
    if (!contracts[id]) liste.unshift('le type de contrat')
    return liste
  }, [formulaires, contracts])

  const etatBande = useCallback((id) => {
    if (manquants(id).length === 0) return modifie(id) ? 'pret' : 'complet'
    return 'incomplet'
  }, [manquants, modifie])

  const total = employes.length
  const renseignes = employes.filter(e => connus[e.id]).length
  const calculables = employes.filter(e => manquants(e.id).length === 0).length
  const incomplets = total - calculables

  const masseMensuelle = employes.reduce((acc, e) => acc + coutMensuel(formulaires[e.id]), 0)
  const heuresContrat = employes.reduce(
    (acc, e) => acc + nombre(formulaires[e.id]?.contract_hours_per_month), 0
  )
  const heuresPonderees = employes.reduce((acc, e) => {
    const h = nombre(formulaires[e.id]?.contract_hours_per_month)
    return h > 0 ? acc + h : acc
  }, 0)
  const coutHoraireMoyen = heuresPonderees > 0
    ? employes.reduce((acc, e) => {
      const h = nombre(formulaires[e.id]?.contract_hours_per_month)
      return h > 0 ? acc + coutMensuel(formulaires[e.id]) : acc
    }, 0) / heuresPonderees
    : 0

  const progression = total > 0 ? Math.round((calculables / total) * 100) : 0

  // ─────────────────────────────────────────────────────────
  //  LA LISTE AFFICHÉE
  // ─────────────────────────────────────────────────────────
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return employes.filter(e => {
      const etat = etatBande(e.id)
      if (filtre === 'INCOMPLETS' && etat !== 'incomplet') return false
      if (filtre === 'PRETS' && etat !== 'complet') return false
      if (!q) return true
      return [nomComplet(e), e.matricule, e.position, e.department]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    })
  }, [employes, etatBande, filtre, recherche])

  // ─────────────────────────────────────────────────────────
  //  ENREGISTRER
  // ─────────────────────────────────────────────────────────
  const enregistrer = useCallback(async (id) => {
    const f = formulaires[id]
    if (!f || !selectedEntId) return false

    setEnregistrement(id)
    try {
      const charge = {
        employee_id: id,
        enterprise_id: selectedEntId,
        salary_type: f.salary_type || 'monthly',
        base_salary: nombre(f.base_salary),
        hourly_rate: nombre(f.hourly_rate),
        daily_rate: nombre(f.daily_rate),
        transport_allowance: nombre(f.transport_allowance),
        housing_allowance: nombre(f.housing_allowance),
        fixed_bonus: nombre(f.fixed_bonus),
        contract_hours_per_month: f.contract_hours_per_month === '' ? null : nombre(f.contract_hours_per_month),
        contract_days_per_month: f.contract_days_per_month === '' ? null : nombre(f.contract_days_per_month),
        overtime_eligible: f.overtime_eligible !== false,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('employee_payroll_profiles')
        .upsert(charge, { onConflict: 'employee_id' })

      if (error) throw error

      //  La nature du contrat vit sur la fiche du salarié.
      const typeContrat = contracts[id]
      if (typeContrat) {
        await supabase
          .from('employees')
          .update({ contract_type: typeContrat })
          .eq('id', id)
      }

      setConnus(k => ({ ...k, [id]: true }))
      setReference(r => ({ ...r, [id]: { form: { ...f }, contrat: typeContrat || '' } }))
      return true
    } catch (err) {
      console.error(err)
      return false
    } finally {
      setEnregistrement(null)
    }
  }, [formulaires, contracts, selectedEntId])

  const enregistrerUne = async (id) => {
    const ok = await enregistrer(id)
    if (ok) toast.success('Rémunération enregistrée.')
    else toast.error("L'enregistrement n'a pas abouti.")
  }

  const enregistrerTout = useCallback(async () => {
    const ids = employes.filter(e => modifie(e.id)).map(e => e.id)
    if (ids.length === 0) {
      toast('Aucune modification en attente.')
      return
    }

    setEnregistrementTout(true)
    let faits = 0
    for (const id of ids) {
      //  on ne s'arrête pas au premier échec : le bilan dit ce qui reste
      const ok = await enregistrer(id)
      if (ok) faits += 1
    }
    setEnregistrementTout(false)

    if (faits === ids.length) {
      toast.success(`${faits} ligne${faits > 1 ? 's' : ''} enregistrée${faits > 1 ? 's' : ''}.`)
    } else if (faits > 0) {
      toast.error(`${faits} enregistrée${faits > 1 ? 's' : ''}, ${ids.length - faits} en échec.`)
    } else {
      toast.error("Aucun enregistrement n'a abouti.")
    }
  }, [employes, modifie, enregistrer])

  // ─────────────────────────────────────────────────────────
  //  LE RACCOURCI ⌘S / CTRL+S
  // ─────────────────────────────────────────────────────────
  const raccourci = useRef(enregistrerTout)
  raccourci.current = enregistrerTout

  useEffect(() => {
    const surTouche = (ev) => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== 's') return
      ev.preventDefault()
      raccourci.current()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [])

  // ─────────────────────────────────────────────────────────
  //  REPRENDRE DES VALEURS POUR D'AUTRES
  // ─────────────────────────────────────────────────────────
  const ouvrirAppliquer = (sourceId) => {
    setAppliquer({
      sourceId,
      champs: {
        salary_type: true,
        contract_hours_per_month: true,
        contract_days_per_month: true,
        transport_allowance: true,
        housing_allowance: true,
        fixed_bonus: true,
        overtime_eligible: true,
        //  un salaire ne se recopie pas par accident : ces trois-là
        //  sont proposés, mais décochés
        base_salary: false,
        hourly_rate: false,
        daily_rate: false,
      },
      destinataires: {},
    })
  }

  const basculerChamp = (champ) => {
    setAppliquer(a => (a ? { ...a, champs: { ...a.champs, [champ]: !a.champs[champ] } } : a))
  }

  const basculerDestinataire = (id) => {
    setAppliquer(a => (a
      ? { ...a, destinataires: { ...a.destinataires, [id]: !a.destinataires[id] } }
      : a))
  }

  const appliquerReprise = () => {
    if (!appliquer) return
    const source = formulaires[appliquer.sourceId]
    const cibles = Object.entries(appliquer.destinataires).filter(([, v]) => v).map(([id]) => id)
    const champs = Object.entries(appliquer.champs).filter(([, v]) => v).map(([c]) => c)

    if (cibles.length === 0) { toast.error('Choisissez au moins un salarié.'); return }
    if (champs.length === 0) { toast.error('Choisissez au moins une valeur à reprendre.'); return }

    setFormulaires(f => {
      const suivant = { ...f }
      for (const id of cibles) {
        const base = { ...(f[id] || ligneVide()) }
        for (const champ of champs) base[champ] = source[champ]
        suivant[id] = base
      }
      return suivant
    })

    setAppliquer(null)
    toast.success(
      `${champs.length} valeur${champs.length > 1 ? 's' : ''} reprise${champs.length > 1 ? 's' : ''} pour ${cibles.length} salarié${cibles.length > 1 ? 's' : ''}. Rien n’est écrit avant d’enregistrer.`
    )
  }

  // ─────────────────────────────────────────────────────────
  //  L'ÉCRAN DE CHARGEMENT
  // ─────────────────────────────────────────────────────────
  if ((loading && employes.length === 0) || !minLoadingDone) {
    return (
      <RemunerationsLoading
        darkMode={darkMode}
        onSkip={() => {
          skipLoading()
          setLoading(false)
        }}
      />
    )
  }

  const nomEntreprise = societes.find(e => e.id === selectedEntId)?.name
    || admin?.selectedEnterprise?.name
    || entreprise?.name
    || 'votre entreprise'

  const page = `rw-page${darkMode ? '' : ' rw-clair'}`
  const aucunResultat = visibles.length === 0

  return (
    <div className={page}>
      <PageCulturalBand pathname="/remunerations" />
      <div className="rw-bordure" aria-hidden="true" />

      {/* ══ L'EN-TÊTE ══ */}
      <header className="rw-entete">
        <button
          type="button"
          className="rw-retour"
          onClick={() => navigate('/dashboard')}
          aria-label="Revenir au tableau de bord"
          title="Tableau de bord"
        >
          <ArrowLeft size={17} />
        </button>

        <BogolanLosangeSvg taille={44} ton="cuivre" />

        <div className="rw-titre-bloc">
          <span className="rw-eyebrow">Contrats et montants</span>
          <h1 className="rw-titre">Rémunérations<span>.</span></h1>
          <p className="rw-sous-titre">
            La base, le rythme, les compléments et les heures prévues de chaque
            contrat. Une ligne par salarié, avec ce qui reste à renseigner.
          </p>
        </div>

        <div className="rw-entete-droite">
          {estSuperAdmin && societes.length > 0 && (
            <div className="rw-entreprise">
              <Building2 size={14} aria-hidden="true" />
              <select
                value={selectedEntId || ''}
                onChange={e => setSelectedEntId(e.target.value || null)}
                aria-label="Entreprise dont on règle les rémunérations"
              >
                {societes.map(e => (
                  <option key={e.id} value={e.id}>{e.name}{e.code ? ` (${e.code})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            className="rw-bascule"
            data-forme="carre"
            onClick={() => { setRafraichir(true); chargerTout(selectedEntId) }}
            disabled={rafraichir || !selectedEntId}
            aria-label="Recharger les rémunérations"
            title="Recharger"
          >
            <RefreshCw size={15} className={rafraichir ? 'rw-tourne' : ''} />
          </button>

          <button
            type="button"
            className="rw-bascule"
            role="switch"
            aria-checked={darkMode}
            onClick={toggleTheme}
            aria-label={darkMode ? 'Passer en thème clair' : 'Passer en thème sombre'}
            title={darkMode ? 'Thème clair' : 'Thème sombre'}
          >
            {darkMode ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="rw-coque">

        {/* ══ LE SEUIL ══ */}
        <section className="rw-seuil" aria-label="Entreprise, devise et accès rapides">
          <div className="rw-seuil-gauche">
            <div className="rw-seuil-item">
              <span className="rw-seuil-libelle">Entreprise</span>
              <span className="rw-seuil-valeur">
                <Building2 size={12} aria-hidden="true" />
                {nomEntreprise}
              </span>
            </div>
            <div className="rw-seuil-item">
              <span className="rw-seuil-libelle">Devise</span>
              <span className="rw-seuil-valeur">
                <Coins size={12} aria-hidden="true" />
                {devise || 'non déclarée'}
              </span>
            </div>
            <div className="rw-seuil-item">
              <span className="rw-seuil-libelle">Pays du barème</span>
              <span className="rw-seuil-valeur">
                {entreprise?.country_code || 'non déclaré'}
              </span>
            </div>
            <div className="rw-seuil-item">
              <span className="rw-seuil-libelle">Salariés actifs</span>
              <span className="rw-seuil-valeur">{total}</span>
            </div>
          </div>

          <div className="rw-raccourcis">
            <RaccourcisPages compact excludePaths={['/remunerations']} />
          </div>
        </section>

        {/* ══ LES MESURES ET LES REPÈRES ══ */}
        <div className="rw-haut">
          <div className="rw-mesures">
            <article className="rw-mesure" data-ton={progression === 100 ? 'ok' : 'attente'}>
              <span className="rw-mesure-libelle">
                <Users size={12} aria-hidden="true" />
                Salariés renseignés
              </span>
              <span className="rw-mesure-valeur">
                {renseignes}<small>/ {total}</small>
              </span>
              <span className="rw-mesure-detail">
                {renseignes === total && total > 0
                  ? 'toutes les fiches ont un profil'
                  : `${total - renseignes} à ouvrir pour la première fois`}
              </span>
              <span className="rw-trame" aria-hidden="true">
                {employes.slice(0, 28).map(e => (
                  <span key={e.id} className="rw-point" data-fait={connus[e.id] ? 'oui' : 'non'} />
                ))}
              </span>
            </article>

            <article className="rw-mesure">
              <span className="rw-mesure-libelle">
                <Wallet size={12} aria-hidden="true" />
                Masse mensuelle
              </span>
              <span className="rw-mesure-valeur">{formaterEntier(Math.round(masseMensuelle), devise)}</span>
              <span className="rw-mesure-detail">
                base et compléments, hors cotisations et heures supplémentaires
              </span>
            </article>

            <article className="rw-mesure">
              <span className="rw-mesure-libelle">
                <Clock size={12} aria-hidden="true" />
                Heures de contrat
              </span>
              <span className="rw-mesure-valeur">
                {formaterEntier(Math.round(heuresContrat), '')}
                <small>h / mois</small>
              </span>
              <span className="rw-mesure-detail">
                la référence du coût de l’heure prévu
              </span>
            </article>

            <article className="rw-mesure" data-ton={incomplets === 0 ? 'ok' : 'alerte'}>
              <span className="rw-mesure-libelle">
                <Coins size={12} aria-hidden="true" />
                Coût moyen de l’heure
              </span>
              <span className="rw-mesure-valeur">{formaterMontant(coutHoraireMoyen, devise)}</span>
              <span className="rw-mesure-detail">
                {heuresPonderees > 0
                  ? `pondéré sur ${employes.filter(e => nombre(formulaires[e.id]?.contract_hours_per_month) > 0).length} salarié(s) dont les heures sont connues`
                  : 'aucune heure de contrat renseignée'}
              </span>
            </article>
          </div>

          <aside className="rw-reperes">
            <span className="rw-reperes-titre">
              <Info size={12} aria-hidden="true" />
              Ce qu’il faut pour calculer
            </span>
            <p>
              Le coût d’un salarié se déduit de <strong>sa base</strong> et de
              <strong> son rythme</strong>. Le coût de l’heure, lui, a besoin des
              heures du mois :
            </p>
            <ul className="rw-reperes-liste">
              <li>base mensuelle ÷ heures du mois</li>
              <li>taux journalier × jours ÷ heures</li>
              <li>taux horaire, tel quel</li>
            </ul>
            <p>
              Ces montants alimentent le coût, pas le bulletin. Les retenues suivent
              le <strong>barème du pays déclaré sur l’entreprise</strong>.
            </p>
          </aside>
        </div>

        {/* ══ LE CONSTAT ══ */}
        {total === 0 ? null : incomplets === 0 ? (
          <div className="rw-constat" data-ton="ok">
            <CheckCircle2 size={17} aria-hidden="true" />
            <div className="rw-constat-texte">
              <strong>Les {total} salariés ont une rémunération complète.</strong>{' '}
              Le coût de chacun est calculable — il reste à vérifier les cotisations
              employeur dans <strong>Configuration fiscale</strong>.
            </div>
          </div>
        ) : (
          <div className="rw-constat" data-ton="alerte">
            <AlertTriangle size={17} aria-hidden="true" />
            <div className="rw-constat-texte">
              <strong>
                {incomplets} salarié{incomplets > 1 ? 's' : ''} sur {total} n’{incomplets > 1 ? 'ont' : 'a'} pas
                de rémunération complète.
              </strong>{' '}
              Tant qu’il manque un chiffre, le coût de ces salariés est compté à zéro
              dans la page Coût salarial.
            </div>
            <button
              type="button"
              className="rw-bouton"
              data-taille="petit"
              onClick={() => setFiltre('INCOMPLETS')}
            >
              Voir les {incomplets}
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ══ LA LISTE ══ */}
        <section className="rw-pagne" aria-labelledby="rw-pagne-titre">
          <div className="rw-pagne-tete">
            <div className="rw-pagne-titres">
              <h2 className="rw-pagne-titre" id="rw-pagne-titre">
                Contrat et rémunération
                <span className="rw-pagne-compte">{visibles.length}</span>
              </h2>
              <span className="rw-pagne-note">
                Modifiez une case puis enregistrez : rien n’est écrit tant que vous ne le demandez pas.
              </span>
            </div>

            <label className="rw-recherche">
              <Search size={13} aria-hidden="true" />
              <input
                type="search"
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                placeholder="Nom, matricule, poste…"
                aria-label="Chercher un salarié"
              />
            </label>

            <div className="rw-filtres" role="group" aria-label="Filtrer les lignes">
              {[
                { id: 'TOUS', libelle: 'Toutes' },
                { id: 'INCOMPLETS', libelle: `À compléter (${incomplets})` },
                { id: 'PRETS', libelle: 'Prêtes' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  className="rw-filtre"
                  aria-pressed={filtre === f.id}
                  onClick={() => setFiltre(f.id)}
                >
                  {f.libelle}
                </button>
              ))}
            </div>
          </div>

          {aucunResultat ? (
            <div className="rw-vide">
              <BogolanPanSvg hauteur={40} ton="cuivre" />
              <strong>
                {recherche.trim()
                  ? `Aucun salarié ne correspond à « ${recherche.trim()} »`
                  : filtre === 'INCOMPLETS'
                    ? 'Toutes les rémunérations sont renseignées'
                    : filtre === 'PRETS'
                      ? 'Aucune ligne n’est complète pour l’instant'
                      : 'Aucun salarié actif sur cette entreprise'}
              </strong>
              <p>
                {filtre !== 'TOUS' || recherche.trim()
                  ? 'Changez de filtre ou videz la recherche pour revoir toute la liste.'
                  : 'Ajoutez des salariés depuis la page Employés : ils apparaîtront ici.'}
              </p>
              {(filtre !== 'TOUS' || recherche.trim()) && (
                <button
                  type="button"
                  className="rw-bouton"
                  data-taille="petit"
                  onClick={() => { setFiltre('TOUS'); setRecherche('') }}
                >
                  Tout revoir
                </button>
              )}
            </div>
          ) : (
            <div className="rw-bandes">
              {visibles.map(e => {
                const f = formulaires[e.id] || ligneVide()
                const etat = etatBande(e.id)
                const ilManque = manquants(e.id)
                const taux = tauxHoraire(f)
                const salarieModifie = modifie(e.id)
                const actif = (champ) => (ATTENDUS[f.salary_type] || ATTENDUS.monthly).includes(champ)
                const remplis = 3 - ilManque.length

                return (
                  <article
                    key={e.id}
                    className="rw-bande"
                    data-etat={etat}
                    data-modifie={salarieModifie ? 'oui' : 'non'}
                    aria-label={`${nomComplet(e)} — ${etat === 'complet' ? 'à jour' : etat === 'pret' ? 'à enregistrer' : 'incomplète'}`}
                  >
                    <div className="rw-bande-teinture" title={`${remplis} information${remplis > 1 ? 's' : ''} sur 3 renseignée${remplis > 1 ? 's' : ''}`}>
                      <BogolanTeinture remplis={remplis} total={3} ton="cuivre" />
                    </div>

                    <div className="rw-bande-corps">

                      <div className="rw-bande-tete">
                        <span className="rw-medaillon">
                          <BogolanMedaillonSvg taille={46} ton={etat === 'incomplet' ? 'cuivre' : 'craie'} />
                          <span className="rw-medaillon-initiales">{initiales(e.first_name, e.last_name)}</span>
                        </span>

                        <div className="rw-identite">
                          <span className="rw-nom" title={nomComplet(e)}>{nomComplet(e)}</span>
                          <span className="rw-meta">
                            {e.matricule && <code>{e.matricule}</code>}
                            {[e.position, e.department].filter(Boolean).join(' · ') || 'poste non renseigné'}
                          </span>
                        </div>

                        <div className="rw-selects">
                          <select
                            className="rw-select"
                            value={contracts[e.id] || ''}
                            onChange={ev => setContracts(c => ({ ...c, [e.id]: ev.target.value }))}
                            aria-label={`Type de contrat de ${nomComplet(e)}`}
                          >
                            <option value="">Contrat —</option>
                            {TYPES_CONTRAT.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>

                          <select
                            className="rw-select"
                            value={f.salary_type || 'monthly'}
                            onChange={ev => modifier(e.id, 'salary_type', ev.target.value)}
                            aria-label={`Rythme de paie de ${nomComplet(e)}`}
                          >
                            {TYPES_REMUNERATION.map(t => (
                              <option key={t.id} value={t.id}>{t.libelle}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="rw-groupes">
                        <div className="rw-groupe">
                          <span className="rw-groupe-titre">La base du rythme</span>
                          <div className="rw-cases" data-groupe="base">
                            {[
                              { champ: 'base_salary', libelle: 'Mensuelle', unite: devise },
                              { champ: 'hourly_rate', libelle: 'Par heure', unite: devise },
                              { champ: 'daily_rate', libelle: 'Par jour', unite: devise },
                            ].map(({ champ, libelle, unite }) => (
                              <label
                                key={champ}
                                className="rw-case"
                                data-actif={actif(champ) ? 'oui' : 'non'}
                              >
                                <span className="rw-case-libelle">{libelle}</span>
                                <span className="rw-case-corps">
                                  <input
                                    className="rw-case-champ"
                                    value={f[champ]}
                                    onChange={ev => modifier(e.id, champ, ev.target.value)}
                                    inputMode="decimal"
                                    placeholder="—"
                                    aria-label={`${libelle} de ${nomComplet(e)}`}
                                  />
                                  <span className="rw-case-unite">{unite || '—'}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="rw-groupe">
                          <span className="rw-groupe-titre">Le temps prévu</span>
                          <div className="rw-cases" data-groupe="temps">
                            {[
                              { champ: 'contract_hours_per_month', libelle: 'Heures / mois', unite: 'h' },
                              { champ: 'contract_days_per_month', libelle: 'Jours / mois', unite: 'j' },
                            ].map(({ champ, libelle, unite }) => (
                              <label
                                key={champ}
                                className="rw-case"
                                data-actif={actif(champ) ? 'oui' : 'non'}
                              >
                                <span className="rw-case-libelle">{libelle}</span>
                                <span className="rw-case-corps">
                                  <input
                                    className="rw-case-champ"
                                    value={f[champ]}
                                    onChange={ev => modifier(e.id, champ, ev.target.value)}
                                    inputMode="decimal"
                                    placeholder="—"
                                    aria-label={`${libelle} de ${nomComplet(e)}`}
                                  />
                                  <span className="rw-case-unite">{unite}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="rw-groupe">
                          <span className="rw-groupe-titre">Les compléments</span>
                          <div className="rw-cases" data-groupe="complements">
                            {[
                              { champ: 'transport_allowance', libelle: 'Transport' },
                              { champ: 'housing_allowance', libelle: 'Logement' },
                              { champ: 'fixed_bonus', libelle: 'Prime fixe' },
                            ].map(({ champ, libelle }) => (
                              <label key={champ} className="rw-case" data-actif="oui">
                                <span className="rw-case-libelle">{libelle}</span>
                                <span className="rw-case-corps">
                                  <input
                                    className="rw-case-champ"
                                    value={f[champ]}
                                    onChange={ev => modifier(e.id, champ, ev.target.value)}
                                    inputMode="decimal"
                                    placeholder="—"
                                    aria-label={`${libelle} de ${nomComplet(e)}`}
                                  />
                                  <span className="rw-case-unite">{devise || '—'}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="rw-bande-pied">
                        <span className="rw-cout">
                          Coût de l’heure
                          <strong>{taux > 0 ? formaterMontant(taux, devise) : '—'}</strong>
                        </span>

                        {ilManque.length > 0 ? (
                          <span className="rw-manque">
                            <TriangleAlert size={12} aria-hidden="true" />
                            il manque {ilManque.join(', ')}
                          </span>
                        ) : (
                          <span className="rw-etat" data-ton={salarieModifie ? 'attente' : 'ok'}>
                            <Check size={11} aria-hidden="true" />
                            {salarieModifie ? 'à enregistrer' : 'à jour'}
                          </span>
                        )}

                        {ilManque.length > 0 && (
                          <span className="rw-etat" data-ton="alerte">
                            {remplis} / 3
                          </span>
                        )}

                        <div className="rw-pied-droite">
                          <button
                            type="button"
                            className="rw-interrupteur"
                            aria-checked={f.overtime_eligible !== false}
                            aria-label={`Heures supplémentaires de ${nomComplet(e)}`}
                            title="Les heures supplémentaires comptent-elles pour ce salarié ?"
                            onClick={() => modifier(
                              e.id, 'overtime_eligible', f.overtime_eligible === false
                            )}
                          >
                            <span className="rw-interrupteur-piste" aria-hidden="true" />
                            heures supp.
                          </button>

                          <button
                            type="button"
                            className="rw-bouton"
                            data-ton="discret"
                            data-taille="petit"
                            onClick={() => ouvrirAppliquer(e.id)}
                            title="Reprendre ces valeurs pour d’autres salariés"
                          >
                            <Copy size={12} aria-hidden="true" />
                            Reprendre
                          </button>

                          <button
                            type="button"
                            className="rw-bouton"
                            data-ton={salarieModifie ? 'cuivre' : undefined}
                            data-taille="petit"
                            onClick={() => enregistrerUne(e.id)}
                            disabled={enregistrement === e.id || !salarieModifie}
                          >
                            {enregistrement === e.id
                              ? <><RefreshCw size={12} className="rw-tourne" aria-hidden="true" /> Enregistrement…</>
                              : salarieModifie
                                ? <><Save size={12} aria-hidden="true" /> Enregistrer</>
                                : <><Check size={12} aria-hidden="true" /> À jour</>}
                          </button>
                        </div>
                      </div>

                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* ══ ET ENSUITE ══ */}
        <div className="rw-note">
          <TrendingUp size={15} aria-hidden="true" />
          <span>
            Une fois les rémunérations déclarées et les cotisations employeur renseignées
            dans <strong>Configuration fiscale</strong>, la page <strong>Coût salarial</strong>
            {' '}affiche le coût réel de chaque personne et la projection du mois.
          </span>
        </div>

      </main>

      <PageCulturalBand pathname="/remunerations" placement="bottom" />

      {/* ══ LA BARRE D'ASSEMBLAGE ══ */}
      {modifications > 0 && (
        <div className="rw-barre" role="status">
          <span className="rw-barre-compte">
            <strong>{modifications} ligne{modifications > 1 ? 's' : ''} modifiée{modifications > 1 ? 's' : ''}</strong>
            <span>rien n’est encore écrit</span>
          </span>
          <span className="rw-touche" aria-hidden="true">{(navigator.userAgent || '').includes('Mac') ? '⌘' : 'Ctrl'} + S</span>
          <button
            type="button"
            className="rw-bouton"
            data-ton="cuivre"
            onClick={enregistrerTout}
            disabled={enregistrementTout}
          >
            {enregistrementTout
              ? <><RefreshCw size={13} className="rw-tourne" aria-hidden="true" /> Enregistrement…</>
              : <><Save size={13} aria-hidden="true" /> Enregistrer ({modifications})</>}
          </button>
        </div>
      )}

      {/* ══ REPRENDRE DES VALEURS POUR D'AUTRES ══ */}
      {appliquer && (
        <div className="rw-voile" onClick={() => setAppliquer(null)}>
          <div
            className="rw-modale"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rw-appliquer-titre"
            onClick={ev => ev.stopPropagation()}
          >
            <div className="rw-modale-tete">
              <BogolanMedaillonSvg taille={34} ton="cuivre" />
              <div className="rw-modale-titres">
                <h2 className="rw-modale-titre" id="rw-appliquer-titre">
                  Reprendre les valeurs de {nomComplet(employes.find(x => x.id === appliquer.sourceId) || {})}
                </h2>
                <span className="rw-modale-sous">
                  Rien n’est envoyé à la base : les lignes choisies sont remplies ici,
                  puis vous enregistrez quand vous le souhaitez.
                </span>
              </div>
              <button
                type="button"
                className="rw-bouton"
                data-ton="discret"
                onClick={() => setAppliquer(null)}
                aria-label="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="rw-modale-corps">
              <div>
                <span className="rw-etiquette">Ce qui se reprend</span>
                <div className="rw-champs rw-dessus">
                  {[
                    ['salary_type', 'Le rythme'],
                    ['contract_hours_per_month', 'Heures'],
                    ['contract_days_per_month', 'Jours'],
                    ['transport_allowance', 'Transport'],
                    ['housing_allowance', 'Logement'],
                    ['fixed_bonus', 'Prime'],
                    ['overtime_eligible', 'Heures supp.'],
                    ['base_salary', 'Base mensuelle'],
                    ['hourly_rate', 'Taux horaire'],
                    ['daily_rate', 'Taux journalier'],
                  ].map(([champ, libelle]) => (
                    <button
                      key={champ}
                      type="button"
                      className="rw-champ-puce"
                      aria-pressed={Boolean(appliquer.champs[champ])}
                      onClick={() => basculerChamp(champ)}
                    >
                      {libelle}
                    </button>
                  ))}
                </div>
                <p className="rw-pagne-note rw-dessus">
                  Les trois montants de base sont décochés : un salaire ne se recopie
                  pas par défaut.
                </p>
              </div>

              <div>
                <span className="rw-etiquette">
                  À qui ({Object.values(appliquer.destinataires).filter(Boolean).length} choisi
                  {Object.values(appliquer.destinataires).filter(Boolean).length > 1 ? 's' : ''})
                </span>
                <div className="rw-appliquer-liste rw-dessus">
                  {employes.filter(e => e.id !== appliquer.sourceId).map(e => (
                    <button
                      key={e.id}
                      type="button"
                      className="rw-appliquer-item"
                      aria-pressed={Boolean(appliquer.destinataires[e.id])}
                      onClick={() => basculerDestinataire(e.id)}
                    >
                      <span className="rw-case-coche" aria-hidden="true">
                        <Check size={11} />
                      </span>
                      <span className="rw-appliquer-nom">{nomComplet(e)}</span>
                      <span className="rw-appliquer-meta">
                        {contracts[e.id] || 'contrat —'} · {etatBande(e.id) === 'incomplet' ? 'à compléter' : 'à jour'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rw-modale-pied">
              <button type="button" className="rw-bouton" onClick={() => setAppliquer(null)}>
                Annuler
              </button>
              <button type="button" className="rw-bouton" data-ton="cuivre" onClick={appliquerReprise}>
                <Copy size={13} aria-hidden="true" />
                Reprendre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
