import { Navigate } from 'react-router-dom'
import CandidateLogin from '../apps/Candidat/Login/LoginPage.jsx'
import EmailVerification from '../apps/Candidat/2fapage/EmailVerification.jsx'
import AccountSetup from '../apps/Candidat/AccountSetup/AccountSetup.jsx'

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
    element: <AccountSetup />,
  },
  {
    path: '/',
    element: <Navigate to="/candidat/login" replace />,
  },
]
