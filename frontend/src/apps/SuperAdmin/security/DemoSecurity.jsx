import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../../../core/api';
import SuperAdminSidebar from '../components/SuperAdminSidebar';
import { ToastContainer, useToast } from '../components/Toast';
import SuperAdminLoading from '../components/SuperAdminLoading';
import './DemoSecurity.css';

const EVENT_LABELS = {
    gate_challenged: 'Défi envoyé',
    code_verified: 'Code vérifié',
    code_failed: 'Code invalide',
    device_trusted: 'Appareil approuvé',
    device_revoked: 'Appareil révoqué',
    login_success: 'Connexion réussie',
    expired_block: 'Démo expirée',
};

const EVENT_TONE = {
    gate_challenged: 'pending',
    code_verified: 'success',
    code_failed: 'danger',
    device_trusted: 'success',
    device_revoked: 'danger',
    login_success: 'success',
    expired_block: 'danger',
};

const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
};

const DemoSecurity = () => {
    const { effectiveTheme } = useTheme();
    const { toasts, addToast, removeToast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [devices, setDevices] = useState([]);
    const [audit, setAudit] = useState([]);
    const [revokingId, setRevokingId] = useState(null);

    const fetchData = async () => {
        try {
            const [auditData, devicesData] = await Promise.all([
                apiFetch('/auth/demo/audit'),
                apiFetch('/auth/demo/devices'),
            ]);
            setAudit(Array.isArray(auditData) ? auditData : []);
            setDevices(Array.isArray(devicesData) ? devicesData : []);
        } catch (error) {
            console.error('Error fetching demo security data:', error);
            addToast('Erreur lors du chargement des données de sécurité démo', 'error');
        } finally {
            setTimeout(() => setIsLoading(false), 800);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRevoke = async (deviceId) => {
        setRevokingId(deviceId);
        try {
            await apiFetch('/auth/demo/revoke-device', {
                method: 'POST',
                body: JSON.stringify({ device_id: deviceId }),
            });
            addToast('Appareil révoqué avec succès.', 'success');
            await fetchData();
        } catch (error) {
            addToast('Erreur lors de la révocation: ' + error.message, 'error');
        } finally {
            setRevokingId(null);
        }
    };

    if (isLoading) return <SuperAdminLoading />;

    return (
        <>
            <div className={`sa-demo-security-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <SuperAdminSidebar />

                <main className="sa-demo-security-main">
                    <div className="sa-demo-security-container">
                        <header className="page-header">
                            <div className="header-content">
                                <h1 className="page-title">Sécurité Démo</h1>
                                <p className="page-subtitle">
                                    Appareils de confiance et historique de connexion des comptes démo
                                </p>
                            </div>
                        </header>

                        <section className="demo-card">
                            <div className="demo-card-header">
                                <h2 className="demo-card-title">
                                    <span className="material-symbols-outlined">devices</span>
                                    Appareils de confiance
                                </h2>
                                <span className="demo-card-count">{devices.length}</span>
                            </div>
                            <div className="demo-table-wrapper">
                                <table className="demo-table">
                                    <thead>
                                        <tr>
                                            <th>Email</th>
                                            <th>Appareil</th>
                                            <th>IP</th>
                                            <th>Créé le</th>
                                            <th>Dernière activité</th>
                                            <th className="text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {devices.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center empty-cell">
                                                    Aucun appareil de confiance pour le moment
                                                </td>
                                            </tr>
                                        ) : devices.map((d) => (
                                            <tr key={d.device_id}>
                                                <td>{d.email || '-'}</td>
                                                <td>{d.label || 'Appareil inconnu'}</td>
                                                <td>{d.ip || '-'}</td>
                                                <td>{formatDate(d.created_at)}</td>
                                                <td>{formatDate(d.last_seen_at)}</td>
                                                <td className="text-center">
                                                    <button
                                                        className="btn-revoke"
                                                        onClick={() => handleRevoke(d.device_id)}
                                                        disabled={revokingId === d.device_id}
                                                    >
                                                        <span className="material-symbols-outlined">block</span>
                                                        {revokingId === d.device_id ? 'Révocation...' : 'Révoquer'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="demo-card">
                            <div className="demo-card-header">
                                <h2 className="demo-card-title">
                                    <span className="material-symbols-outlined">history</span>
                                    Historique de connexion
                                </h2>
                                <span className="demo-card-count">{audit.length}</span>
                            </div>
                            <div className="demo-table-wrapper">
                                <table className="demo-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Email</th>
                                            <th>Événement</th>
                                            <th>IP</th>
                                            <th>Agent utilisateur</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {audit.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="text-center empty-cell">
                                                    Aucun événement enregistré pour le moment
                                                </td>
                                            </tr>
                                        ) : audit.map((a, idx) => (
                                            <tr key={`${a.device_id || 'na'}-${a.created_at}-${idx}`}>
                                                <td>{formatDate(a.created_at)}</td>
                                                <td>{a.email || '-'}</td>
                                                <td>
                                                    <span className={`event-badge event-${EVENT_TONE[a.event] || 'pending'}`}>
                                                        {EVENT_LABELS[a.event] || a.event}
                                                    </span>
                                                </td>
                                                <td>{a.ip || '-'}</td>
                                                <td className="ua-cell">{a.user_agent || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
    );
};

export default DemoSecurity;
