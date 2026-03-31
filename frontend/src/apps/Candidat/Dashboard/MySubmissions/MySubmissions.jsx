import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../../core/useLanguage';
import { apiFetch, SERVER_URL } from '../../../../core/api';
import {
  getApplicationPipelineSteps,
  getApplicationStageIndex,
  normalizeApplicationStatus,
} from '../../../../core/applicationPipeline';
import Skeleton from '../components/Skeleton/Skeleton';
import './MySubmissions.css';

const FALLBACK_LOGO = 'https://placeholder.pics/svg/200';
const INTERVIEW_JOIN_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_INTERVIEW_DURATION_MS = 45 * 60 * 1000;

const buildCompanyLogoUrl = (logoUrl) => {
  if (!logoUrl) {
    return FALLBACK_LOGO;
  }

  return logoUrl.startsWith('/') ? `${SERVER_URL}${logoUrl}` : logoUrl;
};

const normalizeQuizStatus = (quizStatus) => `${quizStatus || ''}`.toLowerCase();

const getInterviewWindowState = (interviewDetails, now) => {
  if (!interviewDetails?.start_time) {
    return { canJoin: false };
  }

  const start = new Date(interviewDetails.start_time);
  if (Number.isNaN(start.getTime())) {
    return { canJoin: false };
  }

  const end = interviewDetails.end_time
    ? new Date(interviewDetails.end_time)
    : new Date(start.getTime() + DEFAULT_INTERVIEW_DURATION_MS);
  const joinWindowStart = new Date(start.getTime() - INTERVIEW_JOIN_WINDOW_MS);

  return {
    canJoin: Boolean(interviewDetails.meeting_link) && now >= joinWindowStart && now <= end,
  };
};

const getComparableTime = (value, fallback = Number.MAX_SAFE_INTEGER) => {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? fallback : parsed;
};

