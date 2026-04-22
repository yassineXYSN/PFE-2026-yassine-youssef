import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getCandidateDashboardSummary, getCandidateProfile } from '../../../../core/api';
import { useLanguage } from '../../../../core/useLanguage';
import { useNotifications } from '../../../../core/hooks/useNotifications';
import {
  getApplicationPipelineSteps,
  normalizeApplicationStatus,
} from '../../../../core/applicationPipeline';
import Skeleton from '../components/Skeleton/Skeleton';
import ApplicationFunnel from './components/ApplicationFunnel/ApplicationFunnel';
import './Analytics.css';

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

function timeAgo(iso, t) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 2) return t('time_ago_just_now');
  if (m < 60) return t('time_ago_minute', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('time_ago_hour', { h, s: h > 1 ? 's' : '' });
  const d = Math.floor(h / 24);
  return d === 1 ? t('time_ago_yesterday') : t('time_ago_days', { d });
}

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const rows = Math.ceil((startOffset + totalDays) / 7);
  const cells = [];

  for (let i = 0; i < rows * 7; i += 1) {
    const dayNum = i - startOffset + 1;
    cells.push(dayNum >= 1 && dayNum <= totalDays ? new Date(year, month, dayNum) : null);
  }

  return cells;
}

const FunnelSkeleton = () => (
  <div className="fnl an__surface-skeleton">
    <Skeleton variant="text" width="38%" height="1.35rem" style={{ opacity: 0.18, marginBottom: '1.5rem' }} />
    <div className="an__skeleton-stack an__skeleton-stack--spacious">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="an__funnel-skeleton-row">
          <div className="an__funnel-skeleton-left">
            <Skeleton variant="rectangle" width="3rem" height="3rem" borderRadius="0.75rem" style={{ opacity: 0.18 }} />
            <div className="an__skeleton-stack">
              <Skeleton variant="text" width="7.5rem" height="0.85rem" style={{ opacity: 0.14 }} />
              <Skeleton variant="text" width="3rem" height="1.55rem" style={{ opacity: 0.18 }} />
            </div>
          </div>
          <Skeleton variant="rectangle" width="100%" height="0.65rem" borderRadius="999px" style={{ opacity: 0.12 }} />
          <Skeleton variant="text" width="2.5rem" height="1rem" style={{ opacity: 0.14 }} />
        </div>
      ))}
    </div>
  </div>
);

const MiniStatSkeleton = ({ stacked = false }) => (
  <div className={`mini-stat an__surface-skeleton${stacked ? ' an__surface-skeleton--center' : ''}`}>
    <Skeleton
      variant="rectangle"
      width={stacked ? '4rem' : '3.25rem'}
      height={stacked ? '4rem' : '3.25rem'}
      borderRadius="0.85rem"
      style={{ opacity: 0.18, flexShrink: 0 }}
    />
    <div className={`an__skeleton-stack${stacked ? ' an__skeleton-stack--center' : ''}`} style={{ width: stacked ? '100%' : 'auto' }}>
      <Skeleton variant="text" width={stacked ? '4.5rem' : '4rem'} height="1.7rem" style={{ opacity: 0.18 }} />
      <Skeleton variant="text" width={stacked ? '6.5rem' : '5rem'} height="0.8rem" style={{ opacity: 0.12 }} />
      {!stacked && <Skeleton variant="text" width="7rem" height="0.7rem" style={{ opacity: 0.1 }} />}
    </div>
  </div>
);

