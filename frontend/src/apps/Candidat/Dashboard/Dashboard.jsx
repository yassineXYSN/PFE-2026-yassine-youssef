import { Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Dialog } from '@headlessui/react';
import Sidebar from './components/Sidebar/Sidebar';
import MobileHeader from './components/MobileHeader/MobileHeader';
import RouteLoader from '../../../core/components/RouteLoader.jsx';
import { NotificationsProvider } from '../../../core/hooks/useNotifications';
import './Dashboard.css';

const Dashboard = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  const openMobile = () => setIsMobileOpen(true);
  const closeMobile = () => setIsMobileOpen(false);

  const isNotifications = location.pathname.includes('/notifications');

  return (
    <NotificationsProvider>
      <div className="dashboard-layout">
        <Sidebar className="dashboard-sidebar dashboard-sidebar--desktop" />
        <MobileHeader onMenuToggle={openMobile} />

        <Dialog
          open={isMobileOpen}
          onClose={closeMobile}
          className="dashboard-mobile-dialog"
        >
          <div className="dashboard-mobile-overlay" aria-hidden="true" />
          <div className="dashboard-mobile-panel">
            <Sidebar
              className="dashboard-sidebar dashboard-sidebar--mobile"
              onClose={closeMobile}
            />
          </div>
        </Dialog>

        <main className={`dashboard-main ${isNotifications ? 'no-padding' : ''}`}>
          <Suspense fallback={<RouteLoader variant="dashboard" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </NotificationsProvider>
  );
};

export default Dashboard;
