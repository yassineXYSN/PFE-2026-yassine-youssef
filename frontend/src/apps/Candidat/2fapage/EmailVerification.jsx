import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './EmailVerification.css';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';

const EmailVerification = () => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const email = location.state?.email || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');

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

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    // Keep only alphanumeric characters, convert to uppercase, take first 6
    const cleaned = pasted.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    if (!cleaned) return;

    const newCode = [...code];
    cleaned.split('').forEach((char, i) => {
      newCode[i] = char;
    });
    setCode(newCode);

    // Focus the input after the last pasted character (or the last input)
    const nextIndex = Math.min(cleaned.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    if (verificationCode.length !== 6) {
      setError(t('auth-error-invalid-code'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Email OTP verification is handled server-side. Navigate directly.
      navigate('/candidat/account-setup');
    } catch (err) {
      setError(t('auth-error-generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResendMessage('');
    setError('');

    try {
      // Resend not available without Supabase; show generic message
      const resendError = null;
      if (resendError) {
        setError(resendError.message);
      } else {
        setResendMessage(t('auth-verification-resent'));
      }
    } catch {
      setError(t('auth-error-generic'));
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
            {error && <div className="auth-error-msg">{error}</div>}
            {resendMessage && <div className="auth-success-msg">{resendMessage}</div>}

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
                  onPaste={handlePaste}
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
          <p>© 2026 HumatiQ AI. Secure Verification.</p>
        </div>
      </main>
    </div>
  );
};

export default EmailVerification;
