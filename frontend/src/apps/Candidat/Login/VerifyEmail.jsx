import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../../core/api';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import humatiqLogo from '../../../assets/logo/humatiqlogo.png';
import './ForgotPassword.css';

const VerifyEmail = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { t } = useLanguage();
    const token = searchParams.get('token');

    const [status, setStatus] = useState(token ? 'loading' : 'missing');
    const [errorMessage, setErrorMessage] = useState('');
    const requestedTokenRef = useRef(null);

    useEffect(() => {
        if (!token) return;
        // verify-account is single-use and non-idempotent: consuming a token
        // twice legitimately fails the second time. StrictMode intentionally
        // re-runs this effect once in dev, so guard on the token itself (not
        // just a "cancelled" flag) to make sure the request only ever fires
        // once per token.
        if (requestedTokenRef.current === token) return;
        requestedTokenRef.current = token;

        apiFetch('/auth/verify-account', {
            method: 'POST',
            body: JSON.stringify({ token }),
        })
            .then(() => {
                setStatus('success');
                setTimeout(() => navigate('/candidat/login'), 3000);
            })
            .catch((err) => {
                setErrorMessage(err.message);
                setStatus('error');
            });
    }, [token]);

    const renderContent = () => {
        if (status === 'missing') {
            return (
                <>
                    <div className="fp-icon-wrapper">
                        <i className="fa-solid fa-link-slash fp-icon"></i>
                    </div>
                    <h1 className="fp-title">{t('candidat-verify-missing-title') || 'Lien invalide'}</h1>
                    <p className="fp-desc">
                        {t('candidat-verify-missing-desc') || "Ce lien d'activation ne contient pas de jeton. Utilisez le lien reçu par email."}
                    </p>
                </>
            );
        }
        if (status === 'loading') {
            return (
                <>
                    <div className="fp-icon-wrapper">
                        <i className="fa-solid fa-hourglass-half fp-icon"></i>
                    </div>
                    <h1 className="fp-title">{t('candidat-verify-loading-title') || 'Activation de votre compte…'}</h1>
                    <p className="fp-desc">
                        {t('candidat-verify-loading-desc') || 'Veuillez patienter pendant que nous confirmons votre lien de vérification.'}
                    </p>
                </>
            );
        }
        if (status === 'success') {
            return (
                <>
                    <div className="fp-icon-wrapper success">
                        <i className="fa-solid fa-circle-check fp-icon"></i>
                    </div>
                    <h1 className="fp-title">{t('candidat-verify-success-title') || 'Compte activé !'}</h1>
                    <p className="fp-desc">
                        {t('candidat-verify-success-desc') || 'Votre compte est maintenant actif. Redirection vers la connexion…'}
                    </p>
                    <button className="fp-btn" onClick={() => navigate('/candidat/login')}>
                        {t('candidat-verify-btn-login') || 'Aller à la connexion'}
                    </button>
                </>
            );
        }
        return (
            <>
                <div className="fp-icon-wrapper">
                    <i className="fa-solid fa-circle-exclamation fp-icon"></i>
                </div>
                <h1 className="fp-title">{t('candidat-verify-error-title') || "Échec de l'activation"}</h1>
                <p className="fp-desc">{errorMessage}</p>
                <button className="fp-back-link" onClick={() => navigate('/candidat/login')}>
                    <i className="fa-solid fa-arrow-left"></i>
                    {t('candidat-verify-btn-back') || 'Retour à la connexion'}
                </button>
            </>
        );
    };

    return (
        <div className="fp-page">
            <div className="fp-topbar">
                <img src={humatiqLogo} alt="HumatiQ" className="fp-logo" />
                <div className="fp-topbar-actions">
                    <LanguageToggle />
                    <ThemeToggle />
                </div>
            </div>

            <div className="fp-card">
                {renderContent()}
            </div>
        </div>
    );
};

export default VerifyEmail;
