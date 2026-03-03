import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ProtectedRoute = ({ children, allowedRoles, loginPath }) => {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
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
                    setAuthorized(false);
                    setLoading(false);
                    return;
                }

                // 2. If specific roles are allowed, verify in profiles
                if (allowedRoles && allowedRoles.length > 0) {
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', session.user.id)
                        .single();

                    if (error || !allowedRoles.includes(profile?.role)) {
                        console.warn(`Access denied: Allowed roles [${allowedRoles.join(', ')}], found ${profile?.role}`);
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
    }, [allowedRoles]);

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

    if (!authorized) {
        // Redirect to login, keeping the current location for a potential redirect back
        return <Navigate to={getLoginRedirect()} state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;
