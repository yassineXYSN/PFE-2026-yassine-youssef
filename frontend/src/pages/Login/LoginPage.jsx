/* NextHire AI Auth Page - Login & Signup with animated toggle, standard CSS */

import { useState } from 'react';
import './LoginPage.css';

const LoginPage = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register' (desktop + mobile)

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    // TODO: wire up to backend auth
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    // TODO: wire up to backend registration
  };

  return (
    <div className="login-page">
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
                AI-driven job matching for the modern candidate.
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
                <p className="login-hero-stats-text">Join 10,000+ hired candidates</p>
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
                <h1>Login</h1>
                <div className="auth-input-box">
                  <input type="email" placeholder="Email" required />
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div className="auth-input-box">
                  <input type="password" placeholder="Password" required />
                  <i className="fa-solid fa-lock"></i>
                </div>
                <div className="auth-forgot-link">
                  <a href="#">Forgot Password?</a>
                </div>
                <button type="submit" className="auth-btn">
                  Login
                </button>
                <p className="auth-social-text">or login with</p>
                <div className="auth-social-icons">
                  <button type="button" className="auth-social-pill google">
                    <i className="fa-brands fa-google"></i>
                    <span>Google</span>
                  </button>
                  <button type="button" className="auth-social-pill linkedin">
                    <i className="fa-brands fa-linkedin-in"></i>
                    <span>LinkedIn</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Signup form */}
            <div className="auth-form-box register">
              <form onSubmit={handleRegisterSubmit}>
                <h1>Sign up</h1>
                <div className="auth-input-box">
                  <input type="text" placeholder="Full name" required />
                  <i className="fa-solid fa-user"></i>
                </div>
                <div className="auth-input-box">
                  <input type="email" placeholder="Email" required />
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div className="auth-input-box">
                  <input type="password" placeholder="Password" required />
                  <i className="fa-solid fa-lock"></i>
                </div>
                <button type="submit" className="auth-btn">
                  Sign up
                </button>
                <p className="auth-social-text">or sign up with</p>
                <div className="auth-social-icons">
                  <button type="button" className="auth-social-pill google">
                    <i className="fa-brands fa-google"></i>
                    <span>Google</span>
                  </button>
                  <button type="button" className="auth-social-pill linkedin">
                    <i className="fa-brands fa-linkedin-in"></i>
                    <span>LinkedIn</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Toggle panels */}
            <div className="auth-toggle-box">
              <div className="auth-toggle-panel auth-toggle-left">
                <h2>Hello, welcome!</h2>
                <p>New to NextHire AI?</p>
                <button
                  type="button"
                  className="auth-btn ghost"
                  onClick={() => setMode('register')}
                >
                  Create account
                </button>
              </div>

              <div className="auth-toggle-panel auth-toggle-right">
                <h2>Welcome back!</h2>
                <p>Already have an account?</p>
                <button
                  type="button"
                  className="auth-btn ghost"
                  onClick={() => setMode('login')}
                >
                  Login
                </button>
              </div>
            </div>
          </div>

          {/* Mobile auth wrapper (separate style for phones) */}
          <div className="mobile-auth-wrapper">
            <div className="mobile-auth">
              <div className="mobile-title-text">
                <div className="mobile-title login">Login Form</div>
                <div className="mobile-title signup">Signup Form</div>
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
                    Login
                  </label>
                  <label htmlFor="mobileSignup" className="mobile-slide signup">
                    Signup
                  </label>
                  <div className="mobile-slider-tab"></div>
                </div>

                <div className="mobile-form-inner">
                  <form className="mobile-form login" onSubmit={handleLoginSubmit}>
                    <div className="mobile-field">
                      <input type="email" placeholder="Email Address" required />
                    </div>
                    <div className="mobile-field">
                      <input type="password" placeholder="Password" required />
                    </div>
                    <div className="mobile-pass-link">
                      <a href="#">Forgot password?</a>
                    </div>
                    <div className="mobile-field mobile-btn">
                      <div className="mobile-btn-layer"></div>
                      <input type="submit" value="Login" />
                    </div>
                    <div className="mobile-signup-link">
                      Not a member?{' '}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setMode('register');
                        }}
                      >
                        Signup now
                      </a>
                    </div>
                  </form>

                  <form className="mobile-form signup" onSubmit={handleRegisterSubmit}>
                    <div className="mobile-field">
                      <input type="text" placeholder="Full name" required />
                    </div>
                    <div className="mobile-field">
                      <input type="email" placeholder="Email Address" required />
                    </div>
                    <div className="mobile-field">
                      <input type="password" placeholder="Password" required />
                    </div>
                    <div className="mobile-field mobile-btn">
                      <div className="mobile-btn-layer"></div>
                      <input type="submit" value="Signup" />
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

