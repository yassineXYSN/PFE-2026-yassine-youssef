import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import humatiqLogo from '../../../assets/logo/humatiqlogo.png'
import { handleLogout } from '../../../core/auth/logout'
import { supabase } from '../../../core/supabaseClient'
import { getUserRole } from '../../../core/api'
import './HRSidebar.css'
import './HRSidebar.css'

function HRSidebar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { effectiveTheme } = useTheme()

    const [userRole, setUserRole] = useState(localStorage.getItem('userRole'))
    const [userData, setUserData] = useState({
        name: localStorage.getItem('userName') || 'Mon Profil',
        avatar: localStorage.getItem('userAvatar') || null
    })

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                // Fetch full profile for name and avatar
                try {
                    const { getUserProfile, getUserRole } = await import('../../../core/api')
                    const [role, profile] = await Promise.all([
                        getUserRole(session),
                        getUserProfile()
                    ])
                    
                    setUserRole(role)
                    if (role) localStorage.setItem('userRole', role)
                    
                    if (profile) {
                        const fullName = `${profile.first_name} ${profile.last_name}`.trim() || 'Mon Profil'
                        setUserData({
                            name: fullName,
                            avatar: profile.avatar_url || null
                        })
                        localStorage.setItem('userName', fullName)
                        if (profile.avatar_url) localStorage.setItem('userAvatar', profile.avatar_url)
                    }
                } catch (err) {
                    console.error('Error fetching sidebar user data:', err)
                }
            }
        }
        fetchUserData()
    }, [])

    const navSections = [
        {
            title: 'Pilotage',
            items: [
                { path: '/hr/dashboard', icon: 'dashboard', label: 'Dashboard', roles: ['admin', 'superadmin', 'recruiter', 'chef_departement'] },
                { path: '/hr/offres', icon: 'work', label: 'Offres', roles: ['admin', 'superadmin', 'recruiter', 'chef_departement'] },
                { path: '/hr/calendrier', icon: 'calendar_today', label: 'Calendrier', roles: ['admin', 'superadmin', 'recruiter', 'chef_departement'] },
            ]
        },
        {
            title: 'Organisation',
            items: [
                { path: '/hr/departement', icon: 'corporate_fare', label: 'Departement', roles: ['admin', 'superadmin'] },
                { path: '/hr/entreprise', icon: 'business', label: 'Entreprise', roles: ['admin', 'superadmin'] },
                { path: '/hr/notifications', icon: 'notifications', label: 'Notifications', roles: ['admin', 'superadmin', 'recruiter', 'chef_departement'] },
                { path: '/hr/team', icon: 'group', label: 'Equipe', roles: ['admin', 'superadmin'] },
                { path: '/hr/parametres', icon: 'settings', label: 'Parametres', roles: ['admin', 'superadmin', 'recruiter', 'chef_departement'] },
            ]
        }
    ]

    const getRoleLabel = (role) => {
        switch (role) {
            case 'admin': return 'Administrateur';
            case 'superadmin': return 'Super Admin';
            case 'recruiter': return 'Recruteur';
            case 'chef_departement': return 'Chef de Dép.';
            default: return 'Utilisateur RH';
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
                        <span>Compte</span>
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
                        <span>Deconnexion</span>
                    </button>
                </div>
            </div>
        </aside>
    )
}

export default HRSidebar
