import { Navigate } from 'react-router-dom'
import HrLogin from '../apps/HR/login/Login.jsx'
import HrVerifyEmail from '../apps/HR/verify-email/VerifyEmail.jsx'
import HrTwoFactor from '../apps/HR/otp/TwoFactor.jsx'
import HrDashboard from '../apps/HR/dashboard/Dashboard.jsx'
import HrProfile from '../apps/HR/profile/user/Profile.jsx'
import HrSettings from '../apps/HR/settings/Settings.jsx'
import HrResetPassword from '../apps/HR/reset-password/ResetPassword.jsx'
import HrCandidatsList from '../apps/HR/candidats/list/CandidatsList.jsx'
import HrCandidatDetail from '../apps/HR/candidats/detail/CandidatDetail.jsx'
import CompanyProfile from '../apps/HR/profile/company/CompanyProfile.jsx'
import CompanyCreation from '../apps/HR/onboarding/CompanyCreation.jsx'
import JobOverview from '../apps/HR/jobs/list/JobOverview.jsx'
import JobCreate from '../apps/HR/jobs/create/JobCreate.jsx'
import JobDetail from '../apps/HR/jobs/detail/JobDetail.jsx'
import Departments from '../apps/HR/departments/list/Departments.jsx'
import DepartmentCreate from '../apps/HR/departments/create/DepartmentCreate.jsx'
import DepartmentDetail from '../apps/HR/departments/detail/DepartmentDetail.jsx'
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
  {
    path: '/hr/offres',
    element: (
      <ThemeProvider>
        <JobOverview />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/offres/new',
    element: (
      <ThemeProvider>
        <JobCreate />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/offres/:id',
    element: (
      <ThemeProvider>
        <JobDetail />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/departement',
    element: (
      <ThemeProvider>
        <Departments />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/departement/new',
    element: (
      <ThemeProvider>
        <DepartmentCreate />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/departement/:id',
    element: (
      <ThemeProvider>
        <DepartmentDetail />
      </ThemeProvider>
    ),
  },
]
