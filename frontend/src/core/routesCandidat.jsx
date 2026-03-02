import { Navigate } from 'react-router-dom'
import CandidateLogin from '../apps/Candidat/Login/LoginPage.jsx'
import EmailVerification from '../apps/Candidat/2fapage/EmailVerification.jsx'
import AccountSetup from '../apps/Candidat/AccountSetup/AccountSetup.jsx'
import Dashboard from '../apps/Candidat/Dashboard/Dashboard.jsx'
import Analytics from '../apps/Candidat/Dashboard/Analytics/Analytics.jsx'
import FindJobs from '../apps/Candidat/Dashboard/FindJobs/FindJobs.jsx'
import JobDetail from '../apps/Candidat/Dashboard/FindJobs/JobDetail.jsx'
import MySubmissions from '../apps/Candidat/Dashboard/MySubmissions/MySubmissions.jsx'
import Notifications from '../apps/Candidat/Dashboard/Notifications/Notifications.jsx'
import Profile from '../apps/Candidat/Dashboard/Profile/ProfilePage.jsx'
import Settings from '../apps/Candidat/Dashboard/Settings/Settings.jsx'
import CandidateProtectedRoute from './auth/CandidateProtectedRoute.jsx'

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
    path: '/candidat/account-setup',
    element: (
      <CandidateProtectedRoute>
        <AccountSetup />
      </CandidateProtectedRoute>
    ),
  },
  {
    path: '/candidat/dashboard',
    element: (
      <CandidateProtectedRoute>
        <Dashboard />
      </CandidateProtectedRoute>
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
]
