// -----------------------------------------------------------------------------
// JWT auth client (Supabase-compatibility shim)
// -----------------------------------------------------------------------------
// Supabase has been removed. This file exposes a `supabase` object whose
// `.auth.*` surface mirrors the Supabase SDK just enough for the rest of the
// app to keep working unchanged. It is backed by:
//   - a JWT stored in localStorage under 'accessToken'
//   - the backend's own /api/auth endpoints (login / register / me / logout)
//
// Real auth methods (signInWithPassword, signUp, signOut, getSession...) call
// the backend. Social login / OTP / MFA methods are harmless no-op stubs that
// resolve without doing anything (social login buttons are kept but inert,
// 2FA is dropped for now — both can be reintroduced later).
// -----------------------------------------------------------------------------

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api`;
const TOKEN_KEY = 'accessToken';
const isBrowser = typeof window !== 'undefined';

// --- token storage ----------------------------------------------------------

function getToken() {
    if (!isBrowser) return null;
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    if (!isBrowser) return;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
}

function clearStoredAuth() {
    if (!isBrowser) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('userRole');
    localStorage.removeItem('2fa_verified');
    localStorage.removeItem('userAvatar');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
}

// --- JWT helpers -------------------------------------------------------------

function decodeJwt(token) {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(json);
    } catch {
        return null;
    }
}

// Build a Supabase-shaped session object from the stored JWT.
// Returns null when there is no valid (unexpired) token.
function sessionFromToken(token) {
    if (!token) return null;
    const claims = decodeJwt(token);
    if (!claims) return null;

    // claims issued by the backend: { id, email, role, exp }
    if (claims.exp && Date.now() >= claims.exp * 1000) {
        return null; // expired
    }

    const role = claims.role || null;
    return {
        access_token: token,
        token_type: 'bearer',
        expires_at: claims.exp || null,
        user: {
            id: claims.id || claims.sub || null,
            email: claims.email || null,
            user_metadata: { role },
            app_metadata: { role },
        },
    };
}

// --- auth state change listeners --------------------------------------------

const listeners = new Set();

function emit(event, session) {
    listeners.forEach((cb) => {
        try {
            cb(event, session);
        } catch (e) {
            console.error('[auth] listener error:', e);
        }
    });
}

// --- the shim ----------------------------------------------------------------

export const supabase = {
    auth: {
        async getSession() {
            const session = sessionFromToken(getToken());
            return { data: { session }, error: null };
        },

        async getUser() {
            const session = sessionFromToken(getToken());
            return { data: { user: session?.user ?? null }, error: null };
        },

        async signInWithPassword({ email, password }) {
            try {
                const res = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                    return {
                        data: { user: null, session: null },
                        error: { message: body.detail || 'Invalid login credentials', status: res.status },
                    };
                }
                const token = body.access_token || body.token;
                setToken(token);
                const session = sessionFromToken(token);
                emit('SIGNED_IN', session);
                return { data: { user: session?.user ?? null, session }, error: null };
            } catch (e) {
                return { data: { user: null, session: null }, error: { message: e.message } };
            }
        },

        async signUp({ email, password, options }) {
            try {
                const meta = options?.data || {};
                const res = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        password,
                        first_name: meta.first_name || meta.firstName || null,
                        last_name: meta.last_name || meta.lastName || null,
                    }),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                    return {
                        data: { user: null, session: null },
                        error: { message: body.detail || 'Registration failed', status: res.status },
                    };
                }
                // If the backend returns a token on register, log the user in.
                const token = body.access_token || body.token;
                if (token) {
                    setToken(token);
                    const session = sessionFromToken(token);
                    emit('SIGNED_IN', session);
                    return { data: { user: session?.user ?? null, session }, error: null };
                }
                return { data: { user: body.user ?? null, session: null }, error: null };
            } catch (e) {
                return { data: { user: null, session: null }, error: { message: e.message } };
            }
        },

        async signOut() {
            const token = getToken();
            if (token) {
                // Best-effort server notification; ignore failures.
                fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
            }
            clearStoredAuth();
            emit('SIGNED_OUT', null);
            return { error: null };
        },

        // Local JWTs are not refreshed by a server here — just re-read storage.
        async refreshSession() {
            const session = sessionFromToken(getToken());
            if (!session) {
                return { data: { session: null, user: null }, error: { message: 'No session' } };
            }
            return { data: { session, user: session.user }, error: null };
        },

        onAuthStateChange(callback) {
            listeners.add(callback);
            // Fire once with the current state, mirroring Supabase behaviour.
            const session = sessionFromToken(getToken());
            try {
                callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
            } catch (e) {
                console.error('[auth] listener error:', e);
            }
            return {
                data: {
                    subscription: {
                        unsubscribe() {
                            listeners.delete(callback);
                        },
                    },
                },
            };
        },

        // --- inert stubs: social login / OTP / MFA (reintroduce later) ---------

        async signInWithOAuth() {
            console.info('[auth] Social login is disabled in this build.');
            return { data: { provider: null, url: null }, error: null };
        },

        async signInWithOtp() {
            return { data: {}, error: null };
        },

        async verifyOtp() {
            return { data: { user: null, session: null }, error: null };
        },

        async resend() {
            return { data: {}, error: null };
        },

        async resetPasswordForEmail() {
            return { data: {}, error: null };
        },

        async updateUser() {
            const session = sessionFromToken(getToken());
            return { data: { user: session?.user ?? null }, error: null };
        },

        async linkIdentity() {
            return { data: {}, error: null };
        },

        async unlinkIdentity() {
            return { data: {}, error: null };
        },

        mfa: {
            async getAuthenticatorAssuranceLevel() {
                // Always report "no MFA needed" so callers skip the 2FA branch.
                return { data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null };
            },
            async listFactors() {
                return { data: { all: [], totp: [] }, error: null };
            },
            async enroll() {
                return { data: null, error: { message: 'MFA disabled' } };
            },
            async challenge() {
                return { data: null, error: { message: 'MFA disabled' } };
            },
            async verify() {
                return { data: null, error: { message: 'MFA disabled' } };
            },
            async unenroll() {
                return { data: null, error: { message: 'MFA disabled' } };
            },
        },
    },
};

export default supabase;
