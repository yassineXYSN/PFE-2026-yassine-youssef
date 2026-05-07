import { NavLink, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../../../core/useLanguage';
import UserProfileCard from '../UserProfileCard/UserProfileCard';
import { useNotifications } from '../../../../../core/hooks/useNotifications';
import { useActiveInterview } from '../../../../../core/hooks/useActiveInterview';


import { handleLogout as logoutService } from '../../../../../core/auth/logout';
import './Sidebar.css';
import './SidebarLight.css';
import humatiqLogo from '../../../../../assets/logo/humatiqlogo.png';
import humatiqLogoSmall from '../../../../../assets/logo/humatiqlogosmall.png';

const Sidebar = ({ className = '', onClose }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { activeInterview } = useActiveInterview();

  const navItems = [
    {
      key: 'sidebar-dashboard',
      icon: 'grid_view',
      path: '/candidat/dashboard',
    },
    {
      key: 'sidebar-find-jobs',
      icon: 'work',
      path: '/candidat/dashboard/find-jobs',
    },
    {
      key: 'sidebar-my-submissions',
      icon: 'assignment',
      path: '/candidat/dashboard/my-submissions',
    },
    {
      key: 'sidebar-my-interviews',
      icon: 'videocam',
      path: '/candidat/dashboard/interviews',
    },
    {
      key: 'sidebar-notifications',
      icon: 'notifications',
      path: '/candidat/dashboard/notifications',
      badge: unreadCount
    },
    {
      key: 'sidebar-settings',
      icon: 'settings',
      path: '/candidat/dashboard/settings',
    },
  ];

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleLogout = async () => {
    await logoutService(navigate, '/candidat/login');
  };

  return (
    <aside className={`dashboard-sidebar ${className}`}>
      <div className="dashboard-sidebar__top">
        <div className="dashboard-sidebar__brand">
          <img src={humatiqLogo} alt="HumatiQ Logo Full" className="dashboard-sidebar__logo dashboard-sidebar__logo--full" />
          <img src={humatiqLogoSmall} alt="HumatiQ Logo Small" className="dashboard-sidebar__logo dashboard-sidebar__logo--small" />
        </div>
        {onClose ? (
          <button
            type="button"
            className="dashboard-sidebar__close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        ) : null}
      </div>

      <UserProfileCard onClick={() => navigate('/candidat/dashboard/profile')} />

      <nav className="dashboard-sidebar__nav">
        {activeInterview && (
          <div 
            className="dashboard-sidebar__live-alert"
            onClick={() => navigate(`/candidat/interviews/room/${activeInterview._id}`)}
          >
            <div className="dashboard-sidebar__live-pulse"></div>
            <div className="dashboard-sidebar__live-content">
              <span className="dashboard-sidebar__live-title">
                {t('sidebar-live-interview-title')}
              </span>
              <span className="dashboard-sidebar__live-subtitle">
                {t('sidebar-live-interview-join')}
              </span>
            </div>
          </div>
        )}
        {navItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.path === '/candidat/dashboard'}
            className={({ isActive }) =>
              `dashboard-sidebar__link ${isActive ? 'is-active' : ''}`
            }
            onClick={handleNavClick}
          >
            <div className="dashboard-sidebar__link-content">
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              <span>{t(item.key)}</span>
              {item.badge > 0 && <span className="dashboard-sidebar__badge">{item.badge}</span>}
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="dashboard-sidebar__footer">

        <button
          type="button"
          className="dashboard-sidebar__logout"
          onClick={handleLogout}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            logout
          </span>
          <span>{t('sidebar-logout')}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
