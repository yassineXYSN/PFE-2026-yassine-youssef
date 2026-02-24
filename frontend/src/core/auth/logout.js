import { supabase } from '../supabaseClient';

/**
 * Centralized logout function for the application.
 * @param {Function} navigate - The navigate function from useNavigate()
 * @param {string} redirectPath - The path to redirect to after logout (defaults to /hr/login)
 */
export const handleLogout = async (navigate, redirectPath = '/hr/login') => {
    try {
        // 1. Terminate Supabase session
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        // 2. Clear local storage
        localStorage.removeItem('userRole');
        localStorage.removeItem('accessToken');
        // Clear anything else that might have been stored during session

        // 3. Redirect to login
        navigate(redirectPath);

    } catch (error) {
        console.error('Error during logout:', error.message);
        // Even if Supabase signout fails, we try to clear local state and redirect
        localStorage.clear();
        navigate(redirectPath);
    }
};
