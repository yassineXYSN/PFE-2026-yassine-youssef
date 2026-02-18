import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlareHover from '../Analytics/components/GlareHover/GlareHover';
import { useLanguage } from '../../../../core/useLanguage';
import './FindJobs.css';

export const jobs = [
    {
        id: 'stripe-fe',
        title: 'Senior Frontend Engineer',
        company: 'Stripe',
        location: 'San Francisco, CA',
        tags: ['Remote', 'Full-time', '$160k - $210k'],
        jobType: 'remote',
        salaryMin: 160,
        salaryMax: 210,
        experienceLevel: 'senior',
        match: '98% Match',
        matchTone: 'strong',
        posted: 'Posted 2 days ago',
        logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA9nIL2a1yM0PuPAaxBHfE3tfrjf6gl93kDdr94JNLn6hgS9xGkWjnzx8sAhoSX0hNZIvw-FyR0H0YYQmAWUKfri_EZSyrRz0wFI7l25PtOpvsqiJnybywg0quv2FcMa_0i2uZIgXIy2odkKCAIxDexOKDfGL4sx52DdS3VcvrCEvmNZswD1N7hbgT-vRgxnnxgEf1AHJeP89Tm6Y5hPVVGkE8ZvQMfe60B8XQttfVjaltJieknz6zXARG8Mt_HCPmX_xv6iLc9hkk',
        badgeIcon: 'auto_awesome',
    },
    {
        id: 'airbnb-designer',
        title: 'Product Designer',
        company: 'Airbnb',
        location: 'Hybrid',
        tags: ['Hybrid', 'Design System', '$140k - $180k'],
        jobType: 'hybrid',
        salaryMin: 140,
        salaryMax: 180,
        experienceLevel: 'mid',
        match: '94% Match',
        matchTone: 'strong',
        posted: 'Posted 5 hours ago',
        logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCmh2nKAPXRo0U1v1Hl13zZFFaS5q71PCIHcrQqgXJdJWQReoerSZNF3LWDvNJrk8zuMHXuDvJOnQpDojig-f8YK4Ww4w-x3ltcPNLSJ_sNKfe16TAlZcIqGxHvuuk31dTEGxzqanCoVWaNcnHez5h-ssdveIwXbPMxusQWezS21-cZ3MXsTNbVeVpfw28wjKpm-FBpB6pSSTansjDDLUb_rhVOHAXrR0uY5L98klZJ-EpeRJJWmOTTkwsk8ZGrKavitDDjOVUT0fw',
        badgeIcon: 'auto_awesome',
    },
    {
        id: 'notion-fs',
        title: 'Full Stack Engineer',
        company: 'Notion',
        location: 'New York, NY',
        tags: ['On-site', 'Startup', '$170k - $220k'],
        jobType: 'onsite',
        salaryMin: 170,
        salaryMax: 220,
        experienceLevel: 'senior',
        match: '88% Match',
        matchTone: 'medium',
        posted: 'Posted 1 day ago',
        logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAjEd0RcM4R6Hrm31p_RZzhel0FmB-X1GuWJczV9LsUm6lxHfOCpoAdc0lNs0eMSC0ytP1CkX9volH_r0yUk-m3-wT4lQkrE5IBJ-fPf-okJ213kjP4KrBGNy76VxhRulIXR2pFOb565gvemDmYrhHccWcTEaXgk4OSeBtYwfkgxV-vai8YfTkBbEEd-bgJpSzu-i17k9LUstEWhLlCzb14TcXa9Zm90poavPvvzlkwbB2_GpF6hF_NB3KT_cdtYHqpxb_lzcLcpVA',
    },
    {
        id: 'spotify-be',
        title: 'Backend Developer',
        company: 'Spotify',
        location: 'Stockholm, SE',
        tags: ['Hybrid', 'Music Tech', '$130k - $160k'],
        jobType: 'hybrid',
        salaryMin: 130,
        salaryMax: 160,
        experienceLevel: 'mid',
        match: '85% Match',
        matchTone: 'medium',
        posted: 'Posted 3 days ago',
        logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCjjQrxuXrQmfZXCnald9oE8jT5biCTnquzbQ_lMo9GrtUxALbmkizqGLvARyQIYpQ50uaR6GvEXX7MkSAUYPRcpNFFvD6P8l9axWQXUNodQskvohCohfjKnCmX5Jybgdk8_dZyCHUpEL6wAGA5rlOdgrv3Wsv5hvicraq2HwaS2S8KD-uvy6aQGCSnSQi5ruJEjH8TgEmH8rdUZ7WxzMvCL9wfmXOKW-alBjT-BVWnIN5owsFR2KdQzXLRUx8CwO2DrT9W3BEJbR0',
    },
    {
        id: 'figma-de',
        title: 'Design Engineer',
        company: 'Figma',
        location: 'Remote',
        tags: ['Remote', 'Prototyping', '$150k - $200k'],
        jobType: 'remote',
        salaryMin: 150,
        salaryMax: 200,
        experienceLevel: 'senior',
        match: '82% Match',
        matchTone: 'muted',
        posted: 'Posted 4 days ago',
        logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAzdjtJktEhZjimajyglxORRo9AZVyzGsA_j-a470Zr8gLOMMgBXIlQCSllOZ2tzKweMb0tYfAfYJwOheq5SFfGFoXs0v-1_CXYPQrNzBOHCZjbEzH00th_AV3C6DxJiM-51W7jFa-28hpzKLl6zKkJVePy0gtfjHCuKwJAvtV2HUK0N6KB3nMKy2HoMc2Zqi1zSfp_OWCCtaCrYKFsYzpN4RrfzNAlzlmOx5SDuaerVHQ9-bJfp2dTbsurySFCg-THDQLURF71XwM',
    },
    {
        id: 'vercel-devrel',
        title: 'DevRel Engineer',
        company: 'Vercel',
        location: 'Remote',
        tags: ['Remote', 'Content', '$120k - $160k'],
        jobType: 'remote',
        salaryMin: 120,
        salaryMax: 160,
        experienceLevel: 'mid',
        match: '79% Match',
        matchTone: 'muted',
        posted: 'Posted 1 week ago',
        logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXrxVLwouANR0oMvUI68wYXScmacm7k7iccc1SebB82FJF_uN0Ot9-pU26_2g3z8LFD7xWPlUgG-0NCIf3FLOknTf_YDXoXsN2_bqwXlvtisSZINvYnhSf4rwSFNDzAvrQRoQnicqhaLl4Ff2K9695bg2TdVGyDU4aqkNEwX_stn0UFj2PSdkaA-e6pp7CKSqUGtZF6A3Hfo6eISvOdg66MJ1ADXME1XWZMC_x2EQ7G5SylD1VfN9nClVSzxAVuaXLdKleEVoi7aI',
    },
    {
        id: 'google-ml',
        title: 'Machine Learning Engineer',
        company: 'Google',
        location: 'Mountain View, CA',
        tags: ['On-site', 'AI/ML', '$180k - $240k'],
        jobType: 'onsite',
        salaryMin: 180,
        salaryMax: 240,
        experienceLevel: 'senior',
        match: '91% Match',
        matchTone: 'strong',
        posted: 'Posted 2 days ago',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
        badgeIcon: 'auto_awesome',
    },
    {
        id: 'meta-fe',
        title: 'Frontend Engineer',
        company: 'Meta',
        location: 'Remote',
        tags: ['Remote', 'React', '$170k - $230k'],
        jobType: 'remote',
        salaryMin: 170,
        salaryMax: 230,
        experienceLevel: 'mid',
        match: '87% Match',
        matchTone: 'medium',
        posted: 'Posted 1 day ago',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Meta_Platforms_Inc._logo.svg',
    },
    {
        id: 'amazon-sde',
        title: 'Software Development Engineer II',
        company: 'Amazon',
        location: 'Seattle, WA',
        tags: ['Hybrid', 'Cloud', '$150k - $200k'],
        jobType: 'hybrid',
        salaryMin: 150,
        salaryMax: 200,
        experienceLevel: 'mid',
        match: '84% Match',
        matchTone: 'medium',
        posted: 'Posted 6 hours ago',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
    },
    {
        id: 'openai-research',
        title: 'Research Engineer',
        company: 'OpenAI',
        location: 'San Francisco, CA',
        tags: ['Hybrid', 'AI/ML', '$190k - $260k'],
        jobType: 'hybrid',
        salaryMin: 190,
        salaryMax: 260,
        experienceLevel: 'senior',
        match: '93% Match',
        matchTone: 'strong',
        posted: 'Posted 3 days ago',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg',
        badgeIcon: 'auto_awesome',
    },
    {
        id: 'shopify-lead',
        title: 'Lead Frontend Developer',
        company: 'Shopify',
        location: 'Remote',
        tags: ['Remote', 'Leadership', '$180k - $230k'],
        jobType: 'remote',
        salaryMin: 180,
        salaryMax: 230,
        experienceLevel: 'lead',
        match: '86% Match',
        matchTone: 'medium',
        posted: 'Posted 5 days ago',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Shopify_logo_2018.svg',
    },
    {
        id: 'datadog-sre',
        title: 'Site Reliability Engineer',
        company: 'Datadog',
        location: 'New York, NY',
        tags: ['Hybrid', 'SRE', '$160k - $210k'],
        jobType: 'hybrid',
        salaryMin: 160,
        salaryMax: 210,
        experienceLevel: 'senior',
        match: '83% Match',
        matchTone: 'muted',
        posted: 'Posted 1 week ago',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Datadog_logo.svg',
    },
    {
        id: 'doordash-pm',
        title: 'Product Manager',
        company: 'DoorDash',
        location: 'Hybrid',
        tags: ['Hybrid', 'Consumer', '$150k - $190k'],
        jobType: 'hybrid',
        salaryMin: 150,
        salaryMax: 190,
        experienceLevel: 'mid',
        match: '80% Match',
        matchTone: 'muted',
        posted: 'Posted 2 days ago',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/DoorDash_Logo.svg',
    },
    {
        id: 'uber-data',
        title: 'Senior Data Scientist',
        company: 'Uber',
        location: 'Remote',
        tags: ['Remote', 'Data', '$170k - $220k'],
        jobType: 'remote',
        salaryMin: 170,
        salaryMax: 220,
        experienceLevel: 'senior',
        match: '89% Match',
        matchTone: 'medium',
        posted: 'Posted 8 hours ago',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Uber_logo_2018.png',
    },
];

