// src/pages/ConfigurationFiscale.jsx

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Globe,
  Shield,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  DollarSign,
  Percent,
  AlertTriangle,
  CheckCircle,
  Info,
  Download,
  Settings,
  FileText,
  Edit,
  X,
  SlidersHorizontal,
  Sparkles,
  Calculator,
  Eye,
  BadgeHelp,
  Landmark,
  HelpCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import TaxationService from '../services/taxationService'
import FeatureService, { FEATURES } from '../services/featureService'
import CurrencyService from '../services/currencyService'
import toast from 'react-hot-toast'

function FieldHelp({ text, example }) {
  const [show, setShow] = useState(false)

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <HelpCircle
        size={14}
        color="#666"
        style={{ cursor: 'pointer', marginLeft: 6, flexShrink: 0 }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <div style={S.tooltip}>
          <p style={{ color: '#DDD', fontSize: 12, margin: '0 0 6px 0', lineHeight: 1.5 }}>{text}</p>
          {example && (
            <div style={S.tooltipExample}>
              <span
                style={{
                  color: '#888',
                  fontSize: 10,
                  display: 'block',
                  marginBottom: 3,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Exemple
              </span>
              <span style={{ color: '#F59E0B', fontSize: 12, fontWeight: 600 }}>{example}</span>
            </div>
          )}
          <div style={S.tooltipArrow} />
        </div>
      )}
    </span>
  )
}

