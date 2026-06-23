import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import SuperAdminSidebar from '../components/SuperAdminSidebar'
import './SuperAdminMfa.css'

function SuperAdminMfa() {
  const { effectiveTheme } = useTheme()
  const navigate = useNavigate()
  const INPUT_LENGTH = 6
  const [code, setCode] = useState(Array(INPUT_LENGTH).fill(''))
  const [error, setError] = useState(null)
  const inputsRef = useRef([])

  useEffect(() => {
    // Si aucune MFA n'est requise, renvoyer vers le dashboard
    const required = sessionStorage.getItem('superadmin-mfa-required')
    if (!required) {
      navigate('/superadmin/dashboard', { replace: true })
      return
    }
    inputsRef.current[0]?.focus()
  }, [navigate])

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

  const handleSubmit = (e) => {
    e.preventDefault()
    const value = code.join('')

    if (value.length !== INPUT_LENGTH) {
      setError('Veuillez saisir le code complet.')
      return
    }

    // Pour l'instant, on accepte n'importe quel code de 6 chiffres
    sessionStorage.removeItem('superadmin-mfa-required')
    navigate('/superadmin/dashboard', { replace: true })
  }

  return (
    <div className={`sa-mfa-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
      <SuperAdminSidebar />

      <main className="sa-mfa-main">
        <section className="sa-mfa-card">
          <div className="sa-mfa-icon">
            <span className="material-symbols-outlined">verified_user</span>
          </div>

          <header className="sa-mfa-head">
            <h1 className="sa-mfa-title">Validation MFA SuperAdmin</h1>
            <p className="sa-mfa-subtitle">
              Entrez le code de sécurité à 6 chiffres envoyé à votre adresse e-mail SuperAdmin.
            </p>
          </header>

          <form className="sa-mfa-form" onSubmit={handleSubmit}>
            {error && <div className="sa-mfa-error">{error}</div>}

            <fieldset className="sa-mfa-inputs">
              {code.map((digit, index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className="sa-mfa-input"
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

            <div className="sa-mfa-actions">
              <button type="submit" className="sa-mfa-btn sa-mfa-btn--primary">
                Valider et continuer
              </button>
              <button
                type="button"
                className="sa-mfa-btn sa-mfa-btn--ghost"
                onClick={() => navigate('/superadmin/dashboard')}
              >
                Annuler
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}

export default SuperAdminMfa