const recentSearches = [
    { title: 'Product Designer', subtitle: 'New York • Remote' },
    { title: 'React Developer', subtitle: 'Remote Only' },
    { title: 'iOS Engineer', subtitle: '$150k+' },
];

const savedFilters = ['High Salary + Remote', 'FinTech Companies', 'Lead Roles'];

const FilterSelect = ({ options, value, onChange }) => {
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
        <div className={`filter-custom ${open ? 'is-open' : ''}`} ref={ref}>
            <button type="button" className="filter-trigger" onClick={() => setOpen((o) => !o)}>
                <span className="filter-label">{selected.label}</span>
                <span className="material-symbols-outlined">expand_more</span>
            </button>
            {open ? (
                <div className="filter-menu">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            className={`filter-option ${opt.value === value ? 'is-active' : ''}`}
                            onClick={() => {
                                onChange(opt.value);
                                setOpen(false);
                            }}
                        >
                            <span>{opt.label}</span>
                            {opt.value === value ? <span className="material-symbols-outlined">check</span> : null}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
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
    }, [searchTerm, remoteOnly, jobTypeFilter, salaryFilter, experienceFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
    const page = Math.min(currentPage, totalPages);
    const paginatedJobs = filteredJobs.slice((page - 1) * pageSize, page * pageSize);

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

    const handleApply = (jobTitle) => {
        // Placeholder for real apply flow
        alert(`Applying to ${jobTitle}`);
    };

    const openJob = (jobId) => navigate(`/candidat/dashboard/find-jobs/${jobId}`);

    return (
        <div className="jobs-page">
            <header className="jobs-header">
                <div className="jobs-header__bar">
                    <div>
                        <h1 className="jobs-title">{t('jobs-title')}</h1>
                        <p className="jobs-subtitle">
                            {t('jobs-subtitle-prefix')} <span className="text-accent">24 {t('jobs-subtitle-matches')}</span> {t('jobs-subtitle-suffix')}
                        </p>
                    </div>
                    <div className="jobs-actions">
                        <button className="icon-btn">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="status-dot" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div className="jobs-search">
                    <div className="jobs-search__input">
                        <span className="material-symbols-outlined">search</span>
                        <input
                            type="text"
                            placeholder={t('jobs-search-placeholder')}
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                    <div className="jobs-filters">
                        <FilterSelect
                            options={jobTypeOptions}
                            value={jobTypeFilter}
                            onChange={(val) => {
                                setJobTypeFilter(val);
                                setCurrentPage(1);
                            }}
                        />

                        <FilterSelect
                            options={salaryOptions}
                            value={salaryFilter}
                            onChange={(val) => {
                                setSalaryFilter(val);
                                setCurrentPage(1);
                            }}
                        />

                        <FilterSelect
                            options={experienceOptions}
                            value={experienceFilter}
                            onChange={(val) => {
                                setExperienceFilter(val);
                                setCurrentPage(1);
                            }}
                        />

                        <span className="filters-divider" aria-hidden="true" />
                        <label className="toggle-pill">
                            <input
                                type="checkbox"
                                checked={remoteOnly}
                                onChange={(e) => {
                                    setRemoteOnly(e.target.checked);
                                    setCurrentPage(1);
                                }}
                            />
                            <span>{t('jobs-remote-only')}</span>
                        </label>
                    </div>
                </div>
            </header>

            <div className="jobs-grid">
                <section className="jobs-list">
                    {paginatedJobs.map((job) => (
                        <GlareHover
                            key={job.id}
                            className="job-card job-card-link"
                            background="var(--jobs-surface)"
                            borderRadius="1rem"
                            glareOpacity={0.4}
                            glareSize={250}
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
                            <div className={`match-badge match-${job.matchTone}`}>
                                {job.badgeIcon ? (
                                    <span className="material-symbols-outlined">{job.badgeIcon}</span>
                                ) : null}
                                <span>{job.match}</span>
                            </div>

                            <div className="job-card__header">
                                <div className="job-logo">
                                    <img src={job.logo} alt={`${job.company} logo`} onError={handleImageError} />
                                </div>
                                <div className="job-meta">
                                    <h3 className="job-title">{job.title}</h3>
                                    <p className="job-company">{job.company} • {job.location}</p>
                                </div>
                            </div>

                            <div className="job-tags">
                                {job.tags.map((tag) => (
                                    <span key={tag} className="job-tag">{tag}</span>
                                ))}
                            </div>

                            <div className="job-card__footer">
                                <p className="job-posted">{job.posted}</p>
                                <div className="job-actions">
                                    <button
                                        className={`icon-btn subtle ${bookmarked.has(job.id) ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleBookmark(job.id);
                                        }}
                                        aria-pressed={bookmarked.has(job.id)}
                                    >
                                        <span className="material-symbols-outlined">
                                            {bookmarked.has(job.id) ? 'bookmark_added' : 'bookmark'}
                                        </span>
                                    </button>
                                    <button
                                        className="apply-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleApply(job.title);
                                        }}
                                    >
                                        {t('jobs-apply')}
                                    </button>
                                </div>
                            </div>
                        </GlareHover>
                    ))}
                </section>

                <aside className="jobs-sidebar">
                    <div className="widget">
                        <div className="widget__row">
                            <h3>{t('jobs-widget-profile-strength')}</h3>
                            <span className="text-accent">70%</span>
                        </div>
                        <div className="progress">
                            <div className="progress__bar" style={{ width: '70%' }} />
                        </div>
                        <p className="widget__hint">{t('jobs-widget-profile-hint')}</p>
                        <button className="ghost-btn">{t('jobs-widget-profile-cta')}</button>
                    </div>

                    <div className="widget">
                        <div className="widget__row">
                            <h3 className="with-icon">
                                <span className="material-symbols-outlined">history</span>
                                {t('jobs-widget-recent-searches')}
                            </h3>
                        </div>
                        <div className="widget__list">
                            {recentSearches.map((item) => (
                                <a key={item.title} className="list-item" href="#">
                                    <div>
                                        <p className="list-title">{item.title}</p>
                                        <p className="list-subtitle">{item.subtitle}</p>
                                    </div>
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="widget">
                        <div className="widget__row">
                            <h3 className="with-icon">
                                <span className="material-symbols-outlined">filter_alt</span>
                                {t('jobs-widget-saved-filters')}
                            </h3>
                            <button className="tiny-link">{t('jobs-widget-edit')}</button>
                        </div>
                        <div className="filter-badges">
                            {savedFilters.map((filter) => (
                                <button key={filter} className="badge-btn">{filter}</button>
                            ))}
                        </div>
                    </div>

                    <div className="widget premium-card">
                        <div className="premium-icon">
                            <span className="material-symbols-outlined">rocket_launch</span>
                        </div>
                        <h3>{t('jobs-premium-title')}</h3>
                        <p>{t('jobs-premium-copy')}</p>
                        <button className="tiny-link">
                            {t('jobs-premium-cta')}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                </aside>
            </div>

            <div className="pagination">
                <button
                    className="page-btn"
                    disabled={page === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                    <span className="material-symbols-outlined">chevron_left</span>
                    {t('jobs-pagination-prev')}
                </button>
                <div className="page-dots" aria-live="polite">
                    {t('jobs-pagination-page')} {page} {t('jobs-pagination-of')} {totalPages}
                </div>
                <button
                    className="page-btn"
                    disabled={page === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                    {t('jobs-pagination-next')}
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
            </div>
        </div>
    );
};

export default FindJobs;
