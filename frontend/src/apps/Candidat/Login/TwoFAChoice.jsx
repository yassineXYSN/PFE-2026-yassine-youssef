import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../core/useLanguage';
import './TwoFA.css';

const TwoFAChoice = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const { totpEnabled, emailEnabled, email } = location.state || {};

    const handleSelect = (method) => {
        navigate('/candidat/2fa-verify', { 
            state: { 
                method, 
                email,
                totpEnabled,
                emailEnabled
            } 
        });
    };

    if (!location.state) {
        useEffect(() => { navigate('/candidat/login'); }, []);
        return null;
    }

    return (
        <div className="twofa-page">
            <div className="twofa-shell">
                <div className="twofa-card">
                    <h1>{t('twofa-choice-title')}</h1>
                    <p>{t('twofa-choice-subtitle')}</p>
                    
                    <div className="twofa-options">
                        {totpEnabled && (
                            <button className="twofa-option-btn" onClick={() => handleSelect('totp')}>
                                <div className="twofa-option-icon">
                                    <i className="fa-solid fa-mobile-screen-button"></i>
                                </div>
                                <div className="twofa-option-text">
                                    <h3>{t('twofa-method-totp')}</h3>
                                    <p>{t('twofa-method-totp-desc')}</p>
                                </div>
                            </button>
                        )}
                        
                        {emailEnabled && (
                            <button className="twofa-option-btn" onClick={() => handleSelect('email')}>
                                <div className="twofa-option-icon">
                                    <i className="fa-solid fa-envelope"></i>
                                </div>
                                <div className="twofa-option-text">
                                    <h3>{t('twofa-method-email')}</h3>
                                    <p>{t('twofa-method-email-desc')}</p>
                                </div>
                            </button>
                        )}
                    </div>
                    
                    <button className="twofa-back-btn" onClick={() => navigate('/candidat/login')}>
                        {t('common-back-to-login')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TwoFAChoice;
