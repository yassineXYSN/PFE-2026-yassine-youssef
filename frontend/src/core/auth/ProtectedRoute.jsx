import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken, apiFetch } from '../apiClient';

const ProtectedRoute = ({ children, allowedRoles, loginPath, redirectIfRole }) => {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [roleRedirect, setRoleRedirect] = useState(null);
    const location = useLocation();

    const getLoginRedirect = () => {
        if (loginPath) return loginPath;
        if (location.pathname.startsWith('/candidat')) return '/candidat/login';
        return '/hr/login';
    };

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = getToken();
                if (!token) {
                    setAuthorized(false);
                    setLoading(false);
                    return;
                }

                let role = null;
                if ((allowedRoles && allowedRoles.length > 0) || (redirectIfRole && Object.keys(redirectIfRole).length > 0)) {
                    const user = await apiFetch('/auth/me');
                    role = user?.role ?? null;
                }

                if (redirectIfRole && role) {
                    for (const [r, path] of Object.entries(redirectIfRole)) {
                        if (role === r) {
                            setRoleRedirect(path);
                            setLoading(false);
                            return;
                        }
                    }
                }

                if (allowedRoles && allowedRoles.length > 0) {
                    if (role === 'superadmin') {
                        setAuthorized(true);
                    } else if (!allowedRoles.includes(role)) {
                        setAuthorized(false);
                    } else {
                        setAuthorized(true);
                    }
                } else {
                    setAuthorized(true);
                }
            } catch {
                setAuthorized(false);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [allowedRoles, redirectIfRole, location.pathname]);

    if (loading) {
        const isHrRoute = location.pathname.startsWith('/hr') || location.pathname.startsWith('/superadmin');
        const isCandidat = location.pathname.startsWith('/candidat');

        if (isHrRoute) {
            return (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'var(--hr-bg, #ffffff)',
                    color: 'var(--hr-text, #171717)',
                    fontFamily: '"Manrope", system-ui, sans-serif',
                }}>
                    <style>{`
                        :root { --hr-bg: #ffffff; --hr-text: #171717; }
                        :root[data-theme='dark'] { --hr-bg: #09090b; --hr-text: #f5f5f5; }
                    `}</style>
                    <div style={{
                        width: '100%',
                        maxWidth: '240px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.25rem'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '2px',
                            background: 'rgba(0, 0, 0, 0.05)',
                            borderRadius: '1px',
                            overflow: 'hidden',
                            position: 'relative'
                        }} className="hr-loader-track">
                            <style>{`
                                .hr-loader-track { background: rgba(0,0,0,0.05) !important; }
                                :root[data-theme='dark'] .hr-loader-track { background: rgba(255,255,255,0.1) !important; }
                            `}</style>
                            <div style={{
                                position: 'absolute',
                                height: '100%',
                                background: 'var(--hr-accent)',
                                animation: 'hr-linear-progress 1.5s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite'
                            }} />
                        </div>
                        <p style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            opacity: 0.6,
                            margin: 0
                        }}>Vérification de session...</p>
                    </div>
                </div>
            );
        }

        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: isCandidat ? 'row' : 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: isCandidat ? '0' : '1.5rem',
                backgroundColor: 'var(--protected-route-bg, #f6f6f8)',
                color: 'var(--protected-route-color, #0d101b)',
                fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                overflow: 'hidden',
            }}>
                <style>{`
                    :root { --protected-route-bg: #f6f6f8; --protected-route-color: #0d101b; }
                    :root[data-theme='dark'] { --protected-route-bg: #0b1020; --protected-route-color: #e5e7eb; }
                    @keyframes pr-spin { to { transform: rotate(360deg); } }
                    @keyframes pr-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }

                    .skeleton-side { width: 280px; height: 100%; border-right: 1px solid rgba(148, 163, 184, 0.1); padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem; flex-shrink: 0; }
                    .skeleton-main { flex: 1; height: 100%; padding: 2.5rem; display: flex; flex-direction: column; gap: 2rem; }
                    .skeleton-item { background: rgba(139, 92, 246, 0.08); border-radius: 12px; animation: pr-pulse 1.5s ease-in-out infinite; }
                    .skeleton-logo { width: 40px; height: 40px; border-radius: 10px; margin-bottom: 1rem; }
                    .skeleton-nav { width: 100%; height: 44px; border-radius: 8px; }
                    .skeleton-header { width: 100%; height: 60px; border-radius: 16px; margin-bottom: 1rem; }
                    .skeleton-card-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
                    .skeleton-card { height: 160px; border-radius: 20px; }
                `}</style>

                {isCandidat ? (
                    <>
                        <div className="skeleton-side">
                            <div className="skeleton-item skeleton-logo" />
                            <div className="skeleton-item skeleton-nav" />
                            <div className="skeleton-item skeleton-nav" />
                            <div className="skeleton-item skeleton-nav" />
                            <div className="skeleton-item skeleton-nav" />
                        </div>
                        <div className="skeleton-main">
                            <div className="skeleton-item skeleton-header" />
                            <div className="skeleton-card-row">
                                <div className="skeleton-item skeleton-card" />
                                <div className="skeleton-item skeleton-card" />
                                <div className="skeleton-item skeleton-card" />
                            </div>
                            <div className="skeleton-item" style={{ flex: 1, borderRadius: '24px' }} />
                        </div>
                    </>
                ) : (
                    <div style={{ width: 120 }}>
                        <div className="fine-linear-loader"></div>
                    </div>
                )}
            </div>
        );
    }

    if (roleRedirect) return <Navigate to={roleRedirect} replace />;
    if (!authorized) return <Navigate to={getLoginRedirect()} state={{ from: location }} replace />;
    return children;
};

export default ProtectedRoute;
