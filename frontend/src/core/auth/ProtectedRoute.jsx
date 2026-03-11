import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getUserRole } from '../api';

const ProtectedRoute = ({ children, allowedRoles, loginPath, redirectIfRole }) => {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [roleRedirect, setRoleRedirect] = useState(null);
    const location = useLocation();

    // Determine redirect path based on prop or current route prefix
    const getLoginRedirect = () => {
        if (loginPath) return loginPath;
        if (location.pathname.startsWith('/candidat')) return '/candidat/login';
        return '/hr/login';
    };

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // 1. Get current session
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    console.log('DEBUG: No active session found in ProtectedRoute');
                    setAuthorized(false);
                    setLoading(false);
                    return;
                }

                // 2. If specific roles are allowed, verify in profiles
                // Fetch role once for both redirectIfRole and allowedRoles checks
                let role = null;
                if ((allowedRoles && allowedRoles.length > 0) || (redirectIfRole && Object.keys(redirectIfRole).length > 0)) {
                    role = await getUserRole(session);
                }

                // Check if user should be redirected based on their role
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
                        console.warn(`DEBUG: Access denied. Allowed: [${allowedRoles.join(', ')}], Found: ${role}`);
                        setAuthorized(false);
                    } else {
                        setAuthorized(true);
                    }
                } else {
                    // No specific role restriction, just need to be logged in
                    setAuthorized(true);
                }
            } catch (error) {
                console.error('Error in ProtectedRoute:', error);
                setAuthorized(false);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [allowedRoles, redirectIfRole]);

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '1.5rem',
                backgroundColor: 'var(--protected-route-bg, #f6f6f8)',
                color: 'var(--protected-route-color, #0d101b)',
                fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            }}>
                <style>{`
                    :root { --protected-route-bg: #f6f6f8; --protected-route-color: #0d101b; }
                    :root[data-theme='dark'] { --protected-route-bg: #0b1020; --protected-route-color: #e5e7eb; }
                    @keyframes pr-spin { to { transform: rotate(360deg); } }
                    @keyframes pr-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                `}</style>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    animation: 'pr-fade-in 0.4s ease-out',
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: '#8b5cf6' }}>smart_toy</span>
                    <span>HumatiQ AI</span>
                </div>
                <div style={{
                    width: 32,
                    height: 32,
                    border: '3px solid rgba(139, 92, 246, 0.2)',
                    borderTopColor: '#8b5cf6',
                    borderRadius: '50%',
                    animation: 'pr-spin 0.7s linear infinite',
                }} />
            </div>
        );
    }

    if (roleRedirect) {
        return <Navigate to={roleRedirect} replace />;
    }

    if (!authorized) {
        // Redirect to login, keeping the current location for a potential redirect back
        return <Navigate to={getLoginRedirect()} state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;
