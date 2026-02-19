import { useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import HRHeader from '../components/HRHeader'
import './VerifyEmail.css'

function VerifyEmail() {
    const INPUT_LENGTH = 6
    const [code, setCode] = useState(Array(INPUT_LENGTH).fill(''))
    const inputsRef = useRef([])
    const { effectiveTheme } = useTheme()

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

    const handleSubmit = (e) => {
        e.preventDefault()
        const joined = code.join('')
        // TODO: appel API de vérification
        console.log('Code saisi :', joined)
    }

    return (
        <div className={`verify-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRHeader minimal />

            <main className="verify-main">
                <section className="verify-card">
                    <div className="verify-icon">
                        <span className="material-symbols-outlined">mark_email_read</span>
                    </div>

                    <header className="verify-header">
                        <h1 className="verify-title">Vérifiez votre boîte mail</h1>
                        <p className="verify-text">
                            Nous avons envoyé un code à 6 chiffres à{' '}
                            <span className="verify-email">alexandre@example.com</span>
                            {/* TODO: remplacer par l&apos;email réel (prop ou contexte) */}
                        </p>
                    </header>

                    <form className="verify-form" onSubmit={handleSubmit}>
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
                            <button type="submit" className="verify-submit">
                                <span>Vérifier le code</span>
                            </button>

                            <button type="button" className="verify-btn-ghost">
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

export default VerifyEmail

