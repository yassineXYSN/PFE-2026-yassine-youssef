import { useRef } from 'react'
import './Login.css'

function Login() {
  const passwordInputRef = useRef(null)
  const passwordToggleRef = useRef(null)

  function handlePasswordToggle() {
    const input = passwordInputRef.current
    const toggleBtn = passwordToggleRef.current
    if (!input || !toggleBtn) return
    const icon = toggleBtn.querySelector('.material-symbols-outlined')
    if (!icon) return
    if (input.type === 'password') {
      input.type = 'text'
      icon.textContent = 'visibility_off'
    } else {
      input.type = 'password'
      icon.textContent = 'visibility'
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const form = e.target
    const email = form.querySelector('[name="email"]').value
    const password = form.querySelector('[name="password"]').value
    // TODO: appel API / validation
    console.log('Login submit', { email, password })
  }

  return (
    <div className="login-page">
      <header className="login-header">
        <div className="login-header__brand">
          <div className="login-header__logo">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <h2 className="login-header__title">RH Recrutement IA</h2>
        </div>
        <div className="login-header__actions">
          <button type="button" className="btn btn--outline">
            Contact
          </button>
          <button type="button" className="btn btn--secondary">
            Aide
          </button>
        </div>
      </header>

      <main className="login-main">
        <div className="login-card">
          <div className="login-card__header">
            <h1 className="login-card__title">Connexion Entreprise</h1>
            <p className="login-card__subtitle">
              Accédez à votre espace de recrutement sécurisé
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span className="login-field__label">Email professionnel</span>
              <div className="login-field__input-wrap login-field__input-wrap--icon-right">
                <input
                  type="email"
                  name="email"
                  className="login-input"
                  placeholder="nom@entreprise.com"
                  required
                />
                <span className="login-field__icon login-field__icon--right">
                  <span className="material-symbols-outlined">mail</span>
                </span>
              </div>
            </label>

            <label className="login-field">
              <div className="login-field__label-row">
                <span className="login-field__label">Mot de passe</span>
                <a href="#" className="login-form__forgot">Oublié ?</a>
              </div>
              <div className="login-field__input-wrap login-field__input-wrap--icon-left login-field__input-wrap--icon-right">
                <input
                  ref={passwordInputRef}
                  type="password"
                  name="password"
                  id="password-input"
                  className="login-input"
                  placeholder="••••••••"
                  required
                />
                <span className="login-field__icon login-field__icon--left">
                  <span className="material-symbols-outlined">lock</span>
                </span>
                <button
                  ref={passwordToggleRef}
                  type="button"
                  className="login-field__icon login-field__icon--right login-field__icon--btn"
                  onClick={handlePasswordToggle}
                  aria-label="Afficher / masquer le mot de passe"
                >
                  <span className="material-symbols-outlined">visibility</span>
                </button>
              </div>
            </label>

            <button type="submit" className="btn btn--primary login-form__submit">
              <span>Continuer</span>
              <span className="material-symbols-outlined btn__arrow">arrow_forward</span>
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

          <div className="login-card__security">
            <span className="material-symbols-outlined">lock</span>
            <span>Connexion sécurisée SSL 256-bit</span>
          </div>
        </div>

        <div className="login-footer-links">
          <a href="#">Confidentialité</a>
          <a href="#">Conditions</a>
        </div>
      </main>
    </div>
  )
}

export default Login
