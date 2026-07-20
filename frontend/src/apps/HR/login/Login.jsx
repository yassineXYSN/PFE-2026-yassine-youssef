import { useRef, useState } from 'react'
import { apiFetch } from '../../../core/api'
import { setAuth } from '../../../core/apiClient'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../../../core/useLanguage'
import loginImageLight from '../../../assets/images/page_login.jpg'
import loginImageDark from '../../../assets/images/page_login_s.jpg'
import './Login.css'

function Login() {
  console.log('CI/CD deploy test - main branch')
  const passwordToggleRef = useRef(null)
  const navigate = useNavigate()
  const { effectiveTheme, cycleTheme, getThemeIcon, getThemeLabel } = useTheme()
  const { t } = useLanguage()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pendingEmail, setPendingEmail] = useState(null)
  const [resendState, setResendState] = useState('idle')

  const togglePasswordVisibility = () => {
    const passwordInput = document.querySelector('[name="password"]')
    const isPassword = passwordInput.type === 'password'
    passwordInput.type = isPassword ? 'text' : 'password'
    if (passwordToggleRef.current) {
      passwordToggleRef.current.textContent = isPassword ? 'visibility_off' : 'visibility'
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setPendingEmail(null)
    setResendState('idle')

    const form = e.target
    const email = form.querySelector('[name="email"]').value
    const password = form.querySelector('[name="password"]').value

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      setAuth({ access_token: data.access_token, role: data.role, id: data.id, email: data.email })

      // Fetch MongoDB profile for onboarding/company info
      let profileData = null
      try {
        profileData = await apiFetch(`/profiles/${data.id}`)
      } catch {
        /* profile may not exist in MongoDB for superadmin */
      }

      const role = data.role

      if (role === 'superadmin') {
        navigate('/superadmin/dashboard')
        return
      }

      if (role === 'admin') {
        const needsOnboarding = !profileData?.preferences?.onboarding_done
        navigate(needsOnboarding ? '/hr/welcome' : '/hr/dashboard')
        return
      }

      navigate('/hr/dashboard')

    } catch (err) {
      if (err.status === 403) {
        if (err.detail?.includes('pending')) {
          setError('Votre compte est en attente d\'activation. Contactez votre administrateur.')
          setPendingEmail(email)
        } else {
          setError('Compte suspendu. Contactez votre administrateur.')
        }
      } else if (err.status === 401) {
        setError(t('hr-auth-err-invalid-credentials') || 'Email ou mot de passe incorrect.')
      } else {
        setError(err.message || t('hr-auth-err-generic') || 'Une erreur est survenue.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!pendingEmail) return
    setResendState('sending')
    try {
      await apiFetch('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: pendingEmail }),
      })
      setResendState('sent')
    } catch {
      setResendState('idle')
    }
  }

  return (
    <div className={`login-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
      {/* Left Panel: Form */}
      <section className="login-left">
        <div className="login-theme-wrapper">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={cycleTheme}
            aria-label={`Changer le thème (${getThemeLabel()})`}
            title={`Thème actuel : ${getThemeLabel()}`}
          >
            <span className="material-symbols-outlined theme-icon">
              {getThemeIcon()}
            </span>
            <span className="theme-toggle-text">{getThemeLabel()}</span>
          </button>
        </div>

        <div className="login-content-wrapper">
          <header className="login-header">
            <h1 className="login-title">{t('hr-auth-login-title')}</h1>
            <p className="login-subtitle">{t('hr-auth-login-subtitle')}</p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && (
              <div className="login-error-message" style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
                {error}
                {pendingEmail && (
                  resendState === 'sent' ? (
                    <p style={{ color: '#16a34a', marginTop: '0.5rem', fontWeight: 500 }}>
                      Si ce compte est en attente d'activation, un nouveau lien a été envoyé.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendState === 'sending'}
                      style={{ display: 'block', margin: '0.5rem auto 0', background: 'none', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      {resendState === 'sending' ? 'Envoi en cours...' : 'Renvoyer l\'email de vérification'}
                    </button>
                  )
                )}
              </div>
            )}

            <div className="login-field">
              <label htmlFor="email" className="login-field__label">
                {t('hr-auth-label-email')}
              </label>
              <div className="login-field__input-wrap login-field__input-wrap--icon-left">
                <span className="login-field__icon login-field__icon--left">
                  <span className="material-symbols-outlined">mail</span>
                </span>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="login-input"
                  placeholder="Entreprise@Email.com"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-field__label-row">
                <label htmlFor="password" className="login-field__label">
                  {t('hr-auth-label-password')}
                </label>
                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/hr/reset-password'); }} className="login-form__forgot">
                  {t('hr-auth-forgot-password')}
                </a>
              </div>
              <div className="login-field__input-wrap login-field__input-wrap--icon-right">
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="login-input"
                  placeholder={t('hr-auth-label-password')}
                  required
                />
                <button
                  type="button"
                  className="login-field__icon login-field__icon--right login-field__icon--btn"
                  onClick={togglePasswordVisibility}
                  aria-label="Afficher/masquer le mot de passe"
                >
                  <span className="material-symbols-outlined" ref={passwordToggleRef}>
                    visibility
                  </span>
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn--primary login-form__submit" disabled={loading}>
              <span>{loading ? t('hr-auth-btn-connecting') : t('hr-auth-btn-continue')}</span>
              <span className="material-symbols-outlined btn__arrow">
                {loading ? 'sync' : 'arrow_forward'}
              </span>
            </button>
          </form>
        </div>

        <div className="login-footer">
          <div className="login-footer__links">
            <a href="#">{t('hr-auth-link-help')}</a>
            <span className="footer-separator">•</span>
            <a href="#">{t('hr-auth-link-terms')}</a>
            <span className="footer-separator">•</span>
            <a href="#">{t('hr-auth-link-privacy')}</a>
          </div>
        </div>
      </section>

      {/* Right Panel: Image */}
      <section className="login-right">
        <img
          src={loginImageLight}
          alt="Espace Recrutement"
          className={`login-image ${effectiveTheme === 'dark' ? 'login-image--hidden' : ''}`}
        />
        <img
          src={loginImageDark}
          alt="Espace Recrutement"
          className={`login-image login-image--dark ${effectiveTheme === 'dark' ? '' : 'login-image--hidden'}`}
        />
        <div className="login-overlay"></div>
      </section>
    </div>
  )
}

export default Login
