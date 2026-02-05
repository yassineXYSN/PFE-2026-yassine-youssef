import { createContext, useState, useEffect, useCallback } from 'react';

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('candidat-language') || 'fr';
  });

  const changeLanguage = useCallback((newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem('candidat-language', newLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
