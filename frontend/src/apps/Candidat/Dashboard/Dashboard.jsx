import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Dialog } from '@headlessui/react';
import Sidebar from './components/Sidebar/Sidebar';
import MobileHeader from './components/MobileHeader/MobileHeader';
import './Dashboard.css';

const Dashboard = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const openMobile = () => setIsMobileOpen(true);
  const closeMobile = () => setIsMobileOpen(false);

  return (
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

      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
};

export default Dashboard;
