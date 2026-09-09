// src/services/taxationService.js
// ═══════════════════════════════════════════════════════════
// 💰 SERVICE DE CALCUL DES COTISATIONS & IMPÔTS
// Config pays + personnalisation entreprise
// ═══════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase'
import CurrencyService from './currencyService'

class TaxationService {
  // ═══════════════════════════════════════════════════════════
  // 📚 1. CHARGEMENT DES CONFIGURATIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Récupère la configuration complète de paie d'une entreprise
   */
  static async getEnterprisePayrollConfig(enterpriseId) {
    try {
      // 1. Entreprise
      const { data: enterprise, error: entError } = await supabase
        .from('enterprises')
        .select('id, country_code, currency')
        .eq('id', enterpriseId)
        .single()

      if (entError) throw entError

      // ⚠️ AUCUN pays par défaut : appliquer un barème camerounais à une
      // entreprise sénégalaise produisait une paie fausse et silencieuse.
      const countryCode = enterprise?.country_code
      if (!countryCode) {
        throw new Error(
          `Pays fiscal non défini pour « ${enterprise?.name || enterpriseId} ». `
          + 'Renseigne le pays dans « Entreprises » puis relance le calcul.',
        )
      }

      // 2. Config pays
      const { data: countryConfig } = await supabase
        .from('countries_payroll_config')
        .select('*')
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .single()

      // 3. Cotisations entreprise
      const { data: customContributions } = await supabase
        .from('enterprise_payroll_contributions')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('is_active', true)
        .order('display_order')

      // 4. Tranches fiscales entreprise
      const { data: customTaxBrackets } = await supabase
        .from('enterprise_tax_brackets')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('is_active', true)
        .order('bracket_order')

      // 5. Règles custom stockées dans payroll_settings
      const { data: payrollSettings } = await supabase
        .from('payroll_settings')
        .select('custom_tax_rules')
        .eq('enterprise_id', enterpriseId)
        .single()

      const defaultRules = countryConfig?.calculation_rules || {}
      const customRules = payrollSettings?.custom_tax_rules || null

      const contributions =
        customContributions && customContributions.length > 0
          ? customContributions
          : (countryConfig?.default_contributions || [])

      const taxBrackets =
        customTaxBrackets && customTaxBrackets.length > 0
          ? customTaxBrackets
          : (countryConfig?.default_tax_brackets || [])

      // Merge des règles
      const calculationRules = this.mergeCalculationRules(defaultRules, customRules)

      return {
        countryCode,
        currency:
          CurrencyService.resolveCurrency({ enterprise: { country_code: countryCode, currency: enterprise?.currency } })
          || countryConfig?.currency
          || null,
        contributions,
        taxBrackets,
        calculationRules,
      }
    } catch (error) {
      console.error('Erreur chargement config paie:', error)
      // ⚠️ AVANT : ce repli renvoyait silencieusement une config CAMEROUN.
      // Une entreprise sénégalaise dont le chargement échouait calculait donc
      // sa paie avec les barèmes et cotisations du Cameroun, sans alerte.
      // Désormais on échoue explicitement : `throw` remonte à l'appelant.
      throw new Error(
        `Configuration de paie indisponible pour l'entreprise ${enterpriseId} : ${error.message}`,
      )
    }
  }

  /**
   * Fusionne les règles pays + entreprise
   */
  static mergeCalculationRules(defaultRules = {}, customRules = {}) {
    // ⭐ UNE VALEUR `null` CHEZ L'ENTREPRISE VEUT DIRE « JE N'AI RIEN DÉCIDÉ ».
    //   Elle hérite donc du pays. Sans cette précaution, une entreprise « vide »
    //   écrase le pays avec ses zéros : un abattement de 0 % à la place des
    //   30 % du Cameroun, et un impôt calculé sur 100 % du salaire au lieu de
    //   70 %. Le bouton « configuration vide » faisait exactement ça.
    //   👉 Seules les valeurs POSÉES écrasent le pays. Un zéro posé écrase ;
    //      un vide n'écrase pas.
    const posees = Object.fromEntries(
      Object.entries(customRules || {}).filter(([, v]) => v !== null && v !== undefined),
    )

    return {
      ...this.getDefaultCalculationRules(),
      ...defaultRules,
      ...posees,
      charges_deductibles:
        posees.charges_deductibles ?? defaultRules?.charges_deductibles ?? [],
      custom_rules: posees.custom_rules ?? defaultRules?.custom_rules ?? [],
    }
  }

