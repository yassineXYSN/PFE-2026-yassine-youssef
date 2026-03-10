import { supabase } from './supabaseClient';

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Custom fetch wrapper that automatically attaches the Supabase JWT token.
 * 
 * @param {string} endpoint - The API endpoint (e.g. '/profiles')
 * @param {RequestInit} options - Fetch options (method, body, headers, etc.)
 */
export async function apiFetch(endpoint, options = {}) {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        console.warn('No active session found. API call might fail if it requires authentication.');
    }

    const token = session?.access_token;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API request failed with status ${response.status}`);
    }

    return response.json();
}

/**
 * Determine the user's role with multiple fallback strategies.
 * 1) GET /api/profiles/{id} (authenticated)
 * 2) GET /api/profiles/by-email/{email} (unauthenticated, hr_profiles only)
 * 3) Supabase user_metadata / app_metadata
 * Returns the role string or null if undetermined.
 */
export async function getUserRole(session) {
    if (!session?.user) return null;

    const { id, email } = session.user;
    const token = session.access_token;

    // 1) Try authenticated profile lookup
    try {
        const res = await fetch(`${API_BASE_URL}/profiles/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (res.ok) {
            const profile = await res.json();
            if (profile?.role) return profile.role;
        }
    } catch (_) { /* network error */ }

    // 2) Fallback: unauthenticated email lookup (only finds hr_profiles)
    if (email) {
        try {
            const res = await fetch(`${API_BASE_URL}/profiles/by-email/${encodeURIComponent(email)}`);
            if (res.ok) {
                const profile = await res.json();
                if (profile?.role) return profile.role;
            }
        } catch (_) { /* network error */ }
    }

    // 3) Final fallback: Supabase metadata
    return session.user.user_metadata?.role || session.user.app_metadata?.role || null;
}
