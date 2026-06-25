import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import SuperAdminSidebar from '../components/SuperAdminSidebar';
import { apiFetch } from '../../../core/api';
import SuperAdminLoading from '../components/SuperAdminLoading';
import './Settings.css';

const Settings = () => {
    const { theme, setTheme, effectiveTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('security'); // 'security', 'appearance'

    const [settings, setSettings] = useState({
        platformName: 'HumatiQ',
        supportEmail: 'support@humatiq.com',
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
        minPasswordLength: 16,
        requireComplexPassword: true,
        sessionTimeout: 30,
        ipWhitelist: ''
    });

    // Préférences de sécurité spécifiques à ce SuperAdmin
    const [superAdminSecurity, setSuperAdminSecurity] = useState({
        mfaEnabled: false,
        passwordlessEnabled: false
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [auditLogsData, setAuditLogsData] = useState([]);

    // État pour le flux d'enrôlement MFA (QR + premier code)
    const [showMfaEnroll, setShowMfaEnroll] = useState(false);
    const [mfaFactorId, setMfaFactorId] = useState('');
    const [mfaQr, setMfaQr] = useState('');
    const [mfaVerifyCode, setMfaVerifyCode] = useState('');
    const [mfaEnrollError, setMfaEnrollError] = useState('');
    const [mfaEnrollLoading, setMfaEnrollLoading] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchAuditLogs();

        // Charger les préférences locales SuperAdmin (par navigateur)
        const stored = localStorage.getItem('humatiq-security-preferences');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setSuperAdminSecurity(prev => ({ ...prev, ...parsed }));
            } catch {
                // ignore JSON errors
            }
        }

        // MFA not available — ensure it stays disabled
        setSuperAdminSecurity(prev => ({ ...prev, mfaEnabled: false }));
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const data = await apiFetch('/superadmin-settings');
            if (data?.settings) {
                setSecuritySettings(data.settings);
            }
        } catch (error) {
            console.warn('Error fetching settings (non-blocking):', error);
        } finally {
            setTimeout(() => setLoading(false), 800);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const data = await apiFetch('/superadmin-settings/audit-logs?limit=5');
            setAuditLogsData(data || []);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        }
    };

    const startMfaEnrollment = () => {
        setMfaEnrollError('MFA non disponible dans cette version.');
    };

    const handleMfaEnrollSubmit = (e) => {
        e.preventDefault();
        setShowMfaEnroll(false);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setMessage({ type: '', text: '' });

            await apiFetch('/superadmin-settings', {
                method: 'PUT',
                body: JSON.stringify({
                    settings: securitySettings,
                    extra_details: { superAdminSecurity },
                }),
            });

            setMessage({ type: 'success', text: 'Paramètres enregistrés avec succès !' });
            fetchAuditLogs();
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement des paramètres.' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

    if (loading) return <SuperAdminLoading />;

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

                                    </div>
                                </section>

                                {/* SuperAdmin-specific Security */}
                                <section className="settings-section">
                                    <h2 className="sa-section-title">Sécurité de ce SuperAdmin</h2>
                                    <div className="settings-card">
                                        <p className="settings-intro">
                                            Ces options s&apos;appliquent uniquement à votre compte SuperAdmin (session actuelle).
                                        </p>
                                        <div className="toggle-item">
                                            <div className="toggle-info">
                                                <span className="toggle-label">Activer la MFA pour ce compte</span>
                                                <span className="toggle-desc">
                                                    Demander un code de vérification supplémentaire lors de la connexion à ce compte.
                                                </span>
                                            </div>
                                            <label className="sa-toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={superAdminSecurity.mfaEnabled}
                                                    onChange={() => {
                                                        setMessage({ type: 'error', text: 'MFA non disponible dans cette version.' });
                                                    }}
                                                />
                                                <span className="sa-toggle-slider"></span>
                                            </label>
                                        </div>
                                        <div className="toggle-item">
                                            <div className="toggle-info">
                                                <span className="toggle-label">Connexion passwordless</span>
                                                <span className="toggle-desc">
                                                    Utiliser un e-mail avec code de vérification au lieu du mot de passe pour ce compte.
                                                </span>
                                            </div>
                                            <label className="sa-toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={superAdminSecurity.passwordlessEnabled}
                                                    onChange={(e) => {
                                                        const updated = {
                                                            ...superAdminSecurity,
                                                            passwordlessEnabled: e.target.checked
                                                        };
                                                        setSuperAdminSecurity(updated);
                                                        localStorage.setItem('superadmin-security-preferences', JSON.stringify(updated));
                                                    }}
                                                />
                                                <span className="sa-toggle-slider"></span>
                                            </label>
                                        </div>

                                        {superAdminSecurity.mfaEnabled && (
                                            <div className="mfa-enroll-block">
                                                <button
                                                    type="button"
                                                    className="btn-mfa-setup"
                                                    onClick={() => {
                                                        setShowMfaEnroll(true);
                                                        if (!mfaFactorId && !mfaQr) {
                                                            startMfaEnrollment();
                                                        }
                                                    }}
                                                    disabled={mfaEnrollLoading}
                                                >
                                                    <span className="material-symbols-outlined">qr_code_2</span>
                                                    {mfaEnrollLoading ? 'Préparation...' : 'Configurer / scanner le QR MFA'}
                                                </button>
                                            </div>
                                        )}
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

            {/* Modal MFA QR + Code */}
            {showMfaEnroll && (
                <div className="mfa-modal-backdrop">
                    <div className="mfa-modal">

                        {/* ── Header ── */}
                        <header className="mfa-modal-header">
                            <div className="mfa-modal-header-content">
                                <div className="mfa-modal-icon">
                                    <span className="material-symbols-outlined">qr_code_2</span>
                                </div>
                                <h2 className="mfa-modal-title">Activer la MFA (TOTP)</h2>
                                <p className="mfa-modal-subtitle">
                                    Scannez ce QR avec Google Authenticator ou Authy, puis saisissez le code à 6 chiffres pour confirmer.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="mfa-modal-close"
                                onClick={() => {
                                    setShowMfaEnroll(false);
                                    setMfaEnrollError('');
                                    setMfaVerifyCode('');
                                }}
                                aria-label="Fermer la fenêtre MFA"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </header>

                        {/* ── Body ── */}
                        <div className="mfa-modal-body">

                            {/* QR Code */}
                            <div className="mfa-qr-wrapper">
                                {mfaQr ? (
                                    <img src={mfaQr} alt="QR code MFA" className="mfa-qr-image" />
                                ) : (
                                    <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: 'var(--color-text-muted)' }}>
                                        qr_code_scanner
                                    </span>
                                )}
                            </div>

                            {/* Error */}
                            {mfaEnrollError && (
                                <div className="settings-feedback feedback-error mfa-enroll-error">
                                    <span className="material-symbols-outlined">error</span>
                                    {mfaEnrollError}
                                </div>
                            )}

                            {/* Code Input */}
                            <form id="mfa-enroll-form" className="mfa-enroll-form" onSubmit={handleMfaEnrollSubmit}>
                                <label className="setting-label" htmlFor="mfa-code-input">
                                    Code de vérification
                                </label>
                                <input
                                    id="mfa-code-input"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="000000"
                                    className="mfa-code-input"
                                    autoComplete="one-time-code"
                                    value={mfaVerifyCode}
                                    onChange={(e) => setMfaVerifyCode(e.target.value)}
                                />
                            </form>
                        </div>

                        {/* ── Footer ── */}
                        <footer className="mfa-modal-footer">
                            <button
                                type="button"
                                className="btn-text"
                                onClick={() => {
                                    setShowMfaEnroll(false);
                                    setMfaEnrollError('');
                                    setMfaVerifyCode('');
                                }}
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                form="mfa-enroll-form"
                                className="btn-primary"
                                disabled={mfaEnrollLoading}
                            >
                                <span className="material-symbols-outlined">
                                    {mfaEnrollLoading ? 'sync' : 'verified_user'}
                                </span>
                                {mfaEnrollLoading ? 'Vérification...' : 'Activer la MFA'}
                            </button>
                        </footer>

                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
