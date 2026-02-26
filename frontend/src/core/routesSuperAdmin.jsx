import Dashboard from '../apps/SuperAdmin/dashboard/Dashboard.jsx';
import CompaniesList from '../apps/SuperAdmin/companies/list/CompaniesList.jsx';
import UsersList from '../apps/SuperAdmin/users/UsersList.jsx';
import Settings from '../apps/SuperAdmin/settings/Settings.jsx';
import SuperAdminMfa from '../apps/SuperAdmin/security/SuperAdminMfa.jsx';
import { ThemeProvider } from '../apps/SuperAdmin/context/ThemeContext.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';

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
