export { SERVER_URL, apiFetch } from './apiClient';
import { apiFetch, getToken, getStoredRole, getStoredUserId } from './apiClient';

const CANDIDATE_PROFILE_CACHE_TTL_MS = 30_000;
const CANDIDATE_DASHBOARD_SUMMARY_CACHE_TTL_MS = 15_000;

let candidateProfileCache = { userId: null, value: null, expiresAt: 0, promise: null };
let candidateDashboardSummaryCache = { userId: null, value: null, expiresAt: 0, promise: null };

const resetCandidateProfileCache = () => {
    candidateProfileCache = { userId: null, value: null, expiresAt: 0, promise: null };
};
const resetCandidateDashboardSummaryCache = () => {
    candidateDashboardSummaryCache = { userId: null, value: null, expiresAt: 0, promise: null };
};

export function invalidateCandidateProfileCache() { resetCandidateProfileCache(); }
export function invalidateCandidateDashboardSummaryCache() { resetCandidateDashboardSummaryCache(); }

/**
 * Returns the current user's role.
 * Reads from localStorage first; falls back to /api/auth/me if not cached.
 */
export async function getUserRole() {
    const cached = getStoredRole();
    if (cached) return cached;

    if (!getToken()) return null;
    try {
        const user = await apiFetch('/auth/me');
        return user?.role ?? null;
    } catch {
        return null;
    }
}

/**
 * Returns the current user's full profile from MongoDB.
 */
export async function getUserProfile() {
    const userId = getStoredUserId();
    if (!userId || !getToken()) return null;
    return apiFetch(`/profiles/${userId}`);
}

export async function getCandidateProfile({ forceRefresh = false } = {}) {
    if (!getToken()) {
        resetCandidateProfileCache();
        return null;
    }

    const userId = getStoredUserId();

    if (candidateProfileCache.userId && candidateProfileCache.userId !== userId) {
        resetCandidateProfileCache();
    }
    candidateProfileCache.userId = userId;

    if (!forceRefresh && candidateProfileCache.value && candidateProfileCache.expiresAt > Date.now()) {
        return candidateProfileCache.value;
    }
    if (!forceRefresh && candidateProfileCache.promise) {
        return candidateProfileCache.promise;
    }

    candidateProfileCache.promise = apiFetch('/candidat/profile')
        .then((profile) => {
            candidateProfileCache.value = profile;
            candidateProfileCache.expiresAt = Date.now() + CANDIDATE_PROFILE_CACHE_TTL_MS;
            return profile;
        })
        .finally(() => { candidateProfileCache.promise = null; });

    return candidateProfileCache.promise;
}

export async function getCandidateDashboardSummary({ forceRefresh = false } = {}) {
    if (!getToken()) {
        resetCandidateDashboardSummaryCache();
        return { applications: [], interviews: [] };
    }

    const userId = getStoredUserId();

    if (candidateDashboardSummaryCache.userId && candidateDashboardSummaryCache.userId !== userId) {
        resetCandidateDashboardSummaryCache();
    }
    candidateDashboardSummaryCache.userId = userId;

    if (!forceRefresh && candidateDashboardSummaryCache.value && candidateDashboardSummaryCache.expiresAt > Date.now()) {
        return candidateDashboardSummaryCache.value;
    }
    if (!forceRefresh && candidateDashboardSummaryCache.promise) {
        return candidateDashboardSummaryCache.promise;
    }

    candidateDashboardSummaryCache.promise = apiFetch('/applications/dashboard-summary')
        .then((summary) => {
            const normalized = {
                applications: Array.isArray(summary?.applications) ? summary.applications : [],
                interviews: Array.isArray(summary?.interviews) ? summary.interviews : [],
            };
            candidateDashboardSummaryCache.value = normalized;
            candidateDashboardSummaryCache.expiresAt = Date.now() + CANDIDATE_DASHBOARD_SUMMARY_CACHE_TTL_MS;
            return normalized;
        })
        .finally(() => { candidateDashboardSummaryCache.promise = null; });

    return candidateDashboardSummaryCache.promise;
}

export async function checkTwoFAStatus() {
    try {
        const status = await apiFetch('/candidat/account-setup/status');
        const is2faEnabled = status.totp_enabled || status.email_2fa_enabled;
        const isVerified = localStorage.getItem('2fa_verified') === 'true';
        return {
            required: is2faEnabled && !isVerified,
            totpEnabled: status.totp_enabled,
            emailEnabled: status.email_2fa_enabled,
            email: status.email || null,
        };
    } catch (err) {
        if (!err.message?.includes('404')) {
            console.error('Error checking 2FA status:', err);
        }
    }
    return { required: false };
}
