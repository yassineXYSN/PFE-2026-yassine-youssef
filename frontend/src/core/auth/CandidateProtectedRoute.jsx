import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../useLanguage';

const CandidateProtectedRoute = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const location = useLocation();
    const { t } = useLanguage();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setAuthorized(!!session);
            } catch (error) {
                console.error('Error in CandidateProtectedRoute:', error);
                setAuthorized(false);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthorized(!!session);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

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
                <div>{t('common-loading')}</div>
            </div>
        );
    }

    if (!authorized) {
        return <Navigate to="/candidat/login" state={{ from: location }} replace />;
    }

    return children;
};

export default CandidateProtectedRoute;
