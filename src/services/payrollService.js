// src/services/payrollService.js
import { db } from '../lib/db'
import FeatureService from './featureService'
import HolidayService from './holidayService'
import TaxationService from './taxationService'
import CurrencyService from './currencyService'
import { ecrireReglesFiscales } from './reglesFiscalesEcriture'
import { minutesDepuisMinuit } from '../utils/timezoneUtils'
import { SEUILS_PAR_DEFAUT, filtrerPointagesPayables } from './seuilsPointage'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

class PayrollService {
  static getDefaultPayrollSettings() {
    return {
      // ⚠️ PAS de devise par défaut : elle se déduit de l'entreprise.
      // Inventer 'XAF' faisait produire des bulletins en francs CFA BEAC
      // à des entreprises de la zone XOF. Voir CurrencyService.
      currency: null,
      salary_period: 'monthly',
      working_days_divisor: 22,
      hourly_divisor: 173.33,

      use_attendance_data: true,
      use_overtime_data: true,
      use_absence_data: true,
      use_late_data: false,
      use_holiday_work_data: true,
      use_imported_variables: true,

      deduct_absence: true,
      deduct_late: false,
      include_overtime_in_payroll: true,

      absence_deduction_mode: 'daily',
      late_deduction_mode: 'none',

      company_header: '',
      company_footer: '',

      signature_name: '',
      signature_image: '',

      signatory1_name: '',
      signatory1_title: '',
      signatory1_signature: '',
      signatory2_name: '',
      signatory2_title: '',
      signatory2_signature: '',
      company_stamp: '',

      company_rccm: '',
      company_nif: '',
      company_cnps_number: '',
      company_collective_agreement: '',
      legal_mention:
        'Ce bulletin de paie doit être conservé sans limitation de durée. Il peut servir de justificatif pour faire valoir vos droits.',

      leave_days_per_month: 1.75,
      annual_leave_cap: 30,
      company_social_label: '',
      hide_social_label: false,

      custom_tax_rules: {},
    }
  }

  static async getPayrollSettings(enterpriseId) {
    try {
      const { data, error } = await db()
        .from('payroll_settings')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .single()

      if (error && error.code === 'PGRST116') {
        return this.getDefaultPayrollSettings()
      }

      if (error) throw error
      return { ...this.getDefaultPayrollSettings(), ...data }
    } catch (err) {
      console.error('Erreur récupération paramètres paie:', err)
      return this.getDefaultPayrollSettings()
    }
  }

  static async savePayrollSettings(enterpriseId, settings) {
    try {
      const { data: existing } = await db()
        .from('payroll_settings')
        .select('id')
        .eq('enterprise_id', enterpriseId)
        .single()

      const payload = {
        enterprise_id: enterpriseId,
        currency: CurrencyService.resolveCurrency({ settings }) || null,
        salary_period: settings.salary_period || 'monthly',
        working_days_divisor: parseFloat(settings.working_days_divisor) || 22,
        hourly_divisor: parseFloat(settings.hourly_divisor) || 173.33,

        use_attendance_data: settings.use_attendance_data ?? true,
        use_overtime_data: settings.use_overtime_data ?? true,
        use_absence_data: settings.use_absence_data ?? true,
        use_late_data: settings.use_late_data ?? false,
        use_holiday_work_data: settings.use_holiday_work_data ?? true,
        use_imported_variables: settings.use_imported_variables ?? true,

        deduct_absence: settings.deduct_absence ?? true,
        deduct_late: settings.deduct_late ?? false,
        include_overtime_in_payroll: settings.include_overtime_in_payroll ?? true,

        absence_deduction_mode: settings.absence_deduction_mode || 'daily',
        late_deduction_mode: settings.late_deduction_mode || 'none',

        company_header: settings.company_header || '',
        company_footer: settings.company_footer || '',

        signature_name: settings.signature_name || settings.signatory1_name || '',
        signature_image: settings.signature_image || settings.signatory1_signature || '',

        signatory1_name: settings.signatory1_name || '',
        signatory1_title: settings.signatory1_title || '',
        signatory1_signature: settings.signatory1_signature || '',
        signatory2_name: settings.signatory2_name || '',
        signatory2_title: settings.signatory2_title || '',
        signatory2_signature: settings.signatory2_signature || '',
        company_stamp: settings.company_stamp || '',

        company_rccm: settings.company_rccm || '',
        company_nif: settings.company_nif || '',
        company_cnps_number: settings.company_cnps_number || '',
        company_collective_agreement: settings.company_collective_agreement || '',
        legal_mention:
          settings.legal_mention ||
          'Ce bulletin de paie doit être conservé sans limitation de durée.',

        leave_days_per_month: parseFloat(settings.leave_days_per_month) || 1.75,
        annual_leave_cap: parseInt(settings.annual_leave_cap) || 30,

        company_social_label: settings.company_social_label || '',
        hide_social_label: settings.hide_social_label ?? false,

        // ⚠️ PAS de `custom_tax_rules` ici — volontairement.
        //   Cette colonne appartient au module fiscalité : la page « Règles
        //   fiscales » la réécrit EN ENTIER depuis son propre état. La
        //   recopier depuis `settings` reviendrait à écraser les règles d'un
        //   pays chargées dans un autre onglet avec un état lu avant — les
        //   4 entreprises de production ont toutes des règles non vides,
        //   l'écrasement est donc une perte de données réelle.
        //   → un seul rédacteur : PayrollService.saveCustomTaxRules()
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        const { error } = await db()
          .from('payroll_settings')
          .update(payload)
          .eq('enterprise_id', enterpriseId)
        if (error) throw error
      } else {
        const { error } = await db()
          .from('payroll_settings')
          .insert({ ...payload, created_at: new Date().toISOString() })
        if (error) throw error
      }

      return true
    } catch (err) {
      console.error('Erreur sauvegarde paramètres paie:', err)
      return false
    }
  }


  /**
   * Le SEUL chemin d'écriture de `payroll_settings.custom_tax_rules`.
   *
   * Avant, trois endroits écrivaient cette colonne : cette page-ci (57
   * colonnes d'un coup, depuis un état parfois périmé), la page
   * Configuration fiscale (3 colonnes) et TaxationService. Trois
   * rédacteurs sur la même colonne, c'est une perte de données qui
   * attend son tour. Il n'en reste qu'un, et il n'écrit que sa colonne.
   */
  static async saveCustomTaxRules(enterpriseId, rules, expectedRules) {
    if (!enterpriseId) return false
    try {
      return await ecrireReglesFiscales(enterpriseId, rules, expectedRules)
    } catch (err) {
      console.error('Erreur sauvegarde règles fiscales:', err)
      throw err
    }
  }

  static getSocialLabel(settings) {
  if (settings?.hide_social_label) return ''
  return settings?.company_social_label?.trim() || 'Organisme social'
}

