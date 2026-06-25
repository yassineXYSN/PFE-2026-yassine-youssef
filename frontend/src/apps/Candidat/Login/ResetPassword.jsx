import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../../core/api';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import humatiqLogo from '../../../assets/logo/humatiqlogo.png';
import './ForgotPassword.css';

const getStrength = (pass) => {
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  return score;
};

const getStrengthLabel = (score) => {
  if (score === 0) return 'Faible';
  if (score <= 2) return 'Moyen';
  if (score === 3) return 'Bon';
  return 'Fort';
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();

  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const strength = getStrength(password);

  if (!token) {
    return (
      <div className="fp-page">
        <div className="fp-topbar">
          <img src={humatiqLogo} alt="HumatiQ" className="fp-logo" />
          <div className="fp-topbar-actions"><LanguageToggle /><ThemeToggle /></div>
        </div>
        <div className="fp-card">
          <div className="fp-icon-wrapper">
            <i className="fa-solid fa-hourglass-half fp-icon"></i>
          </div>
          <h1 className="fp-title">{t('reset-password-waiting') || 'Lien invalide ou expiré'}</h1>
          <p className="fp-desc">
            {t('reset-password-waiting-desc') || 'Ce lien de réinitialisation est invalide ou a expiré. Veuillez en demander un nouveau.'}
          </p>
          <button className="fp-btn" onClick={() => navigate('/candidat/forgot-password')}>
            {t('reset-password-request-new') || 'Demander un nouveau lien'}
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError(t('reset-password-mismatch') || 'Les mots de passe ne correspondent pas.');
      return;
    }
    if (strength < 2) {
      setError(t('reset-password-weak') || 'Le mot de passe est trop faible.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      setTimeout(() => navigate('/candidat/login'), 3000);
    } catch (err) {
      setError(err.message || 'Lien invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp-page">
      <div className="fp-topbar">
        <img src={humatiqLogo} alt="HumatiQ" className="fp-logo" />
        <div className="fp-topbar-actions"><LanguageToggle /><ThemeToggle /></div>
      </div>

      <div className="fp-card">
        {!done ? (
          <>
            <div className="fp-icon-wrapper">
              <i className="fa-solid fa-key fp-icon"></i>
            </div>
            <h1 className="fp-title">{t('reset-password-title') || 'Nouveau mot de passe'}</h1>
            <p className="fp-desc">
              {t('reset-password-desc') || "Choisissez un mot de passe fort que vous n'avez pas utilisé auparavant."}
            </p>

            {error && <div className="auth-error-msg">{error}</div>}

            <form className="fp-form" onSubmit={handleSubmit}>
              <div className="fp-input-box">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('reset-password-new') || 'Nouveau mot de passe'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="fp-eye-btn" onClick={() => setShowPassword(v => !v)}>
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>

              {password && (
                <div className="fp-strength">
                  <div className="fp-strength-bars">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`fp-strength-bar ${step <= strength ? 'active' : ''}`}
                        style={{ backgroundColor: step <= strength ? (strength >= 3 ? '#22c55e' : '#f97316') : undefined }}
                      />
                    ))}
                  </div>
                  <span className="fp-strength-label" style={{ color: strength >= 3 ? '#22c55e' : '#f97316' }}>
                    {getStrengthLabel(strength)}
                  </span>
                </div>
              )}

              <div className="fp-input-box">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder={t('reset-password-confirm') || 'Confirmer le mot de passe'}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <button type="button" className="fp-eye-btn" onClick={() => setShowConfirm(v => !v)}>
                  <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>

              <button type="submit" className="fp-btn" disabled={loading}>
                {loading ? (t('common-loading') || 'Chargement...') : (t('reset-password-submit') || 'Réinitialiser le mot de passe')}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="fp-icon-wrapper success">
              <i className="fa-solid fa-circle-check fp-icon"></i>
            </div>
            <h1 className="fp-title">{t('reset-password-done-title') || 'Mot de passe mis à jour !'}</h1>
            <p className="fp-desc">
              {t('reset-password-done-desc') || 'Votre mot de passe a été réinitialisé. Vous allez être redirigé vers la connexion…'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
