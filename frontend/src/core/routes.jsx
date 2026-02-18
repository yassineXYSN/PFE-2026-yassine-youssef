import { Navigate } from 'react-router-dom'
import { routesCandidature } from './routesCandidat.jsx'
import { routesHr } from './routesHr.jsx'
import { routesSuperAdmin } from './routesSuperAdmin.jsx'

export const routes = [
  ...routesCandidature,
  ...routesHr,
  ...routesSuperAdmin,
  {
    path: '*',
    element: <Navigate to="/candidat/login" replace />,
  },
]
