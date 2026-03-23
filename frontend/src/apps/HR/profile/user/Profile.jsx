import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'
import HRSidebar from '../../components/HRSidebar'
import { supabase } from '../../../../core/supabaseClient'
import { apiFetch, SERVER_URL } from '../../../../core/api'
import './Profile.css'

function Profile() {
    const { effectiveTheme } = useTheme()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        position: '',
    })
    const [initialData, setInitialData] = useState({})
    const [avatarUrl, setAvatarUrl] = useState(null)
    const fileInputRef = useRef(null)
    
    // Edit mode state
    const [isEditing, setIsEditing] = useState(false)

    const [aiPreferences, setAiPreferences] = useState({
        highMatchAlerts: true,
        weeklyDigest: true,
        autoCV: false,
        sensitivity: 75,
    })

    useEffect(() => {
        const fetchUser = async () => {
            setLoading(true)
            try {
                const { data: { user }, error } = await supabase.auth.getUser()
                if (error || !user) throw error || new Error('Not authenticated')

                let profile = null
                try {
                    profile = await apiFetch(`/profiles/${user.id}`)
                } catch (err) {
                    console.log("No profile found yet, will create later if needed")
                }

                const loaded = {
                    firstName: profile?.first_name || user.user_metadata?.first_name || '',
                    lastName:  profile?.last_name  || user.user_metadata?.last_name  || '',
                    phone:     profile?.phone      || user.user_metadata?.phone      || '',
                    position:  profile?.position   || user.user_metadata?.position   || '',
                    email:     user.email || '',
                }
                setFormData(loaded)
                setInitialData(loaded)
                if (profile?.avatar_url) {
                    setAvatarUrl(profile.avatar_url)
                }
                if (profile?.preferences) {
                    setAiPreferences(prev => ({ ...prev, ...profile.preferences }))
                }
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
        formData.phone     !== initialData.phone     ||
        formData.position  !== initialData.position

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })
    const handleToggle = (key) => setAiPreferences({ ...aiPreferences, [key]: !aiPreferences[key] })
    const handleSensitivity = (e) => setAiPreferences({ ...aiPreferences, sensitivity: parseInt(e.target.value) })

    const handleCancel = () => {
        setFormData({ ...initialData })
        setIsEditing(false)
    }

    const triggerFileSelect = () => {
        if (fileInputRef.current) fileInputRef.current.click()
    }

    const handleFileChange = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        try {
            const { data: { user } } = await supabase.auth.getUser()
            const uploadData = new FormData()
            uploadData.append('file', file)

            const res = await apiFetch(`/profiles/${user.id}/avatar`, {
                method: 'POST',
                body: uploadData
            })

            if (res && res.avatar_url) {
                setAvatarUrl(res.avatar_url)
                setMessage({ type: 'success', text: 'Photo de profil mise à jour !' })
                setTimeout(() => setMessage({ type: '', text: '' }), 3500)
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Erreur lors de l\'upload de la photo.' })
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
                    last_name: formData.lastName,
                    phone: formData.phone,
                    position: formData.position,
                    preferences: aiPreferences
                }
                
                try {
                    // Try to update existing profile
                    await apiFetch(`/profiles/${user.id}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    })
                } catch (updateErr) {
                    // If 404, create it
                    if (updateErr.status === 404) {
                        await apiFetch(`/profiles/`, {
                            method: 'POST',
                            body: JSON.stringify({ ...payload, id: user.id, email: user.email })
                        })
                    } else {
                        throw updateErr
                    }
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

    const initials = loading ? '...' :
        `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || '?'
    const fullName = loading ? 'Chargement...' :
        `${formData.firstName} ${formData.lastName}`.trim() || 'Utilisateur'

    return (
        <div className={`profile-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="profile-main">
                <div className="profile-container">

                    {/* Header */}
                    <div className="profile-header-row">
                        <div>
                            <h1 className="profile-page-title">Mon Profil</h1>
                            <p className="profile-page-subtitle">Gérez vos informations personnelles et vos préférences.</p>
                        </div>
                        <div className="profile-header-actions">
                            {!isEditing ? (
                                <button className="profile-btn profile-btn--ghost"
                                    onClick={() => setIsEditing(true)}>
                                    <span className="material-symbols-outlined">edit</span>
                                    Modifier
                                </button>
                            ) : (
                                <>
                                    <button className="profile-btn profile-btn--ghost"
                                        onClick={handleCancel}>
                                        Annuler
                                    </button>
                                    <button className="profile-btn profile-btn--primary"
                                        onClick={handleSave} disabled={saving || (!hasChanges && isEditing)}>
                                        <span className="material-symbols-outlined">{saving ? 'sync' : 'save'}</span>
                                        {saving ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Feedback */}
                    {message.text && (
                        <div className={`profile-feedback profile-feedback--${message.type}`}>
                            <span className="material-symbols-outlined">
                                {message.type === 'success' ? 'check_circle' : 'error'}
                            </span>
                            {message.text}
                        </div>
                    )}

                    {/* Identity Card */}
                    <div className="profile-identity-card">
                        <div className="profile-avatar-circle" onClick={triggerFileSelect} style={{ cursor: 'pointer' }}>
                            {avatarUrl ? (
                                <img src={`${SERVER_URL}${avatarUrl}`} alt="Avatar" className="profile-avatar-img" />
                            ) : (
                                initials
                            )}
                            <div className="profile-avatar-overlay">
                                <span className="material-symbols-outlined">camera_alt</span>
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
                        
                        <div className="profile-identity-info">
                            <h2 className="profile-identity-name">{fullName}</h2>
                            <p className="profile-identity-role">{formData.position || 'Recruteur'}</p>
                        </div>
                        <span className="profile-identity-badge">
                            <span className="profile-badge-dot"></span>Actif
                        </span>
                    </div>

                    {/* Main two-column grid */}
                    <div className="profile-grid">

                        {/* Left: Informations */}
                        <div className="profile-card">
                            <div className="profile-card-head">
                                <span className="material-symbols-outlined">badge</span>
                                <div>
                                    <h3 className="profile-card-title">Informations Personnelles</h3>
                                    <p className="profile-card-sub">Vos coordonnées et votre poste.</p>
                                </div>
                            </div>
                            <div className="profile-card-body">
                                <div className="profile-form-grid">
                                    <div className="profile-field">
                                        <label className="profile-label">Prénom</label>
                                        <div className="profile-input-wrap">
                                            <span className="material-symbols-outlined profile-input-icon">person</span>
                                            <input type="text" name="firstName" className="profile-input"
                                                value={formData.firstName} onChange={handleChange}
                                                placeholder="Votre prénom" disabled={loading || !isEditing} />
                                        </div>
                                    </div>
                                    <div className="profile-field">
                                        <label className="profile-label">Nom</label>
                                        <div className="profile-input-wrap">
                                            <span className="material-symbols-outlined profile-input-icon">person</span>
                                            <input type="text" name="lastName" className="profile-input"
                                                value={formData.lastName} onChange={handleChange}
                                                placeholder="Votre nom" disabled={loading || !isEditing} />
                                        </div>
                                    </div>
                                    <div className="profile-field profile-field--full">
                                        <label className="profile-label">
                                            Email <span className="profile-label-hint">(non modifiable)</span>
                                        </label>
                                        <div className="profile-input-wrap">
                                            <span className="material-symbols-outlined profile-input-icon">email</span>
                                            <input type="email" className="profile-input profile-input--readonly"
                                                value={formData.email} readOnly disabled />
                                        </div>
                                    </div>
                                    <div className="profile-field">
                                        <label className="profile-label">Téléphone</label>
                                        <div className="profile-input-wrap">
                                            <span className="material-symbols-outlined profile-input-icon">phone</span>
                                            <input type="tel" name="phone" className="profile-input"
                                                value={formData.phone} onChange={handleChange}
                                                placeholder="+216 00 000 000" disabled={loading || !isEditing} />
                                        </div>
                                    </div>
                                    <div className="profile-field">
                                        <label className="profile-label">Poste actuel</label>
                                        <div className="profile-input-wrap">
                                            <span className="material-symbols-outlined profile-input-icon">work</span>
                                            <input type="text" name="position" className="profile-input"
                                                value={formData.position} onChange={handleChange}
                                                placeholder="Ex. Recruteur Senior" disabled={loading || !isEditing} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Préférences IA */}
                        <div className="profile-card">
                            <div className="profile-card-head">
                                <span className="material-symbols-outlined">psychology</span>
                                <div>
                                    <h3 className="profile-card-title">Préférences IA</h3>
                                    <p className="profile-card-sub">Comportement de l'intelligence artificielle.</p>
                                </div>
                            </div>
                            <div className="profile-card-body">
                                <div className="profile-prefs">
                                    {[
                                        { key: 'highMatchAlerts', icon: 'notifications_active', title: 'Alertes Match Élevé', desc: 'Alerte quand un candidat dépasse 90% de compatibilité.' },
                                        { key: 'weeklyDigest',   icon: 'summarize',            title: 'Résumé Hebdomadaire IA', desc: 'Digest des meilleures opportunités détectées par l\'IA.' },
                                        { key: 'autoCV',         icon: 'document_scanner',     title: 'Analyse CV Automatique', desc: 'L\'IA pré-scanne les nouveaux CV entrants.' },
                                    ].map(p => (
                                        <div key={p.key} className="profile-pref-item">
                                            <div className="profile-pref-icon-wrap">
                                                <span className="material-symbols-outlined">{p.icon}</span>
                                            </div>
                                            <div className="profile-pref-info">
                                                <p className="profile-pref-title">{p.title}</p>
                                                <p className="profile-pref-desc">{p.desc}</p>
                                            </div>
                                            <label className="profile-toggle">
                                                <input type="checkbox"
                                                    checked={aiPreferences[p.key]}
                                                    onChange={() => handleToggle(p.key)} />
                                                <span className="profile-toggle-slider"></span>
                                            </label>
                                        </div>
                                    ))}

                                    <div className="profile-slider-wrap">
                                        <div className="profile-slider-header">
                                            <div>
                                                <p className="profile-pref-title">Sensibilité de l'algorithme</p>
                                                <p className="profile-pref-desc">Précision du matching IA</p>
                                            </div>
                                            <span className="profile-slider-value">{aiPreferences.sensitivity}%</span>
                                        </div>
                                        <input type="range" min="0" max="100"
                                            value={aiPreferences.sensitivity}
                                            onChange={handleSensitivity}
                                            className="profile-range" />
                                        <div className="profile-slider-labels">
                                            <span>Large</span><span>Équilibré</span><span>Strict</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    )
}

export default Profile
