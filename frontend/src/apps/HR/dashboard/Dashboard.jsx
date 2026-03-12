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
        average_score: 0,
        top_profiles_count: 0,
        application_series: [],
        department_distribution: []
    })
    const [profile, setProfile] = useState(null)

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

    // Generate SVG path for the application series
    const generateChartPath = (series) => {
        if (!series || series.length === 0) return "M0,200 L800,200"
        
        const width = 800
        const height = 200 // Max height for data
        const maxVal = Math.max(...series, 5) // Min scale of 5
        const step = width / (series.length - 1)
        
        let path = `M0,${height - (series[0] / maxVal * height)}`
        
        for (let i = 1; i < series.length; i++) {
            const x = i * step
            const y = height - (series[i] / maxVal * height)
            path += ` L${x},${y}`
        }
        
        return path
    }

    const generateAreaPath = (series) => {
        const path = generateChartPath(series)
        return `${path} L800,250 L0,250 Z`
    }

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
                                    <span className="legend-text">Candidatures</span>
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
                                        d={generateAreaPath(stats.application_series)}
                                        fill="url(#gradientFill)"
                                    />
                                    <path
                                        d={generateChartPath(stats.application_series)}
                                        fill="none"
                                        stroke="var(--color-primary)"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2.5"
                                    />
                                    
                                    {/* Show peak marker if data exists */}
                                    {stats.application_series.length > 0 && Math.max(...stats.application_series) > 0 && (
                                        <>
                                            {(() => {
                                                const maxVal = Math.max(...stats.application_series)
                                                const maxIdx = stats.application_series.lastIndexOf(maxVal)
                                                const x = maxIdx * (800 / (stats.application_series.length - 1))
                                                const y = 200 - (maxVal / maxVal * 200)
                                                return (
                                                    <g>
                                                        <circle cx={x} cy={y} r="6" fill="var(--color-primary)" stroke="var(--color-card-bg)" strokeWidth="2" />
                                                        <rect fill="var(--color-primary)" height="24" rx="4" width="60" x={x - 30} y={y - 35} />
                                                        <text fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" x={x} y={y - 19}>
                                                            Max: {maxVal}
                                                        </text>
                                                    </g>
                                                )
                                            })()}
                                        </>
                                    )}
                                </svg>
                            </div>
                            <div className="chart-footer">
                                <span>Il y a 30 jours</span>
                                <span>Aujourd'hui</span>
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
                                    {stats.department_distribution.length > 0 ? (
                                        stats.department_distribution.map((dpt, idx) => (
                                            <div className="progress-item" key={idx}>
                                                <div className="progress-header">
                                                    <div className="label-with-icon">
                                                        <span className="material-symbols-outlined dpt-icon">
                                                            {idx === 0 ? 'terminal' : idx === 1 ? 'trending_up' : idx === 2 ? 'campaign' : 'diversity_3'}
                                                        </span>
                                                        <span className="progress-label">{dpt.label}</span>
                                                    </div>
                                                    <span className="progress-value">{dpt.percentage}%</span>
                                                </div>
                                                <div className="dpt-progress-bar">
                                                    <div 
                                                        className={`dpt-progress-fill dpt-progress-fill--${idx === 0 ? 'primary' : idx === 1 ? 'secondary' : idx === 2 ? 'tertiary' : 'quaternary'}`} 
                                                        style={{ width: `${dpt.percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                            Aucune donnée disponible.
                                        </div>
                                    )}
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
                                    Notre algorithme a analysé la pertinence des derniers candidats. Le score de compatibilité moyen est de <strong>{stats.average_score}%</strong>, avec une précision de matching optimisée.
                                </p>
                            </div>
                            <div className="ai-stats-grid">
                                <div className="ai-stat-card">
                                    <span className="ai-stat-value">{stats.top_profiles_count}</span>
                                    <p className="ai-stat-label">Top Profils &gt; 90%</p>
                                </div>
                                <div className="ai-stat-card ai-stat-card--primary">
                                    <span className="ai-stat-value">
                                        {stats.average_score}<span className="ai-stat-suffix">/100</span>
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
