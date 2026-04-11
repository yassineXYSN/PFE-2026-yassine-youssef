import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getUserProfile } from '../../../../core/api';
import { supabase } from '../../../../core/supabaseClient';
import { useLanguage } from '../../../../core/useLanguage';
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

const calculateProfileStrength = (profile) => {
  if (!profile) return { score: 0, missing: [] };
  let score = 0;
  const missing = [];
  const firstName = profile.first_name || profile.firstName;
  const lastName = profile.last_name || profile.lastName;
  const email = profile.email;
  if (firstName && lastName && email) { score += 20; } else {
    if (firstName) score += 7;
    if (lastName) score += 7;
    if (email) score += 6;
    missing.push('info');
  }
  if (profile.bio || profile.about) { score += 10; } else { missing.push('bio'); }
  if (profile.skills && profile.skills.length > 0) { score += 20; } else { missing.push('skills'); }
  const exps = profile.experience || profile.experiences;
  if (exps && exps.length > 0) { score += 25; } else { missing.push('experience'); }
  const edus = profile.education || profile.educations;
  if (edus && edus.length > 0) { score += 25; } else { missing.push('education'); }
  return { score: Math.min(100, score), missing };
};

const Analytics = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleOk, setGoogleOk] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [marketStats, setMarketStats] = useState({ availableJobs: 0, strongMatches: 0 });
  const [marketLoading, setMarketLoading] = useState(true);
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
      setMarketLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const marketPromise = user ? apiFetch('/candidat/jobs') : Promise.resolve([]);
      
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

      marketPromise
        .then((jobs) => {
          if (!live || !Array.isArray(jobs)) return;

          const strongMatches = jobs.filter((job) => {
            const score = Number(job?.match_score);
            if (Number.isFinite(score)) return score >= 70;
            return job?.matchTone === 'strong';
          }).length;

          setMarketStats({
            availableJobs: jobs.length,
            strongMatches,
          });
        })
        .catch((error) => {
          console.error('Market stats error:', error);
          if (live) {
            setMarketStats({ availableJobs: 0, strongMatches: 0 });
          }
        })
        .finally(() => {
          if (live) setMarketLoading(false);
        });
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

  /* next interview */
  const nextInterview = useMemo(() => {
    const now = Date.now();
    return interviews
      .filter((i) => new Date(i.start_time).getTime() > now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0] || null;
  }, [interviews]);

  /* stats */
  const profileInsights = useMemo(() => calculateProfileStrength(userProfile), [userProfile]);
  const profileStrength = profileInsights.score;
  const skillCount = useMemo(() => userProfile?.skills?.length || 0, [userProfile]);
  const futureInterviewCount = useMemo(
    () => interviews.filter((i) => new Date(i.start_time).getTime() > Date.now()).length,
    [interviews],
  );

  /* activity */
  const activity = useMemo(() => {
    const colorMap = { in_review: 'purple', interview: 'pink', technical_test: 'purple', new: 'pink', accepted: 'purple' };
    return [...apps]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 6)
      .map((a) => {
        const st = normalizeApplicationStatus(a.status);
        return {
          id: a._id,
          color: colorMap[st] || 'purple',
          title: a.job_title || t('analytics-applied'),
          company: a.company_name || '',
          time: timeAgo(a.updatedAt || a.createdAt, t),
        };
      });
  }, [apps]);

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
          {/* Upcoming Interviews */}
          <div className="icard">
            <h3 className="icard__title">{t('upcoming_interviews')}</h3>
            {nextInterview ? (
              <div className="icard__body">
                <p className="icard__company">{nextInterview.company_name}</p>
                <p className="icard__type">{nextInterview.type || t('analytics-interview')}</p>
                <button className="icard__btn" onClick={() => navigate(`/candidat/interviews/room/${nextInterview._id}`)}>
                  {t('join_interview')}
                </button>
              </div>
            ) : (
              <div className="icard__empty">
                <span className="material-symbols-outlined" style={{ fontSize: 44, opacity: 0.2, marginBottom: '0.5rem' }}>event_available</span>
                <p>{t('no_upcoming_interviews')}</p>
              </div>
            )}
          </div>

          {/* Mini stat strip */}
          <div className="mini-stats">
            <div className="mini-stat">
              <div className="mini-stat__icon">
                <span className="material-symbols-outlined">trending_up</span>
              </div>
              <span className="mini-stat__value">{profileStrength}%</span>
              <span className="mini-stat__label">{t('stat_profile')}</span>
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
          <div className="mini-stat mini-stat--clickable" onClick={() => navigate('/candidat/dashboard/find-jobs')}>
            <div className="mini-stat__icon mini-stat__icon--orange">
              <span className="material-symbols-outlined">work</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="mini-stat__value">{marketLoading ? '...' : marketStats.availableJobs}</span>
              <span className="mini-stat__label">{t('stat_jobs')}</span>
            </div>
          </div>
          <div className="mini-stat mini-stat--clickable" onClick={() => navigate('/candidat/dashboard/find-jobs')}>
            <div className="mini-stat__icon mini-stat__icon--pink">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="mini-stat__value">{marketLoading ? '...' : marketStats.strongMatches}</span>
              <span className="mini-stat__label">{t('stat_matches')}</span>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="an__card activity-card">
          <div className="activity-card__head">
            <h3>{t('recent_notifications')}</h3>
            <button className="activity-card__all" onClick={() => navigate('/candidat/dashboard/notifications')}>{t('see_all')}</button>
          </div>
          <div className="activity-card__list">
            {activity.length > 0 ? activity.map((a) => (
              <div key={a.id} className="act-row">
                <span className={`act-dot act-dot--${a.color}`} />
                <div className="act-info">
                  <p className="act-title"><strong>{a.title}</strong> — {a.company}</p>
                </div>
                <p className="act-time">{a.time}</p>
              </div>
            )) : (
              <p className="act-empty">{t('no_recent_activity')}</p>
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
