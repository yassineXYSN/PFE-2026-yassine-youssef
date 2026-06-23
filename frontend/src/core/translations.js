import { translations as candidatTranslations } from '../apps/Candidat/core/translations';
import { hrTranslations } from '../apps/HR/translations';
import { superAdminTranslations } from '../apps/SuperAdmin/translations';

export const allTranslations = {
  fr: {
    ...candidatTranslations.fr,
    ...hrTranslations.fr,
    ...superAdminTranslations.fr,
  },
  en: {
    ...candidatTranslations.en,
    ...hrTranslations.en,
    ...superAdminTranslations.en,
  },
};

export const getTranslation = (language, key, data = {}) => {
  let translation = allTranslations[language]?.[key] || key;
  
  Object.keys(data).forEach(placeholder => {
    translation = translation.replace(`{${placeholder}}`, data[placeholder]);
  });
  
  return translation;
};
