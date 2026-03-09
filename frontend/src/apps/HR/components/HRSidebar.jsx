import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import humatiqLogo from '../../../assets/logo/humatiqlogo.png'
import { handleLogout } from '../../../core/auth/logout'
import './HRSidebar.css'

function HRSidebar() {
    const location = useLocation()
    const navigate = useNavigate()
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
                {/* Sidebar Header - Brand Logo Only */}
                <Link to="/hr/dashboard" className="hr-sidebar-header brand-header">
                    <img src={humatiqLogo} alt="Humatiq Logo" className="hr-sidebar-brand-logo" />
                </Link>

                {/* Navigation */}
                <nav className="hr-sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`hr-nav-item ${isActive(item.path) ? 'hr-nav-item--active' : ''}`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* Sidebar Footer */}
                <div className="hr-sidebar-footer">
                    <Link
                        to="/hr/profil"
                        className={`hr-nav-item ${isActive('/hr/profil') ? 'hr-nav-item--active' : ''}`}
                    >
                        <span className="material-symbols-outlined">account_circle</span>
                        <span>Mon Profil</span>
                    </Link>
                    <button
                        className="hr-nav-item hr-nav-item--logout"
                        onClick={() => handleLogout(navigate)}
                    >
                        <span className="material-symbols-outlined">logout</span>
                        <span>Déconnexion</span>
                    </button>
                </div>
            </div>
        </aside>
    )
}

export default HRSidebar
