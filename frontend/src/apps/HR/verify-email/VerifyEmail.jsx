import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../../../core/useLanguage'
import HRHeader from '../components/HRHeader'
import './VerifyEmail.css'

function VerifyEmail() {
    const { effectiveTheme } = useTheme()
    const { t } = useLanguage()
    const location = useLocation()
    const navigate = useNavigate()
    const email = location.state?.email || ''

    return (
        <div className={`verify-email-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRHeader />
            <div className="verify-email-container">
                <div className="verify-email-card">
                    <div className="verify-email-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--hr-accent)' }}>
                            mark_email_read
                        </span>
                    </div>
                    <h1 className="verify-email-title">
                        {t('hr-auth-verify-title') || 'Compte en attente'}
                    </h1>
                    <p className="verify-email-description">
                        {email
                            ? t('hr-auth-verify-desc-email')?.replace('{email}', email) || `Votre compte (${email}) est en attente d'activation.`
                            : t('hr-auth-verify-desc') || 'Votre compte est en attente d\'activation.'}
                    </p>
                    <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                        {t('hr-auth-verify-contact') || 'Contactez votre administrateur pour activer votre compte.'}
                    </p>
                    <button
                        className="btn btn--primary"
                        style={{ marginTop: '1.5rem' }}
                        onClick={() => navigate('/hr/login')}
                    >
                        {t('hr-auth-verify-back') || 'Retour à la connexion'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default VerifyEmail
