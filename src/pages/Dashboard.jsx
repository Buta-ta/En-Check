// ═══════════════════════════════════════════════════════════
// 📊 PAGE DASHBOARD (AVEC VÉRIFICATION MODULES)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

import {
  Footprints,
  Building2,
  Users,
  Clock,
  LogOut,
  Plus,
  ChevronRight,
  Shield,
  FileText,
  Calendar,
  AlertTriangle
} from 'lucide-react'
import SystemMessageBanner from '../components/SystemMessageBanner'


export default function Dashboard() {
  const [admin, setAdmin] = useState(null)
  const [stats, setStats] = useState({ entreprises: 0, employes: 0, pointages: 0 })
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)

  // 🔐 MODULES
  const [modulePlanning, setModulePlanning] = useState(false)
  const [moduleRetards, setModuleRetards] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }

    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)

    loadData(parsedAdmin)
  }, [navigate])

  const loadData = async (adminData) => {
    try {
      if (adminData.role === 'super_admin') {
        const { data: entreprisesData } = await supabase
          .from('enterprises')
          .select('*, employees(count)')
          .eq('is_active', true)

        const { count: employesCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })

        const { count: pointagesCount } = await supabase
          .from('attendances')
          .select('*', { count: 'exact', head: true })

        setEntreprises(entreprisesData || [])
        setStats({
          entreprises: entreprisesData?.length || 0,
          employes: employesCount || 0,
          pointages: pointagesCount || 0,
        })

        // Super admin a accès à tout
        setModulePlanning(true)
        setModuleRetards(true)

      } else {
        // Admin entreprise
        const { data: entrepriseData } = await supabase
          .from('enterprises')
          .select('*')
          .eq('id', adminData.enterprise_id)
          .single()

        if (entrepriseData) {
          setAdmin(prev => ({ ...prev, enterprise_name: entrepriseData.name }))

          // 🔐 Vérifier les modules activés
          setModulePlanning(entrepriseData.module_planning || false)
          setModuleRetards(entrepriseData.module_retards || false)
        }

        const { data: employesData } = await supabase
          .from('employees')
          .select('*')
          .eq('enterprise_id', adminData.enterprise_id)

        const { count: pointagesCount } = await supabase
          .from('attendances')
          .select('*', { count: 'exact', head: true })
          .eq('enterprise_id', adminData.enterprise_id)

        setStats({
          entreprises: 1,
          employes: employesData?.length || 0,
          pointages: pointagesCount || 0,
        })
      }
    } catch (error) {
      console.error('Erreur chargement données:', error)
    }

    setLoading(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('admin')
    navigate('/login')
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Footprints size={50} color="#8B6914" />
        <p>Chargement...</p>
      </div>
    )
  }

  const isSuperAdmin = admin?.role === 'super_admin'

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Footprints size={32} color="#FFFBF5" />
          <div>
            <h1 style={styles.headerTitle}>EN-CHECK</h1>
            {!isSuperAdmin && admin?.enterprise_name && (
              <span style={styles.headerSubtitle}>
                {admin.enterprise_name}
              </span>
            )}
          </div>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.adminName}>
            {admin?.first_name} {admin?.last_name}
          </span>
          <span style={styles.adminRole}>
            {isSuperAdmin ? 'Super Admin' : 'Admin'}
          </span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Contenu Principal */}
      <main style={styles.main}>
          <SystemMessageBanner userType="admins" />
        <h2 style={styles.pageTitle}>Tableau de Bord</h2>

        {/* Cartes Statistiques */}
        <div style={styles.statsGrid}>
          {isSuperAdmin && (
            <div style={styles.statCard}>
              <Building2 size={32} color="#8B6914" />
              <div style={styles.statInfo}>
                <span style={styles.statNumber}>{stats.entreprises}</span>
                <span style={styles.statLabel}>Entreprises</span>
              </div>
            </div>
          )}

          <div style={styles.statCard}>
            <Users size={32} color="#8B6914" />
            <div style={styles.statInfo}>
              <span style={styles.statNumber}>{stats.employes}</span>
              <span style={styles.statLabel}>Employés</span>
            </div>
          </div>

          <div style={styles.statCard}>
            <Clock size={32} color="#8B6914" />
            <div style={styles.statInfo}>
              <span style={styles.statNumber}>{stats.pointages}</span>
              <span style={styles.statLabel}>Pointages</span>
            </div>
          </div>
        </div>

        {/* Liste des Entreprises (Super Admin uniquement) */}
        {isSuperAdmin && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Entreprises</h3>
              <button
                style={styles.addBtn}
                onClick={() => navigate('/entreprises')}
              >
                <Plus size={20} />
                Gérer
              </button>
            </div>

            <div style={styles.list}>
              {entreprises.slice(0, 5).map((entreprise) => (
                <div
                  key={entreprise.id}
                  style={styles.listItem}
                  onClick={() => navigate(`/entreprises`)}
                >
                  <div style={styles.listItemLeft}>
                    <Building2 size={24} color="#8B6914" />
                    <div>
                      <span style={styles.listItemName}>{entreprise.name}</span>
                      <span style={styles.listItemSub}>
                        {entreprise.employees?.[0]?.count || 0} employés
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={24} color="#C4A574" />
                </div>
              ))}
            </div>

            {entreprises.length > 5 && (
              <button
                onClick={() => navigate('/entreprises')}
                style={styles.viewAllBtn}
              >
                Voir toutes les entreprises ({entreprises.length})
              </button>
            )}
          </div>
        )}

        {/* Actions rapides */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Actions Rapides</h3>
          <div style={styles.actionsGrid}>
            <button
              style={styles.actionBtn}
              onClick={() => navigate('/employes')}
            >
              <Users size={24} />
              <span>Gérer les employés</span>
            </button>
            <button
              style={styles.actionBtn}
              onClick={() => navigate('/pointages')}
            >
              <Clock size={24} />
              <span>Voir les pointages</span>
            </button>

            {/* 🔐 Bouton Planning */}
            {modulePlanning && (
              <button
                style={styles.actionBtn}
                onClick={() => navigate('/planning')}
              >
                <Calendar size={24} />
                <span>Planning horaires</span>
              </button>
            )}

            {/* 🔐 Bouton Retards */}
            {moduleRetards && (
              <button
                style={{ ...styles.actionBtn, background: '#FEE2E2' }}
                onClick={() => navigate('/retards')}
              >
                <AlertTriangle size={24} color="#9B2C2C" />
                <span style={{ color: '#9B2C2C' }}>Gestion retards</span>
              </button>
            )}

            <button
              style={styles.actionBtn}
              onClick={() => navigate('/rapports')}
            >
              <FileText size={24} />
              <span>Télécharger rapports</span>
            </button>
            {isSuperAdmin && (
              <button
                style={styles.actionBtn}
                onClick={() => navigate('/admins')}
              >
                <Shield size={24} />
                <span>Gérer les admins</span>
              </button>
            )}

            {isSuperAdmin && (
              <button
                style={styles.actionBtn}
                onClick={() => navigate('/system-messages')}
              >
                <AlertTriangle size={24} />
                <span>Messages Système</span>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#E5D4C0',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    color: '#8B6914',
  },
  header: {
    background: '#3D2B1F',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerTitle: {
    color: '#FFFBF5',
    fontSize: '24px',
    fontWeight: '300',
    letterSpacing: '4px',
  },
  headerSubtitle: {
    color: '#C4A574',
    fontSize: '14px',
    fontWeight: '500',
    letterSpacing: '1px',
    display: 'block',
    marginTop: '-4px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  adminName: {
    color: '#FFFBF5',
    fontWeight: '500',
  },
  adminRole: {
    color: '#C4A574',
    fontSize: '14px',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '8px',
    padding: '8px',
    color: '#FFFBF5',
    cursor: 'pointer',
  },
  main: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  pageTitle: {
    color: '#3D2B1F',
    fontSize: '28px',
    fontWeight: '300',
    marginBottom: '24px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  statCard: {
    background: '#FFFBF5',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  statNumber: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  statLabel: {
    fontSize: '14px',
    color: '#9E9E9E',
  },
  section: {
    marginBottom: '32px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    color: '#3D2B1F',
    fontSize: '20px',
    fontWeight: '500',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#8B6914',
    color: '#FFFBF5',
    padding: '10px 20px',
    borderRadius: '10px',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
  },
  list: {
    background: '#FFFBF5',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #E5D4C0',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  listItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  listItemName: {
    display: 'block',
    fontWeight: '500',
    color: '#3D2B1F',
  },
  listItemSub: {
    display: 'block',
    fontSize: '14px',
    color: '#9E9E9E',
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#FFFBF5',
    padding: '20px',
    borderRadius: '12px',
    color: '#3D2B1F',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s ease',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  viewAllBtn: {
    width: '100%',
    padding: '12px',
    marginTop: '12px',
    background: 'none',
    border: '2px solid #C4A574',
    borderRadius: '10px',
    color: '#8B6914',
    fontWeight: '500',
    cursor: 'pointer',
  },
}