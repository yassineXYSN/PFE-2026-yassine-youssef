import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import HRSidebar from '../components/HRSidebar'
import HRPageLoader from '../components/HRPageLoader'
import { useLanguage } from '../../../core/useLanguage'
import StatCard from '../components/StatCard'
import { supabase } from '../../../core/supabaseClient'
import { apiFetch } from '../../../core/api'
import './Dashboard.css'

// Use only real data from backend
const getDisplayDepartmentData = (rawData) => {
    return rawData && Array.isArray(rawData) ? rawData : []
}

function Dashboard() {
    const navigate = useNavigate()
    const { t, language } = useLanguage()
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
    const [upcomingInterviews, setUpcomingInterviews] = useState([])
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const profileData = await apiFetch(`/profiles/${user.id}`)
                    setProfile(profileData)

                    // Show onboarding if not done
                    if (!profileData.preferences?.onboarding_done) {
                        if (profileData.company_id) {
                            try {
                                const company = await apiFetch(`/companies/${profileData.company_id}`);
                                if (company?.onboarding_done) {
                                    // Auto-onboard the user profile if company is already configured
                                    profileData.preferences = { ...profileData.preferences, onboarding_done: true };
                                    apiFetch(`/profiles/${user.id}`, {
                                        method: 'PUT',
                                        body: JSON.stringify({ preferences: profileData.preferences })
                                    }).catch(e => console.warn('Silent sync failed', e));
                                } else {
                                    navigate('/hr/welcome');
                                    return;
                                }
                            } catch (err) {
                                console.warn('Could not check company status in dashboard:', err);
                                navigate('/hr/welcome');
                                return;
                            }
                        } else {
                            navigate('/hr/welcome');
                            return;
                        }
                    }

                    // Fetch Stats
                    if (profileData.company_id) {
                        const statsData = await apiFetch(`/stats/company/${profileData.company_id}`)
                        setStats(statsData)

                        // Fetch upcoming interviews with proper data structure
                        try {
                            const interviewsData = await apiFetch(`/interviews/company/${profileData.company_id}`)
                            if (interviewsData && Array.isArray(interviewsData)) {
                                // Get current date for filtering
                                const now = new Date()
                                
                                // Separate upcoming and past interviews
                                const upcoming = interviewsData.filter(iv => new Date(iv.start_time) >= now)
                                const past = interviewsData.filter(iv => new Date(iv.start_time) < now)
                                
                                // Combine: next 5 upcoming, or if less than 5, fill with recent past ones
                                let combined = [...upcoming.slice(0, 5)]
                                if (combined.length < 5) {
                                    combined = [...combined, ...past.slice(0, 5 - combined.length)]
                                }
                                
                                setUpcomingInterviews(combined)
                            }
                        } catch (err) {
                            console.warn('Could not fetch upcoming interviews:', err)
                            setUpcomingInterviews([])
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching dashboard data:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [navigate])

    if (loading) {
        return (
            <div className={`dashboard ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="dashboard-main">
                    <div className="dashboard-container">
                        <HRPageLoader variant="dashboard" title={t('hr-dashboard-loading')} />
                    </div>
                </main>
            </div>
        )
    }

    // Generate SVG path for the application series
    const generateChartPath = (series) => {
        if (!series || series.length === 0) return "M0,220 L800,220"

        const width = 800
        const height = 220 // Max height for data
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
        return `${path} L800,220 L0,220 Z`
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
                            <h2 className="page-title">{t('hr-dashboard-title')}</h2>
                        </div>
                        <div className="page-header-actions">
                            <button className="btn btn-primary" onClick={() => navigate('/hr/offres')}>
                                <span className="material-symbols-outlined">add</span>
                                <span>{t('hr-dashboard-new-job')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="stats-grid">
                        <StatCard
                            icon="description"
                            label={t('hr-dashboard-total-applications')}
                            value={stats.applications_count.toLocaleString()}
                            trend="+0%"
                            trendType="success"
                        />
                        <StatCard
                            icon="work_outline"
                            label={t('hr-dashboard-open-jobs')}
                            value={stats.jobs_count.toLocaleString()}
                            trend="+0%"
                            trendType="success"
                        />
                        <StatCard
                            icon="calendar_month"
                            label={t('hr-dashboard-upcoming-interviews')}
                            value={stats.interviews_count.toLocaleString()}
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
                                    <h3 className="chart-title">{t('hr-dashboard-applications-received')}</h3>
                                    <p className="chart-subtitle">{t('hr-dashboard-applications-evolution')}</p>
                                </div>
                                <div className="chart-legend">
                                    <span className="legend-dot"></span>
                                    <span className="legend-text">{t('hr-dashboard-legend-applications')}</span>
                                </div>
                            </div>
                            <div className="chart-body">
                                <svg className="chart-svg" preserveAspectRatio="none" viewBox="0 0 900 350">
                                    <defs>
                                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#eab308" />
                                            <stop offset="100%" stopColor="#f59e0b" />
                                        </linearGradient>
                                    </defs>

                                    {/* Axes */}
                                    <line x1="60" y1="300" x2="850" y2="300" stroke="#e4e4e7" strokeWidth="2" />
                                    <line x1="60" y1="30" x2="60" y2="300" stroke="#e4e4e7" strokeWidth="2" />

                                    {/* Y-axis labels and grid lines */}
                                    {[0, 1, 2, 3, 4, 5].map((val) => {
                                        const y = 300 - (val * 45)
                                        return (
                                            <g key={`y-${val}`}>
                                                <line x1="55" y1={y} x2="850" y2={y} stroke="rgba(234, 179, 8, 0.1)" strokeWidth="1" strokeDasharray="3 3" />
                                                <text x="45" y={y + 5} textAnchor="end" fontSize="12" fill="var(--color-text-muted)" fontWeight="500">
                                                    {val}
                                                </text>
                                            </g>
                                        )
                                    })}

                                    {/* Bars Chart */}
                                    {stats.application_series.length > 0 && (() => {
                                        const data = stats.application_series.length > 15 
                                            ? stats.application_series.slice(-15) 
                                            : stats.application_series
                                        const maxVal = Math.max(...data, 1)
                                        
                                        return data.map((val, i) => {
                                            const barWidth = 790 / data.length * 0.7
                                            const barSpacing = 790 / data.length
                                            const x = 60 + (i * barSpacing) + (barSpacing - barWidth) / 2
                                            const barHeight = (val / maxVal) * 260
                                            const y = 300 - barHeight

                                            return (
                                                <g key={`bar-${i}`}>
                                                    <rect
                                                        x={x}
                                                        y={y}
                                                        width={barWidth}
                                                        height={barHeight}
                                                        fill="url(#barGradient)"
                                                        rx="3"
                                                        ry="3"
                                                        opacity="0.85"
                                                    />
                                                    {val > 0 && (
                                                        <text
                                                            x={x + barWidth / 2}
                                                            y={y - 8}
                                                            textAnchor="middle"
                                                            fontSize="11"
                                                            fill="#eab308"
                                                            fontWeight="700"
                                                        >
                                                            {val}
                                                        </text>
                                                    )}
                                                </g>
                                            )
                                        })
                                    })()}

                                    {/* X-axis labels (dates) */}
                                    {stats.application_series.length > 0 && (() => {
                                        const data = stats.application_series.length > 15 
                                            ? stats.application_series.slice(-15) 
                                            : stats.application_series
                                        const originalLength = stats.application_series.length
                                        
                                        return data.map((val, idx) => {
                                            const barSpacing = 790 / data.length
                                            const x = 60 + (idx * barSpacing) + barSpacing / 2
                                            const now = new Date()
                                            const daysBack = originalLength > 15 
                                                ? (originalLength - 15) + (data.length - 1 - idx)
                                                : originalLength - 1 - idx
                                            const date = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
                                            const dateStr = `${date.getDate()} ${date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' })}`
                                            
                                            return (
                                                <text 
                                                    key={`x-${idx}`} 
                                                    x={x} 
                                                    y="325" 
                                                    textAnchor="middle" 
                                                    fontSize="11" 
                                                    fill="var(--color-text-muted)" 
                                                    fontWeight="500"
                                                    opacity={idx % 2 === 0 ? 1 : 0.5}
                                                >
                                                    {dateStr}
                                                </text>
                                            )
                                        })
                                    })()}

                                    {/* Axis labels */}
                                    <text x="30" y="15" fontSize="11" fill="var(--color-text-muted)" fontWeight="600" textAnchor="middle">
                                        {t('hr-dashboard-axis-count')}
                                    </text>
                                    <text x="875" y="320" fontSize="11" fill="var(--color-text-muted)" fontWeight="600">
                                        {t('hr-dashboard-axis-days')}
                                    </text>
                                </svg>
                            </div>
                        </div>

                        {/* Department Distribution */}
                        <div className="chart-card chart-card--department">
                            <div className="chart-header">
                                <div>
                                    <h3 className="chart-title">{t('hr-dashboard-candidates-by-dept')}</h3>
                                    <p className="chart-subtitle">{t('hr-dashboard-dept-distribution')}</p>
                                </div>
                            </div>
                            <div className="chart-body chart-body--department">
                                <div className="dpt-progress-list">
                                    {(() => {
                                        const displayData = getDisplayDepartmentData(stats.department_distribution)
                                        return displayData.length > 0 ? (
                                            displayData.map((dpt, idx) => (
                                                <div className="progress-item" key={idx}>
                                                    <div className="progress-header">
                                                        <div className="label-with-icon">
                                                            <span className="material-symbols-outlined dpt-icon">
                                                                {dpt.label?.includes('Tech') || dpt.label?.includes('Dev') || dpt.label?.includes('IT') ? 'terminal' 
                                                                 : dpt.label?.includes('Product') || dpt.label?.includes('Produit') ? 'trending_up' 
                                                                 : dpt.label?.includes('Design') || dpt.label?.includes('UX') ? 'palette' 
                                                                 : dpt.label?.includes('Sales') || dpt.label?.includes('Ventes') || dpt.label?.includes('Marketing') ? 'shopping_cart'
                                                                 : dpt.label?.includes('Data') ? 'bar_chart'
                                                                 : dpt.label?.includes('HR') || dpt.label?.includes('RH') ? 'people'
                                                                 : 'diversity_3'}
                                                            </span>
                                                            <span className="progress-label">{dpt.label}</span>
                                                        </div>
                                                        <span className="progress-value">{dpt.percentage}%</span>
                                                    </div>
                                                    <div className="dpt-progress-bar">
                                                        <div
                                                            className={`dpt-progress-fill dpt-progress-fill--${idx % 4 === 0 ? 'primary' : idx % 4 === 1 ? 'secondary' : idx % 4 === 2 ? 'tertiary' : 'quaternary'}`}
                                                            style={{ width: `${dpt.percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                                {t('hr-dashboard-no-dept-data')}
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Upcoming Interviews Section */}
                    <div className="upcoming-interviews-section">
                        <div className="section-header">
                            <div>
                                <h3 className="section-title">{t('hr-dashboard-upcoming-interviews')}</h3>
                            </div>
                        </div>
                        <div className="interviews-table-wrapper">
                            <table className="interviews-table">
                                <thead>
                                    <tr>
                                        <th>{t('hr-dashboard-table-candidate')}</th>
                                        <th>{t('hr-dashboard-table-type')}</th>
                                        <th>{t('hr-dashboard-table-date-time')}</th>
                                        <th>{t('hr-dashboard-table-status')}</th>
                                        <th>{t('hr-dashboard-table-action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {upcomingInterviews.length > 0 ? (
                                        upcomingInterviews.map((interview, idx) => {
                                            const initials = (interview.candidate_name || 'C')
                                                .split(' ')
                                                .map(n => n[0])
                                                .join('')
                                                .toUpperCase()
                                                .slice(0, 2)
                                            const interviewDate = new Date(interview.start_time)
                                            const isUpcoming = interviewDate >= new Date()
                                            
                                            return (
                                                <tr key={idx}>
                                                    <td>
                                                        <div className="candidate-cell">
                                                            <div className="candidate-info">
                                                                <div className="candidate-name">{interview.candidate_name || 'Candidat'}</div>
                                                                <div className="candidate-email">{interview.candidate_email || ''}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>{interview.type || 'Entretien'}</td>
                                                    <td>
                                                        <div className="date-time">
                                                            <span className="date">
                                                                {interviewDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </span>
                                                            <span className="time">
                                                                {interviewDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge badge-${interview.status === 'completed' ? 'completed' : isUpcoming ? 'tech' : 'data'}`}>
                                                            {interview.status === 'completed' ? t('hr-dashboard-status-completed') : isUpcoming ? t('hr-dashboard-status-upcoming') : t('hr-dashboard-status-past')}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="actions-cell">
                                                            <button 
                                                                className="action-btn action-btn-edit" 
                                                                title={t('hr-dashboard-view-detail')}
                                                                onClick={() => navigate(`/hr/entretiens/${interview._id || interview.id}`)}
                                                            >
                                                                <span className="material-symbols-outlined">edit</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                                                {t('hr-dashboard-no-interviews')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default Dashboard
