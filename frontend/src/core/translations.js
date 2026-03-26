import { translations as candidatTranslations } from '../apps/Candidat/core/translations';
import { hrTranslations } from '../apps/HR/translations';

export const allTranslations = {
  fr: {
    ...candidatTranslations.fr,
    ...hrTranslations.fr,
  },
  en: {
    ...candidatTranslations.en,
    ...hrTranslations.en,
  },
};

export const getTranslation = (language, key, data = {}) => {
  let translation = allTranslations[language]?.[key] || key;
  
  Object.keys(data).forEach(placeholder => {
    translation = translation.replace(`{${placeholder}}`, data[placeholder]);
  });
  
  return translation;
};
