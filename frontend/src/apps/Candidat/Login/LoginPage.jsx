/* HumatiQ AI Auth Page - Login & Signup with animated toggle, standard CSS */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../core/supabaseClient';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import './LoginPage.css';

const LoginPage = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register' (desktop + mobile)
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        // If the stored session has an invalid/expired refresh token, clear it and stay on login page
        if (sessionError) {
          console.warn('Stale session detected, clearing:', sessionError.message);
          await supabase.auth.signOut();
          return;
        }

        if (session) {
          try {
            const response = await fetch('http://localhost:8000/candidat/account-setup/status', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            });

            if (response.ok) {
              const result = await response.json();
              if (result.is_setup_completed) {
                navigate('/candidat/dashboard', { replace: true });
              } else {
                navigate('/candidat/account-setup', { replace: true });
              }
            }
          } catch (error) {
            console.error('Error checking account setup status:', error);
          }
        }
      } catch (err) {
        // Swallow any unexpected auth errors (e.g. invalid refresh token) — stay on login page
        console.warn('Session check failed, clearing session:', err.message);
        await supabase.auth.signOut();
      }
    };
    checkSession();
  }, [navigate]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (authError) {
        // Supabase returns a 400 with this message when email is not confirmed
        if (authError.message?.toLowerCase().includes('email not confirmed')) {
          navigate('/candidat/email-verification', { state: { email: loginEmail } });
          return;
        }
        setError(t('auth-error-invalid-credentials'));
        return;
      }

      // Check if email is confirmed (fallback for configs that allow login before confirmation)
      if (!data.user.email_confirmed_at) {
        navigate('/candidat/email-verification', { state: { email: loginEmail } });
        return;
      }

      // Check if candidat profile exists -> go to dashboard or account setup
      try {
        const response = await fetch('http://localhost:8000/candidat/account-setup/status', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.is_setup_completed) {
            navigate('/candidat/dashboard');
          } else {
            navigate('/candidat/account-setup');
          }
        }
      } catch (error) {
        console.error('Error checking account setup status:', error);
        navigate('/candidat/account-setup'); // Fallback
      }
    } catch (err) {
      setError(t('auth-error-generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const firstName = signupFirstName.trim();
      const lastName = signupLastName.trim();

      if (!firstName) {
        setError(t('auth-error-name-required'));
        setLoading(false);
        return;
      }

      // Clear any stale session before signing up to prevent redirect race conditions
      await supabase.auth.signOut();

      const { data, error: authError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            user_type: 'candidate',
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError(t('auth-error-email-taken'));
        } else if (authError.message.includes('password')) {
          setError(t('auth-error-weak-password'));
        } else {
          setError(authError.message);
        }
        return;
      }

      // Navigate to OTP 2FA verification page
      navigate('/candidat/email-verification', { state: { email: signupEmail } });
    } catch (err) {
      setError(t('auth-error-generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setError('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/candidat/dashboard`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
    }
  };

  return (
    <div className="login-page">
      <div className="candidat-theme-toggle">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <div className="login-shell">
        {/* Left Side: Hero / Brand Area (keeps HumatiQ AI theme) */}
        <div className="login-hero">
          {/* Background Pattern/Gradient Overlay */}
          <div
            className="login-hero-bg-pattern"
            data-alt="abstract 3d network nodes connection dark blue"
          ></div>
          <div className="login-hero-bg-gradient"></div>

          {/* Logo Area */}
          <div className="login-hero-logo-row">
            <div className="login-hero-logo-icon">
              <span className="material-symbols-outlined">smart_toy</span>
            </div>
            <span className="login-hero-logo-text">HumatiQ AI</span>
          </div>

          {/* Hero Content */}
          <div className="login-hero-content">
            <div className="login-hero-illustration">
              {/* Illustration Placeholder */}
              <div
                className="login-hero-illustration-image"
                data-alt="3d isometric recruitment illustration floating nodes"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDMgiQhbBYPvZPuYLzB-WXjKxqJ-_umHk_9T-VZ9RfZpOVO1qtkwaW8jwRZT2zOjabr-dczTUwk515L4v-EUARaYsWMBWG4PIOV69IXaIXoTihTHlEvytEztpc8sFdYtYsReRCDirIUjGaMXF0OTb7AlPvAXR3rcGlat1xCQdYCHLMYF-F3y8nbY5e0Shb-9wWfdEs2fAW3Ejn-bFWC00Run9_sOeMZqEkVlBsPJMrbMgNNbaWaPlTUnu15xCc6UnH9OUnc20E1cFBV')",
                }}
              ></div>
            </div>
            <div className="login-hero-text-block">
              <h2 className="login-hero-title">
                {t('login-hero-title')}
              </h2>
              <div className="login-hero-stats-row">
                <div className="login-hero-avatars">
                  <img
                    alt="User Avatar 1"
                    className="login-hero-avatar"
                    data-alt="headshot of smiling young woman"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjH3v4Dkk9mNI4kbVCoHItLJlopZj3_y8h9fkUDRhdjGtS-bM0dQmAo0kQgnwgEc0lO0trKQX-OPrnwkyVK1soI24Azt0MF4FBL-PR-JFokaC_FvUxhVhTOfxXVv64hT6HMwKVTiqCm-eVekfWcO3FzRm0QvJ9gB7d2Kofsc-cu3i_T87wUsDr7Qw3PAK1NFzYFB49cA5-Dlz9yY5_FtJz_nT-kATh5rXoSMPzAjDETHnrASmvKT6rRcAEIpdl1jjiy48L6TyxnomJ"
                  />
                  <img
                    alt="User Avatar 2"
                    className="login-hero-avatar"
                    data-alt="headshot of serious young man"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYFRsc_rZZNE40DDU2EobTLIzfHTGcEPgEaDzaKnXraWCGjw6g8y5Xg9FZF8yTIVAlWOc9juAERRannDJCktwW6D-nQf1xJxdM8LsCFjArDM5mu42RjK6O5DYh3II5D-oMYnyMc49OCglMgQs5ZTRLNkH6qn24TIORxlHNCNLFKzTmGirTpHuIlJVtQbLHITvvRdFv5v-9ik39qT5RJSyYJOVesYaHnqQBZ33pfuCstIB9VBVbmq31ejeluNJSNBd7QI8T9kKI593n"
                  />
                  <img
                    alt="User Avatar 3"
                    className="login-hero-avatar"
                    data-alt="headshot of smiling man in glasses"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDssmsjzkFN-X8cg5cUhtdkgBcK-_YNkV9hL9PyL-ZUJOgH0jIlUnqxXGmfelHSGp-mfmfjcGfJ4-5cpk7UP6EgTxfEpgbjmgPJN8BvobwABcrX1vCNfax0PIRTTRZe6pD4qah3dOvYxgrnJI4686GRXmsXLNZAJf26iRiP2g3pUxyquAqAMJC5M8N88RphspX4P2TkFKVdpHRxHmKda04HXrhKgSWwomNptPYd_Ie0plfgPYW7-drY1KIzJJAml8znl6EJXs4YGfv5"
                  />
                  <div className="login-hero-avatars-count">
                    +10k
                  </div>
                </div>
                <p className="login-hero-stats-text">{t('login-join-10k')}</p>
              </div>
            </div>
          </div>

          {/* Footer/Copyright */}
          <div className="login-hero-footer">© 2023 HumatiQ AI Inc.</div>
        </div>

        {/* Right Side: Auth Card (desktop/tablet) */}
        <div className="login-form-panel">
          <div className={`auth-container ${mode === 'register' ? 'active' : ''}`}>
            {/* Login form */}
            <div className="auth-form-box login">
              <form onSubmit={handleLoginSubmit}>
                <h1>{t('login-form-title')}</h1>
                {error && mode === 'login' && <div className="auth-error-msg">{error}</div>}
                <div className="auth-input-box">
                  <input type="email" placeholder={t('common-email')} required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div className="auth-input-box">
                  <input type="password" placeholder={t('common-password')} required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                  <i className="fa-solid fa-lock"></i>
                </div>
                <div className="auth-remember-row">
                  <label className="auth-remember-label">
                    <input type="checkbox" />
                    <span>{t('login-remember-me')}</span>
                  </label>
                  <a href="#" className="auth-forgot-link-inline">{t('login-forgot-password')}</a>
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t('common-loading') : t('login-submit-btn')}
                </button>
                <p className="auth-social-text">{t('login-or-login-with')}</p>
                <div className="auth-social-icons">
                  <button type="button" className="auth-social-pill google" onClick={() => handleOAuthLogin('google')}>
                    <i className="fa-brands fa-google"></i>
                    <span>{t('google')}</span>
                  </button>
                  <button type="button" className="auth-social-pill linkedin" onClick={() => handleOAuthLogin('linkedin_oidc')}>
                    <i className="fa-brands fa-linkedin-in"></i>
                    <span>{t('linkedin')}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Signup form */}
            <div className="auth-form-box register">
              <form onSubmit={handleRegisterSubmit}>
                <h1>{t('signup-form-title')}</h1>
                {error && mode === 'register' && <div className="auth-error-msg">{error}</div>}
                <div className="auth-name-row">
                  <div className="auth-input-box">
                    <input type="text" placeholder={t('signup-first-name')} required value={signupFirstName} onChange={(e) => setSignupFirstName(e.target.value)} />
                    <i className="fa-solid fa-user"></i>
                  </div>
                  <div className="auth-input-box">
                    <input type="text" placeholder={t('signup-last-name')} required value={signupLastName} onChange={(e) => setSignupLastName(e.target.value)} />
                    <i className="fa-solid fa-user"></i>
                  </div>
                </div>
                <div className="auth-input-box">
                  <input type="email" placeholder={t('common-email')} required value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div className="auth-input-box">
                  <input type="password" placeholder={t('common-password')} required minLength={6} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                  <i className="fa-solid fa-lock"></i>
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t('common-loading') : t('signup-submit-btn')}
                </button>
                <p className="auth-social-text">{t('signup-or-signup-with')}</p>
                <div className="auth-social-icons">
                  <button type="button" className="auth-social-pill google" onClick={() => handleOAuthLogin('google')}>
                    <i className="fa-brands fa-google"></i>
                    <span>{t('google')}</span>
                  </button>
                  <button type="button" className="auth-social-pill linkedin" onClick={() => handleOAuthLogin('linkedin_oidc')}>
                    <i className="fa-brands fa-linkedin-in"></i>
                    <span>{t('linkedin')}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Toggle panels */}
            <div className="auth-toggle-box">
              <div className="auth-toggle-panel auth-toggle-left">
                <h2>{t('login-hello-welcome')}</h2>
                <p>{t('login-new-to-HumatiQ')}</p>
                <button
                  type="button"
                  className="auth-btn ghost"
                  onClick={() => setMode('register')}
                >
                  {t('login-create-account')}
                </button>
              </div>

              <div className="auth-toggle-panel auth-toggle-right">
                <h2>{t('login-welcome-back')}</h2>
                <p>{t('login-already-have-account')}</p>
                <button
                  type="button"
                  className="auth-btn ghost"
                  onClick={() => setMode('login')}
                >
                  {t('login')}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile auth wrapper (separate style for phones) */}
          <div className={`mobile-auth-wrapper ${mode === 'register' ? 'mobile-signup-active' : ''}`}>
            <div className="mobile-auth">
              <div className="mobile-title-text">
                <div className="mobile-title login">{t('login-form-mobile')}</div>
                <div className="mobile-title signup">{t('signup-form-mobile')}</div>
              </div>

              <div className="mobile-form-container">
                <div className="mobile-slide-controls">
                  <input
                    type="radio"
                    name="mobileSlide"
                    id="mobileLogin"
                    checked={mode === 'login'}
                    onChange={() => setMode('login')}
                  />
                  <input
                    type="radio"
                    name="mobileSlide"
                    id="mobileSignup"
                    checked={mode === 'register'}
                    onChange={() => setMode('register')}
                  />

                  <label htmlFor="mobileLogin" className="mobile-slide login">
                    {t('login')}
                  </label>
                  <label htmlFor="mobileSignup" className="mobile-slide signup">
                    {t('signup')}
                  </label>
                  <div className="mobile-slider-tab"></div>
                </div>

                <div className="mobile-form-inner">
                  <form className="mobile-form login" onSubmit={handleLoginSubmit}>
                    {error && mode === 'login' && <div className="auth-error-msg">{error}</div>}
                    <div className="mobile-field">
                      <input type="email" placeholder={t('common-email')} required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                      <i className="fa-solid fa-envelope"></i>
                    </div>
                    <div className="mobile-field">
                      <input type="password" placeholder={t('password')} required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                      <i className="fa-solid fa-lock"></i>
                    </div>
                    <div className="mobile-remember-row">
                      <label className="mobile-remember-label">
                        <input type="checkbox" />
                        <span>{t('login-remember-me')}</span>
                      </label>
                      <a href="#" className="mobile-pass-link-inline">{t('login-forgot-password')}</a>
                    </div>
                    <div className="mobile-field mobile-btn">
                      <input type="submit" value={loading ? t('common-loading') : t('login')} disabled={loading} />
                    </div>
                    <p className="mobile-social-text">{t('login-or-login-with')}</p>
                    <div className="mobile-social-icons">
                      <button type="button" className="mobile-social-pill google" onClick={() => handleOAuthLogin('google')}>
                        <i className="fa-brands fa-google"></i>
                      </button>
                      <button type="button" className="mobile-social-pill linkedin" onClick={() => handleOAuthLogin('linkedin_oidc')}>
                        <i className="fa-brands fa-linkedin-in"></i>
                      </button>
                    </div>
                    <div className="mobile-signup-link">
                      {t('signup-not-member')}{' '}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setMode('register');
                        }}
                      >
                        {t('signup-signup-now')}
                      </a>
                    </div>
                  </form>

                  <form className="mobile-form signup" onSubmit={handleRegisterSubmit}>
                    {error && mode === 'register' && <div className="auth-error-msg">{error}</div>}
                    <div className="mobile-name-row">
                      <div className="mobile-field">
                        <input type="text" placeholder={t('signup-first-name')} required value={signupFirstName} onChange={(e) => setSignupFirstName(e.target.value)} />
                        <i className="fa-solid fa-user"></i>
                      </div>
                      <div className="mobile-field">
                        <input type="text" placeholder={t('signup-last-name')} required value={signupLastName} onChange={(e) => setSignupLastName(e.target.value)} />
                        <i className="fa-solid fa-user"></i>
                      </div>
                    </div>
                    <div className="mobile-field">
                      <input type="email" placeholder={t('common-email')} required value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
                      <i className="fa-solid fa-envelope"></i>
                    </div>
                    <div className="mobile-field">
                      <input type="password" placeholder={t('common-password')} required minLength={6} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                      <i className="fa-solid fa-lock"></i>
                    </div>
                    <div className="mobile-field mobile-btn">
                      <input type="submit" value={loading ? t('common-loading') : t('signup-submit-btn')} disabled={loading} />
                    </div>
                    <p className="mobile-social-text">{t('signup-or-signup-with')}</p>
                    <div className="mobile-social-icons">
                      <button type="button" className="mobile-social-pill google" onClick={() => handleOAuthLogin('google')}>
                        <i className="fa-brands fa-google"></i>
                      </button>
                      <button type="button" className="mobile-social-pill linkedin" onClick={() => handleOAuthLogin('linkedin_oidc')}>
                        <i className="fa-brands fa-linkedin-in"></i>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

