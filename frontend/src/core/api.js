import { supabase } from './supabaseClient';

export const SERVER_URL = 'http://localhost:8000';
const API_BASE_URL = `${SERVER_URL}/api`;

/**
 * Custom fetch wrapper that automatically attaches the Supabase JWT token.
 * 
 * @param {string} endpoint - The API endpoint (e.g. '/profiles')
 * @param {RequestInit} options - Fetch options (method, body, headers, etc.)
 * @param {boolean} rawResponse - If true, return the raw Response object.
 */
export async function apiFetch(endpoint, options = {}, rawResponse = false) {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        console.warn('No active session found. API call might fail if it requires authentication.');
    }

    const token = session?.access_token;

    const headers = { ...options.headers };
    if (!(options.body instanceof FormData)) {
        // Only set Content-Type if it's not already set (e.g. for uploads or blobs)
        if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (rawResponse) {
        return response;
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API request failed with status ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return response.json().catch(() => ({}));
    }

    return response.text();
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
/**
 * Fetch the current user's full profile.
 */
export async function getUserProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { id } = session.user;
    return apiFetch(`/profiles/${id}`);
}
/**
 * Check if the user has 2FA enabled and if it's verified for the current session.
 */
export async function checkTwoFAStatus() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { required: false };

    try {
        const response = await fetch(`${SERVER_URL}/candidat/account-setup/status`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
            },
        });
        if (response.ok) {
            const status = await response.json();
            const is2faEnabled = status.totp_enabled || status.email_2fa_enabled;
            const isVerified = localStorage.getItem('2fa_verified') === 'true';
            
            return {
                required: is2faEnabled && !isVerified,
                totpEnabled: status.totp_enabled,
                emailEnabled: status.email_2fa_enabled,
                email: session.user.email
            };
        }
    } catch (err) {
        console.error('Error checking 2FA status:', err);
    }
    return { required: false };
}
