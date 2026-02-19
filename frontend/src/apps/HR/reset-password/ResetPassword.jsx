import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import './ResetPassword.css'

function ResetPassword() {
    const { effectiveTheme } = useTheme()
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    // Mock strength calculation
    const getStrength = (pass) => {
        let score = 0
        if (pass.length >= 8) score++
        if (/[A-Z]/.test(pass)) score++
        if (/[0-9]/.test(pass)) score++
        if (/[^A-Za-z0-9]/.test(pass)) score++
        return score
    }

    const strengthScore = getStrength(password)

    const getStrengthLabel = (score) => {
        if (score === 0) return 'Faible'
        if (score <= 2) return 'Moyen'
        if (score === 3) return 'Bon'
        return 'Fort'
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        // Handle password reset logic here
        console.log('Password reset submitted', { password, confirmPassword })
    }

    return (
        <div className={`reset-password-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            {/* Header removed as requested */}


            {/* Main Content */}
            <main className="reset-main">
                <div className="reset-card">
                    {/* Card Header */}
                    <div className="card-header">
                        <h1 className="page-title">Réinitialiser votre mot de passe</h1>
                        <p className="page-description">
                            Pour sécuriser votre compte, veuillez choisir un mot de passe fort que vous n'avez pas utilisé auparavant.
                        </p>
                    </div>

                    {/* Form */}
                    <form className="reset-form" onSubmit={handleSubmit}>
                        {/* New Password Field */}
                        <div className="form-field">
                            <label className="field-label" htmlFor="new-password">
                                Nouveau mot de passe
                            </label>
                            <div className="input-wrapper">
                                <input
                                    className="form-input"
                                    id="new-password"
                                    placeholder="Nouveau mot de passe (ex: Youssef2026!)"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    className="visibility-btn"
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                        {showPassword ? 'visibility' : 'visibility_off'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Password Strength Indicator */}
                        <div className="strength-indicator-box">
                            <div className="strength-header">
                                <p className="strength-label">Force du mot de passe</p>
                                <span className={`strength-value ${strengthScore >= 3 ? 'text-green-600' : 'text-orange-500'}`}>
                                    {getStrengthLabel(strengthScore)}
                                </span>
                            </div>
                            <div className="strength-bars">
                                {[1, 2, 3, 4].map((step) => (
                                    <div
                                        key={step}
                                        className={`bar ${step <= strengthScore ? 'active' : ''}`}
                                        style={{
                                            backgroundColor: step <= strengthScore ? (strengthScore >= 3 ? '#16a34a' : '#f97316') : undefined
                                        }}
                                    ></div>
                                ))}
                            </div>
                            <ul className="requirements-list">
                                <li className={`req-item ${password.length >= 8 ? 'met' : 'pending'}`}>
                                    <span className={`material-symbols-outlined req-icon ${password.length >= 8 ? 'success' : ''}`}>
                                        {password.length >= 8 ? 'check_circle' : 'circle'}
                                    </span>
                                    8+ caractères
                                </li>
                                <li className={`req-item ${/[A-Z]/.test(password) ? 'met' : 'pending'}`}>
                                    <span className={`material-symbols-outlined req-icon ${/[A-Z]/.test(password) ? 'success' : ''}`}>
                                        {/[A-Z]/.test(password) ? 'check_circle' : 'circle'}
                                    </span>
                                    1 Majuscule
                                </li>
                                <li className={`req-item ${/[0-9]/.test(password) ? 'met' : 'pending'}`}>
                                    <span className={`material-symbols-outlined req-icon ${/[0-9]/.test(password) ? 'success' : ''}`}>
                                        {/[0-9]/.test(password) ? 'check_circle' : 'circle'}
                                    </span>
                                    1 Chiffre
                                </li>
                            </ul>
                        </div>

                        {/* Confirm Password Field */}
                        <div className="form-field">
                            <label className="field-label" htmlFor="confirm-password">
                                Confirmer le mot de passe
                            </label>
                            <div className="input-wrapper">
                                <input
                                    className="form-input"
                                    id="confirm-password"
                                    placeholder="Confirmez le mot de passe"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                                <button
                                    className="visibility-btn"
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                        {showConfirmPassword ? 'visibility' : 'visibility_off'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Action Button */}
                        <button className="submit-btn" type="submit">
                            Mettre à jour le mot de passe
                        </button>
                    </form>
                </div>
            </main>
        </div>
    )
}

export default ResetPassword
