// Import all translation files
import { commonTranslations } from '../../../assets/translations/common.js';
import { loginTranslations } from '../../../assets/translations/auth/login.js';
import { signupTranslations } from '../../../assets/translations/auth/signup.js';
import { verificationTranslations } from '../../../assets/translations/auth/verification.js';
import { twofaTranslations } from '../../../assets/translations/auth/twofa.js';
import { step1Translations } from '../../../assets/translations/account-setup/step1.js';
import { step2Translations } from '../../../assets/translations/account-setup/step2.js';
import { step3Translations } from '../../../assets/translations/account-setup/step3.js';
import { step4Translations } from '../../../assets/translations/account-setup/step4.js';
import { step5Translations } from '../../../assets/translations/account-setup/step5.js';
import { step6Translations } from '../../../assets/translations/account-setup/step6.js';
import { step7Translations } from '../../../assets/translations/account-setup/step7.js';
import { step8Translations } from '../../../assets/translations/account-setup/step8.js';
import { sidebarTranslations } from '../../../assets/translations/dashboard/sidebar.js';
import { analyticsTranslations } from '../../../assets/translations/dashboard/analytics.js';
import { profileTranslations } from '../../../assets/translations/dashboard/profile.js';
import { findJobsTranslations } from '../../../assets/translations/dashboard/find-jobs.js';
import { jobDetailTranslations } from '../../../assets/translations/dashboard/job-detail.js';
import { notificationsPageTranslations } from '../../../assets/translations/dashboard/notifications-page.js';
import { mySubmissionsTranslations } from '../../../assets/translations/dashboard/my-submissions.js';
import { takingTranslations } from '../../../assets/translations/quiz/taking.js';

// Merge all translations
export const translations = {
  fr: {
    ...commonTranslations.fr,
    ...loginTranslations.fr,
    ...signupTranslations.fr,
    ...verificationTranslations.fr,
    ...twofaTranslations.fr,
    ...step1Translations.fr,
    ...step2Translations.fr,
    ...step3Translations.fr,
    ...step4Translations.fr,
    ...step5Translations.fr,
    ...step6Translations.fr,
    ...step7Translations.fr,
    ...step8Translations.fr,
    ...sidebarTranslations.fr,
    ...analyticsTranslations.fr,
    ...profileTranslations.fr,
    ...findJobsTranslations.fr,
    ...jobDetailTranslations.fr,
    ...notificationsPageTranslations.fr,
    ...mySubmissionsTranslations.fr,
    ...takingTranslations.fr,
  },
  en: {
    ...commonTranslations.en,
    ...loginTranslations.en,
    ...signupTranslations.en,
    ...verificationTranslations.en,
    ...twofaTranslations.en,
    ...step1Translations.en,
    ...step2Translations.en,
    ...step3Translations.en,
    ...step4Translations.en,
    ...step5Translations.en,
    ...step6Translations.en,
    ...step7Translations.en,
    ...step8Translations.en,
    ...sidebarTranslations.en,
    ...analyticsTranslations.en,
    ...profileTranslations.en,
    ...findJobsTranslations.en,
    ...jobDetailTranslations.en,
    ...notificationsPageTranslations.en,
    ...mySubmissionsTranslations.en,
    ...takingTranslations.en,
  },
};

export const getTranslation = (language, key, data = {}) => {
  let translation = translations[language]?.[key] || key;
  
  // Replace placeholders like {name} with data.name
  Object.keys(data).forEach(placeholder => {
    translation = translation.replace(`{${placeholder}}`, data[placeholder]);
  });
  
  return translation;
};
