export const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE_URL = `${SERVER_URL}/api`;

const TOKEN_KEY = 'accessToken';
const ROLE_KEY = 'userRole';
const USER_ID_KEY = 'userId';
const USER_EMAIL_KEY = 'userEmail';

// ── Token storage ────────────────────────────────────────────────────────────

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setAuth = ({ access_token, role, id, email } = {}) => {
    if (access_token) localStorage.setItem(TOKEN_KEY, access_token);
    if (role)         localStorage.setItem(ROLE_KEY, role);
    if (id)           localStorage.setItem(USER_ID_KEY, id);
    if (email)        localStorage.setItem(USER_EMAIL_KEY, email);
};

export const clearAuth = () => {
    [TOKEN_KEY, ROLE_KEY, USER_ID_KEY, USER_EMAIL_KEY,
     '2fa_verified', 'userAvatar', 'userName'].forEach(k => localStorage.removeItem(k));
};

export const getStoredRole  = () => localStorage.getItem(ROLE_KEY);
export const getStoredUserId = () => localStorage.getItem(USER_ID_KEY);

// ── Auth recovery ────────────────────────────────────────────────────────────

let recoveryInProgress = false;

const isBrowser = typeof window !== 'undefined';

const getLoginRedirect = () => {
    if (!isBrowser) return '/hr/login';
    return window.location.pathname.startsWith('/candidat') ? '/candidat/login' : '/hr/login';
};

const recoverInvalidSession = () => {
    if (recoveryInProgress) return;
    recoveryInProgress = true;
    clearAuth();
    if (isBrowser) {
        const redirect = getLoginRedirect();
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (current !== redirect) window.location.replace(redirect);
    }
    recoveryInProgress = false;
};

const isAuthError = (status, detail) => {
    if (status !== 401 && status !== 403) return false;
    const msg = `${typeof detail === 'string' ? detail : JSON.stringify(detail || '')}`.toLowerCase();
    return ['invalid token', 'token has expired', 'token expired', 'jwt', 'not authenticated',
            'invalid or expired', 'forbidden', 'session'].some(s => msg.includes(s));
};

// ── apiFetch ─────────────────────────────────────────────────────────────────

/**
 * Fetch wrapper that attaches the stored JWT.
 * Drop-in replacement for the old Supabase-backed apiFetch in api.js.
 */
export async function apiFetch(endpoint, options = {}, rawResponse = false) {
    const token = getToken();

    const headers = { ...options.headers };
    headers['ngrok-skip-browser-warning'] = 'true';
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
        const errorData = await response.clone().json().catch(() => ({}));
        if (isAuthError(response.status, errorData.detail)) {
            console.warn(`[${response.status}] Auth error on ${endpoint}`, errorData.detail);
            recoverInvalidSession();
        }
    }

    if (rawResponse) return response;

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.detail;
        const msg = typeof detail === 'object'
            ? JSON.stringify(detail, null, 2)
            : (detail || `Request failed with status ${response.status}`);
        const err = new Error(msg);
        err.status = response.status;
        err.detail = detail;
        throw err;
    }

    if (response.status === 204) return null;

    const ct = response.headers.get('content-type');
    if (ct && ct.includes('application/json')) return response.json().catch(() => ({}));
    return response.text();
}
