import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../../../core/api';
import SuperAdminSidebar from '../components/SuperAdminSidebar';
import StatCard from '../components/StatCard';
import './Dashboard.css';

const Dashboard = () => {
    const { effectiveTheme } = useTheme();

    const [stats, setStats] = useState({
        companies: 0,
        activeUsers: 0,
        jobsPublished: 0,
        applications: 0
    });
    const [recentActivities, setRecentActivities] = useState([]);
    const [topCompanies, setTopCompanies] = useState([]);
    const [activitySeries, setActivitySeries] = useState([]); // données réelles pour la chart
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                // Fetch all dashboard data from our new FastAPI endpoint
                const data = await apiFetch('/stats/dashboard');

                setStats(data.counts);
                setRecentActivities(data.recent_activities.map(a => ({
                    ...a,
                    action: 'Entreprise créée',
                    time: new Date(a.created_at).toLocaleString('fr-FR'),
                    type: 'success'
                })));
                setTopCompanies(data.top_companies);
                setActivitySeries(data.activity_series);

            } catch (error) {
                console.error('Erreur chargement dashboard SuperAdmin:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

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

                    </header>

                    {/* KPI Cards */}
                    <section className="stats-grid">
                        <StatCard
                            icon="business"
                            label="Entreprises"
                            value={loading ? <div className="skeleton skeleton-text" /> : stats.companies}
                            trend={null}
                            trendType="success"
                            color="blue"
                        />
                        <StatCard
                            icon="group"
                            label="Utilisateurs (profils)"
                            value={loading ? <div className="skeleton skeleton-text" /> : stats.activeUsers}
                            trend={null}
                            trendType="success"
                            color="green"
                        />
                        <StatCard
                            icon="work"
                            label="Offres publiées"
                            value={loading ? <div className="skeleton skeleton-text" /> : stats.jobsPublished}
                            trend={null}
                            trendType="success"
                            color="purple"
                        />
                        <StatCard
                            icon="assignment"
                            label="Candidatures"
                            value={loading ? <div className="skeleton skeleton-text" /> : stats.applications}
                            trend={null}
                            trendType="success"
                            color="orange"
                        />
                    </section>

                    {/* Charts and Tables Section */}
                    <div className="dashboard-grid">
                        {/* Activity Chart */}
                        <div className="dashboard-card chart-card">
                            <div className="card-header">
                                <h3 className="card-title">Activité des 15 derniers jours</h3>
                                <select className="card-select">
                                    <option>Tous</option>
                                    <option>Entreprises</option>
                                    <option>Utilisateurs</option>
                                </select>
                            </div>
                            <p className="card-subtitle">
                                Évolution des créations (entreprises, profils utilisateurs, offres) sur les 15 derniers jours.
                            </p>
                            <div className="chart-placeholder">
                                {loading ? (
                                    <div className="skeleton skeleton-chart" />
                                ) : activitySeries.length === 0 ? (
                                    <div className="chart-empty">Pas encore de données d&apos;activité sur les 15 derniers jours.</div>
                                ) : (
                                    <div className="chart-bars chart-bars--animated">
                                        {activitySeries.map((value, index) => {
                                            const max = Math.max(...activitySeries, 1);
                                            const height = (value / max) * 100;
                                            return (
                                                <div
                                                    key={index}
                                                    className="chart-bar"
                                                    style={{ height: `${height || 5}%` }}
                                                    title={`Jour ${index + 1} : ${value} création(s)`}
                                                ></div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Activities */}
                        <div className="dashboard-card activity-card">
                            <div className="card-header">
                                <h3 className="card-title">Activités Récentes</h3>
                                <button className="btn-text">Voir tout</button>
                            </div>
                            <div className="activities-list">
                                {loading && Array(5).fill(0).map((_, i) => (
                                    <div key={i} className="activity-item skeleton-item">
                                        <div className="skeleton skeleton-icon" />
                                        <div className="activity-content">
                                            <div className="skeleton skeleton-line" style={{ width: '60%' }} />
                                            <div className="skeleton skeleton-line" style={{ width: '40%' }} />
                                        </div>
                                    </div>
                                ))}
                                {!loading && recentActivities.length === 0 && (
                                    <div className="activity-item">
                                        <span className="activity-time">Aucune activité récente</span>
                                    </div>
                                )}
                                {!loading &&
                                    recentActivities.map((activity) => (
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
                                        {loading && (
                                            <tr>
                                                <td colSpan="4" className="text-center">
                                                    Chargement des entreprises...
                                                </td>
                                            </tr>
                                        )}
                                        {!loading && topCompanies.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center">
                                                    Aucune entreprise trouvée
                                                </td>
                                            </tr>
                                        )}
                                        {!loading &&
                                            topCompanies.map((company, idx) => (
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
