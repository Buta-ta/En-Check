// src/components/EmployeeRoute.jsx
// ═══════════════════════════════════════════════════════════
// 🛡️ PROTECTION DES ROUTES EMPLOYÉ
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import EmployeeAuthService from '../services/employeeAuthService'

export default function EmployeeRoute({ children, requiredFeature = null }) {
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [redirectTo, setRedirectTo] = useState('/employee/login')

  useEffect(() => {
    const checkAuth = () => {
      try {
        // ✅ Utilise isLoggedIn() qui vérifiera l'expiration
        // après qu'on aura mis à jour employeeAuthService.js
        const isLoggedIn = EmployeeAuthService.isLoggedIn()
        const employee = EmployeeAuthService.getEmployee()

        // Pas connecté ou session expirée
        if (!isLoggedIn || !employee) {
          EmployeeAuthService.logout()
          setRedirectTo('/employee/login')
          setAuthorized(false)
          setChecking(false)
          return
        }

        // ✅ Vérification expiration de session
        if (employee.expiresAt && Date.now() > employee.expiresAt) {
          EmployeeAuthService.logout()
          setRedirectTo('/employee/login')
          setAuthorized(false)
          setChecking(false)
          return
        }

        // ✅ Feature requise mais pas active
        if (requiredFeature && employee.features) {
          if (!employee.features[requiredFeature]) {
            setRedirectTo('/employee/dashboard')
            setAuthorized(false)
            setChecking(false)
            return
          }
        }

        // ✅ Tout est OK
        setAuthorized(true)
        setChecking(false)

      } catch {
        EmployeeAuthService.logout()
        setRedirectTo('/employee/login')
        setAuthorized(false)
        setChecking(false)
      }
    }

    checkAuth()
  }, [requiredFeature])

  // ✅ Écran de chargement pendant la vérification
  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#06060B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(16, 185, 129, 0.2)',
          borderTopColor: '#10B981',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>
          Vérification de la session...
        </p>
      </div>
    )
  }

  if (!authorized) {
    return <Navigate to={redirectTo} replace />
  }

  return children
}