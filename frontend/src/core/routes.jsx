import { Navigate } from 'react-router-dom'
import { routesCandidature } from './routesCandidat.jsx'
import { routesHr } from './routesHr.jsx'

export const routes = [
  ...routesCandidature,
  ...routesHr,
  {
    path: '*',
    element: <Navigate to="/candidat/login" replace />,
  },
]
