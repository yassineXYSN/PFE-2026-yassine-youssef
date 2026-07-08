import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../../core/api'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../../../core/useLanguage'
import HRHeader from '../components/HRHeader'
import './VerifyEmail.css'

function VerifyEmail() {
    const { effectiveTheme } = useTheme()
    const { t } = useLanguage()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')

    const [status, setStatus] = useState(token ? 'loading' : 'missing')
    const [errorMessage, setErrorMessage] = useState('')
    const requestedTokenRef = useRef(null)

    useEffect(() => {
        if (!token) return
        // verify-account is single-use and non-idempotent: consuming a token twice
        // legitimately fails the second time. StrictMode intentionally re-runs this
        // effect once in dev, so guard on the token itself (not just a "cancelled"
        // flag) to make sure the request only ever fires once per token.
        if (requestedTokenRef.current === token) return
        requestedTokenRef.current = token

        let cancelled = false
        apiFetch('/auth/verify-account', {
            method: 'POST',
            body: JSON.stringify({ token }),
        })
            .then(() => {
                if (cancelled) return
                setStatus('success')
                setTimeout(() => navigate('/hr/login'), 3000)
            })
            .catch((err) => {
                if (cancelled) return
                setErrorMessage(err.message)
                setStatus('error')
            })

        return () => { cancelled = true }
    }, [token])

    const renderContent = () => {
        if (status === 'missing') {
            return (
                <>
                    <div className="verify-icon">
                        <span className="material-symbols-outlined">link_off</span>
                    </div>
                    <div className="verify-header">
                        <h1 className="verify-title">{t('hr-verify-missing-title')}</h1>
                        <p className="verify-text">{t('hr-verify-missing-desc')}</p>
                    </div>
                </>
            )
        }
        if (status === 'loading') {
            return (
                <>
                    <div className="verify-icon">
                        <span className="material-symbols-outlined">hourglass_top</span>
                    </div>
                    <div className="verify-header">
                        <h1 className="verify-title">{t('hr-verify-loading-title')}</h1>
                        <p className="verify-text">{t('hr-verify-loading-desc')}</p>
                    </div>
                </>
            )
        }
        if (status === 'success') {
            return (
                <>
                    <div className="verify-icon">
                        <span className="material-symbols-outlined">check_circle</span>
                    </div>
                    <div className="verify-header">
                        <h1 className="verify-title">{t('hr-verify-success-title')}</h1>
                        <p className="verify-text">{t('hr-verify-success-desc')}</p>
                    </div>
                    <div className="verify-actions">
                        <button className="verify-submit" onClick={() => navigate('/hr/login')}>
                            {t('hr-verify-btn-login')}
                        </button>
                    </div>
                </>
            )
        }
        return (
            <>
                <div className="verify-icon">
                    <span className="material-symbols-outlined">error</span>
                </div>
                <div className="verify-header">
                    <h1 className="verify-title">{t('hr-verify-error-title')}</h1>
                    <p className="verify-text">{errorMessage}</p>
                </div>
                <div className="verify-actions">
                    <button className="verify-btn-ghost" onClick={() => navigate('/hr/login')}>
                        {t('hr-verify-btn-back')}
                    </button>
                </div>
            </>
        )
    }

    return (
        <div className={`verify-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRHeader />
            <div className="verify-main">
                <div className="verify-card">
                    <div className="verify-card-inner">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VerifyEmail
