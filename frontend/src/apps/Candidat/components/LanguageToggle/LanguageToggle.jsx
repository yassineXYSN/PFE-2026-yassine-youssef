import { useLanguage } from '../../../../core/useLanguage';
import frenchFlag from '../../../../assets/images/flags/france.svg';
import englishFlag from '../../../../assets/images/flags/usa.svg';
import './LanguageToggle.css';

const LanguageToggle = () => {
  const { language, changeLanguage } = useLanguage();

  const toggleLanguage = () => {
    const newLanguage = language === 'fr' ? 'en' : 'fr';
    changeLanguage(newLanguage);
  };

  const label = language === 'fr' ? 'Français' : 'English';
  const flagImage = language === 'fr' ? frenchFlag : englishFlag;

  return (
    <button
      type="button"
      className="language-toggle"
      onClick={toggleLanguage}
      aria-label={`Language: ${label}`}
      title={`Language: ${label}`}
    >
      <img 
        src={flagImage} 
        alt={label}
        className="language-toggle__flag"
      />
      <span className="language-toggle__label">{label}</span>
    </button>
  );
};

export default LanguageToggle;
