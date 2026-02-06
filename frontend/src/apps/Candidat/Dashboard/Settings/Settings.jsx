import { useLanguage } from '../../../../core/useLanguage';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../../components/LanguageToggle/LanguageToggle';
import '../ComingSoon.css';
import './Settings.css';

const Settings = () => {
  const { t } = useLanguage();

  return (
    <div className="settings-page">
      <div className="settings-header">
        <span className="material-symbols-outlined settings-icon">settings</span>
        <h1 className="settings-title">Settings</h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h2 className="settings-section__title">Appearance & Language</h2>
          <div className="settings-section__items">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>

        <div className="coming-soon coming-soon--inline">
          <p className="coming-soon__subtitle">{t('coming-soon')}</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
