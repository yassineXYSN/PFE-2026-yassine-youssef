/* HumatiQ AI Auth Page - Login & Signup with animated toggle, standard CSS */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../core/supabaseClient';
import { apiFetch, getUserRole } from '../../../core/api';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import humatiqLogo from '../../../assets/logo/humatiqlogo.png';
import './LoginPage.css';

const LoginPage = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register' (desktop + mobile)
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  // Form state
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

  // Helper: get a display name for a provider
  const providerLabel = (p) => {
    const labels = { google: 'Google', linkedin_oidc: 'LinkedIn', github: 'GitHub', email: 'Email' };
    return labels[p] || p;
  };

  // Redirect if already logged in — handles both existing sessions and OAuth callbacks
  useEffect(() => {
    let cancelled = false;
    // Guard: only the first handleSession call wins. Both onAuthStateChange and
    // getSession() can fire nearly simultaneously after an OAuth callback. Without
    // this flag the second call races against the first and can trigger
    // apiFetch's recoverInvalidSession() (window.location.replace) which wipes
    // the error message before the user sees it.
    let sessionHandled = false;

    const handleSession = async (session) => {
      if (cancelled || sessionHandled) return;
      if (!session) {
        setCheckingSession(false);
        return;
      }
      sessionHandled = true;

      try {
        // Use raw fetch (not apiFetch) for the provider check so that a 403/401
        // response never triggers apiFetch's global recoverInvalidSession() which
        // does window.location.replace() and would wipe the error before it renders.
        let providerBlocked = false;
        let providerDetail = {};
        try {
          const token = session.access_token;
          const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/auth/verify-provider`;
          // The frontend captures the method the user clicked (set in
          // handleLoginSubmit / handleOAuthLogin) and passes it to the backend.
          // Supabase doesn't expose the just-used method reliably server-side
          // after auto-linking, so we rely on this client-recorded intent.
          const attemptedProvider = sessionStorage.getItem('attempted_provider') || null;
          sessionStorage.removeItem('attempted_provider');
          console.log('[LoginPage] calling verify-provider', { url, userId: session.user?.id, email: session.user?.email, attemptedProvider });
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ attempted_provider: attemptedProvider }),
          });
          const bodyText = await res.text();
          console.log(`[LoginPage] verify-provider response status=${res.status} body=${bodyText}`);
          if (res.status === 403) {
            providerBlocked = true;
            try {
              providerDetail = JSON.parse(bodyText).detail || {};
            } catch (_) {
              providerDetail = {};
            }
          } else if (!res.ok) {
            // Backend hit an error verifying — fail closed: sign out, show generic error.
            console.warn('[LoginPage] verify-provider non-ok status, signing out');
            await supabase.auth.signOut();
            setError(t('auth-error-generic'));
            setCheckingSession(false);
            return;
          }
        } catch (netErr) {
          console.error('[LoginPage] verify-provider network error', netErr);
          // network error → fail open, don't block the user
        }

        if (providerBlocked) {
          const originalProvider = providerDetail.original_provider || 'email';
          await supabase.auth.signOut();
          setError(
            originalProvider === 'email'
              ? t('auth-error-use-password')
              : t('auth-error-wrong-method').replace('{provider}', providerDetail.label || originalProvider)
          );
          setCheckingSession(false);
          return;
        }

        // Check if user is HR/admin/superadmin
        const role = await getUserRole(session);
        if (role === 'superadmin') {
          navigate('/superadmin/dashboard', { replace: true });
          return;
        }
        if (['admin', 'recruiter', 'chef_departement'].includes(role)) {
          navigate('/hr/dashboard', { replace: true });
          return;
        }

        // Candidat flow: check account setup status
        try {
          const result = await apiFetch('/candidat/account-setup/status');
          if (result.is_setup_completed) {
            // Check for 2FA BEFORE redirecting to dashboard
            if (result.totp_enabled || result.email_2fa_enabled) {
              const isVerified = localStorage.getItem('2fa_verified') === 'true';
              if (!isVerified) {
                navigate('/candidat/2fa-choose', {
                  state: {
                    totpEnabled: result.totp_enabled,
                    emailEnabled: result.email_2fa_enabled,
                    email: session.user.email
                  },
                  replace: true
                });
                return;
              }
            }
            navigate('/candidat/dashboard', { replace: true });
          } else {
            navigate('/candidat/account-setup', { replace: true });
          }
        } catch (error) {
          console.error('Error checking account setup status:', error);
          if (error.message && error.message.includes('401')) {
            await supabase.auth.signOut();
            setCheckingSession(false);
          }
        }
      } catch (err) {
        console.warn('Session check failed, clearing session:', err.message);
        await supabase.auth.signOut();
        setCheckingSession(false);
      }
    };

    // Listen for auth state changes (handles OAuth callback token processing)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) handleSession(session);
      }
    );

    // Parse OAuth error parameters returned by Supabase in the callback URL.
    // This happens when "Allow manual linking" is on and a user tries to OAuth
    // with an email that already belongs to a different-method account.
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('error');
    const oauthErrorDesc = params.get('error_description') || '';
    if (oauthError) {
      const isDuplicateEmail =
        oauthErrorDesc.toLowerCase().includes('already registered') ||
        oauthErrorDesc.toLowerCase().includes('already been registered') ||
        oauthErrorDesc.toLowerCase().includes('user already exists') ||
        oauthErrorDesc.toLowerCase().includes('email already');
      setError(
        isDuplicateEmail
          ? t('auth-error-use-password')
          : t('auth-error-generic')
      );
      // Clean error params from the URL without a page reload
      navigate(location.pathname, { replace: true });
      setCheckingSession(false);
      return;
    }

    // Also check for an existing session immediately
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        console.warn('Stale session detected, clearing:', sessionError.message);
        supabase.auth.signOut();
        setCheckingSession(false);
        return;
      }
      handleSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate, location, t]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Record intent so verify-provider knows this is a password attempt.
      // Read by handleSession after onAuthStateChange fires.
      sessionStorage.setItem('attempted_provider', 'email');

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

      // Enforce: user must have signed up with email/password
      const { data: { user: signedInUser } } = await supabase.auth.getUser();
      const signupMethod = (() => {
        if (signedInUser?.identities?.length > 0) {
          const sorted = [...signedInUser.identities].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );
          return sorted[0].provider;
        }
        return signedInUser?.app_metadata?.provider || 'email';
      })();
      if (signupMethod !== 'email') {
        await supabase.auth.signOut();
        setError(t('auth-error-wrong-method').replace('{provider}', providerLabel(signupMethod)));
        return;
      }

      // Send login notification
      try {
        await apiFetch('/auth/notify-login', { method: 'POST' });
      } catch (notifyErr) {
        console.warn('Failed to send login notification:', notifyErr);
      }

      // Check if email is confirmed (fallback for configs that allow login before confirmation)
      if (!data.user.email_confirmed_at) {
        navigate('/candidat/email-verification', { state: { email: loginEmail } });
        return;
      }

      // Check if user is HR/admin/superadmin
      const role = await getUserRole({ user: data.user, access_token: data.session.access_token });
      if (role === 'superadmin') {
        navigate('/superadmin/dashboard');
        return;
      }
      if (['admin', 'recruiter', 'chef_departement'].includes(role)) {
        navigate('/hr/dashboard');
        return;
      }

      // Check if candidat profile exists -> go to dashboard or account setup
      try {
        const result = await apiFetch('/candidat/account-setup/status');

        // Check for 2FA
        if (result.totp_enabled || result.email_2fa_enabled) {
          const isVerified = localStorage.getItem('2fa_verified') === 'true';
          if (!isVerified) {
            navigate('/candidat/2fa-choose', {
              state: {
                totpEnabled: result.totp_enabled,
                emailEnabled: result.email_2fa_enabled,
                email: data.user.email
              }
            });
            return;
          }
        }

        if (result.is_setup_completed) {
          navigate('/candidat/dashboard');
        } else {
          navigate('/candidat/account-setup');
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

      // RGPD: explicit, freely given consent to the Terms & Privacy Policy is
      // mandatory before any account (and therefore any data processing) is created.
      if (!acceptTerms) {
        setError(t('auth-error-terms-required'));
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
            role: 'candidate',
            // RGPD: keep an auditable record of when consent was given.
            terms_accepted: true,
            terms_accepted_at: new Date().toISOString(),
            // Separate, optional consent for AI behavioural/emotion analysis
            // during interviews — not a precondition of registration.
            ai_analysis_consent: acceptAiAnalysis,
            ai_analysis_consent_at: acceptAiAnalysis ? new Date().toISOString() : null,
          },
        },
      });

      if (authError) {
        console.log('Full auth error:', authError);  
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

  const [oauthLoading, setOauthLoading] = useState(false);

  // Handle OAuth callback: when returning from provider, checkSession (above) handles role-based redirect
  const handleOAuthLogin = async (provider) => {
    setError('');
    setOauthLoading(true);
    // Record intent so verify-provider knows which OAuth provider was clicked.
    // sessionStorage survives the redirect to the provider and back.
    sessionStorage.setItem('attempted_provider', provider);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/candidat/login`,
      },
    });
    if (oauthError) {
      sessionStorage.removeItem('attempted_provider');
      setError(oauthError.message);
      setOauthLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="login-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          width: '100%',
          maxWidth: '280px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          animation: 'login-fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div className="fine-linear-loader"></div>
          <p style={{ 
            fontSize: '0.65rem', 
            fontWeight: 800, 
            textTransform: 'uppercase', 
            letterSpacing: '0.12em',
            opacity: 0.4,
            margin: 0
          }}>
            Vérification de session
          </p>
          <style>{`
            @keyframes login-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
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
            <img src={humatiqLogo} alt="HumatiQ" style={{ height: '40px', objectFit: 'contain' }} />
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
                  <a
                    href="#"
                    className="auth-forgot-link-inline"
                    onClick={(e) => { e.preventDefault(); navigate('/candidat/forgot-password'); }}
                  >{t('login-forgot-password')}</a>
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t('common-loading') : t('login-submit-btn')}
                </button>
                <p className="auth-social-text">{t('login-or-login-with')}</p>
                <div className="auth-social-icons">
                  <button type="button" className="auth-social-pill google" onClick={() => handleOAuthLogin('google')} disabled={oauthLoading}>
                    <i className="fa-brands fa-google"></i>
                    <span>Google</span>
                  </button>
                  <button type="button" className="auth-social-pill linkedin" onClick={() => handleOAuthLogin('linkedin_oidc')} disabled={oauthLoading}>
                    <i className="fa-brands fa-linkedin-in"></i>
                    <span>LinkedIn</span>
                  </button>
                  <button type="button" className="auth-social-pill github" onClick={() => handleOAuthLogin('github')} disabled={oauthLoading}>
                    <i className="fa-brands fa-github"></i>
                    <span>GitHub</span>
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
                <label className="auth-terms-label">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    required
                  />
                  <span>
                    {t('signup-accept-terms-pre')}
                    <a
                      href="/candidat/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('signup-accept-terms-link')}
                    </a>
                    {t('signup-accept-terms-post')}
                  </span>
                </label>
                <label className="auth-terms-label auth-terms-optional">
                  <input
                    type="checkbox"
                    checked={acceptAiAnalysis}
                    onChange={(e) => setAcceptAiAnalysis(e.target.checked)}
                  />
                  <span>
                    {t('signup-ai-consent-pre')}
                    <em>{t('signup-ai-consent-optional')}</em>
                  </span>
                </label>
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t('common-loading') : t('signup-submit-btn')}
                </button>
                <p className="auth-social-text">{t('signup-or-signup-with')}</p>
                <div className="auth-social-icons">
                  <button type="button" className="auth-social-pill google" onClick={() => handleOAuthLogin('google')} disabled={oauthLoading}>
                    <i className="fa-brands fa-google"></i>
                    <span>Google</span>
                  </button>
                  <button type="button" className="auth-social-pill linkedin" onClick={() => handleOAuthLogin('linkedin_oidc')} disabled={oauthLoading}>
                    <i className="fa-brands fa-linkedin-in"></i>
                    <span>LinkedIn</span>
                  </button>
                  <button type="button" className="auth-social-pill github" onClick={() => handleOAuthLogin('github')} disabled={oauthLoading}>
                    <i className="fa-brands fa-github"></i>
                    <span>GitHub</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Toggle panels */}            <div className="auth-toggle-box">
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
                  {t('auth-toggle-login')}
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
                    {t('auth-toggle-login')}
                  </label>
                  <label htmlFor="mobileSignup" className="mobile-slide signup">
                    {t('auth-toggle-signup')}
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
                      <input type="password" placeholder={t('common-password')} required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
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
                      <input type="submit" value={loading ? t('common-loading') : t('login-submit-btn')} disabled={loading} />
                    </div>
                    <p className="mobile-social-text">{t('login-or-login-with')}</p>
                    <div className="mobile-social-icons">
                      <button type="button" className="mobile-social-pill google" onClick={() => handleOAuthLogin('google')} disabled={oauthLoading}>
                        <i className="fa-brands fa-google"></i>
                      </button>
                      <button type="button" className="mobile-social-pill linkedin" onClick={() => handleOAuthLogin('linkedin_oidc')} disabled={oauthLoading}>
                        <i className="fa-brands fa-linkedin-in"></i>
                      </button>
                      <button type="button" className="mobile-social-pill github" onClick={() => handleOAuthLogin('github')} disabled={oauthLoading}>
                        <i className="fa-brands fa-github"></i>
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
                    <label className="mobile-terms-label">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        required
                      />
                      <span>
                        {t('signup-accept-terms-pre')}
                        <a
                          href="/candidat/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('signup-accept-terms-link')}
                        </a>
                        {t('signup-accept-terms-post')}
                      </span>
                    </label>
                    <label className="mobile-terms-label mobile-terms-optional">
                      <input
                        type="checkbox"
                        checked={acceptAiAnalysis}
                        onChange={(e) => setAcceptAiAnalysis(e.target.checked)}
                      />
                      <span>
                        {t('signup-ai-consent-pre')}
                        <em>{t('signup-ai-consent-optional')}</em>
                      </span>
                    </label>
                    <div className="mobile-field mobile-btn">
                      <input type="submit" value={loading ? t('common-loading') : t('signup-submit-btn')} disabled={loading} />
                    </div>
                    <p className="mobile-social-text">{t('signup-or-signup-with')}</p>
                    <div className="mobile-social-icons">
                      <button type="button" className="mobile-social-pill google" onClick={() => handleOAuthLogin('google')} disabled={oauthLoading}>
                        <i className="fa-brands fa-google"></i>
                      </button>
                      <button type="button" className="mobile-social-pill linkedin" onClick={() => handleOAuthLogin('linkedin_oidc')} disabled={oauthLoading}>
                        <i className="fa-brands fa-linkedin-in"></i>
                      </button>
                      <button type="button" className="mobile-social-pill github" onClick={() => handleOAuthLogin('github')} disabled={oauthLoading}>
                        <i className="fa-brands fa-github"></i>
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
