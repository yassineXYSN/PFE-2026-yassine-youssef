import { useState, useEffect } from 'react'

// Gestion centralisée du thème HR (system / light / dark)
export function useHrTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('hr-theme') || 'system'
    }
    return 'system'
  })

  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      if (theme === 'system') {
        setIsDark(mediaQuery.matches)
      } else {
        setIsDark(theme === 'dark')
      }
      window.localStorage.setItem('hr-theme', theme)
    }

    applyTheme()

    const listener = (e) => {
      if (theme === 'system') {
        setIsDark(e.matches)
      }
    }

    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === 'system') return 'light'
      if (prev === 'light') return 'dark'
      return 'system'
    })
  }

  const getThemeLabel = () => {
    if (theme === 'system') return 'Système'
    if (theme === 'light') return 'Mode Clair'
    return 'Mode Sombre'
  }

  const getThemeIcon = () => {
    if (theme === 'system') return 'settings_brightness'
    if (theme === 'light') return 'light_mode'
    return 'dark_mode'
  }

  return {
    isDark,
    theme,
    toggleTheme,
    getThemeLabel,
    getThemeIcon,
  }
}

