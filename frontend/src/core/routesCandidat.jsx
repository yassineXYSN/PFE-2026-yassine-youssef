import { Navigate } from 'react-router-dom'
import CandidateLogin from '../apps/Candidat/Login/LoginPage.jsx'
import EmailVerification from '../apps/Candidat/2fapage/EmailVerification.jsx'
import AccountSetup from '../apps/Candidat/AccountSetup/AccountSetup.jsx'
import Dashboard from '../apps/Candidat/Dashboard/Dashboard.jsx'
import Analytics from '../apps/Candidat/Dashboard/Analytics/Analytics.jsx'
import FindJobs from '../apps/Candidat/Dashboard/FindJobs/FindJobs.jsx'
import JobDetail from '../apps/Candidat/Dashboard/FindJobs/JobDetail.jsx'
import Applications from '../apps/Candidat/Dashboard/Applications/Applications.jsx'
import MySubmissions from '../apps/Candidat/Dashboard/MySubmissions/MySubmissions.jsx'
import ProfilePage from '../apps/Candidat/Dashboard/Profile/ProfilePage.jsx'
import Settings from '../apps/Candidat/Dashboard/Settings/Settings.jsx'
import Notifications from '../apps/Candidat/Dashboard/Notifications/Notifications.jsx'
import ResumeBuilder from '../apps/Candidat/Dashboard/ResumeBuilder/ResumeBuilder.jsx'
import MarketTrends from '../apps/Candidat/Dashboard/MarketTrends/MarketTrends.jsx'
import ComingSoon from '../apps/Candidat/Dashboard/ComingSoon.jsx'

export const routesCandidature = [
  {
    path: '/candidat/login',
    element: <CandidateLogin />,
  },
  {
    path: '/candidat/verify-email',
    element: <EmailVerification />,
  },
  {
    path: '/candidat/setup',
    element: <AccountSetup />,
  },
  {
    path: '/candidat/dashboard',
    element: <Dashboard />,
    children: [
      {
        index: true,
        element: <Analytics />,
      },
      {
        path: 'analytics',
        element: <Analytics />,
      },
      {
        path: 'find-jobs',
        element: <FindJobs />,
      },
      {
        path: 'find-jobs/:id',
        element: <JobDetail />,
      },
      {
        path: 'applications',
        element: <Applications />,
      },
      {
        path: 'submissions',
        element: <MySubmissions />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'notifications',
        element: <Notifications />,
      },
      {
        path: 'resume-builder',
        element: <ResumeBuilder />,
      },
      {
        path: 'market-trends',
        element: <MarketTrends />,
      },
      {
        path: 'coming-soon',
        element: <ComingSoon />,
      },
    ],
  },
  {
    path: '/',
    element: <Navigate to="/candidat/login" replace />,
  },
]
