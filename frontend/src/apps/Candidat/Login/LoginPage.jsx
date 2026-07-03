import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../../../core/api';
import { getToken, setAuth } from '../../../core/apiClient';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import humatiqLogo from '../../../assets/logo/humatiqlogo.png';
import './LoginPage.css';

const LoginPage = () => {
  const [mode, setMode] = useState('login');
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptAiAnalysis, setAcceptAiAnalysis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const check = async () => {
      const token = getToken();
      if (!token) {
        setCheckingSession(false);
        return;
      }
      try {
        const user = await apiFetch('/auth/me');
        const role = user?.role;
        if (role === 'superadmin') {
          navigate('/superadmin/dashboard', { replace: true });
          return;
        }
        if (['admin', 'recruiter', 'chef_departement', 'hr', 'manager'].includes(role)) {
          navigate('/hr/dashboard', { replace: true });
          return;
        }
        // candidat
        try {
          const result = await apiFetch('/candidat/account-setup/status');
          navigate(result.is_setup_completed ? '/candidat/dashboard' : '/candidat/account-setup', { replace: true });
        } catch {
          navigate('/candidat/account-setup', { replace: true });
        }
      } catch {
        setCheckingSession(false);
      }
    };
    check();
  }, [navigate]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      setAuth({ access_token: data.access_token, role: data.role, id: data.id, email: data.email });

      const role = data.role;
      if (role === 'superadmin') { navigate('/superadmin/dashboard'); return; }
      if (['admin', 'recruiter', 'chef_departement', 'hr', 'manager'].includes(role)) { navigate('/hr/dashboard'); return; }

      try {
        const result = await apiFetch('/candidat/account-setup/status');
        navigate(result.is_setup_completed ? '/candidat/dashboard' : '/candidat/account-setup');
      } catch {
        navigate('/candidat/account-setup');
      }
    } catch (err) {
      if (err.status === 403) {
        if (err.detail?.includes('pending')) {
          navigate('/candidat/email-verification', { state: { email: loginEmail } });
        } else {
          setError('Compte suspendu. Contactez le support.');
        }
      } else {
        setError(t('auth-error-invalid-credentials') || 'Email ou mot de passe incorrect.');
      }
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

      if (!firstName) { setError(t('auth-error-name-required') || 'Le prénom est requis.'); setLoading(false); return; }
      if (!acceptTerms) { setError(t('auth-error-terms-required') || 'Vous devez accepter les conditions.'); setLoading(false); return; }

      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      navigate('/candidat/email-verification', { state: { email: data.email } });
    } catch (err) {
      if (err.status === 409) {
        setError(t('auth-error-email-taken') || 'Cette adresse email est déjà utilisée.');
      } else if (err.status === 400 && err.detail?.includes('password')) {
        setError(t('auth-error-weak-password') || 'Mot de passe trop faible (min. 6 caractères).');
      } else {
        setError(err.message || t('auth-error-generic') || 'Une erreur est survenue.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="login-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          <div className="fine-linear-loader"></div>
          <p style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.4, margin: 0 }}>
            Vérification de session
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="candidat-theme-toggle">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <div className="login-shell">
        {/* Left Side: Hero */}
        <div className="login-hero">
          <div className="login-hero-bg-pattern" data-alt="abstract 3d network nodes connection dark blue"></div>
          <div className="login-hero-bg-gradient"></div>
          <div className="login-hero-logo-row">
            <img src={humatiqLogo} alt="HumatiQ" style={{ height: '40px', objectFit: 'contain' }} />
          </div>
          <div className="login-hero-content">
            <div className="login-hero-illustration">
              <div
                className="login-hero-illustration-image"
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDMgiQhbBYPvZPuYLzB-WXjKxqJ-_umHk_9T-VZ9RfZpOVO1qtkwaW8jwRZT2zOjabr-dczTUwk515L4v-EUARaYsWMBWG4PIOV69IXaIXoTihTHlEvytEztpc8sFdYtYsReRCDirIUjGaMXF0OTb7AlPvAXR3rcGlat1xCQdYCHLMYF-F3y8nbY5e0Shb-9wWfdEs2fAW3Ejn-bFWC00Run9_sOeMZqEkVlBsPJMrbMgNNbaWaPlTUnu15xCc6UnH9OUnc20E1cFBV')" }}
              ></div>
            </div>
            <div className="login-hero-text-block">
              <h2 className="login-hero-title">{t('login-hero-title')}</h2>
              <div className="login-hero-stats-row">
                <div className="login-hero-avatars">
                  <img alt="User Avatar 1" className="login-hero-avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjH3v4Dkk9mNI4kbVCoHItLJlopZj3_y8h9fkUDRhdjGtS-bM0dQmAo0kQgnwgEc0lO0trKQX-OPrnwkyVK1soI24Azt0MF4FBL-PR-JFokaC_FvUxhVhTOfxXVv64hT6HMwKVTiqCm-eVekfWcO3FzRm0QvJ9gB7d2Kofsc-cu3i_T87wUsDr7Qw3PAK1NFzYFB49cA5-Dlz9yY5_FtJz_nT-kATh5rXoSMPzAjDETHnrASmvKT6rRcAEIpdl1jjiy48L6TyxnomJ" />
                  <img alt="User Avatar 2" className="login-hero-avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYFRsc_rZZNE40DDU2EobTLIzfHTGcEPgEaDzaKnXraWCGjw6g8y5Xg9FZF8yTIVAlWOc9juAERRannDJCktwW6D-nQf1xJxdM8LsCFjArDM5mu42RjK6O5DYh3II5D-oMYnyMc49OCglMgQs5ZTRLNkH6qn24TIORxlHNCNLFKzTmGirTpHuIlJVtQbLHITvvRdFv5v-9ik39qT5RJSyYJOVesYaHnqQBZ33pfuCstIB9VBVbmq31ejeluNJSNBd7QI8T9kKI593n" />
                  <img alt="User Avatar 3" className="login-hero-avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDssmsjzkFN-X8cg5cUhtdkgBcK-_YNkV9hL9PyL-ZUJOgH0jIlUnqxXGmfelHSGp-mfmfjcGfJ4-5cpk7UP6EgTxfEpgbjmgPJN8BvobwABcrX1vCNfax0PIRTTRZe6pD4qah3dOvYxgrnJI4686GRXmsXLNZAJf26iRiP2g3pUxyquAqAMJC5M8N88RphspX4P2TkFKVdpHRxHmKda04HXrhKgSWwomNptPYd_Ie0plfgPYW7-drY1KIzJJAml8znl6EJXs4YGfv5" />
                  <div className="login-hero-avatars-count">+10k</div>
                </div>
                <p className="login-hero-stats-text">{t('login-join-10k')}</p>
              </div>
            </div>
          </div>
          <div className="login-hero-footer">© 2023 HumatiQ AI Inc.</div>
        </div>

        {/* Right Side: Auth Card */}
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
                  <input type={showLoginPassword ? 'text' : 'password'} placeholder={t('common-password')} required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                  <button type="button" className="auth-eye-toggle" onClick={() => setShowLoginPassword(v => !v)} tabIndex={-1} aria-label="Toggle password visibility">
                    <i className={showLoginPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                  </button>
                </div>
                <div className="auth-remember-row">
                  <label className="auth-remember-label">
                    <input type="checkbox" /><span>{t('login-remember-me')}</span>
                  </label>
                  <a href="#" className="auth-forgot-link-inline" onClick={(e) => { e.preventDefault(); navigate('/candidat/forgot-password'); }}>
                    {t('login-forgot-password')}
                  </a>
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t('common-loading') : t('login-submit-btn')}
                </button>
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
                  <input type={showSignupPassword ? 'text' : 'password'} placeholder={t('common-password')} required minLength={6} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                  <button type="button" className="auth-eye-toggle" onClick={() => setShowSignupPassword(v => !v)} tabIndex={-1} aria-label="Toggle password visibility">
                    <i className={showSignupPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                  </button>
                </div>
                <label className="auth-terms-label">
                  <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required />
                  <span>
                    {t('signup-accept-terms-pre')}
                    <a href="/candidat/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{t('signup-accept-terms-link')}</a>
                    {t('signup-accept-terms-post')}
                  </span>
                </label>
                <label className="auth-terms-label auth-terms-optional">
                  <input type="checkbox" checked={acceptAiAnalysis} onChange={(e) => setAcceptAiAnalysis(e.target.checked)} />
                  <span>{t('signup-ai-consent-pre')}</span>
                </label>
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t('common-loading') : t('signup-submit-btn')}
                </button>
              </form>
            </div>

            {/* Toggle panels */}
            <div className="auth-toggle-box">
              <div className="auth-toggle-panel auth-toggle-left">
                <h2>{t('login-hello-welcome')}</h2>
                <p>{t('login-new-to-HumatiQ')}</p>
                <button type="button" className="auth-btn ghost" onClick={() => setMode('register')}>{t('login-create-account')}</button>
              </div>
              <div className="auth-toggle-panel auth-toggle-right">
                <h2>{t('login-welcome-back')}</h2>
                <p>{t('login-already-have-account')}</p>
                <button type="button" className="auth-btn ghost" onClick={() => setMode('login')}>{t('auth-toggle-login')}</button>
              </div>
            </div>
          </div>

          {/* Mobile auth wrapper */}
          <div className={`mobile-auth-wrapper ${mode === 'register' ? 'mobile-signup-active' : ''}`}>
            <div className="mobile-auth">
              <div className="mobile-title-text">
                <div className="mobile-title login">{t('login-form-mobile')}</div>
                <div className="mobile-title signup">{t('signup-form-mobile')}</div>
              </div>
              <div className="mobile-form-container">
                <div className="mobile-slide-controls">
                  <input type="radio" name="mobileSlide" id="mobileLogin" checked={mode === 'login'} onChange={() => setMode('login')} />
                  <input type="radio" name="mobileSlide" id="mobileSignup" checked={mode === 'register'} onChange={() => setMode('register')} />
                  <label htmlFor="mobileLogin" className="mobile-slide login">{t('auth-toggle-login')}</label>
                  <label htmlFor="mobileSignup" className="mobile-slide signup">{t('auth-toggle-signup')}</label>
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
                      <input type={showLoginPassword ? 'text' : 'password'} placeholder={t('common-password')} required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                      <button type="button" className="auth-eye-toggle" onClick={() => setShowLoginPassword(v => !v)} tabIndex={-1} aria-label="Toggle password visibility">
                        <i className={showLoginPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                      </button>
                    </div>
                    <div className="mobile-remember-row">
                      <label className="mobile-remember-label"><input type="checkbox" /><span>{t('login-remember-me')}</span></label>
                      <a href="#" className="mobile-pass-link-inline" onClick={(e) => { e.preventDefault(); navigate('/candidat/forgot-password'); }}>{t('login-forgot-password')}</a>
                    </div>
                    <div className="mobile-field mobile-btn">
                      <input type="submit" value={loading ? t('common-loading') : t('login-submit-btn')} disabled={loading} />
                    </div>
                    <div className="mobile-signup-link">
                      {t('signup-not-member')}{' '}
                      <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); }}>{t('signup-signup-now')}</a>
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
                      <input type={showSignupPassword ? 'text' : 'password'} placeholder={t('common-password')} required minLength={6} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                      <button type="button" className="auth-eye-toggle" onClick={() => setShowSignupPassword(v => !v)} tabIndex={-1} aria-label="Toggle password visibility">
                        <i className={showSignupPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                      </button>
                    </div>
                    <label className="mobile-terms-label">
                      <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required />
                      <span>{t('signup-accept-terms-pre')}<a href="/candidat/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{t('signup-accept-terms-link')}</a>{t('signup-accept-terms-post')}</span>
                    </label>
                    <label className="mobile-terms-label mobile-terms-optional">
                      <input type="checkbox" checked={acceptAiAnalysis} onChange={(e) => setAcceptAiAnalysis(e.target.checked)} />
                      <span>{t('signup-ai-consent-pre')}</span>
                    </label>
                    <div className="mobile-field mobile-btn">
                      <input type="submit" value={loading ? t('common-loading') : t('signup-submit-btn')} disabled={loading} />
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
