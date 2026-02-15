import { useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import './HRSidebar.css'

function HRSidebar() {
    const location = useLocation()
    const { effectiveTheme } = useTheme()

    const navItems = [
        { path: '/hr/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { path: '/hr/candidats', icon: 'group', label: 'Candidats' },
        { path: '/hr/offres', icon: 'work', label: 'Offres' },
        { path: '/hr/departement', icon: 'corporate_fare', label: 'Département' },
        { path: '/hr/entreprise', icon: 'business', label: 'Entreprise' },
        { path: '/hr/parametres', icon: 'settings', label: 'Paramètres' },

    ]

    const isActive = (path) => location.pathname === path

    return (
        <aside className={`hr-sidebar ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <div className="hr-sidebar-content">
                {/* Sidebar Header */}
                <a href="/hr/profil" className="hr-sidebar-header">
                    <div className="hr-sidebar-logo"></div>
                    <div className="hr-sidebar-header-text">
                        <h1 className="hr-sidebar-title">RecruitAI</h1>
                        <p className="hr-sidebar-subtitle">Admin Dashboard</p>
                    </div>
                </a>

                {/* Navigation */}
                <nav className="hr-sidebar-nav">
                    {navItems.map((item) => (
                        <a
                            key={item.path}
                            href={item.path}
                            className={`hr-nav-item ${isActive(item.path) ? 'hr-nav-item--active' : ''}`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span>{item.label}</span>
                        </a>
                    ))}
                </nav>

                {/* Sidebar Footer */}
                <div className="hr-sidebar-footer">
                    <button className="hr-nav-item hr-nav-item--logout">
                        <span className="material-symbols-outlined">logout</span>
                        <span>Déconnexion</span>
                    </button>
                </div>
            </div>
        </aside>
    )
}

export default HRSidebar
