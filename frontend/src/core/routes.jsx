import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getUserRole } from './api'
import { getToken } from './apiClient'
import { routesCandidature } from './routesCandidat.jsx'
import { routesHr } from './routesHr.jsx'
import { routesSuperAdmin } from './routesSuperAdmin.jsx'
import QuizDashboard from '../components/quiz/QuizDashboard.jsx'

function SmartRedirect() {
  const [target, setTarget] = useState(null)

  useEffect(() => {
    const detectRole = async () => {
      try {
        if (getToken()) {
          const role = await getUserRole()
          if (role === 'superadmin') {
            setTarget('/superadmin/dashboard')
            return
          }
          if (['admin', 'recruiter', 'chef_departement'].includes(role)) {
            setTarget('/hr/dashboard')
            return
          }
          setTarget('/candidat/dashboard')
          return
        }
      } catch {
        // No token / request failed
      }
      setTarget('/candidat/login')
    }
    detectRole()
  }, [])

  if (!target) return null
  return <Navigate to={target} replace />
}

export const routes = [
  ...routesCandidature,
  ...routesHr,
  ...routesSuperAdmin,
  {
    path: '/quizzes',
    element: <QuizDashboard />,
  },
  {
    path: '*',
    element: <SmartRedirect />,
  },
]
