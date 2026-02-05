// Import all translation files
import { commonTranslations } from '../../../assets/translations/common.js';
import { loginTranslations } from '../../../assets/translations/auth/login.js';
import { signupTranslations } from '../../../assets/translations/auth/signup.js';
import { verificationTranslations } from '../../../assets/translations/auth/verification.js';
import { step1Translations } from '../../../assets/translations/account-setup/step1.js';
import { step2Translations } from '../../../assets/translations/account-setup/step2.js';
import { step3Translations } from '../../../assets/translations/account-setup/step3.js';
import { step4Translations } from '../../../assets/translations/account-setup/step4.js';
import { step5Translations } from '../../../assets/translations/account-setup/step5.js';
import { step6Translations } from '../../../assets/translations/account-setup/step6.js';
import { step7Translations } from '../../../assets/translations/account-setup/step7.js';
import { step8Translations } from '../../../assets/translations/account-setup/step8.js';

// Merge all translations
export const translations = {
  fr: {
    ...commonTranslations.fr,
    ...loginTranslations.fr,
    ...signupTranslations.fr,
    ...verificationTranslations.fr,
    ...step1Translations.fr,
    ...step2Translations.fr,
    ...step3Translations.fr,
    ...step4Translations.fr,
    ...step5Translations.fr,
    ...step6Translations.fr,
    ...step7Translations.fr,
    ...step8Translations.fr,
  },
  en: {
    ...commonTranslations.en,
    ...loginTranslations.en,
    ...signupTranslations.en,
    ...verificationTranslations.en,
    ...step1Translations.en,
    ...step2Translations.en,
    ...step3Translations.en,
    ...step4Translations.en,
    ...step5Translations.en,
    ...step6Translations.en,
    ...step7Translations.en,
    ...step8Translations.en,
  },
};

export const getTranslation = (language, key) => {
  return translations[language]?.[key] || key;
};
