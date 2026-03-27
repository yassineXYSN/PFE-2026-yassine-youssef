import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../core/useLanguage';
import { supabase } from '../../../core/supabaseClient';
import { apiFetch } from '../../../core/api';
import './TwoFA.css';

const TwoFAVerify = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const { method, email, totpEnabled, emailEnabled } = location.state || {};
    
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resending, setResending] = useState(false);
    const [timer, setTimer] = useState(0);
    const inputRefs = useRef([]);

    useEffect(() => {
        if (!location.state) {
            navigate('/candidat/login');
            return;
        }

        if (method === 'email') {
            handleSendEmailCode();
        }
    }, [method]);

    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000);
            return () => clearInterval(interval);
        }
    }, [timer]);

    const handleSendEmailCode = async () => {
        setResending(true);
        setError('');
        try {
            await apiFetch('/candidat/2fa/email/send', {
                method: 'POST'
            });
            setTimer(60);
        } catch (err) {
            setError(t('twofa-error-send-failed') || 'Failed to send code. Please try again.');
        } finally {
            setResending(false);
        }
    };

    const handleInputChange = (index, value) => {
        if (isNaN(value)) return;
        
        const newCode = [...code];
        newCode[index] = value.substring(value.length - 1);
        setCode(newCode);

        if (value && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handleVerify = async (e) => {
        if (e) e.preventDefault();
        const fullCode = code.join('');
        if (fullCode.length !== 6) return;

        setLoading(true);
        setError('');
        try {
            const endpoint = `/candidat/2fa/${method}/verify?code=${fullCode}`;
            await apiFetch(endpoint, { method: 'POST' });

            // Successful verification
            localStorage.setItem('2fa_verified', 'true');
            
            // Final check for account setup
            const statusData = await apiFetch('/candidat/account-setup/status');
            
            if (statusData.is_setup_completed) {
                navigate('/candidat/dashboard');
            } else {
                navigate('/candidat/account-setup');
            }
        } catch (err) {
            setError(err.message || t('twofa-error-invalid-code') || 'Invalid verification code.');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToLogin = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('2fa_verified');
        navigate('/candidat/login');
    };

    return (
        <div className="twofa-page">
            <div className="twofa-shell">
                <div className="twofa-card">
                    <h1>{method === 'totp' ? t('twofa-verify-totp-title') : t('twofa-verify-email-title')}</h1>
                    <p>
                        {method === 'totp' 
                            ? t('twofa-verify-totp-desc')
                            : t('twofa-verify-email-desc', { email })}
                    </p>

                    <form className="twofa-form" onSubmit={handleVerify}>
                        <div className="twofa-code-inputs">
                            {code.map((num, idx) => (
                                <input
                                    key={idx}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength="1"
                                    value={num}
                                    ref={el => inputRefs.current[idx] = el}
                                    onChange={e => handleInputChange(idx, e.target.value)}
                                    onKeyDown={e => handleKeyDown(idx, e)}
                                    autoFocus={idx === 0}
                                />
                            ))}
                        </div>

                        {error && <div className="twofa-error">{error}</div>}

                        <button type="submit" className="twofa-verify-btn" disabled={loading || code.some(c => !c)}>
                            {loading ? t('common-loading') : t('common-verify')}
                        </button>
                    </form>

                    {method === 'email' && (
                        <div className="twofa-resend">
                            <p>{t('twofa-no-code')}</p>
                            <button 
                                onClick={handleSendEmailCode} 
                                disabled={resending || timer > 0}
                                className="twofa-link-btn"
                            >
                                {timer > 0 ? `${t('twofa-resend-in')} ${timer}s` : t('twofa-resend-now')}
                            </button>
                        </div>
                    )}

                    {(totpEnabled && emailEnabled) && (
                        <button className="twofa-back-btn" onClick={() => navigate('/candidat/2fa-choose', { state: location.state })}>
                            {t('twofa-choose-different')}
                        </button>
                    )}
                    
                    <button className="twofa-back-login-btn" onClick={handleBackToLogin}>
                        {t('common-back-to-login')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TwoFAVerify;
