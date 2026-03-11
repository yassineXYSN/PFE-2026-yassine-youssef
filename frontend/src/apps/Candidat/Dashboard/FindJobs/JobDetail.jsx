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
  mapImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSC9YSBO0wsU--0WW3dgM6bmxrs6rl0Azjo_vrnwBX-rJx7_qcH-dRkBMQP3h8KP3O0Y-0l3z9ZJ4QcOG5y02SxUgtmHhH1BecDNYCy5L-EmHtU-3qwAAXk5ekpCZedy2IuMqerh0r4JeSbdLS0NU-ZMhKJpgTmY0v7N6qZJt-Xx4pMX9ANOINVREIltE_qBZDGNJ-UgyJBWRE18X1La6mjG7u6imNVDPctYqYLui6Fucr7m4Pb5yGAtlHWgY-UmXejVelRcPnUSM',
  address: '510 Townsend St, San Francisco, CA 94103',
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
    fetchJob();
    checkAppliedStatus();
  }, [jobId]);

  useEffect(() => {
    if (location.state?.openApply && !loading && job) {
      setShowApplyModal(true);
      // Clear state so it doesn't reopen on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, loading, job, navigate, location.pathname]);

  const handleApply = async () => {
    if (!motivationLetter.trim()) return;
    
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
      alert(t('jobdetail-apply-success') || 'Application submitted successfully!');
    } catch (err) {
      console.error('Application error:', err);
      alert(err.message || 'Failed to submit application');
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
  const responsibilities = job.responsibilities || defaultResponsibilities;
  const requirements = job.requirements || defaultRequirements;
  const perks = job.perks || defaultPerks;
  const company = defaultCompany;
  const workSetting = job.type ? job.type.charAt(0).toUpperCase() + job.type.slice(1) : 'Flexible';
  const experienceLabel = 'ALL_LEVELS';
  const logo = job.logo 
    ? (job.logo.startsWith('/') ? `${SERVER_URL}${job.logo}` : job.logo)
    : 'https://placeholder.pics/svg/200';

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
                <div className="match-pill">
                  {job.badgeIcon ? <span className="material-symbols-outlined">{job.badgeIcon}</span> : <span className="material-symbols-outlined">auto_awesome</span>}
                  <span>{job.match || 'High Match'}</span>
                </div>
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
                  {t(job.jobType === 'remote' ? 'jobdetail-remote-friendly' : 'jobdetail-worktype')}
                </span>
              </div>
            </div>
          </div>
          <div className="job-hero__actions">
            <button className="icon-btn subtle" aria-label={t('jobdetail-save')}>
              <span className="material-symbols-outlined">bookmark</span>
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
        <div className="meta-card">
          <div className="meta-icon meta-icon--purple">
            <span className="material-symbols-outlined">calendar_today</span>
          </div>
          <div>
            <p className="meta-label">{t('jobdetail-date-posted')}</p>
            <p className="meta-value">{job.posted}</p>
          </div>
        </div>
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
            <h2 className="section-title">{t('jobdetail-responsibilities')}</h2>
            <ul className="icon-list">
              {responsibilities.map((item) => (
                <li key={item} className="icon-list__item">
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="detail-section">
            <h2 className="section-title">{t('jobdetail-requirements')}</h2>
            <ul className="icon-list">
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
            <p className="sidebar-muted">{t('jobdetail-match-copy')}</p>
            <div className="progress">
              <div className="progress__bar" style={{ width: '92%' }} />
            </div>
            <ul className="insight-list">
              <li className="insight positive">
                <span className="material-symbols-outlined">check_circle</span>
                {t('jobdetail-match-skill')}
              </li>
              <li className="insight positive">
                <span className="material-symbols-outlined">check_circle</span>
                {t('jobdetail-match-industry')}
              </li>
              <li className="insight caution">
                <span className="material-symbols-outlined">info</span>
                {t('jobdetail-match-salary')}
              </li>
            </ul>
          </div>

          <div className="sidebar-card">
            <h3>{`${t('jobdetail-about')} ${job.company}`}</h3>
            <p className="sidebar-muted">{company.about}</p>
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
            <div className="map-thumb" style={{ backgroundImage: `url(${company.mapImage})` }} aria-label={`Map view of ${job.location}`} />
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
                <label>{t('jobdetail-motivation-label') || 'Motivation Letter'}</label>
                <textarea 
                  className="apply-modal__textarea"
                  placeholder={t('jobdetail-motivation-placeholder') || 'Tell the employer why you are a great fit for this role...'}
                  value={motivationLetter}
                  onChange={e => setMotivationLetter(e.target.value)}
                />
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
                disabled={submitting || !motivationLetter.trim()}
              >
                {submitting ? (t('common-submitting') || 'Submitting...') : (t('jobdetail-submit-app') || 'Submit Application')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetail;
