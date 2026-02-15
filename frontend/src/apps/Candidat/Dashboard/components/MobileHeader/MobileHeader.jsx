import { useLanguage } from '../../../../../core/useLanguage';
import './MobileHeader.css';
import ThemeToggle from '../../../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../../../components/LanguageToggle/LanguageToggle';

const MobileHeader = ({ onMenuToggle }) => {
  const { t } = useLanguage();

  return (
    <header className="dashboard-mobile-header">
      <button
        type="button"
        className="dashboard-mobile-header__menu"
        onClick={onMenuToggle}
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>
      <div className="dashboard-mobile-header__title">{t('analytics-title')}</div>
      <div className="dashboard-mobile-header__actions">
        <ThemeToggle />
        <LanguageToggle />
      </div>
    </header>
  );
};

export default MobileHeader;
