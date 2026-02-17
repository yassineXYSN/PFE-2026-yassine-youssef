import Dashboard from '../apps/SuperAdmin/dashboard/Dashboard.jsx';
import CompaniesList from '../apps/SuperAdmin/companies/list/CompaniesList.jsx';
import UsersList from '../apps/SuperAdmin/users/UsersList.jsx';
import Settings from '../apps/SuperAdmin/settings/Settings.jsx';
import { ThemeProvider } from '../apps/SuperAdmin/context/ThemeContext.jsx';

export const routesSuperAdmin = [
    {
        path: '/superadmin',
        element: (
            <ThemeProvider>
                <Dashboard />
            </ThemeProvider>
        ),
    },
    {
        path: '/superadmin/dashboard',
        element: (
            <ThemeProvider>
                <Dashboard />
            </ThemeProvider>
        ),
    },
    {
        path: '/superadmin/companies',
        element: (
            <ThemeProvider>
                <CompaniesList />
            </ThemeProvider>
        ),
    },
    {
        path: '/superadmin/users',
        element: (
            <ThemeProvider>
                <UsersList />
            </ThemeProvider>
        ),
    },
    {
        path: '/superadmin/settings',
        element: (
            <ThemeProvider>
                <Settings />
            </ThemeProvider>
        ),
    },
];
