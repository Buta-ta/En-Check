import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { ArrowLeft, Footprints, Sun, Moon } from 'lucide-react'

export default function PageHeader({ title, showBackButton = true }) {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()

  const styles = {
    header: { 
      background: darkMode ? '#2d2d2d' : '#3D2B1F', 
      padding: '16px 24px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      transition: 'background 0.3s ease'
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
    backBtn: { 
      background: 'rgba(255,255,255,0.1)', 
      border: 'none', 
      borderRadius: '8px', 
      padding: '8px', 
      color: '#FFFBF5', 
      cursor: 'pointer' 
    },
    headerTitle: { 
      color: '#FFFBF5', 
      fontSize: '24px', 
      fontWeight: '300', 
      letterSpacing: '4px' 
    },
    themeToggle: {
      background: 'rgba(255,255,255,0.1)',
      border: 'none',
      borderRadius: '8px',
      padding: '8px',
      color: '#FFFBF5',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s ease'
    }
  }

  return (
    <header style={styles.header}>
      <div style={styles.headerLeft}>
        {showBackButton && (
          <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
            <ArrowLeft size={24} />
          </button>
        )}
        <Footprints size={32} color="#FFFBF5" />
        <h1 style={styles.headerTitle}>{title}</h1>
      </div>
      
      <button 
        onClick={toggleTheme} 
        style={styles.themeToggle}
        title={darkMode ? 'Mode clair' : 'Mode sombre'}
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </header>
  )
}