import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './EmailVerification.css';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import { supabase } from '../../../core/supabaseClient';

const EmailVerification = () => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const { t } = useLanguage();

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
    const verificationCode = code.join('');
    if (verificationCode.length < 6) {
      setError(t('auth-verification-incomplete') || 'Please enter the full 6-digit code.');
      return;
    }

    const email = sessionStorage.getItem('candidat-verify-email');
    if (!email) {
      setError(t('auth-verification-no-email') || 'No verification email found. Please sign up again.');
      navigate('/candidat/login');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'signup',
      });
      if (otpError) throw otpError;

      sessionStorage.removeItem('candidat-verify-email');
      navigate('/candidat/account-setup');
    } catch (err) {
      setError(
        err.message === 'Token has expired or is invalid'
          ? t('auth-verification-invalid-token') || 'Invalid or expired code. Please try again.'
          : t('auth-verification-error') || 'Verification failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const email = sessionStorage.getItem('candidat-verify-email');
    if (!email) {
      navigate('/candidat/login');
      return;
    }
    setResent(false);
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
    if (!resendError) setResent(true);
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

            {error && <p className="verification-error">{error}</p>}

            {/* Verify Button */}
            <button onClick={handleVerify} className="verification-btn" disabled={loading}>
              {loading ? '...' : t('auth-verification-btn')}
            </button>

            {/* Resend Link */}
            <div className="verification-resend">
              {resent && (
                <p className="verification-resent">{t('auth-verification-resent') || 'A new code has been sent to your email.'}</p>
              )}
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
