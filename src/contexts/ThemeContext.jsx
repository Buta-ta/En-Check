import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const THEME_STORAGE_KEY = 'admin_dark_mode'

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme doit être utilisé dans ThemeProvider')
  }
  return context
}

const getInitialTheme = () => {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(getInitialTheme)

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    document.body.dataset.theme = theme
    document.body.style.backgroundColor = darkMode ? '#171715' : '#F5F2EB'

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, String(darkMode))
    } catch {
      // L’interface reste utilisable si le navigateur bloque le stockage local.
    }
  }, [darkMode])

  const toggleTheme = () => setDarkMode((previous) => !previous)

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
