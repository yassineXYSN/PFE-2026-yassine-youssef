import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../../../core/api';
import { useLanguage } from '../../../core/useLanguage';
import SuperAdminSidebar from '../components/SuperAdminSidebar';
import StatCard from '../components/StatCard';
import SuperAdminLoading from '../components/SuperAdminLoading';
import './Dashboard.css';

const Dashboard = () => {
    const { t, language } = useLanguage();
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        companies: 0,
        activeUsers: 0,
        jobsPublished: 0,
        applications: 0
    });
    const [recentActivities, setRecentActivities] = useState([]);
    const [topCompanies, setTopCompanies] = useState([]);
    const [activitySeries, setActivitySeries] = useState([]); 
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const data = await apiFetch('/stats/dashboard');
                
                setStats({
                    companies: data.counts.companies,
                    activeUsers: data.counts.profiles,
                    jobsPublished: data.counts.jobs,
                    applications: data.counts.applications
                });
                setRecentActivities(data.recent_activities.map(a => ({
                    ...a,
                    action: t('sa-dashboard-activity-companies'),
                    time: new Date(a.created_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US'),
                    type: 'success'
                })));
                setTopCompanies(data.top_companies);
                setActivitySeries(data.activity_series);

            } catch (error) {
                console.error('Erreur chargement dashboard SuperAdmin:', error);
            } finally {
                // Keep loading for at least 800ms for smooth transition
                setTimeout(() => setLoading(false), 800);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) return <SuperAdminLoading />;

    return (
        <div className={`superadmin-dashboard ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <SuperAdminSidebar />

            <main className="dashboard-main">
                <div className="dashboard-container">
                    {/* Page Header */}
                    <header className="dashboard-header">
                        <div className="header-content">
                            <h1 className="page-title">{t('sa-dashboard-title')}</h1>
                            <p className="page-subtitle">{t('sa-dashboard-subtitle')}</p>
                        </div>
                    </header>

                    {/* KPI Cards */}
                    <section className="stats-grid">
                        <StatCard
                            icon="business"
                            label={t('sa-dashboard-companies')}
                            value={stats.companies}
                            trend={null}
                            trendType="success"
                            color="blue"
                            onClick={() => navigate('/superadmin/companies')}
                        />
                        <StatCard
                            icon="group"
                            label={t('sa-dashboard-users')}
                            value={stats.activeUsers}
                            trend={null}
                            trendType="success"
                            color="green"
                            onClick={() => navigate('/superadmin/users')}
                        />
                        <StatCard
                            icon="work"
                            label={t('sa-dashboard-jobs')}
                            value={stats.jobsPublished}
                            trend={null}
                            trendType="success"
                            color="purple"
                        />
                        <StatCard
                            icon="assignment"
                            label={t('sa-dashboard-applications')}
                            value={stats.applications}
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
                                <h3 className="card-title">{t('sa-dashboard-activity-title')}</h3>
                                <select className="card-select">
                                    <option>{t('sa-dashboard-activity-all')}</option>
                                    <option>{t('sa-dashboard-activity-companies')}</option>
                                    <option>{t('sa-dashboard-activity-users')}</option>
                                </select>
                            </div>
                            <p className="card-subtitle">
                                {t('sa-dashboard-activity-subtitle')}
                            </p>
                            <div className="chart-placeholder">
                                {activitySeries.length === 0 ? (
                                    <div className="chart-empty">{t('sa-dashboard-empty-chart')}</div>
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
                                                    title={t('sa-dashboard-activity-day-label', { day: index + 1, count: value })}
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
                                <h3 className="card-title">{t('sa-dashboard-recent-activities')}</h3>
                                <button className="btn-text">{t('sa-dashboard-view-all')}</button>
                            </div>
                            <div className="activities-list">
                                {recentActivities.length === 0 && (
                                    <div className="activity-item">
                                        <span className="activity-time">{t('sa-dashboard-no-activity')}</span>
                                    </div>
                                )}
                                {recentActivities.slice(0, 4).map((activity) => (
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
                                <h3 className="card-title">{t('sa-dashboard-top-companies')}</h3>
                                <button className="btn-text">{t('sa-dashboard-view-all')}</button>
                            </div>
                            <div className="companies-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('sa-dashboard-table-company')}</th>
                                            <th className="text-center">{t('sa-dashboard-table-users')}</th>
                                            <th className="text-center">{t('sa-dashboard-table-jobs')}</th>
                                            <th className="text-center">{t('sa-dashboard-table-applications')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topCompanies.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center">
                                                    {t('sa-dashboard-table-empty')}
                                                </td>
                                            </tr>
                                        )}
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
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
