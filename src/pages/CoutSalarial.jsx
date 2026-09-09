// src/pages/CoutSalarial.jsx
// ═══════════════════════════════════════════════════════════════════════════
//  Le coût salarial — ce que chaque personne coûte à l'entreprise
// ═══════════════════════════════════════════════════════════════════════════
//
//  Cette page répond à trois questions que personne ne posait au logiciel :
//
//    · combien me coûte cette personne, sur la période que je regarde ?
//    · combien me revient l'heure, réellement — pas l'heure théorique ?
//    · combien je vais payer ce mois-ci, et où en suis-je de mon budget ?
//
//  D'UN CÔTÉ LE CERTAIN, DE L'AUTRE LE VARIABLE
//  ────────────────────────────────────────────
//  La part contractuelle du mois sera payée quoi qu'il arrive. La part
//  variable — heures supplémentaires et heures de nuit — dépend de ce qui a
//  été pointé. La projection du mois sépare les deux, et n'extrapole le
//  variable qu'au rythme du planning : jamais à partir d'un à-coup.
//
//  SI UNE BRIQUE MANQUE
//  ───────────────────
//  Le calcul lit ce qui existe déjà : les profils de paie pour le brut, les
//  cotisations de l'entreprise pour les charges, les pointages pour les
//  heures. S'il manque des profils ou des cotisations, la page l'affiche et
//  continue d'afficher le reste, au lieu de faire semblant.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, RefreshCw, AlertTriangle, Info, TrendingUp, TrendingDown,
  Clock, Users, Calendar, PiggyBank, CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

