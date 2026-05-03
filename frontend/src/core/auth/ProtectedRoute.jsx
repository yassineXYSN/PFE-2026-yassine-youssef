import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken, decodeToken, clearAuth } from '../apiClient';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const token = getToken();
        if (!token) {
            setAuthorized(false);
            setLoading(false);
            return;
        }

        const payload = decodeToken(token);
        if (!payload || payload.exp < Date.now() / 1000) {
            clearAuth();
            setAuthorized(false);
            setLoading(false);
            return;
        }

        if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
            console.warn(`Access denied: role "${payload.role}" not in [${allowedRoles.join(', ')}]`);
            setAuthorized(false);
        } else {
            setAuthorized(true);
        }
        setLoading(false);
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
        return <Navigate to="/hr/login" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;
