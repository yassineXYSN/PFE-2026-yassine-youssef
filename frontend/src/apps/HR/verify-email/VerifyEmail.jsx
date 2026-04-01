import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../../core/supabaseClient'
import { apiFetch } from '../../../core/api'
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
    const [resendStatus, setResendStatus] = useState({ loading: false, message: '', type: '' })

    const handleResend = async () => {
        if (!email) return;
        setResendStatus({ loading: true, message: '', type: '' });

        try {
            const { error: resendError } = await supabase.auth.resend({
                type: mode === 'passwordless' ? 'magiclink' : 'signup',
                email: email,
            });

            if (resendError) {
                if (resendError.message.includes('rate limit') || resendError.message.includes('after')) {
                    throw new Error("Veuillez patienter avant de demander un nouveau code.");
                }
                throw resendError;
            }

            setResendStatus({
                loading: false,
                message: 'Un nouveau code a été envoyé !',
                type: 'success'
            });

            // Clear success message after 5 seconds
            setTimeout(() => setResendStatus({ loading: false, message: '', type: '' }), 5000);
        } catch (err) {
            setResendStatus({
                loading: false,
                message: err.message || "Erreur lors de l'envoi du code.",
                type: 'error'
            });
        }
    };

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

    const handlePaste = (e) => {
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, INPUT_LENGTH)
        if (!pasted) return

        const nextCode = Array(INPUT_LENGTH).fill('')
        pasted.split('').forEach((char, i) => {
            nextCode[i] = char
        })
        setCode(nextCode)

        // Focus la dernière box remplie (ou la suivante)
        const lastFilledIndex = Math.min(pasted.length, INPUT_LENGTH - 1)
        inputsRef.current[lastFilledIndex]?.focus()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const joined = code.join('')

        if (!joined) {
            setError('Veuillez saisir le code reçu.')
            return
        }

        // Mode passwordless ou Signup Verification : vérifier le code reçu par email via Supabase
        if ((mode === 'passwordless' || mode === 'signup_verification') && email) {
            setLoading(true)
            setError(null)
            try {
                // Type 'magiclink' pour le login OTP, type 'signup' pour la vérification du compte
                const verifyType = mode === 'signup_verification' ? 'signup' : 'magiclink'

                const { data, error: verifyError } = await supabase.auth.verifyOtp({
                    email,
                    token: joined,
                    type: verifyType,
                })

                if (verifyError) {
                    throw verifyError
                }

                // Une fois connecté/vérifié, récupérer le rôle et rediriger
                const userId = data?.user?.id || data?.session?.user?.id
                const userObj = data?.user || data?.session?.user

                if (userId) {
                    let profileData = null;
                    try {
                        profileData = await apiFetch(`/profiles/${userId}`);
                    } catch (profileError) {
                        // Fallback for SuperAdmin or Missing Profile: attempt auto-repair sync
                        const userMetadata = userObj?.user_metadata || userObj?.app_metadata;
                        const userRole = userMetadata?.role;
                        const companyId = userMetadata?.company_id || userMetadata?.companyId;

                        if (userRole && companyId && profileError.message?.includes('not found')) {
                            console.log("Attempting auto-repair of profile sync in VerifyEmail...");
                            try {
                                profileData = await apiFetch('/profiles', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        id: userId,
                                        email: userObj.email,
                                        first_name: userMetadata.first_name || userMetadata.firstName || 'Admin',
                                        last_name: userMetadata.last_name || userMetadata.lastName || 'User',
                                        role: userRole,
                                        company_id: companyId,
                                        status: 'active'
                                    })
                                });
                                console.log("Auto-repair successful in VerifyEmail!");
                            } catch (syncErr) {
                                console.error("Auto-repair failed in VerifyEmail:", syncErr);
                                setError(`Erreur critique de synchronisation : ${syncErr.message}`);
                                return;
                            }
                        } else if (userRole === 'superadmin') {
                            profileData = {
                                id: userId,
                                role: 'superadmin',
                                status: 'active',
                                email: userObj?.email
                            };
                        } else {
                            setError(`Votre profil n'a pas pu être trouvé dans la base de données MongoDB. Erreur: ${profileError.message}`);
                            return;
                        }
                    }

                    // Si c'était une vérification de compte, on passe le statut à 'active' dans MongoDB
                    if (mode === 'signup_verification' && profileData.status === 'pending') {
                        try {
                            // Partially update status - using full profile PUT for robustness if needed, 
                            // but our backend supports PUT /{id} with ProfileUpdate
                            await apiFetch(`/profiles/${userId}`, {
                                method: 'PUT',
                                body: JSON.stringify({ status: 'active' })
                            });
                            profileData.status = 'active';
                        } catch (updateError) {
                            console.error('Erreur mise à jour statut profil via backend:', updateError);
                        }
                    }

                    localStorage.setItem('userRole', profileData.role)

                    // Onboarding Bypass: if company already set up, avoid redirecting user to onboarding
                    if (!profileData.preferences?.onboarding_done && profileData.company_id) {
                        try {
                            const company = await apiFetch(`/companies/${profileData.company_id}`);
                            if (company?.onboarding_done) {
                                if (!profileData.preferences) profileData.preferences = {};
                                profileData.preferences.onboarding_done = true;
                                // Background sync
                                apiFetch(`/profiles/${userId}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ preferences: profileData.preferences })
                                }).catch(e => console.warn('Silent onboarding sync failed:', e));
                            }
                        } catch (err) {
                            console.warn('Failed to check company onboarding status:', err.message);
                        }
                    }

                    if (profileData.role === 'superadmin') {
                        navigate('/superadmin/dashboard', { replace: true })
                    } else {
                        const needsOnboarding = !profileData.preferences?.onboarding_done;
                        navigate(needsOnboarding ? '/hr/welcome' : '/hr/dashboard', { replace: true })
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

                            {resendStatus.message && (
                                <div className="verify-error-message" style={{
                                    backgroundColor: resendStatus.type === 'success' ? '#dcfce7' : '#fee2e2',
                                    color: resendStatus.type === 'success' ? '#166534' : '#ef4444',
                                    borderColor: resendStatus.type === 'success' ? '#bbf7d0' : '#fecaca'
                                }}>
                                    <span className="material-symbols-outlined">
                                        {resendStatus.type === 'success' ? 'check_circle' : 'error'}
                                    </span>
                                    {resendStatus.message}
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
                                        onPaste={handlePaste}
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

                                <button
                                    type="button"
                                    className="verify-btn-ghost"
                                    onClick={handleResend}
                                    disabled={resendStatus.loading || loading}
                                >
                                    <span className="material-symbols-outlined">
                                        {resendStatus.loading ? 'sync' : 'refresh'}
                                    </span>
                                    <span>
                                        {resendStatus.loading ? 'Envoi en cours...' : 'Renvoyer un nouveau code'}
                                    </span>
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

