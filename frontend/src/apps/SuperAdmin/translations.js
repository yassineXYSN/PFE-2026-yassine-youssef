import { commonTranslations } from '../../assets/translations/common.js';
import { superAdminDashboardTranslations } from '../../assets/translations/superadmin/dashboard.js';

export const superAdminTranslations = {
  fr: {
    ...commonTranslations.fr,
    ...superAdminDashboardTranslations.fr,
  },
  en: {
    ...commonTranslations.en,
    ...superAdminDashboardTranslations.en,
  },
};