const CalendarSkeleton = () => (
  <div className="an__card cal-card an__surface-skeleton">
    <div className="cal__header">
      <div className="an__skeleton-stack">
        <Skeleton variant="text" width="8rem" height="1.3rem" style={{ opacity: 0.18 }} />
        <Skeleton variant="text" width="6.5rem" height="1rem" style={{ opacity: 0.12 }} />
      </div>
      <div className="an__calendar-skeleton-actions">
        <Skeleton variant="rectangle" width="7rem" height="2rem" borderRadius="999px" style={{ opacity: 0.16 }} />
        <div className="cal__nav">
          <Skeleton variant="rectangle" width="2.5rem" height="2.5rem" borderRadius="0.625rem" style={{ opacity: 0.16 }} />
          <Skeleton variant="rectangle" width="2.5rem" height="2.5rem" borderRadius="0.625rem" style={{ opacity: 0.16 }} />
        </div>
      </div>
    </div>
    <div className="an__calendar-skeleton-grid">
      {Array.from({ length: 42 }).map((_, index) => (
        <Skeleton
          key={index}
          variant="rectangle"
          width="100%"
          height="2.7rem"
          borderRadius="0.75rem"
          style={{ opacity: index < 7 ? 0.08 : 0.12 }}
        />
      ))}
    </div>
  </div>
);

