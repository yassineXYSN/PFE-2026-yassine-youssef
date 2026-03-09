import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import humatiqLogo from '../../../assets/logo/humatiqlogo.png';
import { handleLogout } from '../../../core/auth/logout';
import './SuperAdminSidebar.css';

const SuperAdminSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { effectiveTheme } = useTheme();

    const menuItems = [
        { path: '/superadmin/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { path: '/superadmin/companies', icon: 'business', label: 'Entreprises' },
        { path: '/superadmin/users', icon: 'group', label: 'Utilisateurs' },
        { path: '/superadmin/settings', icon: 'settings', label: 'Paramètres' },
    ];

    const isActive = (path) => location.pathname.startsWith(path);

    return (
        <aside className={`superadmin-sidebar ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <div className="sidebar-header sa-sidebar-header">
                <Link to="/superadmin/dashboard" className="sa-sidebar-brand">
                    <img src={humatiqLogo} alt="Humatiq Logo" className="sa-sidebar-logo" />
                </Link>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map((item) => (
                    <button
                        key={item.path}
                        className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                        onClick={() => navigate(item.path)}
                    >
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="footer-links">
                    <button className="footer-link-item logout" onClick={() => handleLogout(navigate)}>
                        <span className="material-symbols-outlined">logout</span>
                        <span>Déconnexion</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default SuperAdminSidebar;
