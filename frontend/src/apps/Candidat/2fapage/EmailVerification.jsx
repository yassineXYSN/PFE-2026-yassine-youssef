import React, { useState, useRef } from 'react';
import './EmailVerification.css';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';

const EmailVerification = () => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

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
    // Handle verification logic here
  };

  const handleResend = () => {
    console.log('Resending code...');
    // Handle resend logic here
  };

  return (
    <div className="verification-page">
      <div className="verification-theme-toggle">
        <ThemeToggle />
      </div>

      <main className="verification-main">
        <div className="verification-card">
          {/* Header Section */}
          <div className="verification-header">
            <div className="verification-icon">
              <i className="fas fa-envelope"></i>
            </div>
            <h1 className="verification-title">Email Verification</h1>
            <p className="verification-subtitle">
              Enter the 6-digit code sent to your email address
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
              Verify Email
            </button>

            {/* Resend Link */}
            <div className="verification-resend">
              <p>
                Didn't receive the code?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); handleResend(); }}>
                  Resend
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
