import React from 'react';
import './SuperAdminLoading.css';

const SuperAdminLoading = () => {
    return (
        <div className="sa-loading-overlay">
            <div className="sa-loading-content">
                <div className="sa-loading-logo">
                    <div className="logo-pulse"></div>
                    <span className="material-symbols-outlined sa-loading-icon">admin_panel_settings</span>
                </div>
                <div className="sa-loading-bar">
                    <div className="sa-loading-progress"></div>
                </div>
                <p className="sa-loading-text">Initialisation de l'interface...</p>
            </div>
        </div>
    );
};

export default SuperAdminLoading;
