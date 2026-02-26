import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../../core/supabaseClient'
import { useTheme } from '../context/ThemeContext'
import HRHeader from '../components/HRHeader'
import './TwoFactor.css'

function TwoFactor() {
  const { effectiveTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const mfaContext = location.state?.mfaContext || 'hr'
  const INPUT_LENGTH = 6
  const [code, setCode] = useState(Array(INPUT_LENGTH).fill(''))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    const value = code.join('')
    const hasAnyDigit = code.some((digit) => digit && digit.length > 0)

    // On ne bloque plus si une case est vide : on laisse Supabase valider le code.
    // On affiche juste un message si vraiment rien n'est saisi.
    if (!hasAnyDigit) {
      setError('Veuillez saisir le code.')
      return
    }

    // Contexte MFA SuperAdmin : on utilise l'API MFA de Supabase
    if (mfaContext === 'superadmin') {
      setLoading(true)
      setError(null)
      try {
        const factors = await supabase.auth.mfa.listFactors()
        if (factors.error) {
          throw factors.error
        }

        const totpFactor = factors.data?.totp?.[0]
        if (!totpFactor) {
          throw new Error("Aucun facteur TOTP configuré pour ce compte.")
        }

        const factorId = totpFactor.id

        const challenge = await supabase.auth.mfa.challenge({ factorId })
        if (challenge.error) {
          throw challenge.error
        }

        const challengeId = challenge.data.id

        const verify = await supabase.auth.mfa.verify({
          factorId,
          challengeId,
          code: value,
        })

        if (verify.error) {
          throw verify.error
        }

        // Succès : on renvoie vers le dashboard SuperAdmin
        navigate('/superadmin/dashboard', { replace: true })
        return
      } catch (err) {
        console.error('Erreur MFA SuperAdmin:', err)
        setError(err?.message || "Échec de la vérification MFA.")
      } finally {
        setLoading(false)
      }
    } else {
      // Contexte HR ou autre : logique OTP spécifique (à brancher plus tard si besoin)
      console.log('OTP soumis :', value)
    }
  }

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  return (
    <div className={`otp-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
      <HRHeader minimal />

      <main className="otp-main">
        <section className="otp-card">
          <div className="otp-card-inner">
            <div className="otp-icon">
              <span className="material-symbols-outlined">lock_person</span>
            </div>

            <div className="otp-head">
              <h1 className="otp-title">
                {mfaContext === 'superadmin'
                  ? 'Validation MFA SuperAdmin'
                  : 'Vérification Sécurisée OTP'}
              </h1>
              <p className="otp-subtitle">
                {mfaContext === 'superadmin'
                  ? "Entrez le code à 6 chiffres généré par votre application d'authentification."
                  : "Entrez le code de sécurité à 6 chiffres envoyé à votre adresse e-mail."}
              </p>
            </div>

            <form className="otp-form" onSubmit={handleSubmit}>
              {error && (
                <div className="otp-error-message">
                  <span className="material-symbols-outlined">error</span>
                  {error}
                </div>
              )}
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

              {mfaContext !== 'superadmin' && (
                <div className="otp-timer">
                  <span className="material-symbols-outlined">timer</span>
                  <span>
                    Le code expire dans <strong className="otp-timer__value">04:59</strong>
                  </span>
                </div>
              )}

              <div className="otp-actions">
                <button type="submit" className="otp-btn otp-btn--primary" disabled={loading}>
                  <span>{loading ? "Vérification..." : "Valider l'authentification"}</span>
                </button>
                <button type="button" className="otp-btn otp-btn--ghost">
                  <span className="material-symbols-outlined">refresh</span>
                  <span>Renvoyer un nouveau code</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}

export default TwoFactor

