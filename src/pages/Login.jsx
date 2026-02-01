// ═══════════════════════════════════════════════════════════
// 🔐 PAGE DE CONNEXION (Username ou Email)
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Footprints, User, Lock, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const hasherPassword = async (password) => {
    const sel = 'EnCheck_Admin_2024'
    const contenu = `${sel}${password}${sel}`
    const encoder = new TextEncoder()
    const data = encoder.encode(contenu)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const passwordHash = await hasherPassword(password)

      const { data: admin, error: adminError } = await supabase
        .from('admins')
        .select('*, enterprises(*)')
        .or(`email.eq.${identifier.toLowerCase().trim()},username.eq.${identifier.trim()}`)
        .eq('password_hash', passwordHash)
        .eq('is_active', true)
        .single()

      if (adminError || !admin) {
        toast.error('Identifiant ou mot de passe incorrect')
        setLoading(false)
        return
      }

      localStorage.setItem('admin', JSON.stringify(admin))
      toast.success(`Bienvenue ${admin.first_name} !`)
      navigate('/dashboard')
      
    } catch (err) {
      toast.error('Erreur de connexion')
    }

    setLoading(false)
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <Footprints size={50} color="#8B6914" />
        </div>
        
        <h1 style={styles.title}>EN-CHECK</h1>
        <p style={styles.subtitle}>Administration</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              <User size={18} style={styles.icon} />
              Identifiant
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email ou Nom d'utilisateur"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>
              <Lock size={18} style={styles.icon} />
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              required
            />
          </div>

          <button 
            type="submit" 
            style={styles.button}
            disabled={loading}
          >
            {loading ? 'Connexion...' : (
              <>
                <LogIn size={20} />
                Se connecter
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #E5D4C0 0%, #C4A574 100%)',
    padding: '20px',
  },
  card: {
    background: '#FFFBF5',
    borderRadius: '24px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  title: {
    textAlign: 'center',
    color: '#3D2B1F',
    fontSize: '32px',
    fontWeight: '300',
    letterSpacing: '6px',
    marginBottom: '5px',
  },
  subtitle: {
    textAlign: 'center',
    color: '#8B6914',
    fontSize: '14px',
    letterSpacing: '3px',
    marginBottom: '30px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    color: '#3D2B1F',
    fontWeight: '500',
  },
  icon: {
    color: '#8B6914',
  },
  input: {
    padding: '14px 16px',
    border: '2px solid #C4A574',
    borderRadius: '12px',
    fontSize: '16px',
    transition: 'border-color 0.2s ease',
    outline: 'none',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px',
    background: '#8B6914',
    color: '#FFFBF5',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    marginTop: '10px',
    transition: 'background 0.2s ease',
  },
}