  static async getEmployeePayrollProfiles(enterpriseId) {
    try {
      const { data, error } = await db()
        .from('employee_payroll_profiles')
        .select(`
          *,
          employees (
            id, first_name, last_name, matricule,
            department, position, is_active, photo_url
          )
        `)
        .eq('enterprise_id', enterpriseId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement profils paie:', err)
      return []
    }
  }

  static async saveEmployeePayrollProfile(profile) {
    try {
      const payload = {
        employee_id: profile.employee_id,
        enterprise_id: profile.enterprise_id,
        salary_type: profile.salary_type || 'monthly',
        base_salary: parseFloat(profile.base_salary) || 0,
        hourly_rate: parseFloat(profile.hourly_rate) || 0,
        daily_rate: parseFloat(profile.daily_rate) || 0,
        transport_allowance: parseFloat(profile.transport_allowance) || 0,
        housing_allowance: parseFloat(profile.housing_allowance) || 0,
        fixed_bonus: parseFloat(profile.fixed_bonus) || 0,
        fixed_deduction: parseFloat(profile.fixed_deduction) || 0,
        payment_method: profile.payment_method || null,
        bank_name: profile.bank_name || null,
        bank_account: profile.bank_account || null,
        iban: profile.iban || null,
        bic_swift: profile.bic_swift || null,
        mobile_money_provider: profile.mobile_money_provider || null,
        mobile_money_number: profile.mobile_money_number || null,
        payment_frequency: profile.payment_frequency || 'monthly',
        preferred_payment_day: parseInt(profile.preferred_payment_day) || 28,
        contract_hours_per_month: profile.contract_hours_per_month
          ? parseFloat(profile.contract_hours_per_month)
          : null,
        contract_days_per_month: profile.contract_days_per_month
          ? parseFloat(profile.contract_days_per_month)
          : null,
        min_guaranteed_hours: profile.min_guaranteed_hours
          ? parseFloat(profile.min_guaranteed_hours)
          : null,
        overtime_eligible: profile.overtime_eligible ?? true,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      const { error } = await db()
        .from('employee_payroll_profiles')
        .upsert(payload, { onConflict: 'employee_id' })

      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur sauvegarde profil paie:', err)
      return false
    }
  }

  static async getEmployeeAllowances(enterpriseId, employeeId = null) {
    try {
      let query = db()
        .from('employee_allowances')
        .select(`
          *,
          allowance_types (
            id, code, name, category, calculation_type
          ),
          employees (
            id, first_name, last_name, matricule
          )
        `)
        .eq('enterprise_id', enterpriseId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (employeeId) query = query.eq('employee_id', employeeId)

      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement primes récurrentes:', err)
      return []
    }
  }

  static async getActiveAllowancesForPeriod(enterpriseId, employeeId, periodStart, periodEnd) {
    try {
      const { data, error } = await db()
        .from('employee_allowances')
        .select(`*, allowance_types(*)`)
        .eq('enterprise_id', enterpriseId)
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .lte('start_date', periodEnd)
        .or(`end_date.is.null,end_date.gte.${periodStart}`)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement primes période:', err)
      return []
    }
  }

  static async saveEmployeeAllowance(allowance) {
    try {
      const payload = {
        enterprise_id: allowance.enterprise_id,
        employee_id: allowance.employee_id,
        allowance_type_id: allowance.allowance_type_id || null,
        custom_code: allowance.custom_code || null,
        custom_name: allowance.custom_name || null,
        calculation_type: allowance.calculation_type || 'fixed',
        amount: parseFloat(allowance.amount) || 0,
        percentage: parseFloat(allowance.percentage) || 0,
        is_taxable: allowance.is_taxable ?? true,
        is_subject_to_contributions: allowance.is_subject_to_contributions ?? true,
        start_date: allowance.start_date || new Date().toISOString().split('T')[0],
        end_date: allowance.end_date || null,
        is_active: true,
        notes: allowance.notes || null,
        created_by: allowance.created_by || null,
        updated_at: new Date().toISOString(),
      }

      if (allowance.id) {
        const { error } = await db()
          .from('employee_allowances')
          .update(payload)
          .eq('id', allowance.id)
        if (error) throw error
      } else {
        const { error } = await db()
          .from('employee_allowances')
          .insert({ ...payload, created_at: new Date().toISOString() })
        if (error) throw error
      }

      return true
    } catch (err) {
      console.error('Erreur sauvegarde prime récurrente:', err)
      return false
    }
  }

  static async deleteEmployeeAllowance(allowanceId) {
    try {
      const { error } = await db()
        .from('employee_allowances')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', allowanceId)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur suppression prime récurrente:', err)
      return false
    }
  }

  static async getAllowanceTypes(enterpriseId) {
    try {
      const { data, error } = await db()
        .from('allowance_types')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement types de primes:', err)
      return []
    }
  }

  static async saveAllowanceType(type) {
    try {
      const payload = {
        enterprise_id: type.enterprise_id,
        code: type.code,
        name: type.name,
        description: type.description || null,
        category: type.category || 'bonus',
        calculation_type: type.calculation_type || 'fixed',
        default_amount: parseFloat(type.default_amount) || 0,
        default_percentage: parseFloat(type.default_percentage) || 0,
        is_taxable: type.is_taxable ?? true,
        is_subject_to_contributions: type.is_subject_to_contributions ?? true,
        is_recurring: type.is_recurring ?? true,
        requires_justification: type.requires_justification ?? false,
        display_order: parseInt(type.display_order) || 0,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      const { error } = await db()
        .from('allowance_types')
        .upsert(payload, { onConflict: 'enterprise_id,code' })

      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur sauvegarde type prime:', err)
      return false
    }
  }

  static async getPayrollBonuses(enterpriseId, periodStart, periodEnd, employeeId = null) {
    try {
      let query = db()
        .from('payroll_bonuses')
        .select(`
          *,
          employees (id, first_name, last_name, matricule),
          allowance_types (id, code, name, category)
        `)
        .eq('enterprise_id', enterpriseId)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)

      if (employeeId) query = query.eq('employee_id', employeeId)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement primes ponctuelles:', err)
      return []
    }
  }

  static async savePayrollBonus(bonus) {
    try {
      const payload = {
        enterprise_id: bonus.enterprise_id,
        employee_id: bonus.employee_id,
        period_start: bonus.period_start,
        period_end: bonus.period_end,
        allowance_type_id: bonus.allowance_type_id || null,
        code: bonus.code,
        name: bonus.name,
        amount: parseFloat(bonus.amount) || 0,
        is_taxable: bonus.is_taxable ?? true,
        is_subject_to_contributions: bonus.is_subject_to_contributions ?? true,
        reason: bonus.reason || null,
        status: bonus.status || 'pending',
        created_by: bonus.created_by || null,
        updated_at: new Date().toISOString(),
      }

      if (bonus.id) {
        const { error } = await db()
          .from('payroll_bonuses')
          .update(payload)
          .eq('id', bonus.id)
        if (error) throw error
      } else {
        const { error } = await db()
          .from('payroll_bonuses')
          .insert({ ...payload, created_at: new Date().toISOString() })
        if (error) throw error
      }

      return true
    } catch (err) {
      console.error('Erreur sauvegarde prime ponctuelle:', err)
      return false
    }
  }

  static async deletePayrollBonus(bonusId) {
    try {
      const { error } = await db().from('payroll_bonuses').delete().eq('id', bonusId)
      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur suppression prime ponctuelle:', err)
      return false
    }
  }

  static async getDeductionTypes(enterpriseId) {
    try {
      const { data, error } = await db()
        .from('deduction_types')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement types de retenues:', err)
      return []
    }
  }

  static async saveDeductionType(type) {
    try {
      const payload = {
        enterprise_id: type.enterprise_id,
        code: type.code,
        name: type.name,
        description: type.description || null,
        category: type.category || 'other',
        calculation_type: type.calculation_type || 'fixed',
        default_amount: parseFloat(type.default_amount) || 0,
        is_recurring: type.is_recurring ?? false,
        is_priority: type.is_priority ?? false,
        max_percentage_of_net: type.max_percentage_of_net ? parseFloat(type.max_percentage_of_net) : null,
        display_order: parseInt(type.display_order) || 0,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      const { error } = await db()
        .from('deduction_types')
        .upsert(payload, { onConflict: 'enterprise_id,code' })

      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur sauvegarde type retenue:', err)
      return false
    }
  }

  static async getEmployeeDeductions(enterpriseId, employeeId = null) {
    try {
      let query = db()
        .from('employee_deductions')
        .select(`
          *,
          deduction_types (id, code, name, category),
          employees (id, first_name, last_name, matricule)
        `)
        .eq('enterprise_id', enterpriseId)
        .order('created_at', { ascending: false })

      if (employeeId) query = query.eq('employee_id', employeeId)

      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement retenues récurrentes:', err)
      return []
    }
  }

  static async getActiveDeductionsForPeriod(enterpriseId, employeeId, periodStart, periodEnd) {
    try {
      const { data, error } = await db()
        .from('employee_deductions')
        .select(`*, deduction_types(*)`)
        .eq('enterprise_id', enterpriseId)
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .eq('status', 'active')
        .lte('start_date', periodEnd)
        .or(`end_date.is.null,end_date.gte.${periodStart}`)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement retenues période:', err)
      return []
    }
  }

  static async saveEmployeeDeduction(deduction) {
    try {
      const payload = {
        enterprise_id: deduction.enterprise_id,
        employee_id: deduction.employee_id,
        deduction_type_id: deduction.deduction_type_id || null,
        code: deduction.code,
        name: deduction.name,
        calculation_type: deduction.calculation_type || 'fixed',
        monthly_amount: parseFloat(deduction.monthly_amount) || 0,
        total_amount: deduction.total_amount ? parseFloat(deduction.total_amount) : null,
        remaining_balance: deduction.remaining_balance
          ? parseFloat(deduction.remaining_balance)
          : deduction.total_amount
            ? parseFloat(deduction.total_amount)
            : null,
        interest_rate: parseFloat(deduction.interest_rate) || 0,
        max_percentage_of_net: deduction.max_percentage_of_net ? parseFloat(deduction.max_percentage_of_net) : null,
        beneficiary_name: deduction.beneficiary_name || null,
        beneficiary_account: deduction.beneficiary_account || null,
        start_date: deduction.start_date || new Date().toISOString().split('T')[0],
        end_date: deduction.end_date || null,
        status: deduction.status || 'active',
        is_active: true,
        notes: deduction.notes || null,
        document_url: deduction.document_url || null,
        created_by: deduction.created_by || null,
        updated_at: new Date().toISOString(),
      }

      if (deduction.id) {
        const { error } = await db()
          .from('employee_deductions')
          .update(payload)
          .eq('id', deduction.id)
        if (error) throw error
      } else {
        const { error } = await db()
          .from('employee_deductions')
          .insert({ ...payload, created_at: new Date().toISOString() })
        if (error) throw error
      }

      return true
    } catch (err) {
      console.error('Erreur sauvegarde retenue récurrente:', err)
      return false
    }
  }

  static async pauseResumeDeduction(deductionId, pause = true) {
    try {
      const { error } = await db()
        .from('employee_deductions')
        .update({
          status: pause ? 'paused' : 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', deductionId)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur pause/reprise retenue:', err)
      return false
    }
  }

  static async cancelDeduction(deductionId) {
    try {
      const { error } = await db()
        .from('employee_deductions')
        .update({
          status: 'cancelled',
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deductionId)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur annulation retenue:', err)
      return false
    }
  }

  static async getPayrollDeductions(enterpriseId, periodStart, periodEnd, employeeId = null) {
    try {
      let query = db()
        .from('payroll_deductions')
        .select(`
          *,
          employees (id, first_name, last_name, matricule),
          deduction_types (id, code, name, category)
        `)
        .eq('enterprise_id', enterpriseId)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)

      if (employeeId) query = query.eq('employee_id', employeeId)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement retenues ponctuelles:', err)
      return []
    }
  }

  static async savePayrollDeduction(deduction) {
    try {
      const payload = {
        enterprise_id: deduction.enterprise_id,
        employee_id: deduction.employee_id,
        period_start: deduction.period_start,
        period_end: deduction.period_end,
        deduction_type_id: deduction.deduction_type_id || null,
        code: deduction.code,
        name: deduction.name,
        amount: parseFloat(deduction.amount) || 0,
        employee_deduction_id: deduction.employee_deduction_id || null,
        reason: deduction.reason || null,
        created_by: deduction.created_by || null,
        created_at: new Date().toISOString(),
      }

      const { error } = await db().from('payroll_deductions').insert(payload)
      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur sauvegarde retenue ponctuelle:', err)
      return false
    }
  }

  static async deletePayrollDeduction(deductionId) {
    try {
      const { error } = await db().from('payroll_deductions').delete().eq('id', deductionId)
      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur suppression retenue ponctuelle:', err)
      return false
    }
  }

  static async getPayrollImportRows(enterpriseId, periodStart, periodEnd) {
    try {
      const { data, error } = await db()
        .from('payroll_import_rows')
        .select(`
          *,
          payroll_imports!inner (
            id, period_start, period_end
          )
        `)
        .eq('enterprise_id', enterpriseId)
        .eq('is_valid', true)
        .eq('payroll_imports.period_start', periodStart)
        .eq('payroll_imports.period_end', periodEnd)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erreur chargement lignes import paie:', err)
      return []
    }
  }

  static async getImportedVariablesMap(enterpriseId, periodStart, periodEnd) {
    const rows = await this.getPayrollImportRows(enterpriseId, periodStart, periodEnd)
    const map = new Map()
    rows.forEach(row => {
      if (row.employee_id) map.set(row.employee_id, row.data || {})
    })
    return map
  }

  static async loadPayrollSourceData(enterpriseId, periodStart, periodEnd) {
    try {
      const [
        employeesRes,
        attendancesRes,
        absencesRes,
        overtimeSettings,
        schedules,
        holidays,
      ] = await Promise.all([
        db()
          .from('employees')
          .select('id, enterprise_id, first_name, last_name, matricule, department, position, is_active, hire_date, cnps_number, professional_category, echelon, classification, contract_type')
          .eq('enterprise_id', enterpriseId)
          .eq('is_active', true)
          .order('last_name'),

        db()
          .from('attendances')
          .select('*')
          .eq('enterprise_id', enterpriseId)
          .gte('check_time', `${periodStart}T00:00:00`)
          .lte('check_time', `${periodEnd}T23:59:59`)
          .order('check_time', { ascending: true }),

        db()
          .from('absences')
          .select('*')
          .eq('enterprise_id', enterpriseId)
          .lte('start_date', periodEnd)
          .gte('end_date', periodStart)
          .eq('status', 'approuve'),

        FeatureService.getOvertimeSettings(enterpriseId),
        FeatureService.loadSchedules(enterpriseId),
        HolidayService.getHolidaysForRange(enterpriseId, periodStart, periodEnd),
      ])

      return {
        employees: employeesRes.data || [],
        attendances: attendancesRes.data || [],
        absences: absencesRes.data || [],
        overtimeSettings,
        schedules: schedules || [],
        holidays: holidays || [],
        holidaySet: HolidayService.buildHolidaySet(holidays || []),
        holidayMap: HolidayService.buildHolidayMap(holidays || []),
      }
    } catch (err) {
      console.error('Erreur chargement données source paie:', err)
      return {
        employees: [],
        attendances: [],
        absences: [],
        overtimeSettings: FeatureService.getDefaultOvertimeSettings(),
        schedules: [],
        holidays: [],
        holidaySet: new Set(),
        holidayMap: new Map(),
      }
    }
  }

  //  options.seuils : seuils de pointage (`encheck_reglages_pointage`). Aucun seuil
  //  n'est plus écrit en dur ici — voir src/services/seuilsPointage.js.
  static calculateWorkedMinutesByDay(employeeId, allAttendances, options = {}) {
    const APPARIEMENT_H =
      Number(options?.seuils?.appariementHeures) || SEUILS_PAR_DEFAUT.appariementHeures

    const empAttendances = (allAttendances || [])
      .filter(a => a.employee_id === employeeId)
      // ═══ doctrine arbitrage n°1 §4.1 : « on invente, on marque, on n'encaisse pas »
      // Une sortie ESTIMÉE (`is_auto_closed`) n'est pas un badge : elle ne doit
      // entrer dans un bulletin que validée par un humain (`estimation_validee_le`).
      // Une estimation remplacée par un vrai pointage, et un pointage neutralisé
      // comme double scan QR, sortent aussi du calcul.
      // AVANT : la clôture automatique payait jusqu'à 14 h par nuit oubliée, sans
      // qu'aucun humain ait jamais regardé la ligne.
      .filter(filtrerPointagesPayables)
      .sort((a, b) => new Date(a.check_time) - new Date(b.check_time))

    const dateSet = new Set(empAttendances.map(a => a.check_time.split('T')[0]))
    const dailyMinutes = {}

    dateSet.forEach(dateStr => {
      const startOfDay = new Date(`${dateStr}T00:00:00Z`)
      const endOfNextDay = new Date(startOfDay)
      endOfNextDay.setUTCDate(endOfNextDay.getUTCDate() + 1)
      endOfNextDay.setUTCHours(14, 0, 0, 0)

      const relevantAttendances = empAttendances.filter(att => {
        const t = new Date(att.check_time)
        return t >= startOfDay && t <= endOfNextDay
      })

      let totalSeconds = 0
      let currentIn = null
      let validPairs = []

      for (let i = 0; i < relevantAttendances.length; i++) {
        const pt = relevantAttendances[i]
        const ptDate = new Date(pt.check_time)
        const pointageDateStr = pt.check_time.split('T')[0]

        if (pt.check_type === 'in') {
          let isValidIn = false
          if (pointageDateStr === dateStr) {
            isValidIn = true
          } else if (validPairs.length > 0) {
            const lastOutTime = new Date(validPairs[validPairs.length - 1].out.check_time)
            const diffHours = (ptDate - lastOutTime) / (1000 * 60 * 60)
            if (diffHours < 8) isValidIn = true
          }
          currentIn = isValidIn ? pt : null
        } else if (pt.check_type === 'out' && currentIn) {
          const inDate = new Date(currentIn.check_time)
          const diffHours = (ptDate - inDate) / (1000 * 60 * 60)
          if (diffHours <= APPARIEMENT_H) {
            totalSeconds += (ptDate - inDate) / 1000
            validPairs.push({ in: currentIn, out: pt })
            currentIn = null
          }
        }
      }

      dailyMinutes[dateStr] = Math.round(totalSeconds / 60)
    })

    return dailyMinutes
  }

  static getEmployeeEnCheckData(
    employee,
    attendances,
    absences,
    overtimeSettings,
    schedules,
    holidaySet,
    holidayMap,
    periodStart,
    periodEnd
  ) {
    const employeeId = employee.id
    const enterpriseId = employee.enterprise_id
    const workedMinutesByDay = this.calculateWorkedMinutesByDay(employeeId, attendances)
    const allDaysWorked = Object.entries(workedMinutesByDay)

    let totalWorkedMinutes = 0
    let totalOvertimeNormalMinutes = 0
    let totalOvertimeMajorMinutes = 0
    let workedDays = 0
    let workedHolidayDays = 0
    let absencesDays = 0
    let congesDays = 0
    let maladieDays = 0
    let retardsCount = 0
    let retardsMinutes = 0
    let sundayMinutes = 0
    let holidayMinutes = 0

    const empAttendances = (attendances || []).filter(a => a.employee_id === employeeId)
    const empAbsences = (absences || []).filter(a => a.employee_id === employeeId)

    allDaysWorked.forEach(([dateStr, jourMinutes]) => {
      if (jourMinutes <= 0) return

      totalWorkedMinutes += jourMinutes
      workedDays++

      const isHoliday = holidaySet.has(dateStr)
      const holiday = holidayMap.get(dateStr) || null
      const isSunday = new Date(dateStr + 'T12:00:00Z').getUTCDay() === 0

      if (isHoliday && jourMinutes > 0) {
        workedHolidayDays++
        holidayMinutes += jourMinutes
      }

      if (isSunday && !isHoliday) {
        sundayMinutes += jourMinutes
      }

      const overtimeResult = FeatureService.calculateOvertimeForEmployeeDay({
        totalWorkedSeconds: jourMinutes * 60,
        employeeSchedule: null,
        enterpriseId,
        dateStr,
        allSchedules: schedules,
        overtimeSettings,
        holiday,
      })

      totalOvertimeNormalMinutes += Math.round((overtimeResult.overtimeSeconds || 0) / 60)
      totalOvertimeMajorMinutes += Math.round((overtimeResult.overtimeMajorSeconds || 0) / 60)
    })

    empAbsences.forEach(abs => {
      const days = HolidayService.countWorkingDays(abs.start_date, abs.end_date, holidaySet, true)
      absencesDays += days
      if (abs.reason === 'conge') congesDays += days
      if (abs.reason === 'maladie') maladieDays += days
    })

    const firstInsByDay = {}
    empAttendances
      .filter(a => a.check_type === 'in')
      .forEach(a => {
        const day = a.check_time.split('T')[0]
        if (!firstInsByDay[day]) firstInsByDay[day] = a
      })

    Object.entries(firstInsByDay).forEach(([day, att]) => {
      const schedule = FeatureService.getApplicableSchedule(enterpriseId, day, schedules)
      if (!schedule?.start_time) return

      const holiday = holidayMap.get(day)
      if (holiday && !holiday.is_worked) return

      // ⭐ LIVRAISON 04 : heures locales de l'entreprise (voir hoursCalculator.js)
      const minutesPointage = minutesDepuisMinuit(att.check_time)
      const [hA, mA] = schedule.start_time.split(':').map(Number)
      const tolerance = schedule.late_tolerance_minutes || 15

      const minutesArriveeBase = hA * 60 + mA
      const minutesArriveeMax = minutesArriveeBase + tolerance
      const retardMin = minutesPointage - minutesArriveeBase

      if (minutesPointage > minutesArriveeMax && retardMin > 0) {
        retardsCount++
        retardsMinutes += retardMin
      }
    })

    return {
      workedDays,
      workedHolidayDays,
      totalWorkedMinutes,
      totalOvertimeNormalMinutes,
      totalOvertimeMajorMinutes,
      totalOvertimeAllMinutes: totalOvertimeNormalMinutes + totalOvertimeMajorMinutes,
      sundayMinutes,
      holidayMinutes,
      absencesDays,
      congesDays,
      maladieDays,
      retardsCount,
      retardsMinutes,
      appliedRates: {
        rate_normal: overtimeSettings?.rate_normal ?? 25,
        rate_major: overtimeSettings?.rate_major ?? 50,
        rate_sunday: overtimeSettings?.rate_sunday ?? 100,
        rate_holiday: overtimeSettings?.rate_holiday ?? 100,
        overtime_major_after_hours: overtimeSettings?.overtime_major_after_hours ?? 2,
      },
    }
  }

  static calculateOvertimePay(enCheckData, baseSalary, settings, overtimeSettings) {
    const hourlyDivisor = this.safeNumber(settings.hourly_divisor) || 173.33
    const hourlyRate = baseSalary / hourlyDivisor

    const rateNormal = (overtimeSettings?.rate_normal ?? 25) / 100
    const rateMajor = (overtimeSettings?.rate_major ?? 50) / 100
    const rateSunday = (overtimeSettings?.rate_sunday ?? 100) / 100
    const rateHoliday = (overtimeSettings?.rate_holiday ?? 100) / 100

    const overtimeNormalHours = (enCheckData.totalOvertimeNormalMinutes || 0) / 60
    const overtimeMajorHours = (enCheckData.totalOvertimeMajorMinutes || 0) / 60
    const sundayHours = (enCheckData.sundayMinutes || 0) / 60
    const holidayHours = (enCheckData.holidayMinutes || 0) / 60

    const overtimeNormalPay = Math.round(overtimeNormalHours * hourlyRate * (1 + rateNormal))
    const overtimeMajorPay = Math.round(overtimeMajorHours * hourlyRate * (1 + rateMajor))
    const sundayPay = Math.round(sundayHours * hourlyRate * (1 + rateSunday))
    const holidayPay = Math.round(holidayHours * hourlyRate * (1 + rateHoliday))

    const lines = []

    if (overtimeNormalPay > 0) {
      lines.push({
        code: 'overtime_normal',
        label: `Heures sup. normales (${Math.floor(overtimeNormalHours)}h${Math.round((overtimeNormalHours % 1) * 60).toString().padStart(2, '0')} × +${overtimeSettings?.rate_normal ?? 25}%)`,
        amount: overtimeNormalPay,
        hours: overtimeNormalHours,
        rate: overtimeSettings?.rate_normal ?? 25,
        source: 'encheck',
      })
    }

    if (overtimeMajorPay > 0) {
      lines.push({
        code: 'overtime_major',
        label: `Heures sup. majorées (${Math.floor(overtimeMajorHours)}h${Math.round((overtimeMajorHours % 1) * 60).toString().padStart(2, '0')} × +${overtimeSettings?.rate_major ?? 50}%)`,
        amount: overtimeMajorPay,
        hours: overtimeMajorHours,
        rate: overtimeSettings?.rate_major ?? 50,
        source: 'encheck',
      })
    }

    if (sundayPay > 0) {
      lines.push({
        code: 'overtime_sunday',
        label: `Travail dimanche (${Math.floor(sundayHours)}h${Math.round((sundayHours % 1) * 60).toString().padStart(2, '0')} × +${overtimeSettings?.rate_sunday ?? 100}%)`,
        amount: sundayPay,
        hours: sundayHours,
        rate: overtimeSettings?.rate_sunday ?? 100,
        source: 'encheck',
      })
    }

    if (holidayPay > 0) {
      lines.push({
        code: 'overtime_holiday',
        label: `Travail jour férié (${Math.floor(holidayHours)}h${Math.round((holidayHours % 1) * 60).toString().padStart(2, '0')} × +${overtimeSettings?.rate_holiday ?? 100}%)`,
        amount: holidayPay,
        hours: holidayHours,
        rate: overtimeSettings?.rate_holiday ?? 100,
        source: 'encheck',
      })
    }

    const totalPay = overtimeNormalPay + overtimeMajorPay + sundayPay + holidayPay
    return { lines, totalPay }
  }

  static calculateHourlySalary(profile, enCheckData, overtimeSettings) {
    const hourlyRate = this.safeNumber(profile.hourly_rate)
    if (hourlyRate <= 0) return { earnings: [], total: 0 }

    const rateNormal = (overtimeSettings?.rate_normal ?? 25) / 100
    const rateMajor = (overtimeSettings?.rate_major ?? 50) / 100
    const rateSunday = (overtimeSettings?.rate_sunday ?? 100) / 100
    const rateHoliday = (overtimeSettings?.rate_holiday ?? 100) / 100

    const regularHours = Math.max(0, (enCheckData.totalWorkedMinutes - enCheckData.totalOvertimeAllMinutes) / 60)
    const overtimeNormalHours = (enCheckData.totalOvertimeNormalMinutes || 0) / 60
    const overtimeMajorHours = (enCheckData.totalOvertimeMajorMinutes || 0) / 60
    const sundayHours = (enCheckData.sundayMinutes || 0) / 60
    const holidayHours = (enCheckData.holidayMinutes || 0) / 60

    const earnings = []
    let total = 0

    const regularPay = Math.round(regularHours * hourlyRate)
    if (regularPay > 0) {
      earnings.push({
        code: 'regular_hours',
        label: `Heures normales (${Math.floor(regularHours)}h${Math.round((regularHours % 1) * 60).toString().padStart(2, '0')})`,
        amount: regularPay,
        source: 'encheck',
      })
      total += regularPay
    }

    const otNormalPay = Math.round(overtimeNormalHours * hourlyRate * (1 + rateNormal))
    if (otNormalPay > 0) {
      earnings.push({
        code: 'overtime_normal_hours',
        label: `Heures sup. (+${overtimeSettings?.rate_normal ?? 25}%) — ${Math.floor(overtimeNormalHours)}h${Math.round((overtimeNormalHours % 1) * 60).toString().padStart(2, '0')}`,
        amount: otNormalPay,
        source: 'encheck',
      })
      total += otNormalPay
    }

    const otMajorPay = Math.round(overtimeMajorHours * hourlyRate * (1 + rateMajor))
    if (otMajorPay > 0) {
      earnings.push({
        code: 'overtime_major_hours',
        label: `Heures sup. majorées (+${overtimeSettings?.rate_major ?? 50}%) — ${Math.floor(overtimeMajorHours)}h${Math.round((overtimeMajorHours % 1) * 60).toString().padStart(2, '0')}`,
        amount: otMajorPay,
        source: 'encheck',
      })
      total += otMajorPay
    }

    const sundayPay = Math.round(sundayHours * hourlyRate * (1 + rateSunday))
    if (sundayPay > 0) {
      earnings.push({
        code: 'sunday_hours',
        label: `Heures dimanche (+${overtimeSettings?.rate_sunday ?? 100}%) — ${Math.floor(sundayHours)}h${Math.round((sundayHours % 1) * 60).toString().padStart(2, '0')}`,
        amount: sundayPay,
        source: 'encheck',
      })
      total += sundayPay
    }

    const holidayPay = Math.round(holidayHours * hourlyRate * (1 + rateHoliday))
    if (holidayPay > 0) {
      earnings.push({
        code: 'holiday_hours',
        label: `Heures jours fériés (+${overtimeSettings?.rate_holiday ?? 100}%) — ${Math.floor(holidayHours)}h${Math.round((holidayHours % 1) * 60).toString().padStart(2, '0')}`,
        amount: holidayPay,
        source: 'encheck',
      })
      total += holidayPay
    }

    return { earnings, total }
  }

  static calculateDailySalary(profile, enCheckData, overtimeSettings, currency = null) {
    const dailyRate = this.safeNumber(profile.daily_rate)
    if (dailyRate <= 0) return { earnings: [], total: 0 }

    const rateHoliday = (overtimeSettings?.rate_holiday ?? 100) / 100
    const workedDays = enCheckData.workedDays || 0
    const workedHolidayDays = enCheckData.workedHolidayDays || 0
    const regularDays = Math.max(0, workedDays - workedHolidayDays)

    const earnings = []
    let total = 0

    const regularPay = Math.round(regularDays * dailyRate)
    if (regularPay > 0) {
      earnings.push({
        code: 'regular_days',
        label: `Jours travaillés (${regularDays} j × ${this.formatMoney(dailyRate, currency)})`,
        amount: regularPay,
        source: 'encheck',
      })
      total += regularPay
    }

    const holidayDayPay = Math.round(workedHolidayDays * dailyRate * (1 + rateHoliday))
    if (holidayDayPay > 0) {
      earnings.push({
        code: 'holiday_days',
        label: `Jours fériés travaillés (+${overtimeSettings?.rate_holiday ?? 100}%) — ${workedHolidayDays} j`,
        amount: holidayDayPay,
        source: 'encheck',
      })
      total += holidayDayPay
    }

    return { earnings, total }
  }

  static calculateAllowanceAmount(allowance, baseSalary) {
    const calcType = allowance.calculation_type || 'fixed'
    if (calcType === 'fixed') return this.safeNumber(allowance.amount)
    if (calcType === 'percentage') return Math.round(baseSalary * (this.safeNumber(allowance.percentage) / 100))
    if (calcType === 'per_day') return this.safeNumber(allowance.amount)
    return this.safeNumber(allowance.amount)
  }

  static safeNumber(value) {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }

  static formatMoney(amount, currency = null, options = {}) {
    // Délègue au service devise : jamais d'unité inventée, gestion des
    // décimales (€ = 2, FCFA = 0) et affichage optionnel du code ISO.
    return CurrencyService.format(amount, currency, options)
  }

  static async buildPayrollSlip({
    employee,
    profile,
    settings,
    enCheckData,
    importedData = {},
    periodStart,
    periodEnd,
    overtimeSettings = null,
    recurringAllowances = [],
    periodBonuses = [],
    recurringDeductions = [],
    periodDeductions = [],
  }) {
    try {
      const salaryType = profile?.salary_type || 'monthly'
      const earnings = []
      const deductions = []
      let grossSalary = 0

      if (salaryType === 'monthly') {
        const baseSalary = this.safeNumber(profile?.base_salary)
        grossSalary += baseSalary

        earnings.push({
          code: 'base_salary',
          label: 'Salaire de base',
          amount: baseSalary,
          source: 'profile',
        })

        const transportAllowance = this.safeNumber(profile?.transport_allowance)
        const housingAllowance = this.safeNumber(profile?.housing_allowance)
        const fixedBonus = this.safeNumber(profile?.fixed_bonus)

        if (transportAllowance > 0) {
          earnings.push({
            code: 'transport_allowance',
            label: 'Indemnité transport',
            amount: transportAllowance,
            source: 'profile',
          })
          grossSalary += transportAllowance
        }

        if (housingAllowance > 0) {
          earnings.push({
            code: 'housing_allowance',
            label: 'Prime logement',
            amount: housingAllowance,
            source: 'profile',
          })
          grossSalary += housingAllowance
        }

        if (fixedBonus > 0) {
          earnings.push({
            code: 'fixed_bonus',
            label: 'Prime fixe',
            amount: fixedBonus,
            source: 'profile',
          })
          grossSalary += fixedBonus
        }

        if (settings.include_overtime_in_payroll && enCheckData?.totalOvertimeAllMinutes > 0) {
          const { lines, totalPay } = this.calculateOvertimePay(enCheckData, baseSalary, settings, overtimeSettings)
          earnings.push(...lines)
          grossSalary += totalPay
        }
      } else if (salaryType === 'hourly') {
        const { earnings: hourlyEarnings, total: hourlyTotal } = this.calculateHourlySalary(profile, enCheckData, overtimeSettings)
        earnings.push(...hourlyEarnings)
        grossSalary += hourlyTotal

        const minGuaranteed = this.safeNumber(profile?.min_guaranteed_hours) * this.safeNumber(profile?.hourly_rate)
        if (minGuaranteed > grossSalary && minGuaranteed > 0) {
          const diff = minGuaranteed - grossSalary
          earnings.push({
            code: 'guaranteed_minimum',
            label: 'Complément minimum garanti',
            amount: Math.round(diff),
            source: 'profile',
          })
          grossSalary = minGuaranteed
        }
      } else if (salaryType === 'daily') {
        const { earnings: dailyEarnings, total: dailyTotal } = this.calculateDailySalary(profile, enCheckData, overtimeSettings, CurrencyService.resolveCurrency({ settings }))
        earnings.push(...dailyEarnings)
        grossSalary += dailyTotal
      }

      const baseSalaryForCalculations = salaryType === 'monthly'
        ? this.safeNumber(profile?.base_salary)
        : grossSalary

      recurringAllowances.forEach(allowance => {
        const amount = this.calculateAllowanceAmount(allowance, baseSalaryForCalculations)
        if (amount > 0) {
          const name = allowance.allowance_types?.name || allowance.custom_name || 'Prime'
          earnings.push({
            code: `allowance_${allowance.id}`,
            label: name,
            amount,
            source: 'recurring_allowance',
            allowance_id: allowance.id,
            is_taxable: allowance.is_taxable,
          })
          grossSalary += amount
        }
      })

      periodBonuses.forEach(bonus => {
        if (bonus.amount > 0) {
          earnings.push({
            code: `bonus_${bonus.id}`,
            label: bonus.name,
            amount: this.safeNumber(bonus.amount),
            source: 'period_bonus',
            bonus_id: bonus.id,
            is_taxable: bonus.is_taxable,
            reason: bonus.reason,
          })
          grossSalary += this.safeNumber(bonus.amount)
        }
      })

      if (settings.use_imported_variables && importedData && Object.keys(importedData).length > 0) {
        Object.entries(importedData).forEach(([key, value]) => {
          const amount = this.safeNumber(value)
          if (amount > 0) {
            earnings.push({
              code: `imported_${key}`,
              label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              amount,
              source: 'imported',
            })
            grossSalary += amount
          } else if (amount < 0) {
            deductions.push({
              code: `imported_${key}`,
              label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              amount: Math.abs(amount),
              source: 'imported',
            })
          }
        })
      }

      const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0)

      const taxCalculation = await TaxationService.calculateDetailedPayslip(
        employee.enterprise_id,
        employee,
        profile,
        grossSalary
      )

      const fixedDeduction = salaryType === 'monthly' ? this.safeNumber(profile?.fixed_deduction) : 0

      if (fixedDeduction > 0) {
        deductions.push({
          code: 'fixed_deduction',
          label: 'Retenue fixe',
          amount: fixedDeduction,
          source: 'profile',
        })
      }

      if (taxCalculation.contributions?.employee) {
        taxCalculation.contributions.employee.forEach(contrib => {
          deductions.push({
            code: contrib.code,
            label: contrib.name,
            amount: contrib.amount,
            source: 'contribution',
            details: {
              base: contrib.base,
              rate: contrib.rate,
              is_mandatory: contrib.is_mandatory,
            },
          })
        })
      }

      if (taxCalculation.tax?.totalTax > 0) {
        deductions.push({
          code: 'income_tax',
          label: 'Impôt sur le Revenu (IRPP)',
          amount: taxCalculation.tax.totalTax,
          source: 'tax',
          details: {
            taxable_income: taxCalculation.taxableIncome,
            effective_rate: taxCalculation.tax.effectiveRate,
            brackets: taxCalculation.tax.details,
          },
        })
      }

      if (settings.deduct_absence && enCheckData?.absencesDays > 0 && salaryType === 'monthly') {
        const dailyRate = baseSalaryForCalculations / (this.safeNumber(settings.working_days_divisor) || 22)
        const absenceDeduction = Math.round(dailyRate * enCheckData.absencesDays)
        if (absenceDeduction > 0) {
          deductions.push({
            code: 'absence_deduction',
            label: `Absence (${enCheckData.absencesDays} jour${enCheckData.absencesDays > 1 ? 's' : ''})`,
            amount: absenceDeduction,
            source: 'encheck',
          })
        }
      }

      if (settings.deduct_late && enCheckData?.retardsMinutes > 0 && salaryType === 'monthly') {
        const hourlyRate = baseSalaryForCalculations / (this.safeNumber(settings.hourly_divisor) || 173.33)
        const lateDeduction = Math.round((enCheckData.retardsMinutes / 60) * hourlyRate)
        if (lateDeduction > 0) {
          deductions.push({
            code: 'late_deduction',
            label: `Retards (${enCheckData.retardsMinutes} min)`,
            amount: lateDeduction,
            source: 'encheck',
          })
        }
      }

      recurringDeductions.forEach(ded => {
        let amount = this.safeNumber(ded.monthly_amount)

        if (ded.calculation_type === 'remaining' && ded.remaining_balance !== null) {
          amount = Math.min(amount, this.safeNumber(ded.remaining_balance))
        }

        if (ded.max_percentage_of_net) {
          const maxAmount = Math.round(grossSalary * (this.safeNumber(ded.max_percentage_of_net) / 100))
          amount = Math.min(amount, maxAmount)
        }

        if (amount > 0) {
          deductions.push({
            code: `deduction_${ded.id}`,
            label: ded.name,
            amount: Math.round(amount),
            source: 'recurring_deduction',
            deduction_id: ded.id,
            category: ded.deduction_types?.category || 'other',
            details: {
              total_amount: ded.total_amount,
              remaining_balance: ded.remaining_balance,
              monthly_amount: ded.monthly_amount,
              beneficiary: ded.beneficiary_name,
            },
          })
        }
      })

      periodDeductions.forEach(ded => {
        if (ded.amount > 0) {
          deductions.push({
            code: `period_deduction_${ded.id}`,
            label: ded.name,
            amount: this.safeNumber(ded.amount),
            source: 'period_deduction',
            deduction_id: ded.id,
            reason: ded.reason,
          })
        }
      })

      const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0)
      const netSalary = Math.max(0, grossSalary - totalDeductions)
      const employerContributions = taxCalculation.contributions?.totalEmployer || 0

      return {
        employee: {
          id: employee.id,
          matricule: employee.matricule,
          first_name: employee.first_name,
          last_name: employee.last_name,
          department: employee.department,
          position: employee.position,
          enterprise_id: employee.enterprise_id,
          hire_date: employee.hire_date,
          cnps_number: employee.cnps_number,
          professional_category: employee.professional_category,
          echelon: employee.echelon,
          classification: employee.classification,
          contract_type: employee.contract_type,
        },
        profile: {
          salary_type: salaryType,
          base_salary: this.safeNumber(profile?.base_salary),
          hourly_rate: this.safeNumber(profile?.hourly_rate),
          daily_rate: this.safeNumber(profile?.daily_rate),
          transport_allowance: this.safeNumber(profile?.transport_allowance),
          housing_allowance: this.safeNumber(profile?.housing_allowance),
          fixed_bonus: this.safeNumber(profile?.fixed_bonus),
          fixed_deduction: fixedDeduction,
          payment_method: profile?.payment_method,
          mobile_money_provider: profile?.mobile_money_provider,
          mobile_money_number: profile?.mobile_money_number,
          bank_name: profile?.bank_name,
          bank_account: profile?.bank_account,
          iban: profile?.iban,
        },

        grossSalary: Math.round(grossSalary),
        netSalary: Math.round(netSalary),
        totalEarnings: Math.round(totalEarnings),
        totalDeductions: Math.round(totalDeductions),
        employerCost: Math.round(grossSalary + employerContributions),

        earnings,
        deductions,

        taxation: {
          contributions: taxCalculation.contributions,
          tax: taxCalculation.tax,
          taxableIncome: taxCalculation.taxableIncome,
          config: taxCalculation.config,
        },

        // ═══════════════════════════════════════════════════════════════════
        // CF-2 / VD-15 — PROPAGATION DU FILET DE CONFORMITÉ FISCALE
        // ═══════════════════════════════════════════════════════════════════
        // POURQUOI : TaxationService.calculateDetailedPayslip() retourne
        // `impot_a_verifier`, `avertissement`, `fiscal_parts` et
        // `parts_non_renseignees`, et TaxationService.verifierAvantRemise(bulletin)
        // lit `bulletin.impot_a_verifier` à la racine du bulletin. Sans cette
        // propagation, un bulletin généré par PayrollService perdait son drapeau
        // « PROVISOIRE » et contournait verifierAvantRemise().
        impot_a_verifier: taxCalculation.impot_a_verifier === true,
        avertissement: taxCalculation.avertissement || null,
        fiscal_parts: taxCalculation.fiscal_parts ?? 1,
        parts_non_renseignees: taxCalculation.parts_non_renseignees === true,

        sources: {
          encheck: enCheckData || {},
          imported: importedData || {},
          overtimeSettings: enCheckData?.appliedRates || {},
        },

        periodStart,
        periodEnd,
        generatedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Erreur buildPayrollSlip:', error)

      const baseSalary = this.safeNumber(profile?.base_salary)
      const fixedDeduction = this.safeNumber(profile?.fixed_deduction)

      // ⚠️ PIÈGE CORRIGÉ (CF-2 / VD-15) : en cas d'échec du calcul fiscal,
      // ce repli renvoie un bulletin sans impôt ni cotisations sociales. Il
      // DOIT obligatoirement porter `impot_a_verifier: true` et un
      // avertissement explicite pour que verifierAvantRemise() bloque toute
      // remise ou impression officielle.
      return {
        employee: {
          id: employee.id,
          matricule: employee.matricule,
          first_name: employee.first_name,
          last_name: employee.last_name,
          department: employee.department,
          position: employee.position,
          enterprise_id: employee.enterprise_id,
        },
        profile: { salary_type: profile?.salary_type || 'monthly', base_salary: baseSalary },
        grossSalary: baseSalary,
        netSalary: baseSalary - fixedDeduction,
        totalEarnings: baseSalary,
        totalDeductions: fixedDeduction,
        earnings: [{ code: 'base_salary', label: 'Salaire de base', amount: baseSalary, source: 'profile' }],
        deductions: fixedDeduction > 0
          ? [{ code: 'fixed_deduction', label: 'Retenue fixe', amount: fixedDeduction, source: 'profile' }]
          : [],
        taxation: null,
        impot_a_verifier: true,
        avertissement:
          '⚠️ Calcul fiscal incomplet (' + (error?.message || 'erreur inconnue') + '). '
          + 'Ce bulletin ne contient ni impôt ni cotisations sociales et ne doit pas être remis au salarié.',
        sources: {},
        periodStart,
        periodEnd,
        error: 'Calcul fiscal incomplet',
      }
    }
  }

  static getSocialOrganizationLabel(countryCode) {
    const map = {
      CMR: 'CNPS',
      CIV: 'CNPS',
      SEN: 'IPRES / CSS',
      MLI: 'INPS',
      BFA: 'CNSS',
      BEN: 'CNSS',
      TGO: 'CNSS',
      GAB: 'CNSS',
      COG: 'CNSS',
      COD: 'CNSS',
      FRA: 'Sécurité sociale',
    }
    return map[countryCode] || 'Organisme social'
  }

  static getImageFormatFromUrl(url) {
    if (!url) return 'PNG'
    const lower = url.toLowerCase()
    if (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('image/jpeg')) return 'JPEG'
    if (lower.includes('.webp') || lower.includes('image/webp')) return 'WEBP'
    return 'PNG'
  }

  static async loadImageAsBase64(url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error('URL vide'))
        return
      }

      if (url.startsWith('data:image')) {
        resolve(url)
        return
      }

      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width
          canvas.height = img.naturalHeight || img.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        } catch (err) {
          reject(err)
        }
      }

