import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../../core/supabaseClient'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../../../core/useLanguage'
import HRHeader from '../components/HRHeader'
import './TwoFactor.css'

function TwoFactor() {
  const { effectiveTheme } = useTheme()
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const mfaContext = location.state?.mfaContext || 'hr'
  const INPUT_LENGTH = 6
  const [code, setCode] = useState(Array(INPUT_LENGTH).fill(''))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300)
  const inputsRef = useRef([])

  // Countdown timer logic
  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

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

    if (!hasAnyDigit) {
      setError(t('hr-auth-otp-err-empty'))
      return
    }

    // Capture the roles that use Supabase MFA TOTP
    const isMfaRole = mfaContext === 'superadmin' || mfaContext === 'admin'

    if (isMfaRole) {
      setLoading(true)
      setError(null)
      try {
        const factors = await supabase.auth.mfa.listFactors()
        if (factors.error) {
          throw factors.error
        }

        const totpFactor = factors.data?.totp?.[0]
        if (!totpFactor) {
          throw new Error(t('hr-auth-otp-err-no-totp'))
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

        // Succès : Redirection basée sur le rôle
        if (mfaContext === 'superadmin') {
          navigate('/superadmin/dashboard', { replace: true })
        } else {
          navigate('/hr/dashboard', { replace: true })
        }
        return
      } catch (err) {
        console.error('Erreur MFA:', err)
        setError(err?.message || t('hr-auth-otp-err-mfa'))
      } finally {
        setLoading(false)
      }
    } else {
      // Contexte autre : logique OTP e-mail ou autre (à brancher si besoin)
      console.log('OTP soumis :', value)
    }
  }

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const isMfaRole = mfaContext === 'superadmin' || mfaContext === 'admin'

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
                {isMfaRole ? t('hr-auth-otp-title-mfa') : t('hr-auth-otp-title-otp')}
              </h1>
              <p className="otp-subtitle">
                {isMfaRole ? t('hr-auth-otp-sub-mfa') : t('hr-auth-otp-sub-otp')}
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
                    aria-label={t('hr-auth-otp-digit-label', { n: index + 1 })}
                  />
                ))}
              </fieldset>

              <div className="otp-timer">
                <span className="material-symbols-outlined">timer</span>
                <span>
                  {t('hr-auth-otp-timer')} <strong className="otp-timer__value">{formatTime(timeLeft)}</strong>
                </span>
              </div>

              <div className="otp-actions">
                <button type="submit" className="otp-btn otp-btn--primary" disabled={loading}>
                  <span>{loading ? t('hr-auth-otp-btn-verifying') : t('hr-auth-otp-btn-verify')}</span>
                </button>
                <button type="button" className="otp-btn otp-btn--ghost">
                  <span className="material-symbols-outlined">refresh</span>
                  <span>{t('hr-auth-otp-btn-resend')}</span>
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
