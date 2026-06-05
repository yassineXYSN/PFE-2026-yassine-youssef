import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../../../core/useLanguage'
import { supabase } from '../../../core/supabaseClient'
import { apiFetch } from '../../../core/api'
import HRSidebar from '../components/HRSidebar'
import './Settings.css'

function Settings() {
    const { effectiveTheme, theme, setTheme } = useTheme()
    const { language, changeLanguage, t } = useLanguage()
    const [activeTab, setActiveTab] = useState('général')
    const [themePreference, setThemePreference] = useState(theme) // Initialize from context

    const [notifications, setNotifications] = useState({
        aiMatching: true,
        newCandidates: true,
        reports: true,
        offerExpiration: true,
        securityAlert: true,
    })
    const [notifSaving, setNotifSaving] = useState(false)
    const [currentUserId, setCurrentUserId] = useState(null)
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

                setCurrentUserId(userId)
                const profile = await apiFetch(`/profiles/${userId}`)
                if (profile?.preferences?.passwordlessEnabled !== undefined) {
                    setPasswordlessEnabled(profile.preferences.passwordlessEnabled)
                }
                // Load saved notification preferences
                if (profile?.preferences?.notifications) {
                    setNotifications(prev => ({
                        ...prev,
                        ...profile.preferences.notifications,
                    }))
                }

                // Load Google Sync Status from the dedicated endpoint to ensure latest info (and fetch email if missing)
                try {
                    const syncStatus = await apiFetch('/auth/google/status')
                    console.log("DEBUG: Google Sync Status:", syncStatus)
                    if (syncStatus?.connected) {
                        setConnectedAccounts(prev => ({ ...prev, google: true }))
                        setGoogleEmail(syncStatus.email || '')
                        console.log("DEBUG: Setting Google Email:", syncStatus.email)
                    }
                } catch (err) {
                    console.error("DEBUG: Erreur chargement statut Google:", err)
                    // Fallback to profile check if status endpoint fails
                    if (profile?.preferences?.google_calendar?.connected) {
                        setConnectedAccounts(prev => ({ ...prev, google: true }))
                        setGoogleEmail(profile.preferences.google_calendar.email || '')
                    }
                }
            } catch (error) {
                console.error("Erreur chargement préférences:", error)
            }
        }
        loadPrefs()

        // Handle URL parameters (tab + google_sync callback)
        const urlParams = new URLSearchParams(window.location.search)
        const validTabs = ['général', 'notifications', 'sécurité', 'connexions', 'ia & automatisation']
        const tabParam = urlParams.get('tab')
        if (tabParam && validTabs.includes(tabParam)) {
            setActiveTab(tabParam)
        }
        if (urlParams.get('google_sync') === 'success') {
            setActiveTab('connexions')
            setMessage({ type: 'success', text: 'Google Calendar synchronisé avec succès !' })
            window.history.replaceState({}, document.title, window.location.pathname)
        } else if (urlParams.get('google_sync') === 'error') {
            setActiveTab('connexions')
            setMessage({ type: 'error', text: `Erreur de synchronisation Google: ${urlParams.get('msg') || 'Inconnue'}` })
            window.history.replaceState({}, document.title, window.location.pathname)
        }
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
                        ...profile,
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

    const [currentSession, setCurrentSession] = useState({ browser: 'Unknown', device: 'Unknown', id: null })
    const [allSessions, setAllSessions] = useState([])
    const [isSigningOutOthers, setIsSigningOutOthers] = useState(false)
    const [sessionSuccessMsg, setSessionSuccessMsg] = useState('')
    const [accountError, setAccountError] = useState('')

    const parseUA = (ua) => {
        let browser = "Web Browser";
        let device = "Desktop Device";
        
        if (ua.includes("Firefox/")) browser = "Firefox";
        else if (ua.includes("Edg/")) browser = "Edge";
        else if (ua.includes("Chrome/") || ua.includes("CriOS/")) browser = "Chrome";
        else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
        
        if (ua.includes("Win")) device = "Windows PC";
        else if (ua.includes("Mac")) device = "Mac";
        else if (ua.includes("Linux")) device = "Linux";
        else if (ua.includes("Android")) device = "Android Device";
        else if (ua.includes("iPhone") || ua.includes("iPad")) device = "iOS Device";

        return { browser, device };
    };

    const fetchSessions = async () => {
        try {
            const { data: { session: curSess } } = await supabase.auth.getSession();
            const curBrowserInfo = parseUA(navigator.userAgent);
            setCurrentSession({ ...curBrowserInfo, id: curSess?.id });
            // Only show the current session since active_sessions table is not available
            if (curSess) {
                setAllSessions([{
                    id: curSess.id,
                    user_agent: navigator.userAgent,
                    created_at: curSess.created_at || new Date().toISOString(),
                }]);
            }
        } catch (err) {
            console.error('Error fetching sessions:', err);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, [])

    const uniqueDevices = useMemo(() => {
        const groups = {};
        allSessions.forEach(session => {
            const { browser, device } = parseUA(session.user_agent || '');
            const key = `${device}-${browser}`;
            // Keep the most recent session for each device+browser combination
            if (!groups[key] || new Date(session.created_at) > new Date(groups[key].created_at)) {
                groups[key] = { ...session, browser, device };
            }
        });
        
        return Object.values(groups).sort((a, b) => {
            if (a.id === currentSession.id) return -1;
            if (b.id === currentSession.id) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }, [allSessions, currentSession.id]);

    const handleSignOutOtherSessions = async () => {
        setIsSigningOutOthers(true);
        setAccountError('');
        setSessionSuccessMsg('');
        try {
            const { error } = await supabase.auth.signOut({ scope: 'others' });
            if (error) throw error;
            setSessionSuccessMsg('Tous les autres appareils ont été déconnectés avec succès.');
            fetchSessions();
        } catch (err) {
            console.error(err);
            setAccountError(err.message || 'Échec de la déconnexion des autres appareils.');
        } finally {
            setIsSigningOutOthers(false);
        }
    };

    // ── AI Parametrage state ──
    const [aiParams, setAiParams] = useState({
        ai_enabled: true,
        top_x_candidates: 25,
        top_y_candidates: 10,
        top_z_candidates: 5,
        similarity_threshold: 50,
        quiz_default_duration: 10,
        quiz_default_questions: 10,
        quiz_default_difficulty: 'medium',
    })
    const [aiParamsLoading, setAiParamsLoading] = useState(false)
    const [aiParamsSaving, setAiParamsSaving] = useState(false)
    const [aiParamsErrors, setAiParamsErrors] = useState({})
    const [aiParamsLastSaved, setAiParamsLastSaved] = useState(null)

    useEffect(() => {
        if (activeTab !== 'ia & automatisation') return
        const loadAiParams = async () => {
            setAiParamsLoading(true)
            try {
                const data = await apiFetch('/parametrage/ai-scoring')
                if (data?.parameters) {
                    setAiParams(data.parameters)
                    setAiParamsLastSaved(data.updated_at)
                }
            } catch (err) {
                console.error('Failed to load AI parametrage:', err)
            } finally {
                setAiParamsLoading(false)
            }
        }
        loadAiParams()
    }, [activeTab])

    const validateAiParams = (params) => {
        const errs = {}
        const x = Number(params.top_x_candidates)
        const y = Number(params.top_y_candidates)
        const z = Number(params.top_z_candidates)

        if (!Number.isInteger(x) || x <= 0) errs.top_x_candidates = 'Doit être un entier positif'
        if (!Number.isInteger(y) || y <= 0) errs.top_y_candidates = 'Doit être un entier positif'
        if (!Number.isInteger(z) || z <= 0) errs.top_z_candidates = 'Doit être un entier positif'

        if (!errs.top_x_candidates && !errs.top_y_candidates && x <= y)
            errs.top_y_candidates = 'Doit être inférieur à nb X (correspondance profil)'
        if (!errs.top_y_candidates && !errs.top_z_candidates && y <= z)
            errs.top_z_candidates = 'Doit être inférieur à nb Y (revue IA)'

        const threshold = Number(params.similarity_threshold)
        if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100)
            errs.similarity_threshold = 'Doit être entre 0 et 100'

        const dur = Number(params.quiz_default_duration)
        if (!Number.isInteger(dur) || dur <= 0) errs.quiz_default_duration = 'Doit être un entier positif'

        const q = Number(params.quiz_default_questions)
        if (!Number.isInteger(q) || q <= 0) errs.quiz_default_questions = 'Doit être un entier positif'

        return errs
    }

    const handleSaveAiParams = async () => {
        const errs = validateAiParams(aiParams)
        setAiParamsErrors(errs)
        if (Object.keys(errs).length > 0) return

        setAiParamsSaving(true)
        try {
            const payload = {
                parameters: {
                    ai_enabled: Boolean(aiParams.ai_enabled),
                    top_x_candidates: Number(aiParams.top_x_candidates),
                    top_y_candidates: Number(aiParams.top_y_candidates),
                    top_z_candidates: Number(aiParams.top_z_candidates),
                    similarity_threshold: Number(aiParams.similarity_threshold),
                    quiz_default_duration: Number(aiParams.quiz_default_duration),
                    quiz_default_questions: Number(aiParams.quiz_default_questions),
                    quiz_default_difficulty: aiParams.quiz_default_difficulty,
                }
            }
            const data = await apiFetch('/parametrage/ai-scoring', {
                method: 'PUT',
                body: JSON.stringify(payload)
            })
            setAiParamsLastSaved(data.updated_at)
            setMessage({ type: 'success', text: 'Paramètres IA sauvegardés avec succès.' })
        } catch (err) {
            console.error('Failed to save AI parametrage:', err)
            setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde des paramètres IA.' })
        } finally {
            setAiParamsSaving(false)
        }
    }

    const handleResetAiParams = async () => {
        setAiParamsSaving(true)
        setAiParamsErrors({})
        try {
            const data = await apiFetch('/parametrage/ai-scoring/reset', { method: 'POST' })
            if (data?.parameters) setAiParams(data.parameters)
            setAiParamsLastSaved(data.updated_at)
            setMessage({ type: 'success', text: 'Paramètres IA réinitialisés aux valeurs par défaut.' })
        } catch (err) {
            console.error('Failed to reset AI parametrage:', err)
            setMessage({ type: 'error', text: 'Erreur lors de la réinitialisation.' })
        } finally {
            setAiParamsSaving(false)
        }
    }

    const updateAiParam = (key, value) => {
        const nextParams = { ...aiParams, [key]: value }
        setAiParams(nextParams)

        // Live validation for the X > Y > Z constraint
        const pipelineKeys = ['top_x_candidates', 'top_y_candidates', 'top_z_candidates']
        if (pipelineKeys.includes(key)) {
            const x = Number(nextParams.top_x_candidates)
            const y = Number(nextParams.top_y_candidates)
            const z = Number(nextParams.top_z_candidates)
            setAiParamsErrors(prev => {
                const next = { ...prev }
                // Clear previous pipeline errors
                delete next.top_x_candidates
                delete next.top_y_candidates
                delete next.top_z_candidates
                // Re-validate
                if (Number.isInteger(x) && x > 0 && Number.isInteger(y) && y > 0 && x <= y)
                    next.top_y_candidates = 'Doit être inférieur à nb X (correspondance profil)'
                if (Number.isInteger(y) && y > 0 && Number.isInteger(z) && z > 0 && y <= z)
                    next.top_z_candidates = 'Doit être inférieur à nb Y (revue IA)'
                return next
            })
        } else {
            // For non-pipeline fields, just clear the error for this key
            setAiParamsErrors(prev => {
                const next = { ...prev }
                delete next[key]
                return next
            })
        }
    }

    const [googleEmail, setGoogleEmail] = useState('')

    const [connectedAccounts, setConnectedAccounts] = useState({
        google: false,
        linkedin: false,
        microsoft: false,
        github: false
    })

    const toggleAccountConnection = async (account) => {
        if (account === 'google' && !connectedAccounts.google) {
            // Initiate Google OAuth2
            try {
                const response = await apiFetch('/auth/google/url')
                if (response?.url) {
                    window.location.href = response.url
                }
            } catch (err) {
                setMessage({ type: 'error', text: 'Impossible d\'initier la connexion Google.' })
            }
            return
        }
        
        // For other accounts or disconnecting google (placeholder)
        setConnectedAccounts(prev => ({ ...prev, [account]: !prev[account] }))
    }

    const togglePasswordVisibility = (field) => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
    }

    const handleToggleNotification = async (key) => {
        const newValue = !notifications[key]
        const newNotifs = { ...notifications, [key]: newValue }
        setNotifications(newNotifs)

        if (!currentUserId) return
        setNotifSaving(true)
        try {
            const profile = await apiFetch(`/profiles/${currentUserId}`)
            const updatedPrefs = {
                ...(profile?.preferences || {}),
                notifications: newNotifs,
            }
            await apiFetch(`/profiles/${currentUserId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    role: profile.role,
                    company_id: profile.company_id,
                    department_id: profile.department_id,
                    preferences: updatedPrefs,
                }),
            })
        } catch (err) {
            console.error('Erreur sauvegarde notification:', err)
            // Rollback on error
            setNotifications(prev => ({ ...prev, [key]: !newValue }))
            setMessage({ type: 'error', text: 'Erreur lors de la mise à jour des notifications.' })
        } finally {
            setNotifSaving(false)
        }
    }

    const handleThemeChange = (newTheme) => {
        setThemePreference(newTheme)
        setTheme(newTheme) // Update the context theme
    }

    const handleLanguageChange = (lang) => {
        changeLanguage(lang)
        const msg = lang === 'en' ? 'Language updated.' : 'Langue mise à jour.'
        setMessage({ type: 'success', text: msg })
    }

    // Theme preset colors for preview
    const themes = [
        { id: 'dark', label: t('hr-settings-theme-dark'), bg: '#000000', accent: '#ffffff' },
        { id: 'light', label: t('hr-settings-theme-light'), bg: '#ffffff', accent: '#000000' },
        { id: 'system', label: t('hr-settings-theme-system'), bg: 'linear-gradient(135deg, #ffffff 50%, #000000 50%)', accent: '#000000' }
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
                        <h1 className="settings-title">{t('hr-settings-title')}</h1>
                        <p className="settings-subtitle">{t('hr-settings-subtitle')}</p>
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
                            {[
                                { key: 'général', label: t('hr-settings-tab-general') },
                                { key: 'notifications', label: t('hr-settings-tab-notifications') },
                                { key: 'sécurité', label: t('hr-settings-tab-security') },
                                { key: 'connexions', label: t('hr-settings-tab-connections') },
                                { key: 'ia & automatisation', label: t('hr-settings-tab-ai') },
                            ].map(({ key, label }) => (
                                <button
                                    key={key}
                                    className={`tab-button ${activeTab === key ? 'active' : ''}`}
                                    onClick={() => setActiveTab(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* General Section */}
                <section className="settings-card" style={{ display: activeTab === 'général' ? 'block' : 'none' }}>
                    <div className="card-header">
                        <h2 className="card-title">{t('hr-settings-general-title')}</h2>
                        <p className="card-description">{t('hr-settings-general-subtitle')}</p>
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
                                <label>{t('hr-settings-language-label')}</label>
                                <div className="option-group">
                                    <button
                                        className={`option-btn ${language === 'fr' ? 'selected' : ''}`}
                                        onClick={() => handleLanguageChange('fr')}
                                    >
                                        <span className="option-icon-text">FR</span>
                                        <span className="option-text">Français</span>
                                    </button>
                                    <button
                                        className={`option-btn ${language === 'en' ? 'selected' : ''}`}
                                        onClick={() => handleLanguageChange('en')}
                                    >
                                        <span className="option-icon-text">EN</span>
                                        <span className="option-text">English</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <section className="settings-card" style={{ display: activeTab === 'notifications' ? 'block' : 'none' }}>
                    <div className="card-header">
                        <h2 className="card-title">Préférences de notifications</h2>
                        <p className="card-description">Configurez les alertes que vous recevez. Les modifications sont sauvegardées instantanément.</p>
                        {notifSaving && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '4px', display: 'inline-block' }}>💾 Sauvegarde...</span>}
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
                                    <p className="item-subtitle">Activez cette option pour être alerté dès que l'IA détecte un candidat fortement compatible avec l'une de vos offres, afin d'agir rapidement avant qu'il ne soit recruté ailleurs.</p>
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
                                    <p className="item-subtitle">Activez cette option pour recevoir un récapitulatif des nouvelles candidatures soumises sur vos offres actives, vous permettant de suivre l'afflux de profils sans vérifier manuellement chaque offre.</p>
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



                        {/* Item 4 */}
                        <div className="list-item">
                            <div className="item-content">
                                <div className="item-icon">
                                    <span className="material-symbols-outlined">bar_chart</span>
                                </div>
                                <div className="item-text">
                                    <p className="item-title">Rapports de performance</p>
                                    <p className="item-subtitle">Activez cette option pour recevoir des rapports périodiques sur les indicateurs clés du recrutement : taux de conversion, scores moyens IA, avancement du pipeline et efficacité des quiz.</p>
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
                                    <p className="item-subtitle">Activez cette option pour être prévenu automatiquement lorsqu'une offre approche de sa date d'expiration, vous laissant le temps de la prolonger ou de clôturer le processus de recrutement.</p>
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
                                {sessionSuccessMsg && <div className="auth-success-msg" style={{ margin: '0.75rem 0 1rem', color: '#10b981', fontSize: '0.85rem' }}>{sessionSuccessMsg}</div>}
                                {accountError && <div className="auth-error-msg" style={{ margin: '0.75rem 0 1rem', color: '#ef4444', fontSize: '0.85rem' }}>{accountError}</div>}
                                
                                <div className="device-list">
                                    {uniqueDevices.length > 0 ? (
                                        uniqueDevices.map((session, idx) => {
                                            const isCurrent = session.id === currentSession.id;

                                            return (
                                                <div key={session.id || idx} style={{ width: '100%' }}>
                                                    <div className="device-item">
                                                        <div className="device-info">
                                                            <span className="material-symbols-outlined device-icon">
                                                                {session.device.includes('Mac') || session.device.includes('PC') || session.device.includes('Linux') ? 'laptop_mac' : 'smartphone'}
                                                            </span>
                                                            <div>
                                                                <p className="device-name">{session.device}</p>
                                                                <p className="device-meta">{session.browser} · {session.ip || 'IP inconnue'} · {new Date(session.created_at).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        {isCurrent ? (
                                                            <span className="device-status">Actuel</span>
                                                        ) : (
                                                            <span className="device-status" style={{ background: 'var(--dashboard-muted)', color: 'white' }}>Connecté</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="device-item">
                                            <div className="device-info">
                                                <span className="material-symbols-outlined device-icon">
                                                    {currentSession.device.includes('Mac') || currentSession.device.includes('PC') || currentSession.device.includes('Linux') ? 'laptop_mac' : 'smartphone'}
                                                </span>
                                                <div>
                                                    <p className="device-name">{currentSession.device}</p>
                                                    <p className="device-meta">{currentSession.browser} · Actif maintenant</p>
                                                </div>
                                            </div>
                                            <span className="device-status">Actuel</span>
                                        </div>
                                    )}

                                    <div className="device-item" style={{ border: 'none', justifyContent: 'center' }}>
                                        <button 
                                            className="icon-btn" 
                                            onClick={handleSignOutOtherSessions}
                                            disabled={isSigningOutOthers || allSessions.length <= 1}
                                            style={{ 
                                                width: 'auto', 
                                                padding: '0.5rem 1rem', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '0.5rem', 
                                                color: '#ef4444', 
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                borderRadius: '0.5rem',
                                                opacity: (isSigningOutOthers || allSessions.length <= 1) ? 0.7 : 1
                                            }}
                                        >
                                            <span className="material-symbols-outlined">{isSigningOutOthers ? 'sync' : 'logout'}</span>
                                            {isSigningOutOthers ? 'Traitement...' : 'Déconnecter les autres appareils'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="separator-line"></div>

                            {/* Login History */}
                            <div className="security-section">
                                <h3>Historique de connexion</h3>
                                <div className="device-list">
                                    {allSessions.length > 0 ? (
                                        allSessions.slice(0, 5).map((session, idx) => {
                                            const { browser, device } = parseUA(session.user_agent || '');
                                            return (
                                                <div className="device-item" key={session.id || idx}>
                                                    <div className="device-info">
                                                        <span className="material-symbols-outlined status-icon success">
                                                            {session.id === currentSession.id ? 'check' : 'history'}
                                                        </span>
                                                        <div>
                                                            <p className="device-name">Connexion via {device}</p>
                                                            <p className="device-meta">{browser} · {session.ip || '0.0.0.0'} · {new Date(session.created_at).toLocaleString('fr-FR')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="device-meta" style={{ padding: '1rem' }}>Aucune historique récente.</p>
                                    )}
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
                                    <div className="connection-status-group">
                                        <span className="connection-status connected">Connecté</span>
                                        {googleEmail && <span className="connection-account-email">{googleEmail}</span>}
                                    </div>
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

                    </div>
                </section>

                {/* IA & Automatisation Section */}
                <section className="settings-card" style={{ display: activeTab === 'ia & automatisation' ? 'block' : 'none' }}>
                    <div className="card-header">
                        <h2 className="card-title">
                            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>psychology</span>
                            Scoring & Sélection IA
                        </h2>
                        <p className="card-description">
                            Définissez les paramètres par défaut utilisés lors de la création des offres. Ces valeurs s'appliquent à toute l'application et peuvent être surchargées par offre.
                        </p>
                    </div>

                    {aiParamsLoading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}>sync</span>
                            <p>Chargement des paramètres...</p>
                        </div>
                    ) : (
                        <div className="ai-params-content">
                            {/* Master AI Toggle */}
                            <div className="ai-params-activation-card">
                                <div className="ai-activation-info">
                                    <div className="ai-activation-icon">
                                        <span className="material-symbols-outlined">psychology</span>
                                    </div>
                                    <div>
                                        <h3>Analyse IA automatique</h3>
                                        <p>Active le filtrage automatique des candidatures par IA sur toutes les offres. Lorsque désactivé, aucune analyse automatique ne sera lancée.</p>
                                    </div>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={aiParams.ai_enabled}
                                        onChange={(e) => updateAiParam('ai_enabled', e.target.checked)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className={`ai-params-body ${!aiParams.ai_enabled ? 'is-disabled' : ''}`}>
                            {/* Filtering Pipeline */}
                            <div className="ai-params-group">
                                <div className="ai-params-group-header">
                                    <span className="material-symbols-outlined">filter_alt</span>
                                    <div>
                                        <h3>Pipeline de filtrage</h3>
                                        <p>Nombre de candidats conservés à chaque étape de l'entonnoir automatique.</p>
                                    </div>
                                </div>

                                <div className="ai-params-grid">
                                    <div className="ai-param-card">
                                        <div className="ai-param-card-header">
                                            <div className="ai-param-step-badge">1</div>
                                            <div>
                                                <label className="ai-param-label">nb X — Correspondance profil</label>
                                                <p className="ai-param-help">Première shortlist basée sur la similarité vectorielle entre les profils candidats et l'offre.</p>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            className={`form-input ${aiParamsErrors.top_x_candidates ? 'has-error' : ''}`}
                                            value={aiParams.top_x_candidates}
                                            onChange={(e) => updateAiParam('top_x_candidates', e.target.value)}
                                            min="1"
                                        />
                                        {aiParamsErrors.top_x_candidates && <span className="ai-param-error">{aiParamsErrors.top_x_candidates}</span>}
                                    </div>

                                    <div className="ai-param-card">
                                        <div className="ai-param-card-header">
                                            <div className="ai-param-step-badge">2</div>
                                            <div>
                                                <label className="ai-param-label">nb Y — Revue IA</label>
                                                <p className="ai-param-help">Shortlist réduite sélectionnée après scoring par l'IA.</p>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            className={`form-input ${aiParamsErrors.top_y_candidates ? 'has-error' : ''}`}
                                            value={aiParams.top_y_candidates}
                                            onChange={(e) => updateAiParam('top_y_candidates', e.target.value)}
                                            min="1"
                                        />
                                        {aiParamsErrors.top_y_candidates && <span className="ai-param-error">{aiParamsErrors.top_y_candidates}</span>}
                                    </div>

                                    <div className="ai-param-card">
                                        <div className="ai-param-card-header">
                                            <div className="ai-param-step-badge">3</div>
                                            <div>
                                                <label className="ai-param-label">nb Z — Envoyés en entretien</label>
                                                <p className="ai-param-help">Shortlist finale après l'étape quiz, promus à l'étape entretien.</p>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            className={`form-input ${aiParamsErrors.top_z_candidates ? 'has-error' : ''}`}
                                            value={aiParams.top_z_candidates}
                                            onChange={(e) => updateAiParam('top_z_candidates', e.target.value)}
                                            min="1"
                                        />
                                        {aiParamsErrors.top_z_candidates && <span className="ai-param-error">{aiParamsErrors.top_z_candidates}</span>}
                                    </div>
                                </div>

                                {/* Visual funnel */}
                                <div className="ai-params-funnel">
                                    <div className="funnel-step funnel-step--x">
                                        <span className="funnel-count">{aiParams.top_x_candidates}</span>
                                        <span className="funnel-label">Correspondance profil</span>
                                    </div>
                                    <span className="material-symbols-outlined funnel-arrow">arrow_downward</span>
                                    <div className="funnel-step funnel-step--y">
                                        <span className="funnel-count">{aiParams.top_y_candidates}</span>
                                        <span className="funnel-label">Revue IA</span>
                                    </div>
                                    <span className="material-symbols-outlined funnel-arrow">arrow_downward</span>
                                    <div className="funnel-step funnel-step--z">
                                        <span className="funnel-count">{aiParams.top_z_candidates}</span>
                                        <span className="funnel-label">Entretien</span>
                                    </div>
                                </div>
                            </div>

                            {/* Similarity Threshold */}
                            <div className="ai-params-group">
                                <div className="ai-params-group-header">
                                    <span className="material-symbols-outlined">tune</span>
                                    <div>
                                        <h3>Seuil de similarité</h3>
                                        <p>Score minimum de correspondance vectorielle (0–100) pour qu'un candidat soit considéré.</p>
                                    </div>
                                </div>
                                <div className="ai-param-inline">
                                    <input
                                        type="number"
                                        className={`form-input ${aiParamsErrors.similarity_threshold ? 'has-error' : ''}`}
                                        value={aiParams.similarity_threshold}
                                        onChange={(e) => updateAiParam('similarity_threshold', e.target.value)}
                                        min="0"
                                        max="100"
                                        style={{ maxWidth: '120px' }}
                                    />
                                    <span className="ai-param-unit">%</span>
                                    {aiParamsErrors.similarity_threshold && <span className="ai-param-error">{aiParamsErrors.similarity_threshold}</span>}
                                </div>
                            </div>

                            {/* Quiz Defaults */}
                            <div className="ai-params-group">
                                <div className="ai-params-group-header">
                                    <span className="material-symbols-outlined">quiz</span>
                                    <div>
                                        <h3>Quiz — Valeurs par défaut</h3>
                                        <p>Pré-remplies lors de la création d'un quiz dans une offre.</p>
                                    </div>
                                </div>

                                <div className="ai-params-grid">
                                    <div className="ai-param-card">
                                        <label className="ai-param-label">Durée par défaut (min)</label>
                                        <input
                                            type="number"
                                            className={`form-input ${aiParamsErrors.quiz_default_duration ? 'has-error' : ''}`}
                                            value={aiParams.quiz_default_duration}
                                            onChange={(e) => updateAiParam('quiz_default_duration', e.target.value)}
                                            min="1"
                                        />
                                        {aiParamsErrors.quiz_default_duration && <span className="ai-param-error">{aiParamsErrors.quiz_default_duration}</span>}
                                    </div>

                                    <div className="ai-param-card">
                                        <label className="ai-param-label">Nombre de questions par défaut</label>
                                        <input
                                            type="number"
                                            className={`form-input ${aiParamsErrors.quiz_default_questions ? 'has-error' : ''}`}
                                            value={aiParams.quiz_default_questions}
                                            onChange={(e) => updateAiParam('quiz_default_questions', e.target.value)}
                                            min="1"
                                        />
                                        {aiParamsErrors.quiz_default_questions && <span className="ai-param-error">{aiParamsErrors.quiz_default_questions}</span>}
                                    </div>

                                    <div className="ai-param-card">
                                        <label className="ai-param-label">Difficulté par défaut</label>
                                        <div className="ai-param-difficulty-group">
                                            {[
                                                { value: 'easy', label: 'Facile' },
                                                { value: 'medium', label: 'Équilibré' },
                                                { value: 'hard', label: 'Difficile' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    className={`ai-param-diff-btn ${aiParams.quiz_default_difficulty === opt.value ? 'is-active' : ''}`}
                                                    onClick={() => updateAiParam('quiz_default_difficulty', opt.value)}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="ai-params-actions">
                                {aiParamsLastSaved && (
                                    <span className="ai-params-timestamp">
                                        Dernière sauvegarde : {new Date(aiParamsLastSaved).toLocaleString('fr-FR')}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={handleResetAiParams}
                                    disabled={aiParamsSaving}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: '0.375rem' }}>restart_alt</span>
                                    Réinitialiser
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleSaveAiParams}
                                    disabled={aiParamsSaving}
                                >
                                    {aiParamsSaving ? (
                                        <>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: '0.375rem', animation: 'spin 1s linear infinite' }}>sync</span>
                                            Sauvegarde...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: '0.375rem' }}>save</span>
                                            Sauvegarder
                                        </>
                                    )}
                                </button>
                            </div>
                            </div>
                        </div>
                    )}
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
