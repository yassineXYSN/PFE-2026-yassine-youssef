import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'
import HRSidebar from '../../components/HRSidebar'
import HRPageLoader from '../../components/HRPageLoader'
import { supabase } from '../../../../core/supabaseClient'
import { apiFetch, SERVER_URL, getUserRole } from '../../../../core/api'
import './Profile.css'

const getRoleLabel = (role) => {
    switch (role) {
        case 'admin':            return 'Administrateur'
        case 'superadmin':       return 'Super Admin'
        case 'recruiter':        return 'Recruteur'
        case 'chef_departement': return 'Chef de Département'
        default:                 return 'Utilisateur RH'
    }
}

function Profile() {
    const { effectiveTheme } = useTheme()
    const isDark = effectiveTheme === 'dark'

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })
    const [isEditing, setIsEditing] = useState(false)
    const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || '')

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
    })
    const [initialData, setInitialData] = useState({})
    const [avatarUrl, setAvatarUrl] = useState(null)
    const fileInputRef = useRef(null)

    useEffect(() => {
        const fetchUser = async () => {
            setLoading(true)
            try {
                const { data: { user }, error } = await supabase.auth.getUser()
                if (error || !user) throw error || new Error('Not authenticated')

                let profile = null
                try {
                    profile = await apiFetch(`/profiles/${user.id}`)
                } catch {
                    console.log('No profile found yet')
                }

                const loaded = {
                    firstName: profile?.first_name || user.user_metadata?.first_name || '',
                    lastName:  profile?.last_name  || user.user_metadata?.last_name  || '',
                    phone:     profile?.phone      || user.user_metadata?.phone      || '',
                    email:     user.email || '',
                }
                setFormData(loaded)
                setInitialData(loaded)
                if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)

                // Fetch role
                try {
                    const { data: { session } } = await supabase.auth.getSession()
                    const role = await getUserRole(session)
                    if (role) {
                        setUserRole(role)
                        localStorage.setItem('userRole', role)
                    }
                } catch {}
            } catch (err) {
                console.error('Profile load error:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchUser()
    }, [])

    const hasChanges =
        formData.firstName !== initialData.firstName ||
        formData.lastName  !== initialData.lastName  ||
        formData.phone     !== initialData.phone

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

    const handleCancel = () => {
        setFormData({ ...initialData })
        setIsEditing(false)
    }

    const handleFileChange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const uploadData = new FormData()
            uploadData.append('file', file)
            const res = await apiFetch(`/profiles/${user.id}/avatar`, { method: 'POST', body: uploadData })
            if (res?.avatar_url) {
                setAvatarUrl(res.avatar_url)
                setMessage({ type: 'success', text: 'Photo de profil mise à jour !' })
                setTimeout(() => setMessage({ type: '', text: '' }), 3500)
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Erreur lors de l\'upload.' })
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setMessage({ type: '', text: '' })
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const payload = {
                    first_name: formData.firstName,
                    last_name:  formData.lastName,
                    phone:      formData.phone,
                }
                try {
                    await apiFetch(`/profiles/${user.id}`, { method: 'PUT', body: JSON.stringify(payload) })
                } catch (updateErr) {
                    if (updateErr.status === 404) {
                        await apiFetch(`/profiles/`, { method: 'POST', body: JSON.stringify({ ...payload, id: user.id, email: user.email }) })
                    } else throw updateErr
                }
            }
            setInitialData({ ...formData })
            setIsEditing(false)
            setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' })
            setTimeout(() => setMessage({ type: '', text: '' }), 3500)
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde.' })
        } finally {
            setSaving(false)
        }
    }

    const initials   = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || '?'
    const fullName   = `${formData.firstName} ${formData.lastName}`.trim() || 'Utilisateur'
    const roleLabel  = getRoleLabel(userRole)

    if (loading) {
        return (
            <div className={`prf-page ${isDark ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="prf-main">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <HRPageLoader variant="profile" title="Chargement du profil..." />
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className={`prf-page ${isDark ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="prf-main">
                <div className="prf-container">

                    {/* ── Page Header ── */}
                    <div className="prf-page-header">
                        <div>
                            <h1 className="prf-page-title">Mon Profil</h1>
                            <p className="prf-page-sub">Gérez vos informations personnelles et professionnelles.</p>
                        </div>
                        <div className="prf-header-actions">
                            {!isEditing ? (
                                <button id="prf-edit-btn" className="prf-btn prf-btn--outline" onClick={() => setIsEditing(true)}>
                                    <span className="material-symbols-outlined">edit</span>
                                    Modifier
                                </button>
                            ) : (
                                <>
                                    <button className="prf-btn prf-btn--ghost" onClick={handleCancel}>
                                        Annuler
                                    </button>
                                    <button
                                        id="prf-save-btn"
                                        className="prf-btn prf-btn--primary"
                                        onClick={handleSave}
                                        disabled={saving || !hasChanges}
                                    >
                                        <span className="material-symbols-outlined">
                                            {saving ? 'sync' : 'save'}
                                        </span>
                                        {saving ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Feedback ── */}
                    {message.text && (
                        <div className={`prf-feedback prf-feedback--${message.type}`}>
                            <span className="material-symbols-outlined">
                                {message.type === 'success' ? 'check_circle' : 'error'}
                            </span>
                            {message.text}
                        </div>
                    )}

                    {/* ── Two-column layout ── */}
                    <div className="prf-layout">

                        {/* ─── LEFT: Identity Panel ─── */}
                        <aside className="prf-identity-panel">

                            {/* Avatar */}
                            <div className="prf-avatar-block">
                                <div
                                    className="prf-avatar"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Changer la photo"
                                >
                                    {avatarUrl ? (
                                        <img src={`${SERVER_URL}${avatarUrl}`} alt="Avatar" className="prf-avatar-img" />
                                    ) : (
                                        <span className="prf-avatar-initials">{initials}</span>
                                    )}
                                    <div className="prf-avatar-overlay">
                                        <span className="material-symbols-outlined">photo_camera</span>
                                    </div>
                                </div>
                                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
                                <p className="prf-avatar-hint">Cliquer pour modifier</p>
                            </div>

                            {/* Name & role */}
                            <div className="prf-identity-info">
                                <h2 className="prf-identity-name">{fullName}</h2>
                                <p className="prf-identity-role">{roleLabel}</p>
                                <span className="prf-identity-badge">
                                    <span className="prf-badge-dot" />
                                    Actif
                                </span>
                            </div>

                            {/* Divider */}
                            <div className="prf-panel-divider" />

                            {/* Quick info */}
                            <ul className="prf-quick-info">
                                <li className="prf-quick-item">
                                    <span className="material-symbols-outlined prf-quick-icon">mail</span>
                                    <div>
                                        <p className="prf-quick-label">Email</p>
                                        <p className="prf-quick-value">{formData.email || '—'}</p>
                                    </div>
                                </li>
                                <li className="prf-quick-item">
                                    <span className="material-symbols-outlined prf-quick-icon">phone</span>
                                    <div>
                                        <p className="prf-quick-label">Téléphone</p>
                                        <p className="prf-quick-value">{formData.phone || '—'}</p>
                                    </div>
                                </li>
                                <li className="prf-quick-item">
                                    <span className="material-symbols-outlined prf-quick-icon">badge</span>
                                    <div>
                                        <p className="prf-quick-label">Rôle</p>
                                        <p className="prf-quick-value">{roleLabel}</p>
                                    </div>
                                </li>
                                <li className="prf-quick-item">
                                    <span className="material-symbols-outlined prf-quick-icon">verified_user</span>
                                    <div>
                                        <p className="prf-quick-label">Sécurité</p>
                                        <p className="prf-quick-value prf-quick-value--verified">Email vérifié ✓</p>
                                    </div>
                                </li>
                            </ul>

                            {/* Reset password link */}
                            <a href="/hr/reset-password" className="prf-reset-link">
                                <span className="material-symbols-outlined">lock_reset</span>
                                Changer le mot de passe
                            </a>
                        </aside>

                        {/* ─── RIGHT: Form Panel ─── */}
                        <section className="prf-form-panel">

                            {/* Section: Informations personnelles */}
                            <div className="prf-card">
                                <div className="prf-card-header">
                                    <span className="material-symbols-outlined prf-card-icon">badge</span>
                                    <div>
                                        <h3 className="prf-card-title">Informations personnelles</h3>
                                        <p className="prf-card-sub">Vos coordonnées et votre poste au sein de l'entreprise.</p>
                                    </div>
                                </div>

                                <div className="prf-card-body">
                                    <div className="prf-form-grid">

                                        <div className="prf-field">
                                            <label className="prf-label">Prénom</label>
                                            <div className="prf-input-wrap">
                                                <span className="material-symbols-outlined prf-input-icon">person</span>
                                                <input
                                                    type="text"
                                                    name="firstName"
                                                    className={`prf-input ${isEditing ? 'prf-input--editable' : ''}`}
                                                    value={formData.firstName}
                                                    onChange={handleChange}
                                                    placeholder="Votre prénom"
                                                    disabled={!isEditing}
                                                />
                                            </div>
                                        </div>

                                        <div className="prf-field">
                                            <label className="prf-label">Nom de famille</label>
                                            <div className="prf-input-wrap">
                                                <span className="material-symbols-outlined prf-input-icon">person</span>
                                                <input
                                                    type="text"
                                                    name="lastName"
                                                    className={`prf-input ${isEditing ? 'prf-input--editable' : ''}`}
                                                    value={formData.lastName}
                                                    onChange={handleChange}
                                                    placeholder="Votre nom"
                                                    disabled={!isEditing}
                                                />
                                            </div>
                                        </div>

                                        <div className="prf-field prf-field--full">
                                            <label className="prf-label">
                                                Adresse email
                                                <span className="prf-label-tag">Non modifiable</span>
                                            </label>
                                            <div className="prf-input-wrap">
                                                <span className="material-symbols-outlined prf-input-icon">mail</span>
                                                <input
                                                    type="email"
                                                    className="prf-input prf-input--readonly"
                                                    value={formData.email}
                                                    readOnly
                                                    disabled
                                                />
                                            </div>
                                        </div>

                                        <div className="prf-field">
                                            <label className="prf-label">Téléphone</label>
                                            <div className="prf-input-wrap">
                                                <span className="material-symbols-outlined prf-input-icon">phone</span>
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    className={`prf-input ${isEditing ? 'prf-input--editable' : ''}`}
                                                    value={formData.phone}
                                                    onChange={handleChange}
                                                    placeholder="+216 00 000 000"
                                                    disabled={!isEditing}
                                                />
                                            </div>
                                        </div>

                                        <div className="prf-field">
                                            <label className="prf-label">
                                                Rôle
                                                <span className="prf-label-tag">Non modifiable</span>
                                            </label>
                                            <div className="prf-input-wrap">
                                                <span className="material-symbols-outlined prf-input-icon">badge</span>
                                                <input
                                                    type="text"
                                                    className="prf-input prf-input--readonly"
                                                    value={roleLabel}
                                                    readOnly
                                                    disabled
                                                />
                                            </div>
                                        </div>

                                    </div>
                                </div>

                                {isEditing && (
                                    <div className="prf-card-footer">
                                        <span className="prf-footer-hint">
                                            <span className="material-symbols-outlined">info</span>
                                            Les modifications seront sauvegardées immédiatement.
                                        </span>
                                        <div className="prf-footer-actions">
                                            <button className="prf-btn prf-btn--ghost" onClick={handleCancel}>
                                                Annuler
                                            </button>
                                            <button
                                                className="prf-btn prf-btn--primary"
                                                onClick={handleSave}
                                                disabled={saving || !hasChanges}
                                            >
                                                <span className="material-symbols-outlined">
                                                    {saving ? 'sync' : 'save'}
                                                </span>
                                                {saving ? 'Enregistrement...' : 'Sauvegarder'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section: Sécurité */}
                            <div className="prf-card">
                                <div className="prf-card-header">
                                    <span className="material-symbols-outlined prf-card-icon">security</span>
                                    <div>
                                        <h3 className="prf-card-title">Sécurité du compte</h3>
                                        <p className="prf-card-sub">Gérez l'accès et la protection de votre compte.</p>
                                    </div>
                                </div>

                                <div className="prf-card-body prf-card-body--no-padding">
                                    <div className="prf-security-row">
                                        <div className="prf-security-icon-wrap">
                                            <span className="material-symbols-outlined">lock</span>
                                        </div>
                                        <div className="prf-security-text">
                                            <p className="prf-security-title">Mot de passe</p>
                                            <p className="prf-security-desc">Modifiez votre mot de passe pour sécuriser l'accès.</p>
                                        </div>
                                        <a href="/hr/reset-password" className="prf-btn prf-btn--outline prf-btn--sm">
                                            Modifier
                                            <span className="material-symbols-outlined">arrow_forward</span>
                                        </a>
                                    </div>

                                    <div className="prf-security-row prf-security-row--no-border">
                                        <div className="prf-security-icon-wrap prf-security-icon-wrap--green">
                                            <span className="material-symbols-outlined">verified_user</span>
                                        </div>
                                        <div className="prf-security-text">
                                            <p className="prf-security-title">Authentification à deux facteurs</p>
                                            <p className="prf-security-desc">Compte protégé par OTP envoyé par email.</p>
                                        </div>
                                        <span className="prf-status-chip prf-status-chip--on">
                                            <span className="prf-badge-dot" />
                                            Activé
                                        </span>
                                    </div>
                                </div>
                            </div>

                        </section>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default Profile
