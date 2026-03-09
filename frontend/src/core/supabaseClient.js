import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auto-clear stale/invalid sessions so the SDK never tries to refresh a dead token.
// This runs once at startup: if the stored session's refresh token is already gone,
// sign out immediately to wipe it from localStorage before the background timer fires.
supabase.auth.getSession().then(({ error }) => {
    if (error) {
        console.warn('[supabase] Stale session detected at startup, clearing:', error.message)
        supabase.auth.signOut()
    }
})

// Listen for auth state changes and clear storage on token refresh failure.
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('[supabase] Token refresh failed, signing out.')
        supabase.auth.signOut()
    }
})
