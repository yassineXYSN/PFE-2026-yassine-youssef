import { commonTranslations } from '../../assets/translations/common.js';
import { quizViewTranslations } from '../../assets/translations/hr/quiz-view.js';
import { applicationTrackTranslations } from '../../assets/translations/hr/application-track.js';
import { hrDashboardTranslations } from '../../assets/translations/hr/dashboard.js';
import { hrManagementTranslations } from '../../assets/translations/hr/management.js';
import { hrDepartmentsTranslations } from '../../assets/translations/hr/departments.js';
import { hrModalsTranslations } from '../../assets/translations/hr/modals.js';
import { hrJobsCandidatesTranslations } from '../../assets/translations/hr/jobs-candidates.js';
import { hrMiscTranslations } from '../../assets/translations/hr/misc.js';
import { hrComponentsTranslations } from '../../assets/translations/hr/components.js';

export const hrTranslations = {
  fr: {
    ...commonTranslations.fr,
    ...quizViewTranslations.fr,
    ...applicationTrackTranslations.fr,
    ...hrDashboardTranslations.fr,
    ...hrManagementTranslations.fr,
    ...hrDepartmentsTranslations.fr,
    ...hrModalsTranslations.fr,
    ...hrJobsCandidatesTranslations.fr,
    ...hrMiscTranslations.fr,
    ...hrComponentsTranslations.fr,
  },
  en: {
    ...commonTranslations.en,
    ...quizViewTranslations.en,
    ...applicationTrackTranslations.en,
    ...hrDashboardTranslations.en,
    ...hrManagementTranslations.en,
    ...hrDepartmentsTranslations.en,
    ...hrModalsTranslations.en,
    ...hrJobsCandidatesTranslations.en,
    ...hrMiscTranslations.en,
    ...hrComponentsTranslations.en,
  },
};

export const getHrTranslation = (language, key, data = {}) => {
  let translation = hrTranslations[language]?.[key] || key;
  
  Object.keys(data).forEach(placeholder => {
    translation = translation.replace(`{${placeholder}}`, data[placeholder]);
  });
  
  return translation;
};
