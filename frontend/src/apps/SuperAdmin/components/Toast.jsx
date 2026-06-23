import React, { useEffect } from 'react'
import './Toast.css'

/**
 * Toast component
 * @param {{ message: string, type: 'success'|'error'|'info'|'warning', onClose: () => void }} props
 */
function Toast({ message, type = 'info', onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000)
        return () => clearTimeout(timer)
    }, [onClose])

    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info',
    }

    return (
        <div className={`toast toast--${type}`} role="alert">
            <span className="material-symbols-outlined toast__icon">{icons[type]}</span>
            <span className="toast__message">{message}</span>
            <button className="toast__close" onClick={onClose} aria-label="Fermer">
                <span className="material-symbols-outlined">close</span>
            </button>
        </div>
    )
}

/**
 * ToastContainer – place once in your component, renders all toasts
 * @param {{ toasts: Array<{id, message, type}>, removeToast: (id) => void }} props
 */
export function ToastContainer({ toasts, removeToast }) {
    return (
        <div className="toast-container">
            {toasts.map((t) => (
                <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
            ))}
        </div>
    )
}

/**
 * useToast – hook to manage toast state
 * Usage:
 *   const { toasts, addToast, removeToast } = useToast()
 *   addToast('Mon message', 'success')
 */
export function useToast() {
    const [toasts, setToasts] = React.useState([])

    const addToast = React.useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random()
        setToasts((prev) => [...prev, { id, message, type }])
    }, [])

    const removeToast = React.useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    return { toasts, addToast, removeToast }
}

export default Toast