const ActivityFeedSkeleton = () => (
  <div className="an__card activity-card an__surface-skeleton">
    <div className="activity-card__head">
      <Skeleton variant="text" width="11rem" height="1.3rem" style={{ opacity: 0.18 }} />
      <Skeleton variant="text" width="4rem" height="0.9rem" style={{ opacity: 0.12 }} />
    </div>
    <div className="activity-card__list an__activity-skeleton-list">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="an__activity-skeleton-row">
          <Skeleton variant="circle" width="2.35rem" height="2.35rem" style={{ opacity: 0.18, flexShrink: 0 }} />
          <div className="an__skeleton-stack an__activity-skeleton-copy">
            <Skeleton variant="text" width="78%" height="0.95rem" style={{ opacity: 0.16 }} />
            <Skeleton variant="text" width="58%" height="0.75rem" style={{ opacity: 0.1 }} />
          </div>
          <Skeleton variant="text" width="3rem" height="0.75rem" style={{ opacity: 0.1, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  </div>
);

const NextInterviewWidget = ({ interviews, t, navigate, apps = [], loading = false }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nextInterview = useMemo(
    () => interviews
      .filter((item) => {
        const start = new Date(item.start_time).getTime();
        return (item.end_time ? new Date(item.end_time).getTime() : start + 60 * 60000) > now;
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0] || null,
    [interviews, now],
  );

  const appInfo = useMemo(() => {
    if (!nextInterview || !apps.length) return {};
    return apps.find((item) => item._id === nextInterview.application_id) || {};
  }, [nextInterview, apps]);

  if (loading) {
    return (
      <div className="icard an__surface-skeleton">
        <Skeleton variant="text" width="44%" height="1.35rem" style={{ opacity: 0.18, marginBottom: '1.25rem' }} />
        <div className="an__skeleton-stack an__skeleton-stack--spacious" style={{ flex: 1 }}>
          <Skeleton variant="text" width="72%" height="1.9rem" style={{ opacity: 0.2 }} />
          <Skeleton variant="text" width="48%" height="1rem" style={{ opacity: 0.14 }} />
          <Skeleton variant="text" width="35%" height="0.85rem" style={{ opacity: 0.12 }} />
          <Skeleton variant="rectangle" width="100%" height="3rem" borderRadius="0.9rem" style={{ opacity: 0.14, marginTop: 'auto' }} />
        </div>
      </div>
    );
  }

  if (!nextInterview) {
    return (
      <div className="icard">
        <h3 className="icard__title">{t('upcoming_interviews')}</h3>
        <div className="icard__empty">
          <span className="material-symbols-outlined" style={{ fontSize: 44, opacity: 0.2, marginBottom: '0.5rem' }}>event_available</span>
          <p>{t('no_upcoming_interviews')}</p>
        </div>
      </div>
    );
  }

  const startMs = new Date(nextInterview.start_time).getTime();
  const diff = startMs - now;
  const isStarted = diff <= 0;
  const canJoin = diff <= 10 * 60000;

  let timeStr = '';
  if (isStarted) {
    timeStr = t('interview_started');
  } else {
    const diffAbs = Math.abs(diff);
    const d = Math.floor(diffAbs / 86400000);
    const h = Math.floor((diffAbs % 86400000) / 3600000);
    const m = Math.floor((diffAbs % 3600000) / 60000);
    const s = Math.floor((diffAbs % 60000) / 1000);

    if (d > 0) {
      timeStr = t('starts_in_days', { d, s: d > 1 ? 's' : '' });
    } else if (h > 0) {
      timeStr = t('starts_in_hours', { h, m });
    } else {
      timeStr = t('starts_in_mins', { m, s });
    }
  }

  return (
    <div className="icard" style={{ position: 'relative', overflow: 'hidden' }}>
      <h3 className="icard__title">{t('upcoming_interviews')}</h3>
      <div className="icard__body" style={{ marginTop: '0.5rem' }}>
        <p className="icard__company" style={{ fontSize: '1.4rem' }}>
          {appInfo.job_title || nextInterview.job_title || t('analytics-interview')}
        </p>
        <p className="icard__company" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tf-on-surface-variant)', marginTop: '-0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>business</span>
          {appInfo.company_name || nextInterview.company_name || t('analytics-company')}
        </p>
        <p className="icard__type" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, marginTop: '0.2rem' }}>
          <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
          <span
            style={{
              color: canJoin && !isStarted ? '#f59e0b' : isStarted ? '#10b981' : 'inherit',
              fontWeight: canJoin ? 700 : 500,
              fontSize: '0.9rem',
            }}
          >
            {timeStr}
          </span>
        </p>

        {canJoin ? (
          <button
            onClick={() => navigate(`/candidat/interviews/room/${nextInterview._id}`)}
            style={{
              marginTop: '1rem',
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontFamily: 'var(--head)',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              transition: 'all 0.2s ease',
              width: '100%',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.3rem' }}>login</span>
            {t('join_interview')}
          </button>
        ) : (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '0.85rem',
              opacity: 0.8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>lock_clock</span>
            {t('link_available_10_min')}
          </div>
        )}
      </div>
    </div>
  );
};

const Analytics = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { notifications, loading: notificationsLoading } = useNotifications();

  const [apps, setApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [interviews, setInterviews] = useState([]);
  const [interviewsLoading, setInterviewsLoading] = useState(true);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleOk, setGoogleOk] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [expandedDay, setExpandedDay] = useState(null);

  const googleSyncResult = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('google_sync');
  }, []);

  useEffect(() => {
    if (googleSyncResult === 'success') {
      setSyncMessage({ type: 'success', text: t('google_sync_success') });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (googleSyncResult === 'error') {
      setSyncMessage({ type: 'error', text: t('google_sync_error') });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const timer = setTimeout(() => setSyncMessage(null), 8000);
    return () => clearTimeout(timer);
  }, [googleSyncResult, t]);

  useEffect(() => {
    let live = true;
    setAppsLoading(true);
    setInterviewsLoading(true);

    getCandidateDashboardSummary()
      .then((data) => {
        if (live) {
          setApps(Array.isArray(data?.applications) ? data.applications : []);
          setInterviews(Array.isArray(data?.interviews) ? data.interviews : []);
        }
      })
      .catch((error) => {
        console.error('Dashboard summary load error:', error);
        if (live) {
          setApps([]);
          setInterviews([]);
        }
      })
      .finally(() => {
        if (live) {
          setAppsLoading(false);
          setInterviewsLoading(false);
        }
      });

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setProfileLoading(true);

    getCandidateProfile()
      .then((profile) => {
        if (live) {
          setUserProfile(profile || null);
        }
      })
      .catch((error) => {
        console.error('Profile load error:', error);
        if (live) {
          setUserProfile(null);
        }
      })
      .finally(() => {
        if (live) {
          setProfileLoading(false);
        }
      });

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    let scheduledId;
    let usedIdleCallback = false;

    setGoogleLoading(true);

    const loadGoogleCalendar = async () => {
      try {
        let isConnected = Boolean((await apiFetch('/auth/google/status'))?.connected);

        if (!isConnected && googleSyncResult === 'success') {
          for (let i = 0; i < 3 && live; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            try {
              isConnected = Boolean((await apiFetch('/auth/google/status'))?.connected);
              if (isConnected) break;
            } catch (error) {
              console.error('Google status retry error:', error);
            }
          }
        }

        if (!live) return;

        setGoogleOk(isConnected);

        if (!isConnected) {
          setGoogleEvents([]);
          return;
        }

        try {
          const events = await apiFetch('/auth/google/events');
          if (live) {
            setGoogleEvents(Array.isArray(events) ? events : []);
          }
        } catch (error) {
          console.error('Google events error:', error);
        }
      } catch (error) {
        console.error('Google status error:', error);
        if (live) {
          setGoogleOk(false);
          setGoogleEvents([]);
        }
      } finally {
        if (live) {
          setGoogleLoading(false);
        }
      }
    };

    const scheduleLoad = () => {
      void loadGoogleCalendar();
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      usedIdleCallback = true;
      scheduledId = window.requestIdleCallback(scheduleLoad, { timeout: 1200 });
    } else {
      scheduledId = window.setTimeout(scheduleLoad, 0);
    }

    return () => {
      live = false;
      if (usedIdleCallback && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(scheduledId);
      } else {
        clearTimeout(scheduledId);
      }
    };
  }, [googleSyncResult]);

  const handleSyncGoogle = async () => {
    try {
      const { url } = await apiFetch('/auth/google/url');
      if (url) window.location.href = url;
    } catch (error) {
      setSyncMessage({ type: 'error', text: t('google_connect_error') });
    }
  };

  const funnelData = useMemo(() => {
    const steps = getApplicationPipelineSteps(t);
    const total = apps.length;
    return steps.map((step) => {
      const count = apps.filter((item) => normalizeApplicationStatus(item.status) === step.id).length;
      return { ...step, count, rate: pct(count, total) };
    });
  }, [apps, t]);

  const profileStrength = userProfile?.profileStrength || 0;
  const missingSections = userProfile?.profileMissing || [];
  const skillCount = useMemo(() => userProfile?.skills?.length || 0, [userProfile]);

  const displayedNotifications = useMemo(
    () => [...notifications]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6)
      .map((notification) => ({
        id: notification._id,
        is_read: notification.is_read,
        title: t(notification.title),
        message: t(notification.message),
        time: timeAgo(notification.created_at, t),
        category: notification.category,
      })),
    [notifications, t],
  );

  const calendarCells = useMemo(() => buildCalendarGrid(calMonth.year, calMonth.month), [calMonth]);
  const calendarWeeks = useMemo(() => Math.max(1, Math.ceil(calendarCells.length / 7)), [calendarCells]);
  const monthLabel = new Date(calMonth.year, calMonth.month).toLocaleDateString(
    t('language') === 'fr' ? 'fr-FR' : 'en-US',
    { month: 'long', year: 'numeric' },
  );
  const today = new Date();
  const calendarLoading = interviewsLoading;

  const isToday = (date) => date
    && date.getDate() === today.getDate()
    && date.getMonth() === today.getMonth()
    && date.getFullYear() === today.getFullYear();

  const eventsOn = (date) => {
    if (!date) return [];

    const internal = interviews
      .filter((item) => {
        const eventDate = new Date(item.start_time);
        return eventDate.getFullYear() === date.getFullYear()
          && eventDate.getMonth() === date.getMonth()
          && eventDate.getDate() === date.getDate();
      })
      .map((item) => ({ ...item, source: 'internal' }));

    const external = googleEvents
      .filter((event) => {
        const eventDate = new Date(event.start);
        return eventDate.getFullYear() === date.getFullYear()
          && eventDate.getMonth() === date.getMonth()
          && eventDate.getDate() === date.getDate();
      })
      .map((event) => ({
        _id: event.id,
        company_name: event.summary,
        start_time: event.start,
        type: 'External',
        source: 'google',
      }));

    return [...internal, ...external];
  };

  const navMonth = (dir) => setCalMonth((prev) => {
    let month = prev.month + dir;
    let year = prev.year;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    if (month > 11) {
      month = 0;
      year += 1;
    }
    return { year, month };
  });

  return (
    <div className="an">
      {syncMessage && (
        <div className={`an__sync-msg an__sync-msg--${syncMessage.type}`}>
          <span className="material-symbols-outlined">
            {syncMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {syncMessage.text}
        </div>
      )}

      <div className="an__row1">
        <div className="an__cascade an__cascade--1">
          {appsLoading ? (
            <FunnelSkeleton />
          ) : (
            <ApplicationFunnel data={funnelData} onAction={() => navigate('/candidat/dashboard/my-submissions')} />
          )}
        </div>

        <div className="an__right-stack an__cascade an__cascade--2">
          <NextInterviewWidget
            interviews={interviews}
            t={t}
            navigate={navigate}
            apps={apps}
            loading={interviewsLoading}
          />

          <div className="mini-stats an__cascade an__cascade--3">
            {profileLoading ? (
              <>
                <MiniStatSkeleton />
                <MiniStatSkeleton />
              </>
            ) : (
              <>
                <div className="mini-stat">
                  <div className="mini-stat__icon">
                    <span className="material-symbols-outlined">trending_up</span>
                  </div>
                  <span className="mini-stat__value">{profileStrength}%</span>
                  <span className="mini-stat__label">{t('stat_profile')}</span>
                  {missingSections.length > 0 && profileStrength < 100 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--tf-on-surface-variant)', marginTop: '0.5rem', textAlign: 'center', lineHeight: '1.2' }}>
                      {t('jobs-widget-profile-why-missing')} {missingSections.map((section) => t(`jobs-section-${section}`)).join(', ')}.
                    </div>
                  )}
                </div>
                <div className="mini-stat">
                  <div className="mini-stat__icon mini-stat__icon--green">
                    <span className="material-symbols-outlined">verified</span>
                  </div>
                  <span className="mini-stat__value">{skillCount}</span>
                  <span className="mini-stat__label">{t('stat_skills')}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="an__row2">
        <div className="an__cascade an__cascade--4">
          {calendarLoading ? (
            <CalendarSkeleton />
          ) : (
            <div className="an__card cal-card">
              <div className="cal__header">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <h3 className="cal__label">{t('calendar_title')}</h3>
                    <p className="cal__month">{monthLabel}</p>
                  </div>
                  {googleLoading ? (
                    <div className="cal__sync-status">
                      <span className="google-icon-sm">G</span>
                      ...
                    </div>
                  ) : !googleOk ? (
                    <button className="cal__sync-btn" onClick={handleSyncGoogle}>
                      <span className="google-icon-sm">G</span>
                      {t('google_sync_btn')}
                    </button>
                  ) : (
                    <div className="cal__sync-status">
                      <span className="google-icon-sm">G</span>
                      {t('google_connected')}
                    </div>
                  )}
                </div>
                <div className="cal__nav">
                  <button className="cal__btn" onClick={() => navMonth(-1)}>
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button className="cal__btn" onClick={() => navMonth(1)}>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>

              <div
                className="cal__grid"
                style={{ gridTemplateRows: `auto repeat(${calendarWeeks}, minmax(0, 1fr))` }}
              >
                {[t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat'), t('day_sun')].map((day, index) => (
                  <div key={index} className="cal__wday">{day}</div>
                ))}
                {calendarCells.map((date, index) => {
                  const dayEvents = eventsOn(date);
                  return (
                    <div
                      key={index}
                      className={`cal__day${!date ? ' cal__day--empty' : ''}${date && isToday(date) ? ' cal__day--today' : ''}${dayEvents.length ? ' cal__day--event' : ''}`}
                      onClick={() => dayEvents.length && setExpandedDay({ date, events: dayEvents })}
                    >
                      {date && <span className="cal__num">{date.getDate()}</span>}
                      {dayEvents.some((event) => event.source === 'google') && <span className="cal__g-dot" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="an__mid-stack an__cascade an__cascade--5">
          {appsLoading ? (
            <MiniStatSkeleton stacked />
          ) : (
            <div className="mini-stat mini-stat--clickable" onClick={() => navigate('/candidat/dashboard/my-submissions')}>
              <div className="mini-stat__icon mini-stat__icon--orange">
                <span className="material-symbols-outlined">description</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="mini-stat__value">{apps.length}</span>
                <span className="mini-stat__label">{t('stat_applications')}</span>
              </div>
            </div>
          )}

          {interviewsLoading ? (
            <MiniStatSkeleton stacked />
          ) : (
            <div className="mini-stat mini-stat--clickable" onClick={() => navigate('/candidat/interviews')}>
              <div className="mini-stat__icon mini-stat__icon--pink">
                <span className="material-symbols-outlined">event</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="mini-stat__value">{interviews.length}</span>
                <span className="mini-stat__label">{t('stat_interviews')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="an__cascade an__cascade--6">
          {notificationsLoading && displayedNotifications.length === 0 ? (
            <ActivityFeedSkeleton />
          ) : (
            <div className="an__card activity-card">
              <div className="activity-card__head">
                <h3>{t('recent_notifications')}</h3>
                <button className="activity-card__all" onClick={() => navigate('/candidat/dashboard/notifications')}>{t('see_all')}</button>
              </div>
              <div className="activity-card__list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                {displayedNotifications.length > 0 ? displayedNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`act-row ${notification.is_read ? 'act-row--read' : 'act-row--unread'}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      backgroundColor: notification.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                      border: notification.is_read ? '1px solid var(--tf-outline-variant)' : '1px solid rgba(99, 102, 241, 0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                    onClick={() => navigate('/candidat/dashboard/notifications', { state: { selectedId: notification.id } })}
                  >
                    {!notification.is_read && (
                      <div style={{ width: '6px', height: '6px', backgroundColor: 'var(--color-primary)', borderRadius: '50%', position: 'absolute', top: '16px', left: '8px' }} />
                    )}

                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: notification.category === 'quiz' ? 'rgba(236,72,153,0.1)' : notification.category === 'application' ? 'rgba(74,222,128,0.1)' : 'rgba(99,102,241,0.1)',
                        color: notification.category === 'quiz' ? '#ec4899' : notification.category === 'application' ? '#4ade80' : '#6366f1',
                        flexShrink: 0,
                        marginLeft: notification.is_read ? 0 : '8px',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        {notification.category === 'quiz' ? 'quiz' : notification.category === 'application' ? 'work_history' : 'notifications'}
                      </span>
                    </div>

                    <div className="act-info" style={{ flex: 1, minWidth: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <p className="act-title" style={{ margin: 0, fontSize: '0.85rem', fontWeight: notification.is_read ? 600 : 700, color: 'var(--tf-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {notification.title}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--tf-on-surface-variant)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {notification.message}
                      </p>
                    </div>

                    <p className="act-time" style={{ margin: 0, fontSize: '0.7rem', color: notification.is_read ? 'var(--tf-on-surface-variant)' : 'var(--color-primary)', flexShrink: 0, fontWeight: 600 }}>
                      {notification.time}
                    </p>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', opacity: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '40px', marginBottom: '0.5rem' }}>notifications_paused</span>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>{t('no_recent_activity')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {expandedDay && (
        <div className="modal-bg" onClick={() => setExpandedDay(null)}>
          <div className="modal-box" onClick={(event) => event.stopPropagation()}>
            <div className="modal-top">
              <h3>{expandedDay.date.toLocaleDateString(t('language') === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              <button onClick={() => setExpandedDay(null)} className="modal-x"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="modal-events">
              {expandedDay.events.map((event) => (
                <div key={event._id} className={`modal-ev modal-ev--${event.source}`}>
                  <span className="modal-ev__time">{new Date(event.start_time).toLocaleTimeString(t('language') === 'fr' ? 'fr-FR' : 'en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                  <div className="modal-ev__details">
                    <span className="modal-ev__type">{event.type}</span>
                    <span className="modal-ev__co">
                      {event.source === 'google' && <span className="google-tag">{t('external_tag')}</span>}
                      {event.company_name || ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
