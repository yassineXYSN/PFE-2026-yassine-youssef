import { useRef, useState, useEffect } from 'react'
import { supabase } from '../../../core/supabaseClient'
import { apiFetch } from '../../../core/api'
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
  const [passwordlessMode, setPasswordlessMode] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(
    window.location.hash.includes('access_token') ||
    window.location.hash.includes('id_token') ||
    window.location.hash.includes('error')
  )

  // 0. Handle Google Auth Redirect & Sync
  useEffect(() => {
    const handleAuthChange = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        // If the user just logged in via OAuth, we need to verify they exist in MongoDB
        setGoogleLoading(true)
        try {
          const profileData = await apiFetch(`/profiles/${session.user.id}`)

          // Profil trouvé dans MongoDB, on continue
          localStorage.setItem('userRole', profileData.role)

          if (profileData.role === 'superadmin' || profileData.role === 'admin') {
            const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
            if (aalData?.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
              navigate('/hr/otp', { state: { mfaContext: profileData.role } })
            } else {
              navigate(profileData.role === 'superadmin' ? '/superadmin/dashboard' : '/hr/dashboard')
            }
          } else {
            navigate('/hr/dashboard')
          }
        } catch (err) {
          console.error('Google login sync error:', err.message)
          // Profile not found in HR collection — likely a candidat user, redirect them
          navigate('/candidat/login', { replace: true })
        } finally {
          setGoogleLoading(false)
        }
      }
    }

    handleAuthChange()
  }, [navigate])

  const handleGoogleLogin = async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/hr/login'
      }
    })
    if (error) setError(error.message)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = e.target
    const email = form.querySelector('[name="email"]').value
    const passwordInput = form.querySelector('[name="password"]')
    const password = passwordInput ? passwordInput.value : ''

    try {
      // Mode connexion sans mot de passe : envoi d'un code par email
      if (passwordlessMode) {
        if (!email) {
          throw new Error('Veuillez saisir votre adresse email.')
        }

        // Vérifier si le compte autorise la connexion passwordless
        // Fetch profile from our FastAPI backend to check preferences
        try {
          const profileData = await apiFetch(`/profiles/by-email/${email}`);
          const isPasswordlessAllowed = profileData?.preferences?.passwordlessEnabled === true

          if (!isPasswordlessAllowed) {
            setError("La connexion sans mot de passe n'est pas activée pour ce compte. Veuillez vous connecter avec votre mot de passe.")
            setLoading(false)
            return
          }
        } catch (fetchErr) {
          setError("Erreur lors de la vérification du profil. Veuillez réessayer.")
          setLoading(false)
          return
        }

        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: undefined,
          },
        })

        if (otpError) throw otpError

        navigate('/hr/verify-email', { state: { mode: 'passwordless', email } })
        return
      }

      // 1. Authentification Supabase classique (email + mot de passe)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      // 2. Fetch profile details (role, status) from our FastAPI backend
      let profileData = null;
      try {
        profileData = await apiFetch(`/profiles/${authData.user.id}`);
      } catch (profileError) {
        console.warn('Profile fetch failed, checking fallback:', profileError.message);
        // Fallback for SuperAdmin: if profile not in MongoDB, check Supabase user metadata
        const userRole = authData.user.user_metadata?.role || authData.user.app_metadata?.role;

        if (userRole === 'superadmin') {
          profileData = {
            id: authData.user.id,
            role: 'superadmin',
            status: 'active',
            email: authData.user.email
          };
        } else {
          throw new Error(`Erreur profil : ${profileError.message}. Votre compte (Rôle: ${userRole || 'non défini'}) n'est peut-être pas correctement synchronisé.`);
        }
      }

      // 3. Vérification du statut (Premier login / Email non vérifié)
      if (profileData.status === 'pending') {
        navigate('/hr/verify-email', {
          state: {
            mode: 'signup_verification',
            email: email
          }
        })
        return
      }

      // 4. Stockage et Redirection basée sur le rôle
      localStorage.setItem('userRole', profileData.role)

      if (profileData.role === 'superadmin' || profileData.role === 'admin') {
        const needsOnboarding = profileData.role === 'admin' && !profileData.preferences?.onboarding_done;

        // Vérifier si une MFA TOTP est configurée côté Supabase
        try {
          const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

          if (!aalError && aalData?.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
            // Facteur MFA présent mais non encore vérifié pour cette session
            navigate('/hr/otp', { state: { mfaContext: profileData.role } })
          } else {
            // Pas de MFA requise ou déjà validée
            if (profileData.role === 'superadmin') {
              navigate('/superadmin/dashboard')
            } else if (needsOnboarding) {
              navigate('/hr/welcome')
            } else {
              navigate('/hr/dashboard')
            }
          }
        } catch {
          // En cas de problème avec MFA, on laisse accéder
          if (profileData.role === 'superadmin') {
            navigate('/superadmin/dashboard')
          } else if (needsOnboarding) {
            navigate('/hr/welcome')
          } else {
            navigate('/hr/dashboard')
          }
        }
      } else {
        const needsOnboarding = !profileData.preferences?.onboarding_done;
        navigate(needsOnboarding ? '/hr/welcome' : '/hr/dashboard')
      }

    } catch (err) {
      // Gestion spécifique du mail non confirmé (Premier login)
      if (err.message === 'Email not confirmed') {
        const email = form.querySelector('[name="email"]').value

        navigate('/hr/verify-email', {
          state: {
            mode: 'signup_verification',
            email
          }
        })
        return
      }

      console.error('Login error:', err.message)
      console.warn('RAW SUPABASE ERROR:', err)

      if (passwordlessMode) {
        // En mode passwordless, on affiche directement le message retourné par Supabase
        setError(err.message || "Impossible d'envoyer le code de connexion.")
      } else if (err.message === 'Invalid login credentials') {
        // Fallback: This might be a new user (e.g. created by admin) whose email is not confirmed.
        // Supabase sometimes returns 'Invalid login credentials' instead of 'Email not confirmed' 
        // if the password is correct but the email is unverified.
        try {
          const emailValue = form.querySelector('[name="email"]').value;
          console.log('Fallback check for email:', emailValue);
          const profileCheck = await apiFetch(`/profiles/by-email/${emailValue}`);
          console.log('Fallback check result:', profileCheck);

          if (profileCheck && profileCheck.status === 'pending') {
            console.log('Redirecting to verify-email');
            navigate('/hr/verify-email', {
              state: {
                mode: 'signup_verification',
                email: emailValue
              }
            })
            return;
          } else {
            console.log('Profile is NOT pending. Status is:', profileCheck?.status);
          }
        } catch (checkErr) {
          console.error('Fallback check failed:', checkErr);
          // Profile not found or error, fall through to normal error
        }
        setError('Email ou mot de passe incorrect.')
      } else {
        setError(err.message || 'Une erreur est survenue lors de la connexion.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordlessToggle = () => {
    setPasswordlessMode((prev) => !prev)
    setError(null)
  }

  return (
    <div className={`login-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
      {/* Loading Overlay for OAuth/Redirects */}
      {googleLoading && (
        <div className="login-loading-overlay">
          <div className="pro-loader-container">
            <div className="pro-loader-bar-wrapper">
              <div className="pro-loader-bar-progress"></div>
            </div>
            <p className="pro-loader-status">Vérification de session...</p>
          </div>
        </div>
      )}

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

            {!passwordlessMode && (
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
            )}

            <button type="submit" className="btn btn--primary login-form__submit" disabled={loading}>
              <span>
                {loading
                  ? passwordlessMode ? 'Envoi du code...' : 'Connexion...'
                  : passwordlessMode ? 'Envoyer le code' : 'Continuer'}
              </span>
              <span className="material-symbols-outlined btn__arrow">
                {loading ? 'sync' : 'arrow_forward'}
              </span>
            </button>

            <div className="login-form__divider">
              <span className="login-form__divider-text">Ou</span>
            </div>

            <div className="login-alt-buttons">
              <button
                type="button"
                className="btn btn--google"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
              >
                <svg className="btn-google__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Google</span>
              </button>
              <button
                type="button"
                className="btn btn--passwordless"
                onClick={handlePasswordlessToggle}
                disabled={loading}
              >
                <span className="material-symbols-outlined">
                  {passwordlessMode ? 'lock' : 'key'}
                </span>
                <span>{passwordlessMode ? 'Revenir au mot de passe' : 'Connexion sans mot de passe'}</span>
              </button>
            </div>
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
