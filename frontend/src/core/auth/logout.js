import { clearAuth } from '../apiClient';

export const handleLogout = (navigate, redirectPath = '/hr/login') => {
    clearAuth();
    navigate(redirectPath);
};
