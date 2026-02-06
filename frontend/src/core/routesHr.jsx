import { Navigate } from 'react-router-dom'
import HrLogin from '../apps/HR/login/Login.jsx'
import HrVerifyEmail from '../apps/HR/verify-email/VerifyEmail.jsx'
import HrTwoFactor from '../apps/HR/otp/TwoFactor.jsx'
import HrDashboard from '../apps/HR/dashboard/Dashboard.jsx'
import HrProfile from '../apps/HR/profile/Profile.jsx'
import HrSettings from '../apps/HR/settings/Settings.jsx'
import HrResetPassword from '../apps/HR/reset-password/ResetPassword.jsx'
import HrCandidatsList from '../apps/HR/candidats/CandidatsList.jsx'
import HrCandidatDetail from '../apps/HR/candidats/CandidatDetail.jsx'
import CompanyProfile from '../apps/HR/profile/CompanyProfile.jsx'
import CompanyCreation from '../apps/HR/onboarding/CompanyCreation.jsx'
import { ThemeProvider } from '../apps/HR/context/ThemeContext.jsx'

export const routesHr = [
  {
    path: '/hr/candidats',
    element: (
      <ThemeProvider>
        <HrCandidatsList />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/candidats/:id',
    element: (
      <ThemeProvider>
        <HrCandidatDetail />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/entreprise',
    element: (
      <ThemeProvider>
        <CompanyProfile />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/create-company',
    element: (
      <ThemeProvider>
        <CompanyCreation />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/reset-password',
    element: (
      <ThemeProvider>
        <HrResetPassword />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/login',
    element: (
      <ThemeProvider>
        <HrLogin />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/verify-email',
    element: (
      <ThemeProvider>
        <HrVerifyEmail />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/otp',
    element: (
      <ThemeProvider>
        <HrTwoFactor />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/dashboard',
    element: (
      <ThemeProvider>
        <HrDashboard />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/profil',
    element: (
      <ThemeProvider>
        <HrProfile />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/parametres',
    element: (
      <ThemeProvider>
        <HrSettings />
      </ThemeProvider>
    ),
  },
]
