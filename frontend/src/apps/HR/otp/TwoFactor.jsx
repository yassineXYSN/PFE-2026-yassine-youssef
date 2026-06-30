import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function TwoFactor() {
  const navigate = useNavigate()

  useEffect(() => {
    // MFA has been removed — redirect to dashboard
    navigate('/hr/dashboard', { replace: true })
  }, [navigate])

  return null
}

export default TwoFactor
