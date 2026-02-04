import { Navigate } from 'react-router-dom'
import CandidateLogin from '../apps/Candidat/Login/LoginPage.jsx'

export const routesCandidature = [
  {
    path: '/candidat/login',
    element: <CandidateLogin />,
  },
  {
    path: '/',
    element: <Navigate to="/candidat/login" replace />,
  },
]
