/* NextHire AI Auth Page - Login & Signup with animated toggle, standard CSS */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import { supabase } from '../../../core/supabaseClient';
import './LoginPage.css';

const LoginPage = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register' (desktop + mobile)
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register form state
  const [registerFullName, setRegisterFullName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;

      navigate('/candidat/dashboard');
    } catch (err) {
      console.error('Login error:', err.message);
      setLoginError(
        err.message === 'Invalid login credentials'
          ? t('auth-login-error-credentials')
          : t('auth-login-error-general')
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterError('');

    const nameParts = registerFullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
      const { error } = await supabase.auth.signUp({
        email: registerEmail,
        password: registerPassword,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: 'candidate',
          },
        },
      });

      if (error) throw error;

      // Store email for the email verification page
      sessionStorage.setItem('candidat-signup-email', registerEmail);
      navigate('/candidat/email-verification');
    } catch (err) {
      console.error('Register error:', err.message);
      setRegisterError(err.message || t('auth-register-error-general'));
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="candidat-theme-toggle">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <div className="login-shell">
        {/* Left Side: Hero / Brand Area (keeps NextHire AI theme) */}
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
            <span className="login-hero-logo-text">NextHire AI</span>
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
          <div className="login-hero-footer">© 2023 NextHire AI Inc.</div>
        </div>

        {/* Right Side: Auth Card (desktop/tablet) */}
        <div className="login-form-panel">
          <div className={`auth-container ${mode === 'register' ? 'active' : ''}`}>
            {/* Login form */}
            <div className="auth-form-box login">
              <form onSubmit={handleLoginSubmit}>
                <h1>{t('login-form-title')}</h1>
                {loginError && (
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '-0.5rem 0 0.75rem', textAlign: 'center' }}>
                    {loginError}
                  </p>
                )}
                <div className="auth-input-box">
                  <input
                    type="email"
                    placeholder={t('common-email')}
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div className="auth-input-box">
                  <input
                    type="password"
                    placeholder={t('common-password')}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <i className="fa-solid fa-lock"></i>
                </div>
                <div className="auth-remember-row">
                  <label className="auth-remember-label">
                    <input type="checkbox" />
                    <span>{t('login-remember-me')}</span>
                  </label>
                  <a href="#" className="auth-forgot-link-inline">{t('login-forgot-password')}</a>
                </div>
                <button type="submit" className="auth-btn" disabled={loginLoading}>
                  {loginLoading ? t('common-loading') : t('login-submit-btn')}
                </button>
                <p className="auth-social-text">{t('login-or-login-with')}</p>
                <div className="auth-social-icons">
                  <button type="button" className="auth-social-pill google">
                    <i className="fa-brands fa-google"></i>
                    <span>{t('google')}</span>
                  </button>
                  <button type="button" className="auth-social-pill linkedin">
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
                {registerError && (
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '-0.5rem 0 0.75rem', textAlign: 'center' }}>
                    {registerError}
                  </p>
                )}
                <div className="auth-input-box">
                  <input
                    type="text"
                    placeholder={t('signup-full-name')}
                    required
                    value={registerFullName}
                    onChange={(e) => setRegisterFullName(e.target.value)}
                  />
                  <i className="fa-solid fa-user"></i>
                </div>
                <div className="auth-input-box">
                  <input
                    type="email"
                    placeholder={t('common-email')}
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                  />
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div className="auth-input-box">
                  <input
                    type="password"
                    placeholder={t('common-password')}
                    required
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                  />
                  <i className="fa-solid fa-lock"></i>
                </div>
                <button type="submit" className="auth-btn" disabled={registerLoading}>
                  {registerLoading ? t('common-loading') : t('signup')}
                </button>
                <p className="auth-social-text">{t('signup-or-signup-with')}</p>
                <div className="auth-social-icons">
                  <button type="button" className="auth-social-pill google">
                    <i className="fa-brands fa-google"></i>
                    <span>{t('google')}</span>
                  </button>
                  <button type="button" className="auth-social-pill linkedin">
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
                <p>{t('login-new-to-nexthire')}</p>
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
                    {loginError && (
                      <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '8px 0 0', textAlign: 'center' }}>
                        {loginError}
                      </p>
                    )}
                    <div className="mobile-field">
                      <input
                        type="email"
                        placeholder={t('common-email')}
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                      />
                      <i className="fa-solid fa-envelope"></i>
                    </div>
                    <div className="mobile-field">
                      <input
                        type="password"
                        placeholder={t('password')}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
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
                      <input type="submit" value={loginLoading ? t('common-loading') : t('login')} disabled={loginLoading} />
                    </div>
                    <p className="mobile-social-text">{t('login-or-login-with')}</p>
                    <div className="mobile-social-icons">
                      <button type="button" className="mobile-social-pill google">
                        <i className="fa-brands fa-google"></i>
                      </button>
                      <button type="button" className="mobile-social-pill linkedin">
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
                    {registerError && (
                      <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '8px 0 0', textAlign: 'center' }}>
                        {registerError}
                      </p>
                    )}
                    <div className="mobile-field">
                      <input
                        type="text"
                        placeholder={t('signup-full-name')}
                        required
                        value={registerFullName}
                        onChange={(e) => setRegisterFullName(e.target.value)}
                      />
                      <i className="fa-solid fa-user"></i>
                    </div>
                    <div className="mobile-field">
                      <input
                        type="email"
                        placeholder={t('common-email')}
                        required
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                      />
                      <i className="fa-solid fa-envelope"></i>
                    </div>
                    <div className="mobile-field">
                      <input
                        type="password"
                        placeholder={t('common-password')}
                        required
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                      />
                      <i className="fa-solid fa-lock"></i>
                    </div>
                    <div className="mobile-field mobile-btn">
                      <input type="submit" value={registerLoading ? t('common-loading') : t('signup-submit-btn')} disabled={registerLoading} />
                    </div>
                    <p className="mobile-social-text">{t('signup-or-signup-with')}</p>
                    <div className="mobile-social-icons">
                      <button type="button" className="mobile-social-pill google">
                        <i className="fa-brands fa-google"></i>
                      </button>
                      <button type="button" className="mobile-social-pill linkedin">
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

