import PaieWalletLoader from '../components/PaieWalletLoader'
import PaieDrawer from '../components/PaieDrawer'
import { PaieFiscalGuide, PaieCountrySummary, PaieRulesSummary, PaieSectionIntro } from '../components/PaieInteriorSections'
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
import PayrollService from '../services/payrollService'
import toast from 'react-hot-toast'
import { useTheme } from '../contexts/ThemeContext'
import { palettePaie, stylesPaie } from '../styles/paieTheme'
import { remplacerConfigurationFiscale } from '../services/fiscalTransactions'
import PaieKpiCards from '../components/PaieKpiCards'
import { BarresTranches, CarteGraphique } from '../components/PaieGraphiques'
import RecapChargement from '../components/PaieRecapChargement'
import { FieldHelp, FormLabel } from '../components/PaieFiscalChamps'
import { ContributionCard, BracketCard } from '../components/PaieFiscalCartes'
import { ContributionModal, BracketModal, RulesModal, ConfirmModal } from '../components/PaieFiscalModales'

export default function ConfigurationFiscale({ integre = false, ongletExterne = null, entrepriseIdForce = null, onContextChange = null, onBusyChange = null, refreshVersion = 0 } = {}) {
  const { darkMode } = useTheme()
  const S = stylesPaie(darkMode)
  const P = palettePaie(darkMode)
  const [showCountryDrawer, setShowCountryDrawer] = useState(false)
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [rulesSnapshot, setRulesSnapshot] = useState(undefined)
  useEffect(() => { onBusyChange?.(saving) }, [saving, onBusyChange])

  const [enterpriseId, setEnterpriseId] = useState(null)
  const [enterpriseName, setEnterpriseName] = useState('')
  const [enterprisesList, setEnterprisesList] = useState([])

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

  const [ongletInterne, setOngletInterne] = useState('contributions')
  // En mode intégré, c'est la coque qui tient la barre d'onglets
  const activeTab = ongletExterne || ongletInterne
  const setActiveTab = setOngletInterne

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
    details: null,
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

    // En mode intégré, la coque a déjà choisi l'entreprise (c'est son
    // sélecteur que voit l'utilisateur) : on la suit au lieu de décider.
    if (entrepriseIdForce) {
      setLoading(true)
      Promise.resolve()
        .then(async () => {
          const countries = await TaxationService.getAvailableCountries()
          setAvailableCountries(countries)
          await loadEnterpriseData(entrepriseIdForce)
        })
        .catch((err) => {
          console.error(err)
          setLoadError(err.message || 'Erreur chargement configuration')
        })
        .finally(() => setLoading(false))
      return
    }

    initPage(parsedAdmin)
  }, [navigate, entrepriseIdForce, refreshVersion])

  const loadEnterpriseData = async (targetEnterpriseId) => {
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

    await loadCurrentConfig(targetEnterpriseId)
  }

  const initPage = async (adminData) => {
    setLoading(true)
    try {
      const isSuperAdmin = adminData.role === 'super_admin'
      let targetEnterpriseId = adminData.selectedEnterprise?.id || adminData.enterprise_id

      if (isSuperAdmin) {
        const { data: allEnts } = await supabase
          .from('enterprises')
          .select('id, name, code, logo_url, country_code, currency, fiscal_country_label')
          .eq('is_active', true)
          .order('name')
        const list = allEnts || []
        setEnterprisesList(list)

        if (!targetEnterpriseId && list.length > 0) {
          const lastId =
            (adminData.id && localStorage.getItem(`last_enterprise_id_${adminData.id}`)) ||
            localStorage.getItem('last_enterprise_id')
          const picked = (lastId && list.find(e => e.id === lastId)) || list[0]
          targetEnterpriseId = picked.id
          const updatedAdmin = { ...adminData, entreprises: list, selectedEnterprise: picked }
          setAdmin(updatedAdmin)
          localStorage.setItem('admin', JSON.stringify(updatedAdmin))
          localStorage.setItem('last_enterprise_id', picked.id)
        }
      } else if (Array.isArray(adminData.entreprises) && adminData.entreprises.length > 1) {
        setEnterprisesList(adminData.entreprises)
      }

      if (!targetEnterpriseId) {
        toast.error('Aucune entreprise sélectionnée')
        navigate('/dashboard')
        return
      }

      // Le Super Admin a toujours accès à la Configuration Fiscale de toute entreprise.
      // Dans la coque, c'est elle qui décide : verrouiller ici aussi ferait
      // sortir un client « fiscalité seule » de sa propre page.
      if (!isSuperAdmin && !integre) {
        const hasAccess = await FeatureService.hasFeature(targetEnterpriseId, FEATURES.FICHES_PAIE)
        if (!hasAccess) {
          toast.error('Module fiches de paie non activé')
          navigate('/dashboard')
          return
        }
      }

      const countries = await TaxationService.getAvailableCountries()
      setAvailableCountries(countries)

      await loadEnterpriseData(targetEnterpriseId)
    } catch (err) {
      console.error(err)
      toast.error('Erreur chargement configuration')
      navigate('/dashboard')
    }
    setLoading(false)
  }

  const handleEnterpriseSelectChange = async (newEntId) => {
    if (!newEntId || newEntId === enterpriseId) return
    setLoading(true)
    try {
      const chosen = enterprisesList.find(e => e.id === newEntId)
      if (chosen && admin) {
        const updatedAdmin = { ...admin, selectedEnterprise: chosen }
        setAdmin(updatedAdmin)
        localStorage.setItem('admin', JSON.stringify(updatedAdmin))
        localStorage.setItem('last_enterprise_id', chosen.id)
        if (admin.id) {
          localStorage.setItem(`last_enterprise_id_${admin.id}`, chosen.id)
        }
      }
      await loadEnterpriseData(newEntId)
      toast.success(`Entreprise chargée : ${chosen?.name || ''}`)
    } catch (err) {
      console.error('Erreur changement entreprise:', err)
      toast.error('Impossible de charger cette entreprise')
    }
    setLoading(false)
  }

  const loadCurrentConfig = async (entId) => {
    try {
      const config = await TaxationService.getEnterprisePayrollConfig(entId)
      setContributions(config.contributions || [])
      setTaxBrackets(config.taxBrackets || [])
      setCalculationRules(config.calculationRules || {})
      setRulesSnapshot(config.customRulesSnapshot)
      setLoadError('')
    } catch (err) {
      console.error('Erreur chargement config:', err)
      setLoadError(err.message || 'Configuration indisponible')
      setRulesSnapshot(undefined)
    }
  }

  const openConfirm = ({ title, message, confirmText = 'Confirmer', type = 'warning', onConfirm, details = null }) => {
    setConfirmModal({
      open: true,
      title,
      message,
      confirmText,
      type,
      onConfirm,
      details,
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

      onContextChange?.()
      await loadCurrentConfig(enterpriseId)
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

    // On va chercher le modèle du pays AVANT de demander confirmation :
    // le récapitulatif doit montrer des chiffres réels, pas une promesse.
    const configPays = await TaxationService.getCountryConfig(pendingCountryCode)
    if (!configPays) {
      toast.error(`Aucune configuration disponible pour ${countryName}`)
      return
    }

    const avant = {
      cotisations: contributions.length,
      tranches: taxBrackets.length,
      regles: calculationRules || {},
    }
    const apres = {
      cotisations: (configPays.default_contributions || []).length,
      tranches: (configPays.default_tax_brackets || []).length,
      regles: configPays.calculation_rules || TaxationService.getDefaultCalculationRules(),
    }

    openConfirm({
      title: 'Charger la configuration du pays',
      message: `Vous allez charger la configuration officielle de ${countryName}. Les cotisations, tranches fiscales et règles actuelles de l’entreprise seront remplacées.`,
      confirmText: 'Oui, charger',
      type: 'info',
      details: <RecapChargement avant={avant} apres={apres} nomApres={countryName} />,
      onConfirm: async () => {
        closeConfirm()
        setSaving(true)
        try {
          const result = await TaxationService.initializeEnterpriseFromCountry(enterpriseId, pendingCountryCode, { currency: pendingCurrency, fiscalLabel: pendingFiscalCountryLabel })

          if (result.success) {
            onContextChange?.()
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
          toast.error(err.message || 'Erreur chargement configuration pays')
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

          await remplacerConfigurationFiscale(enterpriseId, { contributions: [], taxBrackets: [], rules: emptyRules })

          setContributions([])
          setTaxBrackets([])
          await loadCurrentConfig(enterpriseId)
          toast.success('Configuration vide créée')
        } catch (err) {
          console.error(err)
          toast.error(err.message || 'Erreur création config vide')
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
            .eq('id', contrib.id).eq('enterprise_id', enterpriseId)

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
            .eq('id', bracket.id).eq('enterprise_id', enterpriseId)

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
    // Un seul rédacteur pour `payroll_settings.custom_tax_rules` : le
    // service. Écrire la colonne depuis la page, c'est risquer d'écraser
    // ce que « Fiches de paie » a sauvegardé une seconde plus tôt.
    try {
      const ok = await PayrollService.saveCustomTaxRules(enterpriseId, rules, rulesSnapshot)
      if (!ok) throw new Error('saveCustomTaxRules a échoué')

      setCalculationRules(rules)
      setRulesSnapshot(rules)
      if (showToast) toast.success('Règles de calcul enregistrées')
      return true
    } catch (err) {
      console.error(err)
      if (showToast) toast.error(err.message || 'Erreur sauvegarde règles')
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

  if (loadError) return <div role="alert" className="pw-error">{loadError}<button className="paie-btn" onClick={() => loadCurrentConfig(enterpriseId)}>Réessayer</button></div>

  if (loading) {
    return <PaieWalletLoader label="Chargement de la configuration fiscale…"/>
  }

  return (
    <>
      {/* ⚠️ Ces règles étaient GLOBALES : `html, body, #root` repeints en
          noir, et tous les champs du site forcés en sombre. Elles
          débordaient donc de la page et imposaient l'ancien décor à
          toute l'application. Elles sont désormais cantonnées au volet
          (classe `.fiscal-volet`) et teintées par le thème. */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fiscal-card { animation: fadeInUp 0.3s ease forwards; }
        .fiscal-btn:hover { transform: translateY(-1px); }

        .fiscal-volet select, .fiscal-volet input, .fiscal-volet textarea {
          background: ${P.voile3} !important;
          color: ${P.texte} !important;
        }

        .fiscal-volet select option, .fiscal-volet datalist option {
          background: ${P.surface2} !important;
          color: ${P.texte} !important;
        }

        .fiscal-volet input::placeholder, .fiscal-volet textarea::placeholder {
          color: ${P.texteFaint} !important;
        }

        @media (max-width: 768px) {
          .fiscal-grid-2 { grid-template-columns: 1fr !important; }
          .fiscal-form-row { grid-template-columns: 1fr !important; }
          .fiscal-sim-grid { grid-template-columns: 1fr !important; }
        }

        .fiscal-volet ::-webkit-scrollbar { width: 8px; }
        .fiscal-volet ::-webkit-scrollbar-track { background: transparent; }
        .fiscal-volet ::-webkit-scrollbar-thumb { background: ${P.ambre9}; border-radius: 4px; }
      `}</style>

      <div
        className="fiscal-volet paie-page"
        data-theme={darkMode ? 'dark' : 'light'}
        style={integre ? { width: '100%' } : { minHeight: '100vh', background: P.fond, width: '100%' }}
      >
        <div style={integre ? S.conteneurIntegre : S.container}>
          {!integre && (
          <header style={S.header}>
            <div style={S.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={S.backBtn} title="Retour au tableau de bord">
                <ArrowLeft size={18} />
              </button>
              <div style={S.logoBox}>
                <Settings size={22} color={P.ambre} />
              </div>
              <div>
                <h1 style={S.title}>CONFIGURATION FISCALE</h1>
                {enterprisesList.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ color: P.texteDoux2, fontSize: 12 }}>Entreprise :</span>
                    <select
                      value={enterpriseId || ''}
                      onChange={(e) => handleEnterpriseSelectChange(e.target.value)}
                      style={{
                        background: P.ambre4,
                        border: `1px solid ${P.ambre10}`,
                        borderRadius: 8,
                        padding: '5px 10px',
                        color: P.ambre,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {enterprisesList.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.name} {ent.country_code ? `(${ent.country_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p style={S.subtitle}>{enterpriseName}</p>
                )}
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
          )}

          {integre && activeTab === 'pays' && <>
            <h2>Configuration fiscale</h2>
            <PaieKpiCards contributions={contributions} tranches={taxBrackets} darkMode={darkMode}/>
            <p className="pw-graph-note">Taux nominaux : hors plafonds, assiettes particulières et cotisations forfaitaires. Les charges patronales s’ajoutent au brut.</p>
            <div className="pw-graphs"><CarteGraphique titre="Taux par tranche" sousTitre="Barème configuré — ce n’est pas un taux effectif sur le brut" darkMode={darkMode}><BarresTranches tranches={taxBrackets} darkMode={darkMode}/></CarteGraphique></div>
          </>}
          {(!integre || activeTab === 'pays') && (<>
          <PaieFiscalGuide />
          <PaieCountrySummary country={pendingCountryCode} label={pendingFiscalCountryLabel || selectedCountryName} currency={pendingCurrency} onEdit={() => setShowCountryDrawer(true)} />
          {showCountryDrawer && <PaieDrawer title="Pays, libellé et devise" onClose={() => setShowCountryDrawer(false)} busy={saving} help="Le pays propose une devise. Le libellé change seulement le texte affiché. Enregistrez pour appliquer vos choix." example="Pour le Bénin, la devise suggérée est XOF. Réinitialiser la devise restaure cette suggestion sans convertir les montants.">
          <div className="pi-country-form"><header><h3>Pays, libellé & devise</h3><button onClick={() => setShowCountryDrawer(false)} disabled={saving}>Fermer</button></header>
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
            <Info size={14} color={P.indigo} />
            <span style={{ color: P.texteDoux2, fontSize: 12 }}>
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

          </div></PaieDrawer>}
          </>)}

          {!integre && (
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
          )}

          <PaieSectionIntro section={activeTab === 'preview' ? 'simulation' : activeTab}/>
          {activeTab === 'contributions' && (
            <div style={S.card} className="fiscal-card">
              <div style={S.cardHeader}>
                <div style={S.cardHeaderLeft}>
                  <div style={{ ...S.cardIcon, background: P.vert1 }}>
                    <Shield size={18} color={P.vert} />
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
                <Info size={14} color={P.vert} />
                <span style={{ color: P.texteDoux2, fontSize: 12 }}>
                  Une cotisation peut être calculée en pourcentage du brut ou en montant fixe.  
                  La part salariale est déduite du bulletin. La part patronale impacte le coût employeur.
                </span>
              </div>

              {contributions.length === 0 ? (
                <div style={S.emptyState}>
                  <AlertTriangle size={24} color={P.texteFaint} />
                  <p style={{ color: P.texteDoux2, margin: '8px 0 0 0' }}>Aucune cotisation configurée</p>
                  <p style={{ color: P.texteFaint, fontSize: 12, margin: '4px 0 0 0' }}>
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
                  <div style={{ ...S.cardIcon, background: P.indigo3 }}>
                    <Percent size={18} color={P.indigo} />
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
                <Info size={14} color={P.indigo} />
                <span style={{ color: P.texteDoux2, fontSize: 12 }}>
                  Les tranches doivent être cohérentes : pas de chevauchement, pas de vide logique, et un ordre correct.
                  Le calcul fiscal actuel du moteur est <strong>progressif</strong>.
                </span>
              </div>

              {taxBrackets.length === 0 ? (
                <div style={S.emptyState}>
                  <AlertTriangle size={24} color={P.texteFaint} />
                  <p style={{ color: P.texteDoux2, margin: '8px 0 0 0' }}>Aucune tranche fiscale configurée</p>
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
                  <div style={{ ...S.cardIcon, background: P.ambre4 }}>
                    <SlidersHorizontal size={18} color={P.ambre} />
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

              <PaieRulesSummary rules={calculationRules} contributions={contributions} formatMoney={fmt} onEdit={() => setShowRulesModal(true)}/>
            </div>
          )}

          {activeTab === 'preview' && (
            <div style={S.card} className="fiscal-card">
              <div style={S.cardHeader}>
                <div style={S.cardHeaderLeft}>
                  <div style={{ ...S.cardIcon, background: P.ambre4 }}>
                    <Calculator size={18} color={P.ambre} />
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
                        background: P.rouge2,
                        border: `1px solid ${P.rouge4}`,
                        marginBottom: 14,
                        alignItems: 'flex-start',
                      }}
                    >
                      <AlertTriangle size={16} color={P.rouge} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ color: P.rougeClair, fontSize: 12, lineHeight: 1.5 }}>
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
                      <span style={{ ...S.simValue, color: P.rouge }}>
                        - {fmt(simulationExplanation.social.totalEmployee || 0)}
                      </span>
                    </div>

                    <div style={S.simCard}>
                      <span style={S.simLabel}>Revenu imposable</span>
                      <span style={S.simValue}>{fmt(simulationExplanation.taxable || 0)}</span>
                    </div>

                    <div style={S.simCard}>
                      <span style={S.simLabel}>Impôt total</span>
                      <span style={{ ...S.simValue, color: P.rouge }}>
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
                          color: simulationExplanation.impot_a_verifier ? P.ambre : P.vert,
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
                        <Info size={14} color={P.indigo} />
                        <span style={{ color: P.texteDoux2, fontSize: 12 }}>Aucune cotisation salariale appliquée sur ce test.</span>
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
                        <Info size={14} color={P.indigo} />
                        <span style={{ color: P.texteDoux2, fontSize: 12 }}>Aucune tranche fiscale appliquée sur ce test.</span>
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
              details={confirmModal.details}
            />
          )}
        </div>
      </div>
    </>
  )
}
