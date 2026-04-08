import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
    }
})

// Auto-clear stale/invalid sessions so the SDK never tries to refresh a dead token.
// This runs once at startup: if the stored session's refresh token is already gone,
// sign out immediately to wipe it from localStorage before the background timer fires.
supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) {
        console.warn('[supabase] Session retrieval error at startup:', error.message)
        supabase.auth.signOut()
    } else if (session) {
        console.info('[supabase] Session loaded at startup, user:', session.user?.email)
    }
})

// Listen for auth state changes and clear storage on token refresh failure.
supabase.auth.onAuthStateChange(async (event, session) => {
    console.debug('[supabase] Auth state changed:', event)
    
    if (event === 'TOKEN_REFRESHED' && session) {
        console.info('[supabase] Token successfully refreshed for', session.user?.email)
    } else if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('[supabase] Token refresh failed (no session), signing out.')
        supabase.auth.signOut()
    } else if (event === 'SIGNED_IN') {
        console.info('[supabase] User signed in:', session?.user?.email)
    } else if (event === 'SIGNED_OUT') {
        console.info('[supabase] User signed out')
    } else if (event === 'USER_UPDATED') {
        console.info('[supabase] User updated')
    }
})

// Periodic token refresh to prevent expiry during long sessions
setInterval(async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (session && !error) {
        const expiresAt = session.expires_at * 1000
        const now = Date.now()
        const minutesUntilExpiry = (expiresAt - now) / (1000 * 60)
        
        if (minutesUntilExpiry < 5) {
            console.info('[supabase] Token expiring soon, refreshing...')
            const { data, error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) {
                console.warn('[supabase] Failed to refresh token:', refreshError.message)
                supabase.auth.signOut()
            } else {
                console.info('[supabase] Token refreshed successfully')
            }
        }
    }
}, 60000) // Check every 60 seconds