function FormLabel({ children, help, example, required }) {
  return (
    <label style={S.label}>
      {children}
      {required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
      {help && <FieldHelp text={help} example={example} />}
    </label>
  )
}

export default function ConfigurationFiscale() {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [enterpriseId, setEnterpriseId] = useState(null)
  const [enterpriseName, setEnterpriseName] = useState('')

  // Plus de pays/devise inventés : tant que la donnée n'est pas chargée,
  // l'interface affiche « non défini » au lieu d'un faux 'CMR'/'XAF'.
  const [currentCountryCode, setCurrentCountryCode] = useState(null)
  const [currentCurrency, setCurrentCurrency] = useState(null)
  const [currentFiscalCountryLabel, setCurrentFiscalCountryLabel] = useState('')

  const [pendingCountryCode, setPendingCountryCode] = useState(null)
  const [pendingCurrency, setPendingCurrency] = useState(null)
  const [pendingFiscalCountryLabel, setPendingFiscalCountryLabel] = useState('')

  const [availableCountries, setAvailableCountries] = useState([])
  const [contributions, setContributions] = useState([])
  const [taxBrackets, setTaxBrackets] = useState([])
  const [calculationRules, setCalculationRules] = useState({})

  const [activeTab, setActiveTab] = useState('contributions')

  const [editingContribution, setEditingContribution] = useState(null)
  const [editingBracket, setEditingBracket] = useState(null)
  const [showAddContribution, setShowAddContribution] = useState(false)
  const [showAddBracket, setShowAddBracket] = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false)

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirmer',
    type: 'warning',
    onConfirm: null,
  })

  const [simulationGross, setSimulationGross] = useState(250000)
  // ⭐ LE QUOTIENT FAMILIAL — deux champs, et ils n'apparaissent QUE pour les
  //   pays qui l'utilisent vraiment. Le simulateur ne pouvait simuler qu'un
  //   célibataire : il annonçait donc 26 741 F à un parent congolais qui doit
  //   10 269 F. Un simulateur qui ignore la famille fait peur pour rien.
  const [simulationSituation, setSimulationSituation] = useState('')
  const [simulationEnfants, setSimulationEnfants] = useState(0)

  const navigate = useNavigate()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }

    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)
    initPage(parsedAdmin)
  }, [navigate])

  const initPage = async (adminData) => {
    setLoading(true)
    try {
      const targetEnterpriseId = adminData.selectedEnterprise?.id || adminData.enterprise_id

      if (!targetEnterpriseId) {
        toast.error('Aucune entreprise sélectionnée')
        navigate('/dashboard')
        return
      }

      const hasAccess = await FeatureService.hasFeature(targetEnterpriseId, FEATURES.FICHES_PAIE)
      if (!hasAccess) {
        toast.error('Module fiches de paie non activé')
        navigate('/dashboard')
        return
      }

      const { data: enterprise } = await supabase
        .from('enterprises')
        .select('id, name, country_code, currency, fiscal_country_label')
        .eq('id', targetEnterpriseId)
        .single()

      setEnterpriseId(targetEnterpriseId)
      setEnterpriseName(enterprise?.name || 'Entreprise')
      setCurrentCountryCode(enterprise?.country_code || null)
      setCurrentCurrency(
        CurrencyService.resolveCurrency({ enterprise }) || null,
      )
      setCurrentFiscalCountryLabel(enterprise?.fiscal_country_label || '')

      setPendingCountryCode(enterprise?.country_code || null)
      setPendingCurrency(
        CurrencyService.resolveCurrency({ enterprise }) || null,
      )
      setPendingFiscalCountryLabel(enterprise?.fiscal_country_label || '')

      const countries = await TaxationService.getAvailableCountries()
      setAvailableCountries(countries)

      await loadCurrentConfig(targetEnterpriseId)
    } catch (err) {
      console.error(err)
      toast.error('Erreur chargement configuration')
      navigate('/dashboard')
    }
    setLoading(false)
  }

  const loadCurrentConfig = async (entId) => {
    try {
      const config = await TaxationService.getEnterprisePayrollConfig(entId)
      setContributions(config.contributions || [])
      setTaxBrackets(config.taxBrackets || [])
      setCalculationRules(config.calculationRules || {})
    } catch (err) {
      console.error('Erreur chargement config:', err)
    }
  }

  const openConfirm = ({ title, message, confirmText = 'Confirmer', type = 'warning', onConfirm }) => {
    setConfirmModal({
      open: true,
      title,
      message,
      confirmText,
      type,
      onConfirm,
    })
  }

  const closeConfirm = () => {
    setConfirmModal({
      open: false,
      title: '',
      message: '',
      confirmText: 'Confirmer',
      type: 'warning',
      onConfirm: null,
    })
  }

  const handleApplyCountryAndCurrency = async () => {
    if (!enterpriseId) return

    // Garde-fou : on refuse d'enregistrer un couple pays/devise incohérent.
    const coherence = CurrencyService.checkCoherence({
      country_code: pendingCountryCode,
      currency: pendingCurrency,
    })
    if (!coherence.ok) {
      toast.error(coherence.message || 'Pays et devise incohérents', { duration: 6000 })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('enterprises')
        .update({
          country_code: pendingCountryCode,
          currency: pendingCurrency,
          fiscal_country_label: pendingFiscalCountryLabel || null,
        })
        .eq('id', enterpriseId)

      if (error) throw error

      setCurrentCountryCode(pendingCountryCode)
      setCurrentCurrency(pendingCurrency)
      setCurrentFiscalCountryLabel(pendingFiscalCountryLabel)

      toast.success('Pays fiscal, libellé et devise enregistrés')
    } catch (err) {
      console.error(err)
      toast.error('Erreur enregistrement pays/devise')
    }
    setSaving(false)
  }

  const handleResetCurrencyFromCountry = () => {
    const country = availableCountries.find(c => c.country_code === pendingCountryCode)
    if (country?.currency) {
      setPendingCurrency(country.currency)
      toast.success('Devise réinitialisée selon le pays')
    }
  }

  const handleLoadCountryDefaults = async () => {
    const countryName =
      availableCountries.find(c => c.country_code === pendingCountryCode)?.country_name || 'pays sélectionné'

    openConfirm({
      title: 'Charger la configuration du pays',
      message: `Vous allez charger la configuration officielle de ${countryName}. Cette action remplacera les cotisations, tranches fiscales et règles actuelles de l’entreprise.`,
      confirmText: 'Oui, charger',
      type: 'info',
      onConfirm: async () => {
        closeConfirm()
        setSaving(true)
        try {
          const result = await TaxationService.initializeEnterpriseFromCountry(enterpriseId, pendingCountryCode)

          if (result.success) {
            await supabase
              .from('enterprises')
              .update({
                country_code: pendingCountryCode,
                currency: pendingCurrency,
                fiscal_country_label: pendingFiscalCountryLabel || null,
              })
              .eq('id', enterpriseId)

            setCurrentCountryCode(pendingCountryCode)
            setCurrentCurrency(pendingCurrency)
            setCurrentFiscalCountryLabel(pendingFiscalCountryLabel)

            toast.success('Configuration pays chargée avec succès')
            await loadCurrentConfig(enterpriseId)
          } else {
            throw new Error(result.error)
          }
        } catch (err) {
          console.error(err)
          toast.error('Erreur chargement configuration pays')
        }
        setSaving(false)
      },
    })
  }

  const handleStartEmptyConfig = async () => {
    openConfirm({
      title: 'Créer une configuration vide',
      message:
        'Vous allez repartir d’une configuration fiscale vide. Les cotisations et '
        + 'tranches propres à l’entreprise seront supprimées, et elle reprendra les '
        + 'règles et le barème de son pays.',
      confirmText: 'Créer une config vide',
      type: 'danger',
      onConfirm: async () => {
        closeConfirm()
        setSaving(true)
        try {
          await supabase.from('enterprise_payroll_contributions').delete().eq('enterprise_id', enterpriseId)
          await supabase.from('enterprise_tax_brackets').delete().eq('enterprise_id', enterpriseId)

          // ⭐ Des VIDES, pas des zéros. Un zéro ÉCRASE le pays (un abattement
          //    de 0 % à la place des 30 % du Cameroun) ; un vide le laisse
          //    parler. « Configuration vide » veut dire « je reprends les
          //    règles de mon pays », pas « je n'applique aucune règle ».
          const emptyRules = {
            min_taxable_income: null,
            abattement_type: null,
            abattement_percent: null,
            abattement_fixed: null,
            max_abattement: null,
            charges_deductibles: null,
            tax_calculation_method: null,
            custom_rules: null,
          }

          await saveCalculationRules(emptyRules, false)

          setContributions([])
          setTaxBrackets([])
          setCalculationRules(emptyRules)
          toast.success('Configuration vide créée')
        } catch (err) {
          console.error(err)
          toast.error('Erreur création config vide')
        }
        setSaving(false)
      },
    })
  }

  const handleDeleteContribution = async (contrib) => {
    openConfirm({
      title: 'Supprimer cette cotisation ?',
      message: `La cotisation "${contrib.contribution_name || contrib.name}" sera supprimée définitivement.`,
      confirmText: 'Supprimer',
      type: 'danger',
      onConfirm: async () => {
        closeConfirm()
        setSaving(true)
        try {
          const { error } = await supabase
            .from('enterprise_payroll_contributions')
            .delete()
            .eq('id', contrib.id)

          if (error) throw error

          toast.success('Cotisation supprimée')
          await loadCurrentConfig(enterpriseId)
        } catch (err) {
          console.error(err)
          toast.error('Erreur suppression')
        }
        setSaving(false)
      },
    })
  }

  const handleDeleteBracket = async (bracket) => {
    openConfirm({
      title: 'Supprimer cette tranche fiscale ?',
      message: `La tranche "${bracket.bracket_name}" sera supprimée définitivement.`,
      confirmText: 'Supprimer',
      type: 'danger',
      onConfirm: async () => {
        closeConfirm()
        setSaving(true)
        try {
          const { error } = await supabase
            .from('enterprise_tax_brackets')
            .delete()
            .eq('id', bracket.id)

          if (error) throw error

          toast.success('Tranche supprimée')
          await loadCurrentConfig(enterpriseId)
        } catch (err) {
          console.error(err)
          toast.error('Erreur suppression')
        }
        setSaving(false)
      },
    })
  }

  const validateContribution = (contrib) => {
    if (!contrib.contribution_code?.trim()) return 'Le code est obligatoire'
    if (!contrib.contribution_name?.trim()) return 'Le nom est obligatoire'

    if (contrib.calculation_method === 'percentage') {
      const emp = parseFloat(contrib.rate_employee || 0)
      const empl = parseFloat(contrib.rate_employer || 0)
      if (emp < 0 || empl < 0) return 'Les taux doivent être positifs'
      if (contrib.paid_by === 'employee' && emp <= 0) return 'Le taux salarial doit être supérieur à 0'
      if (contrib.paid_by === 'employer' && empl <= 0) return 'Le taux patronal doit être supérieur à 0'
      if (contrib.paid_by === 'both' && emp <= 0 && empl <= 0) return 'Au moins un taux doit être supérieur à 0'
    }

    if (contrib.calculation_method === 'fixed') {
      const fixed = parseFloat(contrib.fixed_amount || 0)
      if (fixed < 0) return 'Le montant fixe doit être positif'
    }

    if (contrib.min_base && contrib.max_base && Number(contrib.min_base) > Number(contrib.max_base)) {
      return 'Le plafond minimum ne peut pas être supérieur au plafond maximum'
    }

    return null
  }

  const handleSaveContribution = async (contrib) => {
    const validationError = validateContribution(contrib)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSaving(true)
    try {
      const dataToSave = {
        enterprise_id: enterpriseId,
        contribution_type: contrib.contribution_type || contrib.type || 'custom',
        contribution_code: contrib.contribution_code || contrib.code,
        contribution_name: contrib.contribution_name || contrib.name,
        paid_by: contrib.paid_by,
        calculation_method: contrib.calculation_method,
        rate_employee: parseFloat(contrib.rate_employee || 0),
        rate_employer: parseFloat(contrib.rate_employer || 0),
        fixed_amount: parseFloat(contrib.fixed_amount || 0),
        calculation_base: contrib.calculation_base || 'gross_salary',
        min_base: contrib.min_base ? parseFloat(contrib.min_base) : null,
        max_base: contrib.max_base ? parseFloat(contrib.max_base) : null,
        is_mandatory: contrib.is_mandatory || false,
        is_active: contrib.is_active !== false,
        display_order: parseInt(contrib.display_order || 0),
        notes: contrib.notes || null,
      }

      const { error } = await supabase
        .from('enterprise_payroll_contributions')
        .upsert(dataToSave, { onConflict: 'enterprise_id,contribution_code' })

      if (error) throw error

      toast.success('Cotisation enregistrée')
      await loadCurrentConfig(enterpriseId)
      setEditingContribution(null)
      setShowAddContribution(false)
    } catch (err) {
      console.error(err)
      toast.error('Erreur sauvegarde cotisation')
    }
    setSaving(false)
  }

  const validateBracket = (bracket) => {
    if (!bracket.bracket_name?.trim()) return 'Le nom de tranche est obligatoire'
    if (bracket.tax_rate === '' || bracket.tax_rate === null || bracket.tax_rate === undefined) {
      return 'Le taux est obligatoire'
    }

    const min = Number(bracket.min_amount || 0)
    const max = bracket.max_amount !== '' && bracket.max_amount !== null ? Number(bracket.max_amount) : null
    const rate = Number(bracket.tax_rate || 0)

    if (min < 0) return 'Le montant minimum doit être positif'
    if (max !== null && max < min) return 'Le montant maximum doit être supérieur ou égal au minimum'
    if (rate < 0) return 'Le taux doit être positif'

    return null
  }

  const handleSaveBracket = async (bracket) => {
    const validationError = validateBracket(bracket)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSaving(true)
    try {
      const dataToSave = {
        enterprise_id: enterpriseId,
        bracket_name: bracket.bracket_name,
        min_amount: parseFloat(bracket.min_amount || 0),
        max_amount: bracket.max_amount ? parseFloat(bracket.max_amount) : null,
        tax_rate: parseFloat(bracket.tax_rate || 0),
        fixed_deduction: parseFloat(bracket.fixed_deduction || 0),
        tax_type: bracket.tax_type || 'irpp',
        bracket_order: parseInt(bracket.bracket_order || 1),
        is_active: bracket.is_active !== false,
      }

      const { error } = await supabase
        .from('enterprise_tax_brackets')
        .upsert(dataToSave, { onConflict: 'enterprise_id,tax_type,bracket_order' })

      if (error) throw error

      toast.success('Tranche fiscale enregistrée')
      await loadCurrentConfig(enterpriseId)
      setEditingBracket(null)
      setShowAddBracket(false)
    } catch (err) {
      console.error(err)
      toast.error('Erreur sauvegarde tranche')
    }
    setSaving(false)
  }

  const saveCalculationRules = async (rules, showToast = true) => {
    try {
      const { data: existing } = await supabase
        .from('payroll_settings')
        .select('id')
        .eq('enterprise_id', enterpriseId)
        .single()

      const payload = {
        enterprise_id: enterpriseId,
        custom_tax_rules: rules,
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        const { error } = await supabase
          .from('payroll_settings')
          .update(payload)
          .eq('enterprise_id', enterpriseId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('payroll_settings')
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })

        if (error) throw error
      }

      setCalculationRules(rules)
      if (showToast) toast.success('Règles de calcul enregistrées')
      return true
    } catch (err) {
      console.error(err)
      if (showToast) toast.error('Erreur sauvegarde règles')
      return false
    }
  }

  const fmt = (amount) => TaxationService.formatMoney(amount, pendingCurrency || currentCurrency)

  const selectedCountryName =
    availableCountries.find(c => c.country_code === pendingCountryCode)?.country_name || 'Pays fiscal'

  const displayedFiscalCountryLabel =
    pendingFiscalCountryLabel?.trim() || selectedCountryName

  const simulationExplanation = useMemo(() => {
    try {
      const gross = Number(simulationGross || 0)
      const social = TaxationService.calculateSocialContributions(gross, contributions || [])
      const taxable = TaxationService.calculateTaxableIncome(gross, social, calculationRules || {})

      // ⭐ les parts se lisent sur la SITUATION DE FAMILLE simulée
      const parts = TaxationService.getFiscalParts(
        { marital_status: simulationSituation, dependents_count: simulationEnfants },
        calculationRules || {},
      )

      const tax = TaxationService.calculateIncomeTax(taxable, taxBrackets || [], calculationRules || {}, parts)
      const net = gross - (social.totalEmployee || 0) - (tax.totalTax || 0)

      // 🛡️ LE DRAPEAU : ce net est-il digne de confiance ?
      const impotAVerifier =
        TaxationService.impotEstAVerifier(calculationRules) || tax.impot_a_verifier === true

      return {
        gross,
        social,
        taxable,
        tax,
        parts,
        // ⚠️ 1 part faute de situation renseignée n'est pas 1 part choisie
        parts_non_renseignees:
          calculationRules?.situation_famille?.type === 'parts' && !simulationSituation,
        net: Math.round(net),
        impot_a_verifier: impotAVerifier,
        avertissement: impotAVerifier
          ? (TaxationService.avertissementImpot(calculationRules, selectedCountryName)
             || TaxationService.avertissementSansTranche())
          : null,
      }
    } catch {
      return null
    }
  }, [simulationGross, contributions, taxBrackets, calculationRules, simulationSituation, simulationEnfants])

  if (loading) {
    return (
      <div style={S.loadingWrap}>
        <RefreshCw size={34} color="#F59E0B" style={{ animation: 'spin 0.9s linear infinite' }} />
        <p style={{ color: '#999', marginTop: 12 }}>Chargement configuration fiscale...</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fiscal-card { animation: fadeInUp 0.3s ease forwards; }
        .fiscal-btn:hover { transform: translateY(-1px); }

        html, body, #root {
          background: #0A0A0F !important;
        }

        select, input, textarea {
          background: rgba(255,255,255,0.04) !important;
          color: #FFF !important;
        }

        select option {
          background: #141423 !important;
          color: #E5E5E5 !important;
        }

        input::placeholder, textarea::placeholder {
          color: #666 !important;
        }

        @media (max-width: 768px) {
          .fiscal-grid-2 { grid-template-columns: 1fr !important; }
          .fiscal-form-row { grid-template-columns: 1fr !important; }
          .fiscal-sim-grid { grid-template-columns: 1fr !important; }
        }

        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: rgba(245,158,11,0.3); border-radius: 4px; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0A0A0F', width: '100%' }}>
        <div style={S.container}>
          <header style={S.header}>
            <div style={S.headerLeft}>
              <button onClick={() => navigate('/fiches-paie')} style={S.backBtn}>
                <ArrowLeft size={18} />
              </button>
              <div style={S.logoBox}>
                <Settings size={22} color="#F59E0B" />
              </div>
              <div>
                <h1 style={S.title}>CONFIGURATION FISCALE</h1>
                <p style={S.subtitle}>{enterpriseName}</p>
              </div>
            </div>

            <div style={S.headerRight}>
              <button onClick={handleStartEmptyConfig} style={S.secondaryBtn} className="fiscal-btn" disabled={saving}>
                <Sparkles size={16} />
                <span>Config vide</span>
              </button>
              <button onClick={handleLoadCountryDefaults} style={S.loadCountryBtn} className="fiscal-btn" disabled={saving}>
                {saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Download size={16} />}
                <span>Charger config pays</span>
              </button>
            </div>
          </header>

          <div style={S.infoBar}>
            <Info size={16} color="#F59E0B" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={S.infoTitle}>À quoi sert cette page ?</p>
              <p style={S.infoText}>
                Cette page permet de définir les <strong>cotisations sociales</strong>, le <strong>barème fiscal</strong> et les
                <strong> règles de calcul</strong> utilisées dans les fiches de paie.  
                Les montants saisis ici seront exploités dans le calcul du <strong>revenu imposable</strong>, de l’
                <strong>impôt</strong>, des <strong>retenues sociales</strong> et du <strong>net à payer</strong>.
              </p>
            </div>
          </div>

          <div style={S.explainGrid} className="fiscal-grid-2">
            <div style={S.explainCard}>
              <div style={S.explainHeader}>
                <Shield size={16} color="#10B981" />
                <span style={S.explainTitle}>Cotisations sociales</span>
              </div>
              <p style={S.explainText}>
                Ce sont les retenues ou charges calculées sur le salaire brut.  
                Elles peuvent être payées par le salarié, l’employeur, ou les deux.
              </p>
              <ul style={S.explainList}>
                <li>Part salariale = retenue sur le bulletin</li>
                <li>Part patronale = charge entreprise</li>
                <li>Base de calcul = généralement le salaire brut</li>
              </ul>
            </div>

            <div style={S.explainCard}>
              <div style={S.explainHeader}>
                <Percent size={16} color="#6366F1" />
                <span style={S.explainTitle}>Barème fiscal</span>
              </div>
              <p style={S.explainText}>
                Il s’agit des tranches d’imposition appliquées au revenu imposable.  
                Chaque tranche définit un seuil et un taux.
              </p>
              <ul style={S.explainList}>
                <li>Tranche 1 : revenu de X à Y</li>
                <li>Tranche 2 : revenu de Y à Z</li>
                <li>Le calcul est progressif</li>
              </ul>
            </div>
          </div>

          <div style={S.explainWide}>
            <div style={S.explainHeader}>
              <BadgeHelp size={16} color="#F59E0B" />
              <span style={S.explainTitle}>Comment se fait le calcul ?</span>
            </div>
            <p style={S.explainText}>
              <strong>1.</strong> On part du salaire brut.  
              <strong> 2.</strong> On calcule les cotisations sociales.  
              <strong> 3.</strong> On applique les charges déductibles et abattements pour obtenir le revenu imposable.  
              <strong> 4.</strong> On applique le barème fiscal.  
              <strong> 5.</strong> On obtient le net à payer.
            </p>
          </div>

          <div className="fiscal-grid-2" style={S.countryBar}>
            <div style={S.countryGroup}>
              <FormLabel
                help="Pays utilisé comme base de référence pour charger un modèle fiscal"
                example="Ex: Sénégal, Cameroun, Côte d’Ivoire"
              >
                <Globe size={14} /> Pays fiscal de référence
              </FormLabel>
              <select
                value={pendingCountryCode}
                onChange={(e) => {
                  const code = e.target.value
                  setPendingCountryCode(code)

                  // Alignement automatique pays → devise. L'ancienne condition
                  // (pendingCurrency === currentCurrency) laissait passer des
                  // couples incohérents du type « Cameroun + XOF ».
                  const devise = CurrencyService.suggestForCountry(code)
                    || availableCountries.find(c => c.country_code === code)?.currency
                    || null
                  if (devise) setPendingCurrency(devise)
                }}
                style={S.select}
              >
                {availableCountries.map(c => (
                  <option key={c.country_code} value={c.country_code}>
                    {c.country_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={S.countryGroup}>
              <FormLabel
                help="Nom affiché du pays fiscal dans l’interface. Cela ne change pas le code pays utilisé par le moteur."
                example={`Ex: ${selectedCountryName} - régime local`}
              >
                <FileText size={14} /> Libellé affiché du pays fiscal
              </FormLabel>
              <input
                value={pendingFiscalCountryLabel}
                onChange={(e) => setPendingFiscalCountryLabel(e.target.value)}
                style={S.input}
                placeholder={`Ex: ${selectedCountryName}`}
              />
            </div>

            <div style={S.countryGroup}>
              <FormLabel
                help="Devise utilisée pour l’affichage des montants et le calcul des bulletins"
                example="Ex: XAF, XOF, EUR, USD"
              >
                <Landmark size={14} /> Devise de paie
              </FormLabel>
              <input
                value={pendingCurrency}
                onChange={(e) => setPendingCurrency(e.target.value.toUpperCase())}
                style={S.input}
                placeholder="Ex: XAF, XOF, EUR, USD"
              />
            </div>
          </div>

          <div style={S.noteBox}>
            <Info size={14} color="#6366F1" />
            <span style={{ color: '#888', fontSize: 12 }}>
              Le <strong>code pays</strong> est utilisé pour la logique fiscale et les modèles par défaut.
              Le <strong>libellé affiché</strong> sert uniquement à personnaliser le texte visible dans l’interface.
              Libellé actuel : <strong>{displayedFiscalCountryLabel}</strong>
            </span>
          </div>

          <div style={S.topActionRow}>
            <button onClick={handleResetCurrencyFromCountry} style={S.secondaryBtn}>
              <RefreshCw size={14} />
              <span>Réinitialiser la devise depuis le pays</span>
            </button>

            <button onClick={handleApplyCountryAndCurrency} style={S.saveBtn} disabled={saving}>
              {saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}
              <span>Enregistrer pays, libellé & devise</span>
            </button>
          </div>

          <div style={S.tabs}>
            {[
              { key: 'contributions', icon: Shield, label: 'Cotisations Sociales', count: contributions.length },
              { key: 'taxes', icon: Percent, label: 'Barème Fiscal', count: taxBrackets.length },
              { key: 'rules', icon: SlidersHorizontal, label: 'Règles de Calcul' },
              { key: 'preview', icon: Eye, label: 'Aperçu Simulation' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{ ...S.tabBtn, ...(activeTab === tab.key ? S.tabBtnActive : {}) }}
              >
                <tab.icon size={15} />
                <span>{tab.label}</span>
                {tab.count !== undefined && <span style={S.tabBadge}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {activeTab === 'contributions' && (
            <div style={S.card} className="fiscal-card">
              <div style={S.cardHeader}>
                <div style={S.cardHeaderLeft}>
                  <div style={{ ...S.cardIcon, background: 'rgba(16,185,129,0.12)' }}>
                    <Shield size={18} color="#10B981" />
                  </div>
                  <div>
                    <h3 style={S.cardTitle}>Cotisations Sociales</h3>
                    <p style={S.cardSub}>
                      Contributions sociales, taxes liées à la paie, mutuelles, fonds, caisses, prélèvements entreprise/salarié
                    </p>
                  </div>
                </div>

                <button onClick={() => setShowAddContribution(true)} style={S.addBtn}>
                  <Plus size={16} />
                  <span>Ajouter une cotisation</span>
                </button>
              </div>

              <div style={S.noteBox}>
                <Info size={14} color="#10B981" />
                <span style={{ color: '#888', fontSize: 12 }}>
                  Une cotisation peut être calculée en pourcentage du brut ou en montant fixe.  
                  La part salariale est déduite du bulletin. La part patronale impacte le coût employeur.
                </span>
              </div>

              {contributions.length === 0 ? (
                <div style={S.emptyState}>
                  <AlertTriangle size={24} color="#666" />
                  <p style={{ color: '#888', margin: '8px 0 0 0' }}>Aucune cotisation configurée</p>
                  <p style={{ color: '#555', fontSize: 12, margin: '4px 0 0 0' }}>
                    Chargez un modèle pays ou ajoutez vos propres cotisations
                  </p>
                </div>
              ) : (
                <div style={S.contribList}>
                  {contributions.map((contrib, i) => (
                    <ContributionCard
                      key={contrib.id || i}
                      contrib={contrib}
                      currency={pendingCurrency}
                      onEdit={() => setEditingContribution(contrib)}
                      onDelete={() => handleDeleteContribution(contrib)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'taxes' && (
            <div style={S.card} className="fiscal-card">
              <div style={S.cardHeader}>
                <div style={S.cardHeaderLeft}>
                  <div style={{ ...S.cardIcon, background: 'rgba(99,102,241,0.12)' }}>
                    <Percent size={18} color="#6366F1" />
                  </div>
                  <div>
                    <h3 style={S.cardTitle}>Barème d’Imposition</h3>
                    <p style={S.cardSub}>Tranches progressives de l’impôt appliquées au revenu imposable</p>
                  </div>
                </div>

                <button onClick={() => setShowAddBracket(true)} style={S.addBtn}>
                  <Plus size={16} />
                  <span>Ajouter une tranche</span>
                </button>
              </div>

              <div style={S.noteBox}>
                <Info size={14} color="#6366F1" />
                <span style={{ color: '#888', fontSize: 12 }}>
                  Les tranches doivent être cohérentes : pas de chevauchement, pas de vide logique, et un ordre correct.
                  Le calcul fiscal actuel du moteur est <strong>progressif</strong>.
                </span>
              </div>

              {taxBrackets.length === 0 ? (
                <div style={S.emptyState}>
                  <AlertTriangle size={24} color="#666" />
                  <p style={{ color: '#888', margin: '8px 0 0 0' }}>Aucune tranche fiscale configurée</p>
                </div>
              ) : (
                <div style={S.bracketList}>
                  {taxBrackets.map((bracket, i) => (
                    <BracketCard
                      key={bracket.id || i}
                      bracket={bracket}
                      currency={pendingCurrency}
                      onEdit={() => setEditingBracket(bracket)}
                      onDelete={() => handleDeleteBracket(bracket)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rules' && (
            <div style={S.card} className="fiscal-card">
              <div style={S.cardHeader}>
                <div style={S.cardHeaderLeft}>
                  <div style={{ ...S.cardIcon, background: 'rgba(245,158,11,0.12)' }}>
                    <SlidersHorizontal size={18} color="#F59E0B" />
                  </div>
                  <div>
                    <h3 style={S.cardTitle}>Règles de Calcul</h3>
                    <p style={S.cardSub}>Abattements, seuils, charges déductibles et règles métier complémentaires</p>
                  </div>
                </div>

                <button onClick={() => setShowRulesModal(true)} style={S.addBtn}>
                  <Edit size={16} />
                  <span>Modifier les règles</span>
                </button>
              </div>

              <div style={S.noteBox}>
                <Info size={14} color="#F59E0B" />
                <span style={{ color: '#888', fontSize: 12 }}>
                  Les règles de calcul permettent de définir comment on passe du <strong>brut</strong> au
                  <strong> revenu imposable</strong> avant application de l’impôt.
                </span>
              </div>

              <div className="fiscal-grid-2" style={S.rulesGrid}>
                <div style={S.ruleItem}>
                  <span style={S.ruleLabel}>Type d’abattement</span>
                  <span style={S.ruleValue}>{calculationRules.abattement_type || 'none'}</span>
                </div>

                <div style={S.ruleItem}>
                  <span style={S.ruleLabel}>Abattement (%)</span>
                  <span style={S.ruleValue}>{calculationRules.abattement_percent || 0}%</span>
                </div>

                <div style={S.ruleItem}>
                  <span style={S.ruleLabel}>Abattement fixe</span>
                  <span style={S.ruleValue}>
                    {calculationRules.abattement_fixed ? fmt(calculationRules.abattement_fixed) : '0'}
                  </span>
                </div>

                <div style={S.ruleItem}>
                  <span style={S.ruleLabel}>Plafond abattement</span>
                  <span style={S.ruleValue}>
                    {calculationRules.max_abattement ? fmt(calculationRules.max_abattement) : 'Aucun'}
                  </span>
                </div>

                <div style={S.ruleItem}>
                  <span style={S.ruleLabel}>Seuil minimum imposable</span>
                  <span style={S.ruleValue}>
                    {calculationRules.min_taxable_income ? fmt(calculationRules.min_taxable_income) : '0'}
                  </span>
                </div>

                <div style={S.ruleItem}>
                  <span style={S.ruleLabel}>Méthode de calcul</span>
                  <span style={S.ruleValue}>{calculationRules.tax_calculation_method || 'progressive'}</span>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <p style={S.customRuleTitle}>Charges déductibles</p>
                <div style={S.noteBox}>
                  <Info size={14} color="#6366F1" />
                  <span style={{ color: '#888', fontSize: 12 }}>
                    Les charges déductibles sont retirées du brut avant le calcul de l’impôt.
                  </span>
                </div>

                <div style={{ marginTop: 12 }}>
                  <span style={S.ruleValue}>
                    {calculationRules.charges_deductibles?.length
                      ? calculationRules.charges_deductibles.join(', ')
                      : 'Aucune'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <p style={S.customRuleTitle}>Règles personnalisées</p>

                {!calculationRules.custom_rules || calculationRules.custom_rules.length === 0 ? (
                  <div style={S.noteBox}>
                    <Info size={14} color="#6366F1" />
                    <span style={{ color: '#888', fontSize: 12 }}>
                      Aucune règle personnalisée définie. Les clés réellement exploitées par le moteur doivent être documentées et cohérentes.
                    </span>
                  </div>
                ) : (
                  <div style={S.customRuleList}>
                    {calculationRules.custom_rules.map((rule, idx) => (
                      <div key={idx} style={S.customRuleItem}>
                        <div>
                          <div style={S.customRuleName}>{rule.key}</div>
                          <div style={S.customRuleDesc}>{rule.description || 'Sans description'}</div>
                        </div>
                        <div style={S.customRuleValue}>{String(rule.value)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div style={S.card} className="fiscal-card">
              <div style={S.cardHeader}>
                <div style={S.cardHeaderLeft}>
                  <div style={{ ...S.cardIcon, background: 'rgba(245,158,11,0.12)' }}>
                    <Calculator size={18} color="#F59E0B" />
                  </div>
                  <div>
                    <h3 style={S.cardTitle}>Aperçu de simulation</h3>
                    <p style={S.cardSub}>Visualisez l’impact des cotisations et de l’impôt sur un salaire brut test</p>
                  </div>
                </div>
              </div>

              <div className="fiscal-form-row" style={S.formRow}>
                <div style={S.formGroup}>
                  <FormLabel
                    help="Montant brut utilisé pour tester les calculs de cotisations et d’impôt"
                    example={`Ex: 250000 ${pendingCurrency}`}
                  >
                    Salaire brut test ({pendingCurrency})
                  </FormLabel>
                  <input
                    type="number"
                    value={simulationGross}
                    onChange={e => setSimulationGross(e.target.value)}
                    style={S.input}
                    placeholder="Ex: 250000"
                  />
                </div>

                {/* ⭐ N'apparaît QUE si le pays applique un quotient familial */}
                {calculationRules?.situation_famille?.type === 'parts' && (
                  <>
                    <div style={S.formGroup}>
                      <FormLabel
                        help="Le barème de ce pays s'applique au revenu divisé par un nombre de parts, puis l'impôt est remultiplié par ce nombre. Plus il y a de parts, plus l'impôt baisse."
                      >
                        Situation (test)
                      </FormLabel>
                      <select
                        value={simulationSituation}
                        onChange={e => setSimulationSituation(e.target.value)}
                        style={S.input}
                      >
                        <option value="">Non précisée (1 part)</option>
                        <option value="celibataire">Célibataire</option>
                        <option value="marie">Marié(e)</option>
                        <option value="divorce">Divorcé(e)</option>
                        <option value="veuf">Veuf/Veuve</option>
                        <option value="union_libre">Union libre</option>
                      </select>
                    </div>
                    <div style={S.formGroup}>
                      <FormLabel help="Enfants à charge — chaque enfant ajoute des parts">
                        Enfants à charge (test)
                      </FormLabel>
                      <input
                        type="number"
                        min="0"
                        value={simulationEnfants}
                        onChange={e => setSimulationEnfants(parseInt(e.target.value) || 0)}
                        style={S.input}
                        placeholder="0"
                      />
                    </div>
                  </>
                )}
              </div>

              {calculationRules?.situation_famille?.type === 'parts' && simulationExplanation && (
                <div style={{ ...S.noteBox, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, lineHeight: 1.5 }}>
                    ⭐ Parts retenues pour ce test : <strong>{simulationExplanation.parts}</strong>
                    {simulationExplanation.parts_non_renseignees && (
                      <> — ⚠️ 1 part <em>faute de situation renseignée</em>, pas 1 part choisie.
                      Le même salarié marié avec 2 enfants aurait {`des parts en plus`}.</>
                    )}
                  </span>
                </div>
              )}

              {simulationExplanation && (
                <>
                  {simulationExplanation.impot_a_verifier && (
                    <div
                      style={{
                        ...S.noteBox,
                        background: 'rgba(239,68,68,0.10)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        marginBottom: 14,
                        alignItems: 'flex-start',
                      }}
                    >
                      <AlertTriangle size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ color: '#FCA5A5', fontSize: 12, lineHeight: 1.5 }}>
                        {simulationExplanation.avertissement}
                      </span>
                    </div>
                  )}

                  <div className="fiscal-sim-grid" style={S.simGrid}>
                    <div style={S.simCard}>
                      <span style={S.simLabel}>Salaire brut</span>
                      <span style={S.simValue}>{fmt(simulationExplanation.gross)}</span>
                    </div>

                    <div style={S.simCard}>
                      <span style={S.simLabel}>Cotisations salariales</span>
                      <span style={{ ...S.simValue, color: '#EF4444' }}>
                        - {fmt(simulationExplanation.social.totalEmployee || 0)}
                      </span>
                    </div>

                    <div style={S.simCard}>
                      <span style={S.simLabel}>Revenu imposable</span>
                      <span style={S.simValue}>{fmt(simulationExplanation.taxable || 0)}</span>
                    </div>

                    <div style={S.simCard}>
                      <span style={S.simLabel}>Impôt total</span>
                      <span style={{ ...S.simValue, color: '#EF4444' }}>
                        - {fmt(simulationExplanation.tax.totalTax || 0)}
                      </span>
                    </div>

                    <div style={S.simCard}>
                      <span style={S.simLabel}>
                        Net {simulationExplanation.impot_a_verifier ? 'PROVISOIRE ⚠️' : 'estimé'}
                      </span>
                      <span
                        style={{
                          ...S.simValue,
                          color: simulationExplanation.impot_a_verifier ? '#F59E0B' : '#10B981',
                        }}
                      >
                        {fmt(simulationExplanation.net || 0)}
                      </span>
                    </div>

                    <div style={S.simCard}>
                      <span style={S.simLabel}>Cotisations patronales</span>
                      <span style={S.simValue}>{fmt(simulationExplanation.social.totalEmployer || 0)}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <p style={S.customRuleTitle}>Détail des cotisations salariales</p>
                    {simulationExplanation.social.employee?.length ? (
                      <div style={S.customRuleList}>
                        {simulationExplanation.social.employee.map((item, idx) => (
                          <div key={idx} style={S.customRuleItem}>
                            <div>
                              <div style={S.customRuleName}>{item.name}</div>
                              <div style={S.customRuleDesc}>
                                Base: {fmt(item.base)} • Taux: {item.rate || 0}%
                              </div>
                            </div>
                            <div style={S.customRuleValue}>{fmt(item.amount)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={S.noteBox}>
                        <Info size={14} color="#6366F1" />
                        <span style={{ color: '#888', fontSize: 12 }}>Aucune cotisation salariale appliquée sur ce test.</span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <p style={S.customRuleTitle}>Détail des tranches fiscales appliquées</p>
                    {simulationExplanation.tax.details?.length ? (
                      <div style={S.customRuleList}>
                        {simulationExplanation.tax.details.map((item, idx) => (
                          <div key={idx} style={S.customRuleItem}>
                            <div>
                              <div style={S.customRuleName}>{item.bracket}</div>
                              <div style={S.customRuleDesc}>
                                {fmt(item.min)} → {item.max ? fmt(item.max) : '∞'} • Taux: {item.rate}%
                              </div>
                            </div>
                            <div style={S.customRuleValue}>{fmt(item.tax)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={S.noteBox}>
                        <Info size={14} color="#6366F1" />
                        <span style={{ color: '#888', fontSize: 12 }}>Aucune tranche fiscale appliquée sur ce test.</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {(showAddContribution || editingContribution) && (
            <ContributionModal
              contribution={editingContribution}
              currency={pendingCurrency}
              onSave={handleSaveContribution}
              onClose={() => {
                setShowAddContribution(false)
                setEditingContribution(null)
              }}
              saving={saving}
            />
          )}

          {(showAddBracket || editingBracket) && (
            <BracketModal
              bracket={editingBracket}
              currency={pendingCurrency}
              nextOrder={(taxBrackets[taxBrackets.length - 1]?.bracket_order || 0) + 1}
              onSave={handleSaveBracket}
              onClose={() => {
                setShowAddBracket(false)
                setEditingBracket(null)
              }}
              saving={saving}
            />
          )}

          {showRulesModal && (
            <RulesModal
              rules={calculationRules}
              contributions={contributions}
              currency={pendingCurrency}
              onClose={() => setShowRulesModal(false)}
              onSave={async (rules) => {
                const ok = await saveCalculationRules(rules, true)
                if (ok) setShowRulesModal(false)
              }}
              saving={saving}
            />
          )}

          {confirmModal.open && (
            <ConfirmModal
              title={confirmModal.title}
              message={confirmModal.message}
              confirmText={confirmModal.confirmText}
              type={confirmModal.type}
              onCancel={closeConfirm}
              onConfirm={confirmModal.onConfirm}
            />
          )}
        </div>
      </div>
    </>
  )
}

function ContributionCard({ contrib, currency, onEdit, onDelete }) {
  const isPaidByEmployee = contrib.paid_by === 'employee' || contrib.paid_by === 'both'
  const isPaidByEmployer = contrib.paid_by === 'employer' || contrib.paid_by === 'both'

  return (
    <div style={S.contribCard}>
      <div style={S.contribHeader}>
        <div>
          <h4 style={S.contribName}>{contrib.contribution_name || contrib.name}</h4>
          <p style={S.contribCode}>{contrib.contribution_code || contrib.code}</p>
        </div>

        {contrib.is_mandatory && (
          <span style={S.mandatoryBadge}>
            <CheckCircle size={12} /> Obligatoire
          </span>
        )}
      </div>

      <div style={S.contribBody}>
        <div style={S.contribRow}>
          <span style={S.contribLabel}>Méthode</span>
          <span style={S.contribAmount}>
            {contrib.calculation_method === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
          </span>
        </div>

        {isPaidByEmployee && (
          <div style={S.contribRow}>
            <span style={S.contribLabel}>Part salariale</span>
            <span style={S.contribAmount}>
              {contrib.calculation_method === 'percentage'
                ? `${contrib.rate_employee || 0}%`
                : TaxationService.formatMoney(contrib.fixed_amount || 0, currency)}
            </span>
          </div>
        )}

        {isPaidByEmployer && (
          <div style={S.contribRow}>
            <span style={S.contribLabel}>Part patronale</span>
            <span style={S.contribAmount}>
              {contrib.calculation_method === 'percentage'
                ? `${contrib.rate_employer || 0}%`
                : (contrib.paid_by === 'employer'
                    ? TaxationService.formatMoney(contrib.fixed_amount || 0, currency)
                    : '—')}
            </span>
          </div>
        )}

        {contrib.max_base && (
          <div style={S.contribRow}>
            <span style={S.contribLabel}>Plafond max</span>
            <span style={S.contribAmount}>{TaxationService.formatMoney(contrib.max_base, currency)}</span>
          </div>
        )}
      </div>

      <div style={S.contribActions}>
        <button onClick={onEdit} style={S.editBtn}>
          <Edit size={14} /> Modifier
        </button>
        <button onClick={onDelete} style={S.deleteBtn}>
          <Trash2 size={14} /> Supprimer
        </button>
      </div>
    </div>
  )
}

function BracketCard({ bracket, currency, onEdit, onDelete }) {
  return (
    <div style={S.bracketCard}>
      <div style={S.bracketHeader}>
        <span style={S.bracketOrder}>{bracket.bracket_order}</span>
        <h4 style={S.bracketName}>{bracket.bracket_name}</h4>
      </div>

      <div style={S.bracketBody}>
        <div style={S.bracketRow}>
          <span style={S.bracketLabel}>Tranche</span>
          <span style={S.bracketValue}>
            {TaxationService.formatMoney(bracket.min_amount, currency)}
            {' → '}
            {bracket.max_amount ? TaxationService.formatMoney(bracket.max_amount, currency) : '∞'}
          </span>
        </div>

        <div style={S.bracketRow}>
          <span style={S.bracketLabel}>Taux</span>
          <span style={{ ...S.bracketValue, color: '#F59E0B' }}>{bracket.tax_rate}%</span>
        </div>

        {bracket.fixed_deduction > 0 && (
          <div style={S.bracketRow}>
            <span style={S.bracketLabel}>Déduction fixe</span>
            <span style={S.bracketValue}>
              {TaxationService.formatMoney(bracket.fixed_deduction, currency)}
            </span>
          </div>
        )}
      </div>

      <div style={S.contribActions}>
        <button onClick={onEdit} style={S.editBtn}>
          <Edit size={14} /> Modifier
        </button>
        <button onClick={onDelete} style={S.deleteBtn}>
          <Trash2 size={14} /> Supprimer
        </button>
      </div>
    </div>
  )
}

function ContributionModal({ contribution, currency, onSave, onClose, saving }) {
  const [form, setForm] = useState(contribution || {
    contribution_code: '',
    contribution_name: '',
    contribution_type: 'social_security',
    paid_by: 'employee',
    calculation_method: 'percentage',
    rate_employee: '',
    rate_employer: '',
    fixed_amount: '',
    calculation_base: 'gross_salary',
    min_base: '',
    max_base: '',
    is_mandatory: false,
    display_order: 0,
    notes: '',
  })

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalContent} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>
            {contribution ? 'Modifier la cotisation' : 'Nouvelle cotisation'}
          </h2>
          <button onClick={onClose} style={S.modalCloseBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={S.modalBody}>
          <div style={S.noteBox}>
            <Info size={14} color="#10B981" />
            <span style={{ color: '#888', fontSize: 12 }}>
              Le code doit être unique. La méthode peut être un pourcentage du brut ou un montant fixe.
            </span>
          </div>

          <div style={S.formGroup}>
            <FormLabel
              required
              help="Code technique unique utilisé par le moteur pour identifier cette cotisation"
              example="Ex: social_employee"
            >
              Code unique
            </FormLabel>
            <input
              value={form.contribution_code}
              onChange={e => setForm({ ...form, contribution_code: e.target.value })}
              style={S.input}
              placeholder="Ex: social_employee"
            />
          </div>

          <div style={S.formGroup}>
            <FormLabel
              required
              help="Nom affiché dans l’interface et dans le détail des retenues"
              example="Ex: Cotisation sociale salariale"
            >
              Nom
            </FormLabel>
            <input
              value={form.contribution_name}
              onChange={e => setForm({ ...form, contribution_name: e.target.value })}
              style={S.input}
              placeholder="Ex: Cotisation sociale salariale"
            />
          </div>

          <div className="fiscal-form-row" style={S.formRow}>
            <div style={S.formGroup}>
              <FormLabel
                help="Catégorie métier de la cotisation"
                example="Ex: Sécurité sociale, taxe, mutuelle"
              >
                Type
              </FormLabel>
              <select
                value={form.contribution_type}
                onChange={e => setForm({ ...form, contribution_type: e.target.value })}
                style={S.select}
              >
                <option value="social_security">Sécurité sociale</option>
                <option value="tax">Taxe</option>
                <option value="employment_fund">Fonds emploi</option>
                <option value="mutual">Mutuelle</option>
                <option value="custom">Personnalisée</option>
              </select>
            </div>

            <div style={S.formGroup}>
              <FormLabel
                help="Détermine qui supporte financièrement la cotisation"
                example="Employé = retenue / Employeur = charge / Les deux = partage"
              >
                Payée par
              </FormLabel>
              <select
                value={form.paid_by}
                onChange={e => setForm({ ...form, paid_by: e.target.value })}
                style={S.select}
              >
                <option value="employee">Employé</option>
                <option value="employer">Employeur</option>
                <option value="both">Les deux</option>
              </select>
            </div>
          </div>

          <div style={S.formGroup}>
            <FormLabel
              help="Définit si la cotisation se calcule en pourcentage du brut ou par montant fixe"
              example="Ex: 4.2% du brut ou 1000 XAF fixe"
            >
              Méthode de calcul
            </FormLabel>
            <select
              value={form.calculation_method}
              onChange={e => setForm({ ...form, calculation_method: e.target.value })}
              style={S.select}
            >
              <option value="percentage">Pourcentage</option>
              <option value="fixed">Montant fixe</option>
            </select>
          </div>

          {form.calculation_method === 'percentage' && (
            <div className="fiscal-form-row" style={S.formRow}>
              <div style={S.formGroup}>
                <FormLabel
                  help="Taux appliqué au salarié"
                  example="Ex: 4.2 pour 4,2%"
                >
                  Taux salarial (%)
                </FormLabel>
                <input
                  type="number"
                  step="0.1"
                  value={form.rate_employee}
                  onChange={e => setForm({ ...form, rate_employee: e.target.value })}
                  style={S.input}
                  placeholder="Ex: 4.2"
                />
              </div>

              <div style={S.formGroup}>
                <FormLabel
                  help="Taux appliqué à l’employeur"
                  example="Ex: 8.4 pour 8,4%"
                >
                  Taux patronal (%)
                </FormLabel>
                <input
                  type="number"
                  step="0.1"
                  value={form.rate_employer}
                  onChange={e => setForm({ ...form, rate_employer: e.target.value })}
                  style={S.input}
                  placeholder="Ex: 8.4"
                />
              </div>
            </div>
          )}

          {form.calculation_method === 'fixed' && (
            <div style={S.formGroup}>
              <FormLabel
                help="Montant fixe prélevé ou payé, indépendamment du brut"
                example={`Ex: 1000 ${currency}`}
              >
                Montant fixe ({currency})
              </FormLabel>
              <input
                type="number"
                value={form.fixed_amount}
                onChange={e => setForm({ ...form, fixed_amount: e.target.value })}
                style={S.input}
                placeholder="Ex: 1000"
              />
            </div>
          )}

          <div className="fiscal-form-row" style={S.formRow}>
            <div style={S.formGroup}>
              <FormLabel
                help="Montant minimum de base retenu si le salaire brut est trop bas"
                example={`Ex: 50000 ${currency}`}
              >
                Plafond min ({currency})
              </FormLabel>
              <input
                type="number"
                value={form.min_base}
                onChange={e => setForm({ ...form, min_base: e.target.value })}
                style={S.input}
                placeholder="Optionnel"
              />
            </div>

            <div style={S.formGroup}>
              <FormLabel
                help="Montant maximum de base pris en compte pour calculer la cotisation"
                example={`Ex: 750000 ${currency}`}
              >
                Plafond max ({currency})
              </FormLabel>
              <input
                type="number"
                value={form.max_base}
                onChange={e => setForm({ ...form, max_base: e.target.value })}
                style={S.input}
                placeholder="Ex: 750000"
              />
            </div>
          </div>

          <label style={S.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.is_mandatory}
              onChange={e => setForm({ ...form, is_mandatory: e.target.checked })}
            />
            <span>Cotisation obligatoire</span>
          </label>
        </div>

        <div style={S.modalFooter}>
          <button onClick={onClose} style={S.cancelBtn}>Annuler</button>
          <button
            onClick={() => onSave(form)}
            style={S.saveBtn}
            disabled={saving || !form.contribution_code || !form.contribution_name}
          >
            {saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}
            <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function BracketModal({ bracket, currency, nextOrder, onSave, onClose, saving }) {
  const [form, setForm] = useState(bracket || {
    bracket_name: '',
    min_amount: '',
    max_amount: '',
    tax_rate: '',
    fixed_deduction: '',
    bracket_order: nextOrder,
  })

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalContent} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>
            {bracket ? 'Modifier la tranche' : 'Nouvelle tranche fiscale'}
          </h2>
          <button onClick={onClose} style={S.modalCloseBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={S.modalBody}>
          <div style={S.noteBox}>
            <Info size={14} color="#6366F1" />
            <span style={{ color: '#888', fontSize: 12 }}>
              Une tranche définit une plage de revenu imposable et le taux appliqué sur cette plage.
            </span>
          </div>

          <div style={S.formGroup}>
            <FormLabel
              required
              help="Nom lisible de la tranche"
              example="Ex: Tranche 1"
            >
              Nom de la tranche
            </FormLabel>
            <input
              value={form.bracket_name}
              onChange={e => setForm({ ...form, bracket_name: e.target.value })}
              style={S.input}
              placeholder="Ex: Tranche 1"
            />
          </div>

          <div className="fiscal-form-row" style={S.formRow}>
            <div style={S.formGroup}>
              <FormLabel
                required
                help="Montant à partir duquel cette tranche commence"
                example={`Ex: 0 ${currency}`}
              >
                Montant min ({currency})
              </FormLabel>
              <input
                type="number"
                value={form.min_amount}
                onChange={e => setForm({ ...form, min_amount: e.target.value })}
                style={S.input}
                placeholder="Ex: 0"
              />
            </div>

            <div style={S.formGroup}>
              <FormLabel
                help="Montant de fin de la tranche. Laisser vide si cette tranche est illimitée"
                example={`Ex: 300000 ${currency}`}
              >
                Montant max ({currency})
              </FormLabel>
              <input
                type="number"
                value={form.max_amount}
                onChange={e => setForm({ ...form, max_amount: e.target.value })}
                style={S.input}
                placeholder="Laisser vide si illimité"
              />
            </div>
          </div>

          <div className="fiscal-form-row" style={S.formRow}>
            <div style={S.formGroup}>
              <FormLabel
                required
                help="Taux appliqué sur la part du revenu qui tombe dans cette tranche"
                example="Ex: 10 pour 10%"
              >
                Taux (%)
              </FormLabel>
              <input
                type="number"
                step="0.1"
                value={form.tax_rate}
                onChange={e => setForm({ ...form, tax_rate: e.target.value })}
                style={S.input}
                placeholder="Ex: 10"
              />
            </div>

            <div style={S.formGroup}>
              <FormLabel
                help="Réduction fixe éventuellement appliquée sur la tranche"
                example={`Ex: 2500 ${currency}`}
              >
                Déduction fixe ({currency})
              </FormLabel>
              <input
                type="number"
                value={form.fixed_deduction}
                onChange={e => setForm({ ...form, fixed_deduction: e.target.value })}
                style={S.input}
                placeholder="Optionnel"
              />
            </div>
          </div>

          <div style={S.formGroup}>
            <FormLabel
              required
              help="Ordre d’application de la tranche dans le barème"
              example="Ex: 1, 2, 3"
            >
              Ordre
            </FormLabel>
            <input
              type="number"
              value={form.bracket_order}
              onChange={e => setForm({ ...form, bracket_order: e.target.value })}
              style={S.input}
              placeholder="1, 2, 3..."
            />
          </div>
        </div>

        <div style={S.modalFooter}>
          <button onClick={onClose} style={S.cancelBtn}>Annuler</button>
          <button
            onClick={() => onSave(form)}
            style={S.saveBtn}
            disabled={saving || !form.bracket_name || !form.tax_rate}
          >
            {saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}
            <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function RulesModal({ rules, contributions, currency, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    min_taxable_income: rules.min_taxable_income || 0,
    abattement_type: rules.abattement_type || 'none',
    abattement_percent: rules.abattement_percent || 0,
    abattement_fixed: rules.abattement_fixed || 0,
    max_abattement: rules.max_abattement || '',
    charges_deductibles: rules.charges_deductibles || [],
    tax_calculation_method: rules.tax_calculation_method || 'progressive',
    custom_rules: rules.custom_rules || [],
  })

  const [newRule, setNewRule] = useState({
    key: '',
    value: '',
    description: '',
  })

  const toggleCharge = (code) => {
    setForm(prev => ({
      ...prev,
      charges_deductibles: prev.charges_deductibles.includes(code)
        ? prev.charges_deductibles.filter(c => c !== code)
        : [...prev.charges_deductibles, code],
    }))
  }

  const addCustomRule = () => {
    if (!newRule.key.trim()) return
    setForm(prev => ({
      ...prev,
      custom_rules: [...prev.custom_rules, { ...newRule }],
    }))
    setNewRule({ key: '', value: '', description: '' })
  }

  const removeCustomRule = (index) => {
    setForm(prev => ({
      ...prev,
      custom_rules: prev.custom_rules.filter((_, i) => i !== index),
    }))
  }

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{ ...S.modalContent, maxWidth: 760 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>Modifier les règles de calcul</h2>
          <button onClick={onClose} style={S.modalCloseBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={S.modalBody}>
          <div style={S.noteBox}>
            <Info size={14} color="#F59E0B" />
            <span style={{ color: '#888', fontSize: 12 }}>
              Les charges déductibles sont retranchées avant calcul de l’impôt.  
              L’abattement réduit la base imposable selon la règle choisie.
            </span>
          </div>

          <div className="fiscal-form-row" style={S.formRow}>
            <div style={S.formGroup}>
              <FormLabel
                help="Définit la manière de réduire la base imposable"
                example="Aucun / Pourcentage / Montant fixe"
              >
                Type d’abattement
              </FormLabel>
              <select
                value={form.abattement_type}
                onChange={e => setForm({ ...form, abattement_type: e.target.value })}
                style={S.select}
              >
                <option value="none">Aucun</option>
                <option value="percentage">Pourcentage</option>
                <option value="fixed">Montant fixe</option>
              </select>
            </div>

            <div style={S.formGroup}>
              <FormLabel
                help="Méthode de calcul de l’impôt. Le moteur actuel gère surtout le mode progressif."
                example="Progressive"
              >
                Méthode de calcul de l’impôt
              </FormLabel>
              <select
                value={form.tax_calculation_method}
                onChange={e => setForm({ ...form, tax_calculation_method: e.target.value })}
                style={S.select}
              >
                <option value="progressive">Progressive</option>
              </select>
            </div>
          </div>

          <div className="fiscal-form-row" style={S.formRow}>
            <div style={S.formGroup}>
              <FormLabel
                help="Pourcentage d’abattement appliqué à la base imposable"
                example="Ex: 10 pour 10%"
              >
                Abattement (%)
              </FormLabel>
              <input
                type="number"
                step="0.1"
                value={form.abattement_percent}
                onChange={e => setForm({ ...form, abattement_percent: e.target.value })}
                style={S.input}
              />
            </div>

            <div style={S.formGroup}>
              <FormLabel
                help="Montant fixe à retirer de la base imposable"
                example={`Ex: 25000 ${currency}`}
              >
                Abattement fixe ({currency})
              </FormLabel>
              <input
                type="number"
                value={form.abattement_fixed}
                onChange={e => setForm({ ...form, abattement_fixed: e.target.value })}
                style={S.input}
              />
            </div>
          </div>

          <div className="fiscal-form-row" style={S.formRow}>
            <div style={S.formGroup}>
              <FormLabel
                help="Montant maximum d’abattement autorisé"
                example={`Ex: 50000 ${currency}`}
              >
                Plafond abattement ({currency})
              </FormLabel>
              <input
                type="number"
                value={form.max_abattement}
                onChange={e => setForm({ ...form, max_abattement: e.target.value })}
                style={S.input}
                placeholder="Optionnel"
              />
            </div>

            <div style={S.formGroup}>
              <FormLabel
                help="Si le revenu imposable est en dessous de ce seuil, l’impôt peut être annulé"
                example={`Ex: 62000 ${currency}`}
              >
                Seuil minimum imposable ({currency})
              </FormLabel>
              <input
                type="number"
                value={form.min_taxable_income}
                onChange={e => setForm({ ...form, min_taxable_income: e.target.value })}
                style={S.input}
              />
            </div>
          </div>

          <div style={S.formGroup}>
            <FormLabel
              help="Les cotisations cochées ici seront déduites avant calcul de l’impôt"
              example="Ex: sécurité sociale salariale"
            >
              Charges déductibles de la base imposable
            </FormLabel>
            <div style={S.chargeList}>
              {contributions.length === 0 ? (
                <div style={S.noteBox}>
                  <Info size={14} color="#6366F1" />
                  <span style={{ color: '#888', fontSize: 12 }}>
                    Ajoutez d’abord des cotisations pour pouvoir les marquer comme charges déductibles.
                  </span>
                </div>
              ) : (
                contributions.map((c, idx) => {
                  const code = c.contribution_code || c.code
                  const checked = form.charges_deductibles.includes(code)
                  return (
                    <label key={idx} style={S.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCharge(code)}
                      />
                      <span>{c.contribution_name || c.name} ({code})</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div style={{ marginTop: 6 }}>
            <p style={S.customRuleTitle}>Règles personnalisées</p>

            <div style={S.customRuleForm}>
              <input
                value={newRule.key}
                onChange={e => setNewRule(prev => ({ ...prev, key: e.target.value }))}
                style={S.input}
                placeholder="Clé (ex: taxable_floor)"
              />
              <input
                value={newRule.value}
                onChange={e => setNewRule(prev => ({ ...prev, value: e.target.value }))}
                style={S.input}
                placeholder="Valeur"
              />
              <input
                value={newRule.description}
                onChange={e => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                style={S.input}
                placeholder="Description"
              />
              <button onClick={addCustomRule} style={S.addBtn}>
                <Plus size={16} />
                <span>Ajouter</span>
              </button>
            </div>

            <div style={S.noteBox}>
              <Info size={14} color="#6366F1" />
              <span style={{ color: '#888', fontSize: 12 }}>
                Attention : seules les règles réellement prises en charge par le moteur seront appliquées.
              </span>
            </div>

            <div style={S.customRuleList}>
              {form.custom_rules.map((rule, idx) => (
                <div key={idx} style={S.customRuleItem}>
                  <div>
                    <div style={S.customRuleName}>{rule.key}</div>
                    <div style={S.customRuleDesc}>{rule.description || 'Sans description'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={S.customRuleValue}>{String(rule.value)}</div>
                    <button onClick={() => removeCustomRule(idx)} style={S.iconDeleteBtn}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={S.modalFooter}>
          <button onClick={onClose} style={S.cancelBtn}>Annuler</button>
          <button
            onClick={() =>
              onSave({
                min_taxable_income: Number(form.min_taxable_income) || 0,
                abattement_type: form.abattement_type || 'none',
                abattement_percent: Number(form.abattement_percent) || 0,
                abattement_fixed: Number(form.abattement_fixed) || 0,
                max_abattement: form.max_abattement ? Number(form.max_abattement) : null,
                charges_deductibles: form.charges_deductibles || [],
                tax_calculation_method: form.tax_calculation_method || 'progressive',
                custom_rules: form.custom_rules || [],
              })
            }
            style={S.saveBtn}
            disabled={saving}
          >
            {saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}
            <span>{saving ? 'Enregistrement...' : 'Enregistrer les règles'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ title, message, confirmText, type, onCancel, onConfirm }) {
  const color =
    type === 'danger' ? '#EF4444' :
    type === 'info' ? '#6366F1' :
    '#F59E0B'

  return (
    <div style={S.modalOverlay} onClick={onCancel}>
      <div style={{ ...S.modalContent, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={S.confirmBox}>
          <div style={{ ...S.confirmIcon, background: `${color}20`, color }}>
            <AlertTriangle size={24} />
          </div>
          <h3 style={S.confirmTitle}>{title}</h3>
          <p style={S.confirmText}>{message}</p>
          <div style={S.confirmActions}>
            <button onClick={onCancel} style={S.cancelBtn}>Annuler</button>
            <button onClick={onConfirm} style={{ ...S.confirmBtn, background: color }}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    minHeight: '100vh',
  },

  loadingWrap: {
    minHeight: '100vh',
    background: '#0A0A0F',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: '1px solid rgba(245,158,11,0.2)',
    background: 'rgba(245,158,11,0.1)',
    color: '#F59E0B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: { color: '#FFF', fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '2px' },
  subtitle: { color: '#888', fontSize: '12px', margin: '4px 0 0 0' },

  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 12,
    border: '1px solid rgba(236,72,153,0.25)',
    background: 'rgba(236,72,153,0.12)',
    color: '#EC4899',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
  },

  loadCountryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 12,
    border: '1px solid rgba(99,102,241,0.25)',
    background: 'rgba(99,102,241,0.12)',
    color: '#818CF8',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
  },

  infoBar: {
    display: 'flex',
    gap: 12,
    padding: '16px 18px',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: 16,
  },
  infoTitle: { color: '#F59E0B', fontSize: 13, fontWeight: 700, margin: '0 0 4px 0' },
  infoText: { color: '#AAA', fontSize: 12, margin: 0, lineHeight: 1.6 },

  explainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },

  explainCard: {
    padding: '16px 18px',
    background: 'rgba(20,20,35,0.75)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
  },

  explainWide: {
    padding: '16px 18px',
    background: 'rgba(20,20,35,0.75)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
  },

  explainHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  explainTitle: { color: '#FFF', fontSize: 13, fontWeight: 700 },
  explainText: { color: '#AAA', fontSize: 12, lineHeight: 1.6, margin: 0 },
  explainList: { color: '#888', fontSize: 12, margin: '10px 0 0 18px', padding: 0, lineHeight: 1.8 },

  countryBar: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 12,
    background: 'rgba(20,20,35,0.75)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
  },
  countryGroup: { display: 'flex', flexDirection: 'column', gap: 6 },

  topActionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },

  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(20,20,35,0.75)',
    color: '#888',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: 13,
  },
  tabBtnActive: {
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.25)',
    color: '#F59E0B',
  },
  tabBadge: {
    background: 'rgba(245,158,11,0.2)',
    color: '#F59E0B',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
  },

  card: {
    background: 'rgba(20,20,35,0.75)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 18,
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  cardHeaderLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: '#FFF', fontSize: 16, fontWeight: 700, margin: 0 },
  cardSub: { color: '#777', fontSize: 12, margin: '3px 0 0 0' },

  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(16,185,129,0.25)',
    background: 'rgba(16,185,129,0.12)',
    color: '#10B981',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.08)',
  },

  contribList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 12,
  },

  contribCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  contribHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },

  contribName: { color: '#FFF', fontSize: 14, fontWeight: 700, margin: 0 },
  contribCode: { color: '#666', fontSize: 11, margin: '3px 0 0 0', fontFamily: 'monospace' },

  mandatoryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.2)',
    color: '#10B981',
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  },

  contribBody: { display: 'flex', flexDirection: 'column', gap: 8 },

  contribRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
  },

  contribLabel: { color: '#888', fontSize: 12 },
  contribAmount: { color: '#FFF', fontSize: 13, fontWeight: 700 },

  contribActions: { display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)' },

  editBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid rgba(99,102,241,0.2)',
    background: 'rgba(99,102,241,0.08)',
    color: '#818CF8',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  deleteBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid rgba(239,68,68,0.2)',
    background: 'rgba(239,68,68,0.08)',
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  bracketList: { display: 'flex', flexDirection: 'column', gap: 10 },

  bracketCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  bracketHeader: { display: 'flex', alignItems: 'center', gap: 10 },

  bracketOrder: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#818CF8',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },

  bracketName: { color: '#FFF', fontSize: 14, fontWeight: 700, margin: 0 },

  bracketBody: { display: 'flex', flexDirection: 'column', gap: 8 },

  bracketRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
  },

  bracketLabel: { color: '#888', fontSize: 12 },
  bracketValue: { color: '#FFF', fontSize: 13, fontWeight: 700 },

  rulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },

  ruleItem: {
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  ruleLabel: { color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  ruleValue: { color: '#FFF', fontSize: 13, fontWeight: 700 },

  noteBox: {
    marginTop: 8,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    background: 'rgba(99,102,241,0.06)',
    border: '1px solid rgba(99,102,241,0.15)',
    borderRadius: 12,
  },

  customRuleTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 700,
    margin: '0 0 10px 0',
  },

  customRuleForm: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1.3fr auto',
    gap: 10,
    marginBottom: 12,
  },

  customRuleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  customRuleItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
  },

  customRuleName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 700,
  },

  customRuleDesc: {
    color: '#666',
    fontSize: 11,
    marginTop: 3,
  },

  customRuleValue: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: 700,
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: 999,
    padding: '4px 10px',
  },

  iconDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: '1px solid rgba(239,68,68,0.2)',
    background: 'rgba(239,68,68,0.08)',
    color: '#EF4444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  chargeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  simGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    marginTop: 8,
  },

  simCard: {
    padding: '14px 16px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },

  simLabel: { color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  simValue: { color: '#FFF', fontSize: 15, fontWeight: 800 },

  label: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },

  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#FFF',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    fontSize: 14,
  },

  select: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#FFF',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    fontSize: 14,
    cursor: 'pointer',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },

  modalContent: {
    background: '#141423',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 24,
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },

  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 700, margin: 0 },

  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#888',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  modalBody: {
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },

  cancelBtn: {
    padding: '12px 20px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#E5E5E5',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
  },

  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
  },

  confirmBox: {
    padding: 28,
    textAlign: 'center',
  },

  confirmIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 18px auto',
  },

  confirmTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 700,
    margin: '0 0 10px 0',
  },

  confirmText: {
    color: '#AAA',
    fontSize: 14,
    lineHeight: 1.6,
    margin: '0 0 22px 0',
  },

  confirmActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
  },

  confirmBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    border: 'none',
    color: '#FFF',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
  },

  formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },

  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },

  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#DDD',
    fontSize: 13,
    cursor: 'pointer',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.05)',
  },

  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: 8,
    background: '#1E1E2E',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: 12,
    padding: '12px 14px',
    minWidth: 240,
    maxWidth: 320,
    zIndex: 999,
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
  },

  tooltipExample: {
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: 8,
    padding: '8px 10px',
    marginTop: 6,
  },

  tooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: 'translateX(-50%) rotate(45deg)',
    width: 12,
    height: 12,
    background: '#1E1E2E',
    borderRight: '1px solid rgba(245,158,11,0.2)',
    borderBottom: '1px solid rgba(245,158,11,0.2)',
  },
}