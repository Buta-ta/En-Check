// ═══════════════════════════════════════════════════════════
// 📊 LANDING ANALYTICS — Superadmin uniquement
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import {
  BarChart2,
  Users,
  Clock,
  TrendingUp,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  Globe,
  MousePointer,
  Download,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import { 
  getLandingPageStats,
  deleteVisitById,
  deleteVisitsByDateRange,
  deleteAllVisits,
  deleteVisitsByCountry,
} from '../services/analyticsService'
import { exportAnalyticsToPDF, exportAnalyticsToCSV } from '../services/pdfExportService'
import ConfirmModal from '../components/ConfirmModal'
import toast from 'react-hot-toast'

const SECTION_LABELS = {
  hero: '🏠 Hero',
  features: '⚡ Fonctionnalités',
  demo: '🎬 Démo',
  how: '📋 Comment ça marche',
  pricing: '💰 Tarifs',
  contact: '📞 Contact',
}

// ─── Helper : emoji drapeau ──────────────────────────────────
function countryFlag(code) {
  if (!code || code.length !== 2) return '🌍'
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

// ─── Composant KPI Card ──────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = '#F59E0B' }) {
  return (
    <div
      style={{
        background: 'rgba(20,20,35,0.8)',
        border: `1px solid ${color}25`,
        borderRadius: 16,
        padding: '20px 22px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} color={color} />
        </div>
        <span style={{ color: '#888', fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ color: '#FFF', fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ─── Mini barre de progression ───────────────────────────────
function MiniBar({ label, value, max, color = '#F59E0B' }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#CCC', fontSize: 13 }}>{label}</span>
        <span style={{ color: color, fontWeight: 800, fontSize: 13 }}>{value}</span>
      </div>
      <div
        style={{
          height: 6,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 999,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </div>
  )
}

// ─── Graphique barres par jour ───────────────────────────────
function DayChart({ visitsByDay }) {
  const entries = Object.entries(visitsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)

  const max = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div
      style={{
        background: 'rgba(20,20,35,0.8)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 22,
      }}
    >
      <div
        style={{
          color: '#FFF',
          fontWeight: 800,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <BarChart2 size={16} color="#F59E0B" />
        Visites par jour (14 derniers jours)
      </div>

      {entries.length === 0 ? (
        <div style={{ color: '#555', textAlign: 'center', padding: '20px 0' }}>
          Pas encore de données
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
          {entries.map(([day, count]) => {
            const height = Math.max((count / max) * 100, 4)
            const label = day.slice(5)
            return (
              <div
                key={day}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                title={`${day} : ${count} visite(s)`}
              >
                <div style={{ color: '#888', fontSize: 9 }}>{count}</div>
                <div
                  style={{
                    width: '100%',
                    height: `${height}%`,
                    background: 'linear-gradient(180deg, #F59E0B, #D97706)',
                    borderRadius: '4px 4px 0 0',
                    minHeight: 4,
                  }}
                />
                <div style={{ color: '#555', fontSize: 9, whiteSpace: 'nowrap' }}>{label}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Composant pays ──────────────────────────────────────────
function CountryStats({ byCountry }) {
  const entries = Object.entries(byCountry)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)

  const max = entries[0]?.[1]?.count || 1

  return (
    <div
      style={{
        background: 'rgba(20,20,35,0.8)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 22,
      }}
    >
      <div style={{ color: '#FFF', fontWeight: 800, marginBottom: 16 }}>
        🌍 Pays des visiteurs (top 10)
      </div>

      {entries.length === 0 ? (
        <div style={{ color: '#555', fontSize: 13 }}>Pas encore de données</div>
      ) : (
        entries.map(([country, { count, code }]) => {
          const pct = Math.round((count / max) * 100)
          return (
            <div key={country} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{countryFlag(code)}</span>
                  <span style={{ color: '#CCC', fontSize: 13 }}>{country}</span>
                </div>
                <span style={{ color: '#F59E0B', fontWeight: 800, fontSize: 13 }}>
                  {count} ({pct}%)
                </span>
              </div>
              <div
                style={{
                  height: 5,
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #F59E0B, #10B981)',
                    borderRadius: 999,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────
export default function LandingAnalytics() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [days, setDays] = useState(30)
  const [refreshing, setRefreshing] = useState(false)

    const [deleteMode, setDeleteMode] = useState(false)
  const [deletingVisit, setDeletingVisit] = useState(false)
  
  // Modals
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    isDangerous: false,
    action: null,
    data: null,
  })

  const load = async () => {
    try {
      setRefreshing(true)
      const data = await getLandingPageStats({ days })
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [days])

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }


    const handleDeleteVisit = (visitId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer cette visite ?',
      message: 'Cette action est irréversible. La visite sera supprimée définitivement.',
      isDangerous: true,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      action: async () => {
        setDeletingVisit(true)
        try {
          await deleteVisitById(visitId)
          toast.success('✅ Visite supprimée avec succès')
          setConfirmModal({ ...confirmModal, isOpen: false })
          await load()
        } catch (error) {
          toast.error('❌ ' + error.message)
        } finally {
          setDeletingVisit(false)
        }
      },
    })
  }

  const handleDeleteByCountry = (countryCode) => {
    const countryData = stats.byCountry[
      Object.keys(stats.byCountry).find((k) => stats.byCountry[k].code === countryCode)
    ]
    const count = countryData?.count || 0

    setConfirmModal({
      isOpen: true,
      title: `Supprimer les visites de ${countryCode} ?`,
      message: `Vous êtes sur le point de supprimer ${count} visite(s) provenant de ${countryCode}. Cette action est irréversible.`,
      isDangerous: true,
      confirmText: `Supprimer ${count} visite(s)`,
      cancelText: 'Annuler',
      action: async () => {
        setDeletingVisit(true)
        try {
          await deleteVisitsByCountry(countryCode)
          toast.success(`✅ ${count} visite(s) supprimée(s)`)
          setConfirmModal({ ...confirmModal, isOpen: false })
          await load()
        } catch (error) {
          toast.error('❌ ' + error.message)
        } finally {
          setDeletingVisit(false)
        }
      },
    })
  }

  const handleDeleteAll = () => {
    setConfirmModal({
      isOpen: true,
      title: '⚠️ ATTENTION : Supprimer TOUTES les données ?',
      message: `Vous êtes sur le point de supprimer les ${stats.total} statistiques enregistrées. Cette action est IRRÉVERSIBLE et ne peut pas être annulée.`,
      isDangerous: true,
      confirmText: 'Je comprends, supprimer tout',
      cancelText: 'Annuler',
      action: async () => {
        setDeletingVisit(true)
        try {
          await deleteAllVisits()
          toast.success('✅ Toutes les statistiques ont été supprimées')
          setConfirmModal({ ...confirmModal, isOpen: false })
          await load()
        } catch (error) {
          toast.error('❌ ' + error.message)
        } finally {
          setDeletingVisit(false)
        }
      },
    })
  }

    const handleConfirmAction = async () => {
    if (confirmModal.action) {
      await confirmModal.action()
    }
  }

  const handleExportPDF = async () => {
    try {
      await exportAnalyticsToPDF(stats)
      toast.success('PDF exporté avec succès')
    } catch (error) {
      toast.error('Erreur export : ' + error.message)
    }
  }

  const handleExportCSV = async () => {
    try {
      await exportAnalyticsToCSV(stats)
      toast.success('CSV exporté avec succès')
    } catch (error) {
      toast.error('Erreur export : ' + error.message)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: '#888', fontSize: 15 }}>Chargement des statistiques...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12,
          padding: 20,
          color: '#EF4444',
        }}
      >
        Erreur : {error}
      </div>
    )
  }

  const deviceTotal = Object.values(stats.byDevice).reduce((a, b) => a + b, 0) || 1
  const topSections = Object.entries(stats.sectionCounts).sort(([, a], [, b]) => b - a)
  const topCTAs = Object.entries(stats.ctaCounts).sort(([, a], [, b]) => b - a).slice(0, 5)

    return (
    <>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDangerous={confirmModal.isDangerous}
        confirmText={confirmModal.confirmText || 'Confirmer'}
        cancelText={confirmModal.cancelText || 'Annuler'}
        isLoading={deletingVisit}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />

      <div style={{ padding: '0 0 40px' }}>
            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
      `}</style>

      {/* ─── Header ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={22} color="#F59E0B" />
            <h2 style={{ color: '#FFF', fontSize: 20, fontWeight: 900, margin: 0 }}>
              Analytics Landing Page
            </h2>
            <span
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#EF4444',
                fontSize: 10,
                fontWeight: 900,
                borderRadius: 6,
                padding: '2px 8px',
              }}
            >
              SUPERADMIN
            </span>
          </div>
          <p style={{ color: '#888', fontSize: 13, margin: '4px 0 0' }}>
            Statistiques de visites de la landing page
          </p>
        </div>

               <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                background: days === d ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${days === d ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: days === d ? '#F59E0B' : '#888',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {d}j
            </button>
          ))}

          <button
            onClick={load}
            disabled={refreshing}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#888',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'inherit',
            }}
            title="Rafraîchir"
          >
            <RefreshCw
              size={14}
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
            />
          </button>

          {/* 🆕 Export & Delete */}
          <button
            onClick={handleExportPDF}
            style={{
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: '#22C55E',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Exporter en PDF"
          >
            <Download size={14} />
            PDF
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#818CF8',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Exporter en CSV"
          >
            <Download size={14} />
            CSV
          </button>

          <button
            onClick={() => setDeleteMode(!deleteMode)}
            style={{
              background: deleteMode ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${deleteMode ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: deleteMode ? '#EF4444' : '#888',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Mode suppression"
          >
            <Trash2 size={14} />
            {deleteMode ? 'Annuler' : 'Supprimer'}
          </button>
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard
          icon={Users}
          label="Total visites"
          value={stats.total.toLocaleString()}
          sub={`${days} derniers jours`}
          color="#F59E0B"
        />
        <StatCard
          icon={TrendingUp}
          label="Nouveaux visiteurs"
          value={stats.newVisitors.toLocaleString()}
          sub={`${stats.total > 0 ? Math.round((stats.newVisitors / stats.total) * 100) : 0}% du total`}
          color="#10B981"
        />
        <StatCard
          icon={RefreshCw}
          label="Visiteurs récurrents"
          value={stats.returning.toLocaleString()}
          sub={`${stats.total > 0 ? Math.round((stats.returning / stats.total) * 100) : 0}% du total`}
          color="#6366F1"
        />
        <StatCard
          icon={Clock}
          label="Durée moyenne"
          value={formatDuration(stats.avgDuration)}
          sub="Temps passé sur la page"
          color="#EC4899"
        />
        <StatCard
          icon={BarChart2}
          label="Taux de rebond"
          value={`${stats.bounceRate}%`}
          sub="< 10 secondes"
          color={stats.bounceRate > 60 ? '#EF4444' : '#10B981'}
        />
      </div>


            {/* ─── Mode Suppression ─── */}
      {deleteMode && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '2px solid rgba(239,68,68,0.3)',
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <AlertCircle size={20} color="#EF4444" />
            <span style={{ color: '#EF4444', fontWeight: 800 }}>Mode Suppression Activé</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <button
              onClick={handleDeleteAll}
              disabled={deletingVisit}
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#EF4444',
                borderRadius: 12,
                padding: 12,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'center',
              }}
            >
              ⚠️ Supprimer TOUT
            </button>

            {Object.keys(stats.byCountry).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ color: '#FFF', fontSize: 11, fontWeight: 700, opacity: 0.7 }}>
                  Supprimer par pays :
                </span>
                {Object.entries(stats.byCountry)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .slice(0, 5)
                  .map(([country, { count, code }]) => (
                    <button
                      key={code}
                      onClick={() => handleDeleteByCountry(code)}
                      disabled={deletingVisit}
                      style={{
                        background: 'rgba(249,115,22,0.15)',
                        border: '1px solid rgba(249,115,22,0.2)',
                        color: '#F97316',
                        borderRadius: 10,
                        padding: 8,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'center',
                      }}
                    >
                      {code} ({count})
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
            <span style={{ color: '#888', fontSize: 11 }}>
              💡 Cliquez sur un pays pour supprimer toutes ses visites, ou sur "Supprimer TOUT" pour purger l'intégralité des données.
            </span>
          </div>
        </div>
      )}

      {/* ─── Graphique + Devices ─── */}

      {/* ─── Graphique + Devices ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <DayChart visitsByDay={stats.visitsByDay} />

        <div
          style={{
            background: 'rgba(20,20,35,0.8)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            padding: 22,
          }}
        >
          <div
            style={{
              color: '#FFF',
              fontWeight: 800,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Monitor size={16} color="#6366F1" />
            Appareils
          </div>
          {[
            { key: 'desktop', label: 'Desktop', Icon: Monitor, color: '#6366F1' },
            { key: 'mobile', label: 'Mobile', Icon: Smartphone, color: '#10B981' },
            { key: 'tablet', label: 'Tablette', Icon: Tablet, color: '#F59E0B' },
          ].map(({ key, label, Icon, color }) => {
            const count = stats.byDevice[key] || 0
            const pct = Math.round((count / deviceTotal) * 100)
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} color={color} />
                    <span style={{ color: '#CCC', fontSize: 13 }}>{label}</span>
                  </div>
                  <span style={{ color, fontWeight: 800, fontSize: 13 }}>
                    {count} ({pct}%)
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: color,
                      borderRadius: 999,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Pays + Villes ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <CountryStats byCountry={stats.byCountry} />

        <div
          style={{
            background: 'rgba(20,20,35,0.8)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            padding: 22,
          }}
        >
          <div style={{ color: '#FFF', fontWeight: 800, marginBottom: 16 }}>
            🏙️ Villes (top 8)
          </div>
          {Object.keys(stats.byCity).length === 0 ? (
            <div style={{ color: '#555', fontSize: 13 }}>Pas encore de données</div>
          ) : (
            Object.entries(stats.byCity)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([city, count]) => (
                <MiniBar
                  key={city}
                  label={city}
                  value={count}
                  max={Math.max(...Object.values(stats.byCity)) || 1}
                  color="#6366F1"
                />
              ))
          )}
        </div>
      </div>

      {/* ─── Sections + CTAs ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: 'rgba(20,20,35,0.8)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            padding: 22,
          }}
        >
          <div style={{ color: '#FFF', fontWeight: 800, marginBottom: 16 }}>
            👁️ Sections les plus vues
          </div>
          {topSections.length === 0 ? (
            <div style={{ color: '#555', fontSize: 13 }}>Pas encore de données</div>
          ) : (
            topSections.map(([section, count]) => (
              <MiniBar
                key={section}
                label={SECTION_LABELS[section] || section}
                value={count}
                max={topSections[0]?.[1] || 1}
                color="#EC4899"
              />
            ))
          )}
        </div>

        <div
          style={{
            background: 'rgba(20,20,35,0.8)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            padding: 22,
          }}
        >
          <div
            style={{
              color: '#FFF',
              fontWeight: 800,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <MousePointer size={16} color="#10B981" />
            CTAs les plus cliqués
          </div>
          {topCTAs.length === 0 ? (
            <div style={{ color: '#555', fontSize: 13 }}>Pas encore de données</div>
          ) : (
            topCTAs.map(([name, count]) => (
              <MiniBar
                key={name}
                label={name.length > 40 ? name.substring(0, 40) + '…' : name}
                value={count}
                max={topCTAs[0]?.[1] || 1}
                color="#10B981"
              />
            ))
          )}
        </div>
      </div>

      {/* ─── Tableau dernières visites ─── */}
      <div
        style={{
          background: 'rgba(20,20,35,0.8)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          padding: 22,
          overflowX: 'auto',
        }}
      >
        <div style={{ color: '#FFF', fontWeight: 800, marginBottom: 16 }}>
          📋 20 dernières visites
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
            {['Date/Heure', 'Pays', 'Ville', 'Device', 'Durée', 'Sections', 'CTAs', 'Récurrent', 'Source', 'Action'].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      color: '#666',
                      fontWeight: 700,
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {stats.rawVisits.slice(0, 20).map((v) => (
              <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '8px 12px', color: '#CCC', whiteSpace: 'nowrap' }}>
                  {new Date(v.created_at).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                  {v.country_code ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{countryFlag(v.country_code)}</span>
                      <span style={{ color: '#CCC', fontSize: 12 }}>{v.country || v.country_code}</span>
                    </span>
                  ) : (
                    <span style={{ color: '#555' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '8px 12px', color: '#888', whiteSpace: 'nowrap' }}>
                  {v.city || '—'}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span
                    style={{
                      background:
                        v.device_type === 'mobile'
                          ? 'rgba(16,185,129,0.15)'
                          : v.device_type === 'tablet'
                          ? 'rgba(245,158,11,0.15)'
                          : 'rgba(99,102,241,0.15)',
                      color:
                        v.device_type === 'mobile'
                          ? '#10B981'
                          : v.device_type === 'tablet'
                          ? '#F59E0B'
                          : '#818CF8',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    {v.device_type || '?'}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: '#CCC', whiteSpace: 'nowrap' }}>
                  {v.duration_seconds < 60
                    ? `${v.duration_seconds}s`
                    : `${Math.floor(v.duration_seconds / 60)}m${v.duration_seconds % 60}s`}
                </td>
                <td style={{ padding: '8px 12px', color: '#888' }}>
                  {(v.sections_viewed || []).length}
                </td>
                <td style={{ padding: '8px 12px', color: '#888' }}>
                  {(v.cta_clicks || []).length}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {v.is_returning ? (
                    <span style={{ color: '#6366F1', fontWeight: 700 }}>✓</span>
                  ) : (
                    <span style={{ color: '#555' }}>Nouveau</span>
                  )}
                </td>
                               <td
                  style={{
                    padding: '8px 12px',
                    color: '#666',
                    maxWidth: 140,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {v.referrer
                    ? (() => { try { return new URL(v.referrer).hostname } catch { return v.referrer } })()
                    : 'Direct'}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleDeleteVisit(v.id)}
                    disabled={deletingVisit}
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#EF4444',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                    }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  )
}