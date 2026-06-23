import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../../../core/useLanguage';
import './Welcome.css';

const Welcome = () => {
    const { effectiveTheme } = useTheme();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const handleStart = () => {
        navigate('/hr/create-company');
    };

    return (
        <div className={`welcome-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            {/* Background Decorative Element */}
            <div className="welcome-bg-grid"></div>

            <main className="welcome-main">
                <div className="welcome-container">
                    <div className="welcome-icon-wrapper">
                        <span className="material-symbols-outlined welcome-icon">waving_hand</span>
                    </div>

                    <h1 className="welcome-title">{t('hr-auth-welcome-title')}</h1>

                    <p className="welcome-text">
                        {t('hr-auth-welcome-text')}
                    </p>

                    <p className="welcome-subtext">
                        {t('hr-auth-welcome-subtext')}
                    </p>

                    <button className="welcome-btn" onClick={handleStart}>
                        <span>{t('hr-auth-welcome-btn')}</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>

                    <div className="welcome-footer-info">
                        <span className="material-symbols-outlined">verified_user</span>
                        <span>{t('hr-auth-welcome-secure')}</span>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Welcome;
