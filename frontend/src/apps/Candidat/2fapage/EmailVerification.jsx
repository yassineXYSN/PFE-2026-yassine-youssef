import React, { useState, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import './EmailVerification.css';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import { supabase } from '../../../core/supabaseClient';

const EmailVerification = () => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');

  const email = sessionStorage.getItem('candidat-signup-email') || '';

  // If no email in session (direct navigation), redirect to login
  if (!email) {
    return <Navigate to="/candidat/login" replace />;
  }

  const handleChange = (index, value) => {
    if (value.length > 1) return;
    
    // Only allow letters and numbers
    const alphanumeric = /^[a-zA-Z0-9]$/;
    if (value && !alphanumeric.test(value)) return;
    
    // Convert to uppercase
    const uppercaseValue = value.toUpperCase();
    
    const newCode = [...code];
    newCode[index] = uppercaseValue;
    setCode(newCode);

    // Auto-focus next input
    if (uppercaseValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const token = code.join('');
    if (token.length < 6) {
      setError(t('auth-verification-incomplete'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });

      if (verifyError) throw verifyError;

      sessionStorage.removeItem('candidat-signup-email');
      navigate('/candidat/account-setup');
    } catch (err) {
      console.error('Verification error:', err.message);
      setError(t('auth-verification-error'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResendMessage('');
    setError('');

    try {
      const { error: resendError } = await supabase.auth.resend({
        email,
        type: 'signup',
      });

      if (resendError) throw resendError;

      setResendMessage(t('auth-verification-resend-success'));
    } catch (err) {
      console.error('Resend error:', err.message);
      setError(t('auth-verification-resend-error'));
    }
  };

  return (
    <div className="verification-page">
      <div className="verification-theme-toggle">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <main className="verification-main">
        <div className="verification-card">
          {/* Header Section */}
          <div className="verification-header">
            <div className="verification-icon">
              <i className="fas fa-envelope"></i>
            </div>
            <h1 className="verification-title">{t('auth-verification-title')}</h1>
            <p className="verification-subtitle">
              {t('auth-verification-subtitle')}
            </p>
          </div>

          {/* Form Section */}
          <div className="verification-form">
            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 0.75rem' }}>
                {error}
              </p>
            )}
            {resendMessage && (
              <p style={{ color: '#22c55e', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 0.75rem' }}>
                {resendMessage}
              </p>
            )}
            {/* Code Inputs */}
            <div className="verification-inputs">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="verification-input"
                  placeholder="-"
                />
              ))}
            </div>

            {/* Verify Button */}
            <button onClick={handleVerify} className="verification-btn" disabled={loading}>
              {loading ? t('common-loading') : t('auth-verification-btn')}
            </button>

            {/* Resend Link */}
            <div className="verification-resend">
              <p>
                {t('auth-verification-no-code')}{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); handleResend(); }}>
                  {t('auth-verification-resend')}
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="verification-footer">
          <p>© 2026 NextHire AI. Secure Verification.</p>
        </div>
      </main>
    </div>
  );
};

export default EmailVerification;
