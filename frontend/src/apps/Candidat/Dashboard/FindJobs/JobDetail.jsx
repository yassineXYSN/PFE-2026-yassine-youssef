import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { SERVER_URL } from '../../../../core/api';
import GlareHover from '../Analytics/components/GlareHover/GlareHover';
import { jobs } from './jobsData';
import { useLanguage } from '../../../../core/useLanguage';
import './JobDetail.css';

const defaultResponsibilities = [
  'Own end-to-end feature delivery from discovery to launch with cross-functional partners.',
  'Ship high-quality code with attention to accessibility, performance, and reliability.',
  'Collaborate closely with design to refine interactions and micro-details.',
  'Instrument analytics and iterate based on user feedback and data.',
  'Contribute to documentation and improve the engineering toolkit for the team.',
];

const defaultRequirements = [
  '3+ years of experience in a similar role shipping production features.',
  'Expertise with modern JavaScript and component-driven architectures.',
  'Comfort working in a fast-paced, product-minded environment.',
  'Strong communication skills and a bias for action.',
];

const defaultPerks = [
  { icon: 'medical_services', label: 'Health Insurance' },
  { icon: 'beach_access', label: 'Flexible PTO' },
  { icon: 'show_chart', label: 'Equity & Options' },
  { icon: 'fitness_center', label: 'Wellness Stipend' },
  { icon: 'computer', label: 'Home Office Budget' },
  { icon: 'child_care', label: 'Parental Leave' },
];

const defaultCompany = {
  about: 'Stripe is a financial infrastructure platform for businesses. Millions of companies—from the world’s largest enterprises to ambitious startups—use Stripe to accept payments, grow revenue, and accelerate new business opportunities.',
  industry: 'Financial Services',
  size: '5,000+ Employees',
  founded: '2010',
  address: 'San Francisco, CA',
};

