import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../../../core/useLanguage'
import { useNotifications } from '../../../core/hooks/useNotifications'
import HRNotificationDropdown from './HRNotificationDropdown'
import './HRHeader.css'

/**
 * Shared header bar component for all HR application pages
 */
function HRHeader({ minimal = false }) {
    const { theme, cycleTheme, getThemeIcon, getThemeLabel } = useTheme()
    const { t } = useLanguage()
    const { notifications, unreadCount, markAsRead, markAllAsRead, fetchUnreadCount } = useNotifications()
    const [showNotifs, setShowNotifs] = useState(false)
    const dropdownRef = useRef(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowNotifs(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <header className={`hr-header ${minimal ? 'hr-header--minimal' : ''}`}>
            {!minimal && (
                <div className="hr-header__branding">
                    <div className="hr-header__logo">
                        <span className="material-symbols-outlined">corporate_fare</span>
                    </div>
                    <span className="hr-header__text">{t('hr-header-branding')}</span>
                </div>
            )}

            <div className="hr-header__actions">
                <div className="hr-header__notif-wrapper" ref={dropdownRef}>
                    <button 
                        className="hr-header__notif-btn" 
                        onClick={() => setShowNotifs(!showNotifs)}
                        aria-label={t('hr-header-notifications-aria')}
                    >
                        <span className="material-symbols-outlined">notifications</span>
                        {unreadCount > 0 && <span className="hr-header__notif-badge">{unreadCount}</span>}
                    </button>
                    
                    {showNotifs && (
                        <HRNotificationDropdown 
                            notifications={notifications}
                            onClose={() => setShowNotifs(false)}
                            onMarkRead={markAsRead}
                            onMarkAllRead={markAllAsRead}
                        />
                    )}
                </div>

                <button
                    type="button"
                    className="hr-header__theme-btn"
                    onClick={cycleTheme}
                    aria-label={`Thème actuel: ${getThemeLabel()}`}
                >
                    <span className="material-symbols-outlined">{getThemeIcon()}</span>
                    <span className="hr-header__theme-text">{getThemeLabel()}</span>
                </button>
            </div>
        </header>
    )
}

export default HRHeader
