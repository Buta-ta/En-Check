export const getThemeColors = (darkMode) => ({
  // Backgrounds
  bgPrimary: darkMode ? '#1a1a1a' : '#E5D4C0',
  bgSecondary: darkMode ? '#2d2d2d' : '#FFFBF5',
  bgCard: darkMode ? '#2d2d2d' : '#FFFBF5',
  bgHeader: darkMode ? '#2d2d2d' : '#3D2B1F',
  
  // Textes
  textPrimary: darkMode ? '#FFFBF5' : '#3D2B1F',
  textSecondary: darkMode ? '#aaa' : '#9E9E9E',
  textTertiary: darkMode ? '#888' : '#6B7280',
  
  // Accents
  accent: '#8B6914',
  accentLight: '#C4A574',
  accentDark: '#3D2B1F',
  
  // États
  success: '#4A7C59',
  error: '#9B2C2C',
  warning: '#92400E',
  
  // Bordures
  border: darkMode ? '#3d3d3d' : '#E5D4C0',
  borderLight: darkMode ? '#4d4d4d' : '#C4A574',
})

export const getCommonStyles = (darkMode) => {
  const colors = getThemeColors(darkMode)
  
  return {
    container: { 
      minHeight: '100vh', 
      background: colors.bgPrimary,
      transition: 'background 0.3s ease'
    },
    
    header: { 
      background: colors.bgHeader, 
      padding: '16px 24px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      transition: 'background 0.3s ease'
    },
    
    headerLeft: { 
      display: 'flex', 
      alignItems: 'center', 
      gap: '16px' 
    },
    
    headerTitle: { 
      color: '#FFFBF5', 
      fontSize: '24px', 
      fontWeight: '300', 
      letterSpacing: '4px' 
    },
    
    backBtn: { 
      background: 'rgba(255,255,255,0.1)', 
      border: 'none', 
      borderRadius: '8px', 
      padding: '8px', 
      color: '#FFFBF5', 
      cursor: 'pointer' 
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
    },
    
    card: {
      background: colors.bgCard,
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      transition: 'background 0.3s ease'
    },
    
    input: {
      padding: '12px 14px',
      border: `2px solid ${colors.border}`,
      borderRadius: '10px',
      fontSize: '15px',
      outline: 'none',
      background: colors.bgCard,
      color: colors.textPrimary,
      transition: 'all 0.3s ease'
    },
    
    select: {
      padding: '12px 14px',
      border: `2px solid ${colors.border}`,
      borderRadius: '10px',
      fontSize: '15px',
      outline: 'none',
      background: colors.bgCard,
      color: colors.textPrimary,
      transition: 'all 0.3s ease'
    },
    
    button: {
      padding: '12px 24px',
      background: colors.accent,
      color: '#FFFBF5',
      border: 'none',
      borderRadius: '10px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background 0.2s ease'
    },
    
    text: {
      color: colors.textPrimary
    },
    
    textSecondary: {
      color: colors.textSecondary
    }
  }
}