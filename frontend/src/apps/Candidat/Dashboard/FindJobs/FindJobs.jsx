import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../../core/useLanguage';
import { jobs } from './jobsData';
import { SERVER_URL } from '../../../../core/api';
import './FindJobs.css';

const recentSearches = [
    { title: 'Product Designer', subtitle: 'New York • Remote' },
    { title: 'React Developer', subtitle: 'Remote Only' },
    { title: 'iOS Engineer', subtitle: '$150k+' },
];

const savedFilters = ['High Salary + Remote', 'FinTech Companies', 'Lead Roles'];

const FilterSelect = ({ options, value, onChange, ariaLabel }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = options.find((o) => o.value === value) || options[0];

    return (
        <div className={`fj-select ${open ? 'is-open' : ''}`} ref={ref}>
            <button
                type="button"
                className="fj-select__trigger"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <span className="fj-select__value">{selected.label}</span>
                <span className="material-symbols-outlined fj-select__chev" aria-hidden="true">expand_more</span>
            </button>
            {open ? (
                <div className="fj-select__menu" role="listbox">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            className={`fj-select__option ${opt.value === value ? 'is-active' : ''}`}
                            role="option"
                            aria-selected={opt.value === value}
                            onClick={() => {
                                onChange(opt.value);
                                setOpen(false);
                            }}
                        >
                            <span>{opt.label}</span>
                            {opt.value === value ? <span className="material-symbols-outlined" aria-hidden="true">check</span> : null}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

const toneToMatchClass = (tone) => {
    if (tone === 'strong') return 'fj-match--strong';
    if (tone === 'medium') return 'fj-match--medium';
    return 'fj-match--muted';
};

const matchToPercent = (match) => {
    const m = String(match || '').match(/(\d+)\s*%/);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
};

const calculateProfileStrength = (profile) => {
    if (!profile) return { score: 0, missing: [] };
    let score = 0;
    const missing = [];
    
    // Basic Info: 20%
    const firstName = profile.first_name || profile.firstName;
    const lastName = profile.last_name || profile.lastName;
    const email = profile.email;
    const hasBasic = firstName && lastName && email;
    
    if (hasBasic) {
        score += 20;
    } else {
        if (firstName) score += 7;
        if (lastName) score += 7;
        if (email) score += 6;
        missing.push('info');
    }
    
    // Bio: 10%
    if (profile.bio || profile.about) {
        score += 10;
    } else {
        missing.push('bio');
    }
    
    // Skills: 20%
    if (profile.skills && profile.skills.length > 0) {
        score += 20;
    } else {
        missing.push('skills');
    }
    
    // Experience: 25% (check experience and experiences)
    const exps = profile.experience || profile.experiences;
    if (exps && exps.length > 0) {
        score += 25;
    } else {
        missing.push('experience');
    }
    
    // Education: 25% (check education and educations)
    const edus = profile.education || profile.educations;
    if (edus && edus.length > 0) {
        score += 25;
    } else {
        missing.push('education');
    }
    
    return { score: Math.min(100, score), missing };
};


const FindJobs = () => {

    const { t } = useLanguage();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [remoteOnly, setRemoteOnly] = useState(false);
    const [bookmarked, setBookmarked] = useState(() => new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 9;
    const [salaryFilter, setSalaryFilter] = useState('any');
    const [jobTypeFilter, setJobTypeFilter] = useState('any');
    const [experienceFilter, setExperienceFilter] = useState('any');
    const [sort, setSort] = useState('match');
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [appliedJobs, setAppliedJobs] = useState(new Set());
    const [profileStrength, setProfileStrength] = useState(0);
    const [missingSections, setMissingSections] = useState([]);
    const [profileLoading, setProfileLoading] = useState(true);

    const salaryOptions = useMemo(
        () => [
            { value: 'any', label: t('jobs-filter-salary-any') },
            { value: '100', label: t('jobs-filter-salary-100') },
            { value: '150', label: t('jobs-filter-salary-150') },
            { value: '200', label: t('jobs-filter-salary-200') },
        ],
        [t]
    );

    const jobTypeOptions = useMemo(
        () => [
            { value: 'any', label: t('jobs-filter-jobtype-any') },
            { value: 'remote', label: t('jobs-filter-jobtype-remote') },
            { value: 'hybrid', label: t('jobs-filter-jobtype-hybrid') },
            { value: 'onsite', label: t('jobs-filter-jobtype-onsite') },
        ],
        [t]
    );

    const experienceOptions = useMemo(
        () => [
            { value: 'any', label: t('jobs-filter-experience-any') },
            { value: 'junior', label: t('jobs-filter-experience-junior') },
            { value: 'mid', label: t('jobs-filter-experience-mid') },
            { value: 'senior', label: t('jobs-filter-experience-senior') },
            { value: 'lead', label: t('jobs-filter-experience-lead') },
        ],
        [t]
    );

    useEffect(() => {
        async function fetchJobs() {
            setLoading(true);
            try {
                const { apiFetch } = await import('../../../../core/api');
                const rawJobs = await apiFetch('/candidat/jobs');

                // Map backend data to frontend format
                const mappedJobs = rawJobs.map(job => ({
                    ...job,
                    id: job._id || job.id,
                    company: job.company || 'HumatiQ Partner',
                    location: job.location || 'Remote',
                    // Map 'work_mode' from backend to 'jobType' expected by frontend filters
                    jobType: job.work_mode || (['remote', 'hybrid', 'onsite'].includes(job.type?.toLowerCase()) ? job.type.toLowerCase() : 'onsite'),
                    // Extract numeric salary from salary_range
                    salaryMin: parseInt(job.salary_range) || 0,
                    salaryMax: (job.salary_range?.includes('-') ? parseInt(job.salary_range.split('-')[1]) : (parseInt(job.salary_range) || 0)),
                    // Ensure tags is always an array
                    tags: Array.isArray(job.tags) ? job.tags : [
                        job.type || 'CDI',
                        job.work_mode || 'Remote'
                    ],
                    experienceLevel: job.experience_level || 'junior',
                    match: job.match || 'New Match',
                    matchTone: job.matchTone || 'strong',
                    posted: job.posted || (job.created_at?.$date ? `Posted ${new Date(job.created_at.$date).toLocaleDateString()}` : (job.created_at ? `Posted ${new Date(job.created_at).toLocaleDateString()}` : 'Recently')),
                    logo: job.logo
                        ? (job.logo.startsWith('/') ? `${SERVER_URL}${job.logo}` : job.logo)
                        : 'https://placeholder.pics/svg/200',
                    badgeIcon: job.badgeIcon || 'auto_awesome'
                }));

                setJobs(mappedJobs);
            } catch (err) {
                console.error('Job fetch error:', err);
                setError('Failed to load jobs');
            } finally {
                setLoading(false);
            }
        }
        async function fetchAppliedJobs() {
            try {
                const { apiFetch } = await import('../../../../core/api');
                const apps = await apiFetch('/applications/my-applications');
                setAppliedJobs(new Set(apps.map(app => app.job_id)));
            } catch (err) {
                console.error('Applied jobs fetch error:', err);
            }
        }
        const fetchProfile = async () => {
            setProfileLoading(true);
            try {
                const { getUserProfile } = await import('../../../../core/api');
                const profile = await getUserProfile();
                if (profile) {
                    const result = calculateProfileStrength(profile);
                    setProfileStrength(result.score);
                    setMissingSections(result.missing);
                }
            } catch (err) {
                console.error('Profile fetch error:', err);
            } finally {
                setProfileLoading(false);
            }
        };
        fetchJobs();
        fetchAppliedJobs();
        fetchProfile();
    }, []);

    const handleImageError = (event) => {
        event.currentTarget.src = 'https://placeholder.pics/svg/200';
    };

    const filteredJobs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return jobs.filter((job) => {
            if (remoteOnly && !job.tags.some((tag) => tag.toLowerCase().includes('remote'))) {
                return false;
            }
            if (jobTypeFilter !== 'any' && job.jobType !== jobTypeFilter) {
                return false;
            }
            if (salaryFilter !== 'any' && job.salaryMin < Number(salaryFilter)) {
                return false;
            }
            if (experienceFilter !== 'any' && job.experienceLevel !== experienceFilter) {
                return false;
            }
            if (!term) return true;
            const haystack = `${job.title} ${job.company} ${job.location} ${job.tags.join(' ')}`.toLowerCase();
            return haystack.includes(term);
        });
    }, [searchTerm, remoteOnly, jobTypeFilter, salaryFilter, experienceFilter, jobs]);

    const sortedJobs = useMemo(() => {
        const list = [...filteredJobs];
        if (sort === 'recent') {
            // Mock data doesn't have timestamps, so keep current order (newest-ish first in dataset)
            return list;
        }
        if (sort === 'salary') {
            return list.sort((a, b) => (b.salaryMax || 0) - (a.salaryMax || 0));
        }
        // match
        const toNum = (s) => {
            const m = String(s || '').match(/(\d+)\s*%/);
            return m ? Number(m[1]) : 0;
        };
        return list.sort((a, b) => toNum(b.match) - toNum(a.match));
    }, [filteredJobs, sort]);

    const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
    const page = Math.min(currentPage, totalPages);
    const paginatedJobs = sortedJobs.slice((page - 1) * pageSize, page * pageSize);

    const toggleBookmark = (id) => {
        setBookmarked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleApply = (id) => {
        navigate(`/candidat/dashboard/find-jobs/${id}`, { state: { openApply: true } });
    };

    const openJob = (jobId) => navigate(`/candidat/dashboard/find-jobs/${jobId}`);

    const activeFilterCount =
        Number(remoteOnly) +
        Number(jobTypeFilter !== 'any') +
        Number(salaryFilter !== 'any') +
        Number(experienceFilter !== 'any') +
        Number(Boolean(searchTerm.trim()));

    const clearAll = () => {
        setSearchTerm('');
        setRemoteOnly(false);
        setSalaryFilter('any');
        setJobTypeFilter('any');
        setExperienceFilter('any');
        setSort('match');
        setCurrentPage(1);
    };

    return (
        <div className="fj-page">
            <div className="fj-hero">
                <div className="fj-hero__top">
                    <div>
                        <h1 className="fj-title">{t('jobs-title')}</h1>
                        <p className="fj-subtitle">
                            {t('jobs-subtitle-prefix')}{' '}
                            <span className="fj-accent">
                                {sortedJobs.length} {t('jobs-subtitle-matches')}
                            </span>{' '}
                            {t('jobs-subtitle-suffix')}
                        </p>
                    </div>
                    <div className="fj-hero__actions">
                        {activeFilterCount ? (
                            <button type="button" className="fj-clear" onClick={clearAll}>
                                <span className="material-symbols-outlined" aria-hidden="true">filter_alt_off</span>
                                {t('jobs-clear') || 'Clear'}
                            </button>
                        ) : null}
                        <button type="button" className="fj-icon-btn" aria-label="Notifications">
                            <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
                            <span className="fj-dot" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div className="fj-searchRow">
                    <div className="fj-search">
                        <span className="material-symbols-outlined" aria-hidden="true">search</span>
                        <input
                            type="text"
                            placeholder={t('jobs-search-placeholder')}
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                        {searchTerm.trim() ? (
                            <button
                                type="button"
                                className="fj-search__clear"
                                aria-label="Clear search"
                                onClick={() => {
                                    setSearchTerm('');
                                    setCurrentPage(1);
                                }}
                            >
                                <span className="material-symbols-outlined" aria-hidden="true">close</span>
                            </button>
                        ) : null}
                    </div>

                    <div className="fj-controls">
                        <FilterSelect
                            options={[
                                { value: 'match', label: t('jobs-sort-match') || 'Sort: Best match' },
                                { value: 'salary', label: t('jobs-sort-salary') || 'Sort: Salary' },
                                { value: 'recent', label: t('jobs-sort-recent') || 'Sort: Recent' },
                            ]}
                            value={sort}
                            ariaLabel="Sort results"
                            onChange={(val) => {
                                setSort(val);
                                setCurrentPage(1);
                            }}
                        />
                        <label className={`fj-switch ${remoteOnly ? 'is-on' : ''}`}>
                            <input
                                type="checkbox"
                                checked={remoteOnly}
                                onChange={(e) => {
                                    setRemoteOnly(e.target.checked);
                                    setCurrentPage(1);
                                }}
                            />
                            <span className="fj-switch__ui" aria-hidden="true" />
                            <span className="fj-switch__label">{t('jobs-remote-only')}</span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="fj-layout">
                <aside className="fj-panel">
                    <div className="fj-panel__card">
                        <div className="fj-panel__titleRow">
                            <h3>{t('jobs-filter-title') || 'Filters'}</h3>
                            <span className="fj-panel__count">{activeFilterCount || 0}</span>
                        </div>

                        <div className="fj-field">
                            <span className="fj-field__label">{t('jobs-filter-jobtype-any')}</span>
                            <FilterSelect
                                options={jobTypeOptions}
                                value={jobTypeFilter}
                                ariaLabel="Job type"
                                onChange={(val) => {
                                    setJobTypeFilter(val);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>

                        <div className="fj-field">
                            <span className="fj-field__label">{t('jobs-filter-salary-any')}</span>
                            <FilterSelect
                                options={salaryOptions}
                                value={salaryFilter}
                                ariaLabel="Salary range"
                                onChange={(val) => {
                                    setSalaryFilter(val);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>

                        <div className="fj-field">
                            <span className="fj-field__label">{t('jobs-filter-experience-any')}</span>
                            <FilterSelect
                                options={experienceOptions}
                                value={experienceFilter}
                                ariaLabel="Experience level"
                                onChange={(val) => {
                                    setExperienceFilter(val);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>

                        <button type="button" className="fj-ghost" onClick={clearAll} disabled={!activeFilterCount}>
                            {t('jobs-reset-filters') || 'Reset filters'}
                        </button>
                    </div>

                    <div className="fj-panel__card fj-panel__card--soft">
                        <div className="fj-panel__titleRow">
                            <h3>{t('jobs-widget-profile-strength')}</h3>
                            <span className="fj-accent">{profileLoading ? '...' : `${profileStrength}%`}</span>
                        </div>
                        <div className={`fj-progress ${profileLoading ? 'is-loading' : ''}`} aria-label={`Profile strength ${profileStrength}%`}>
                            <div className="fj-progress__bar" style={{ width: profileLoading ? '30%' : `${profileStrength}%` }} />
                        </div>
                        {!profileLoading && (
                            <p className="fj-muted">
                                {missingSections.length > 0
                                    ? `${t('jobs-widget-profile-why-missing')} ${missingSections.map(s => t(`jobs-section-${s}`)).join(', ')}.`
                                    : t('jobs-widget-profile-why-complete')}
                            </p>
                        )}
                        <button
                            type="button"
                            className="fj-primary"
                            onClick={() => navigate('/candidat/dashboard/profile')}
                        >
                            {t('jobs-widget-profile-cta')}
                        </button>
                    </div>
                </aside>

                <main className="fj-results" aria-label="Job results">
                    {loading ? (
                        <div className="fj-spinner" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                            <div className="fj-spinner-anim" style={{ width: '48px', height: '48px', border: '6px solid #ccc', borderTop: '6px solid #1976d2', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`}</style>
                        </div>
                    ) : error ? (
                        <div className="fj-error" style={{ padding: '2rem', textAlign: 'center' }}>
                            <div className="fj-error__icon" style={{ marginBottom: '1rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#d32f2f' }} aria-hidden="true">error</span>
                            </div>
                            <h3>{t('jobs-error-title') || 'Oops! Something went wrong'}</h3>
                            <p className="fj-muted">{error}</p>
                            <button type="button" className="fj-primary" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>
                                {t('jobs-error-retry') || 'Retry'}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="fj-results__meta">
                                <div className="fj-muted">
                                    {t('jobs-showing') || 'Showing'} <span className="fj-strong">{paginatedJobs.length}</span> {t('jobs-of') || 'of'}{' '}
                                    <span className="fj-strong">{sortedJobs.length}</span>
                                </div>
                                <div className="fj-muted">
                                    {t('jobs-pagination-page')} <span className="fj-strong">{page}</span> {t('jobs-pagination-of')}{' '}
                                    <span className="fj-strong">{totalPages}</span>
                                </div>
                            </div>

                            {paginatedJobs.length ? (
                                <div className="fj-grid">
                                    {paginatedJobs.map((job) => {
                                        const matchPercent = matchToPercent(job.match);
                                        return (
                                            <article
                                                key={job.id}
                                                className="fj-card"
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => openJob(job.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        openJob(job.id);
                                                    }
                                                }}
                                            >
                                                <div
                                                    className={`fj-match ${toneToMatchClass(job.matchTone)}`}
                                                    aria-label={matchPercent !== null ? `Match ${matchPercent}%` : 'Match'}
                                                >
                                                    <div
                                                        className="fj-match__ring"
                                                        style={matchPercent !== null ? { '--p': matchPercent } : undefined}
                                                        aria-hidden="true"
                                                    >
                                                        <span className="fj-match__value">
                                                            {matchPercent !== null ? `${matchPercent}%` : '—'}
                                                        </span>
                                                    </div>
                                                    <div className="fj-match__label">
                                                        <span className="material-symbols-outlined" aria-hidden="true">
                                                            {job.badgeIcon || 'auto_awesome'}
                                                        </span>
                                                        <span>{t('jobs-match-label') || 'Match'}</span>
                                                    </div>
                                                </div>

                                                <div className="fj-card__top">
                                                    <div className="fj-logo">
                                                        <img src={job.logo} alt={`${job.company} logo`} onError={handleImageError} />
                                                    </div>
                                                    <div className="fj-card__meta">
                                                        <h3 className="fj-card__title">{job.title}</h3>
                                                        <p className="fj-card__company">{job.company} • {job.location}</p>
                                                    </div>
                                                </div>

                                                <div className="fj-tags" aria-label="Job tags">
                                                    {job.tags?.slice(0, 3).map((tag) => (
                                                        <span key={tag} className="fj-tag">{tag}</span>
                                                    ))}
                                                </div>

                                                <div className="fj-card__bottom">
                                                    <span className="fj-posted">{job.posted}</span>
                                                    <div className="fj-card__actions">
                                                        <button
                                                            type="button"
                                                            className={`fj-bookmark ${bookmarked.has(job.id) ? 'is-active' : ''}`}
                                                            aria-label="Bookmark job"
                                                            aria-pressed={bookmarked.has(job.id)}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleBookmark(job.id);
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined" aria-hidden="true">
                                                                {bookmarked.has(job.id) ? 'bookmark_added' : 'bookmark'}
                                                            </span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`fj-apply ${appliedJobs.has(job.id) ? 'is-applied' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!appliedJobs.has(job.id)) {
                                                                    handleApply(job.id);
                                                                }
                                                            }}
                                                            disabled={appliedJobs.has(job.id)}
                                                        >
                                                            {appliedJobs.has(job.id) ? t('jobdetail-applied') || 'Applied' : t('jobs-apply')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="fj-empty">
                                    <div className="fj-empty__icon">
                                        <span className="material-symbols-outlined" aria-hidden="true">search_off</span>
                                    </div>
                                    <h3>{t('jobs-no-results') || 'No results'}</h3>
                                    <p className="fj-muted">{t('jobs-no-results-desc') || 'Try adjusting your filters or search query.'}</p>
                                    <button type="button" className="fj-ghost" onClick={clearAll}>{t('jobs-clear-all') || 'Clear all'}</button>
                                </div>
                            )}

                            <div className="fj-pagination">
                                <button
                                    type="button"
                                    className="fj-pageBtn"
                                    disabled={page === 1}
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                >
                                    <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                                    {t('jobs-pagination-prev')}
                                </button>
                                <div className="fj-pageInfo" aria-live="polite">
                                    {t('jobs-pagination-page')} {page} {t('jobs-pagination-of')} {totalPages}
                                </div>
                                <button
                                    type="button"
                                    className="fj-pageBtn"
                                    disabled={page === totalPages}
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    {t('jobs-pagination-next')}
                                    <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                                </button>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};

export default FindJobs;
