import { useContext } from 'react';
import { LanguageContext } from './LanguageContext';
import { getTranslation } from '../apps/Candidat/core/translations';

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  const { language, changeLanguage } = context;

  const t = (key) => {
    return getTranslation(language, key);
  };

  return {
    language,
    changeLanguage,
    t,
  };
};
