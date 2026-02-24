import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import SuperAdminSidebar from '../components/SuperAdminSidebar';
import { supabase } from '../../../core/supabaseClient';
import './Settings.css';

const Settings = () => {
    const { theme, setTheme, effectiveTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('security'); // 'security', 'appearance'

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

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [auditLogsData, setAuditLogsData] = useState([]);

    useEffect(() => {
        fetchSettings();
        fetchAuditLogs();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('system_settings')
                .select('settings')
                .eq('id', 'security')
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                setSecuritySettings(data.settings);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            setMessage({ type: 'error', text: 'Erreur lors du chargement des paramètres.' });
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            setAuditLogsData(data || []);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setMessage({ type: '', text: '' });

            // 1. Update Security Settings
            const { error: settingsError } = await supabase
                .from('system_settings')
                .upsert({
                    id: 'security',
                    settings: securitySettings,
                    updated_at: new Date().toISOString()
                });

            if (settingsError) throw settingsError;

            // 2. Create Audit Log
            const { data: userData } = await supabase.auth.getUser();
            const { error: auditError } = await supabase
                .from('audit_logs')
                .insert({
                    user_id: userData.user?.id,
                    action: 'Mise à jour des paramètres de sécurité',
                    details: securitySettings
                });

            if (auditError) console.error('Error logging audit:', auditError);

            setMessage({ type: 'success', text: 'Paramètres enregistrés avec succès !' });
            fetchAuditLogs(); // Refresh logs
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement des paramètres.' });
        } finally {
            setSaving(false);
            // Hide message after 3 seconds
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

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

                        {activeTab === 'security' && (
                            <div className="tab-pane fade-in">
                                {/* Security Policies */}
                                <section className="settings-section">
                                    <h2 className="sa-section-title">Politiques de Sécurité</h2>
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
                                                style={{
                                                    '--fill': `${((securitySettings.minPasswordLength - 6) / (20 - 6)) * 100}%`
                                                }}
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
                                    <h2 className="sa-section-title">Dernières Activités d'Audit</h2>
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
                                                {auditLogsData.map(log => (
                                                    <tr key={log.id}>
                                                        <td className="timestamp-cell">{new Date(log.created_at).toLocaleDateString('fr-FR')}</td>
                                                        <td className="user-cell">{log.user_id?.substring(0, 8) || 'Système'}...</td>
                                                        <td>{log.action}</td>
                                                        <td>
                                                            <span className="status-badge status-success">
                                                                Succès
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
                                    <h2 className="sa-section-title">Thème et Interface</h2>
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

                    {/* Feedback Message */}
                    {message.text && (
                        <div className={`settings-feedback feedback-${message.type}`}>
                            <span className="material-symbols-outlined">
                                {message.type === 'success' ? 'check_circle' : 'error'}
                            </span>
                            {message.text}
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="settings-actions">
                        <button
                            className="btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            <span className="material-symbols-outlined">
                                {saving ? 'sync' : 'save'}
                            </span>
                            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Settings;
