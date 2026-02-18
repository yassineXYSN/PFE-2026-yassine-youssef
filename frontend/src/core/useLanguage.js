import { useState, useEffect } from 'react';
import { translations, getTranslation } from '../apps/Candidat/core/translations';

const LANGUAGE_KEY = 'preferred-language';

export const useLanguage = () => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem(LANGUAGE_KEY) || 'en';
  });

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = (newLanguage) => {
    if (translations[newLanguage]) {
      setLanguage(newLanguage);
    }
  };

  const t = (key) => {
    return getTranslation(language, key);
  };

  return {
    language,
    changeLanguage,
    t,
  };
};
