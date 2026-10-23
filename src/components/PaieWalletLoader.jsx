import { useTheme } from '../contexts/ThemeContext'
import '../pages/PaieAfroTech.css'
import './PaieWalletLoader.css'

// Stays in the editor tree: a hidden, still-mounted editor must not show a loader.
export default function PaieWalletLoader({ label = 'Chargement de la fiscalité…' }) {
  const { darkMode } = useTheme()
  return <div className="paie-page pw-wallet-loading" data-theme={darkMode ? 'dark' : 'light'} role="status" aria-live="polite">
    <svg viewBox="0 0 180 130" aria-hidden="true" className="pw-wallet-animation">
      <path d="M35 66Q35 57 47 57H140V103H35Z" fill="#68412c"/>
      <g className="pw-wallet-coin"><circle cx="88" cy="25" r="18" fill="#edc779" stroke="#93602e" strokeWidth="2"/><circle cx="88" cy="25" r="13" fill="none" stroke="#93602e"/><path d="m88 17 6 8-6 8-6-8Z" fill="#93602e"/></g>
      <path d="M32 72Q32 65 42 65H143Q150 65 150 74V110Q150 117 140 117H42Q32 117 32 107Z" fill="#ad693e" stroke="#704329" strokeWidth="2"/>
      <path d="M40 76V104Q40 109 47 109H136" fill="none" stroke="#edc779" strokeDasharray="3 4"/>
      <path d="M127 81H155V102H127Q116 91 127 81Z" fill="#71482f" stroke="#edc779"/><circle cx="134" cy="91" r="3" fill="#edc779"/>
    </svg><div><strong>{label}</strong><p>Nous préparons vos données. Encore un instant.</p></div>
  </div>
}
