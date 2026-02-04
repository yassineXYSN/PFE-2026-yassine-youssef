import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

/**
 * Provider component for theme state
 */
export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('hr-theme') || 'system'
    })

    // Calculate effective theme based on system preference
    const getEffectiveTheme = () => {
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            return prefersDark ? 'dark' : 'light'
        }
        return theme
    }

    const [effectiveTheme, setEffectiveTheme] = useState(getEffectiveTheme)

    useEffect(() => {
        setEffectiveTheme(getEffectiveTheme())

        // Listen for system theme changes when in 'system' mode
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            const handler = () => setEffectiveTheme(getEffectiveTheme())

            mediaQuery.addEventListener('change', handler)
            return () => mediaQuery.removeEventListener('change', handler)
        }
    }, [theme])

    const cycleTheme = () => {
        const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
        setTheme(nextTheme)
        localStorage.setItem('hr-theme', nextTheme)
    }

    const getThemeIcon = () => {
        if (theme === 'system') return 'brightness_auto'
        if (theme === 'light') return 'light_mode'
        return 'dark_mode'
    }

    const getThemeLabel = () => {
        if (theme === 'system') return 'Système'
        if (theme === 'light') return 'Clair'
        return 'Sombre'
    }

    const value = {
        theme,
        effectiveTheme,
        cycleTheme,
        getThemeIcon,
        getThemeLabel
    }

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    )
}

/**
 * Hook to use the theme context
 */
export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
