import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { apiFetch } from '../../../core/api'
import { setAuth } from '../../../core/apiClient'
import './DemoVerify.css'

function DemoVerify() {
  const { effectiveTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const userId = location.state?.userId
  const deviceId = location.state?.deviceId

  const INPUT_LENGTH = 6
  const [code, setCode] = useState(Array(INPUT_LENGTH).fill(''))
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const inputsRef = useRef([])

  useEffect(() => {
    if (!userId || !deviceId) {
      navigate('/hr/login', { replace: true })
      return
    }
    inputsRef.current[0]?.focus()
  }, [userId, deviceId, navigate])

  const handleChange = (index, e) => {
    const value = e.target.value.replace(/\D/g, '')
    const next = [...code]
    next[index] = value.slice(-1)
    setCode(next)
    if (value && index < INPUT_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const next = [...code]
      next[index - 1] = ''
      setCode(next)
      inputsRef.current[index - 1]?.focus()
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus()
      e.preventDefault()
    } else if (e.key === 'ArrowRight' && index < INPUT_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
      e.preventDefault()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const value = code.join('')

    if (value.length !== INPUT_LENGTH) {
      setError('Veuillez saisir le code complet.')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const data = await apiFetch('/auth/demo/verify-code', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, device_id: deviceId, code: value }),
      })

      localStorage.setItem('humatiq_device_id', deviceId)
      setAuth({ access_token: data.access_token, role: data.role, id: data.id, email: data.email })

      if (data.role === 'superadmin') {
        navigate('/superadmin/dashboard')
      } else {
        navigate('/hr/dashboard')
      }
    } catch (err) {
      if (err.status === 400) {
        setError('Code invalide ou expiré.')
      } else {
        setError(err.message || 'Une erreur est survenue.')
      }
      setCode(Array(INPUT_LENGTH).fill(''))
      inputsRef.current[0]?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`demo-verify-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
      <main className="demo-verify-main">
        <section className="demo-verify-card">
          <div className="demo-verify-icon">
            <span className="material-symbols-outlined">visibility_lock</span>
          </div>

          <header className="demo-verify-head">
            <h1 className="demo-verify-title">Accès démo protégé</h1>
            <p className="demo-verify-subtitle">
              Ce compte est un compte démo. Contactez le propriétaire pour obtenir votre code d'accès.
            </p>
          </header>

          <form className="demo-verify-form" onSubmit={handleSubmit}>
            {error && <div className="demo-verify-error">{error}</div>}

            <fieldset className="demo-verify-inputs" disabled={submitting}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className="demo-verify-input"
                  value={digit}
                  onChange={(e) => handleChange(index, e)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  ref={(el) => {
                    inputsRef.current[index] = el
                  }}
                  aria-label={`Chiffre ${index + 1} du code`}
                />
              ))}
            </fieldset>

            <div className="demo-verify-actions">
              <button type="submit" className="demo-verify-btn demo-verify-btn--primary" disabled={submitting}>
                {submitting ? 'Vérification...' : 'Valider et continuer'}
              </button>
              <button
                type="button"
                className="demo-verify-btn demo-verify-btn--ghost"
                onClick={() => navigate('/hr/login')}
                disabled={submitting}
              >
                Retour à la connexion
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}

export default DemoVerify
