import { useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import HRSidebar from '../../components/HRSidebar'
import './Profile.css'

function Profile() {
    const { effectiveTheme } = useTheme()

    // Initial data (unchanged reference)
    const initialData = {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@recruitai.com',
        phone: '+33 6 12 34 56 78',
        position: 'Recruteur Senior',
    }

    const [formData, setFormData] = useState({
        ...initialData,
        newPassword: '',
        confirmPassword: '',
    })

    const [aiPreferences, setAiPreferences] = useState({
        highMatchAlerts: true,
        weeklyDigest: true,
        autoCV: false,
        sensitivity: 75,
    })

    // Check if form has changes
    const hasChanges =
        formData.firstName !== initialData.firstName ||
        formData.lastName !== initialData.lastName ||
        formData.email !== initialData.email ||
        formData.phone !== initialData.phone ||
        formData.position !== initialData.position

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleToggle = (key) => {
        setAiPreferences({ ...aiPreferences, [key]: !aiPreferences[key] })
    }

    const handleSensitivityChange = (e) => {
        setAiPreferences({ ...aiPreferences, sensitivity: parseInt(e.target.value) })
    }

    return (
        <div className={`profile-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="profile-main">
                <div className="profile-container">
                    {/* Page Header */}
                    <div className="profile-header">
                        <h1 className="profile-title">Profil</h1>
                        <p className="profile-subtitle">
                            Gérez vos informations personnelles et vos préférences de notification IA.
                        </p>
                    </div>

                    {/* Profile Card */}
                    <div className="profile-card">
                        <div className="profile-card-header">
                            <div className="profile-info">
                                <div className="profile-avatar"></div>
                                <div className="profile-details">
                                    <h2 className="profile-name">Jean Dupont</h2>
                                    <p className="profile-role">Recruteur Senior • Paris, France</p>
                                    <div className="profile-status">
                                        <span className="status-badge">Actif</span>
                                    </div>
                                </div>
                            </div>
                            <button className="btn btn-secondary">
                                <span className="material-symbols-outlined">edit</span>
                                Modifier la photo
                            </button>
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="profile-grid">
                        {/* Left Column */}
                        <div className="profile-left">
                            {/* Personal Information */}
                            <section className="profile-section">
                                <h3 className="section-title">Informations Personnelles</h3>
                                <div className="section-card">
                                    <div className="form-grid">
                                        <div className="form-row">
                                            <label className="form-label">
                                                <span>Prénom</span>
                                                <input
                                                    type="text"
                                                    name="firstName"
                                                    className="form-input"
                                                    value={formData.firstName}
                                                    onChange={handleInputChange}
                                                    placeholder="Youssef"
                                                />
                                            </label>
                                            <label className="form-label">
                                                <span>Nom</span>
                                                <input
                                                    type="text"
                                                    name="lastName"
                                                    className="form-input"
                                                    value={formData.lastName}
                                                    onChange={handleInputChange}
                                                    placeholder="Ben Yedder"
                                                />
                                            </label>
                                        </div>
                                        <div className="form-row-single">
                                            <label className="form-label">
                                                <span>Email professionnel</span>
                                                <div className="input-with-icon">
                                                    <span className="material-symbols-outlined input-icon">email</span>
                                                    <input
                                                        type="email"
                                                        name="email"
                                                        className="form-input form-input--icon"
                                                        value={formData.email}
                                                        onChange={handleInputChange}
                                                        placeholder="youssef.benyedder@entreprise.tn"
                                                    />
                                                </div>
                                            </label>
                                        </div>
                                        <div className="form-row-single">
                                            <label className="form-label">
                                                <span>Numéro de téléphone</span>
                                                <div className="input-with-icon">
                                                    <span className="material-symbols-outlined input-icon">phone</span>
                                                    <input
                                                        type="tel"
                                                        name="phone"
                                                        className="form-input form-input--icon"
                                                        value={formData.phone}
                                                        onChange={handleInputChange}
                                                        placeholder="+216 29 456 789"
                                                    />
                                                </div>
                                            </label>
                                        </div>
                                        <div className="form-row-single">
                                            <label className="form-label">
                                                <span>Poste actuel</span>
                                                <input
                                                    type="text"
                                                    name="position"
                                                    className="form-input"
                                                    value={formData.position}
                                                    onChange={handleInputChange}
                                                    placeholder="Ingénieur Logiciel (Tunis)"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                    {hasChanges && (
                                        <div className="form-actions">
                                            <button className="btn btn-primary">Enregistrer les modifications</button>
                                        </div>
                                    )}
                                </div>
                            </section>

                        </div>

                        {/* Right Column */}
                        <div className="profile-right">
                            {/* AI Preferences */}
                            <section className="profile-section">
                                <h3 className="section-title">Préférences IA</h3>
                                <div className="section-card">
                                    <p className="section-description">
                                        Configurez comment l'IA interagit avec vous et quand vous souhaitez être alerté.
                                    </p>
                                    <div className="preferences-list">
                                        <div className="preference-item">
                                            <div className="preference-info">
                                                <p className="preference-title">Alertes Match Élevé</p>
                                                <p className="preference-description">
                                                    Recevoir un email quand un candidat dépasse 90% de compatibilité.
                                                </p>
                                            </div>
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={aiPreferences.highMatchAlerts}
                                                    onChange={() => handleToggle('highMatchAlerts')}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>

                                        <div className="preference-item">
                                            <div className="preference-info">
                                                <p className="preference-title">Résumé Hebdomadaire IA</p>
                                                <p className="preference-description">
                                                    Digest des meilleures opportunités détectées par l'IA.
                                                </p>
                                            </div>
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={aiPreferences.weeklyDigest}
                                                    onChange={() => handleToggle('weeklyDigest')}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>

                                        <div className="preference-item">
                                            <div className="preference-info">
                                                <p className="preference-title">Analyse de CV Automatique</p>
                                                <p className="preference-description">
                                                    Autoriser l'IA à pré-scanner les nouveaux CV entrants.
                                                </p>
                                            </div>
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={aiPreferences.autoCV}
                                                    onChange={() => handleToggle('autoCV')}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>

                                        <div className="preference-slider">
                                            <p className="preference-title">Sensibilité de l'algorithme</p>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={aiPreferences.sensitivity}
                                                onChange={handleSensitivityChange}
                                                className="slider"
                                            />
                                            <div className="slider-labels">
                                                <span>Large</span>
                                                <span>Équilibré</span>
                                                <span>Strict</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>


                </div>
            </main>
        </div>
    )
}

export default Profile
