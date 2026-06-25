import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../core/api';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import humatiqLogo from '../../../assets/logo/humatiqlogo.png';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
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
        {!sent ? (
          <>
            <div className="fp-icon-wrapper">
              <i className="fa-solid fa-lock-open fp-icon"></i>
            </div>
            <h1 className="fp-title">{t('forgot-password-title') || 'Mot de passe oublié ?'}</h1>
            <p className="fp-desc">
              {t('forgot-password-desc') || 'Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.'}
            </p>

            {error && <div className="auth-error-msg">{error}</div>}

            <form className="fp-form" onSubmit={handleSubmit}>
              <div className="fp-input-box">
                <input
                  type="email"
                  placeholder={t('common-email') || 'Adresse e-mail'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <i className="fa-solid fa-envelope"></i>
              </div>
              <button type="submit" className="fp-btn" disabled={loading}>
                {loading ? (t('common-loading') || 'Chargement...') : (t('forgot-password-send') || 'Envoyer le lien')}
              </button>
            </form>

            <button className="fp-back-link" onClick={() => navigate('/candidat/login')}>
              <i className="fa-solid fa-arrow-left"></i>
              {t('forgot-password-back') || 'Retour à la connexion'}
            </button>
          </>
        ) : (
          <>
            <div className="fp-icon-wrapper success">
              <i className="fa-solid fa-envelope-circle-check fp-icon"></i>
            </div>
            <h1 className="fp-title">{t('forgot-password-sent-title') || 'E-mail envoyé !'}</h1>
            <p className="fp-desc">
              {t('forgot-password-sent-desc') || 'Un lien de réinitialisation a été envoyé à '}
              <strong>{email}</strong>.
              {' '}{t('forgot-password-sent-check') || 'Vérifiez votre boîte de réception (et vos spams).'}
            </p>
            <button className="fp-btn outline" onClick={() => setSent(false)}>
              {t('forgot-password-resend') || 'Renvoyer le lien'}
            </button>
            <button className="fp-back-link" onClick={() => navigate('/candidat/login')}>
              <i className="fa-solid fa-arrow-left"></i>
              {t('forgot-password-back') || 'Retour à la connexion'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
