// src/pages/Remunerations.jsx
// ═══════════════════════════════════════════════════════════════════════════
//  Les rémunérations — ce que chaque contrat prévoit
// ═══════════════════════════════════════════════════════════════════════════
//
//  C'est la pièce sans laquelle aucun chiffre n'est calculable : combien gagne
//  la personne, sur quelle base (mois, jour ou heure), pour combien d'heures
//  prévues, et avec quelles indemnités.
//
//  Cette page ne remplace pas la fiche de paie : elle la complète. Elle montre
//  côte à côte TOUS les salariés d'une entreprise, dit combien sont déjà
//  renseignés, et permet de compléter les autres en quelques clics — au lieu
//  d'ouvrir quatorze fiches l'une après l'autre.
//
//  CE QUI EST ÉCRIT
//  ────────────────
//    · `employee_payroll_profiles` : le type de rémunération, la base, les
//      taux horaire et journalier, les indemnités, la prime fixe, les heures
//      et les jours du contrat ;
//    · `employees.contract_type` : la nature du contrat (CDI, CDD, journalier,
//      stage, prestation).
//
//  Rien d'autre n'est touché. Le barème fiscal, lui, suit le pays déclaré sur
//  l'entreprise : c'est lui qui décide des retenues, pas cette page.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, RefreshCw, AlertTriangle, Info, Save, CheckCircle2, Users,
  TrendingUp, Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

// ───────────────────────────────────────────────────────────────────────────
//  PRÉSENTATION
// ───────────────────────────────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#F8FAFC', paddingBottom: 48 },
  conteneur: { maxWidth: 1280, margin: '0 auto', padding: '0 24px' },
  carte: {
    background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14,
    padding: 20, marginBottom: 16,
  },
  bandeau: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12,
    padding: '14px 16px', marginBottom: 16,
  },
  alerte: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
    padding: '14px 16px', marginBottom: 16,
  },
  succes: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12,
    padding: '14px 16px', marginBottom: 16,
  },
  ligne: { display: 'flex', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: 0.4 },
  select: {
    border: '1px solid #CBD5E1', borderRadius: 9, padding: '8px 12px',
    fontSize: 14, background: '#FFFFFF', color: '#0F172A', outline: 'none',
  },
  champ: {
    border: '1px solid #CBD5E1', borderRadius: 8, padding: '7px 10px',
    fontSize: 13.5, width: '100%', outline: 'none', textAlign: 'right',
  },
  btnPrimaire: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: 9,
    padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  btnFantome: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1',
    borderRadius: 9, padding: '8px 14px', fontSize: 14, fontWeight: 700,
    cursor: 'pointer',
  },
  btnMinute: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE',
    borderRadius: 8, padding: '6px 11px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  grille: {
    display: 'grid', gap: 14, marginBottom: 16,
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  },
  indicateur: {
    background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14,
    padding: '16px 18px',
  },
  chiffre: { fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1.15 },
  tableau: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 10px', color: '#64748B',
    fontSize: 11, fontWeight: 800, letterSpacing: 0.4,
    borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap',
  },
  thD: {
    textAlign: 'right', padding: '10px 10px', color: '#64748B',
    fontSize: 11, fontWeight: 800, letterSpacing: 0.4,
    borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap',
  },
  td: { padding: '8px 10px', borderBottom: '1px solid #F1F5F9', color: '#0F172A' },
  tdNom: {
    padding: '8px 10px', borderBottom: '1px solid #F1F5F9',
    color: '#0F172A', fontWeight: 700, whiteSpace: 'nowrap',
  },
  jauge: {
    height: 9, background: '#EEF2F7', borderRadius: 99, overflow: 'hidden',
    marginTop: 10,
  },
  vide: { padding: '48px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 14 },
}

const CSS = `
  .spin { animation: ec-spin 1s linear infinite; }
  @keyframes ec-spin { to { transform: rotate(360deg); } }
  table.remu tbody tr:hover { background: #F8FAFC; }
  table.remu input:focus { border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
  table.remu select:focus { border-color: #6366F1; }
`

