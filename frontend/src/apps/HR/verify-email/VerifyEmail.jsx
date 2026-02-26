import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../../core/supabaseClient'
import { useTheme } from '../context/ThemeContext'
import HRHeader from '../components/HRHeader'
import './VerifyEmail.css'

function VerifyEmail() {
    const INPUT_LENGTH = 6
    const [code, setCode] = useState(Array(INPUT_LENGTH).fill(''))
    const inputsRef = useRef([])
    const { effectiveTheme } = useTheme()
    const location = useLocation()
    const navigate = useNavigate()
    const mode = location.state?.mode || 'default'
    const email = location.state?.email || ''
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const handleChange = (index, e) => {
        const value = e.target.value.replace(/\D/g, '')
        if (!value) {
            updateCode(index, '')
            return
        }

        const nextCode = [...code]
        nextCode[index] = value[value.length - 1]
        setCode(nextCode)

        if (index < INPUT_LENGTH - 1 && inputsRef.current[index + 1]) {
            inputsRef.current[index + 1].focus()
        }
    }

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            e.preventDefault()
            const prevIndex = index - 1
            updateCode(prevIndex, '')
            inputsRef.current[prevIndex]?.focus()
        } else if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault()
            inputsRef.current[index - 1]?.focus()
        } else if (e.key === 'ArrowRight' && index < INPUT_LENGTH - 1) {
            e.preventDefault()
            inputsRef.current[index + 1]?.focus()
        }
    }

    const updateCode = (index, value) => {
        const nextCode = [...code]
        nextCode[index] = value
        setCode(nextCode)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const joined = code.join('')

        if (!joined) {
            setError('Veuillez saisir le code reçu.')
            return
        }

        // Mode passwordless : vérifier le code reçu par email via Supabase
        if (mode === 'passwordless' && email) {
            setLoading(true)
            setError(null)
            try {
                const { data, error: verifyError } = await supabase.auth.verifyOtp({
                    email,
                    token: joined,
                    type: 'email',
                })

                if (verifyError) {
                    throw verifyError
                }

                // Une fois connecté, récupérer le rôle et rediriger comme dans le login
                const userId = data?.session?.user?.id
                if (userId) {
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', userId)
                        .single()

                    if (profileError) {
                        throw profileError
                    }

                    localStorage.setItem('userRole', profileData.role)

                    if (profileData.role === 'superadmin') {
                        navigate('/superadmin/dashboard', { replace: true })
                    } else {
                        navigate('/hr/dashboard', { replace: true })
                    }
                    return
                }
            } catch (err) {
                console.error('Erreur vérification email OTP:', err)
                setError("Code invalide ou expiré. Veuillez réessayer.")
            } finally {
                setLoading(false)
            }
        } else {
            // Autres scénarios : garder le comportement de base (à brancher plus tard si besoin)
            console.log('Code saisi :', joined)
        }
    }

    return (
        <div className={`verify-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRHeader minimal />

            <main className="verify-main">
                <section className="verify-card">
                    <div className="verify-card-inner">
                        <div className="verify-icon">
                            <span className="material-symbols-outlined">mark_email_read</span>
                        </div>

                        <header className="verify-header">
                            <h1 className="verify-title">Vérifiez votre boîte mail</h1>
                            <p className="verify-text">
                                Nous avons envoyé un code à 6 chiffres à{' '}
                                <span className="verify-email">{email || 'votre adresse email'}</span>
                            </p>
                        </header>

                        <form className="verify-form" onSubmit={handleSubmit}>
                            {error && (
                                <div className="verify-error-message">
                                    <span className="material-symbols-outlined">error</span>
                                    {error}
                                </div>
                            )}
                            <fieldset className="verify-otp">
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        className="verify-otp-input"
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

                            <div className="verify-actions">
                                <button type="submit" className="verify-submit" disabled={loading}>
                                    <span>{loading ? 'Vérification...' : 'Vérifier le code'}</span>
                                </button>

                                <button type="button" className="verify-btn-ghost">
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

export default VerifyEmail

