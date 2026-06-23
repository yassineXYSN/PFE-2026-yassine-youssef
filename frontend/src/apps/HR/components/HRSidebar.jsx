import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../../../core/useLanguage'
import humatiqLogo from '../../../assets/logo/humatiqlogo.png'
import { handleLogout } from '../../../core/auth/logout'
import { supabase } from '../../../core/supabaseClient'
import { getUserRole, SERVER_URL } from '../../../core/api'
import './HRSidebar.css'

function HRSidebar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { effectiveTheme } = useTheme()
    const { t } = useLanguage()

    const [userRole, setUserRole] = useState(null)
    const [userData, setUserData] = useState({ name: t('hr-sidebar-footer-my-profile'), avatar: null })

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const sessionUserId = session.user.id
            const cachedUserId = localStorage.getItem('userId')

            // If a different user is cached, clear stale data immediately
            if (cachedUserId && cachedUserId !== sessionUserId) {
                localStorage.removeItem('userAvatar')
                localStorage.removeItem('userName')
                localStorage.removeItem('userRole')
                localStorage.removeItem('userId')
            } else if (cachedUserId === sessionUserId) {
                // Same user — seed state from cache while real fetch completes
                const cachedAvatar = localStorage.getItem('userAvatar')
                setUserRole(localStorage.getItem('userRole'))
                setUserData({
                    name: localStorage.getItem('userName') || t('hr-sidebar-footer-my-profile'),
                    avatar: cachedAvatar
                        ? (cachedAvatar.startsWith('http') ? cachedAvatar : `${SERVER_URL}${cachedAvatar}`)
                        : null
                })
            }

            try {
                const { getUserProfile, getUserRole } = await import('../../../core/api')
                const [role, profile] = await Promise.all([
                    getUserRole(session),
                    getUserProfile()
                ])

                setUserRole(role)
                localStorage.setItem('userRole', role)
                localStorage.setItem('userId', sessionUserId)

                if (profile) {
                    const fullName = `${profile.first_name} ${profile.last_name}`.trim() || t('hr-sidebar-footer-my-profile')
                    const avatarUrl = profile.avatar_url
                        ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : `${SERVER_URL}${profile.avatar_url}`)
                        : null
                    setUserData({ name: fullName, avatar: avatarUrl })
                    localStorage.setItem('userName', fullName)
                    if (avatarUrl) localStorage.setItem('userAvatar', avatarUrl)
                    else localStorage.removeItem('userAvatar')
                }
            } catch (err) {
                console.error('Error fetching sidebar user data:', err)
            }
        }
        fetchUserData()
    }, [])

    const navSections = [
        {
            title: t('hr-sidebar-section-pilotage'),
            items: [
                { path: '/hr/dashboard', icon: 'dashboard', label: t('hr-sidebar-nav-dashboard'), roles: ['admin', 'superadmin', 'recruiter', 'chef_departement'] },
                { path: '/hr/offres', icon: 'work', label: t('hr-sidebar-nav-offres'), roles: ['admin', 'superadmin', 'recruiter', 'chef_departement'] },
                { path: '/hr/calendrier', icon: 'calendar_today', label: t('hr-sidebar-nav-calendrier'), roles: ['admin', 'superadmin', 'recruiter', 'chef_departement'] },
            ]
        },
        {
            title: t('hr-sidebar-section-organisation'),
            items: [
                { path: '/hr/departement', icon: 'corporate_fare', label: t('hr-sidebar-nav-departement'), roles: ['admin', 'superadmin'] },
                { path: '/hr/entreprise', icon: 'business', label: t('hr-sidebar-nav-entreprise'), roles: ['admin', 'superadmin'] },
                { path: '/hr/notifications', icon: 'notifications', label: t('hr-sidebar-nav-notifications'), roles: ['admin', 'superadmin', 'recruiter', 'chef_departement'] },
                { path: '/hr/team', icon: 'group', label: t('hr-sidebar-nav-equipe'), roles: ['admin', 'superadmin'] },
                { path: '/hr/parametres', icon: 'settings', label: t('hr-sidebar-nav-parametres'), roles: ['admin', 'superadmin', 'recruiter', 'chef_departement'] },
            ]
        }
    ]

    const getRoleLabel = (role) => {
        switch (role) {
            case 'admin': return t('hr-sidebar-role-admin');
            case 'superadmin': return t('hr-sidebar-role-superadmin');
            case 'recruiter': return t('hr-sidebar-role-recruiter');
            case 'chef_departement': return t('hr-sidebar-role-chef-departement');
            default: return t('hr-sidebar-role-default');
        }
    }

    const isActive = (path) => location.pathname === path

    return (
        <aside className={`hr-sidebar ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <div className="hr-sidebar-content">
                <Link to="/hr/dashboard" className="hr-sidebar-header brand-header">
                    <img src={humatiqLogo} alt="Humatiq Logo" className="hr-sidebar-brand-logo" />
                </Link>

                <nav className="hr-sidebar-nav">
                    {navSections.map((section) => (
                        <div key={section.title} className="hr-nav-section">
                            <div className="hr-nav-section-title">{section.title}</div>
                            <div className="hr-nav-section-items">
                                {section.items.map((item) => {
                                    // Hide item if user role is not in allowed roles
                                    if (item.roles && !item.roles.includes(userRole)) {
                                        return null;
                                    }
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`hr-nav-item ${isActive(item.path) ? 'hr-nav-item--active' : ''}`}
                                        >
                                            <span className="material-symbols-outlined">{item.icon}</span>
                                            <span>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="hr-sidebar-footer">
                    <div className="hr-nav-section-title hr-nav-section-title--footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span>{t('hr-sidebar-footer-account')}</span>
                        {userRole && (
                            <span style={{
                                padding: '2px 8px',
                                background: '#FFD700',
                                color: '#000',
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                                fontWeight: '800',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                marginLeft: '8px',
                                border: '1px solid rgba(0,0,0,0.1)'
                            }}>
                                {getRoleLabel(userRole)}
                            </span>
                        )}
                    </div>
                    <Link
                        to="/hr/profil"
                        className={`hr-nav-item hr-nav-item--profile ${isActive('/hr/profil') ? 'hr-nav-item--active' : ''}`}
                    >
                        <div className="hr-user-avatar">
                            {userData.avatar ? (
                                <img src={userData.avatar} alt="Avatar" />
                            ) : (
                                <span className="material-symbols-outlined">account_circle</span>
                            )}
                        </div>
                        <span className="hr-user-name">{userData.name}</span>
                    </Link>
                    <button
                        className="hr-nav-item hr-nav-item--logout"
                        onClick={() => handleLogout(navigate)}
                    >
                        <span className="material-symbols-outlined">logout</span>
                        <span>{t('hr-sidebar-footer-logout')}</span>
                    </button>
                </div>
            </div>
        </aside>
    )
}

export default HRSidebar
