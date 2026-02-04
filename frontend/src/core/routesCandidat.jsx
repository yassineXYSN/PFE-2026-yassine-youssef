import { Navigate } from 'react-router-dom'
import CandidateLogin from '../apps/Candidat/Login/LoginPage.jsx'
import EmailVerification from '../apps/Candidat/2fapage/EmailVerification.jsx'

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
    path: '/',
    element: <Navigate to="/candidat/login" replace />,
  },
]
