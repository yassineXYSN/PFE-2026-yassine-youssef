import { commonTranslations } from '../../assets/translations/common.js';
import { quizViewTranslations } from '../../assets/translations/hr/quiz-view.js';
import { applicationTrackTranslations } from '../../assets/translations/hr/application-track.js';

export const hrTranslations = {
  fr: {
    ...commonTranslations.fr,
    ...quizViewTranslations.fr,
    ...applicationTrackTranslations.fr,
  },
  en: {
    ...commonTranslations.en,
    ...quizViewTranslations.en,
    ...applicationTrackTranslations.en,
  },
};

export const getHrTranslation = (language, key, data = {}) => {
  let translation = hrTranslations[language]?.[key] || key;
  
  Object.keys(data).forEach(placeholder => {
    translation = translation.replace(`{${placeholder}}`, data[placeholder]);
  });
  
  return translation;
};