  static getDefaultCalculationRules() {
    return {
      min_taxable_income: 0,
      abattement_type: 'none', // none | percentage | fixed
      abattement_percent: 0,
      abattement_fixed: 0,
      max_abattement: null,
      charges_deductibles: [],
      tax_calculation_method: 'progressive',
      // ⭐ situation de famille : INACTIVE tant qu'un pays ne l'a pas posée
      //   explicitement. Aucun pays n'hérite de parts par accident.
      //   modes : 'base_plus_enfants' (Congo) | 'grille' (Côte d'Ivoire)
      //   applications : 'quotient' (diviser avant) | 'reduction' (retrancher après)
      situation_famille: { type: 'aucun' },
      minimum_perception_annuel: 0,
      // ⭐ second abattement, FIXE et ANNUEL (Cameroun : 500 000 F/an)
      abattement_fixe_annuel: 0,
      // ⭐ pas de retenue du tout sous ce salaire mensuel (Cameroun : 62 000 F)
      seuil_non_retenue_salaire: 0,
      // ⭐ majoration de l'impôt brut (Cameroun : +10 % de CAC)
      majoration_impot_percent: 0,
      custom_rules: [],
    }
  }

  /**
   * Charge la config d'un pays
   */
  static async getCountryConfig(countryCode) {
    try {
      const { data, error } = await supabase
        .from('countries_payroll_config')
        .select('*')
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Erreur chargement config pays:', error)
      return null
    }
  }

