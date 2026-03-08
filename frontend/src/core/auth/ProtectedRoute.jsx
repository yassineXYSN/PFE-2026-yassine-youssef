import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { apiFetch } from '../api';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const location = useLocation();

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
                if (allowedRoles && allowedRoles.length > 0) {
                    let role = null;

                    try {
                        // Try fetching from MongoDB via our backend
                        const profile = await apiFetch(`/profiles/${session.user.id}`);
                        role = profile?.role;
                    } catch (error) {
                        // Fallback: Check Supabase user metadata (crucial for SuperAdmin migration)
                        role = session.user.user_metadata?.role || session.user.app_metadata?.role;
                        console.log(`Profile fetch failed, using fallback role from metadata: ${role}`);
                    }

                    if (!allowedRoles.includes(role)) {
                        console.warn(`DEBUG: Access denied. Allowed: [${allowedRoles.join(', ')}], Found: ${role}`);
                        setAuthorized(false);
                    } else {
                        console.log(`DEBUG: Access granted for role: ${role}`);
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
        return <Navigate to="/hr/login" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;
