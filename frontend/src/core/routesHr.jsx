import { Navigate } from 'react-router-dom'
import HrLogin from '../apps/HR/login/Login.jsx'
import HrVerifyEmail from '../apps/HR/verify-email/VerifyEmail.jsx'
import { ThemeProvider } from '../apps/HR/context/ThemeContext.jsx'

export const routesHr = [
  {
    path: '/hr/login',
    element: (
      <ThemeProvider>
        <HrLogin />
      </ThemeProvider>
    ),
  },
  {
    path: '/hr/verify-email',
    element: (
      <ThemeProvider>
        <HrVerifyEmail />
      </ThemeProvider>
    ),
  },
]
