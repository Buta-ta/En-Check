import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

/* ── D-005 — le thème ─────────────────────────────────────────────────────
   Clé `encheck.theme`, valeurs `clair` / `sombre`, clair par défaut,
   un seul bouton à deux états (D-005 bis : lune en clair, soleil en sombre).
   Le choix est mémorisé ; l'ancien choix (encheck_admin_dark_mode_v2) est
   migré une fois, silencieusement. */
const THEME_STORAGE_KEY = 'encheck.theme'
const THEME_LEGACY_KEY = 'encheck_admin_dark_mode_v2'
const THEME_DATASET = { clair: 'light', sombre: 'dark' }

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme doit être utilisé dans ThemeProvider')
  }
  return context
}

const getInitialTheme = () => {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'clair' || saved === 'sombre') return saved
    /* Migration : l'ancien bouton mémorisait un booléen de mode sombre. */
    const legacy = window.localStorage.getItem(THEME_LEGACY_KEY)
    if (legacy === null) return 'clair'
    return legacy !== 'false' ? 'sombre' : 'clair'
  } catch {
    return 'clair'
  }
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const datasetTheme = THEME_DATASET[theme] ?? 'light'
    document.documentElement.dataset.theme = datasetTheme
    document.body.dataset.theme = datasetTheme
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // L'interface reste utilisable si le navigateur bloque le stockage local.
    }
  }, [theme])

  const toggleTheme = () =>
    setTheme((previous) => (previous === 'clair' ? 'sombre' : 'clair'))

  /* Compatibilité avec les composants existants (darkMode / setDarkMode). */
  const darkMode = theme === 'sombre'
  const setDarkMode = (valeur) => setTheme(valeur ? 'sombre' : 'clair')

  return (
    <ThemeContext.Provider value={{ theme, setTheme, darkMode, setDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
