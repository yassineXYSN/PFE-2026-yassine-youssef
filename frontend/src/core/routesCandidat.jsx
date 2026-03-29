import { Navigate } from 'react-router-dom'
import CandidateLogin from '../apps/Candidat/Login/LoginPage.jsx'
import EmailVerification from '../apps/Candidat/2fapage/EmailVerification.jsx'
import AccountSetup from '../apps/Candidat/AccountSetup/AccountSetup.jsx'
import TestParseCV from '../apps/Candidat/AccountSetup/TestParseCV.jsx'
import Dashboard from '../apps/Candidat/Dashboard/Dashboard.jsx'
import Analytics from '../apps/Candidat/Dashboard/Analytics/Analytics.jsx'
import FindJobs from '../apps/Candidat/Dashboard/FindJobs/FindJobs.jsx'
import JobDetail from '../apps/Candidat/Dashboard/FindJobs/JobDetail.jsx'
import MySubmissions from '../apps/Candidat/Dashboard/MySubmissions/MySubmissions.jsx'
import Notifications from '../apps/Candidat/Dashboard/Notifications/Notifications.jsx'
import Profile from '../apps/Candidat/Dashboard/Profile/ProfilePage.jsx'
import Settings from '../apps/Candidat/Dashboard/Settings/Settings.jsx'
import TwoFAChoice from '../apps/Candidat/Login/TwoFAChoice.jsx'
import TwoFAVerify from '../apps/Candidat/Login/TwoFAVerify.jsx'
import QuizTakingPage from '../apps/Candidat/Quiz/QuizTakingPage.jsx'
import InterviewSelection from '../apps/Candidat/Interviews/InterviewSelection.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'

export const routesCandidature = [
  {
    path: '/candidat/login',
    element: <CandidateLogin />,
  },
  {
    path: '/candidat/email-verification',
    element: <EmailVerification />,
  },
  {
    path: '/candidat/test-parse-cv',
    element: <TestParseCV />,
  },
  {
    path: '/candidat/2fa-choose',
    element: <TwoFAChoice />,
  },
  {
    path: '/candidat/2fa-verify',
    element: <TwoFAVerify />,
  },
  {
    path: '/candidat/account-setup',
    element: (
      <ProtectedRoute loginPath="/candidat/login" redirectIfRole={{ admin: '/hr/dashboard', recruiter: '/hr/dashboard', chef_departement: '/hr/dashboard', superadmin: '/superadmin/dashboard' }}>
        <AccountSetup />
      </ProtectedRoute>
    ),
  },
  {
    path: '/candidat/dashboard',
    element: (
      <ProtectedRoute loginPath="/candidat/login" redirectIfRole={{ admin: '/hr/dashboard', recruiter: '/hr/dashboard', chef_departement: '/hr/dashboard', superadmin: '/superadmin/dashboard' }}>
        <Dashboard />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Analytics /> },
      { path: 'find-jobs', element: <FindJobs /> },
      { path: 'find-jobs/:jobId', element: <JobDetail /> },
      { path: 'my-submissions', element: <MySubmissions /> },
      { path: 'notifications', element: <Notifications /> },
      { path: 'profile', element: <Profile /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
  {
    path: '/candidat/quiz/:quizId',
    element: (
      <ProtectedRoute loginPath="/candidat/login" redirectIfRole={{ admin: '/hr/dashboard', recruiter: '/hr/dashboard', chef_departement: '/hr/dashboard', superadmin: '/superadmin/dashboard' }}>
        <QuizTakingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/candidat/interviews/select/:applicationId',
    element: (
      <ProtectedRoute loginPath="/candidat/login" redirectIfRole={{ admin: '/hr/dashboard', recruiter: '/hr/dashboard', chef_departement: '/hr/dashboard', superadmin: '/superadmin/dashboard' }}>
        <InterviewSelection />
      </ProtectedRoute>
    ),
  },
]
