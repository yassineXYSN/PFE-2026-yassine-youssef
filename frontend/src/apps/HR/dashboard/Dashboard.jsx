import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import HRSidebar from '../components/HRSidebar'
import StatCard from '../components/StatCard'
import { supabase } from '../../../core/supabaseClient'
import { apiFetch } from '../../../core/api'
import './Dashboard.css'

function Dashboard() {
    const navigate = useNavigate()
    const { effectiveTheme, cycleTheme, getThemeIcon, getThemeLabel } = useTheme()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [stats, setStats] = useState({
        jobs_count: 0,
        applications_count: 0,
        interviews_count: 0,
        average_score: 0
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const profileData = await apiFetch(`/profiles/${user.id}`)
                    setProfile(profileData)

                    // Show onboarding if not done
                    if (!profileData.preferences?.onboarding_done) {
                        navigate('/hr/welcome')
                    }

                    // Fetch Stats
                    if (profileData.company_id) {
                        const statsData = await apiFetch(`/stats/company/${profileData.company_id}`)
                        setStats(statsData)
                    }
                }
            } catch (err) {
                console.error('Error fetching dashboard data:', err)
            }
        }
        fetchData()
    }, [navigate])

    return (
        <div className={`dashboard ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            {/* Sidebar */}
            <HRSidebar />

            {/* Main Content */}
            <main className="dashboard-main">
                {/* Mobile Header */}
                <div className="dashboard-mobile-header">
                    <div className="mobile-header-content">
                        <div className="mobile-header-logo"></div>
                        <h1 className="mobile-header-title">Humatiq</h1>
                    </div>
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                </div>

                {/* Content Container */}
                <div className="dashboard-container">
                    {/* Page Header */}
                    <div className="page-header">
                        <div className="page-header-text">
                            <h2 className="page-title">Vue d'ensemble</h2>
                            <p className="page-subtitle">Analytics et indicateurs clés de performance</p>
                        </div>
                        <div className="page-header-actions">
                            <button className="btn btn-secondary">
                                <span className="material-symbols-outlined">calendar_today</span>
                                <span>Ce mois</span>
                            </button>
                            <button className="btn btn-primary" onClick={() => navigate('/hr/offres')}>
                                <span className="material-symbols-outlined">add</span>
                                <span>Nouvelle Offre</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="stats-grid">
                        <StatCard
                            icon="description"
                            label="Candidatures Totales"
                            value={stats.applications_count.toLocaleString()}
                            trend="+0%"
                            trendType="success"
                        />
                        <StatCard
                            icon="work_outline"
                            label="Offres Actives"
                            value={stats.jobs_count.toLocaleString()}
                            trend="+0%"
                            trendType="success"
                        />
                        <StatCard
                            icon="calendar_month"
                            label="Entretiens Prévus"
                            value={stats.interviews_count.toLocaleString()}
                            trend="0"
                            trendType="neutral"
                        />
                        <StatCard
                            icon="star_half"
                            label="Score Moyen"
                            value={`${stats.average_score}%`}
                            trend="0"
                            trendType="neutral"
                        />
                    </div>

                    {/* Charts Section */}
                    <div className="charts-grid">
                        {/* Applications Chart */}
                        <div className="chart-card chart-card--large">
                            <div className="chart-header">
                                <div>
                                    <h3 className="chart-title">Volume de Candidatures</h3>
                                    <p className="chart-subtitle">Évolution sur 30 jours</p>
                                </div>
                                <div className="chart-legend">
                                    <span className="legend-dot"></span>
                                    <span className="legend-text">Actuel</span>
                                </div>
                            </div>
                            <div className="chart-body">
                                <svg className="chart-svg" preserveAspectRatio="none" viewBox="0 0 800 250">
                                    <defs>
                                        <linearGradient id="gradientFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <line stroke="var(--color-border)" strokeDasharray="4 4" strokeWidth="1" x1="0" y1="200" x2="800" y2="200" />
                                    <line stroke="var(--color-border)" strokeDasharray="4 4" strokeWidth="1" x1="0" y1="150" x2="800" y2="150" />
                                    <line stroke="var(--color-border)" strokeDasharray="4 4" strokeWidth="1" x1="0" y1="100" x2="800" y2="100" />
                                    <line stroke="var(--color-border)" strokeDasharray="4 4" strokeWidth="1" x1="0" y1="50" x2="800" y2="50" />
                                    <path
                                        d="M0,200 C50,180 100,190 150,140 C200,90 250,120 300,100 C350,80 400,60 450,90 C500,120 550,80 600,50 C650,20 700,60 750,40 L800,30 L800,250 L0,250 Z"
                                        fill="url(#gradientFill)"
                                    />
                                    <path
                                        d="M0,200 C50,180 100,190 150,140 C200,90 250,120 300,100 C350,80 400,60 450,90 C500,120 550,80 600,50 C650,20 700,60 750,40 L800,30"
                                        fill="none"
                                        stroke="var(--color-primary)"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2.5"
                                    />
                                    <circle cx="600" cy="50" r="6" fill="var(--color-primary)" stroke="var(--color-card-bg)" strokeWidth="2" />
                                    <rect fill="var(--color-primary)" height="30" rx="4" width="80" x="560" y="10" />
                                    <text fill="var(--color-bg)" fontSize="12" fontWeight="bold" textAnchor="middle" x="600" y="30">
                                        Peak: 145
                                    </text>
                                </svg>
                            </div>
                            <div className="chart-footer">
                                <span>Semaine 1</span>
                                <span>Semaine 2</span>
                                <span>Semaine 3</span>
                                <span>Semaine 4</span>
                            </div>
                        </div>

                        {/* Department Distribution */}
                        <div className="chart-card">
                            <div className="chart-header">
                                <div>
                                    <h3 className="chart-title">Répartition par Dpt.</h3>
                                    <p className="chart-subtitle">Candidats actifs par secteur</p>
                                </div>
                            </div>
                            <div className="chart-body">
                                <div className="dpt-progress-list">
                                    <div className="progress-item">
                                        <div className="progress-header">
                                            <div className="label-with-icon">
                                                <span className="material-symbols-outlined dpt-icon">terminal</span>
                                                <span className="progress-label">Tech & Engineering</span>
                                            </div>
                                            <span className="progress-value">45%</span>
                                        </div>
                                        <div className="dpt-progress-bar">
                                            <div className="dpt-progress-fill dpt-progress-fill--primary" style={{ width: '45%' }}></div>
                                        </div>
                                    </div>

                                    <div className="progress-item">
                                        <div className="progress-header">
                                            <div className="label-with-icon">
                                                <span className="material-symbols-outlined dpt-icon">trending_up</span>
                                                <span className="progress-label">Ventes & Business Dev</span>
                                            </div>
                                            <span className="progress-value">30%</span>
                                        </div>
                                        <div className="dpt-progress-bar">
                                            <div className="dpt-progress-fill dpt-progress-fill--secondary" style={{ width: '30%' }}></div>
                                        </div>
                                    </div>

                                    <div className="progress-item">
                                        <div className="progress-header">
                                            <div className="label-with-icon">
                                                <span className="material-symbols-outlined dpt-icon">campaign</span>
                                                <span className="progress-label">Marketing & Com</span>
                                            </div>
                                            <span className="progress-value">15%</span>
                                        </div>
                                        <div className="dpt-progress-bar">
                                            <div className="dpt-progress-fill dpt-progress-fill--tertiary" style={{ width: '15%' }}></div>
                                        </div>
                                    </div>

                                    <div className="progress-item">
                                        <div className="progress-header">
                                            <div className="label-with-icon">
                                                <span className="material-symbols-outlined dpt-icon">diversity_3</span>
                                                <span className="progress-label">Ressources Humaines</span>
                                            </div>
                                            <span className="progress-value">10%</span>
                                        </div>
                                        <div className="dpt-progress-bar">
                                            <div className="dpt-progress-fill dpt-progress-fill--quaternary" style={{ width: '10%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Matching Banner */}
                    <div className="ai-banner">
                        <div className="ai-banner-content">
                            <div className="ai-banner-text">
                                <div className="ai-banner-header">
                                    <span className="material-symbols-outlined">smart_toy</span>
                                    <h2 className="ai-banner-title">Score de Matching IA</h2>
                                </div>
                                <p className="ai-banner-description">
                                    Notre algorithme a analysé la pertinence des derniers candidats. Le score de compatibilité moyen est en hausse, indiquant une meilleure qualité de sourcing.
                                </p>
                            </div>
                            <div className="ai-stats-grid">
                                <div className="ai-stat-card">
                                    <span className="ai-stat-value">15</span>
                                    <p className="ai-stat-label">Top Profils &gt; 90%</p>
                                </div>
                                <div className="ai-stat-card ai-stat-card--primary">
                                    <span className="ai-stat-value">
                                        85<span className="ai-stat-suffix">/100</span>
                                    </span>
                                    <p className="ai-stat-label">Score Moyen</p>
                                </div>
                                <div className="ai-stat-card">
                                    <span className="ai-stat-value ai-stat-value--success">98%</span>
                                    <p className="ai-stat-label">Précision IA</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default Dashboard
