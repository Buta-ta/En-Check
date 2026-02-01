import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employes from './pages/Employes'
import Pointages from './pages/Pointages'
import Entreprises from './pages/Entreprises'
import Rapports from './pages/Rapports'
import Admins from './pages/Admins'
import Planning from './pages/Planning'
import Retards from './pages/Retards'
import { Toaster } from 'react-hot-toast'
import SystemMessages from './pages/SystemMessages'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toaster position="top-center" /> 
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/employes" element={<Employes />} />
          <Route path="/pointages" element={<Pointages />} />
          <Route path="/entreprises" element={<Entreprises />} />
          <Route path="/rapports" element={<Rapports />} />
          <Route path="/admins" element={<Admins />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/retards" element={<Retards />} />
          <Route path="/system-messages" element={<SystemMessages />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App