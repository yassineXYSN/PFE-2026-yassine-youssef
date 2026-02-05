import { useTheme } from '../context/ThemeContext'
import './HRHeader.css'

/**
 * Shared header bar component for all HR application pages
 * Features: Logo, company name, theme toggle button
 */
function HRHeader({ minimal = false }) {
    const { theme, cycleTheme, getThemeIcon, getThemeLabel } = useTheme()

    return (
        <header className={`hr-header ${minimal ? 'hr-header--minimal' : ''}`}>
            {!minimal && (
                <div className="hr-header__branding">
                    <div className="hr-header__logo">
                        <span className="material-symbols-outlined">corporate_fare</span>
                    </div>
                    <span className="hr-header__text">RH Recrutement IA</span>
                </div>
            )}

            <button
                type="button"
                className="hr-header__theme-btn"
                onClick={cycleTheme}
                aria-label={`Thème actuel: ${getThemeLabel()}`}
            >
                <span className="material-symbols-outlined">{getThemeIcon()}</span>
                <span className="hr-header__theme-text">{getThemeLabel()}</span>
            </button>
        </header>
    )
}

export default HRHeader