const MySubmissions = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('last-updated');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveNow, setLiveNow] = useState(new Date());

  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const pipelineSteps = useMemo(() => getApplicationPipelineSteps(t), [t]);

  useEffect(() => {
    const timer = setInterval(() => setLiveNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const data = await apiFetch('/applications/my-applications');
        const enrichedData = data.map((application) => ({
          ...application,
          normalizedStatus: normalizeApplicationStatus(application.status),
          company_logo: buildCompanyLogoUrl(application.company_logo),
        }));

        setApplications(enrichedData);
        setError(null);
      } catch (fetchError) {
        console.error('Error fetching submissions:', fetchError);
        setApplications([]);
        setError(t('submissions-load-error'));
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [t]);

  const handleImageError = (event) => {
    event.currentTarget.src = FALLBACK_LOGO;
  };

  const formatDate = (value, options) => {
    if (!value) {
      return '';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return parsedDate.toLocaleDateString(locale, options);
  };

  const formatDateTime = (value) =>
    formatDate(value, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getCurrentStage = (application) => {
    if (application.normalizedStatus === 'rejected') {
      return {
        label: t('app.track.step.rejected'),
        desc: t('submissions-stage-rejected-desc'),
        order: null,
      };
    }

    const index = getApplicationStageIndex(application.normalizedStatus);
    const stage = pipelineSteps[index] || pipelineSteps[0];

    return {
      label: stage?.label || t('app.track.step.new'),
      desc: stage?.desc || t('app.track.step.received'),
      order: index >= 0 ? index + 1 : 1,
    };
  };

  const getTimelineDetails = (status) => {
    const normalizedStatus = normalizeApplicationStatus(status);
    const activeIndex = normalizedStatus === 'rejected' ? -1 : getApplicationStageIndex(normalizedStatus);

    return {
      progress: activeIndex >= 0 ? (activeIndex / (pipelineSteps.length - 1)) * 100 : 0,
      steps: pipelineSteps.map((step, index) => ({
        ...step,
        active: activeIndex >= index && activeIndex !== -1,
        current: activeIndex === index,
      })),
    };
  };

  const getStatusBadge = (status) => {
    const normalizedStatus = normalizeApplicationStatus(status);
    const badges = {
      new: {
        label: t('app.track.step.new'),
        icon: 'forward_to_inbox',
        colorClass: 'my-submissions__status--new',
      },
      in_review: {
        label: t('app.track.step.in_review'),
        icon: 'manage_search',
        colorClass: 'my-submissions__status--review',
      },
      technical_test: {
        label: t('app.track.step.technical_test'),
        icon: 'quiz',
        colorClass: 'my-submissions__status--technical',
      },
      interview: {
        label: t('app.track.step.interview'),
        icon: 'event_available',
        colorClass: 'my-submissions__status--interview',
      },
      accepted: {
        label: t('app.track.step.accepted'),
        icon: 'celebration',
        colorClass: 'my-submissions__status--offer',
      },
      rejected: {
        label: t('app.track.step.rejected'),
        icon: 'cancel',
        colorClass: 'my-submissions__status--rejected',
      },
    };

    return badges[normalizedStatus] || badges.new;
  };

  const getApplicationAction = (application) => {
    const quizStatus = normalizeQuizStatus(application.quiz_status);
    const interviewWindow = getInterviewWindowState(application.interview_details, liveNow);

    if (application.normalizedStatus === 'technical_test' && quizStatus === 'sent' && application.quiz_id) {
      return {
        label: t('submissions-action-start-quiz'),
        onClick: () => navigate(`/candidat/quiz/${application.quiz_id}`),
      };
    }

    if (application.interview_status === 'pending_candidate') {
      return {
        label: t('submissions-action-choose-slot'),
        onClick: () => navigate(`/candidat/interviews/select/${application._id}`),
      };
    }

    if (application.normalizedStatus === 'interview' && interviewWindow.canJoin) {
      return {
        label: t('submissions-action-join-interview'),
        onClick: () => window.open(application.interview_details.meeting_link, '_blank', 'noopener,noreferrer'),
      };
    }

    return null;
  };

  const getInsight = (application) => {
    const quizStatus = normalizeQuizStatus(application.quiz_status);
    const action = getApplicationAction(application);
    const pills = [];
    let description = '';
    let title = getStatusBadge(application.status).label;
    let icon = 'info';

    if (application.normalizedStatus === 'technical_test' && quizStatus === 'sent' && application.quiz_id) {
      description = t('submissions-summary-technical-ready');
      icon = 'rocket_launch';
      pills.push(t('submissions-pill-quiz-ready'));
    } else if (application.normalizedStatus === 'technical_test' && quizStatus === 'completed') {
      description = t('submissions-summary-technical-completed');
      icon = 'task_alt';
      pills.push(t('submissions-pill-quiz-completed'));
    } else if (application.normalizedStatus === 'technical_test') {
      description = t('submissions-summary-technical-waiting');
      icon = 'hourglass_top';
    } else if (application.interview_status === 'pending_candidate') {
      const slotCount = application.interview_proposal?.slot_count || 0;
      title = t('app.track.step.interview');
      description = t('submissions-summary-proposal', { count: slotCount || 1 });
      icon = 'calendar_clock';
      if (slotCount) {
        pills.push(t('submissions-pill-slots', { count: slotCount }));
      }
      if (application.interview_proposal?.next_slot) {
        pills.push(
          t('submissions-pill-next-slot', {
            date: formatDate(application.interview_proposal.next_slot, { month: 'short', day: 'numeric' }),
          })
        );
      }
      if (application.interview_proposal?.duration_minutes) {
        pills.push(t('submissions-pill-duration', { count: application.interview_proposal.duration_minutes }));
      }
    } else if (application.normalizedStatus === 'interview' && application.interview_details?.start_time) {
      description = t('submissions-summary-interview', {
        date: formatDateTime(application.interview_details.start_time),
      });
      icon = getInterviewWindowState(application.interview_details, liveNow).canJoin ? 'videocam' : 'event';
      pills.push(t('submissions-pill-interview'));
      if (application.interview_details?.type) {
        pills.push(application.interview_details.type);
      }
    } else if (application.normalizedStatus === 'accepted') {
      description = t('submissions-summary-accepted');
      icon = 'celebration';
    } else if (application.normalizedStatus === 'rejected') {
      description = t('submissions-summary-rejected');
      icon = 'block';
    } else if (application.normalizedStatus === 'in_review') {
      description = t('submissions-summary-in-review');
      icon = 'manage_search';
    } else {
      description = t('submissions-summary-new');
      icon = 'mark_email_read';
    }

    return { action, description, icon, pills, title };
  };

  const isActionNeeded = (application) => Boolean(getApplicationAction(application));
  const actionableApplications = applications.filter((application) => isActionNeeded(application));
  const interviewCount = applications.filter((application) => application.normalizedStatus === 'interview').length;
  const technicalTestCount = applications.filter((application) => application.normalizedStatus === 'technical_test').length;
  const inProgressCount = applications.filter((application) =>
    ['new', 'in_review', 'technical_test'].includes(application.normalizedStatus)
  ).length;

  const featuredApplication = useMemo(() => {
    if (actionableApplications.length > 0) {
      return actionableApplications[0];
    }

    if (applications.length === 0) {
      return null;
    }

    return [...applications].sort((first, second) => {
      const firstTime = getComparableTime(
        first.interview_details?.start_time || first.interview_proposal?.next_slot || first.updated_at || first.applied_at
      );
      const secondTime = getComparableTime(
        second.interview_details?.start_time || second.interview_proposal?.next_slot || second.updated_at || second.applied_at
      );
      return firstTime - secondTime;
    })[0];
  }, [actionableApplications, applications]);

  const featuredInsight = featuredApplication ? getInsight(featuredApplication) : null;
  const featuredBadge = featuredApplication ? getStatusBadge(featuredApplication.status) : null;

  const stats = useMemo(() => {
    return [
      {
        label: t('submissions-total'),
        value: applications.length,
        icon: 'folder_open',
        isHighlight: false,
      },
      {
        label: t('submissions-in-progress'),
        value: inProgressCount,
        icon: 'timeline',
        isHighlight: false,
      },
      {
        label: t('submissions-interviews'),
        value: interviewCount,
        icon: 'groups',
        isHighlight: false,
      },
      {
        label: t('app.track.step.technical_test'),
        value: technicalTestCount,
        icon: 'quiz',
        isHighlight: technicalTestCount > 0,
      },
    ];
  }, [applications.length, inProgressCount, interviewCount, t, technicalTestCount]);

  const filters = useMemo(
    () => [
      { id: 'all', label: t('submissions-filter-all'), icon: 'view_list' },
      { id: 'new', label: t('app.track.step.new'), icon: 'forward_to_inbox' },
      { id: 'in_review', label: t('app.track.step.in_review'), icon: 'manage_search' },
      { id: 'technical_test', label: t('app.track.step.technical_test'), icon: 'quiz' },
      { id: 'interview', label: t('app.track.step.interview'), icon: 'groups' },
      { id: 'accepted', label: t('app.track.step.accepted'), icon: 'check_circle' },
      { id: 'rejected', label: t('app.track.step.rejected'), icon: 'cancel' },
    ],
    [t]
  );

  const filteredApplications = useMemo(() => {
    const filtered = applications.filter((application) => {
      if (activeFilter !== 'all' && application.normalizedStatus !== activeFilter) {
        return false;
      }

      if (!searchQuery.trim()) {
        return true;
      }

      const term = searchQuery.toLowerCase();
      return (
        application.job_title?.toLowerCase().includes(term) ||
        application.company_name?.toLowerCase().includes(term) ||
        application.normalizedStatus?.includes(term)
      );
    });

    if (sortBy === 'last-updated') {
      filtered.sort((first, second) => getComparableTime(second.updated_at || second.applied_at) - getComparableTime(first.updated_at || first.applied_at));
    } else if (sortBy === 'date-applied') {
      filtered.sort((first, second) => getComparableTime(second.applied_at) - getComparableTime(first.applied_at));
    } else if (sortBy === 'upcoming-interview') {
      filtered.sort((first, second) => {
        const firstTime = getComparableTime(first.interview_details?.start_time || first.interview_proposal?.next_slot);
        const secondTime = getComparableTime(second.interview_details?.start_time || second.interview_proposal?.next_slot);
        return firstTime - secondTime;
      });
    }

    return filtered;
  }, [activeFilter, applications, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="my-submissions">
        <div className="my-submissions__hero">
          <div className="my-submissions__hero-panel">
            <Skeleton variant="text" width="120px" height="1rem" style={{ marginBottom: '0.5rem' }} />
            <Skeleton variant="text" width="260px" height="2.5rem" style={{ marginBottom: '0.5rem' }} />
            <Skeleton variant="text" width="75%" height="1rem" />
            <div className="my-submissions__hero-stage-grid" style={{ marginTop: '1.5rem' }}>
              {[1, 2, 3, 4, 5].map((item) => (
                <Skeleton key={item} variant="rectangle" width="100%" height="110px" style={{ borderRadius: '1rem' }} />
              ))}
            </div>
          </div>

          <div className="my-submissions__focus-panel">
            <Skeleton variant="text" width="120px" height="1rem" style={{ marginBottom: '1rem' }} />
            <Skeleton variant="text" width="180px" height="1.5rem" style={{ marginBottom: '0.75rem' }} />
            <Skeleton variant="text" width="100%" height="1rem" style={{ marginBottom: '1rem' }} />
            <Skeleton variant="rectangle" width="140px" height="2.75rem" style={{ borderRadius: '999px' }} />
          </div>
        </div>

        <div className="my-submissions__stats">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="my-submissions__stat-card">
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

        <div className="my-submissions__controls">
          <div className="my-submissions__filters">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Skeleton key={item} variant="rectangle" width="100px" height="2.5rem" style={{ borderRadius: '0.6rem' }} />
            ))}
          </div>
        </div>

        <div className="my-submissions__list">
          {[1, 2].map((item) => (
            <div key={item} className="my-submissions__card skeleton-card">
              <div className="my-submissions__card-header">
                <div className="my-submissions__card-info">
                  <Skeleton variant="circle" width="72px" height="72px" />
                  <div>
                    <Skeleton variant="text" width="220px" height="1.2rem" style={{ marginBottom: '0.5rem' }} />
                    <Skeleton variant="text" width="180px" height="0.9rem" />
                  </div>
                </div>
                <div className="my-submissions__card-actions" style={{ gap: '0.5rem' }}>
                  <Skeleton variant="rectangle" width="120px" height="2rem" style={{ borderRadius: '2rem' }} />
                </div>
              </div>

              <div className="my-submissions__card-layout">
                <div className="my-submissions__card-panel">
                  <Skeleton variant="text" width="180px" height="1rem" style={{ marginBottom: '1rem' }} />
                  <Skeleton variant="rectangle" width="100%" height="68px" style={{ borderRadius: '1rem' }} />
                </div>

                <div className="my-submissions__card-panel">
                  <Skeleton variant="text" width="160px" height="1rem" style={{ marginBottom: '0.75rem' }} />
                  <Skeleton variant="text" width="100%" height="0.9rem" style={{ marginBottom: '0.5rem' }} />
                  <Skeleton variant="text" width="80%" height="0.9rem" style={{ marginBottom: '1rem' }} />
                  <Skeleton variant="rectangle" width="140px" height="2.75rem" style={{ borderRadius: '999px' }} />
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
      <section className="my-submissions__hero">
        <div className="my-submissions__hero-panel">
          <p className="my-submissions__hero-kicker">{t('submissions-hero-kicker')}</p>
          <h2 className="my-submissions__title">{t('submissions-title')}</h2>
          <p className="my-submissions__subtitle">{t('submissions-subtitle')}</p>
          <p className="my-submissions__hero-summary">
            {technicalTestCount > 0 || interviewCount > 0
              ? t('submissions-hero-summary-action', {
                  technicalCount: technicalTestCount,
                  interviewCount,
                })
              : t('submissions-hero-summary-calm', {
                  inProgressCount,
                })}
          </p>

          <div className="my-submissions__pipeline-showcase">
            <div className="my-submissions__pipeline-copy">
              <p className="my-submissions__section-eyebrow">{t('submissions-pipeline-title')}</p>
              <p className="my-submissions__pipeline-summary">{t('submissions-pipeline-desc')}</p>
            </div>

            <div className="my-submissions__hero-stage-grid">
              {pipelineSteps.map((step, index) => (
                <article key={step.id} className="my-submissions__hero-stage">
                  <span className="my-submissions__hero-stage-index">{index + 1}</span>
                  <h3 className="my-submissions__hero-stage-label">{step.label}</h3>
                  <p className="my-submissions__hero-stage-desc">{step.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="my-submissions__focus-panel">
          <p className="my-submissions__section-eyebrow">{t('submissions-focus-title')}</p>

          {featuredApplication && featuredInsight && featuredBadge ? (
            <div className="my-submissions__focus-card">
              <div className="my-submissions__focus-company">
                <div className="my-submissions__focus-logo">
                  <img
                    src={featuredApplication.company_logo}
                    alt={`${featuredApplication.company_name} logo`}
                    onError={handleImageError}
                  />
                </div>
                <div>
                  <h3 className="my-submissions__focus-role">{featuredApplication.job_title}</h3>
                  <p className="my-submissions__focus-name">{featuredApplication.company_name}</p>
                </div>
              </div>

              <div className={`my-submissions__status ${featuredBadge.colorClass}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{featuredBadge.icon}</span>
                {featuredBadge.label}
              </div>

              <p className="my-submissions__focus-description">{featuredInsight.description}</p>

              {featuredInsight.pills.length > 0 && (
                <div className="my-submissions__pill-list">
                  {featuredInsight.pills.map((pill) => (
                    <span key={pill} className="my-submissions__pill">{pill}</span>
                  ))}
                </div>
              )}

              {featuredInsight.action ? (
                <button className="my-submissions__insight-btn my-submissions__insight-btn--primary" onClick={featuredInsight.action.onClick}>
                  {featuredInsight.action.label}
                </button>
              ) : (
                <p className="my-submissions__focus-note">{t('submissions-focus-clear')}</p>
              )}
            </div>
          ) : (
            <div className="my-submissions__focus-empty">
              <span className="material-symbols-outlined">inbox</span>
              <h3>{t('submissions-focus-empty-title')}</h3>
              <p>{t('submissions-focus-empty-desc')}</p>
            </div>
          )}
        </aside>
      </section>

      <div className="my-submissions__stats">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`my-submissions__stat-card ${stat.isHighlight ? 'my-submissions__stat-card--highlight' : ''}`}
          >
            <div className="my-submissions__stat-header">
              <span className="my-submissions__stat-label">{stat.label}</span>
              <span className="material-symbols-outlined my-submissions__stat-icon">{stat.icon}</span>
            </div>
            <div className="my-submissions__stat-content">
              <span className="my-submissions__stat-value">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

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
              onChange={(event) => setSearchQuery(event.target.value)}
              className="my-submissions__search-input"
            />
          </div>
          <div className="my-submissions__sort">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="my-submissions__sort-select"
            >
              <option value="last-updated">{t('submissions-sort-updated')}</option>
              <option value="date-applied">{t('submissions-sort-applied')}</option>
              <option value="upcoming-interview">{t('submissions-sort-upcoming')}</option>
            </select>
            <span className="material-symbols-outlined my-submissions__sort-icon">expand_more</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="my-submissions__feedback my-submissions__feedback--error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      <div className="my-submissions__list">
        {filteredApplications.map((application) => {
          const badge = getStatusBadge(application.status);
          const currentStage = getCurrentStage(application);
          const timeline = getTimelineDetails(application.status);
          const insight = getInsight(application);
          const appliedDate = formatDate(application.applied_at, { month: 'short', day: 'numeric' });
          const updatedDate = formatDate(application.updated_at || application.applied_at, { month: 'short', day: 'numeric' });
          const actionable = Boolean(insight.action);

          return (
            <div
              key={application._id}
              className={`my-submissions__card ${actionable ? 'my-submissions__card--actionable' : ''} ${application.normalizedStatus === 'rejected' ? 'my-submissions__card--danger' : ''}`}
            >
              <div className="my-submissions__card-header">
                <div className="my-submissions__card-info">
                  <div className="my-submissions__company-logo my-submissions__company-logo--large">
                    <img
                      src={application.company_logo}
                      alt={`${application.company_name} logo`}
                      onError={handleImageError}
                    />
                  </div>
                  <div>
                    <h3 className="my-submissions__position">{application.job_title}</h3>
                    <p className="my-submissions__company">
                      {application.company_name}
                      {application.location ? ` - ${application.location}` : ''}
                    </p>
                    <div className="my-submissions__meta">
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>calendar_today</span>
                      <span>{t('submissions-applied')} {appliedDate}</span>
                      <span style={{ color: 'var(--dashboard-border)' }}>|</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>update</span>
                      <span>{t('submissions-updated')} {updatedDate}</span>
                      {application.salary && (
                        <>
                          <span style={{ color: 'var(--dashboard-border)' }}>|</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>payments</span>
                          <span>{application.salary}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="my-submissions__card-actions">
                  <div className={`my-submissions__status ${badge.colorClass}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{badge.icon}</span>
                    {badge.label}
                  </div>
                  {actionable && <span className="my-submissions__attention-pill">{insight.title}</span>}
                </div>
              </div>

              <div className="my-submissions__card-layout">
                <section className="my-submissions__card-panel my-submissions__card-panel--pipeline">
                  <div className="my-submissions__card-panel-head">
                    <div>
                      <p className="my-submissions__section-eyebrow">{t('submissions-card-pipeline')}</p>
                      <h4 className="my-submissions__panel-title">
                        {t('submissions-current-stage')}: {currentStage.label}
                      </h4>
                    </div>
                    {currentStage.order ? (
                      <span className="my-submissions__stage-count">
                        {t('submissions-stage-counter', {
                          current: currentStage.order,
                          total: pipelineSteps.length,
                        })}
                      </span>
                    ) : null}
                  </div>

                  <p className="my-submissions__panel-description">{currentStage.desc}</p>

                  <div className="my-submissions__timeline-wrapper">
                    <div className="my-submissions__timeline">
                      <div className="my-submissions__timeline-track"></div>
                      <div
                        className={`my-submissions__timeline-progress ${application.normalizedStatus === 'rejected' ? 'color-danger' : 'color-primary'}`}
                        style={{ width: `${timeline.progress}%` }}
                      ></div>
                      <div className="my-submissions__timeline-steps">
                        {timeline.steps.map((step) => (
                          <div key={step.id} className="my-submissions__timeline-step">
                            <div
                              className={`my-submissions__timeline-dot ${application.normalizedStatus === 'rejected' ? 'color-danger' : 'color-primary'} ${step.active ? (step.current ? 'my-submissions__timeline-dot--current' : 'my-submissions__timeline-dot--active') : ''}`}
                            ></div>
                            <span
                              className={`my-submissions__timeline-label ${application.normalizedStatus === 'rejected' ? 'color-danger' : 'color-primary'} ${step.active ? (step.current ? 'my-submissions__timeline-label--current' : 'my-submissions__timeline-label--active') : ''}`}
                            >
                              {step.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <aside className="my-submissions__card-panel my-submissions__card-panel--next">
                  <p className="my-submissions__section-eyebrow">{t('submissions-card-next')}</p>

                  <div className="my-submissions__insight-content">
                    <span className="material-symbols-outlined my-submissions__insight-icon my-submissions__insight-icon--primary">
                      {insight.icon}
                    </span>
                    <div>
                      <h4 className="my-submissions__insight-title">{insight.title}</h4>
                      <p className="my-submissions__insight-description">{insight.description}</p>
                    </div>
                  </div>

                  {insight.pills.length > 0 && (
                    <div className="my-submissions__pill-list">
                      {insight.pills.map((pill) => (
                        <span key={pill} className="my-submissions__pill">{pill}</span>
                      ))}
                    </div>
                  )}

                  <div className="my-submissions__card-panel-footer">
                    {insight.action ? (
                      <button className="my-submissions__insight-btn my-submissions__insight-btn--primary" onClick={insight.action.onClick}>
                        {insight.action.label}
                      </button>
                    ) : (
                      <span className="my-submissions__insight-note">{badge.label}</span>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          );
        })}

        {filteredApplications.length === 0 && (
          <div className="my-submissions__feedback my-submissions__feedback--empty">
            <span className="material-symbols-outlined" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>
              inbox
            </span>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--dashboard-text)', margin: '0 0 0.5rem 0' }}>
              {t('submissions-no-results')}
            </h3>
            <p>{t('submissions-no-results-desc')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MySubmissions;
