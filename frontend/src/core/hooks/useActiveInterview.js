import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

export function useActiveInterview() {
    const [activeInterview, setActiveInterview] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchActiveInterview = useCallback(async () => {
        try {
            const data = await apiFetch('/interviews/active-candidate');
            // Backend returns null if no active interview
            setActiveInterview(data);
        } catch (err) {
            console.error('Failed to fetch active interview:', err);
            setActiveInterview(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActiveInterview();

        // Poll more frequently for active interview (e.g., every 30 seconds)
        const interval = setInterval(fetchActiveInterview, 30000);

        return () => clearInterval(interval);
    }, [fetchActiveInterview]);

    return {
        activeInterview,
        loading,
        refresh: fetchActiveInterview
    };
}
