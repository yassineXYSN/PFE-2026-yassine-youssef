import { useRef, useState } from 'react'
import { apiFetch, setToken } from '../../../core/apiClient'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import loginImageLight from '../../../assets/images/page_login.jpg'
import loginImageDark from '../../../assets/images/page_login_s.jpg'
import './Login.css'

function Login() {
  const passwordToggleRef = useRef(null)
  const navigate = useNavigate()
  const { effectiveTheme, cycleTheme, getThemeIcon, getThemeLabel } = useTheme()

  const togglePasswordVisibility = () => {
    const passwordInput = document.querySelector('[name="password"]')
    const isPassword = passwordInput.type === 'password'
    passwordInput.type = isPassword ? 'text' : 'password'

    if (passwordToggleRef.current) {
      passwordToggleRef.current.textContent = isPassword ? 'visibility_off' : 'visibility'
    }
  }

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = e.target
    const email = form.querySelector('[name="email"]').value
    const password = form.querySelector('[name="password"]').value

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      setToken(data.access_token)
      localStorage.setItem('userRole', data.role)

      if (data.role === 'superadmin') {
        navigate('/super-admin/dashboard')
      } else {
        navigate('/hr/dashboard')
      }

    } catch (err) {
      console.error('Login error:', err.message)
      if (err.message === 'Invalid credentials') {
        setError('Email ou mot de passe incorrect.')
      } else {
        setError('Une erreur est survenue lors de la connexion.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`login-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>

      {/* Left Panel: Form */}
      <section className="login-left">

        {/* Custom Theme Button Position */}
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
            <h1 className="login-title">Bienvenue</h1>
            <p className="login-subtitle">
              Connectez-vous à votre espace recrutement IA
            </p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && (
              <div className="login-error-message" style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
                {error}
              </div>
            )}
            <div className="login-field">
              <label htmlFor="email" className="login-field__label">
                Adresse email
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
                  Mot de passe
                </label>
                <a href="#" className="login-form__forgot">
                  Mot de passe oublié&nbsp;?
                </a>
              </div>
              <div className="login-field__input-wrap login-field__input-wrap--icon-right">
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="login-input"
                  placeholder="Mot de passe "
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
              <span>{loading ? 'Connexion...' : 'Continuer'}</span>
              <span className="material-symbols-outlined btn__arrow">
                {loading ? 'sync' : 'arrow_forward'}
              </span>
            </button>

            <div className="login-form__divider">
              <span className="login-form__divider-text">Ou</span>
            </div>

            <button type="button" className="btn btn--google">
              <svg className="btn-google__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Se connecter avec Google</span>
            </button>
          </form>
        </div>

        {/* Footer info inside left panel */}
        <div className="login-footer">
          <div className="login-footer__links">
            <a href="#">Aide</a>
            <span className="footer-separator">•</span>
            <a href="#">Conditions</a>
            <span className="footer-separator">•</span>
            <a href="#">Confidentialité</a>
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
        <div className="login-overlay">
          {/* Optional overlay content if needed */}
        </div>
      </section>

    </div>
  )
}

export default Login
