import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../../core/useLanguage';
import { SERVER_URL } from '../../../../core/api';
import Skeleton from '../components/Skeleton/Skeleton';
import './MySubmissions.css';

const MySubmissions = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('last-updated');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveNow, setLiveNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setLiveNow(new Date()), 30000); // Check every 30s
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const { apiFetch } = await import('../../../../core/api');
        const data = await apiFetch('/applications/my-applications');
        const enrichedData = data.map(app => ({
          ...app,
          company_logo: app.company_logo
            ? (app.company_logo.startsWith('/') ? `${SERVER_URL}${app.company_logo}` : app.company_logo)
            : 'https://placeholder.pics/svg/200'
        }));
        setApplications(enrichedData);
      } catch (err) {
        console.error('Error fetching submissions:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubmissions();
    const pollTimer = setInterval(fetchSubmissions, 30000); // Poll for status updates every 30s
    return () => clearInterval(pollTimer);
  }, []);

  const handleImageError = (event) => {
    event.currentTarget.src = 'https://placeholder.pics/svg/200';
  };

  const getStatusDetails = (status, interviewStatus) => {
    const details = {
      pending: {
        label: t('submissions-filter-applied'),
        colorClass: 'my-submissions__status--applied',
        progress: 0,
        timeline: [
          { label: t('submissions-timeline-applied'), active: true, current: true },
          { label: t('submissions-timeline-review'), active: false },
          { label: t('submissions-timeline-quiz'), active: false },
          { label: t('submissions-timeline-interview'), active: false },
          { label: t('submissions-timeline-offer'), active: false },
        ]
      },
      reviewed: {
        label: t('submissions-filter-review'),
        colorClass: 'my-submissions__status--review',
        progress: 25,
        timeline: [
          { label: t('submissions-timeline-applied'), active: true },
          { label: t('submissions-timeline-review'), active: true, current: true },
          { label: t('submissions-timeline-quiz'), active: false },
          { label: t('submissions-timeline-interview'), active: false },
          { label: t('submissions-timeline-offer'), active: false },
        ]
      },
      quiz: {
        label: t('submissions-filter-quiz'),
        colorClass: 'my-submissions__status--quiz',
        progress: 50,
        timeline: [
          { label: t('submissions-timeline-applied'), active: true },
          { label: t('submissions-timeline-review'), active: true },
          { label: t('submissions-timeline-quiz'), active: true, current: true },
          { label: t('submissions-timeline-interview'), active: false },
          { label: t('submissions-timeline-offer'), active: false },
        ]
      },
      interview: {
        label: (() => {
          if (interviewStatus === 'completed' || interviewStatus === 'ended')
            return t('language') === 'fr' ? 'Entretien Terminé' : 'Interview Completed';
          if (interviewStatus === 'missed')
            return t('language') === 'fr' ? 'Entretien Manqué' : 'Interview Missed';
          if (interviewStatus === 'in_progress')
            return t('language') === 'fr' ? 'Entretien en cours' : 'Interviewing';
          return t('language') === 'fr' ? 'Entretien Planifié' : 'Interview Scheduled';
        })(),
        colorClass: (() => {
          if (interviewStatus === 'completed' || interviewStatus === 'ended') return 'my-submissions__status--applied';
          if (interviewStatus === 'missed') return 'my-submissions__status--rejected'; // Red badge
          if (interviewStatus === 'in_progress') return 'my-submissions__status--interview';
          return 'my-submissions__status--quiz'; // Blue for scheduled/confirmed
        })(),
        progress: 75,
        timeline: [
          { label: t('submissions-timeline-applied'), active: true },
          { label: t('submissions-timeline-review'), active: true },
          { label: t('submissions-timeline-quiz'), active: true },
          { label: t('submissions-timeline-interview'), active: true, current: true },
          { label: t('submissions-timeline-offer'), active: false },
        ]
      },
      accepted: {
        label: t('submissions-filter-offer'),
        colorClass: 'my-submissions__status--applied',
        progress: 100,
        timeline: [
          { label: t('submissions-timeline-applied'), active: true },
          { label: t('submissions-timeline-review'), active: true },
          { label: t('submissions-timeline-quiz'), active: true },
          { label: t('submissions-timeline-interview'), active: true },
          { label: t('submissions-timeline-offer'), active: true, current: true },
        ]
      },
      rejected: {
        label: 'Rejected',
        colorClass: 'my-submissions__status--rejected',
        progress: 100,
        timeline: [
          { label: t('submissions-timeline-applied'), active: true },
          { label: 'Rejected', active: true, current: true, isError: true },
        ]
      }
    };
    return details[status] || details.pending;
  };

  const stats = useMemo(() => {
    return [
      {
        label: t('submissions-total'),
        value: applications.length,
        icon: 'folder_open',
        subtext: null,
        isHighlight: false,
      },
      {
        label: t('submissions-pending'),
        value: applications.filter(a => a.status === 'pending' || a.status === 'reviewed').length,
        icon: 'hourglass_empty',
        subtext: null,
        isHighlight: false,
      },
      {
        label: t('submissions-interviews'),
        value: applications.filter(a => a.status === 'interview').length,
        icon: 'groups',
        subtext: null,
        isHighlight: true,
      },
      {
        label: t('submissions-offers'),
        value: applications.filter(a => a.status === 'accepted').length,
        icon: 'celebration',
        subtext: null,
        isHighlight: false,
      },
    ];
  }, [applications, t]);

  const filters = [
    { id: 'all', label: t('submissions-filter-all'), icon: 'view_list' },
    { id: 'pending', label: t('submissions-filter-applied'), icon: 'schedule' },
    { id: 'reviewed', label: t('submissions-filter-review'), icon: 'clock_loader_40' },
    { id: 'quiz', label: t('submissions-filter-quiz'), icon: 'quiz' },
    { id: 'interview', label: t('submissions-filter-interview'), icon: 'groups' },
    { id: 'accepted', label: t('submissions-filter-offer'), icon: 'check_circle' },
  ];

  const filteredApplications = useMemo(() => {
    let result = applications.filter((app) => {
      if (activeFilter !== 'all' && app.status !== activeFilter) return false;
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase();
        return (
          app.job_title?.toLowerCase().includes(term) ||
          app.company_name?.toLowerCase().includes(term)
        );
      }
      return true;
    });

    if (sortBy === 'last-updated') {
      result.sort((a, b) => new Date(b.updated_at || b.applied_at) - new Date(a.updated_at || a.applied_at));
    } else if (sortBy === 'date-applied') {
      result.sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at));
    } else if (sortBy === 'salary') {
      // Basic salary sort (might need better parsing if format varies)
      result.sort((a, b) => (b.salary || '').localeCompare(a.salary || ''));
    }

    return result;
  }, [applications, activeFilter, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="my-submissions">
        {/* Header Skeleton */}
        <div className="my-submissions__header">
          <Skeleton variant="text" width="200px" height="2.5rem" style={{ marginBottom: '0.5rem' }} />
          <Skeleton variant="text" width="300px" height="1rem" />
        </div>

        {/* Stats Skeleton */}
        <div className="my-submissions__stats">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="my-submissions__stat-card">
              <div className="my-submissions__stat-header">
                <Skeleton variant="text" width="80px" height="0.9rem" />
                <Skeleton variant="circle" width="24px" height="24px" />
              </div>
              <div className="my-submissions__stat-content" style={{ marginTop: '0.5rem' }}>
                <Skeleton variant="text" width="40px" height="2rem" />
              </div>
            </div>
          ))}
        </div>

        {/* Filters Skeleton */}
        <div className="my-submissions__controls">
          <div className="my-submissions__filters">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} variant="rectangle" width="100px" height="2.5rem" style={{ borderRadius: '0.6rem' }} />
            ))}
          </div>
        </div>

        {/* List Skeleton */}
        <div className="my-submissions__list">
          {[1, 2, 3].map(i => (
            <div key={i} className="my-submissions__card skeleton-card">
              <div className="my-submissions__card-header">
                <div className="my-submissions__card-info">
                  <Skeleton variant="circle" width="60px" height="60px" />
                  <div>
                    <Skeleton variant="text" width="180px" height="1.2rem" style={{ marginBottom: '0.5rem' }} />
                    <Skeleton variant="text" width="120px" height="0.9rem" />
                  </div>
                </div>
                <div className="my-submissions__card-actions" style={{ gap: '0.5rem' }}>
                  <Skeleton variant="rectangle" width="100px" height="1.8rem" style={{ borderRadius: '2rem' }} />
                  <Skeleton variant="circle" width="32px" height="32px" />
                </div>
              </div>
              <div className="my-submissions__timeline-wrapper" style={{ marginTop: '2rem' }}>
                <Skeleton variant="rectangle" width="100%" height="40px" />
              </div>
              <div className="my-submissions__insight" style={{ marginTop: '1.5rem', border: 'none' }}>
                <div className="my-submissions__insight-content">
                  <Skeleton variant="circle" width="32px" height="32px" />
                  <div style={{ flex: 1 }}>
                    <Skeleton variant="text" width="120px" height="0.9rem" style={{ marginBottom: '0.4rem' }} />
                    <Skeleton variant="text" width="80%" height="0.8rem" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="my-submissions">
      {/* Header */}
      <div className="my-submissions__header">
        <h1 className="my-submissions__title">{t('submissions-title')}</h1>
        <p className="my-submissions__subtitle">
          {t('submissions-subtitle')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="my-submissions__stats">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`my-submissions__stat-card ${stat.isHighlight ? 'my-submissions__stat-card--highlight' : ''}`}
          >
            <div className="my-submissions__stat-header">
              <span className="my-submissions__stat-label">{stat.label}</span>
              <span className="material-symbols-outlined my-submissions__stat-icon">
                {stat.icon}
              </span>
            </div>
            <div className="my-submissions__stat-content">
              <span className="my-submissions__stat-value">{stat.value}</span>
              {stat.subtext && (
                <span className="my-submissions__stat-subtext" style={stat.subtextStyle}>
                  {stat.subtext}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Controls */}
      <div className="my-submissions__controls">
        <div className="my-submissions__filters">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`my-submissions__filter-btn ${activeFilter === filter.id ? 'my-submissions__filter-btn--active' : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
                {filter.icon}
              </span>
              <span>{filter.label}</span>
            </button>
          ))}
        </div>

        <div className="my-submissions__search-sort">
          <div className="my-submissions__search">
            <span className="material-symbols-outlined my-submissions__search-icon">search</span>
            <input
              type="text"
              placeholder={t('submissions-search-placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="my-submissions__search-input"
            />
          </div>
          <div className="my-submissions__sort">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="my-submissions__sort-select"
            >
              <option value="last-updated">{t('submissions-sort-updated')}</option>
              <option value="date-applied">{t('submissions-sort-applied')}</option>
              <option value="salary">{t('submissions-sort-salary')}</option>
            </select>
            <span className="material-symbols-outlined my-submissions__sort-icon">expand_more</span>
          </div>
        </div>
      </div>

      {/* Application List */}
      <div className="my-submissions__list">
        {filteredApplications.map((app) => {
          const details = getStatusDetails(app.status, app.interview_status);
          const appliedDate = new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <div key={app._id} className="my-submissions__card">
              <div className="my-submissions__card-header">
                <div className="my-submissions__card-info">
                  <div className="my-submissions__company-logo">
                    <img src={app.company_logo} alt={`${app.company_name} logo`} onError={handleImageError} />
                  </div>
                  <div>
                    <h3 className="my-submissions__position">{app.job_title}</h3>
                    <p className="my-submissions__company">
                      {app.company_name} • {app.location}
                    </p>
                    <div className="my-submissions__meta">
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>calendar_today</span>
                      <span>{t('submissions-applied')} {appliedDate}</span>
                      {app.salary && (
                        <>
                          <span style={{ color: 'var(--dashboard-border)' }}>|</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>payments</span>
                          <span>{app.salary}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="my-submissions__card-actions">
                  {console.log('DEBUG APP:', app._id, 'status:', app.status, 'iv_id:', app.interview_id, 'start:', app.interview_start_time)}
                  <div className={`my-submissions__status ${details.colorClass}`}>
                    {app.status === 'interview' && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>event_available</span>}
                    {app.status === 'reviewed' && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>rate_review</span>}
                    {app.status === 'pending' && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>forward_to_inbox</span>}
                    {app.status === 'quiz' && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>quiz</span>}
                    {details.label}
                  </div>
                  {/* Join Button logic */}
                  {(() => {
                    const iStatus = app.interview_status;
                    if (app.status !== 'interview') return null;
                    // Hard stops — never show join for these statuses
                    if (iStatus === 'completed' || iStatus === 'ended') return null;

                    // Missed interview: show a soft warning instead of join button
                    if (iStatus === 'missed') {
                      return (
                        <div style={{
                          fontSize: '0.72rem', color: '#ef4444', fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>event_busy</span>
                          {t('language') === 'fr' ? 'Entretien manqué' : 'Interview missed'}
                        </div>
                      );
                    }

                    const now = liveNow;
                    const start = new Date(app.interview_start_time);
                    const end = app.interview_end_time
                      ? new Date(app.interview_end_time)
                      : new Date(start.getTime() + 45 * 60000);

                    // Show join if: in_progress, OR (scheduled/confirmed AND within window [start-10m, end])
                    const inWindow = now >= new Date(start.getTime() - 10 * 60000) && now <= end;
                    const isVisible = (iStatus === 'in_progress') ||
                                      ((iStatus === 'scheduled' || iStatus === 'confirmed') && inWindow);

                    if (isVisible) {
                      return (
                        <button
                          className="my-submissions__action-btn my-submissions__action-btn--primary"
                          onClick={() => navigate(`/candidat/interviews/room/${app.interview_id || app._id}`)}
                          style={{
                            padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '2rem',
                            border: 'none', background: 'var(--dashboard-accent)', color: 'white',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 100
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>videocam</span>
                          {t('submissions-join-interview') || (t('language') === 'fr' ? 'Rejoindre' : 'Join')}
                        </button>
                      );
                    } else if (now < start && (iStatus === 'scheduled' || iStatus === 'confirmed')) {
                      return (
                        <div style={{ fontSize: '0.75rem', color: 'var(--dashboard-muted)', fontWeight: 600, fontStyle: 'italic' }}>
                          {t('language') === 'fr' ? 'Lien dispo bientôt' : 'Link soon'}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <button className="my-submissions__menu-btn">
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>
                </div>
              </div>

              {/* Timeline element */}
              <div className="my-submissions__timeline-wrapper">
                <div className="my-submissions__timeline">
                  <div className="my-submissions__timeline-track"></div>
                  <div
                    className={`my-submissions__timeline-progress color-accent`}
                    style={{ width: `${details.progress}%` }}
                  ></div>
                  <div className="my-submissions__timeline-steps">
                    {details.timeline.map((step, idx) => (
                      <div key={idx} className="my-submissions__timeline-step">
                        <div
                          className={`my-submissions__timeline-dot color-accent ${step.active
                            ? step.current
                              ? 'my-submissions__timeline-dot--current'
                              : 'my-submissions__timeline-dot--active'
                            : ''
                            } ${step.isError ? 'is-error' : ''}`}
                        ></div>
                        <span
                          className={`my-submissions__timeline-label color-accent ${step.active
                            ? step.current
                              ? 'my-submissions__timeline-label--current'
                              : 'my-submissions__timeline-label--active'
                            : ''
                            }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Insight Footer */}
              <div className="my-submissions__insight">
                <div className="my-submissions__insight-content">
                  <span className="material-symbols-outlined my-submissions__insight-icon my-submissions__insight-icon--primary">
                    info
                  </span>
                  <div>
                    <h4 className="my-submissions__insight-title">Application Status</h4>
                    <p className="my-submissions__insight-description">Your application is currently being {app.status === 'pending' ? 'reviewed by the hiring team' : 'processed'}.</p>
                  </div>
                </div>
                <button className="my-submissions__insight-btn" onClick={() => navigate(`/candidat/dashboard/applications/${app.application_id || app._id}`)}>
                  {t('submissions-view-details')}
                </button>
              </div>
            </div>
          );
        })}

        {filteredApplications.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--dashboard-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>inbox</span>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--dashboard-text)', margin: '0 0 0.5rem 0' }}>{t('submissions-no-results')}</h3>
            <p>{t('submissions-no-results-desc')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MySubmissions;
