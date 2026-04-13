import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getUserProfile } from '../../../../core/api';
import { supabase } from '../../../../core/supabaseClient';
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
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
  const totalDays = lastDay.getDate();
  const rows = Math.ceil((startOffset + totalDays) / 7);
  const cells = [];
  for (let i = 0; i < rows * 7; i++) {
    const dayNum = i - startOffset + 1;
    cells.push(dayNum >= 1 && dayNum <= totalDays ? new Date(year, month, dayNum) : null);
  }
  return cells;
}

const NextInterviewWidget = ({ interviews, t, navigate, apps = [] }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nextInterview = useMemo(() => {
    return interviews
      .filter((i) => {
        const start = new Date(i.start_time).getTime();
        return (i.end_time ? new Date(i.end_time).getTime() : start + 60 * 60000) > now;
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0] || null;
  }, [interviews, now]);

  const appInfo = useMemo(() => {
    if (!nextInterview || !apps || !apps.length) return {};
    return apps.find(a => a._id === nextInterview.application_id) || {};
  }, [nextInterview, apps]);

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
  const canJoin = diff <= 10 * 60000; // within 10 mins

  let timeStr = "";
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
          <span style={{ 
            color: canJoin && !isStarted ? '#f59e0b' : isStarted ? '#10b981' : 'inherit', 
            fontWeight: canJoin ? 700 : 500,
            fontSize: '0.9rem'
          }}>
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
              width: '100%'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.3rem' }}>login</span>
            {t('join_interview')}
          </button>
        ) : (
          <div style={{
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
            gap: '6px'
          }}>
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
  const { notifications } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleOk, setGoogleOk] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [expandedDay, setExpandedDay] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_sync') === 'success') {
      setSyncMessage({ type: 'success', text: t('google_sync_success') });
      // Remove params from URL to avoid repeated messages on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('google_sync') === 'error') {
      setSyncMessage({ type: 'error', text: t('google_sync_error') });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    const timer = setTimeout(() => setSyncMessage(null), 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      const [ra, ri, rg, rp] = await Promise.allSettled([
        apiFetch('/applications/my-applications'),
        apiFetch('/interviews/candidate'),
        user ? apiFetch('/auth/google/status') : Promise.resolve({ connected: false }),
        getUserProfile(),
      ]);

      if (!live) return;

      setApps(ra.status === 'fulfilled' && Array.isArray(ra.value) ? ra.value : []);
      setInterviews(ri.status === 'fulfilled' && Array.isArray(ri.value) ? ri.value : []);
      
      let isConnected = rg.status === 'fulfilled' && rg.value?.connected;
      
      // Retry logic for newly connected accounts
      const params = new URLSearchParams(window.location.search);
      const isReturnSuccess = params.get('google_sync') === 'success';

      if (!isConnected && isReturnSuccess) {
         // Polling loop
         for (let i = 0; i < 3; i++) {
           await new Promise(r => setTimeout(r, 2000));
           try {
             const retryStatus = await apiFetch('/auth/google/status');
             if (retryStatus?.connected) {
               isConnected = true;
               break;
             }
           } catch (e) { /* silent */ }
         }
      }

      setGoogleOk(isConnected);

      if (isConnected) {
        try {
          const gEvents = await apiFetch('/auth/google/events');
          if (live) setGoogleEvents(gEvents || []);
        } catch (e) { console.error('G-Events error:', e); }
      }
      
      if (rp.status === 'fulfilled' && rp.value) {
        setUserProfile(rp.value);
      }

      setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  const handleSyncGoogle = async () => {
    try {
      const { url } = await apiFetch('/auth/google/url');
      if (url) window.location.href = url;
    } catch (e) {
      setSyncMessage({ type: 'error', text: t('google_connect_error') });
    }
  };

  /* funnel */
  const funnelData = useMemo(() => {
    const steps = getApplicationPipelineSteps(t);
    const total = apps.length;
    return steps.map((s) => {
      const count = apps.filter((a) => normalizeApplicationStatus(a.status) === s.id).length;
      return { ...s, count, rate: pct(count, total) };
    });
  }, [apps, t]);

  /* stats */
  const profileStrength = userProfile?.profileStrength || 0;
  const missingSections = userProfile?.profileMissing || [];
  
  // Create matching structure for profileInsights expecting 'score'
  const profileInsights = useMemo(() => ({ score: profileStrength, missing: missingSections }), [profileStrength, missingSections]);
  const skillCount = useMemo(() => userProfile?.skills?.length || 0, [userProfile]);
  const futureInterviewCount = useMemo(
    () => interviews.filter((i) => new Date(i.start_time).getTime() > Date.now()).length,
    [interviews],
  );

  /* activity */
  const displayedNotifications = useMemo(() => {
    return [...notifications]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6)
      .map(n => ({
        id: n._id,
        is_read: n.is_read,
        title: t(n.title),
        message: t(n.message),
        time: timeAgo(n.created_at, t),
        category: n.category
      }));
  }, [notifications, t]);

  /* calendar */
  const calendarCells = useMemo(() => buildCalendarGrid(calMonth.year, calMonth.month), [calMonth]);
  const monthLabel = new Date(calMonth.year, calMonth.month).toLocaleDateString(t('language') === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  const isToday = (d) => d && d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  const eventsOn = (d) => {
    if (!d) return [];
    const internal = interviews.filter((i) => {
      const x = new Date(i.start_time);
      return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
    }).map(i => ({ ...i, source: 'internal' }));
    const external = googleEvents.filter((e) => {
      const x = new Date(e.start);
      return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
    }).map(e => ({
      _id: e.id,
      company_name: e.summary,
      start_time: e.start,
      type: 'External',
      source: 'google'
    }));
    return [...internal, ...external];
  };
  const navMonth = (dir) => setCalMonth((p) => { let m = p.month + dir, y = p.year; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return { year: y, month: m }; });

  if (loading) {
    return (
      <div className="an">
        <div className="an__row1">
          <Skeleton variant="rectangle" width="100%" height="380px" style={{ borderRadius: '1.25rem', opacity: 0.1 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Skeleton variant="rectangle" width="100%" height="240px" style={{ borderRadius: '1.25rem', opacity: 0.1 }} />
            <Skeleton variant="rectangle" width="100%" height="120px" style={{ borderRadius: '1.25rem', opacity: 0.1 }} />
          </div>
        </div>
        <div className="an__row2">
          <Skeleton variant="rectangle" width="100%" height="450px" style={{ borderRadius: '1.25rem', opacity: 0.1 }} />
          <Skeleton variant="rectangle" width="100%" height="450px" style={{ borderRadius: '1.25rem', opacity: 0.1 }} />
          <Skeleton variant="rectangle" width="100%" height="450px" style={{ borderRadius: '1.25rem', opacity: 0.1 }} />
        </div>
      </div>
    );
  }

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

      {/* ═══ ROW 1: Funnel + Interviews + mini stats ═══ */}
      <div className="an__row1">
        <ApplicationFunnel data={funnelData} onAction={() => navigate('/candidat/dashboard/my-submissions')} />

        <div className="an__right-stack">
          {/* Upcoming Interviews Widget */}
            <NextInterviewWidget interviews={interviews} t={t} navigate={navigate} apps={apps} />

          {/* Mini stat strip */}
          <div className="mini-stats">
            <div className="mini-stat">
              <div className="mini-stat__icon">
                <span className="material-symbols-outlined">trending_up</span>
              </div>
              <span className="mini-stat__value">{profileStrength}%</span>
              <span className="mini-stat__label">{t('stat_profile')}</span>
              {missingSections && missingSections.length > 0 && profileStrength < 100 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--tf-on-surface-variant)', marginTop: '0.5rem', textAlign: 'center', lineHeight: '1.2' }}>
                  {t('jobs-widget-profile-why-missing')} {missingSections.map(s => t(`jobs-section-${s}`)).join(', ')}.
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
          </div>
        </div>
      </div>

      {/* ═══ ROW 2: Calendar + Profile/Skills + Activity ═══ */}
      <div className="an__row2">
        {/* Calendar */}
        <div className="an__card cal-card">
          <div className="cal__header">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div>
                <h3 className="cal__label">{t('calendar_title')}</h3>
                <p className="cal__month">{monthLabel}</p>
              </div>
              {!googleOk ? (
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

          <div className="cal__grid">
            {[t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat'), t('day_sun')].map((d, i) => (
              <div key={i} className="cal__wday">{d}</div>
            ))}
            {calendarCells.map((date, i) => {
              const ev = eventsOn(date);
              return (
                <div
                  key={i}
                  className={`cal__day${!date ? ' cal__day--empty' : ''}${date && isToday(date) ? ' cal__day--today' : ''}${ev.length ? ' cal__day--event' : ''}`}
                  onClick={() => ev.length && setExpandedDay({ date, events: ev })}
                >
                  {date && <span className="cal__num">{date.getDate()}</span>}
                  {ev.some(e => e.source === 'google') && <span className="cal__g-dot" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Insights Column */}
        <div className="an__mid-stack">
            <div className="mini-stat mini-stat--clickable" onClick={() => navigate('/candidat/dashboard/my-submissions')}>
              <div className="mini-stat__icon mini-stat__icon--orange">
                <span className="material-symbols-outlined">description</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="mini-stat__value">{apps.length}</span>
                <span className="mini-stat__label">{t('stat_applications')}</span>
              </div>
            </div>
            <div className="mini-stat mini-stat--clickable" onClick={() => navigate('/candidat/interviews')}>
              <div className="mini-stat__icon mini-stat__icon--pink">
                <span className="material-symbols-outlined">event</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="mini-stat__value">{interviews.length}</span>
                <span className="mini-stat__label">{t('stat_interviews')}</span>                </div>
              </div>        </div>

        {/* Activity Feed */}
        <div className="an__card activity-card">
          <div className="activity-card__head">
            <h3>{t('recent_notifications')}</h3>
            <button className="activity-card__all" onClick={() => navigate('/candidat/dashboard/notifications')}>{t('see_all')}</button>
          </div>
          <div className="activity-card__list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            {displayedNotifications.length > 0 ? displayedNotifications.map((n) => (
              <div 
                key={n.id} 
                className={`act-row ${n.is_read ? 'act-row--read' : 'act-row--unread'}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', 
                  padding: '0.85rem 1rem', borderRadius: '12px',
                  backgroundColor: n.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                  border: n.is_read ? '1px solid var(--tf-outline-variant)' : '1px solid rgba(99, 102, 241, 0.2)',
                  cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative'
                }}
                onClick={() => navigate('/candidat/dashboard/notifications', { state: { selectedId: n.id } })}
              >
                {!n.is_read && <div style={{width: '6px', height: '6px', backgroundColor: 'var(--color-primary)', borderRadius: '50%', position: 'absolute', top: '16px', left: '8px'}} />}
                
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: n.category === 'quiz' ? 'rgba(236,72,153,0.1)' : n.category === 'application' ? 'rgba(74,222,128,0.1)' : 'rgba(99,102,241,0.1)',
                  color: n.category === 'quiz' ? '#ec4899' : n.category === 'application' ? '#4ade80' : '#6366f1',
                  flexShrink: 0, marginLeft: n.is_read ? 0 : '8px'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {n.category === 'quiz' ? 'quiz' : n.category === 'application' ? 'work_history' : 'notifications'}
                  </span>
                </div>
                
                <div className="act-info" style={{ flex: 1, minWidth: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <p className="act-title" style={{ 
                    margin: 0, fontSize: '0.85rem', fontWeight: n.is_read ? 600 : 700, 
                    color: n.is_read ? 'var(--tf-on-surface)' : 'var(--tf-on-surface)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {n.title}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--tf-on-surface-variant)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.message}
                  </p>
                </div>
                
                <p className="act-time" style={{ margin: 0, fontSize: '0.7rem', color: n.is_read ? 'var(--tf-on-surface-variant)' : 'var(--color-primary)', flexShrink: 0, fontWeight: 600 }}>
                  {n.time}
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
      </div>

      {/* Modal */}
      {expandedDay && (
        <div className="modal-bg" onClick={() => setExpandedDay(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h3>{expandedDay.date.toLocaleDateString(t('language') === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              <button onClick={() => setExpandedDay(null)} className="modal-x"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="modal-events">
              {expandedDay.events.map((ev) => (
                <div key={ev._id} className={`modal-ev modal-ev--${ev.source}`}>
                  <span className="modal-ev__time">{new Date(ev.start_time).toLocaleTimeString(t('language') === 'fr' ? 'fr-FR' : 'en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                  <div className="modal-ev__details">
                    <span className="modal-ev__type">{ev.type}</span>
                    <span className="modal-ev__co">
                      {ev.source === 'google' && <span className="google-tag">{t('external_tag')}</span>}
                      {ev.company_name || ''}
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
