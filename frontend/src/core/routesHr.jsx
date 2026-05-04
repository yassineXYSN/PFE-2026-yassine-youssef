import { lazy } from 'react'
import { ThemeProvider } from '../apps/HR/context/ThemeContext.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'

const HrLogin = lazy(() => import('../apps/HR/login/Login.jsx'))
const HrVerifyEmail = lazy(() => import('../apps/HR/verify-email/VerifyEmail.jsx'))
const HrTwoFactor = lazy(() => import('../apps/HR/otp/TwoFactor.jsx'))
const HrDashboard = lazy(() => import('../apps/HR/dashboard/Dashboard.jsx'))
const Calendar = lazy(() => import('../apps/HR/calendar/Calendar.jsx'))
const HrProfile = lazy(() => import('../apps/HR/profile/user/Profile.jsx'))
const HrSettings = lazy(() => import('../apps/HR/settings/Settings.jsx'))
const HrResetPassword = lazy(() => import('../apps/HR/reset-password/ResetPassword.jsx'))
const HrCandidatsList = lazy(() => import('../apps/HR/candidats/list/CandidatsList.jsx'))
const HrCandidatDetail = lazy(() => import('../apps/HR/candidats/detail/CandidatDetail.jsx'))
const CompanyProfile = lazy(() => import('../apps/HR/profile/company/CompanyProfile.jsx'))
const Welcome = lazy(() => import('../apps/HR/welcome/Welcome.jsx'))
const CompanyCreation = lazy(() => import('../apps/HR/onboarding/CompanyCreation.jsx'))
const JobOverview = lazy(() => import('../apps/HR/jobs/list/JobOverview.jsx'))
const JobCreate = lazy(() => import('../apps/HR/jobs/create/JobCreate.jsx'))
const JobDetail = lazy(() => import('../apps/HR/jobs/detail/JobDetail.jsx'))
const JobEdit = lazy(() => import('../apps/HR/jobs/edit/JobEdit.jsx'))
const Departments = lazy(() => import('../apps/HR/departments/list/Departments.jsx'))
const DepartmentCreate = lazy(() => import('../apps/HR/departments/create/DepartmentCreate.jsx'))
const DepartmentDetail = lazy(() => import('../apps/HR/departments/detail/DepartmentDetail.jsx'))
const DepartmentEdit = lazy(() => import('../apps/HR/departments/edit/DepartmentEdit.jsx'))
const ApplicationTrack = lazy(() => import('../apps/HR/applications/ApplicationTrack.jsx'))
const HrNotifications = lazy(() => import('../apps/HR/notifications/Notifications.jsx'))
const QuizView = lazy(() => import('../apps/HR/applications/QuizView.jsx'))
const LiveInterview = lazy(() => import('../apps/HR/applications/LiveInterview.jsx'))
const TeamManagement = lazy(() => import('../apps/HR/settings/team/TeamManagement.jsx'))


const hrRoles = ['admin', 'recruiter', 'chef_departement'];
const adminRoles = ['admin', 'superadmin'];

export const routesHr = [
  {
    path: '/hr/interviews/live/:interviewId',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <LiveInterview />
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/team',
    element: (
      <ProtectedRoute allowedRoles={adminRoles}>
        <ThemeProvider>
          <TeamManagement />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/notifications',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <HrNotifications />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
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
      <ProtectedRoute allowedRoles={adminRoles}>
        <ThemeProvider>
          <CompanyProfile />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/create-company',
    element: (
      <ProtectedRoute allowedRoles={adminRoles}>
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
    path: '/hr/calendrier',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <Calendar />
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
      <ProtectedRoute allowedRoles={adminRoles}>
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
      <ProtectedRoute allowedRoles={adminRoles}>
        <ThemeProvider>
          <Departments />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/departement/new',
    element: (
      <ProtectedRoute allowedRoles={adminRoles}>
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
  {
    path: '/hr/applications/:id',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <ApplicationTrack />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/quizzes/:quizId',
    element: (
      <ProtectedRoute allowedRoles={hrRoles}>
        <ThemeProvider>
          <QuizView />
        </ThemeProvider>
      </ProtectedRoute>
    ),
  },
];
