import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../core/useLanguage';
import { supabase } from '../../../core/supabaseClient';
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
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch('http://localhost:8000/api/candidat/2fa/email/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (response.ok) {
                setTimer(60);
            } else {
                setError(t('twofa-error-send-failed') || 'Failed to send code. Please try again.');
            }
        } catch (err) {
            setError(t('twofa-error-generic') || 'An error occurred.');
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
            const { data: { session } } = await supabase.auth.getSession();
            const endpoint = method === 'totp' 
                ? '/api/candidat/2fa/totp/verify-login' 
                : '/api/candidat/2fa/email/verify-login';
            
            // Note: We might need to add these endpoints to the backend or use existing ones
            // For now let's assume we use regular verify but without updating the "enabled" status if it's already enabled
            const response = await fetch(`http://localhost:8000/api/candidat/2fa/${method}/verify?code=${fullCode}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (response.ok) {
                // Successful verification
                localStorage.setItem('2fa_verified', 'true');
                
                // Final check for account setup
                const statusRes = await fetch('http://localhost:8000/candidat/account-setup/status', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                const statusData = await statusRes.json();
                
                if (statusData.is_setup_completed) {
                    navigate('/candidat/dashboard');
                } else {
                    navigate('/candidat/account-setup');
                }
            } else {
                const data = await response.json();
                setError(data.detail || t('twofa-error-invalid-code') || 'Invalid verification code.');
            }
        } catch (err) {
            setError(t('twofa-error-generic') || 'An error occurred.');
        } finally {
            setLoading(false);
        }
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
                    
                    <button className="twofa-back-login-btn" onClick={() => navigate('/candidat/login')}>
                        {t('common-back-to-login')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TwoFAVerify;