const TYPES_CONTRAT = ['CDI', 'CDD', 'Journalier', 'Stage', 'Prestation', 'Autre']

const TYPES_REMUNERATION = [
  { id: 'monthly', libelle: 'Mensuel' },
  { id: 'daily',   libelle: 'Journalier' },
  { id: 'hourly',  libelle: 'Horaire' },
]

// ───────────────────────────────────────────────────────────────────────────
//  OUTILS
// ───────────────────────────────────────────────────────────────────────────
function nombre(v) {
  const n = Number(String(v ?? '').toString().replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

function formaterMontant(v, devise) {
  if (v === null || v === undefined || Number.isNaN(Number(v)) || Number(v) === 0) return '—'
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v))
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

// ═══════════════════════════════════════════════════════════════════════════
//  LA PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function Remunerations() {
  const navigate = useNavigate()

  const [admin, setAdmin] = useState(null)
  const [enterprises, setEnterprises] = useState([])
  const [selectedEntId, setSelectedEntId] = useState(null)
  const [entreprise, setEntreprise] = useState(null)

  const [employes, setEmployes] = useState([])
  const [formulaires, setFormulaires] = useState({})
  const [contracts, setContracts] = useState({})
  const [souilles, setSouilles] = useState({})
  const [connus, setConnus] = useState({})

  const [loading, setLoading] = useState(true)
  const [rafraichir, setRafraichir] = useState(false)
  const [enregistrement, setEnregistrement] = useState(null)

  const estSuperAdmin = admin?.role === 'super_admin'
  const devise = entreprise?.currency || ''

  // ─────────────────────────────────────────────────────────
  //  CHARGEMENT
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const brut = localStorage.getItem('admin')
    if (!brut) { navigate('/login'); return }

    let parsed
    try { parsed = JSON.parse(brut) } catch (_) { navigate('/login'); return }

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
    setEnterprises(data || [])
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

    //  Ce qui est déjà déclaré remplit le formulaire ; le reste part vide,
    //  mais reste identifiable : c'est ce qui compte pour la jauge.
    const profils = {}
    const contrats = {}
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
    liste.forEach(e => {
      formulairesInit[e.id] = profils[e.id] || ligneVide()
      contratsInit[e.id] = e.contract_type || ''
    })

    setFormulaires(formulairesInit)
    setContracts(contratsInit)
    setConnus(deja)
    setSouilles({})
    setLoading(false)
    setRafraichir(false)
  }, [])

  useEffect(() => {
    if (selectedEntId) chargerTout(selectedEntId)
  }, [selectedEntId, chargerTout])

  const modifier = (id, champ, valeur) => {
    setFormulaires(f => ({ ...f, [id]: { ...(f[id] || ligneVide()), [champ]: valeur } }))
    setSouilles(s => ({ ...s, [id]: true }))
  }

  // ─────────────────────────────────────────────────────────
  //  ENREGISTRER
  // ─────────────────────────────────────────────────────────
  const enregistrer = async (id) => {
    const f = formulaires[id]
    if (!f || !selectedEntId) return

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
      setSouilles(s => ({ ...s, [id]: false }))
      toast.success('Rémunération enregistrée.')
    } catch (err) {
      toast.error("L'enregistrement n'a pas abouti.")
    }
    setEnregistrement(null)
  }

  const enregistrerTout = async () => {
    const ids = Object.keys(souilles).filter(id => souilles[id])
    if (ids.length === 0) {
      toast('Aucune modification en attente.')
      return
    }
    for (const id of ids) await enregistrer(id)
  }

  // ─────────────────────────────────────────────────────────
  //  LES CHIFFRES
  // ─────────────────────────────────────────────────────────
  const total = employes.length
  const renseignes = employes.filter(e => connus[e.id]).length
  const modifications = Object.values(souilles).filter(Boolean).length
  const complet = total > 0 && renseignes === total
  const progression = total > 0 ? Math.round((renseignes / total) * 100) : 0

  const masseMensuelle = employes.reduce((acc, e) => {
    const f = formulaires[e.id]
    if (!f) return acc
    if (f.salary_type === 'hourly') return acc + nombre(f.hourly_rate) * nombre(f.contract_hours_per_month)
    if (f.salary_type === 'daily') return acc + nombre(f.daily_rate) * nombre(f.contract_days_per_month)
    return acc + nombre(f.base_salary) + nombre(f.transport_allowance) + nombre(f.housing_allowance) + nombre(f.fixed_bonus)
  }, 0)

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <PageHeader
        title="Rémunérations"
        subtitle="Ce que prévoit chaque contrat : la base, le rythme et les heures attendues"
      />

      <div style={S.conteneur}>

        {/* ── L'entreprise ────────────────────────────────── */}
        <div style={S.carte}>
          <div style={{ ...S.ligne, gap: 12, flexWrap: 'wrap' }}>
            {estSuperAdmin && enterprises.length > 0 && (
              <>
                <span style={S.label}>ENTREPRISE</span>
                <select
                  style={S.select}
                  value={selectedEntId || ''}
                  onChange={(e) => setSelectedEntId(e.target.value)}
                >
                  {enterprises.map(e => (
                    <option key={e.id} value={e.id}>{e.name}{e.code ? ` (${e.code})` : ''}</option>
                  ))}
                </select>
              </>
            )}

            {entreprise && (
              <span style={{ fontSize: 13, color: '#64748B' }}>
                Devise <strong style={{ color: '#0F172A' }}>{entreprise.currency || 'non déclarée'}</strong>
                {' · '}
                Pays <strong style={{ color: '#0F172A' }}>{entreprise.country_code || 'non déclaré'}</strong>
              </span>
            )}

            <button
              style={S.btnFantome}
              onClick={() => { setRafraichir(true); chargerTout(selectedEntId) }}
              disabled={rafraichir}
            >
              <RefreshCw size={16} className={rafraichir ? 'spin' : ''} />
              <span>Rafraîchir</span>
            </button>

            <button
              style={{ ...S.btnPrimaire, marginLeft: 'auto' }}
              onClick={enregistrerTout}
              disabled={modifications === 0 || !!enregistrement}
            >
              <Save size={16} />
              <span>
                {enregistrement
                  ? 'Enregistrement…'
                  : modifications > 0
                    ? `Enregistrer (${modifications})`
                    : 'Enregistrer'}
              </span>
            </button>
          </div>
        </div>

        {/* ── Où en est-on ────────────────────────────────── */}
        {complet && total > 0 ? (
          <div style={S.succes}>
            <CheckCircle2 size={22} color="#047857" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13.5, lineHeight: 1.75, color: '#065F46' }}>
              <strong>Les {total} salariés sont renseignés.</strong> Le calcul du coût peut
              s'appuyer sur des bases complètes — il reste à vérifier les cotisations
              employeur dans <strong>Configuration fiscale</strong>.
            </div>
          </div>
        ) : (
          <div style={S.alerte}>
            <AlertTriangle size={22} color="#B91C1C" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, lineHeight: 1.75, color: '#7F1D1D' }}>
                <strong>{total - renseignes} salarié{total - renseignes > 1 ? 's' : ''} sur {total} n'a{total - renseignes > 1 ? 'ont' : ''} pas encore de rémunération déclarée.</strong>{' '}
                Tant qu'elle manque, leur coût est compté à zéro dans la page Coût salarial.
              </div>
              <div style={S.jauge}>
                <div style={{
                  width: `${progression}%`, height: '100%',
                  background: progression === 100 ? '#059669' : '#F59E0B', borderRadius: 99,
                }} />
              </div>
              <div style={{ fontSize: 12.5, color: '#991B1B', marginTop: 6, fontWeight: 700 }}>
                {progression} % renseigné
              </div>
            </div>
          </div>
        )}

        {/* ── Les indicateurs ─────────────────────────────── */}
        <div style={S.grille}>
          <div style={S.indicateur}>
            <div style={{ ...S.ligne, gap: 8, marginBottom: 8 }}>
              <Users size={16} color="#4F46E5" />
              <span style={S.label}>SALARIÉS RENSEIGNÉS</span>
            </div>
            <div style={S.chiffre}>
              {renseignes}<span style={S.unite || { fontSize: 15, color: '#94A3B8' }}> / {total}</span>
            </div>
          </div>

          <div style={S.indicateur}>
            <div style={{ ...S.ligne, gap: 8, marginBottom: 8 }}>
              <Wallet size={16} color="#4F46E5" />
              <span style={S.label}>MASSE MENSUELLE DÉCLARÉE</span>
            </div>
            <div style={S.chiffre}>{formaterMontant(masseMensuelle, devise)}</div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
              hors cotisations et heures supplémentaires
            </div>
          </div>

          <div style={S.indicateur}>
            <div style={{ ...S.ligne, gap: 8, marginBottom: 8 }}>
              <Clock size={16} color="#4F46E5" />
              <span style={S.label}>HEURES DE CONTRAT</span>
            </div>
            <div style={S.chiffre}>
              {formaterMontant(
                employes.reduce((acc, e) =>
                  acc + nombre(formulaires[e.id]?.contract_hours_per_month), 0), '')
              }<span style={{ fontSize: 15, color: '#94A3B8' }}> h / mois</span>
            </div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
              la référence du coût de l'heure prévu
            </div>
          </div>
        </div>

        {/* ── D'où vient le chiffre ───────────────────────── */}
        <div style={S.bandeau}>
          <Info size={20} color="#6366F1" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.8, color: '#3730A3' }}>
            Ces montants alimentent le calcul du coût, pas le bulletin. Les retenues et
            l'impôt suivent le <strong>barème du pays déclaré sur l'entreprise</strong> —
            pour un groupe présent dans plusieurs pays, chaque entreprise porte le sien.
            Le taux horaire est déduit de la base et des heures du contrat quand tu ne le
            saisis pas.
          </div>
        </div>

        {/* ── Le tableau ──────────────────────────────────── */}
        <div style={{ ...S.carte, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
              Contrat et rémunération
            </div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              Modifie une case puis enregistre : rien n'est écrit tant que tu ne le demandes pas.
            </div>
          </div>

          {loading ? (
            <div style={S.vide}>Chargement…</div>
          ) : employes.length === 0 ? (
            <div style={S.vide}>Aucun salarié actif sur cette entreprise.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="remu" style={S.tableau}>
                <thead>
                  <tr>
                    <th style={S.th}>Matricule</th>
                    <th style={S.th}>Salarié</th>
                    <th style={S.th}>Contrat</th>
                    <th style={S.th}>Rythme</th>
                    <th style={S.thD}>Base</th>
                    <th style={S.thD}>Taux / heure</th>
                    <th style={S.thD}>Taux / jour</th>
                    <th style={S.thD}>Heures</th>
                    <th style={S.thD}>Jours</th>
                    <th style={S.thD}>Transport</th>
                    <th style={S.thD}>Logement</th>
                    <th style={S.thD}>Prime</th>
                    <th style={S.thD}>Coût / heure</th>
                    <th style={{ ...S.thD, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employes.map(e => {
                    const f = formulaires[e.id] || ligneVide()
                    const heures = nombre(f.contract_hours_per_month)
                    const taux = nombre(f.hourly_rate) ||
                      (heures > 0 ? nombre(f.base_salary) / heures : 0)
                    return (
                      <tr key={e.id}>
                        <td style={S.td}>{e.matricule || '—'}</td>
                        <td style={S.tdNom}>
                          {[e.first_name, e.last_name].filter(Boolean).join(' ') || '—'}
                          <div style={{ fontSize: 11.5, fontWeight: 500, color: '#94A3B8' }}>
                            {e.position || e.department || ''}
                          </div>
                        </td>
                        <td style={S.td}>
                          <select
                            style={{ ...S.select, fontSize: 12.5, padding: '6px 8px' }}
                            value={contracts[e.id] || ''}
                            onChange={(ev) => {
                              setContracts(c => ({ ...c, [e.id]: ev.target.value }))
                              setSouilles(s => ({ ...s, [e.id]: true }))
                            }}
                          >
                            <option value="">—</option>
                            {TYPES_CONTRAT.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td style={S.td}>
                          <select
                            style={{ ...S.select, fontSize: 12.5, padding: '6px 8px' }}
                            value={f.salary_type || 'monthly'}
                            onChange={(ev) => modifier(e.id, 'salary_type', ev.target.value)}
                          >
                            {TYPES_REMUNERATION.map(t => (
                              <option key={t.id} value={t.id}>{t.libelle}</option>
                            ))}
                          </select>
                        </td>
                        <td style={S.td}>
                          <input
                            style={{ ...S.champ, width: 110 }}
                            value={f.base_salary}
                            onChange={(ev) => modifier(e.id, 'base_salary', ev.target.value)}
                            inputMode="decimal"
                          />
                        </td>
                        <td style={S.td}>
                          <input
                            style={{ ...S.champ, width: 90 }}
                            value={f.hourly_rate}
                            onChange={(ev) => modifier(e.id, 'hourly_rate', ev.target.value)}
                            inputMode="decimal"
                          />
                        </td>
                        <td style={S.td}>
                          <input
                            style={{ ...S.champ, width: 90 }}
                            value={f.daily_rate}
                            onChange={(ev) => modifier(e.id, 'daily_rate', ev.target.value)}
                            inputMode="decimal"
                          />
                        </td>
                        <td style={S.td}>
                          <input
                            style={{ ...S.champ, width: 74 }}
                            value={f.contract_hours_per_month}
                            onChange={(ev) => modifier(e.id, 'contract_hours_per_month', ev.target.value)}
                            inputMode="decimal"
                          />
                        </td>
                        <td style={S.td}>
                          <input
                            style={{ ...S.champ, width: 64 }}
                            value={f.contract_days_per_month}
                            onChange={(ev) => modifier(e.id, 'contract_days_per_month', ev.target.value)}
                            inputMode="decimal"
                          />
                        </td>
                        <td style={S.td}>
                          <input
                            style={{ ...S.champ, width: 90 }}
                            value={f.transport_allowance}
                            onChange={(ev) => modifier(e.id, 'transport_allowance', ev.target.value)}
                            inputMode="decimal"
                          />
                        </td>
                        <td style={S.td}>
                          <input
                            style={{ ...S.champ, width: 90 }}
                            value={f.housing_allowance}
                            onChange={(ev) => modifier(e.id, 'housing_allowance', ev.target.value)}
                            inputMode="decimal"
                          />
                        </td>
                        <td style={S.td}>
                          <input
                            style={{ ...S.champ, width: 90 }}
                            value={f.fixed_bonus}
                            onChange={(ev) => modifier(e.id, 'fixed_bonus', ev.target.value)}
                            inputMode="decimal"
                          />
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {taux > 0 ? formaterMontant(taux, devise) : '—'}
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <button
                            style={S.btnMinute}
                            onClick={() => enregistrer(e.id)}
                            disabled={enregistrement === e.id}
                          >
                            {enregistrement === e.id ? '…' : souilles[e.id] ? 'Enregistrer' : 'À jour'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── La note de bas de page ──────────────────────── */}
        <div style={{ ...S.carte, background: '#F8FAFC' }}>
          <div style={{ ...S.ligne, gap: 8, marginBottom: 6 }}>
            <TrendingUp size={16} color="#4F46E5" />
            <span style={S.label}>ET ENSUITE</span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: '#475569' }}>
            Une fois les rémunérations déclarées et les cotisations employeur renseignées
            dans Configuration fiscale, la page <strong>Coût salarial</strong> affiche le coût
            réel de chaque personne et la projection du mois.
          </div>
        </div>

      </div>
    </div>
  )
}
