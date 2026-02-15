import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import HRHeader from '../components/HRHeader'
import './TwoFactor.css'

function TwoFactor() {
  const { effectiveTheme } = useTheme()
  const INPUT_LENGTH = 6
  const [code, setCode] = useState(Array(INPUT_LENGTH).fill(''))
  const inputsRef = useRef([])

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
    // TODO: appeler l’API de vérification OTP
    console.log('OTP soumis :', value)
  }

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  return (
    <div className={`otp-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
      <HRHeader minimal />

      <main className="otp-main">
        <section className="otp-card">
          <div className="otp-icon">
            <span className="material-symbols-outlined">lock_person</span>
          </div>

          <div className="otp-head">
            <h1 className="otp-title">Vérification Sécurisée OTP</h1>
            <p className="otp-subtitle">
              Entrez le code de sécurité à 6 chiffres envoyé à votre adresse e-mail.
            </p>
          </div>

          <form className="otp-form" onSubmit={handleSubmit}>
            <fieldset className="otp-inputs">
              {code.map((digit, index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className="otp-input"
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

            <div className="otp-timer">
              <span className="material-symbols-outlined">timer</span>
              <span>
                Le code expire dans <strong className="otp-timer__value">04:59</strong>
              </span>
            </div>

            <div className="otp-actions">
              <button type="submit" className="otp-btn otp-btn--primary">
                <span>Valider l&apos;authentification</span>
              </button>
              <button type="button" className="otp-btn otp-btn--ghost">
                <span className="material-symbols-outlined">refresh</span>
                <span>Renvoyer un nouveau code</span>
              </button>
            </div>
          </form>
        </section>
      </main>


    </div>
  )
}

export default TwoFactor

