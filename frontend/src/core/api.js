import { supabase } from './supabaseClient';

export const SERVER_URL = 'http://localhost:8000';
const API_BASE_URL = `${SERVER_URL}/api`;
let authRecoveryInProgress = false;

const isBrowser = typeof window !== 'undefined';

const clearLocalAuthState = () => {
    if (!isBrowser) return;
    localStorage.removeItem('userRole');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('2fa_verified');
};

const getLoginRedirectPath = () => {
    if (!isBrowser) return '/hr/login';
    const path = window.location.pathname || '';
    if (path.startsWith('/candidat')) return '/candidat/login';
    return '/hr/login';
};

const shouldRecoverAuth = (status, detail) => {
    if (status !== 401) return false;

    const message = `${typeof detail === 'string' ? detail : JSON.stringify(detail || {})}`.toLowerCase();
    return (
        message.includes('authentication failed')
        || message.includes('session from session_id claim in jwt does not exist')
        || message.includes('invalid token')
        || message.includes('token has expired')
        || message.includes('jwt')
        || message.includes('not authenticated')
    );
};

const recoverInvalidSession = async () => {
    if (authRecoveryInProgress) return;
    authRecoveryInProgress = true;

    try {
        await supabase.auth.signOut({ scope: 'local' });
    } catch (signOutError) {
        console.warn('Failed to clear invalid session locally:', signOutError?.message || signOutError);
    } finally {
        clearLocalAuthState();

        if (isBrowser) {
            const redirectPath = getLoginRedirectPath();
            const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

            if (currentPath !== redirectPath) {
                window.location.replace(redirectPath);
            }
        }
    }
};

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

    if (!response.ok) {
        const errorData = await response.clone().json().catch(() => ({}));
        const detail = errorData.detail;

        if (shouldRecoverAuth(response.status, detail)) {
            console.warn(`Invalid session detected for [${endpoint}], clearing local auth state.`);
            await recoverInvalidSession();
        }
    }

    if (rawResponse) {
        return response;
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.detail;
        const errorMessage = typeof detail === 'object' ? JSON.stringify(detail, null, 2) : (detail || `API request failed with status ${response.status}`);
        console.error(`API Error [${endpoint}]:`, detail);
        throw new Error(errorMessage);
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

    // 1) Primary: Metadata check (fastest for new users)
    // We check both 'role' and 'user_type' (used in candidate signup)
    const meta = session.user.user_metadata || {};
    const appMeta = session.user.app_metadata || {};
    const metaRole = meta.role || appMeta.role || meta.user_type || appMeta.user_type;
    
    // If metadata explicitly says 'candidate' (or 'candidat'), return it immediately
    if (metaRole === 'candidate' || metaRole === 'candidat') return 'candidat';

    // 2) Authenticated profile lookup (MongoDB)
    try {
        const res = await fetch(`${API_BASE_URL}/profiles/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (!res.ok) {
            const errorData = await res.clone().json().catch(() => ({}));
            if (shouldRecoverAuth(res.status, errorData.detail)) {
                await recoverInvalidSession();
                return null;
            }
        }
        if (res.ok) {
            const profile = await res.json();
            if (profile?.role) return profile.role;
        }
    } catch (_) { /* network error */ }

    // 3) Fallback: unauthenticated email lookup (only for existing HR profiles)
    if (email) {
        try {
            const res = await fetch(`${API_BASE_URL}/profiles/by-email/${encodeURIComponent(email)}`);
            if (res.ok) {
                const profile = await res.json();
                if (profile?.role) return profile.role;
            }
        } catch (_) { /* network error */ }
    }

    // 4) Final fallback: Return metadata role if found, or null
    return metaRole || null;
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
    try {
        const status = await apiFetch('/candidat/account-setup/status');
        const is2faEnabled = status.totp_enabled || status.email_2fa_enabled;
        const isVerified = localStorage.getItem('2fa_verified') === 'true';
        
        return {
            required: is2faEnabled && !isVerified,
            totpEnabled: status.totp_enabled,
            emailEnabled: status.email_2fa_enabled,
            email: status.email || null
        };
    } catch (err) {
        if (err.message.includes('404')) {
            console.warn('2FA status check returned 404. Profile might not exist yet.');
        } else {
            console.error('Error checking 2FA status:', err);
        }
    }
    return { required: false };
}
