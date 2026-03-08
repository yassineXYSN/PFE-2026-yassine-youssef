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
