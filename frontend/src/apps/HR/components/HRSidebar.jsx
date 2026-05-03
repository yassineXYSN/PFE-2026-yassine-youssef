import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import humatiqLogo from '../../../assets/logo/humatiqlogo.png'
import { handleLogout } from '../../../core/auth/logout'
import './HRSidebar.css'

function HRSidebar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { effectiveTheme } = useTheme()

    const navSections = [
        {
            title: 'Pilotage',
            items: [
                { path: '/hr/dashboard', icon: 'dashboard', label: 'Dashboard' },
                { path: '/hr/offres', icon: 'work', label: 'Offres' },
                { path: '/hr/calendrier', icon: 'calendar_today', label: 'Calendrier' },
            ]
        },
        {
            title: 'Organisation',
            items: [
                { path: '/hr/departement', icon: 'corporate_fare', label: 'Departement' },
                { path: '/hr/entreprise', icon: 'business', label: 'Entreprise' },
                { path: '/hr/notifications', icon: 'notifications', label: 'Notifications' },
                { path: '/hr/parametres', icon: 'settings', label: 'Parametres' },
            ]
        }
    ]

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
                                {section.items.map((item) => (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`hr-nav-item ${isActive(item.path) ? 'hr-nav-item--active' : ''}`}
                                    >
                                        <span className="material-symbols-outlined">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="hr-sidebar-footer">
                    <div className="hr-nav-section-title hr-nav-section-title--footer">Compte</div>
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
                        <span>Deconnexion</span>
                    </button>
                </div>
            </div>
        </aside>
    )
}

export default HRSidebar
