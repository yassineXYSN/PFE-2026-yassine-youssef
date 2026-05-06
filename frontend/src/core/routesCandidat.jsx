import { lazy } from 'react'
import ProtectedRoute from './auth/ProtectedRoute.jsx'

const CandidateLogin = lazy(() => import('../apps/Candidat/Login/LoginPage.jsx'))
const EmailVerification = lazy(() => import('../apps/Candidat/2fapage/EmailVerification.jsx'))
const AccountSetup = lazy(() => import('../apps/Candidat/AccountSetup/AccountSetup.jsx'))
const TestParseCV = lazy(() => import('../apps/Candidat/AccountSetup/TestParseCV.jsx'))
const Dashboard = lazy(() => import('../apps/Candidat/Dashboard/Dashboard.jsx'))
const Analytics = lazy(() => import('../apps/Candidat/Dashboard/Analytics/Analytics.jsx'))
const FindJobs = lazy(() => import('../apps/Candidat/Dashboard/FindJobs/FindJobs.jsx'))
const JobDetail = lazy(() => import('../apps/Candidat/Dashboard/FindJobs/JobDetail.jsx'))
const MySubmissions = lazy(() => import('../apps/Candidat/Dashboard/MySubmissions/MySubmissions.jsx'))
const Interviews = lazy(() => import('../apps/Candidat/Dashboard/Interviews/Interviews.jsx'))
const Notifications = lazy(() => import('../apps/Candidat/Dashboard/Notifications/Notifications.jsx'))
const Profile = lazy(() => import('../apps/Candidat/Dashboard/Profile/ProfilePage.jsx'))
const Settings = lazy(() => import('../apps/Candidat/Dashboard/Settings/Settings.jsx'))
const TwoFAChoice = lazy(() => import('../apps/Candidat/Login/TwoFAChoice.jsx'))
const TwoFAVerify = lazy(() => import('../apps/Candidat/Login/TwoFAVerify.jsx'))
const QuizTakingPage = lazy(() => import('../apps/Candidat/Quiz/QuizTakingPage.jsx'))
const InterviewSelection = lazy(() => import('../apps/Candidat/Interviews/InterviewSelection.jsx'))
const InterviewRoom = lazy(() => import('../apps/Candidat/Interviews/InterviewRoom.jsx'))
const ApplicationDetail = lazy(() => import('../apps/Candidat/Dashboard/ApplicationDetail/ApplicationDetail.jsx'))

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
      { path: 'interviews', element: <Interviews /> },
      { path: 'applications/:applicationId', element: <ApplicationDetail /> },
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
  {
    path: '/candidat/interviews/room/:interviewId',
    element: (
      <ProtectedRoute loginPath="/candidat/login" redirectIfRole={{ admin: '/hr/dashboard', recruiter: '/hr/dashboard', chef_departement: '/hr/dashboard', superadmin: '/superadmin/dashboard' }}>
        <InterviewRoom />
      </ProtectedRoute>
    ),
  },
]
