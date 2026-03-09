import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './EmailVerification.css';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';

const EmailVerification = () => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
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

  const handleVerify = () => {
    const verificationCode = code.join('');
    console.log('Verification code:', verificationCode);
    // Navigate to account setup page after verification
    navigate('/candidat/account-setup');
  };

  const handleResend = () => {
    console.log('Resending code...');
    // Handle resend logic here
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

            {/* Verify Button */}
            <button onClick={handleVerify} className="verification-btn">
              {t('auth-verification-btn')}
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
          <p>© 2026 HumatiQ. Secure Verification.</p>
        </div>
      </main>
    </div>
  );
};

export default EmailVerification;