  /**
   * Liste des pays disponibles
   */
  static async getAvailableCountries() {
    try {
      const { data, error } = await supabase
        .from('countries_payroll_config')
        .select('country_code, country_name, currency')
        .eq('is_active', true)
        .order('country_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Erreur liste pays:', error)
      return []
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🧮 2. COTISATIONS SOCIALES
  // ═══════════════════════════════════════════════════════════

  static calculateSocialContributions(grossSalary, contributions) {
    const employeeContributions = []
    const employerContributions = []

    let totalEmployeeAmount = 0
    let totalEmployerAmount = 0

    contributions.forEach(contrib => {
      const baseAmount = this._getCalculationBase(grossSalary, contrib.calculation_base)
      let applicableBase = baseAmount

      if (contrib.min_base && applicableBase < contrib.min_base) {
        applicableBase = contrib.min_base
      }
      if (contrib.max_base && applicableBase > contrib.max_base) {
        applicableBase = contrib.max_base
      }

      // Part salariale
      if (contrib.paid_by === 'employee' || contrib.paid_by === 'both') {
        let amount = 0

        if (contrib.calculation_method === 'percentage') {
          amount = (applicableBase * (contrib.rate_employee || 0)) / 100
        } else if (contrib.calculation_method === 'fixed') {
          amount = contrib.fixed_amount || 0
        }

        if (amount > 0) {
          const rounded = Math.round(amount)
          employeeContributions.push({
            code: contrib.contribution_code || contrib.code,
            name: contrib.contribution_name || contrib.name,
            type: contrib.contribution_type || contrib.type,
            base: applicableBase,
            rate: contrib.rate_employee || 0,
            amount: rounded,
            is_mandatory: contrib.is_mandatory || false,
          })
          totalEmployeeAmount += rounded
        }
      }

      // Part patronale
      if (contrib.paid_by === 'employer' || contrib.paid_by === 'both') {
        let amount = 0

        if (contrib.calculation_method === 'percentage') {
          amount = (applicableBase * (contrib.rate_employer || 0)) / 100
        } else if (contrib.calculation_method === 'fixed' && contrib.paid_by === 'employer') {
          amount = contrib.fixed_amount || 0
        }

        if (amount > 0) {
          const rounded = Math.round(amount)
          employerContributions.push({
            code: contrib.contribution_code || contrib.code,
            name: contrib.contribution_name || contrib.name,
            type: contrib.contribution_type || contrib.type,
            base: applicableBase,
            rate: contrib.rate_employer || 0,
            amount: rounded,
            is_mandatory: contrib.is_mandatory || false,
          })
          totalEmployerAmount += rounded
        }
      }
    })

    return {
      employee: employeeContributions,
      employer: employerContributions,
      totalEmployee: totalEmployeeAmount,
      totalEmployer: totalEmployerAmount,
    }
  }

  static _getCalculationBase(grossSalary, baseType) {
    // Extension future : base_salary, taxable_income, etc.
    switch (baseType) {
      case 'gross_salary':
      default:
        return grossSalary
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 📊 3. REVENU IMPOSABLE
  // ═══════════════════════════════════════════════════════════

  static calculateTaxableIncome(grossSalary, contributions, calculationRules) {
    let taxableIncome = grossSalary

    // 1. Charges déductibles
    const deductibleCharges = calculationRules.charges_deductibles || []
    const employeeContribs = contributions.employee || []

    deductibleCharges.forEach(chargeCode => {
      const contrib = employeeContribs.find(c => c.code === chargeCode)
      if (contrib) taxableIncome -= contrib.amount
    })

    // 2. Abattement
    let abattement = 0

    if (calculationRules.abattement_type === 'percentage') {
      abattement = (taxableIncome * (Number(calculationRules.abattement_percent) || 0)) / 100
    } else if (calculationRules.abattement_type === 'fixed') {
      abattement = Number(calculationRules.abattement_fixed) || 0
    }

    if (calculationRules.max_abattement) {
      abattement = Math.min(abattement, Number(calculationRules.max_abattement))
    }

    taxableIncome -= abattement

    // 2 bis. ⭐ UN SECOND ABATTEMENT, FIXE ET ANNUEL.
    //   Certains pays cumulent DEUX abattements : un pourcentage (frais
    //   professionnels) ET un forfait fixe. Cameroun (CGI art. 69) :
    //   30 % de frais professionnels, PUIS 500 000 F par an.
    //   ⚠️ Il est exprimé PAR AN dans la loi : on le divise par 12 ici, une
    //     fois, au même endroit que `minimum_perception_annuel`. Diviser par
    //     12 ailleurs serait la porte ouverte au ÷ 12 appliqué deux fois —
    //     la bêtise qui a déjà failli arriver sur le barème sénégalais.
    const abattementFixeAnnuel = Number(calculationRules.abattement_fixe_annuel) || 0
    if (abattementFixeAnnuel > 0) {
      taxableIncome -= abattementFixeAnnuel / 12
    }

    // 2 ter. ⭐ LE SEUIL DE NON-RETENUE.
    //   Cameroun : « pas de retenue si le salaire mensuel est < 62 000 F ».
    //   ⚠️ Ce seuil porte sur le SALAIRE, pas sur le revenu imposable —
    //     c'est pour ça qu'il est testé ICI, où l'on a encore le brut.
    const seuilNonRetenue = Number(calculationRules.seuil_non_retenue_salaire) || 0
    if (seuilNonRetenue > 0 && grossSalary < seuilNonRetenue) return 0

    // 3. Règles custom
    if (Array.isArray(calculationRules.custom_rules)) {
      calculationRules.custom_rules.forEach(rule => {
        if (!rule?.key) return

        // Exemples de règles simples
        if (rule.key === 'taxable_floor' && Number(rule.value) > 0) {
          if (taxableIncome < Number(rule.value)) taxableIncome = 0
        }

        if (rule.key === 'extra_taxable_deduction' && Number(rule.value) > 0) {
          taxableIncome -= Number(rule.value)
        }
      })
    }

    // 4. Seuil minimum imposable
    if (calculationRules.min_taxable_income && taxableIncome < calculationRules.min_taxable_income) {
      return 0
    }

    return Math.max(0, Math.round(taxableIncome))
  }

  // ═══════════════════════════════════════════════════════════
  // 📈 4. IMPÔT SUR LE REVENU
  // ═══════════════════════════════════════════════════════════

  static calculateIncomeTax(taxableIncome, taxBrackets, calculationRules, fiscalParts = 1) {
    if (!taxBrackets || taxBrackets.length === 0) {
      return {
        totalTax: 0,
        details: [],
        effectiveRate: 0,
        // ⭐ la MÊME clé que la sortie normale : sans elle, un bulletin à
        //   impôt nul affichait `undefined` là où les autres affichent 0.
        impots_brut: 0,
        majoration_impot: 0,
        // ⭐ ZÉRO TRANCHE : ce n'est pas « zéro impôt », c'est « impôt inconnu ».
        impot_a_verifier: true,
      }
    }

    // ⭐ UN REVENU IMPOSABLE NUL EST UN VRAI ZÉRO, PAS UN DOUTE.
    //   Le drapeau veut dire « le barème n'est pas prouvé », il ne veut pas
    //   dire « le calcul s'est mal passé ». Sans cette distinction, tout
    //   salaire sous le seuil de non-retenue sortait marqué « à vérifier »
    //   alors que son impôt était parfaitement juste : zéro.
    if (taxableIncome <= 0) {
      return {
        totalTax: 0,
        details: [],
        effectiveRate: 0,
        // ⭐ la MÊME clé que la sortie normale : sans elle, un bulletin à
        //   impôt nul affichait `undefined` là où les autres affichent 0.
        impots_brut: 0,
        majoration_impot: 0,
        impot_a_verifier: this.impotEstAVerifier(calculationRules),
      }
    }

    const method = calculationRules?.tax_calculation_method || 'progressive'

    const sf = calculationRules?.situation_famille

    // ⭐ TOUS LES MÉCANISMES FAMILIAUX NE DIVISENT PAS LE REVENU.
    //   · « quotient »  : on divise AVANT le barème (Congo)
    //   · « reduction » : on retranche APRÈS le barème (RICF ivoirienne)
    //   ⭐ Diviser avant et retrancher après ne donnent PAS le même impôt.
    //     Les confondre serait une erreur silencieuse et coûteuse.
    const enQuotient = sf?.type === 'parts' && (sf.application || 'quotient') === 'quotient'

    if (method === 'progressive') {
      const resultat = this._calculateProgressiveTax(
        taxableIncome,
        taxBrackets,
        calculationRules,
        enQuotient ? fiscalParts : 1,
      )
      return this._appliquerAjustementsSurImpot(resultat, calculationRules, fiscalParts, taxableIncome)
    }

    return {
      totalTax: 0,
      details: [],
      effectiveRate: 0,
    }
  }

  /**
   * ⭐ NOMBRE DE PARTS FISCALES — LE QUOTIENT FAMILIAL.
   *
   *   Dans certains pays, le barème ne s'applique pas au revenu entier mais au
   *   revenu DIVISÉ par un nombre de parts, puis l'impôt obtenu est
   *   REMULTIPLIÉ par ce même nombre : diviser, appliquer le barème,
   *   remultiplier. Plus il y a de parts, plus l'impôt baisse — c'est ainsi
   *   qu'un système rémunère les charges de famille.
   *
   *   Congo-Brazzaville (CGI art. 116 A à 116 I, loi n° 42-2025) :
   *     · 1 part  : célibataire, divorcé ou veuf sans enfant
   *     · 2 parts : marié sans enfant
   *     · + 0,5 part par enfant à charge · plafond 6,5 parts
   *
   *   ⚠️ SANS CETTE FONCTION, L'IMPÔT DES PARENTS EST SURESTIMÉ.
   *   Un salarié congolais à 330 000 F payait 26 741 F au lieu de 10 269 F
   *   du fait de ses 3 parts : +159 %. Le moteur n'avait aucune notion de
   *   parts — alors que `employees.marital_status` et
   *   `employees.dependents_count` étaient DÉJÀ en base, jamais lus.
   *
   *   Côte d'Ivoire (CGI art. 120) : une GRILLE (situation × enfants). Un
   *   célibataire avec 1 enfant a 2 parts, comme un marié sans enfant.
   *
   *   ⚠️ Une situation de famille VIDE ne fait pas 1 part « par choix » :
   *   elle fait 1 part faute de mieux. Le bulletin le signale
   *   (`parts_non_renseignees`), conformément à la règle « une absence n'est
   *   pas un choix ».
   */
  static getFiscalParts(employee, calculationRules) {
    const sf = calculationRules?.situation_famille
    if (!sf || sf.type !== 'parts') return 1

    const situation = String(employee?.marital_status || '').toLowerCase().trim()
    const enfants = Math.max(0, Math.floor(Number(employee?.dependents_count) || 0))

    let parts

    if (sf.mode === 'grille') {
      // ⭐⭐ GRILLE : le nombre de parts dépend de la situation ET des enfants
      //   ENSEMBLE. Il ne s'obtient pas en ajoutant l'un à l'autre.
      //   Côte d'Ivoire (art. 120 du CGI) : un CÉLIBATAIRE avec 1 enfant a
      //   2 parts — autant qu'un MARIÉ sans enfant. Aucune addition ne donne
      //   ça : il faut une table.
      //   La grille est un tableau indexé par le nombre d'enfants ; le
      //   dernier palier se répète au-delà (« 6 enfants et plus »).
      const grille = sf.parts_grille || {}
      const ligne = grille[situation] || grille[sf.grille_defaut]
      if (Array.isArray(ligne) && ligne.length > 0) {
        parts = Number(ligne[Math.min(enfants, ligne.length - 1)])
      }
    } else {
      const bareme = sf.parts_base || {}
      parts = bareme[situation]
      if (parts === null || parts === undefined) parts = bareme.defaut ?? 1

      const parEnfant = Number.isFinite(Number(sf.parts_par_enfant))
        ? Number(sf.parts_par_enfant)
        : 0.5
      parts = Number(parts) + parEnfant * enfants
    }

    if (!Number.isFinite(parts)) parts = Number(sf.grille_defaut_valeur) || 1

    const plafond = Number(sf.parts_max)
    if (Number.isFinite(plafond) && plafond > 0) parts = Math.min(parts, plafond)

    return Math.max(1, parts)
  }

  static _calculateProgressiveTax(taxableIncome, brackets, calculationRules, fiscalParts = 1) {
    const parts = Math.max(1, Number(fiscalParts) || 1)

    // ⭐ L'ASSIETTE SE LIT PAR PART, PAS SUR LE REVENU ENTIER.
    const assiette = taxableIncome / parts

    let totalTaxUnePart = 0
    const details = []

    const sortedBrackets = [...brackets].sort(
      (a, b) => (a.bracket_order || 0) - (b.bracket_order || 0)
    )

    for (const bracket of sortedBrackets) {
      const min = Number(bracket.min_amount || 0)
      const max = bracket.max_amount != null ? Number(bracket.max_amount) : Infinity
      const rate = Number(bracket.tax_rate || 0)
      const fixedDeduction = Number(bracket.fixed_deduction || 0)

      if (assiette > min) {
        const applicableAmount = Math.min(assiette, max) - min
        let bracketTax = 0

        if (applicableAmount > 0) {
          bracketTax = (applicableAmount * rate) / 100

          if (fixedDeduction > 0 && assiette >= min && assiette <= max) {
            bracketTax = Math.max(0, bracketTax - fixedDeduction)
          }

          totalTaxUnePart += bracketTax

          details.push({
            bracket: bracket.bracket_name || `Tranche ${bracket.bracket_order}`,
            min,
            max: max === Infinity ? null : max,
            rate,
            applicable: Math.round(applicableAmount),
            tax: Math.round(bracketTax),
          })
        }

        if (assiette <= max) break
      }
    }

    // ⭐ LE MINIMUM DE PERCEPTION — la première tranche n'est pas toujours
    //   un 0 %. Au Congo, elle vaut un FORFAIT de 1 200 F par an, dû par
    //   tout le monde, hauts salaires compris. ⚠️ Le moteur ne pouvait pas
    //   l'exprimer : `fixed_deduction` SOUSTRAIT, il n'ajoute jamais.
    //   Le barème étant lu par part, le minimum suit les parts.
    const minimumAnnuel = Number(calculationRules?.minimum_perception_annuel) || 0
    if (minimumAnnuel > 0 && assiette > 0) {
      const minimumUnePart = minimumAnnuel / 12
      totalTaxUnePart += minimumUnePart
      details.push({
        bracket: 'Minimum de perception',
        min: 0,
        max: null,
        rate: 0,
        applicable: Math.round(assiette),
        tax: Math.round(minimumUnePart),
      })
    }

    // ⭐ RETOUR À L'ÉCHELLE DU FOYER — sans cette multiplication, diviser
    //   n'aurait servi qu'à sous-taxer.
    const totalTax = totalTaxUnePart * parts

    const effectiveRate =
      taxableIncome > 0
        ? Math.round((totalTax / taxableIncome) * 100 * 100) / 100
        : 0

    return {
      totalTax: Math.round(totalTax),
      details: details.map(d => ({
        ...d,
        applicable: Math.round(d.applicable * parts),
        tax: Math.round(d.tax * parts),
      })),
      effectiveRate,
      fiscal_parts: parts,
      impot_a_verifier: this.impotEstAVerifier(calculationRules),
    }
  }

  /**
   * ⭐ LA RÉDUCTION POUR CHARGES DE FAMILLE — le second mécanisme familial.
   *
   *   Côte d'Ivoire (ordonnance n° 2023-718/719, art. 120 du CGI) : le barème
   *   s'applique au revenu ENTIER, puis on RETRANCHE 5 500 F par demi-part
   *   au-delà de la première — soit 11 000 F par part, plafonné à 5 parts
   *   (44 000 F/mois). La RICF remplace le quotient familial depuis 2024.
   *
   *   ⚠️ Ne jamais la traiter comme un quotient : diviser le revenu avant le
   *      barème ne retranche pas un forfait, ça change la progressivité.
   *
   *   ⚠️ Une réduction ne rend pas d'argent : l'impôt s'arrête à ZÉRO.
   */
  static _appliquerAjustementsSurImpot(resultat, calculationRules, fiscalParts, taxableIncome) {
    const sf = calculationRules?.situation_famille
    const majoration = Number(calculationRules?.majoration_impot_percent) || 0
    const appReductionFixe = sf?.type === 'parts' && sf.application === 'reduction'
    const appReductionTaux  = sf?.type === 'parts' && sf.application === 'reduction_taux'

    if (majoration <= 0 && !appReductionFixe && !appReductionTaux) return resultat

    // ⭐ LA MAJORATION SE CALCULE SUR L'IMPÔT **BRUT**.
    //   Cameroun : les Centimes Additionnels Communaux sont « un supplément
    //   de 10 % calculé sur le montant BRUT de l'IRPP » (10 % → taux réel
    //   11 %, 15 % → 16,5 %, 25 % → 27,5 %, 35 % → 38,5 %).
    //   ⭐ Elle s'ajoute AVANT la réduction de charges de famille, parce que
    //     la loi la définit sur le brut. Aucun pays n'ayant aujourd'hui les
    //     deux, l'ordre n'est pas vérifié par un cas réel : c'est écrit ici
    //     pour que personne ne l'inverse par inadvertance.
    const impotsBrut = Math.round(resultat.totalTax * (1 + majoration / 100))

    let reduction = 0

    // ── Forme ① : un montant FIXE par part (Côte d'Ivoire, RICF) ──────────
    if (appReductionFixe) {
      const parPart = Number(sf.reduction_par_part) || 0
      if (parPart > 0) {
        reduction = (fiscalParts - 1) * parPart
        const plafond = Number(sf.reduction_max)
        if (Number.isFinite(plafond) && plafond > 0) reduction = Math.min(reduction, plafond)
      }
    }

    // ── Forme ② : un TAUX sur l'impôt, avec un plancher ET un plafond ─────
    //   Sénégal (Guide fiscal des PME, tableau n° 3) : la réduction vaut un
    //   pourcentage de l'impôt brut — ce pourcentage dépend du nombre de
    //   parts — et le montant obtenu est ENCADRÉ entre un minimum et un
    //   maximum exprimés par an.
    //   ⭐ « Un taux » ne suffit pas à décrire cette règle : il y a trois
    //     nombres par ligne, pas un. Les sites qui n'en donnent qu'un
    //     décrivent une règle amputée.
    let reductionEncadree = false
    if (appReductionTaux) {
      const grille = Array.isArray(sf.reduction_grille) ? sf.reduction_grille : []
      const ligne = grille.find(l => Number(l.parts) === Number(fiscalParts))
      if (ligne) {
        const taux = Number(ligne.taux) || 0
        const brute = (resultat.totalTax * taux) / 100

        // ⚠️ les bornes sont ANNUELLES : ÷ 12, au même endroit que les autres
        const mini = (Number(ligne.min) || 0) / 12
        const maxi = (Number(ligne.max) || 0) / 12
        reduction = brute
        if (mini > 0 && brute < mini) { reduction = mini; reductionEncadree = true }
        if (maxi > 0 && reduction > maxi) { reduction = maxi; reductionEncadree = true }
      }
    }

    // ⚠️ Une réduction ne rend pas d'argent : l'impôt s'arrête à ZÉRO.
    let totalTax = Math.max(0, impotsBrut - reduction)

    // ⭐ LE PLAFOND DE TAUX MOYEN — « le montant de l'impôt ne peut excéder
    //   40 % du revenu imposable » (Sénégal, Guide fiscal des PME).
    //   ⚠️ Ce plafond n'a de sens QUE si une tranche marginale dépasse 40 % :
    //     sinon le taux moyen ne peut jamais l'atteindre. Au Sénégal la
    //     dernière tranche est à 43 % — c'est elle qui rend ce plafond utile,
    //     et c'est la preuve que cette tranche existe bien.
    //   👉 Il mord au-delà d'environ 7 058 000 F de revenu imposable mensuel.
    const plafondTaux = Number(calculationRules?.impot_max_percent_revenu) || 0
    if (plafondTaux > 0 && taxableIncome > 0) {
      const maximum = (taxableIncome * plafondTaux) / 100
      if (totalTax > maximum) totalTax = Math.round(maximum)
    }

    return {
      ...resultat,
      totalTax,
      impots_brut: resultat.totalTax,
      ...(majoration > 0 ? { majoration_impot: impotsBrut - resultat.totalTax } : {}),
      ...(reduction > 0 ? { reduction_famille: Math.round(reduction) } : {}),
      ...(reductionEncadree ? { reduction_plafonnee: true } : {}),
      effectiveRate:
        taxableIncome > 0 ? Math.round((totalTax / taxableIncome) * 100 * 100) / 100 : 0,
      fiscal_parts: fiscalParts,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🛡️ 4 bis. LE DRAPEAU QUI BLOQUE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * ⭐ RÈGLE : un pays est PRÉSUMÉ NON VÉRIFIÉ tant qu'il n'a pas dit « false ».
   *   Un drapeau absent n'est pas une preuve, c'est un oubli — et c'est
   *   exactement ce qui est arrivé au Cameroun et au Sénégal : personne n'avait
   *   rien signalé, l'impôt sortait à zéro, tout le monde était content.
   *   On inverse donc la charge de la preuve.
   */
  static impotEstAVerifier(calculationRules) {
    const r = calculationRules || {}
    return r.impot_a_verifier !== false || r.taux_a_verifier === true
  }

  /** La phrase à afficher partout où l'on montre un net qui n'est pas sûr. */
  static avertissementImpot(calculationRules, nomDuPays) {
    if (!this.impotEstAVerifier(calculationRules)) return null
    return (
      '⚠️ Les règles d’impôt du pays « ' + (nomDuPays || 'sélectionné') + ' » n’ont pas été '
      + 'vérifiées avec un bulletin réel. Le net ci-dessous est PROVISOIRE : '
      + 'ne le remets pas à un salarié avant de l’avoir comparé à un vrai bulletin.'
    )
  }

  /** Quand aucune tranche ne s'applique : ce n'est pas un impôt nul, c'est un impôt inconnu. */
  static avertissementSansTranche() {
    return (
      '⚠️ Aucune tranche fiscale n’a pu être appliquée. Ce net est INCONNU, pas nul : '
      + 'vérifie le barème du pays avant de remettre quoi que ce soit à un salarié.'
    )
  }

  /**
   * 🔒 À appeler là où un bulletin devient OFFICIEL : impression, envoi,
   *    clôture de paie. Aujourd'hui cet endroit n'existe pas encore (l'écran
   *    salarié reste à construire) — le filet est donc prêt, et il attend.
   */
  static verifierAvantRemise(bulletin) {
    if (bulletin?.impot_a_verifier) {
      throw new Error(
        'Bulletin refusé : les règles d’impôt de ce pays ne sont pas vérifiées. '
        + 'Compare avec un bulletin réel, puis passe « impot_a_verifier » à false.'
      )
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 💵 5. CALCUL GLOBAL DU BULLETIN
  // ═══════════════════════════════════════════════════════════

  static async calculateDetailedPayslip(enterpriseId, employee, profile, grossSalary) {
    try {
      const config = await this.getEnterprisePayrollConfig(enterpriseId)

      const contributions = this.calculateSocialContributions(
        grossSalary,
        config.contributions
      )

      const taxableIncome = this.calculateTaxableIncome(
        grossSalary,
        contributions,
        config.calculationRules
      )

      // ⭐ les parts se lisent sur l'EMPLOYÉ, jamais sur l'entreprise
      const fiscalParts = this.getFiscalParts(employee, config.calculationRules)

      // ⚠️ 1 part par défaut quand la situation n'est pas renseignée : ce
      //    n'est pas un choix, c'est une absence. On le dit.
      const partsNonRenseignees =
        config.calculationRules?.situation_famille?.type === 'parts' &&
        !employee?.marital_status

      const taxCalculation = this.calculateIncomeTax(
        taxableIncome,
        config.taxBrackets,
        config.calculationRules,
        fiscalParts
      )

      const netSalary = grossSalary - contributions.totalEmployee - taxCalculation.totalTax

      // ⭐ LE FILET : le bulletin sort marqué PROVISOIRE tant que l'impôt du
      //    pays n'a pas été confronté à un bulletin réel.
      const impotAVerifier =
        this.impotEstAVerifier(config.calculationRules) || taxCalculation.impot_a_verifier === true

      return {
        employee,
        profile,
        config,
        grossSalary: Math.round(grossSalary),
        taxableIncome,
        netSalary: Math.round(netSalary),
        contributions,
        tax: {
          ...taxCalculation,
          taxableIncome,
        },
        totalDeductions: contributions.totalEmployee + taxCalculation.totalTax,
        fiscal_parts: fiscalParts,
        parts_non_renseignees: partsNonRenseignees,
        impot_a_verifier: impotAVerifier,
        avertissement: impotAVerifier
          ? (this.avertissementImpot(config.calculationRules, config.country?.country_name)
             || this.avertissementSansTranche())
          : null,
      }
    } catch (error) {
      console.error('Erreur calcul bulletin détaillé:', error)
      throw error
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🛠️ 6. INITIALISATION ENTREPRISE DEPUIS UN PAYS
  // ═══════════════════════════════════════════════════════════

  static async initializeEnterpriseFromCountry(enterpriseId, countryCode) {
    try {
      const countryConfig = await this.getCountryConfig(countryCode)
      if (!countryConfig) {
        throw new Error('Configuration pays introuvable')
      }

      // ⭐ 0. ON GARDE L'ANCIEN DE CÔTÉ AVANT DE DÉMONTER
      //    ⚠️ La version précédente supprimait d'abord et insérait ensuite.
      //       Quand l'insertion échouait, l'entreprise se retrouvait VIDE —
      //       cotisations et tranches effacées — et le seul indice était une
      //       ligne dans la console. On sauvegarde donc, pour pouvoir remettre.
      const { data: anciennesCotisations } = await supabase
        .from('enterprise_payroll_contributions')
        .select('*')
        .eq('enterprise_id', enterpriseId)

      const { data: anciennesTranches } = await supabase
        .from('enterprise_tax_brackets')
        .select('*')
        .eq('enterprise_id', enterpriseId)

      const remettreLEtatDavant = async () => {
        const cotisations = (anciennesCotisations || [])
          .map(({ id, created_at, updated_at, ...reste }) => reste)
        const tranches = (anciennesTranches || [])
          .map(({ id, created_at, updated_at, ...reste }) => reste)
        if (cotisations.length > 0) {
          await supabase.from('enterprise_payroll_contributions').insert(cotisations)
        }
        if (tranches.length > 0) {
          await supabase.from('enterprise_tax_brackets').insert(tranches)
        }
      }

      // 1. Cotisations
      //    ⚠️ Les clés du pays sont `contribution_type`, `contribution_code` et
      //       `contribution_name`. Lire `c.type`, `c.code` et `c.name` donnait
      //       undefined → `contribution_type` à NULL → refus de la base
      //       (erreur 23502, not-null constraint). On accepte les DEUX
      //       écritures, exactement comme le fait déjà le calcul plus haut.
      const contributions = countryConfig.default_contributions || []
      const contribsToInsert = contributions.map((c, i) => ({
        enterprise_id: enterpriseId,
        contribution_type: c.contribution_type || c.type || 'social',
        contribution_code: c.contribution_code || c.code || null,
        contribution_name: c.contribution_name || c.name || c.contribution_code || c.code || 'Cotisation',
        paid_by: c.paid_by,
        calculation_method: c.calculation_method || 'percentage',
        rate_employee: c.rate_employee || 0,
        rate_employer: c.rate_employer || 0,
        fixed_amount: c.fixed_amount || 0,
        calculation_base: c.calculation_base || 'gross_salary',
        min_base: c.min_base ?? null,
        max_base: c.max_base ?? null,
        is_mandatory: c.is_mandatory || false,
        is_active: true,
        display_order: c.display_order ?? i + 1,
      }))

      // 2. Tranches fiscales
      const taxBrackets = countryConfig.default_tax_brackets || []
      const bracketsToInsert = taxBrackets.map(b => ({
        enterprise_id: enterpriseId,
        bracket_name: b.bracket_name || ('Tranche ' + (b.bracket_order ?? '')).trim(),
        min_amount: b.min_amount ?? 0,
        max_amount: b.max_amount ?? null,
        tax_rate: b.tax_rate || 0,
        fixed_deduction: b.fixed_deduction || 0,
        tax_type: 'irpp',
        bracket_order: b.bracket_order ?? 0,
        is_active: true,
      }))

      // ⭐ 3. VALIDER AVANT DE DÉTRUIRE
      //    Une cotisation sans type, sans code ou sans « à la charge de » doit
      //    faire échouer l'opération AVANT la suppression, jamais après.
      const incomplete = contribsToInsert.find(c => !c.contribution_type || !c.contribution_code || !c.paid_by)
      if (incomplete) {
        throw new Error(
          'Cotisation incomplète dans la configuration du pays ' + countryCode + ' : « '
          + incomplete.contribution_name + ' » n\'a pas de type, de code ou de « à la charge de ». '
          + 'Corrige le pays avant de l\'importer — RIEN n\'a été supprimé.'
        )
      }

      // 4. Nettoyage, puis import. En cas d'échec, on remet l'état d'avant.
      await supabase
        .from('enterprise_payroll_contributions')
        .delete()
        .eq('enterprise_id', enterpriseId)

      await supabase
        .from('enterprise_tax_brackets')
        .delete()
        .eq('enterprise_id', enterpriseId)

      if (contribsToInsert.length > 0) {
        const { error: contribError } = await supabase
          .from('enterprise_payroll_contributions')
          .insert(contribsToInsert)

        if (contribError) {
          await remettreLEtatDavant()
          throw contribError
        }
      }

      if (bracketsToInsert.length > 0) {
        const { error: bracketError } = await supabase
          .from('enterprise_tax_brackets')
          .insert(bracketsToInsert)

        if (bracketError) {
          await remettreLEtatDavant()
          throw bracketError
        }
      }

      // 3. Mettre à jour entreprise
      const { error: updateError } = await supabase
        .from('enterprises')
        .update({
          country_code: countryCode,
          currency: countryConfig.currency || null,
        })
        .eq('id', enterpriseId)

      if (updateError) throw updateError

      // 4. Sauver règles pays dans payroll_settings.custom_tax_rules
      const rulesPayload = countryConfig.calculation_rules || this.getDefaultCalculationRules()

      const { data: existingSettings } = await supabase
        .from('payroll_settings')
        .select('id')
        .eq('enterprise_id', enterpriseId)
        .single()

      if (existingSettings) {
        const { error: settingsError } = await supabase
          .from('payroll_settings')
          .update({
            custom_tax_rules: rulesPayload,
            updated_at: new Date().toISOString(),
          })
          .eq('enterprise_id', enterpriseId)

        if (settingsError) throw settingsError
      } else {
        const { error: settingsError } = await supabase
          .from('payroll_settings')
          .insert({
            enterprise_id: enterpriseId,
            currency: countryConfig.currency || null,
            custom_tax_rules: rulesPayload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

        if (settingsError) throw settingsError
      }

      return { success: true }
    } catch (error) {
      console.error('Erreur initialisation config entreprise:', error)
      return { success: false, error: error.message }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 💵 UTILITAIRES
  // ═══════════════════════════════════════════════════════════

  static formatMoney(amount, currency = null, options = {}) {
    return CurrencyService.format(amount, currency, options)
  }

  static _formatMoneyLegacy(amount, currency = null) {
    const num = Number(amount) || 0
    const formatted = Math.round(num)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    return `${formatted} ${currency}`
  }
}

export default TaxationService