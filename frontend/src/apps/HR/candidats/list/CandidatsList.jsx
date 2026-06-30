import { useLanguage } from '../../../../core/useLanguage';
import './CandidatsList.css'

function CandidatsList() {
    const navigate = useNavigate()
    const { effectiveTheme } = useTheme()
    const { t, language } = useLanguage();
    const [candidates, setCandidates] = useState([])
    const [loading, setLoading] = useState(true)

    // Filter states
    const [searchTerm, setSearchTerm] = useState('')
    const [minScore, setMinScore] = useState(50)
    const [dateRange, setDateRange] = useState(t('hr-filter-date-any'))
    const [selectedDept, setSelectedDept] = useState(t('hr-filter-all-roles'))
    const [selectedSkills, setSelectedSkills] = useState([])
    const [filtersActive, setFiltersActive] = useState(false)

    useEffect(() => {
        const fetchCandidates = async () => {
            try {
                setLoading(true)
                const data = await apiFetch('/candidates')
                setCandidates(data)
            } catch (error) {
                console.error('Error fetching candidates:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchCandidates()
    }, [])

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-success bg-green-500' // Using css classes/variables mapping
        if (score >= 50) return 'text-warning bg-yellow-500'
        return 'text-danger bg-red-500'
    }

    const getScoreTextColor = (score) => {
        if (score >= 80) return 'text-success'
        if (score >= 50) return 'text-warning'
        return 'text-danger'
    }

    const getDeptBadge = (dept) => {
        switch (dept) {
            case 'Design': return 'badge-purple'
            case 'Produit': return 'badge-blue'
            default: return 'badge-gray'
        }
    }

    const deptCounts = React.useMemo(() => {
        return candidates.reduce((acc, candidate) => {
            const dept = candidate.title || 'Inconnu'
            acc[dept] = (acc[dept] || 0) + 1
            return acc
        }, {})
    }, [candidates])

    const uniqueSkills = React.useMemo(() => {
        const skills = new Set()
        candidates.forEach(c => {
            if (Array.isArray(c.skills)) {
                c.skills.forEach(skill => {
                    const skillName = typeof skill === 'string' ? skill : skill?.name;
                    if (skillName) skills.add(skillName);
                })
            } else if (typeof c.skills === 'string') {
                c.skills.split(',').forEach(s => skills.add(s.trim()))
            }
        })
        return Array.from(skills).slice(0, 15)
    }, [candidates])

    if (loading) {
        return (
            <div className={`candidats-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="candidats-main">
                    <div className="candidats-content">
                        <HRPageLoader variant="table" title={t('hr-candidates-loading')} />
                    </div>
                </main>
            </div>
        )
    }

    // Filter Logic
    const filteredCandidates = React.useMemo(() => {
        return candidates.filter(candidate => {
            // 1. Search Logic
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase()
                const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.toLowerCase()
                const title = (candidate.title || '').toLowerCase()
                const matchesSearch = fullName.includes(searchLower) || 
                                     title.includes(searchLower) || 
                                     (candidate.email || '').toLowerCase().includes(searchLower)
                if (!matchesSearch) return false
            }

            if (!filtersActive) return true

            // 2. Min Score Logic
            const score = candidate.score || 0
            if (score < minScore) return false

            // 3. Date Range Logic
            if (dateRange !== t('hr-filter-date-any') && candidate.created_at) {
                const candidateDate = new Date(candidate.created_at)
                const now = new Date()
                if (dateRange === t('hr-filter-date-week')) {
                    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                    if (candidateDate < oneWeekAgo) return false
                } else if (dateRange === t('hr-filter-date-month')) {
                    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
                    if (candidateDate < oneMonthAgo) return false
                } else if (dateRange === t('hr-filter-date-3months')) {
                    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
                    if (candidateDate < threeMonthsAgo) return false
                }
            }

            // 4. Department Logic
            if (selectedDept !== t('hr-filter-all-roles')) {
                const dept = candidate.title || 'Inconnu'
                if (selectedDept !== dept) return false
            }

            // 5. Skills Logic
            if (selectedSkills.length > 0) {
                let candidateSkills = []
                if (Array.isArray(candidate.skills)) {
                    candidateSkills = candidate.skills.map(s => typeof s === 'string' ? s : s?.name).filter(Boolean)
                } else if (typeof candidate.skills === 'string') {
                    candidateSkills = candidate.skills.split(',').map(s => s.trim())
                }
                
                // Must have at least one of the selected skills (OR logic)
                const hasSkill = selectedSkills.some(skill => candidateSkills.includes(skill))
                if (!hasSkill) return false
            }

            return true
        })
    }, [candidates, searchTerm, minScore, dateRange, selectedDept, selectedSkills, filtersActive])

    const toggleSkill = (skill) => {
        setSelectedSkills(prev => 
            prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
        )
    }

    const resetFilters = () => {
        setMinScore(0)
        setDateRange(t('hr-filter-date-any'))
        setSelectedDept(t('hr-filter-all-roles'))
        setSelectedSkills([])
        setFiltersActive(false)
        setSearchTerm('')
    }

    return (
        <div className={`candidats-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="candidats-main">
                {/* Header removed as requested */}


                <div className="candidats-content">


                    {/* Page Header */}
                    <div className="page-header-row">
                        <div className="page-header-text-group">
                            <h1 className="page-title">{t('hr-candidates-title')}</h1>
                            <p className="page-subtitle">{t('hr-candidates-subtitle')}</p>
                        </div>
                        <div className="action-group">

                            <button className="btn-primary">
                                <span className="material-symbols-outlined">person_add</span> {t('hr-candidates-add-new')}
                            </button>
                        </div>
                    </div>


                    {/* KPI Grid */}
                    <div className="stats-grid">
                            <StatCard
                            icon="group"
                            label={t('hr-candidates-kpi-total')}
                            value={candidates.length.toString()}
                            colorTheme="blue"
                        />
                        <StatCard
                            icon="verified"
                            label={t('hr-candidates-kpi-top')}
                            value={candidates.filter(c => (c.score || 0) >= 80).length.toString()}
                            colorTheme="green"
                        />
                        <StatCard
                            icon="star_half"
                            label={t('hr-candidates-kpi-avg')}
                            value={candidates.filter(c => (c.score || 0) >= 50 && (c.score || 0) < 80).length.toString()}
                            colorTheme="yellow"
                        />
                        <StatCard
                            icon="schedule"
                            label={t('hr-candidates-kpi-check')}
                            value={candidates.filter(c => (c.score || 0) < 50).length.toString()}
                            colorTheme="purple"
                        />
                    </div>

                    {/* Main Layout */}
                    <div className="candidats-layout">
                        {/* List Section */}
                        <div className="list-section">
                            {/* Search Local */}
                            <div className="search-bar" style={{ width: '100%', marginBottom: '1rem' }}>
                                <span className="material-symbols-outlined">search</span>
                                <input 
                                    type="text" 
                                    className="search-input" 
                                    placeholder={t('hr-candidates-search-placeholder')} 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Table */}
                            <div className="table-container">
                                <div className="table-scroll">
                                    <table className="candidats-table">
                                        <thead>
                                            <tr>
                                                <th>{t('hr-candidates-table-name')}</th>
                                                <th>{t('hr-candidates-table-date')}</th>
                                                <th>{t('hr-candidates-table-role')}</th>
                                                <th>{t('hr-candidates-table-match')}</th>
                                                <th>{t('hr-candidates-table-score')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr>
                                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                                                        <div className="loading-spinner">{t('hr-candidates-loading')}</div>
                                                    </td>
                                                </tr>
                                            ) : filteredCandidates.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                                                        {t('hr-candidates-no-results')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredCandidates.map(candidate => {
                                                    const score = candidate.score || 0
                                                    const displayName = candidate.firstName && candidate.lastName 
                                                        ? `${candidate.firstName} ${candidate.lastName}` 
                                                        : (candidate.firstName || candidate.lastName || candidate.email || 'Sans nom')
                                                    const date = candidate.created_at 
                                                        ? new Date(candidate.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US') 
                                                        : 'N/A'
                                                        
                                                    return (
                                                        <tr 
                                                            key={candidate._id || candidate.user_id}
                                                            onClick={() => navigate(`/hr/candidats/${candidate._id || candidate.user_id}`)}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            <td>
                                                                <div className="candidate-info">
                                                                    <div 
                                                                        className="user-avatar" 
                                                                        style={{ 
                                                                            backgroundImage: candidate.profileImage ? `url("${candidate.profileImage}")` : 'none',
                                                                            backgroundColor: 'var(--color-bg-tertiary)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                    >
                                                                        {!candidate.profileImage && (
                                                                            <span className="material-symbols-outlined">person</span>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <div className="candidate-name">{displayName}</div>
                                                                        <div className="candidate-email">{candidate.email}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>{date}</td>
                                                            <td>
                                                                <span className={`badge ${getDeptBadge(candidate.title || 'Inconnu')}`}>{candidate.title || 'Candidat'}</span>
                                                            </td>
                                                            <td>
                                                                <span className="candidate-job-match">{candidate.best_match_job || 'N/A'}</span>
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                            {candidate.best_match_job && candidate.best_match_job !== 'Aucune candidature' && (
                                                                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                                                                                    {candidate.best_match_job}
                                                                                </span>
                                                                            )}
                                                                            <span className={`candidate-name ${getScoreTextColor(score)}`} style={{ fontSize: '1.1rem' }}>{score}%</span>
                                                                        </div>
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                                                                            {score >= 80 ? t('matches_badge_excellent') : (score >= 50 ? t('matches_badge_good') : t('hr-candidates-kpi-check'))}
                                                                        </span>
                                                                    </div>
                                                                    <div className="score-bar-bg" style={{ height: '6px' }}>
                                                                        <div className="score-bar-fill" style={{ width: `${score}%`, backgroundColor: score >= 80 ? '#22c55e' : (score >= 50 ? '#eab308' : '#ef4444') }}></div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Pagination */}
                            <div className="pagination-container">
                                <button className="pagination-btn" disabled>
                                    <span className="material-symbols-outlined">chevron_left</span>
                                    {t('jobs-pagination-prev')}
                                </button>
                                <div className="pagination-numbers">
                                    <button className="pagination-number active">1</button>
                                </div>
                                <button className="pagination-btn" disabled>
                                    {t('jobs-pagination-next')}
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        </div>

                        {/* Filters Sidebar */}
                        <aside className="filters-sidebar">
                            <div className="filters-header">
                                <span className="filters-title">
                                    <span className="material-symbols-outlined">tune</span> {t('hr-filter-advanced')} {filtersActive && '(Actifs)'}
                                </span>
                                <button onClick={resetFilters} style={{ border: 'none', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>{t('hr-filter-reset')}</button>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">{t('hr-filter-score-min')}</label>
                                <input 
                                    type="range" 
                                    className="range-slider" 
                                    min="0" 
                                    max="100" 
                                    value={minScore}
                                    onChange={(e) => setMinScore(Number(e.target.value))}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                                    <span>0%</span>
                                    <span style={{ fontWeight: 'bold', color: 'var(--color-text-main)' }}>{minScore}%</span>
                                    <span>100%</span>
                                </div>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">{t('hr-candidates-table-date')}</label>
                                <div className="select-wrapper">
                                    <select 
                                        className="filter-select"
                                        value={dateRange}
                                        onChange={(e) => setDateRange(e.target.value)}
                                    >
                                        <option value={t('hr-filter-date-any')}>{t('hr-filter-date-any')}</option>
                                        <option value={t('hr-filter-date-week')}>{t('hr-filter-date-week')}</option>
                                        <option value={t('hr-filter-date-month')}>{t('hr-filter-date-month')}</option>
                                        <option value={t('hr-filter-date-3months')}>{t('hr-filter-date-3months')}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">{t('hr-candidates-table-role')}</label>
                                <div className="select-wrapper">
                                    <select 
                                        className="filter-select"
                                        value={selectedDept}
                                        onChange={(e) => setSelectedDept(e.target.value)}
                                    >
                                        <option value={t('hr-filter-all-roles')}>{t('hr-filter-all-roles')}</option>
                                        {Object.entries(deptCounts).map(([dept, count]) => (
                                            <option key={dept} value={dept}>
                                                {dept} ({count})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="filter-group">
                                <label className="filter-label">{t('stat_skills')}</label>
                                <div className="tags-group">
                                    {uniqueSkills.length > 0 ? (
                                        uniqueSkills.map(skill => (
                                            <span 
                                                className={`tag-item ${selectedSkills.includes(skill) ? 'active' : ''}`} 
                                                key={skill}
                                                onClick={() => toggleSkill(skill)}
                                                style={{ 
                                                    cursor: 'pointer',
                                                    backgroundColor: selectedSkills.includes(skill) ? 'var(--color-primary)' : '',
                                                    color: selectedSkills.includes(skill) ? 'white' : ''
                                                }}
                                            >
                                                {skill}
                                            </span>
                                        ))
                                    ) : (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{t('hr-candidates-no-results')}</div>
                                    )}
                                </div>
                            </div>

                            <button 
                                className="btn-primary" 
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={() => setFiltersActive(true)}
                            >
                                {t('hr-filter-apply')}
                            </button>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default CandidatsList
