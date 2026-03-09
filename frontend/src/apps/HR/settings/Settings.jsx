import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../../../core/supabaseClient'
import { apiFetch } from '../../../core/api'
import HRSidebar from '../components/HRSidebar'
import './Settings.css'

function Settings() {
    const { effectiveTheme, theme, setTheme } = useTheme()
    const [activeTab, setActiveTab] = useState('général')
    const [themePreference, setThemePreference] = useState(theme) // Initialize from context
    const [language, setLanguage] = useState('fr')
    const [currency, setCurrency] = useState('EUR')

    const [notifications, setNotifications] = useState({
        aiMatching: true,
        newCandidates: true,
        messages: false,
        reports: true,
        offerExpiration: true,
        securityAlert: true,
    })
    const [mfaEnabled, setMfaEnabled] = useState(false)
    const [passwordlessEnabled, setPasswordlessEnabled] = useState(false)

    // États pour l'enrôlement MFA
    const [showMfaEnroll, setShowMfaEnroll] = useState(false)
    const [mfaQr, setMfaQr] = useState('')
    const [mfaFactorId, setMfaFactorId] = useState('')
    const [mfaCode, setMfaCode] = useState('')
    const [mfaEnrollError, setMfaEnrollError] = useState('')
    const [mfaStep, setMfaStep] = useState('qr') // 'qr' or 'code'
    const [message, setMessage] = useState({ type: '', text: '' })

    // Charger la préférence passwordless et MFA depuis le profil au chargement
    useEffect(() => {
        const loadPrefs = async () => {
            const { data: sessionData } = await supabase.auth.getSession()
            const userId = sessionData?.session?.user?.id
            if (!userId) return

            try {
                // Sync Supabase MFA
                const factors = await supabase.auth.mfa.listFactors();
                const hasVerified = factors.data?.totp && factors.data.totp.some(f => f.status === 'verified');
                setMfaEnabled(hasVerified);

                const profile = await apiFetch(`/profiles/${userId}`)
                if (profile?.preferences?.passwordlessEnabled !== undefined) {
                    setPasswordlessEnabled(profile.preferences.passwordlessEnabled)
                }
            } catch (error) {
                console.error("Erreur chargement préférences:", error)
            }
        }
        loadPrefs()
    }, [])

    const startMfaEnrollment = async () => {
        try {
            setMfaEnrollError('')
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                issuer: 'HumatiQ',
                friendlyName: 'Admin HR'
            })
            if (error) throw error

            setMfaFactorId(data.id)
            const rawSvg = data.totp.qr_code
            const asDataUrl = rawSvg.startsWith('data:')
                ? rawSvg
                : `data:image/svg+xml;utf8,${encodeURIComponent(rawSvg)}`;
            setMfaQr(asDataUrl)
            setMfaStep('code')
        } catch (error) {
            console.error('MFA Enrollment error:', error)
            setMfaEnrollError(error.message || 'Erreur lors du démarrage MFA.')
        }
    }

    const verifyMfaEnrollment = async (e) => {
        if (e) e.preventDefault()
        try {
            setMfaEnrollError('')
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: mfaFactorId
            })
            if (challengeError) throw challengeError

            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: mfaFactorId,
                challengeId: challengeData.id,
                code: mfaCode
            })
            if (verifyError) throw verifyError

            setMfaEnabled(true)
            setShowMfaEnroll(false)
            setMessage({ type: 'success', text: 'MFA activée avec succès !' })

            // Persist to profile
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const profile = await apiFetch(`/profiles/${user.id}`)
                await apiFetch(`/profiles/${user.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        first_name: profile.first_name,
                        last_name: profile.last_name,
                        role: profile.role,
                        company_id: profile.company_id,
                        department_id: profile.department_id,
                        preferences: { ...(profile.preferences || {}), mfaEnabled: true }
                    })
                })
            }
        } catch (error) {
            console.error('MFA verification error:', error)
            setMfaEnrollError(error.message || 'Code incorrect. Veuillez réessayer.')
        }
    }

    const handleMfaToggle = async (e) => {
        const checked = e.target.checked
        if (checked) {
            setShowMfaEnroll(true)
            startMfaEnrollment()
        } else {
            // Unenrollment
            try {
                const factors = await supabase.auth.mfa.listFactors()
                const verifiedFactors = factors.data?.totp?.filter(f => f.status === 'verified') || []
                for (const f of verifiedFactors) {
                    await supabase.auth.mfa.unenroll({ factorId: f.id })
                }
                setMfaEnabled(false)
                setMessage({ type: 'success', text: 'MFA désactivée.' })

                // Persist to profile
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const profile = await apiFetch(`/profiles/${user.id}`)
                    await apiFetch(`/profiles/${user.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            first_name: profile.first_name,
                            last_name: profile.last_name,
                            role: profile.role,
                            company_id: profile.company_id,
                            department_id: profile.department_id,
                            preferences: { ...(profile.preferences || {}), mfaEnabled: false }
                        })
                    })
                }
            } catch (error) {
                console.error('Unenrollment error:', error)
            }
        }
    }

    // Sauvegarder la préférence passwordless dans le profil
    const handlePasswordlessToggle = async () => {
        const newValue = !passwordlessEnabled
        setPasswordlessEnabled(newValue)
        setMessage({ type: '', text: '' })

        const { data: sessionData } = await supabase.auth.getSession()
        const userId = sessionData?.session?.user?.id
        if (!userId) return

        try {
            // Lire les préférences existantes via l'API
            const profile = await apiFetch(`/profiles/${userId}`)
            const updatedPrefs = { ...(profile?.preferences || {}), passwordlessEnabled: newValue }

            await apiFetch(`/profiles/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    role: profile.role,
                    company_id: profile.company_id,
                    department_id: profile.department_id,
                    preferences: updatedPrefs
                })
            })

            setMessage({
                type: 'success',
                text: newValue ? 'Connexion sans mot de passe activée.' : 'Connexion sans mot de passe désactivée.'
            })
        } catch (error) {
            console.error("Erreur de sauvegarde passwordless:", error)
            setMessage({ type: 'error', text: 'Erreur lors de la mise à jour des préférences.' })
            // Rollback optimistic update on error
            setPasswordlessEnabled(!newValue)
        }
    }
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    })

    const [connectedAccounts, setConnectedAccounts] = useState({
        google: false,
        linkedin: false,
        microsoft: false,
        github: false
    })

    const toggleAccountConnection = (account) => {
        setConnectedAccounts(prev => ({ ...prev, [account]: !prev[account] }))
    }

    const togglePasswordVisibility = (field) => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
    }

    const handleToggleNotification = (key) => {
        setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const handleThemeChange = (newTheme) => {
        setThemePreference(newTheme)
        setTheme(newTheme) // Update the context theme
    }

    // Theme preset colors for preview
    const themes = [
        { id: 'dark', label: 'Sombre', bg: '#000000', accent: '#ffffff' },
        { id: 'light', label: 'Clair', bg: '#ffffff', accent: '#000000' },
        { id: 'system', label: 'Système', bg: 'linear-gradient(135deg, #ffffff 50%, #000000 50%)', accent: '#000000' }
    ]

    return (
        <div className={`settings-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            {/* Sidebar */}
            <HRSidebar />

            {/* Main Content */}
            <main className="settings-main">
                {/* Mobile Header (Hidden on Desktop via CSS if needed, but keeping simple for now) */}

                <div className="settings-container">
                    {/* Header */}
                    <header className="settings-header">
                        <h1 className="settings-title">Paramètres Système</h1>
                        <p className="settings-subtitle">
                            Gérez la configuration, la sécurité et les préférences de la plateforme IA.
                        </p>
                    </header>

                    {/* Message Display */}
                    {message.text && (
                        <div className={`settings-message ${message.type}`}>
                            <span className="material-symbols-outlined">
                                {message.type === 'success' ? 'check_circle' : 'error'}
                            </span>
                            {message.text}
                            <button className="close-msg" onClick={() => setMessage({ type: '', text: '' })}>×</button>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="settings-tabs">
                        <div className="tabs-list">
                            {['Général', 'Notifications', 'Sécurité', 'Connexions'].map((tab) => (
                                <button
                                    key={tab}
                                    className={`tab-button ${activeTab === tab.toLowerCase() ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.toLowerCase())}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* General Section */}
                <section className="settings-card" style={{ display: activeTab === 'général' ? 'block' : 'none' }}>
                    <div className="card-header">
                        <h2 className="card-title">Apparence & Préférences</h2>
                        <p className="card-description">Personnalisez l'interface et les réglages régionaux</p>
                    </div>

                    <div className="security-grid">
                        {/* Theme Selection */}
                        <div className="security-section full-width">
                            <h3>Thème de l'interface</h3>
                            <div className="theme-selector">
                                {themes.map((t) => (
                                    <button
                                        key={t.id}
                                        className={`theme-option ${themePreference === t.id ? 'selected' : ''}`}
                                        onClick={() => handleThemeChange(t.id)}
                                    >
                                        <div className="theme-preview" style={{ background: t.bg }} data-theme={t.id}>
                                            <div className="theme-mini-window">
                                                <div className="theme-mini-sidebar"></div>
                                                <div className="theme-mini-content">
                                                    <div className="theme-mini-header"></div>
                                                    <div className="theme-mini-body"></div>
                                                </div>
                                                <div className="theme-check-icon">
                                                    <div className="start-icon" style={{ background: t.id === 'dark' ? '#fbbf24' : (t.id === 'light' ? '#0ea5e9' : '#475569') }}></div>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="theme-label">{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Regional Settings */}
                        <div className="security-section">
                            <div className="form-group">
                                <label>Langue de la plateforme</label>
                                <div className="option-group">
                                    <button
                                        className={`option-btn ${language === 'fr' ? 'selected' : ''}`}
                                        onClick={() => setLanguage('fr')}
                                    >
                                        <span className="option-icon-text">FR</span>
                                        <span className="option-text">Français</span>
                                    </button>
                                    <button
                                        className={`option-btn ${language === 'en' ? 'selected' : ''}`}
                                        onClick={() => setLanguage('en')}
                                    >
                                        <span className="option-icon-text">EN</span>
                                        <span className="option-text">English</span>
                                    </button>
                                    <button
                                        className={`option-btn ${language === 'ar' ? 'selected' : ''}`}
                                        onClick={() => setLanguage('ar')}
                                    >
                                        <span className="option-icon-text">AR</span>
                                        <span className="option-text">العربية</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="security-section">
                            <div className="form-group">
                                <label>Format monétaire</label>
                                <div className="option-group">
                                    <button
                                        className={`option-btn ${currency === 'TND' ? 'selected' : ''}`}
                                        onClick={() => setCurrency('TND')}
                                    >
                                        <span className="option-icon-text">TND</span>
                                        <span className="option-text">Dinar Tunisien</span>
                                    </button>
                                    <button
                                        className={`option-btn ${currency === 'EUR' ? 'selected' : ''}`}
                                        onClick={() => setCurrency('EUR')}
                                    >
                                        <span className="option-icon-text">€</span>
                                        <span className="option-text">Euro</span>
                                    </button>
                                    <button
                                        className={`option-btn ${currency === 'USD' ? 'selected' : ''}`}
                                        onClick={() => setCurrency('USD')}
                                    >
                                        <span className="option-icon-text">$</span>
                                        <span className="option-text">Dollar</span>
                                    </button>

                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <section className="settings-card" style={{ display: activeTab === 'notifications' ? 'block' : 'none' }}>
                    <div className="card-header">
                        <h2 className="card-title">Préférences de notifications</h2>
                        <p className="card-description">Configurez les alertes que vous recevez par email et push.</p>
                    </div>
                    <div className="settings-list">
                        {/* Item 1 */}
                        <div className="list-item">
                            <div className="item-content">
                                <div className="item-icon">
                                    <span className="material-symbols-outlined">smart_toy</span>
                                </div>
                                <div className="item-text">
                                    <p className="item-title">Alertes de matching IA</p>
                                    <p className="item-subtitle">Recevoir une notification immédiate lorsqu'un candidat correspond à plus de 90% aux critères d'une offre.</p>
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={notifications.aiMatching}
                                    onChange={() => handleToggleNotification('aiMatching')}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {/* Item 2 */}
                        <div className="list-item">
                            <div className="item-content">
                                <div className="item-icon">
                                    <span className="material-symbols-outlined">group_add</span>
                                </div>
                                <div className="item-text">
                                    <p className="item-title">Nouveaux candidats</p>
                                    <p className="item-subtitle">Digest quotidien des nouvelles candidatures reçues sur vos offres actives.</p>
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={notifications.newCandidates}
                                    onChange={() => handleToggleNotification('newCandidates')}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {/* Item 3 */}
                        <div className="list-item">
                            <div className="item-content">
                                <div className="item-icon">
                                    <span className="material-symbols-outlined">mark_email_unread</span>
                                </div>
                                <div className="item-text">
                                    <p className="item-title">Messages internes</p>
                                    <p className="item-subtitle">Notifications pour les mentions et messages directs de l'équipe RH.</p>
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={notifications.messages}
                                    onChange={() => handleToggleNotification('messages')}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {/* Item 4 */}
                        <div className="list-item">
                            <div className="item-content">
                                <div className="item-icon">
                                    <span className="material-symbols-outlined">bar_chart</span>
                                </div>
                                <div className="item-text">
                                    <p className="item-title">Rapports de performance</p>
                                    <p className="item-subtitle">Résumé hebdomadaire des KPIs de recrutement et performance de l'IA.</p>
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={notifications.reports}
                                    onChange={() => handleToggleNotification('reports')}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {/* Item 5: Expiration d'offre */}
                        <div className="list-item">
                            <div className="item-content">
                                <div className="item-icon">
                                    <span className="material-symbols-outlined">alarm</span>
                                </div>
                                <div className="item-text">
                                    <p className="item-title">Expiration d'offre</p>
                                    <p className="item-subtitle">"L'annonce pour le poste de Développeur expire dans 48h. Souhaitez-vous la prolonger ?"</p>
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={notifications.offerExpiration}
                                    onChange={() => handleToggleNotification('offerExpiration')}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {/* Item 6: Alerte Sécurité */}
                        <div className="list-item">
                            <div className="item-content">
                                <div className="item-icon">
                                    <span className="material-symbols-outlined">security</span>
                                </div>
                                <div className="item-text">
                                    <p className="item-title">Alerte Sécurité</p>
                                    <p className="item-subtitle">"Une tentative de connexion inhabituelle a été détectée sur votre compte."</p>
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={notifications.securityAlert}
                                    onChange={() => handleToggleNotification('securityAlert')}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </section>

                {/* Security Section (Visible only when tab is active) */}
                <section className="settings-card" style={{ display: activeTab === 'sécurité' ? 'block' : 'none' }}>
                    <div className="card-header">
                        <h2 className="card-title">Sécurité & Connexion</h2>
                        <p className="card-description">Gérez l'accès à votre compte et la double authentification.</p>
                    </div>
                    <div className="security-grid">
                        {/* Password Change */}
                        <div className="security-section">
                            <h3>
                                <span className="material-symbols-outlined">lock_reset</span>
                                Changer le mot de passe
                            </h3>
                            <div className="form-group">
                                <label>Mot de passe actuel</label>
                                <div className="input-wrapper">
                                    <input
                                        type={showPasswords.current ? "text" : "password"}
                                        placeholder="Mot de passe actuel"
                                        className="form-input"
                                    />
                                    <button
                                        className="password-toggle-btn"
                                        onClick={() => togglePasswordVisibility('current')}
                                        tabIndex="-1"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
                                            {showPasswords.current ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Nouveau mot de passe</label>
                                <div className="input-wrapper">
                                    <input
                                        type={showPasswords.new ? "text" : "password"}
                                        placeholder="Nouveau mot de passe"
                                        className="form-input"
                                    />
                                    <button
                                        className="password-toggle-btn"
                                        onClick={() => togglePasswordVisibility('new')}
                                        tabIndex="-1"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
                                            {showPasswords.new ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Confirmer le nouveau mot de passe</label>
                                <div className="input-wrapper">
                                    <input
                                        type={showPasswords.confirm ? "text" : "password"}
                                        placeholder="Confirmez le mot de passe"
                                        className="form-input"
                                    />
                                    <button
                                        className="password-toggle-btn"
                                        onClick={() => togglePasswordVisibility('confirm')}
                                        tabIndex="-1"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
                                            {showPasswords.confirm ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                            <button className="action-link">Mot de passe oublié ?</button>
                        </div>

                        {/* MFA & Devices */}
                        <div className="security-section">
                            <div className="mfa-box">
                                <div className="mfa-header">
                                    <h3>
                                        <span className="material-symbols-outlined">phonelink_lock</span>
                                        Double authentification (MFA)
                                    </h3>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={mfaEnabled}
                                            onChange={handleMfaToggle}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                                <p className="mfa-description">
                                    Ajoute une couche de sécurité supplémentaire à votre compte en demandant plus qu'un simple mot de passe pour se connecter.
                                </p>
                            </div>

                            {/* Passwordless Login */}
                            <div className="mfa-box">
                                <div className="mfa-header">
                                    <h3>
                                        <span className="material-symbols-outlined">fingerprint</span>
                                        Connexion sans mot de passe
                                    </h3>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={passwordlessEnabled}
                                            onChange={handlePasswordlessToggle}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                                <p className="mfa-description">
                                    Utilisez un code de vérification envoyé par e-mail au lieu d'un mot de passe pour vous connecter de manière sécurisée.
                                </p>
                            </div>

                            {/* Delete Profile - Styled identically to MFA boxes with a button */}
                            <div className="mfa-box danger">
                                <div className="mfa-header">
                                    <h3>
                                        <span className="material-symbols-outlined">delete</span>
                                        Supprimer le profil
                                    </h3>
                                    <button className="btn-delete-card">
                                        Supprimer
                                    </button>
                                </div>
                                <p className="mfa-description">
                                    La suppression est définitive. Données perdues.
                                </p>
                            </div>
                        </div>

                        {/* Full Width Bottom Sections */}
                        <div className="security-full-row">
                            <div className="separator-line"></div>
                            {/* Connected Devices */}
                            <div className="security-section">
                                <h3>Appareils connectés</h3>
                                <div className="device-list">
                                    <div className="device-item">
                                        <div className="device-info">
                                            <span className="material-symbols-outlined device-icon">laptop_mac</span>
                                            <div>
                                                <p className="device-name">MacBook Pro 16"</p>
                                                <p className="device-meta">Paris, France · Actif maintenant</p>
                                            </div>
                                        </div>
                                        <span className="device-status">Actuel</span>
                                    </div>
                                    <div className="device-item">
                                        <div className="device-info">
                                            <span className="material-symbols-outlined device-icon">smartphone</span>
                                            <div>
                                                <p className="device-name">iPhone 13</p>
                                                <p className="device-meta">Lyon, France · il y a 2h</p>
                                            </div>
                                        </div>
                                        <button className="icon-btn">
                                            <span className="material-symbols-outlined">logout</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="separator-line"></div>

                            {/* Login History */}
                            <div className="security-section">
                                <h3>Historique de connexion</h3>
                                <div className="device-list">
                                    <div className="device-item">
                                        <div className="device-info">
                                            <span className="material-symbols-outlined status-icon success">check</span>
                                            <div>
                                                <p className="device-name">Connexion réussie</p>
                                                <p className="device-meta">Chrome sur Windows · À l'instant</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="device-item">
                                        <div className="device-info">
                                            <span className="material-symbols-outlined status-icon failure">close</span>
                                            <div>
                                                <p className="device-name">Tentative échouée</p>
                                                <p className="device-meta">Firefox sur Linux · il y a 2 jours</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="history-footer">
                                    <button className="btn-view-all">
                                        Voir tout l'historique
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Connexions Section */}
                <section className="settings-card" style={{ display: activeTab === 'connexions' ? 'block' : 'none' }}>
                    <div className="card-header">
                        <h2 className="card-title">Comptes connectés</h2>
                        <p className="card-description">Connectez vos comptes externes pour simplifier votre workflow</p>
                    </div>
                    <div className="connections-list">
                        {/* Google */}
                        <div className="connection-item">
                            <div className="connection-info-row">
                                <div className="connection-logo-wrapper" style={{ background: '#4285F4' }}>
                                    <svg className="connection-logo" viewBox="0 0 24 24" fill="white">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                </div>
                                <div className="connection-details">
                                    <p className="connection-name">Google</p>
                                    <p className="connection-description">Gmail, Calendar, Drive</p>
                                </div>
                            </div>
                            {connectedAccounts.google ? (
                                <div className="connection-actions">
                                    <span className="connection-status connected">Connecté</span>
                                    <button className="connection-disconnect-btn" onClick={() => toggleAccountConnection('google')}>
                                        Déconnecter
                                    </button>
                                </div>
                            ) : (
                                <button className="connection-connect-btn" onClick={() => toggleAccountConnection('google')}>
                                    Connecter
                                </button>
                            )}
                        </div>

                        {/* LinkedIn */}
                        <div className="connection-item">
                            <div className="connection-info-row">
                                <div className="connection-logo-wrapper" style={{ background: '#0A66C2' }}>
                                    <svg className="connection-logo" viewBox="0 0 24 24" fill="white">
                                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                    </svg>
                                </div>
                                <div className="connection-details">
                                    <p className="connection-name">LinkedIn</p>
                                    <p className="connection-description">Sourcing, Publication d'offres</p>
                                </div>
                            </div>
                            {connectedAccounts.linkedin ? (
                                <div className="connection-actions">
                                    <span className="connection-status connected">Connecté</span>
                                    <button className="connection-disconnect-btn" onClick={() => toggleAccountConnection('linkedin')}>
                                        Déconnecter
                                    </button>
                                </div>
                            ) : (
                                <button className="connection-connect-btn" onClick={() => toggleAccountConnection('linkedin')}>
                                    Connecter
                                </button>
                            )}
                        </div>

                        {/* Microsoft */}
                        <div className="connection-item">
                            <div className="connection-info-row">
                                <div className="connection-logo-wrapper" style={{ background: '#00A4EF' }}>
                                    <svg className="connection-logo" viewBox="0 0 24 24" fill="white">
                                        <path d="M0 0v11.408h11.408V0zm12.594 0v11.408H24V0zM0 12.594V24h11.408V12.594zm12.594 0V24H24V12.594z" />
                                    </svg>
                                </div>
                                <div className="connection-details">
                                    <p className="connection-name">Microsoft</p>
                                    <p className="connection-description">Outlook, Teams</p>
                                </div>
                            </div>
                            {connectedAccounts.microsoft ? (
                                <div className="connection-actions">
                                    <span className="connection-status connected">Connecté</span>
                                    <button className="connection-disconnect-btn" onClick={() => toggleAccountConnection('microsoft')}>
                                        Déconnecter
                                    </button>
                                </div>
                            ) : (
                                <button className="connection-connect-btn" onClick={() => toggleAccountConnection('microsoft')}>
                                    Connecter
                                </button>
                            )}
                        </div>

                        {/* GitHub */}
                        <div className="connection-item">
                            <div className="connection-info-row">
                                <div className="connection-logo-wrapper" style={{ background: '#181717' }}>
                                    <svg className="connection-logo" viewBox="0 0 24 24" fill="white">
                                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                                    </svg>
                                </div>
                                <div className="connection-details">
                                    <p className="connection-name">GitHub</p>
                                    <p className="connection-description">Recrutement développeurs</p>
                                </div>
                            </div>
                            {connectedAccounts.github ? (
                                <div className="connection-actions">
                                    <span className="connection-status connected">Connecté</span>
                                    <button className="connection-disconnect-btn" onClick={() => toggleAccountConnection('github')}>
                                        Déconnecter
                                    </button>
                                </div>
                            ) : (
                                <button className="connection-connect-btn" onClick={() => toggleAccountConnection('github')}>
                                    Connecter
                                </button>
                            )}
                        </div>
                    </div>
                </section>


            </main >

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
                                    setMfaCode('');
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
                            <form id="mfa-enroll-form" className="mfa-enroll-form" onSubmit={verifyMfaEnrollment}>
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
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
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
                                    setMfaCode('');
                                }}
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                form="mfa-enroll-form"
                                className="btn-primary"
                            >
                                <span className="material-symbols-outlined">
                                    verified_user
                                </span>
                                Activer la MFA
                            </button>
                        </footer>

                    </div>
                </div>
            )}
        </div >
    )
}

export default Settings
