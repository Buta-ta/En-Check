// src/pages/employee/EmployeeFichesPaie.jsx
// ═══════════════════════════════════════════════════════════
// 💰 ESPACE EMPLOYÉ — MES FICHES DE PAIE
// Version améliorée avec fiscalité détaillée
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import CurrencyService from '../../services/currencyService'
import { useNavigate } from 'react-router-dom'
import {
  Wallet,
  Calendar,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Shield,
  Percent,
  Receipt,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { db } from '../../lib/db'
import EmployeeAuthService from '../../services/employeeAuthService'
import PayrollService from '../../services/payrollService'
import EmployeeLayout from '../../components/EmployeeLayout'
import NotificationPermissionPrompt from '../../components/NotificationPermissionPrompt'
import useEmployeeRealtimeNotifications from '../../hooks/useEmployeeRealtimeNotifications'
import toast from 'react-hot-toast'

export default function EmployeeFichesPaie() {
  const [employee, setEmployee] = useState(null)
  const [payslips, setPayslips] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const navigate = useNavigate()
  useEmployeeRealtimeNotifications(employee)

  useEffect(() => {
    const emp = EmployeeAuthService.getEmployee()
    if (!emp) {
      navigate('/employee/login')
      return
    }
    setEmployee(emp)
    loadPayslips(emp)
  }, [navigate])

  const loadPayslips = async (emp) => {
    try {
     const { data, error } = await db()
  .from('employee_payslips')
  .select('*')
  .eq('employee_id', emp.id)
  .or('is_deleted.is.null,is_deleted.eq.false')
  .order('period_start', { ascending: false })

      if (error) throw error
      setPayslips(data || [])
    } catch (err) {
      console.error('Erreur chargement fiches:', err)
      toast.error('Impossible de charger vos fiches de paie')
    }
    setLoading(false)
  }

  const fmt = (amount, currency = null) => {
    // Délègue au service devise (aucune unité inventée).
    return CurrencyService.format(amount, currency)
  }

  const handleDownloadPDF = (slip) => {
    try {
      const details = slip.details || {}
      const row = {
        employee: employee,
        profile: details.profile || {},
        earnings: details.earnings || [],
        deductions: details.deductions || [],
        grossSalary: slip.gross_salary,
        netSalary: slip.net_salary,
        totalEarnings: slip.total_earnings,
        totalDeductions: slip.total_deductions,
        taxation: details.taxation || null,
        sources: details.sources || {},
      }

      const settings = details.settings_snapshot || {}

      PayrollService.generatePayrollSlipPDF(
        row,
        settings,
        details.enterprise_name || 'Entreprise',
        slip.period_start,
        slip.period_end
      )

      toast.success('Fiche de paie téléchargée')
    } catch (err) {
      console.error(err)
      toast.error('Erreur téléchargement')
    }
  }

  const formatPeriod = (start, end) => {
    const s = new Date(start)
    const e = new Date(end)
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ]

    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${monthNames[s.getMonth()]} ${s.getFullYear()}`
    }

    return `${s.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} → ${e.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }

  if (!employee) return null

  return (
    <>
      <NotificationPermissionPrompt userType="employee" />
      <EmployeeLayout>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .slip-card {
          transition: all 0.3s ease;
        }
        .slip-card:hover {
          border-color: rgba(245,158,11,0.2) !important;
          transform: translateY(-2px);
        }
      `}</style>

      <div style={PS.container}>
        <div style={PS.pageHeader}>
          <div style={PS.pageIconWrap}>
            <Wallet size={24} color="#F59E0B" />
          </div>
          <div>
            <h1 style={PS.pageTitle}>Mes fiches de paie</h1>
            <p style={PS.pageSub}>
              Consultez, détaillez et téléchargez vos bulletins de salaire
            </p>
          </div>
        </div>

        {loading ? (
          <div style={PS.loadingBox}>
            <Clock size={24} color="#F59E0B" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#888', marginTop: 8 }}>Chargement...</span>
          </div>
        ) : payslips.length === 0 ? (
          <div style={PS.emptyState}>
            <FileText size={40} color="#444" />
            <h3 style={PS.emptyTitle}>Aucune fiche de paie</h3>
            <p style={PS.emptyText}>
              Vos fiches de paie apparaîtront ici une fois que votre employeur les aura générées et publiées.
            </p>
          </div>
        ) : (
          <div style={PS.slipList}>
            {payslips.map((slip, index) => {
              const isExpanded = expandedId === slip.id
              const details = slip.details || {}
              const taxation = details.taxation || null
              const currency = slip.currency || details?.currency || null

              return (
                <div
                  key={slip.id}
                  className="slip-card"
                  style={{
                    ...PS.slipCard,
                    animation: `fadeInUp 0.4s ease ${index * 0.08}s forwards`,
                    opacity: 0,
                  }}
                >
                  <div
                    style={PS.slipHeader}
                    onClick={() => setExpandedId(isExpanded ? null : slip.id)}
                  >
                    <div style={PS.slipHeaderLeft}>
                      <div style={PS.slipMonthBadge}>
                        <Calendar size={16} color="#F59E0B" />
                      </div>
                      <div>
                        <h3 style={PS.slipPeriod}>{formatPeriod(slip.period_start, slip.period_end)}</h3>
                        <p style={PS.slipDate}>
                          Publiée le {new Date(slip.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    <div style={PS.slipHeaderRight}>
                      <div style={PS.slipNetAmount}>{fmt(slip.net_salary, currency)}</div>
                      {isExpanded ? <ChevronUp size={18} color="#888" /> : <ChevronDown size={18} color="#888" />}
                    </div>
                  </div>

                  <div style={PS.slipQuickStats}>
                    <div style={PS.slipQuickItem}>
                      <span style={PS.slipQuickLabel}>Brut</span>
                      <span style={PS.slipQuickValue}>{fmt(slip.gross_salary, currency)}</span>
                    </div>

                    <div style={PS.slipQuickItem}>
                      <span style={PS.slipQuickLabel}>Retenues</span>
                      <span style={{ ...PS.slipQuickValue, color: '#EF4444' }}>
                        - {fmt(slip.total_deductions, currency)}
                      </span>
                    </div>

                    <div style={PS.slipQuickItem}>
                      <span style={PS.slipQuickLabel}>Net</span>
                      <span style={{ ...PS.slipQuickValue, color: '#10B981', fontWeight: 800 }}>
                        {fmt(slip.net_salary, currency)}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={PS.slipDetails}>
                      {/* Gains */}
                      <div style={PS.detailSection}>
                        <div style={PS.sectionHeaderRow}>
                          <TrendingUp size={16} color="#10B981" />
                          <h4 style={{ ...PS.detailSectionTitle, color: '#10B981' }}>Gains</h4>
                        </div>

                        {details.earnings && details.earnings.length > 0 ? (
                          details.earnings.map((e, i) => (
                            <div key={i} style={PS.detailRow}>
                              <span style={PS.detailLabel}>{e.label || e.name}</span>
                              <span style={PS.detailAmount}>{fmt(e.amount, currency)}</span>
                            </div>
                          ))
                        ) : (
                          <div style={PS.emptyMiniRow}>Aucun gain détaillé</div>
                        )}
                      </div>

                      {/* Retenues */}
                      <div style={PS.detailSection}>
                        <div style={PS.sectionHeaderRow}>
                          <TrendingDown size={16} color="#EF4444" />
                          <h4 style={{ ...PS.detailSectionTitle, color: '#EF4444' }}>Retenues</h4>
                        </div>

                        {details.deductions && details.deductions.length > 0 ? (
                          details.deductions.map((d, i) => (
                            <div key={i} style={PS.detailRow}>
                              <span style={PS.detailLabel}>{d.label || d.name}</span>
                              <span style={{ ...PS.detailAmount, color: '#EF4444' }}>
                                - {fmt(d.amount, currency)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div style={PS.emptyMiniRow}>Aucune retenue</div>
                        )}
                      </div>

                      {/* Fiscalité */}
                      {taxation && (
                        <div style={PS.taxBlock}>
                          <div style={PS.sectionHeaderRow}>
                            <Shield size={16} color="#8B5CF6" />
                            <h4 style={{ ...PS.detailSectionTitle, color: '#A78BFA' }}>
                              Fiscalité & Cotisations
                            </h4>
                          </div>

                          <div style={PS.taxGrid}>
                            <div style={PS.taxMini}>
                              <span style={PS.taxMiniLabel}>Revenu imposable</span>
                              <span style={PS.taxMiniValue}>
                                {fmt(taxation.taxableIncome || taxation.tax?.taxableIncome || 0, currency)}
                              </span>
                            </div>

                            <div style={PS.taxMini}>
                              <span style={PS.taxMiniLabel}>Impôt IRPP</span>
                              <span style={{ ...PS.taxMiniValue, color: '#EF4444' }}>
                                {fmt(taxation.tax?.totalTax || 0, currency)}
                              </span>
                            </div>

                            <div style={PS.taxMini}>
                              <span style={PS.taxMiniLabel}>Taux effectif</span>
                              <span style={PS.taxMiniValue}>
                                {taxation.tax?.effectiveRate || 0}%
                              </span>
                            </div>

                            <div style={PS.taxMini}>
                              <span style={PS.taxMiniLabel}>Cotisations salariales</span>
                              <span style={PS.taxMiniValue}>
                                {fmt(taxation.contributions?.totalEmployee || 0, currency)}
                              </span>
                            </div>
                          </div>

                          {taxation.contributions?.employee?.length > 0 && (
                            <div style={PS.taxSubSection}>
                              <div style={PS.taxSubHeader}>
                                <Receipt size={14} color="#8B5CF6" />
                                <span style={PS.taxSubTitle}>Cotisations salariales</span>
                              </div>

                              {taxation.contributions.employee.map((contrib, idx) => (
                                <div key={idx} style={PS.detailRow}>
                                  <span style={PS.detailLabel}>
                                    {contrib.name}
                                    {contrib.rate ? ` (${contrib.rate}%)` : ''}
                                  </span>
                                  <span style={PS.detailAmount}>{fmt(contrib.amount, currency)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {taxation.tax?.details?.length > 0 && (
                            <div style={PS.taxSubSection}>
                              <div style={PS.taxSubHeader}>
                                <Percent size={14} color="#8B5CF6" />
                                <span style={PS.taxSubTitle}>Détail du barème fiscal</span>
                              </div>

                              {taxation.tax.details.map((item, idx) => (
                                <div key={idx} style={PS.detailRow}>
                                  <span style={PS.detailLabel}>
                                    {item.bracket} • {item.rate}%
                                  </span>
                                  <span style={PS.detailAmount}>{fmt(item.tax, currency)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Totaux */}
                      <div style={PS.totalRow}>
                        <div style={PS.totalItem}>
                          <span style={PS.totalLabel}>Salaire brut</span>
                          <span style={PS.totalValue}>{fmt(slip.gross_salary, currency)}</span>
                        </div>

                        <div style={PS.totalItem}>
                          <span style={PS.totalLabel}>Total retenues</span>
                          <span style={{ ...PS.totalValue, color: '#EF4444' }}>
                            - {fmt(slip.total_deductions, currency)}
                          </span>
                        </div>

                        <div style={{
                          ...PS.totalItem,
                          background: 'rgba(16,185,129,0.08)',
                          border: '1px solid rgba(16,185,129,0.15)',
                        }}>
                          <span style={{ ...PS.totalLabel, color: '#10B981', fontWeight: 700 }}>
                            Net à payer
                          </span>
                          <span style={{ ...PS.totalValue, color: '#10B981', fontSize: 18 }}>
                            {fmt(slip.net_salary, currency)}
                          </span>
                        </div>
                      </div>

                      <button onClick={() => handleDownloadPDF(slip)} style={PS.downloadBtn}>
                        <Download size={16} />
                        <span>Télécharger le bulletin PDF</span>
                      </button>

                      <div style={PS.publishedNote}>
                        <CheckCircle2 size={14} color="#10B981" />
                        <span>Ce bulletin a été publié par votre employeur.</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </EmployeeLayout>
      </>
  )
}

const PS = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },

  pageIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pageTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
  },

  pageSub: {
    color: '#888',
    fontSize: 13,
    margin: '4px 0 0 0',
  },

  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    background: 'rgba(20,20,35,0.7)',
    borderRadius: 18,
    border: '1px dashed rgba(255,255,255,0.08)',
    padding: 40,
  },

  emptyTitle: {
    color: '#888',
    fontSize: 16,
    fontWeight: 600,
    margin: '12px 0 4px 0',
  },

  emptyText: {
    color: '#666',
    fontSize: 13,
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.5,
  },

  slipList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  slipCard: {
    background: 'rgba(20,20,35,0.7)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    overflow: 'hidden',
  },

  slipHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '16px 18px',
    cursor: 'pointer',
    flexWrap: 'wrap',
  },

  slipHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },

  slipMonthBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'rgba(245,158,11,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  slipPeriod: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
  },

  slipDate: {
    color: '#666',
    fontSize: 11,
    margin: '3px 0 0 0',
  },

  slipHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  slipNetAmount: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: 800,
  },

  slipQuickStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    padding: '0 18px 14px 18px',
  },

  slipQuickItem: {
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },

  slipQuickLabel: {
    color: '#777',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  slipQuickValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 700,
  },

  slipDetails: {
    padding: '0 18px 18px 18px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingTop: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },

  detailSectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    margin: 0,
  },

  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.02)',
    gap: 12,
  },

  detailLabel: {
    color: '#CCC',
    fontSize: 13,
    lineHeight: 1.4,
  },

  detailAmount: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },

  emptyMiniRow: {
    color: '#666',
    fontSize: 12,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
  },

  taxBlock: {
    padding: 14,
    borderRadius: 14,
    background: 'rgba(139,92,246,0.05)',
    border: '1px solid rgba(139,92,246,0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  taxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 10,
  },

  taxMini: {
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  taxMiniLabel: {
    color: '#777',
    fontSize: 11,
  },

  taxMiniValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 700,
  },

  taxSubSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  taxSubHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
  },

  taxSubTitle: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: 700,
  },

  totalRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 12,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },

  totalItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.03)',
    gap: 12,
  },

  totalLabel: {
    color: '#AAA',
    fontSize: 13,
    fontWeight: 600,
  },

  totalValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },

  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 18px',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    border: 'none',
    color: '#000',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    marginTop: 4,
  },

  publishedNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#10B981',
    fontSize: 12,
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.15)',
    borderRadius: 10,
    padding: '10px 12px',
  },
}