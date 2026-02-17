import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import SuperAdminSidebar from '../components/SuperAdminSidebar';
import './Settings.css';

const Settings = () => {
    const { theme, setTheme, effectiveTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'security', 'appearance'

    const [settings, setSettings] = useState({
        platformName: 'HR Platform',
        supportEmail: 'support@hrplatform.com',
        defaultLanguage: 'fr',
        timezone: 'Europe/Paris',
        maxUsers: 100,
        maxJobs: 50,
        storageLimit: 10,
        apiRateLimit: 1000,
        emailNotifications: true,
        activityAlerts: true,
        maintenanceMode: false,
        linkedinIntegration: true,
        indeedIntegration: false,
        autoBackup: true,
        backupFrequency: 'daily'
    });

    const [securitySettings, setSecuritySettings] = useState({
        minPasswordLength: 8,
        requireComplexPassword: true,
        sessionTimeout: 30,
        require2FA: false,
        ipWhitelist: ''
    });

    const auditLogs = [
        { id: 1, timestamp: '2024-02-17 11:45:23', user: 'admin@platform.com', company: 'TechNova', action: 'Entreprise créée', ip: '192.168.1.100', status: 'success' },
        { id: 2, timestamp: '2024-02-17 11:32:15', user: 'marie@technova.com', company: 'TechNova', action: 'Utilisateur ajouté', ip: '192.168.1.105', status: 'success' },
        { id: 3, timestamp: '2024-02-17 11:15:42', user: 'unknown', company: '-', action: 'Tentative de connexion', ip: '45.142.212.61', status: 'failed' },
        { id: 4, timestamp: '2024-02-17 10:58:30', user: 'jean@digitalcorp.com', company: 'Digital Corp', action: 'Offre publiée', ip: '192.168.1.110', status: 'success' },
        { id: 5, timestamp: '2024-02-17 10:45:18', user: 'admin@platform.com', company: 'StartupX', action: 'Compte suspendu', ip: '192.168.1.100', status: 'warning' },
    ];

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className={`sa-settings-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <SuperAdminSidebar />

            <main className="sa-settings-main">
                <div className="sa-settings-container">
                    <header className="page-header">
                        <h1 className="page-title">Paramètres de la Plateforme</h1>
                        <p className="page-subtitle">Gérez la configuration globale et la sécurité</p>
                    </header>

                    {/* Tab Navigation */}
                    <nav className="settings-tabs">
                        <button
                            className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
                            onClick={() => setActiveTab('general')}
                        >
                            <span className="material-symbols-outlined">settings</span>
                            Général
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                            onClick={() => setActiveTab('security')}
                        >
                            <span className="material-symbols-outlined">security</span>
                            Sécurité
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
                            onClick={() => setActiveTab('appearance')}
                        >
                            <span className="material-symbols-outlined">palette</span>
                            Apparence
                        </button>
                    </nav>

                    <div className="tab-content">
                        {activeTab === 'general' && (
                            <div className="tab-pane fade-in">
                                {/* General Settings */}
                                <section className="settings-section">
                                    <h2 className="section-title">Paramètres Généraux</h2>
                                    <div className="settings-card">
                                        <div className="setting-item">
                                            <label className="setting-label">Nom de la plateforme</label>
                                            <input
                                                type="text"
                                                className="setting-input"
                                                value={settings.platformName}
                                                onChange={(e) => handleChange('platformName', e.target.value)}
                                            />
                                        </div>
                                        <div className="setting-item">
                                            <label className="setting-label">Email de support</label>
                                            <input
                                                type="email"
                                                className="setting-input"
                                                value={settings.supportEmail}
                                                onChange={(e) => handleChange('supportEmail', e.target.value)}
                                            />
                                        </div>
                                        <div className="setting-row">
                                            <div className="setting-item">
                                                <label className="setting-label">Langue par défaut</label>
                                                <select
                                                    className="setting-select"
                                                    value={settings.defaultLanguage}
                                                    onChange={(e) => handleChange('defaultLanguage', e.target.value)}
                                                >
                                                    <option value="fr">Français</option>
                                                    <option value="en">English</option>
                                                    <option value="es">Español</option>
                                                </select>
                                            </div>
                                            <div className="setting-item">
                                                <label className="setting-label">Fuseau horaire</label>
                                                <select
                                                    className="setting-select"
                                                    value={settings.timezone}
                                                    onChange={(e) => handleChange('timezone', e.target.value)}
                                                >
                                                    <option value="Europe/Paris">Europe/Paris</option>
                                                    <option value="America/New_York">America/New_York</option>
                                                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Limits & Quotas */}
                                <section className="settings-section">
                                    <h2 className="section-title">Limites et Quotas</h2>
                                    <div className="settings-card">
                                        <div className="setting-item">
                                            <div className="setting-header">
                                                <label className="setting-label">Utilisateurs max par entreprise</label>
                                                <span className="setting-value">{settings.maxUsers}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="10"
                                                max="500"
                                                value={settings.maxUsers}
                                                onChange={(e) => handleChange('maxUsers', e.target.value)}
                                                className="setting-slider"
                                            />
                                        </div>
                                        <div className="setting-item">
                                            <div className="setting-header">
                                                <label className="setting-label">Offres max par entreprise</label>
                                                <span className="setting-value">{settings.maxJobs}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="10"
                                                max="200"
                                                value={settings.maxJobs}
                                                onChange={(e) => handleChange('maxJobs', e.target.value)}
                                                className="setting-slider"
                                            />
                                        </div>
                                        <div className="setting-item">
                                            <div className="setting-header">
                                                <label className="setting-label">Stockage (GB par entreprise)</label>
                                                <span className="setting-value">{settings.storageLimit} GB</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="100"
                                                value={settings.storageLimit}
                                                onChange={(e) => handleChange('storageLimit', e.target.value)}
                                                className="setting-slider"
                                            />
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="tab-pane fade-in">
                                {/* Security Policies */}
                                <section className="settings-section">
                                    <h2 className="section-title">Politiques de Sécurité</h2>
                                    <div className="settings-card">
                                        <div className="setting-item">
                                            <div className="setting-header">
                                                <label className="setting-label">Longueur minimale du mot de passe</label>
                                                <span className="setting-value">{securitySettings.minPasswordLength} caractères</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="6"
                                                max="20"
                                                value={securitySettings.minPasswordLength}
                                                onChange={(e) => setSecuritySettings({ ...securitySettings, minPasswordLength: e.target.value })}
                                                className="setting-slider"
                                            />
                                        </div>
                                        <div className="toggle-item">
                                            <div className="toggle-info">
                                                <span className="toggle-label">Complexité du mot de passe</span>
                                                <span className="toggle-desc">Exiger majuscules, minuscules, chiffres et symboles</span>
                                            </div>
                                            <label className="sa-toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={securitySettings.requireComplexPassword}
                                                    onChange={(e) => setSecuritySettings({ ...securitySettings, requireComplexPassword: e.target.checked })}
                                                />
                                                <span className="sa-toggle-slider"></span>
                                            </label>
                                        </div>
                                        <div className="toggle-item">
                                            <div className="toggle-info">
                                                <span className="toggle-label">Authentification à deux facteurs</span>
                                                <span className="toggle-desc">Forcer 2FA pour tous les utilisateurs</span>
                                            </div>
                                            <label className="sa-toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={securitySettings.require2FA}
                                                    onChange={(e) => setSecuritySettings({ ...securitySettings, require2FA: e.target.checked })}
                                                />
                                                <span className="sa-toggle-slider"></span>
                                            </label>
                                        </div>
                                    </div>
                                </section>

                                {/* Audit Logs Snippet */}
                                <section className="settings-section">
                                    <h2 className="section-title">Dernières Activités d'Audit</h2>
                                    <div className="table-card">
                                        <table className="audit-table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Utilisateur</th>
                                                    <th>Action</th>
                                                    <th>Statut</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {auditLogs.slice(0, 5).map(log => (
                                                    <tr key={log.id}>
                                                        <td className="timestamp-cell">{log.timestamp.split(' ')[0]}</td>
                                                        <td className="user-cell">{log.user}</td>
                                                        <td>{log.action}</td>
                                                        <td>
                                                            <span className={`status-badge status-${log.status}`}>
                                                                {log.status === 'success' ? 'Succès' : 'Alerte'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="tab-pane fade-in">
                                <section className="settings-section">
                                    <h2 className="section-title">Thème et Interface</h2>
                                    <div className="settings-card">
                                        <div className="theme-selection-grid">
                                            <button
                                                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                                                onClick={() => setTheme('light')}
                                            >
                                                <div className="theme-preview light">
                                                    <div className="preview-sidebar"></div>
                                                    <div className="preview-main"></div>
                                                </div>
                                                <span className="theme-label">Clair</span>
                                            </button>
                                            <button
                                                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                                                onClick={() => setTheme('dark')}
                                            >
                                                <div className="theme-preview dark">
                                                    <div className="preview-sidebar"></div>
                                                    <div className="preview-main"></div>
                                                </div>
                                                <span className="theme-label">Sombre</span>
                                            </button>
                                            <button
                                                className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                                                onClick={() => setTheme('system')}
                                            >
                                                <div className="theme-preview system">
                                                    <div className="preview-sidebar"></div>
                                                    <div className="preview-main"></div>
                                                </div>
                                                <span className="theme-label">Système</span>
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>

                    {/* Save Button */}
                    <div className="settings-actions">
                        <button className="btn-primary">
                            <span className="material-symbols-outlined">save</span>
                            Enregistrer les modifications
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Settings;
