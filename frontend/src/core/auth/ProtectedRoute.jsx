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
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'var(--bg-primary, #09090b)',
                color: 'var(--text-primary, #ffffff)'
            }}>
                <div className="loading-spinner">Chargement...</div>
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
