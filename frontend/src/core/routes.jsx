import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { getUserRole } from './api'
import { routesCandidature } from './routesCandidat.jsx'
import { routesHr } from './routesHr.jsx'
import { routesSuperAdmin } from './routesSuperAdmin.jsx'
import QuizDashboard from '../components/quiz/QuizDashboard.jsx'

function SmartRedirect() {
  const [target, setTarget] = useState(null)

  useEffect(() => {
    const detectRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const role = await getUserRole(session)
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
        // No session
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
