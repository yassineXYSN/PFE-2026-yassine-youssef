import { lazy } from 'react';
import { ThemeProvider } from '../apps/SuperAdmin/context/ThemeContext.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';

const Dashboard = lazy(() => import('../apps/SuperAdmin/dashboard/Dashboard.jsx'));
const CompaniesList = lazy(() => import('../apps/SuperAdmin/companies/list/CompaniesList.jsx'));
const UsersList = lazy(() => import('../apps/SuperAdmin/users/UsersList.jsx'));
const Settings = lazy(() => import('../apps/SuperAdmin/settings/Settings.jsx').then((module) => ({
    default: module.default || module.Settings,
})));
const SuperAdminMfa = lazy(() => import('../apps/SuperAdmin/security/SuperAdminMfa.jsx'));

export const routesSuperAdmin = [
    {
        path: '/superadmin',
        element: (
            <ProtectedRoute allowedRoles={['superadmin']}>
                <ThemeProvider>
                    <Dashboard />
                </ThemeProvider>
            </ProtectedRoute>
        ),
    },
    {
        path: '/superadmin/dashboard',
        element: (
            <ProtectedRoute allowedRoles={['superadmin']}>
                <ThemeProvider>
                    <Dashboard />
                </ThemeProvider>
            </ProtectedRoute>
        ),
    },
    {
        path: '/superadmin/companies',
        element: (
            <ProtectedRoute allowedRoles={['superadmin']}>
                <ThemeProvider>
                    <CompaniesList />
                </ThemeProvider>
            </ProtectedRoute>
        ),
    },
    {
        path: '/superadmin/users',
        element: (
            <ProtectedRoute allowedRoles={['superadmin']}>
                <ThemeProvider>
                    <UsersList />
                </ThemeProvider>
            </ProtectedRoute>
        ),
    },
    {
        path: '/superadmin/settings',
        element: (
            <ProtectedRoute allowedRoles={['superadmin']}>
                <ThemeProvider>
                    <Settings />
                </ThemeProvider>
            </ProtectedRoute>
        ),
    },
    {
        path: '/superadmin/mfa',
        element: (
            <ProtectedRoute allowedRoles={['superadmin']}>
                <ThemeProvider>
                    <SuperAdminMfa />
                </ThemeProvider>
            </ProtectedRoute>
        ),
    },
];
