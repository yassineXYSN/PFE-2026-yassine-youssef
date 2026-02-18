import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GlareHover from '../Analytics/components/GlareHover/GlareHover';
import { jobs } from './FindJobs';
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

const JobDetail = () => {
  const { t } = useLanguage();
  const { jobId } = useParams();
  const navigate = useNavigate();

  const job = useMemo(() => jobs.find((j) => j.id === jobId), [jobId]);

  if (!job) {
    return (
      <div className="job-detail-page">
        <div className="job-detail-empty">
          <p>{t('jobdetail-not-found')}</p>
          <button className="ghost-btn" onClick={() => navigate('/candidat/dashboard/find-jobs')}>
            {t('jobdetail-back-to-list')}
          </button>
        </div>
      </div>
    );
  }

  const salaryRange = job.salaryMin && job.salaryMax ? `$${job.salaryMin}k - $${job.salaryMax}k` : 'Competitive';
  const description = job.description || `We are looking for a ${job.title} to join ${job.company} and help build impactful products.`;
  const responsibilities = job.responsibilities || defaultResponsibilities;
  const requirements = job.requirements || defaultRequirements;
  const perks = job.perks || defaultPerks;
  const company = job.companyInfo || defaultCompany;

  const workSetting = job.jobType ? job.jobType.charAt(0).toUpperCase() + job.jobType.slice(1) : 'Flexible';
  const experience = job.experienceLevel ? job.experienceLevel.toUpperCase() : 'ALL_LEVELS';
  const experienceLabel = experience === 'SENIOR' ? t('jobdetail-senior-level') : experience === 'ALL_LEVELS' ? t('jobdetail-all-levels') : experience;

  return (
    <div className="job-detail-page">
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
              <img src={job.logo} alt={`${job.company} logo`} />
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
            <button className="apply-btn" onClick={() => alert(`Applying to ${job.title}`)}>{t('jobdetail-apply')}</button>
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

      <div className="job-layout">
        <div className="job-main">
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

        <aside className="job-sidebar">
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
    </div>
  );
};

export default JobDetail;
