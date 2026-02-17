import React from 'react';
import { useTheme } from '../context/ThemeContext';
import SuperAdminSidebar from '../components/SuperAdminSidebar';
import StatCard from '../components/StatCard';
import './Dashboard.css';

const Dashboard = () => {
    const { effectiveTheme } = useTheme();

    // Mock data
    const stats = {
        companies: { total: 47, trend: '+12%', type: 'success' },
        activeUsers: { total: 1834, trend: '+8%', type: 'success' },
        jobsPublished: { total: 342, trend: '+23%', type: 'success' },
        applications: { total: 8956, trend: '+15%', type: 'success' }
    };

    const recentActivities = [
        { id: 1, company: 'TechNova Solutions', action: 'Nouvelle entreprise créée', time: 'Il y a 5 min', type: 'success' },
        { id: 2, company: 'Digital Corp', action: 'Offre publiée', time: 'Il y a 12 min', type: 'info' },
        { id: 3, company: 'StartupX', action: 'Compte suspendu', time: 'Il y a 1h', type: 'warning' },
        { id: 4, company: 'InnoLabs', action: 'Utilisateur ajouté', time: 'Il y a 2h', type: 'info' },
        { id: 5, company: 'CloudSystems', action: 'Offre clôturée', time: 'Il y a 3h', type: 'info' }
    ];

    const topCompanies = [
        { name: 'TechNova Solutions', users: 45, jobs: 23, applications: 567 },
        { name: 'Digital Corp', users: 38, jobs: 19, applications: 432 },
        { name: 'InnoLabs', users: 32, jobs: 15, applications: 389 },
        { name: 'CloudSystems', users: 28, jobs: 12, applications: 298 },
        { name: 'DataTech', users: 25, jobs: 10, applications: 245 }
    ];

    return (
        <div className={`superadmin-dashboard ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <SuperAdminSidebar />

            <main className="dashboard-main">
                <div className="dashboard-container">
                    {/* Page Header */}
                    <header className="dashboard-header">
                        <div className="header-content">
                            <h1 className="page-title">Dashboard Super Admin</h1>
                            <p className="page-subtitle">Vue d'ensemble de la plateforme et des activités</p>
                        </div>
                        <button className="btn-primary">
                            <span className="material-symbols-outlined">add</span>
                            Nouvelle Entreprise
                        </button>
                    </header>

                    {/* KPI Cards */}
                    <section className="stats-grid">
                        <StatCard
                            icon="business"
                            label="Entreprises Actives"
                            value={stats.companies.total}
                            trend={stats.companies.trend}
                            trendType={stats.companies.type}
                            color="blue"
                        />
                        <StatCard
                            icon="group"
                            label="Utilisateurs Actifs"
                            value={stats.activeUsers.total}
                            trend={stats.activeUsers.trend}
                            trendType={stats.activeUsers.type}
                            color="green"
                        />
                        <StatCard
                            icon="work"
                            label="Offres Publiées"
                            value={stats.jobsPublished.total}
                            trend={stats.jobsPublished.trend}
                            trendType={stats.jobsPublished.type}
                            color="purple"
                        />
                        <StatCard
                            icon="assignment"
                            label="Candidatures Reçues"
                            value={stats.applications.total}
                            trend={stats.applications.trend}
                            trendType={stats.applications.type}
                            color="orange"
                        />
                    </section>

                    {/* Charts and Tables Section */}
                    <div className="dashboard-grid">
                        {/* Activity Chart */}
                        <div className="dashboard-card chart-card">
                            <div className="card-header">
                                <h3 className="card-title">Activité des 30 derniers jours</h3>
                                <select className="card-select">
                                    <option>Tous</option>
                                    <option>Entreprises</option>
                                    <option>Utilisateurs</option>
                                </select>
                            </div>
                            <div className="chart-placeholder">
                                <div className="chart-bars">
                                    {[...Array(12)].map((_, i) => (
                                        <div key={i} className="chart-bar" style={{ height: `${Math.random() * 100}%` }}></div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Recent Activities */}
                        <div className="dashboard-card activity-card">
                            <div className="card-header">
                                <h3 className="card-title">Activités Récentes</h3>
                                <button className="btn-text">Voir tout</button>
                            </div>
                            <div className="activities-list">
                                {recentActivities.map(activity => (
                                    <div key={activity.id} className="activity-item">
                                        <div className={`activity-icon activity-${activity.type}`}>
                                            <span className="material-symbols-outlined">
                                                {activity.type === 'success' ? 'check_circle' :
                                                    activity.type === 'warning' ? 'warning' : 'info'}
                                            </span>
                                        </div>
                                        <div className="activity-content">
                                            <p className="activity-company">{activity.company}</p>
                                            <p className="activity-action">{activity.action}</p>
                                        </div>
                                        <span className="activity-time">{activity.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Companies */}
                        <div className="dashboard-card companies-card">
                            <div className="card-header">
                                <h3 className="card-title">Top Entreprises</h3>
                                <button className="btn-text">Voir tout</button>
                            </div>
                            <div className="companies-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Entreprise</th>
                                            <th className="text-center">Utilisateurs</th>
                                            <th className="text-center">Offres</th>
                                            <th className="text-center">Candidatures</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topCompanies.map((company, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <div className="company-cell">
                                                        <div className="company-avatar">{company.name[0]}</div>
                                                        <span>{company.name}</span>
                                                    </div>
                                                </td>
                                                <td className="text-center">{company.users}</td>
                                                <td className="text-center">{company.jobs}</td>
                                                <td className="text-center">{company.applications}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* System Alerts */}
                        <div className="dashboard-card alerts-card">
                            <div className="card-header">
                                <h3 className="card-title">Alertes Système</h3>
                                <span className="alert-badge">3</span>
                            </div>
                            <div className="alerts-list">
                                <div className="alert-item alert-warning">
                                    <span className="material-symbols-outlined">warning</span>
                                    <div className="alert-content">
                                        <p className="alert-title">Espace de stockage faible</p>
                                        <p className="alert-desc">85% de l'espace utilisé</p>
                                    </div>
                                </div>
                                <div className="alert-item alert-info">
                                    <span className="material-symbols-outlined">info</span>
                                    <div className="alert-content">
                                        <p className="alert-title">Mise à jour disponible</p>
                                        <p className="alert-desc">Version 2.5.0 prête</p>
                                    </div>
                                </div>
                                <div className="alert-item alert-success">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <div className="alert-content">
                                        <p className="alert-title">Backup réussi</p>
                                        <p className="alert-desc">Dernière sauvegarde: aujourd'hui</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