// ───────────────────────────────────────────────────────────────────────────
//  PRÉSENTATION
// ───────────────────────────────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#F8FAFC', paddingBottom: 48 },
  conteneur: { maxWidth: 1180, margin: '0 auto', padding: '0 24px' },
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
  titre: { fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 2 },
  sousTitre: { fontSize: 13, color: '#64748B' },
  ligne: { display: 'flex', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: 0.4 },
  select: {
    border: '1px solid #CBD5E1', borderRadius: 9, padding: '8px 12px',
    fontSize: 14, background: '#FFFFFF', color: '#0F172A', outline: 'none',
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
  grille: {
    display: 'grid', gap: 14, marginBottom: 16,
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  },
  indicateur: {
    background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14,
    padding: '16px 18px',
  },
  chiffre: { fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1.15 },
  unite: { fontSize: 13, fontWeight: 700, color: '#94A3B8', marginLeft: 4 },
  tableau: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: {
    textAlign: 'right', padding: '10px 12px', color: '#64748B',
    fontSize: 11.5, fontWeight: 800, letterSpacing: 0.5,
    borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap',
  },
  thG: {
    textAlign: 'left', padding: '10px 12px', color: '#64748B',
    fontSize: 11.5, fontWeight: 800, letterSpacing: 0.5,
    borderBottom: '1px solid #E2E8F0',
  },
  td: {
    textAlign: 'right', padding: '11px 12px', borderBottom: '1px solid #F1F5F9',
    color: '#0F172A', whiteSpace: 'nowrap',
  },
  tdG: {
    textAlign: 'left', padding: '11px 12px', borderBottom: '1px solid #F1F5F9',
    color: '#0F172A', fontWeight: 700,
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
  table.cout tbody tr:hover { background: #F8FAFC; }
`

// ───────────────────────────────────────────────────────────────────────────
//  OUTILS
// ───────────────────────────────────────────────────────────────────────────
function formaterMontant(v, devise) {
  if (v === null || v === undefined || Number.isNaN(Number(v)) || Number(v) === 0) return '—'
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v))
  return devise ? `${n} ${devise}` : n
}

function formaterHeures(v) {
  if (v === null || v === undefined || Number(v) === 0) return '—'
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(v))} h`
}

function formaterEcart(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  const couleur = n > 0 ? '#DC2626' : n < 0 ? '#059669' : '#64748B'
  const fleche = n > 0 ? '▲' : n < 0 ? '▼' : '='
  return (
    <span style={{ color: couleur, fontWeight: 700 }}>
      {fleche} {Math.abs(n).toFixed(1)} %
    </span>
  )
}

function debutEtFinDeMois(dateReference) {
  const d = dateReference || new Date()
  const du = new Date(d.getFullYear(), d.getMonth(), 1)
  const au = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { du, au }
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PERIODES = [
  { id: 'jour',  libelle: "Aujourd'hui" },
  { id: 'mois',  libelle: 'Ce mois-ci' },
  { id: 'passe', libelle: 'Le mois dernier' },
  { id: 'an',    libelle: 'Cette année' },
]

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// ───────────────────────────────────────────────────────────────────────────
//  LE MOIS AFFICHÉ
//
//  Le calcul des heures est juste, mais un mois sans pointage donne « 0,00 h »
//  et fait croire à une panne. Alors l'écran se place de lui-même sur le
//  dernier mois où l'équipe a réellement pointé, prévient quand ce n'est pas
//  le mois en cours, et laisse naviguer d'un mois à l'autre.
// ───────────────────────────────────────────────────────────────────────────
function moisActuel() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function libelleMois(moisStr) {
  if (!moisStr) return ''
  const [a, m] = String(moisStr).split('-').map(Number)
  return `${MOIS_FR[(m || 1) - 1]} ${a}`
}

function ajouterMois(moisStr, combien) {
  const [a, m] = String(moisStr).split('-').map(Number)
  const d = new Date(a, (m || 1) - 1 + combien, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════════════════════
//  LA PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function CoutSalarial() {
  const navigate = useNavigate()

  const [admin, setAdmin] = useState(null)
  const [enterprises, setEnterprises] = useState([])
  const [selectedEntId, setSelectedEntId] = useState(null)
  const [entreprise, setEntreprise] = useState(null)

  const [periode, setPeriode] = useState('mois')
  const [lignes, setLignes] = useState([])
  const [projection, setProjection] = useState(null)
  const [budget, setBudget] = useState(null)
  const [masseMois, setMasseMois] = useState(null)
  const [completude, setCompletude] = useState({ profils: 0, actifs: 0, cotisations: 0 })

  const [moisPointes, setMoisPointes] = useState([])
  const [moisAffiche, setMoisAffiche] = useState(null)

  const [loading, setLoading] = useState(true)
  const [rafraichir, setRafraichir] = useState(false)
  const [verification, setVerification] = useState(false)
  const [calculAbsent, setCalculAbsent] = useState(false)

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
    setCalculAbsent(false)

    const [resEnt, resLignes, resProjection, resProfils, resBudget, resMois, resCot, resActifs] = await Promise.all([
      supabase
        .from('enterprises')
        .select('id, name, code, currency, country_code')
        .eq('id', entId)
        .maybeSingle(),
      supabase.rpc('encheck_cout_periode', {
        p_enterprise: entId,
        p_du: bornes(periode, moisAffiche).du,
        p_au: bornes(periode, moisAffiche).au,
      }),
      supabase.rpc('encheck_cout_projeter', { p_enterprise: entId }),
      supabase
        .from('employee_payroll_profiles')
        .select('employee_id, base_salary, hourly_rate, daily_rate')
        .eq('enterprise_id', entId)
        .eq('is_active', true),
      supabase
        .from('encheck_reglages_cout')
        .select('budget_mensuel, seuil_alerte_pct, alerte_actif')
        .eq('enterprise_id', entId)
        .maybeSingle(),
      supabase.rpc('encheck_cout_periode', {
        p_enterprise: entId,
        p_du: bornes('mois', moisAffiche).du,
        p_au: bornes('mois', moisAffiche).au,
      }),
      supabase
        .from('enterprise_payroll_contributions')
        .select('id', { count: 'exact', head: true })
        .eq('enterprise_id', entId)
        .eq('is_active', true)
        .gt('rate_employer', 0),
      supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('enterprise_id', entId)
        .eq('is_active', true),
    ])

    if (resEnt.data) setEntreprise(resEnt.data)

    //  Le calcul n'est pas installé sur cette base : on le dit, sans casser
    //  le reste de la page.
    if (resLignes.error && /PGRST202|Could not find the function/i.test(resLignes.error.message || '')) {
      setCalculAbsent(true)
      setLignes([])
    } else if (resLignes.error) {
      toast.error("Le calcul du coût n'a pas répondu.")
      setLignes([])
    } else {
      setLignes(resLignes.data || [])
    }

    setProjection(resProjection.error ? null : resProjection.data || null)
    setBudget(resBudget.error ? null : resBudget.data || null)

    //  La masse du mois entier sert de repli : si la projection ne répond pas,
    //  on affiche au moins le mois compté — jamais un tiret à la place d'un
    //  chiffre qu'on sait calculer.
    if (!resMois.error && Array.isArray(resMois.data)) {
      setMasseMois(resMois.data.reduce((acc, l) => acc + (Number(l.cout) || 0), 0))
    } else {
      setMasseMois(null)
    }

    //  Un profil qui existe mais ne porte aucun montant ne compte pas : c'est
    //  une ligne vide, pas une rémunération déclarée.
    const renseignes = (resProfils.data || []).filter(p =>
      Number(p.base_salary) > 0 || Number(p.hourly_rate) > 0 || Number(p.daily_rate) > 0
    ).length

    setCompletude({
      profils: renseignes,
      actifs: resActifs.count || 0,
      cotisations: resCot.count || 0,
    })

    setLoading(false)
    setRafraichir(false)
  }, [periode, moisAffiche])

  // ─────────────────────────────────────────────────────────
  //  LE MOIS À AFFICHER, AVANT LES CHIFFRES
  //
  //  On regarde d'abord quels mois ont été pointés. Si le mois en
  //  cours en fait partie, on s'y place. Sinon, on va sur le dernier
  //  mois réellement travaillé : un écran de coût qui affiche 0,00 h
  //  trois fois sur quatre passe pour une panne.
  // ─────────────────────────────────────────────────────────
  const preparerMois = useCallback(async (entId) => {
    if (!entId) return

    const { data } = await supabase.rpc('encheck_mois_pointes', { p_enterprise: entId })

    const liste = (data || []).map(r => ({
      mois: String(r.mois).slice(0, 7),
      nb: Number(r.nb_pointages) || 0,
    }))

    setMoisPointes(liste)

    const actuel = moisActuel()
    if (liste.some(m => m.mois === actuel && m.nb > 0)) {
      setMoisAffiche(actuel)
      return
    }
    const dernier = liste.find(m => m.nb > 0)
    setMoisAffiche(dernier ? dernier.mois : actuel)
  }, [])

  useEffect(() => {
    if (selectedEntId) preparerMois(selectedEntId)
  }, [selectedEntId, preparerMois])

  useEffect(() => {
    if (selectedEntId && moisAffiche) chargerTout(selectedEntId)
  }, [selectedEntId, moisAffiche, chargerTout])

  const nbDuMoisAffiche = (moisPointes.find(m => m.mois === moisAffiche) || {}).nb || 0
  const dernierMoisPointe = (moisPointes.find(m => m.nb > 0) || {}).mois || null

  //  Le message dit pourquoi on est sur ce mois-là. Il ne s'affiche que s'il a
  //  quelque chose à dire : jamais une case vide pour faire joli.
  const messageMois = !moisAffiche || periode !== 'mois'
    ? null
    : nbDuMoisAffiche === 0 && dernierMoisPointe
      ? { fond: '#FFFBEB', bord: '#FDE68A', couleur: '#78350F', icone: '#B45309',
          texte: `Aucun pointage en ${libelleMois(moisAffiche)} : les heures réelles sont donc à zéro, ce n'est pas une panne. Le dernier mois où ton équipe a pointé, c'est ${libelleMois(dernierMoisPointe)}.` }
      : nbDuMoisAffiche === 0
        ? { fond: '#FFFBEB', bord: '#FDE68A', couleur: '#78350F', icone: '#B45309',
            texte: `Aucun pointage en ${libelleMois(moisAffiche)} : les heures réelles sont donc à zéro, ce n'est pas une panne. Le montant affiché est celui du contrat.` }
        : moisAffiche !== moisActuel()
          ? { fond: '#EFF6FF', bord: '#BFDBFE', couleur: '#1E3A8A', icone: '#1D4ED8',
              texte: `Tu regardes ${libelleMois(moisAffiche)} : le mois en cours n'a pas encore de pointage, l'écran s'est placé sur le dernier mois travaillé. ${nbDuMoisAffiche} pointage(s) compté(s).` }
          : null

  // ─────────────────────────────────────────────────────────
  //  LE CONTRÔLE DU BUDGET
  // ─────────────────────────────────────────────────────────
  const verifierBudget = async () => {
    if (!selectedEntId) return
    setVerification(true)
    const { data, error } = await supabase
      .rpc('encheck_cout_controler', { p_enterprise: selectedEntId })

    if (error) {
      toast.error("Le contrôle n'a pas abouti.")
    } else if (data === 1) {
      toast.success('Une alerte a été écrite : la projection dépasse le seuil.')
      chargerTout(selectedEntId)
    } else if (data === -1) {
      toast.error("Vous n'avez pas accès à cette entreprise.")
    } else {
      toast.success('Rien à signaler : la projection tient dans le budget.')
    }
    setVerification(false)
  }

  // ─────────────────────────────────────────────────────────
  //  LES CHIFFRES AGRÉGÉS
  // ─────────────────────────────────────────────────────────
  const totaux = (lignes || []).reduce(
    (acc, l) => {
      acc.cout += Number(l.cout) || 0
      acc.brut += Number(l.brut) || 0
      acc.charges += Number(l.charges) || 0
      acc.heures += Number(l.heures) || 0
      acc.heuresSup += Number(l.heures_sup) || 0
      acc.heuresNuit += Number(l.heures_nuit) || 0
      return acc
    },
    { cout: 0, brut: 0, charges: 0, heures: 0, heuresSup: 0, heuresNuit: 0 }
  )

  const coutHoraireMoyen = totaux.heures > 0 ? totaux.cout / totaux.heures : null
  const avecDesHeures = (lignes || []).filter(l => Number(l.heures) > 0).length
  const sansProfil = Math.max(0, (completude.actifs || 0) - (completude.profils || 0))
  //  La projection est celle du serveur quand il répond ; sinon, le mois
  //  compté fait foi. Le budget vient du réglage, lu directement.
  const projete = projection?.projete ?? masseMois
  const budgetDeclare = budget?.budget_mensuel ?? null
  const depassement = (projete && budgetDeclare && budgetDeclare > 0)
    ? Math.round((projete / budgetDeclare) * 1000) / 10
    : null

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <PageHeader
        title="Coût salarial"
        subtitle="Ce que chaque personne coûte à l'entreprise, et combien l'heure vous revient vraiment"
      />

      <div style={S.conteneur}>

        {/* ── L'entreprise et la période ───────────────────── */}
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

            <span style={{ ...S.label, marginLeft: estSuperAdmin ? 12 : 0 }}>PÉRIODE</span>
            <select
              style={S.select}
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
            >
              {PERIODES.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
            </select>

            {/* ── D'un mois à l'autre ───────────────────────────────────── */}
            {(periode === 'mois' || periode === 'an') && moisAffiche && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 2,
                background: '#F1F5F9', borderRadius: 8, padding: '2px 3px',
              }}>
                <button
                  type="button"
                  onClick={() => setMoisAffiche(ajouterMois(moisAffiche, -1))}
                  title="Mois précédent"
                  style={{ ...S.btnFantome, padding: '5px 9px', minWidth: 0, background: 'transparent' }}
                >
                  <span style={{ fontSize: 12, lineHeight: 1 }}>◀</span>
                </button>

                <span style={{
                  fontSize: 12.5, fontWeight: 700, color: '#0F172A',
                  minWidth: 124, textAlign: 'center', textTransform: 'capitalize',
                }}>
                  {libelleMois(moisAffiche)}
                </span>

                <button
                  type="button"
                  onClick={() => setMoisAffiche(ajouterMois(moisAffiche, 1))}
                  disabled={moisAffiche >= moisActuel()}
                  title={moisAffiche >= moisActuel() ? 'On ne va pas plus loin que le mois en cours' : 'Mois suivant'}
                  style={{
                    ...S.btnFantome, padding: '5px 9px', minWidth: 0, background: 'transparent',
                    opacity: moisAffiche >= moisActuel() ? 0.3 : 1,
                    cursor: moisAffiche >= moisActuel() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={{ fontSize: 12, lineHeight: 1 }}>▶</span>
                </button>
              </div>
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
              onClick={verifierBudget}
              disabled={verification || !budgetDeclare}
              title={budgetDeclare ? 'Contrôler la projection du mois' : 'Déclarez d’abord un budget mensuel'}
            >
              <PiggyBank size={16} />
              <span>{verification ? 'Contrôle…' : 'Contrôler le budget'}</span>
            </button>
          </div>
        </div>

        {/* ── Pourquoi ce mois-là ───────────────────────────── */}
        {messageMois && !loading && (
          <div style={{
            ...S.alerte,
            background: messageMois.fond,
            borderColor: messageMois.bord,
          }}>
            <Info size={22} color={messageMois.icone} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13.5, lineHeight: 1.75, color: messageMois.couleur }}>
              <strong>{libelleMois(moisAffiche)} : </strong>{messageMois.texte}
              {dernierMoisPointe && dernierMoisPointe !== moisAffiche && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => setMoisAffiche(dernierMoisPointe)}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: messageMois.couleur, fontWeight: 700,
                      textDecoration: 'underline', cursor: 'pointer', fontSize: 13.5,
                    }}
                  >
                    y aller
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Ce qui manque pour un chiffre complet ────────── */}
        {(sansProfil > 0 || completude.cotisations === 0) && !loading && (
          <div style={S.alerte}>
            <AlertTriangle size={22} color="#B91C1C" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13.5, lineHeight: 1.75, color: '#7F1D1D' }}>
              <strong>Ce chiffre n'est pas encore complet.</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {sansProfil > 0 && (
                  <li>
                    {sansProfil} salarié{sansProfil > 1 ? 's' : ''} sur {completude.actifs || 0} n'a
                    {sansProfil > 1 ? 'ont' : ''} encore aucun montant déclaré : leur coût se
                    limite aux charges fixes, quand il y en a. Renseignez-le depuis la page{' '}
                    <strong>Rémunérations</strong>.
                  </li>
                )}
                {completude.cotisations === 0 && (
                  <li>
                    Aucune cotisation employeur n'est déclarée : le coût se limite au brut.
                    Déclarez-les dans <strong>Configuration fiscale</strong>.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {calculAbsent && (
          <div style={S.alerte}>
            <AlertTriangle size={22} color="#B91C1C" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13.5, lineHeight: 1.75, color: '#7F1D1D' }}>
              Le calcul du coût n'est pas installé sur cette base. Les autres pages continuent
              de fonctionner normalement.
            </div>
          </div>
        )}

        {/* ── Les indicateurs ──────────────────────────────── */}
        <div style={S.grille}>
          <div style={S.indicateur}>
            <div style={{ ...S.ligne, gap: 8, marginBottom: 8 }}>
              <Wallet size={16} color="#4F46E5" />
              <span style={S.label}>MASSE SALARIALE</span>
            </div>
            <div style={S.chiffre}>
              {formaterMontant(totaux.cout, devise)}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
              dont {formaterMontant(totaux.charges, devise)} de charges
            </div>
          </div>

          <div style={S.indicateur}>
            <div style={{ ...S.ligne, gap: 8, marginBottom: 8 }}>
              <Clock size={16} color="#4F46E5" />
              <span style={S.label}>COÛT DE L'HEURE RÉELLE</span>
            </div>
            <div style={S.chiffre}>
              {formaterMontant(coutHoraireMoyen, devise)}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
              {formaterHeures(totaux.heures)} pointées sur la période
            </div>
          </div>

          <div style={S.indicateur}>
            <div style={{ ...S.ligne, gap: 8, marginBottom: 8 }}>
              <Users size={16} color="#4F46E5" />
              <span style={S.label}>HEURES AU-DELÀ DU CONTRAT</span>
            </div>
            <div style={S.chiffre}>{formaterHeures(totaux.heuresSup)}</div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
              et {formaterHeures(totaux.heuresNuit)} de nuit
            </div>
          </div>

          <div style={S.indicateur}>
            <div style={{ ...S.ligne, gap: 8, marginBottom: 8 }}>
              <Calendar size={16} color="#4F46E5" />
              <span style={S.label}>PROJECTION DU MOIS</span>
            </div>
            <div style={S.chiffre}>
              {formaterMontant(projete, devise)}
            </div>
            {budgetDeclare ? (
              <>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
                  budget {formaterMontant(budgetDeclare, devise)}
                </div>
                <div style={S.jauge}>
                  <div style={{
                    width: `${Math.min(100, Math.max(0, depassement || 0))}%`,
                    height: '100%',
                    background: depassement > 100 ? '#DC2626' : depassement > (budget?.seuil_alerte_pct || 90) ? '#F59E0B' : '#059669',
                    borderRadius: 99,
                  }} />
                </div>
                <div style={{
                  fontSize: 12.5, marginTop: 6, fontWeight: 700,
                  color: depassement > 100 ? '#DC2626' : depassement > (budget?.seuil_alerte_pct || 90) ? '#B45309' : '#047857',
                }}>
                  {depassement} % du budget
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 4 }}>
                aucun budget déclaré
              </div>
            )}
          </div>
        </div>

        {/* ── D'où vient le chiffre ────────────────────────── */}
        <div style={S.bandeau}>
          <Info size={20} color="#6366F1" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.8, color: '#3730A3' }}>
            Le brut est repris des profils de paie, les charges des cotisations déclarées pour
            l'entreprise, et les heures des pointages — les mêmes que celles des heures
            supplémentaires et de la majoration de nuit. Le coût de l'heure <strong>réelle</strong>{' '}
            rapporte le coût de la période aux heures effectivement faites : un mois troué
            d'absences le fait grimper, des heures supplémentaires le font baisser.
          </div>
        </div>

        {/* ── Le détail, personne par personne ─────────────── */}
        <div style={{ ...S.carte, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={S.titre}>Personne par personne</div>
            <div style={S.sousTitre}>
              {lignes.length} salarié{lignes.length > 1 ? 's' : ''}
              {avecDesHeures < lignes.length && ` · ${avecDesHeures} avec des heures pointées`}
            </div>
          </div>

          {loading ? (
            <div style={S.vide}>Calcul en cours…</div>
          ) : lignes.length === 0 ? (
            <div style={S.vide}>Aucun salarié actif sur cette entreprise.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="cout" style={S.tableau}>
                <thead>
                  <tr>
                    <th style={S.thG}>Matricule</th>
                    <th style={S.thG}>Nom</th>
                    <th style={S.th}>Heures</th>
                    <th style={S.th}>dont sup.</th>
                    <th style={S.th}>dont nuit</th>
                    <th style={S.th}>Brut</th>
                    <th style={S.th}>Charges</th>
                    <th style={S.th}>Coût</th>
                    <th style={S.th}>L'heure réelle</th>
                    <th style={S.th}>L'heure prévue</th>
                    <th style={S.th}>Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.employe_id}>
                      <td style={S.tdG}>{l.matricule || '—'}</td>
                      <td style={{ ...S.tdG, fontWeight: 600 }}>{l.nom || '—'}</td>
                      <td style={S.td}>{formaterHeures(l.heures)}</td>
                      <td style={S.td}>{formaterHeures(l.heures_sup)}</td>
                      <td style={S.td}>{formaterHeures(l.heures_nuit)}</td>
                      <td style={S.td}>{formaterMontant(l.brut, devise)}</td>
                      <td style={S.td}>{formaterMontant(l.charges, devise)}</td>
                      <td
                        style={{
                          ...S.td, fontWeight: 800,
                          color: Number(l.brut) === 0 ? '#94A3B8' : '#0F172A',
                        }}
                        title={Number(l.brut) === 0
                          ? 'Rémunération non déclarée : seules les charges fixes sont comptées.'
                          : undefined}
                      >
                        {formaterMontant(l.cout, devise)}
                      </td>
                      <td style={S.td}>{formaterMontant(l.cout_heure, devise)}</td>
                      <td style={S.td}>
                        {Number(l.cout_heure_prevu) > 0
                          ? formaterMontant(l.cout_heure_prevu, devise)
                          : '—'}
                      </td>
                      <td style={S.td}>
                        {Number(l.heures) > 0 ? formaterEcart(l.ecart_pct) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#F8FAFC' }}>
                    <td style={{ ...S.tdG, borderBottom: 'none' }} colSpan={2}>Total</td>
                    <td style={{ ...S.td, borderBottom: 'none', fontWeight: 800 }}>
                      {formaterHeures(totaux.heures)}
                    </td>
                    <td style={{ ...S.td, borderBottom: 'none', fontWeight: 800 }}>
                      {formaterHeures(totaux.heuresSup)}
                    </td>
                    <td style={{ ...S.td, borderBottom: 'none', fontWeight: 800 }}>
                      {formaterHeures(totaux.heuresNuit)}
                    </td>
                    <td style={{ ...S.td, borderBottom: 'none', fontWeight: 800 }}>
                      {formaterMontant(totaux.brut, devise)}
                    </td>
                    <td style={{ ...S.td, borderBottom: 'none', fontWeight: 800 }}>
                      {formaterMontant(totaux.charges, devise)}
                    </td>
                    <td style={{ ...S.td, borderBottom: 'none', fontWeight: 800 }}>
                      {formaterMontant(totaux.cout, devise)}
                    </td>
                    <td style={{ ...S.td, borderBottom: 'none', fontWeight: 800 }}>
                      {formaterMontant(coutHoraireMoyen, devise)}
                    </td>
                    <td style={{ ...S.td, borderBottom: 'none' }} colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── La note de bas de page ───────────────────────── */}
        <div style={{ ...S.carte, background: '#F8FAFC' }}>
          <div style={{ ...S.ligne, gap: 8, marginBottom: 6 }}>
            <CheckCircle2 size={16} color="#059669" />
            <span style={S.label}>CE QUE CETTE PAGE NE FAIT PAS</span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: '#475569' }}>
            Elle prépare la paie, elle ne la déclare pas. Le net versé au salarié est calculé par
            le moteur fiscal de l'application, avec les règles du pays déclaré sur l'entreprise
            {entreprise?.country_code ? ` (${entreprise.country_code})` : ''}. Les montants affichés
            ici servent à décider ; l'édition des bulletins et les déclarations restent du
            ressort de la comptabilité.
          </div>
        </div>

      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
//  Les bornes de la période demandée
// ───────────────────────────────────────────────────────────────────────────
function bornes(periode, moisRef) {
  const aujourdhui = new Date()

  //  Le mois affiché sert de point de départ. Sans lui, on retombe sur le mois
  //  en cours — qui est vide au début du mois, et donnerait « 0,00 h ».
  let reference = aujourdhui
  if (moisRef) {
    const [a, m] = String(moisRef).split('-').map(Number)
    reference = new Date(a, (m || 1) - 1, 1)
  }

  if (periode === 'jour') {
    return { du: iso(aujourdhui), au: iso(aujourdhui) }
  }

  if (periode === 'passe') {
    const m = new Date(reference.getFullYear(), reference.getMonth() - 1, 1)
    const { du, au } = debutEtFinDeMois(m)
    return { du: iso(du), au: iso(au) }
  }

  if (periode === 'an') {
    return {
      du: `${reference.getFullYear()}-01-01`,
      au: `${reference.getFullYear()}-12-31`,
    }
  }

  const { du, au } = debutEtFinDeMois(reference)
  return { du: iso(du), au: iso(au) }
}
