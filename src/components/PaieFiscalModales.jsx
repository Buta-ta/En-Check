// ═══════════════════════════════════════════════════════════
// 🪟 MODALES DU VOLET FISCAL
//
// Créer ou modifier une cotisation, une tranche du barème, les
// règles fiscales, et confirmer une action destructrice. Elles
// étaient au milieu de la page : 2300 lignes d'un seul tenant
// qu'on n'ouvrait qu'en retenant son souffle.
// ═══════════════════════════════════════════════════════════

import PaieDrawer from './PaieDrawer'
import { useState } from 'react'
import {
  Save,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { palettePaie, stylesPaie } from '../styles/paieTheme'
import { FieldHelp, FormLabel } from './PaieFiscalChamps'

export function ContributionModal({ contribution, currency, onSave, onClose, saving }) {
  const { darkMode } = useTheme()
  const S = stylesPaie(darkMode)
  const P = palettePaie(darkMode)
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
    <PaieDrawer title="Cotisation" onClose={onClose} busy={saving} help="Définissez qui cotise, sur quelle base et à quel taux." example="À 5 % sur une base de 100 000, la cotisation vaut 5 000 avant application des plafonds.">
      <div style={S.modalContent} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>
            {contribution ? 'Modifier la cotisation' : 'Nouvelle cotisation'}
          </h2>
          <button aria-label="Fermer le tiroir" disabled={saving} onClick={onClose} style={S.modalCloseBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={S.modalBody}>
          <div style={S.noteBox}>
            <Info size={14} color={P.vert} />
            <span style={{ color: P.texteDoux2, fontSize: 12 }}>
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
    </PaieDrawer>
  )
}

export function BracketModal({ bracket, currency, nextOrder, onSave, onClose, saving }) {
  const { darkMode } = useTheme()
  const S = stylesPaie(darkMode)
  const P = palettePaie(darkMode)
  const [form, setForm] = useState(bracket || {
    bracket_name: '',
    min_amount: '',
    max_amount: '',
    tax_rate: '',
    fixed_deduction: '',
    bracket_order: nextOrder,
  })

  return (
    <PaieDrawer title="Tranche fiscale" onClose={onClose} busy={saving} help="Le taux porte sur la part du revenu comprise dans cette tranche, en mode progressif." example="Une tranche de 50 000 à 100 000 à 10 % taxe au maximum 50 000 × 10 % = 5 000.">
      <div style={S.modalContent} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>
            {bracket ? 'Modifier la tranche' : 'Nouvelle tranche fiscale'}
          </h2>
          <button aria-label="Fermer le tiroir" disabled={saving} onClick={onClose} style={S.modalCloseBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={S.modalBody}>
          <div style={S.noteBox}>
            <Info size={14} color={P.indigo} />
            <span style={{ color: P.texteDoux2, fontSize: 12 }}>
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
    </PaieDrawer>
  )
}

export function RulesModal({ rules, contributions, currency, onClose, onSave, saving }) {
  const { darkMode } = useTheme()
  const S = stylesPaie(darkMode)
  const P = palettePaie(darkMode)
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
    <PaieDrawer title="Règles de calcul" onClose={onClose} busy={saving} help="Ces réglages déterminent le revenu imposable. Vérifiez le régime applicable avant de modifier." example="Un abattement de 20 % sur 100 000 retire 20 000 de la base, sous réserve du plafond configuré.">
      <div style={{ ...S.modalContent, maxWidth: 760 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>Modifier les règles de calcul</h2>
          <button aria-label="Fermer le tiroir" disabled={saving} onClick={onClose} style={S.modalCloseBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={S.modalBody}>
          <div style={S.noteBox}>
            <Info size={14} color={P.ambre} />
            <span style={{ color: P.texteDoux2, fontSize: 12 }}>
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
                  <Info size={14} color={P.indigo} />
                  <span style={{ color: P.texteDoux2, fontSize: 12 }}>
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
              <Info size={14} color={P.indigo} />
              <span style={{ color: P.texteDoux2, fontSize: 12 }}>
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
    </PaieDrawer>
  )
}

export function ConfirmModal({ title, message, confirmText, type, onCancel, onConfirm, details }) {
  const { darkMode } = useTheme()
  const S = stylesPaie(darkMode)
  const P = palettePaie(darkMode)
  const color =
    type === 'danger' ? P.rouge :
    type === 'info' ? P.indigo :
    P.ambre

  return (
    <PaieDrawer title={title} onClose={onCancel} help="Vérifiez cette action avant de confirmer. Les changements ne sont appliqués qu’après confirmation.">
      <div style={{ ...S.modalContent, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={S.confirmBox}>
          <div style={{ ...S.confirmIcon, background: `${color}20`, color }}>
            <AlertTriangle size={24} />
          </div>
          <h3 style={S.confirmTitle}>{title}</h3>
          <p style={S.confirmText}>{message}</p>
          {details && <div style={{ width: '100%' }}>{details}</div>}
          <div style={S.confirmActions}>
            <button onClick={onCancel} style={S.cancelBtn}>Annuler</button>
            <button onClick={onConfirm} style={{ ...S.confirmBtn, background: color }}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </PaieDrawer>
  )
}