      img.onerror = () => reject(new Error(`Impossible de charger l'image: ${url}`))
      img.src = url
    })
  }

  static async generatePayrollSlipPDF(
    slip,
    settings,
    enterpriseName,
    periodStart,
    periodEnd,
    enterpriseData = null,
    annualCumuls = null,
    leaveBalance = null
  ) {
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 14
      let yPos = 12
      // Lève une erreur explicite plutôt que de produire un bulletin faux.
      const currency = CurrencyService.requireCurrency({
        enterprise: enterpriseData || slip?.details?.enterprise_data,
        settings,
      })

      // (variable non utilisée aujourd'hui : plus de repli 'CMR' silencieux)
      const countryCode =
        enterpriseData?.country_code ||
        slip?.details?.enterprise_data?.country_code ||
        null

      const socialOrgLabel = this.getSocialLabel(settings)

      let logoLoaded = false
      const logoUrl = enterpriseData?.logo_url || slip?.details?.enterprise_data?.logo_url || ''

      if (logoUrl) {
        try {
          const logoBase64 = await this.loadImageAsBase64(logoUrl)
          const logoFormat = this.getImageFormatFromUrl(logoUrl)
          doc.addImage(logoBase64, logoFormat, margin, yPos, 28, 14, undefined, 'FAST')
          logoLoaded = true
        } catch (err) {
          console.warn('Logo non chargé:', err.message)
        }
      }

      const headerX = logoLoaded ? margin + 34 : margin

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(20, 20, 35)
      doc.text(enterpriseName || 'Entreprise', headerX, yPos + 5)

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)

      let infoY = yPos + 10
      const address = enterpriseData?.address || slip?.details?.enterprise_data?.address
      const email = enterpriseData?.email || slip?.details?.enterprise_data?.email
      const phone = enterpriseData?.phone || slip?.details?.enterprise_data?.phone

      if (address) {
        const addrLines = doc.splitTextToSize(address, pageWidth - headerX - margin)
        doc.text(addrLines, headerX, infoY)
        infoY += addrLines.length * 4
      }

      if (email || phone) {
        const contact = [email, phone].filter(Boolean).join(' • ')
        doc.text(contact, headerX, infoY)
        infoY += 4
      }

      const infoParts = []
      if (settings.company_rccm) infoParts.push(`RCCM: ${settings.company_rccm}`)
      if (settings.company_nif) infoParts.push(`NIF: ${settings.company_nif}`)
      if (settings.company_cnps_number) {
  if (socialOrgLabel) {
    infoParts.push(`${socialOrgLabel}: ${settings.company_cnps_number}`)
  } else {
    infoParts.push(`${settings.company_cnps_number}`)
  }
}

      if (infoParts.length > 0) {
        const infoLines = doc.splitTextToSize(infoParts.join(' • '), pageWidth - headerX - margin)
        doc.text(infoLines, headerX, infoY)
        infoY += infoLines.length * 4
      }

      if (settings.company_collective_agreement) {
        const ccLines = doc.splitTextToSize(`Convention collective: ${settings.company_collective_agreement}`, pageWidth - headerX - margin)
        doc.text(ccLines, headerX, infoY)
        infoY += ccLines.length * 4
      }

      yPos = Math.max(yPos + 18, infoY + 2)

      if (settings.company_header) {
        doc.setFillColor(248, 249, 251)
        const headerLines = doc.splitTextToSize(settings.company_header, pageWidth - 2 * margin - 8)
        const blockHeight = headerLines.length * 4 + 8
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, blockHeight, 2, 2, 'F')
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(90, 90, 90)
        doc.text(headerLines, margin + 4, yPos + 5)
        yPos += blockHeight + 5
      }

      const isProvisional = Boolean(
        slip?.impot_a_verifier === true ||
        slip?.taxation?.impot_a_verifier === true ||
        slip?.details?.taxation?.impot_a_verifier === true
      )
      const provisionalWarning =
        slip?.avertissement ||
        slip?.taxation?.avertissement ||
        slip?.details?.taxation?.avertissement ||
        '⚠️ Barème fiscal à vérifier par votre comptable avant remise officielle au salarié.'

      doc.setFillColor(isProvisional ? 217 : 245, isProvisional ? 119 : 158, isProvisional ? 6 : 11)
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, 'F')
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(
        isProvisional
          ? `BULLETIN PROVISOIRE (À VÉRIFIER)  ·  ${currency}`
          : `BULLETIN DE PAIE  ·  ${currency}`,
        pageWidth / 2,
        yPos + 7,
        { align: 'center' }
      )
      yPos += 13

      if (isProvisional) {
        doc.setFillColor(254, 243, 199)
        doc.setDrawColor(245, 158, 11)
        const warnLines = doc.splitTextToSize(provisionalWarning, pageWidth - 2 * margin - 8)
        const warnHeight = warnLines.length * 3.8 + 6
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, warnHeight, 2, 2, 'FD')
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(146, 64, 14)
        doc.text(warnLines, margin + 4, yPos + 4.5)
        yPos += warnHeight + 4
      }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      const periodLabel = new Date(periodStart + 'T12:00:00Z').toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
      doc.text(`Période : ${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 8

      doc.setFillColor(245, 245, 248)
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 34, 3, 3, 'F')

      const empColWidth = (pageWidth - 2 * margin) / 2
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(20, 20, 35)
      doc.text(`${slip.employee.first_name} ${slip.employee.last_name}`, margin + 5, yPos + 7)

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text(`Matricule : ${slip.employee.matricule || '—'}`, margin + 5, yPos + 13)
      doc.text(`Poste : ${slip.employee.position || 'Employé'}`, margin + 5, yPos + 18)
      doc.text(`Département : ${slip.employee.department || '—'}`, margin + 5, yPos + 23)

      if (slip.employee.hire_date) {
        const hireDate = new Date(slip.employee.hire_date).toLocaleDateString('fr-FR')
        doc.text(`Embauche : ${hireDate}`, margin + 5, yPos + 28)
      }

      const rightColX = margin + empColWidth + 5
      const modeLabels = { monthly: 'Mensuel', hourly: 'Horaire', daily: 'Journalier' }
      const modeLabel = modeLabels[slip.profile?.salary_type] || 'Mensuel'
      doc.text(`Mode : ${modeLabel}`, rightColX, yPos + 8)

      if (slip.employee.cnps_number) {
  const employeeSocialText = socialOrgLabel
    ? `${socialOrgLabel} salarié : ${slip.employee.cnps_number}`
    : `${slip.employee.cnps_number}`

  doc.text(employeeSocialText, rightColX, yPos + 13)
}
      if (slip.employee.classification) {
        doc.text(`Classification : ${slip.employee.classification}`, rightColX, yPos + 18)
      }
      if (slip.employee.professional_category) {
        doc.text(`Catégorie : ${slip.employee.professional_category}`, rightColX, yPos + 23)
      }
      if (slip.sources?.encheck?.workedDays !== undefined) {
        doc.text(`Jours travaillés : ${slip.sources.encheck.workedDays}`, rightColX, yPos + 28)
      }

      yPos += 40

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(16, 185, 129)
      doc.text('GAINS', margin, yPos)
      yPos += 5
      doc.setDrawColor(16, 185, 129)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 5

      slip.earnings.forEach(earning => {
        if (yPos > pageHeight - 70) {
          doc.addPage()
          yPos = 20
        }
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text(earning.label, margin + 2, yPos)
        doc.setTextColor(16, 185, 129)
        doc.text(this.formatMoney(earning.amount, currency), pageWidth - margin - 2, yPos, { align: 'right' })
        yPos += 5
      })

      yPos += 2
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 5

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(20, 20, 35)
      doc.text('Salaire brut', margin + 2, yPos)
      doc.text(this.formatMoney(slip.grossSalary, currency), pageWidth - margin - 2, yPos, { align: 'right' })
      yPos += 10

      if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20 }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(239, 68, 68)
      doc.text('RETENUES', margin, yPos)
      yPos += 5
      doc.setDrawColor(239, 68, 68)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 5

      if (slip.deductions && slip.deductions.length > 0) {
        slip.deductions.forEach(deduction => {
          if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20 }

          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(60, 60, 60)
          doc.text(deduction.label, margin + 2, yPos)
          doc.setTextColor(239, 68, 68)
          doc.text(`- ${this.formatMoney(deduction.amount, currency)}`, pageWidth - margin - 2, yPos, { align: 'right' })
          yPos += 5

          if (deduction.source === 'contribution' && deduction.details?.rate) {
            doc.setFontSize(7)
            doc.setTextColor(130, 130, 130)
            doc.text(`  Base : ${this.formatMoney(deduction.details.base, currency)} × ${deduction.details.rate}%`, margin + 6, yPos)
            yPos += 4
          }

          if (deduction.source === 'recurring_deduction' && deduction.details?.remaining_balance) {
            doc.setFontSize(7)
            doc.setTextColor(130, 130, 130)
            const newBalance = Math.max(0, deduction.details.remaining_balance - deduction.amount)
            doc.text(`  Solde restant : ${this.formatMoney(newBalance, currency)}`, margin + 6, yPos)
            yPos += 4
          }
        })
      } else {
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text('Aucune retenue', margin + 2, yPos)
        yPos += 5
      }

      yPos += 5

      if (yPos > pageHeight - 45) { doc.addPage(); yPos = 20 }
      doc.setFillColor(16, 185, 129)
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 14, 3, 3, 'F')
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('NET À PAYER', margin + 6, yPos + 9)
      doc.text(this.formatMoney(slip.netSalary, currency), pageWidth - margin - 6, yPos + 9, { align: 'right' })
      yPos += 20

      if (slip.taxation) {
        if (yPos > pageHeight - 50) { doc.addPage(); yPos = 20 }

        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(139, 92, 246)
        doc.text('RÉCAPITULATIF FISCAL', margin, yPos)
        yPos += 5
        doc.setDrawColor(139, 92, 246)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 5

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(80, 80, 80)

        const fiscalItems = [
          ['Salaire brut', this.formatMoney(slip.grossSalary, currency)],
          ['Cotisations salariales', `- ${this.formatMoney(slip.taxation.contributions?.totalEmployee || 0, currency)}`],
          ['Net imposable', this.formatMoney((slip.grossSalary || 0) - (slip.taxation.contributions?.totalEmployee || 0), currency)],
          ['Impôt (IRPP)', `- ${this.formatMoney(slip.taxation.tax?.totalTax || 0, currency)}`],
          ['Taux effectif', `${slip.taxation.tax?.effectiveRate || 0}%`],
        ]

        fiscalItems.forEach(([label, value]) => {
          doc.text(label, margin + 2, yPos)
          doc.text(value, pageWidth - margin - 2, yPos, { align: 'right' })
          yPos += 5
        })

        if (slip.taxation.contributions?.totalEmployer > 0) {
          yPos += 2
          doc.setTextColor(100, 100, 100)
          doc.text('Cotisations patronales (info)', margin + 2, yPos)
          doc.text(this.formatMoney(slip.taxation.contributions.totalEmployer, currency), pageWidth - margin - 2, yPos, { align: 'right' })
          yPos += 5
        }

        yPos += 5
      }

      const cumuls = annualCumuls || slip?.details?.annual_cumuls
      if (cumuls && cumuls.slipCount > 0) {
        if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20 }

        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(245, 158, 11)
        doc.text(`CUMULS ANNUELS (${cumuls.slipCount} mois)`, margin, yPos)
        yPos += 5
        doc.setDrawColor(245, 158, 11)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 5

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(80, 80, 80)

        const cumulItems = [
          [`Brut cumulé`, this.formatMoney(cumuls.grossTotal, currency)],
          [`Net cumulé`, this.formatMoney(cumuls.netTotal, currency)],
          [`Cotisations cumulées`, this.formatMoney(cumuls.employeeContribTotal, currency)],
          [`Impôt cumulé`, this.formatMoney(cumuls.taxTotal, currency)],
        ]

        const colWidth = (pageWidth - 2 * margin) / 2
        cumulItems.forEach((item, index) => {
          const col = index % 2
          const row = Math.floor(index / 2)
          const x = margin + col * colWidth + 2
          const y = yPos + row * 5
          doc.text(`${item[0]} : ${item[1]}`, x, y)
        })

        yPos += Math.ceil(cumulItems.length / 2) * 5 + 5
      }

      const leave = leaveBalance || slip?.details?.leave_balance
      if (leave) {
        if (yPos > pageHeight - 25) { doc.addPage(); yPos = 20 }

        doc.setFillColor(240, 242, 255)
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, 'F')

        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(99, 102, 241)
        doc.text(`Congés : ${leave.remaining}j restants / ${leave.acquired}j acquis (${leave.taken}j pris)`, margin + 4, yPos + 6)
        yPos += 15
      }

      if (slip.profile?.payment_method || slip.profile?.mobile_money_provider || slip.profile?.bank_name) {
        if (yPos > pageHeight - 20) { doc.addPage(); yPos = 20 }

        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        let paymentText = 'Mode de paiement : '

        if (slip.profile.mobile_money_provider && slip.profile.mobile_money_number) {
          paymentText += `${slip.profile.mobile_money_provider} — ${slip.profile.mobile_money_number}`
        } else if (slip.profile.bank_name) {
          paymentText += `Virement bancaire — ${slip.profile.bank_name}`
          if (slip.profile.bank_account) paymentText += ` (${slip.profile.bank_account})`
        } else {
          paymentText += slip.profile.payment_method || 'Non spécifié'
        }

        doc.text(paymentText, margin, yPos)
        yPos += 8
      }

      if (settings.company_footer) {
        if (yPos > pageHeight - 35) { doc.addPage(); yPos = 20 }

        const footerLines = doc.splitTextToSize(settings.company_footer, pageWidth - 2 * margin - 8)
        const blockHeight = footerLines.length * 4 + 8
        doc.setFillColor(248, 249, 251)
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, blockHeight, 2, 2, 'F')
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(90, 90, 90)
        doc.text(footerLines, margin + 4, yPos + 5)
        yPos += blockHeight + 6
      }

      const sig1 = settings.signatory1_signature || settings.signature_image
      const sig2 = settings.signatory2_signature
      const stamp = settings.company_stamp
      const sig1Name = settings.signatory1_name || settings.signature_name || ''
      const sig1Title = settings.signatory1_title || 'Responsable paie'
      const sig2Name = settings.signatory2_name || ''
      const sig2Title = settings.signatory2_title || ''
      const hasAnySignature = sig1 || sig2 || stamp || sig1Name || sig2Name

      if (hasAnySignature) {
        const signatureBlockHeight = 55
        if (yPos > pageHeight - signatureBlockHeight - 18) {
          doc.addPage()
          yPos = 20
        }

        const signatureDate = new Date().toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        doc.text(`Fait le ${signatureDate}`, pageWidth - margin, yPos, { align: 'right' })
        yPos += 8

        const zoneWidth = (pageWidth - 2 * margin) / 3
        const sig1X = margin
        const stampX = margin + zoneWidth
        const sig2X = margin + 2 * zoneWidth

        const sigMaxWidth = zoneWidth - 10
        const sigMaxHeight = 24
        const stampMaxSize = 30

        if (sig1) {
          try {
            const sig1Base64 = await this.loadImageAsBase64(sig1)
            const sig1Format = this.getImageFormatFromUrl(sig1)
            doc.addImage(sig1Base64, sig1Format, sig1X + 5, yPos, sigMaxWidth, sigMaxHeight, undefined, 'FAST')
          } catch (err) {
            console.warn('Signature 1 non chargée:', err.message)
          }
        }

        if (stamp) {
          try {
            const stampBase64 = await this.loadImageAsBase64(stamp)
            const stampFormat = this.getImageFormatFromUrl(stamp)
            const stampCenterX = stampX + (zoneWidth - stampMaxSize) / 2
            doc.addImage(stampBase64, stampFormat, stampCenterX, yPos - 3, stampMaxSize, stampMaxSize, undefined, 'FAST')
          } catch (err) {
            console.warn('Cachet non chargé:', err.message)
          }
        }

        if (sig2) {
          try {
            const sig2Base64 = await this.loadImageAsBase64(sig2)
            const sig2Format = this.getImageFormatFromUrl(sig2)
            doc.addImage(sig2Base64, sig2Format, sig2X + 5, yPos, sigMaxWidth, sigMaxHeight, undefined, 'FAST')
          } catch (err) {
            console.warn('Signature 2 non chargée:', err.message)
          }
        }

        yPos += sigMaxHeight + 3

        doc.setDrawColor(180, 180, 180)
        doc.setLineWidth(0.3)

        if (sig1 || sig1Name) doc.line(sig1X + 5, yPos, sig1X + sigMaxWidth, yPos)
        if (sig2 || sig2Name) doc.line(sig2X + 5, yPos, sig2X + sigMaxWidth, yPos)

        yPos += 4

        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(60, 60, 60)

        if (sig1Name) doc.text(sig1Name, sig1X + 5 + sigMaxWidth / 2, yPos, { align: 'center' })
        if (sig2Name) doc.text(sig2Name, sig2X + 5 + sigMaxWidth / 2, yPos, { align: 'center' })

        yPos += 4

        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(120, 120, 120)

        if (sig1Title) doc.text(sig1Title, sig1X + 5 + sigMaxWidth / 2, yPos, { align: 'center' })
        if (sig2Title) doc.text(sig2Title, sig2X + 5 + sigMaxWidth / 2, yPos, { align: 'center' })
      }

      const legalMention =
        settings.legal_mention ||
        'Ce bulletin de paie doit être conservé sans limitation de durée.'

      const mentionLines = doc.splitTextToSize(legalMention, pageWidth - 2 * margin)
      doc.setFontSize(6)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(150, 150, 150)
      const mentionY = pageHeight - 8 - ((mentionLines.length - 1) * 3)
      doc.text(mentionLines, pageWidth / 2, mentionY, { align: 'center' })

      doc.setFontSize(5)
      doc.setTextColor(200, 200, 200)
      doc.text('Généré par En-Check', pageWidth / 2, pageHeight - 3, { align: 'center' })

      const fileName = `bulletin_paie_${slip.employee.matricule || slip.employee.id}_${periodStart.replace(/-/g, '')}.pdf`
      doc.save(fileName)

      return true
    } catch (error) {
      console.error('Erreur génération PDF:', error)
      return false
    }
  }

  static async logAuditAction({
    enterpriseId,
    action,
    entityType,
    entityId,
    employeeId,
    periodStart,
    periodEnd,
    oldValues,
    newValues,
    metadata,
    performedBy,
  }) {
    try {
      await db().from('payroll_audit_logs').insert({
        enterprise_id: enterpriseId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        employee_id: employeeId,
        period_start: periodStart,
        period_end: periodEnd,
        old_values: oldValues || null,
        new_values: newValues || null,
        metadata: metadata || null,
        performed_by: performedBy || null,
        performed_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Erreur audit log:', err)
    }
  }

  static formatDate(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }

  static async getTemplatesForEnterprise() {
    try {
      const [allowanceTemplates, deductionTemplates] = await Promise.all([
        db().from('allowance_type_templates').select('*').order('display_order', { ascending: true }),
        db().from('deduction_type_templates').select('*').order('display_order', { ascending: true }),
      ])

      return {
        allowanceTemplates: allowanceTemplates.data || [],
        deductionTemplates: deductionTemplates.data || [],
      }
    } catch (err) {
      console.error('Erreur chargement templates:', err)
      return { allowanceTemplates: [], deductionTemplates: [] }
    }
  }

  static async initializeTypesFromTemplates(enterpriseId, adminId) {
    try {
      const { allowanceTemplates, deductionTemplates } = await this.getTemplatesForEnterprise()

      if (allowanceTemplates.length > 0) {
        const allowancePayload = allowanceTemplates.map(t => ({
          enterprise_id: enterpriseId,
          code: t.code,
          name: t.name,
          description: t.description,
          category: t.category,
          calculation_type: t.calculation_type,
          is_taxable: t.is_taxable,
          is_subject_to_contributions: t.is_subject_to_contributions,
          is_recurring: t.is_recurring,
          display_order: t.display_order,
          is_active: true,
        }))

        await db()
          .from('allowance_types')
          .upsert(allowancePayload, { onConflict: 'enterprise_id,code' })
      }

      if (deductionTemplates.length > 0) {
        const deductionPayload = deductionTemplates.map(t => ({
          enterprise_id: enterpriseId,
          code: t.code,
          name: t.name,
          description: t.description,
          category: t.category,
          calculation_type: t.calculation_type,
          is_recurring: t.is_recurring,
          is_priority: t.is_priority,
          display_order: t.display_order,
          is_active: true,
        }))

        await db()
          .from('deduction_types')
          .upsert(deductionPayload, { onConflict: 'enterprise_id,code' })
      }

      return true
    } catch (err) {
      console.error('Erreur initialisation types:', err)
      return false
    }
  }
}

export default PayrollService