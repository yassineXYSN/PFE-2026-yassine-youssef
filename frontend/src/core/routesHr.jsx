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
import Welcome from '../apps/HR/welcome/Welcome.jsx'
import CompanyCreation from '../apps/HR/onboarding/CompanyCreation.jsx'
import JobOverview from '../apps/HR/jobs/list/JobOverview.jsx'
import JobCreate from '../apps/HR/jobs/create/JobCreate.jsx'
import JobDetail from '../apps/HR/jobs/detail/JobDetail.jsx'
import JobEdit from '../apps/HR/jobs/edit/JobEdit.jsx'
import Departments from '../apps/HR/departments/list/Departments.jsx'
import DepartmentCreate from '../apps/HR/departments/create/DepartmentCreate.jsx'
import DepartmentDetail from '../apps/HR/departments/detail/DepartmentDetail.jsx'
import DepartmentEdit from '../apps/HR/departments/edit/DepartmentEdit.jsx'
import { ThemeProvider } from '../apps/HR/context/ThemeContext.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'

const hrRoles = ['admin', 'recruiter', 'chef_departement'];

export const routesHr = [
  {
    path: '/hr/welcome',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <Welcome />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/candidats',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <HrCandidatsList />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/candidats/:id',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <HrCandidatDetail />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/entreprise',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <CompanyProfile />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/create-company',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <CompanyCreation />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/reset-password',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <HrResetPassword />
        </ThemeProvider>
      </ProtectedRoute>
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
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <HrTwoFactor />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/dashboard',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <HrDashboard />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/profil',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <HrProfile />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/parametres',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <HrSettings />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/offres',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <JobOverview />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/offres/new',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <JobCreate />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/offres/:id',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <JobDetail />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/offres/:id/edit',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <JobEdit />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/departement',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <Departments />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/departement/new',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <DepartmentCreate />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/departement/:id',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <DepartmentDetail />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/departement/:id/edit',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <DepartmentEdit />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
];