const JobDetailSkeleton = () => {
  return (
    <div className="candidat-job-detail">
      <header className="job-detail-header">
        <div className="job-skeleton" style={{ width: '100px', height: '2.5rem' }}></div>
        <div className="job-skeleton" style={{ width: '200px', height: '1.5rem' }}></div>
      </header>

      <div className="job-hero__grid" style={{ minHeight: '180px' }}>
        <div className="job-hero__brand">
          <div className="job-skeleton job-skeleton--avatar" style={{ width: '90px', height: '90px' }}></div>
          <div className="job-hero__text" style={{ flex: 1 }}>
            <div className="job-skeleton job-skeleton--title" style={{ marginBottom: '1rem' }}></div>
            <div className="job-hero__meta" style={{ gap: '1.5rem' }}>
              <div className="job-skeleton" style={{ width: '120px', height: '1.2rem' }}></div>
              <div className="job-skeleton" style={{ width: '120px', height: '1.2rem' }}></div>
              <div className="job-skeleton" style={{ width: '120px', height: '1.2rem' }}></div>
            </div>
          </div>
        </div>
        <div className="job-hero__actions">
          <div className="job-skeleton" style={{ width: '46px', height: '46px', borderRadius: '50%' }}></div>
          <div className="job-skeleton" style={{ width: '46px', height: '46px', borderRadius: '50%' }}></div>
          <div className="job-skeleton job-skeleton--btn" style={{ width: '140px' }}></div>
        </div>
      </div>

      <div className="job-meta-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="meta-card" style={{ border: 'none' }}>
            <div className="job-skeleton job-skeleton--icon-circle"></div>
            <div style={{ flex: 1 }}>
              <div className="job-skeleton" style={{ width: '60px', height: '0.8rem', marginBottom: '0.4rem' }}></div>
              <div className="job-skeleton" style={{ width: '100px', height: '1.1rem' }}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="candidat-job-layout">
        <div className="candidat-job-main">
          {/* Role Overview */}
          <div className="detail-section">
            <div className="job-skeleton" style={{ width: '180px', height: '1.8rem', marginBottom: '1.5rem' }}></div>
            <div className="paragraphs">
              <div className="job-skeleton" style={{ height: '1rem', width: '100%' }}></div>
              <div className="job-skeleton" style={{ height: '1rem', width: '95%' }}></div>
              <div className="job-skeleton" style={{ height: '1rem', width: '98%' }}></div>
              <div className="job-skeleton" style={{ height: '1rem', width: '90%' }}></div>
            </div>
          </div>

          {/* Responsibilities & Requirements */}
          {[1, 2].map(section => (
            <div key={section} className="detail-section">
              <div className="job-skeleton" style={{ width: '220px', height: '1.8rem', marginBottom: '1.5rem' }}></div>
              <div className="icon-list">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="job-skeleton--list-item">
                    <div className="job-skeleton job-skeleton--bullet"></div>
                    <div className="job-skeleton" style={{ height: '1rem', width: '85%' }}></div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Perks */}
          <div className="detail-section">
            <div className="job-skeleton" style={{ width: '150px', height: '1.8rem', marginBottom: '1.5rem' }}></div>
            <div className="perks-grid">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="job-skeleton job-skeleton--pill-small"></div>
              ))}
            </div>
          </div>
        </div>

        <aside className="candidat-job-sidebar">
          {/* Match Insight */}
          <div className="sidebar-card">
            <div className="job-skeleton" style={{ width: '140px', height: '1.5rem', marginBottom: '1rem' }}></div>
            <div className="job-skeleton" style={{ width: '100%', height: '3rem', marginBottom: '1.5rem' }}></div>
            <div className="job-skeleton" style={{ width: '100%', height: '0.8rem', borderRadius: '999px', marginBottom: '1.5rem' }}></div>
            <div className="insight-list">
              {[1, 2, 3].map(i => (
                <div key={i} className="job-skeleton--insight-item job-skeleton"></div>
              ))}
            </div>
          </div>

          {/* About Company */}
          <div className="sidebar-card">
            <div className="job-skeleton" style={{ width: '160px', height: '1.5rem', marginBottom: '1.25rem' }}></div>
            <div className="job-skeleton" style={{ width: '100%', height: '5rem', marginBottom: '1.5rem' }}></div>
            <div className="sidebar-split">
              {[1, 2, 3].map(i => (
                <div key={i}>
                  <div className="job-skeleton" style={{ width: '60px', height: '0.8rem', marginBottom: '0.3rem' }}></div>
                  <div className="job-skeleton" style={{ width: '80px', height: '1rem' }}></div>
                </div>
              ))}
            </div>
            <div className="job-skeleton" style={{ width: '100%', height: '3.5rem', borderRadius: '1rem', marginTop: '1rem' }}></div>
          </div>

          {/* Map */}
          <div className="sidebar-card" style={{ padding: 0, height: '240px' }}>
            <div className="job-skeleton" style={{ width: '100%', height: '160px' }}></div>
            <div style={{ padding: '1.5rem' }}>
              <div className="job-skeleton" style={{ width: '120px', height: '1.2rem', marginBottom: '0.5rem' }}></div>
              <div className="job-skeleton" style={{ width: '180px', height: '1rem' }}></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const JobDetail = () => {

  const { t } = useLanguage();
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [motivationLetter, setMotivationLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [motivationError, setMotivationError] = useState(false);
  const [toast, setToast] = useState(null);
  const [matchScore, setMatchScore] = useState(null);
  const [matchTone, setMatchTone] = useState('muted');
  const [matchLoading, setMatchLoading] = useState(true);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function fetchJob() {
      setLoading(true);
      try {
        const { apiFetch } = await import('../../../../core/api');
        const jobData = await apiFetch(`/jobs/${jobId}`);
        setJob(jobData);
      } catch (err) {
        setError('Job not found');
      } finally {
        setLoading(false);
      }
    }
    async function checkAppliedStatus() {
      try {
        const { apiFetch } = await import('../../../../core/api');
        const status = await apiFetch(`/applications/check/${jobId}`);
        if (status.applied) {
          setApplied(true);
        }
      } catch (err) {
        console.error('Error checking application status:', err);
      }
    }
    async function checkSavedStatus() {
      try {
        const { apiFetch } = await import('../../../../core/api');
        const savedIds = await apiFetch('/jobs/saved');
        if (savedIds.includes(jobId)) {
          setSaved(true);
        }
      } catch (err) {
        console.error('Error checking saved status:', err);
      }
    }
    async function fetchMatchScore() {
      setMatchLoading(true);
      try {
        const { apiFetch } = await import('../../../../core/api');
        const data = await apiFetch(`/candidat/jobs/match/${jobId}`);
        setMatchScore(data.match_score ?? null);
        setMatchTone(data.matchTone || 'muted');
      } catch (err) {
        console.error('Match score fetch error:', err);
      } finally {
        setMatchLoading(false);
      }
    }
    fetchJob();
    checkAppliedStatus();
    checkSavedStatus();
    fetchMatchScore();
  }, [jobId]);

  useEffect(() => {
    if (location.state?.openApply && !loading && job) {
      setShowApplyModal(true);
      // Clear state so it doesn't reopen on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, loading, job, navigate, location.pathname]);

  const toggleBookmark = async () => {
    try {
      const { apiFetch } = await import('../../../../core/api');
      const response = await apiFetch(`/jobs/saved/${jobId}`, { method: 'POST' });
      setSaved(response.saved);
    } catch (err) {
      console.error('Toggle bookmark error:', err);
    }
  };

  const handleApply = async () => {
    if (job.require_motivation_letter && !motivationLetter.trim()) {
      setMotivationError(true);
      return;
    }
    setMotivationError(false);

    setSubmitting(true);
    try {
      const { apiFetch } = await import('../../../../core/api');
      await apiFetch('/applications/apply', {
        method: 'POST',
        body: JSON.stringify({
          job_id: jobId,
          motivation_letter: motivationLetter
        })
      });
      setApplied(true);
      setShowApplyModal(false);
      showToast(t('jobdetail-apply-success') || 'Candidature envoyée avec succès !', 'success');
    } catch (err) {
      console.error('Application error:', err);
      showToast(err.message || "Erreur lors de l'envoi de la candidature.", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <JobDetailSkeleton />;
  }
  if (error || !job) {
    return (
      <div className="candidat-job-detail">
        <div className="job-detail-empty">
          <p>{t('jobdetail-not-found')}</p>
          <button className="ghost-btn" onClick={() => navigate('/candidat/dashboard/find-jobs')}>
            {t('jobdetail-back-to-list')}
          </button>
        </div>
      </div>
    );
  }

  const salaryRange = job.salary_range || 'Competitive';
  const description = job.description || `We are looking for a ${job.title} to help build impactful products.`;

  // New structure mapping (precisely as in the document)
  const requirements = Array.isArray(job.requirements) ? job.requirements : defaultRequirements;

  // Robustly handle 'benefits' or 'benfits' from database
  let databaseBenefits = [];
  if (Array.isArray(job.benefits) && job.benefits.length > 0) {
    databaseBenefits = job.benefits;
  } else if (Array.isArray(job.benfits) && job.benfits.length > 0) {
    databaseBenefits = job.benfits;
  }

  const perks = databaseBenefits.length > 0
    ? databaseBenefits.map(b => (typeof b === 'string' ? { icon: 'star', label: b } : b))
    : defaultPerks;

  // Use real company data from the job object (joined in backend)
  const companyName = job.company || 'HumatiQ Partner';
  const company = {
    about: job.company_about || defaultCompany.about,
    industry: job.company_industry || defaultCompany.industry,
    size: job.company_size || defaultCompany.size,
    founded: job.company_founded || defaultCompany.founded,
    address: job.company_address || defaultCompany.address
  };

  const workSetting = job.work_mode ? job.work_mode.charAt(0).toUpperCase() + job.work_mode.slice(1) : 'Flexible';

  // Map experience level to translation keys
  const experienceKey = job.experience_level ? `jobdetail-seniority-${job.experience_level.toLowerCase()}` : 'jobdetail-all-levels';
  const experienceLabel = t(experienceKey);

  const jobTypeCode = job.type?.toLowerCase();
  const jobTypeLabel = jobTypeCode === 'cdi' ? t('jobdetail-type-cdi') : (jobTypeCode === 'cdd' ? t('jobdetail-type-cdd') : t('jobdetail-worktype'));

  const logo = job.logo
    ? (job.logo.startsWith('http') ? job.logo : `${SERVER_URL}${job.logo}`)
    : 'https://placeholder.pics/svg/200';

  const postedDate = job.created_at?.$date ? new Date(job.created_at.$date).toLocaleDateString() : (job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Recently');
  const deadlineDate = (job.deadline && job.deadline.trim() !== "") ? new Date(job.deadline).toLocaleDateString() : null;
  const screeningQuestions = Array.isArray(job.screening_questions) ? job.screening_questions : [];

  return (
    <div className="candidat-job-detail">
      <header className="job-detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <span className="material-symbols-outlined">arrow_back</span>
          {t('jobdetail-back')}
        </button>
        <nav className="job-detail-breadcrumbs" aria-label="breadcrumb">
          <span
            onClick={() => navigate('/candidat/dashboard/find-jobs')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/candidat/dashboard/find-jobs');
              }
            }}
          >
            {t('jobs-breadcrumb')}
          </span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{job.title}</span>
        </nav>
      </header>

      <GlareHover
        className="job-hero"
        background="var(--jobs-surface)"
        borderRadius="1.5rem"
        borderColor="var(--jobs-border)"
        glareOpacity={0.4}
        glareSize={260}
      >
        <div className="job-hero__grid">
          <div className="job-hero__brand">
            <div className="job-logo job-logo--lg">
              <img src={logo} alt={`${job.company} logo`} />
            </div>
            <div className="job-hero__text">
              <div className="job-hero__title-row">
                <h1 className="job-detail-title">{job.title}</h1>
                <div className={`match-pill match-pill--${matchTone}`}>
                  <span className="material-symbols-outlined">auto_awesome</span>
                  <span>
                    {matchLoading ? '...' : matchScore !== null ? `${matchScore}%` : (job.match || '—')}
                  </span>
                </div>
                {applied && (
                  <div className="status-pill status-pill--applied">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>{t('jobdetail-applied') || 'Applied'}</span>
                  </div>
                )}
              </div>
              <div className="job-hero__meta">
                <span className="meta-line">
                  <span className="material-symbols-outlined">corporate_fare</span>
                  {job.company}
                </span>
                <span className="meta-line">
                  <span className="material-symbols-outlined">location_on</span>
                  {job.location}
                </span>
                <span className="meta-line">
                  <span className="material-symbols-outlined">schedule</span>
                  {jobTypeLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="job-hero__actions">
            <button
              className={`icon-btn subtle ${saved ? 'is-active' : ''}`}
              aria-label={t('jobdetail-save')}
              onClick={toggleBookmark}
            >
              <span className="material-symbols-outlined">
                {saved ? 'bookmark_added' : 'bookmark'}
              </span>
            </button>
            <button className="icon-btn subtle" aria-label={t('jobdetail-share')}>
              <span className="material-symbols-outlined">share</span>
            </button>
            <button
              className={`apply-btn ${applied ? 'applied' : ''}`}
              onClick={() => applied ? null : setShowApplyModal(true)}
              disabled={applied}
            >
              {applied ? t('jobdetail-applied') || 'Applied' : t('jobdetail-apply')}
            </button>
          </div>
        </div>
      </GlareHover>

      <section className="job-meta-grid" aria-label="Job meta">
        <div className="meta-card">
          <div className="meta-icon meta-icon--blue">
            <span className="material-symbols-outlined">payments</span>
          </div>
          <div>
            <p className="meta-label">{t('jobdetail-salary')}</p>
            <p className="meta-value">{salaryRange}</p>
          </div>
        </div>
        <div className="meta-card">
          <div className="meta-icon meta-icon--green">
            <span className="material-symbols-outlined">distance</span>
          </div>
          <div>
            <p className="meta-label">{t('jobdetail-work-setting')}</p>
            <p className="meta-value">{workSetting === 'Remote' ? t('jobdetail-remote-friendly') : workSetting}</p>
          </div>
        </div>
        <div className="meta-card">
          <div className="meta-icon meta-icon--amber">
            <span className="material-symbols-outlined">verified_user</span>
          </div>
          <div>
            <p className="meta-label">{t('jobdetail-seniority')}</p>
            <p className="meta-value">{experienceLabel}</p>
          </div>
        </div>
        {deadlineDate && (
          <div className="meta-card">
            <div className="meta-icon meta-icon--purple">
              <span className="material-symbols-outlined">event_available</span>
            </div>
            <div>
              <p className="meta-label">{t('jobdetail-deadline')}</p>
              <p className="meta-value">{deadlineDate}</p>
            </div>
          </div>
        )}
        {!deadlineDate && (
          <div className="meta-card">
            <div className="meta-icon meta-icon--blue-grey">
              <span className="material-symbols-outlined">calendar_today</span>
            </div>
            <div>
              <p className="meta-label">{t('jobdetail-date-posted')}</p>
              <p className="meta-value">{postedDate}</p>
            </div>
          </div>
        )}
      </section>

      <div className="candidat-job-layout">
        <div className="candidat-job-main">
          <section className="detail-section">
            <h2 className="section-title">{t('jobdetail-role-overview')}</h2>
            <div className="paragraphs">
              {description.split('\n').map((para) => (
                <p key={para}>{para}</p>
              ))}
            </div>
          </section>


          <section className="detail-section">
            <h2 className="section-title">{t('jobdetail-requirements')}</h2>
            <ul className="icon-list">
              {/* Mandatory Screening Questions First */}
              {screeningQuestions.map((q) => (
                <li key={q} className="icon-list__item requirement--priority">
                  <span className="material-symbols-outlined requirement__icon--priority">priority_high</span>
                  <span>{q}</span>
                </li>
              ))}

              {/* Regular Requirements */}
              {requirements.map((item) => (
                <li key={item} className="icon-list__item">
                  <span className="material-symbols-outlined text-primary">radio_button_unchecked</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="detail-section">
            <h2 className="section-title">{t('jobdetail-perks')}</h2>
            <div className="perks-grid">
              {perks.map((perk) => (
                <div key={perk.label || perk} className="perk-pill">
                  <span className="material-symbols-outlined text-primary">{perk.icon || 'star'}</span>
                  <span>{perk.label || perk}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="candidat-job-sidebar">
          <div className="sidebar-card sidebar-card--match">
            <div className="sidebar-card__header">
              <h3>{t('jobdetail-match-insight')}</h3>
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
            </div>
            {matchLoading ? (
              <>
                <div className="job-skeleton" style={{ width: '60%', height: '1.2rem', marginBottom: '1rem' }} />
                <div className="job-skeleton" style={{ width: '100%', height: '0.7rem', borderRadius: '999px', marginBottom: '1.5rem' }} />
              </>
            ) : (
              <>
                <p className="sidebar-muted">
                  {matchScore !== null
                    ? `${t('jobdetail-match-copy') || 'AI compatibility score based on your profile.'}`
                    : t('jobdetail-match-copy')}
                </p>
                <div className="match-score-display" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, color: matchScore >= 70 ? 'var(--color-success, #22c55e)' : matchScore >= 40 ? 'var(--color-warning, #f59e0b)' : 'var(--jobs-text-secondary)' }}>
                    {matchScore !== null ? matchScore : '—'}
                  </span>
                  {matchScore !== null && <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--jobs-text-secondary)' }}>%</span>}
                </div>
                <div className="progress" aria-label={`Match score ${matchScore ?? 0}%`}>
                  <div className="progress__bar" style={{ width: `${matchScore ?? 0}%`, background: matchScore >= 70 ? 'var(--color-success, #22c55e)' : matchScore >= 40 ? 'var(--color-warning, #f59e0b)' : undefined }} />
                </div>
                <ul className="insight-list" style={{ marginTop: '1rem' }}>
                  {matchScore >= 70 && (
                    <li className="insight positive">
                      <span className="material-symbols-outlined">check_circle</span>
                      {t('jobdetail-match-skill')}
                    </li>
                  )}
                  {matchScore >= 40 && (
                    <li className="insight positive">
                      <span className="material-symbols-outlined">check_circle</span>
                      {t('jobdetail-match-industry')}
                    </li>
                  )}
                  {(matchScore === null || matchScore < 70) && (
                    <li className="insight caution">
                      <span className="material-symbols-outlined">info</span>
                      {matchScore !== null && matchScore < 40
                        ? (t('jobdetail-match-low') || 'Complete your profile to improve your score')
                        : t('jobdetail-match-salary')}
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>

          <div className="sidebar-card">
            <h3>{t('jobdetail-about-title')} {companyName}</h3>
            <div className="paragraphs">
              <p>{company.about}</p>
            </div>
            <div className="sidebar-split">
              <div>
                <p className="sidebar-label">{t('jobdetail-company-industry')}</p>
                <p className="sidebar-value">{company.industry}</p>
              </div>
              <div>
                <p className="sidebar-label">{t('jobdetail-company-size')}</p>
                <p className="sidebar-value">{company.size}</p>
              </div>
              <div>
                <p className="sidebar-label">{t('jobdetail-company-founded')}</p>
                <p className="sidebar-value">{company.founded}</p>
              </div>
            </div>
            <button className="sidebar-link" onClick={() => alert('Open company page')}>
              {t('jobdetail-company-link')}
            </button>
          </div>

          <div className="sidebar-card sidebar-card--map">
            <div className="map-container">
              <iframe
                className="map-frame"
                title="Company Location"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(company.address)}&t=&z=14&ie=UTF8&iwloc=B&output=embed`}
                frameBorder="0"
                scrolling="no"
                marginHeight="0"
                marginWidth="0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="map-overlay-link"
                title="View on Google Maps"
              >
                <span>View on Maps</span>
              </a>
            </div>
            <div className="map-body">
              <p className="map-title">{t('jobdetail-map-title')}</p>
              <p className="map-address">{company.address}</p>
            </div>
          </div>
        </aside>
      </div>

      {showApplyModal && (
        <div className="apply-modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="apply-modal" onClick={e => e.stopPropagation()}>
            <div className="apply-modal__header">
              <h2>{t('jobdetail-apply-title') || 'Job Application'}</h2>
              <button className="apply-modal__close" onClick={() => setShowApplyModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="apply-modal__content">
              <div className="apply-modal__job-summary">
                <img src={logo} alt={job.company} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{job.title}</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--jobs-text-secondary)' }}>{job.company}</p>
                </div>
              </div>

              <div className="apply-modal__form-group">
                <label>
                  {t('jobdetail-motivation-label') || 'Motivation Letter'} 
                  {!job.require_motivation_letter && <span style={{ fontWeight: 'normal', color: 'var(--jobs-text-secondary)', marginLeft: '0.5rem' }}>(Optionnel)</span>}
                  {job.require_motivation_letter && <span style={{ color: 'var(--color-danger, #ef4444)', marginLeft: '0.25rem' }}>*</span>}
                </label>
                <textarea
                  className={`apply-modal__textarea ${motivationError ? 'has-error' : ''}`}
                  style={motivationError ? { borderColor: 'var(--color-danger, #ef4444)', boxShadow: '0 0 0 1px var(--color-danger, #ef4444)' } : {}}
                  placeholder={t('jobdetail-motivation-placeholder') || 'Tell the employer why you are a great fit for this role...'}
                  value={motivationLetter}
                  onChange={e => {
                    setMotivationLetter(e.target.value);
                    if (motivationError) setMotivationError(false);
                  }}
                />
                {motivationError && (
                  <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.85rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>error</span>
                    {t('jobdetail-motivation-required') || 'La lettre de motivation est obligatoire pour cette offre.'}
                  </span>
                )}
              </div>

              <div className="apply-modal__profile-note">
                <span className="material-symbols-outlined">info</span>
                <p style={{ margin: 0 }}>
                  {t('jobdetail-profile-note') || 'A snapshot of your current profile highlights (skills, experience, and education) will be included with your application.'}
                </p>
              </div>
            </div>
            <div className="apply-modal__footer">
              <button className="ghost-btn" onClick={() => setShowApplyModal(false)}>
                {t('common-cancel') || 'Cancel'}
              </button>
              <button
                className="apply-btn"
                onClick={handleApply}
                disabled={submitting}
              >
                {submitting ? (t('common-submitting') || 'Submitting...') : (t('jobdetail-submit-app') || 'Submit Application')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '2rem',
          right: '2rem',
          backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          zIndex: 9999,
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <span className="material-symbols-outlined">
            {toast.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default JobDetail;
