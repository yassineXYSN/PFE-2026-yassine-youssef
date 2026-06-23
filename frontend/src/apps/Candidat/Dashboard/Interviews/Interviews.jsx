import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../../core/api';
import { useLanguage } from '../../../../core/useLanguage';
import { parseDate, formatDate, formatTime, isJoinableInterview } from '../../core/interviewUtils';
import './Interviews.css';

const STATUS_META = {
  scheduled:   { key: 'interviews-scheduled',   color: 'indigo' },
  in_progress: { key: 'interviews-in-progress', color: 'green'  },
  completed:   { key: 'interviews-completed',   color: 'gray'   },
  no_show:     { key: 'interviews-missed',       color: 'red'    },
  missed:      { key: 'interviews-missed',       color: 'red'    },
  cancelled:   { key: 'interviews-cancelled',   color: 'gray'   },
  canceled:    { key: 'interviews-cancelled',   color: 'gray'   },
};

const DOW_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DOW_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const TABS = ['all', 'proposals', 'upcoming', 'past'];

function getDateStr(isoStr) {
  const d = parseDate(isoStr);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function useCountdown(targetIso) {
  const [diff, setDiff] = useState(null);
  useEffect(() => {
    const target = parseDate(targetIso);
    if (!target) return;
    const update = () => setDiff(Math.max(0, target - new Date()));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [targetIso]);
  return diff;
}

function Countdown({ startTime }) {
  const diff = useCountdown(startTime);
  if (diff === null || diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return <span className="iv-countdown">in {days}d {hours}h</span>;
  if (hours > 0) return <span className="iv-countdown iv-countdown--soon">in {hours}h {mins}m</span>;
  return <span className="iv-countdown iv-countdown--imminent">in {mins}m</span>;
}

function MiniCalendar({ interviews, proposals, language, onDayClick, selectedDate }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const dow = language === 'fr' ? DOW_FR : DOW_EN;

  const interviewDays = useMemo(() => {
    const days = new Set();
    interviews.forEach((iv) => {
      const d = parseDate(iv.start_time);
      if (d && d.getFullYear() === year && d.getMonth() === month) days.add(d.getDate());
    });
    return days;
  }, [interviews, year, month]);

  const proposalDays = useMemo(() => {
    const days = new Set();
    proposals.forEach((p) => {
      (p.slots || []).forEach((slot) => {
        const d = parseDate(slot);
        if (d && d.getFullYear() === year && d.getMonth() === month) days.add(d.getDate());
      });
    });
    return days;
  }, [proposals, year, month]);

  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const monthLabel = viewDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const selectedDay =
    selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === month
      ? selectedDate.getDate()
      : null;

  return (
    <div className="iv-cal">
      <div className="iv-cal__nav">
        <button
          type="button"
          className="iv-cal__arrow"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          aria-label="Previous month"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="iv-cal__month">{monthLabel}</span>
        <button
          type="button"
          className="iv-cal__arrow"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          aria-label="Next month"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
      <div className="iv-cal__grid">
        {dow.map((d, i) => <div key={i} className="iv-cal__dow">{d}</div>)}
        {Array.from({ length: startOffset }, (_, i) => <div key={`pad-${i}`} className="iv-cal__pad" />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const hasInterview = interviewDays.has(day);
          const hasProposal = proposalDays.has(day);
          const isToday = isCurrentMonth && today.getDate() === day;
          const isSelected = selectedDay === day && !isToday;
          const clickable = hasInterview || hasProposal;
          return (
            <button
              key={day}
              type="button"
              className={['iv-cal__day', isToday ? 'is-today' : '', isSelected ? 'is-selected' : '', clickable ? 'is-event' : ''].filter(Boolean).join(' ')}
              onClick={() => clickable && onDayClick(new Date(year, month, day))}
              disabled={!clickable}
            >
              <span>{day}</span>
              {(hasProposal || hasInterview) && (
                <div className="iv-cal__dots">
                  {hasProposal && <span className="iv-cal__dot iv-cal__dot--amber" />}
                  {hasInterview && <span className="iv-cal__dot iv-cal__dot--indigo" />}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="iv-cal__legend">
        <span className="iv-cal__legend-item">
          <span className="iv-cal__dot iv-cal__dot--indigo" />
          Interview
        </span>
        <span className="iv-cal__legend-item">
          <span className="iv-cal__dot iv-cal__dot--amber" />
          Proposal
        </span>
      </div>
    </div>
  );
}

const Interviews = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const listRef = useRef(null);

  const [interviews, setInterviews] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDate, setSelectedDate] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ivData, propData] = await Promise.all([
        apiFetch('/interviews/candidate'),
        apiFetch('/interviews/proposals/candidate'),
      ]);
      setInterviews(Array.isArray(ivData) ? ivData : []);
      setProposals(Array.isArray(propData) ? propData : []);
    } catch (err) {
      setError(err?.message || 'Failed to load interviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const { upcomingItems, pastItems } = useMemo(() => {
    const now = new Date();
    const upcoming = [];
    const past = [];
    interviews.forEach((iv) => {
      const status = `${iv.status || ''}`.toLowerCase();
      const end = parseDate(iv.end_time);
      const start = parseDate(iv.start_time);
      const isPast =
        ['completed', 'no_show', 'missed', 'cancelled', 'canceled'].includes(status) ||
        (end && end < now) ||
        (!end && start && start < now && status !== 'in_progress');
      if (isPast) past.push(iv);
      else upcoming.push(iv);
    });
    upcoming.sort((a, b) => (parseDate(a.start_time)?.getTime() || 0) - (parseDate(b.start_time)?.getTime() || 0));
    past.sort((a, b) => (parseDate(b.start_time)?.getTime() || 0) - (parseDate(a.start_time)?.getTime() || 0));
    return { upcomingItems: upcoming, pastItems: past };
  }, [interviews]);

  const isEmpty = proposals.length === 0 && upcomingItems.length === 0 && pastItems.length === 0;

  const handleDayClick = useCallback((date) => {
    setSelectedDate(date);
    if (!listRef.current) return;
    const dateStr = getDateStr(date.toISOString());
    const target = listRef.current.querySelector(`[data-date="${dateStr}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const tabCounts = {
    all: proposals.length + upcomingItems.length + pastItems.length,
    proposals: proposals.length,
    upcoming: upcomingItems.length,
    past: pastItems.length,
  };

  const showProposals = activeTab === 'all' || activeTab === 'proposals';
  const showUpcoming = activeTab === 'all' || activeTab === 'upcoming';
  const showPast = activeTab === 'all' || activeTab === 'past';

  if (loading) {
    return (
      <div className="iv-page">
        <div className="iv-header">
          <div className="iv-header__top">
            <div>
              <div className="iv-skeleton" style={{ height: 28, width: 200, borderRadius: 8, marginBottom: 8 }} />
              <div className="iv-skeleton" style={{ height: 16, width: 280, borderRadius: 6 }} />
            </div>
          </div>
          <div className="iv-stats-row">
            {[1, 2, 3].map(n => <div key={n} className="iv-stat-card iv-skeleton" />)}
          </div>
        </div>
        <div className="iv-layout">
          <div className="iv-list">
            {[100, 80, 120].map((h, n) => <div key={n} className="iv-skeleton-card iv-skeleton" style={{ height: h }} />)}
          </div>
          <div className="iv-sidebar">
            <div className="iv-skeleton" style={{ height: 280, borderRadius: 18 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="iv-page">
        <div className="iv-error">
          <div className="iv-error__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="iv-error__msg">{error}</p>
          <button type="button" className="iv-btn iv-btn--primary" onClick={load}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="iv-page">
      {/* ── Header ── */}
      <div className="iv-header">
        <div className="iv-header__top">
          <div>
            <h1 className="iv-header__title">{t('interviews-page-title') || 'My Interviews'}</h1>
            <p className="iv-header__sub">Track your upcoming sessions and pending proposals</p>
          </div>
          <button type="button" className="iv-btn iv-btn--ghost" onClick={load} aria-label="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>

        {!isEmpty && (
          <div className="iv-stats-row">
            <div className="iv-stat-card iv-stat-card--amber">
              <span className="iv-stat-card__num">{proposals.length}</span>
              <span className="iv-stat-card__label">{t('interviews-proposals') || 'Proposals'}</span>
            </div>
            <div className="iv-stat-card iv-stat-card--indigo">
              <span className="iv-stat-card__num">{upcomingItems.length}</span>
              <span className="iv-stat-card__label">{t('interviews-upcoming') || 'Upcoming'}</span>
            </div>
            <div className="iv-stat-card iv-stat-card--muted">
              <span className="iv-stat-card__num">{pastItems.length}</span>
              <span className="iv-stat-card__label">{t('interviews-past') || 'Past'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="iv-layout">
        <div className="iv-list" ref={listRef}>
          {isEmpty ? (
            <div className="iv-empty">
              <div className="iv-empty__icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="iv-empty__title">{t('interviews-empty') || 'No interviews yet'}</h3>
              <p className="iv-empty__text">Apply to jobs to start receiving interview invitations from recruiters.</p>
              <button type="button" className="iv-btn iv-btn--primary iv-empty__cta" onClick={() => navigate('/candidat/dashboard/find-jobs')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {t('sidebar-find-jobs') || 'Browse Jobs'}
              </button>
            </div>
          ) : (
            <>
              {/* ── Tabs ── */}
              <div className="iv-tabs" role="tablist">
                {TABS.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    className={`iv-tab${activeTab === tab ? ' is-active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                    aria-selected={activeTab === tab}
                  >
                    <span className="iv-tab__label">
                      {tab === 'all' ? (t('interviews-all') || 'All') :
                       tab === 'proposals' ? (t('interviews-proposals') || 'Proposals') :
                       tab === 'upcoming' ? (t('interviews-upcoming') || 'Upcoming') :
                       (t('interviews-past') || 'Past')}
                    </span>
                    {tabCounts[tab] > 0 && (
                      <span className={`iv-tab__count${tab === 'proposals' && tabCounts.proposals > 0 ? ' iv-tab__count--amber' : ''}`}>
                        {tabCounts[tab]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Proposals ── */}
              {showProposals && (
                <section className="iv-section">
                  {activeTab === 'all' && (
                    <h2 className="iv-section__title">
                      <span className="iv-section__title-dot iv-section__title-dot--amber" />
                      {t('interviews-proposals') || 'Proposals'}
                      {proposals.length > 0 && <span className="iv-section__count iv-section__count--amber">{proposals.length}</span>}
                    </h2>
                  )}
                  {proposals.length === 0 ? (
                    <p className="iv-section__empty">{t('interviews-no-proposals') || 'No pending proposals'}</p>
                  ) : (
                    proposals.map((proposal) => (
                      <div key={proposal._id} className="iv-card iv-card--proposal" data-date={getDateStr(proposal.slots?.[0])}>
                        <div className="iv-card__accent iv-card__accent--amber" />
                        <div className="iv-card__body">
                          <div className="iv-card__head">
                            <div className="iv-card__info">
                              <div className="iv-card__type-icon iv-card__type-icon--amber">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                              </div>
                              <div>
                                <div className="iv-card__title">{proposal.interview_type || t('interviews-video-call') || 'Video Interview'}</div>
                                <div className="iv-card__sub">
                                  {proposal.slots?.length || 0}&nbsp;{t('interviews-slots-available') || 'slots available'}
                                </div>
                              </div>
                            </div>
                            <span className="iv-badge iv-badge--amber">
                              <span className="iv-badge__pulse" />
                              {t('interviews-proposals') || 'Proposal'}
                            </span>
                          </div>
                          {proposal.message && (
                            <p className="iv-card__message">"{proposal.message}"</p>
                          )}
                          <div className="iv-card__slots">
                            {(proposal.slots || []).slice(0, 3).map((slot, i) =>
                              parseDate(slot) ? (
                                <span key={i} className="iv-slot-chip">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                  </svg>
                                  {formatDate(slot, locale, { weekday: 'short', month: 'short', day: 'numeric' })}
                                  {' · '}
                                  {formatTime(slot, locale)}
                                </span>
                              ) : null
                            )}
                            {(proposal.slots?.length || 0) > 3 && (
                              <span className="iv-slot-chip iv-slot-chip--more">+{proposal.slots.length - 3} more</span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="iv-btn iv-btn--amber"
                            onClick={() => navigate(`/candidat/interviews/select/${proposal.application_id}`)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                            </svg>
                            {t('interviews-choose-slot') || 'Choose a slot'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              )}

              {/* ── Upcoming ── */}
              {showUpcoming && (
                <section className="iv-section">
                  {activeTab === 'all' && (
                    <h2 className="iv-section__title">
                      <span className="iv-section__title-dot iv-section__title-dot--indigo" />
                      {t('interviews-upcoming') || 'Upcoming'}
                      {upcomingItems.length > 0 && <span className="iv-section__count iv-section__count--indigo">{upcomingItems.length}</span>}
                    </h2>
                  )}
                  {upcomingItems.length === 0 ? (
                    <p className="iv-section__empty">{t('interviews-no-upcoming') || 'No upcoming interviews'}</p>
                  ) : (
                    upcomingItems.map((iv) => {
                      const joinable = isJoinableInterview(iv.status, iv.start_time, iv.end_time);
                      const meta = STATUS_META[`${iv.status || ''}`.toLowerCase()] || { key: 'interviews-scheduled', color: 'indigo' };
                      return (
                        <div
                          key={iv._id}
                          className={`iv-card iv-card--upcoming${joinable ? ' iv-card--joinable' : ''}`}
                          data-date={getDateStr(iv.start_time)}
                        >
                          <div className="iv-card__accent iv-card__accent--indigo" />
                          <div className="iv-card__body">
                            <div className="iv-card__head">
                              <div className="iv-card__info">
                                <div className="iv-card__type-icon iv-card__type-icon--indigo">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                  </svg>
                                </div>
                                <div>
                                  <div className="iv-card__title">{iv.type || t('interviews-video-call') || 'Video Interview'}</div>
                                  <div className="iv-card__sub">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    {formatDate(iv.start_time, locale, { weekday: 'long', month: 'long', day: 'numeric' })}
                                    {iv.start_time && ` · ${formatTime(iv.start_time, locale)}`}
                                    {iv.end_time && ` – ${formatTime(iv.end_time, locale)}`}
                                  </div>
                                </div>
                              </div>
                              <div className="iv-card__right">
                                <Countdown startTime={iv.start_time} />
                                <span className={`iv-badge iv-badge--${meta.color}`}>{t(meta.key)}</span>
                              </div>
                            </div>
                            {joinable && (
                              <button
                                type="button"
                                className="iv-btn iv-btn--primary iv-btn--join"
                                onClick={() => navigate(`/candidat/interviews/room/${iv._id}`)}
                              >
                                <span className="iv-join-ring" />
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                </svg>
                                {t('interviews-join') || 'Join Interview'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>
              )}

              {/* ── Past ── */}
              {showPast && (
                <section className="iv-section">
                  {activeTab === 'all' && (
                    <h2 className="iv-section__title">
                      <span className="iv-section__title-dot" />
                      {t('interviews-past') || 'Past Interviews'}
                      {pastItems.length > 0 && <span className="iv-section__count">{pastItems.length}</span>}
                    </h2>
                  )}
                  {pastItems.length === 0 ? (
                    <p className="iv-section__empty">{t('interviews-no-past') || 'No past interviews'}</p>
                  ) : (
                    pastItems.map((iv) => {
                      const meta = STATUS_META[`${iv.status || ''}`.toLowerCase()] || { key: 'interviews-completed', color: 'gray' };
                      return (
                        <div key={iv._id} className="iv-card iv-card--past" data-date={getDateStr(iv.start_time)}>
                          <div className="iv-card__accent iv-card__accent--gray" />
                          <div className="iv-card__body">
                            <div className="iv-card__head">
                              <div className="iv-card__info">
                                <div className="iv-card__type-icon iv-card__type-icon--gray">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                  </svg>
                                </div>
                                <div>
                                  <div className="iv-card__title">{iv.type || t('interviews-video-call') || 'Video Interview'}</div>
                                  <div className="iv-card__sub">
                                    {formatDate(iv.start_time, locale, { weekday: 'long', month: 'long', day: 'numeric' })}
                                    {iv.start_time && ` · ${formatTime(iv.start_time, locale)}`}
                                  </div>
                                </div>
                              </div>
                              <span className={`iv-badge iv-badge--${meta.color}`}>{t(meta.key)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="iv-sidebar">
          <MiniCalendar
            interviews={interviews}
            proposals={proposals}
            language={language}
            onDayClick={handleDayClick}
            selectedDate={selectedDate}
          />
          {!isEmpty && proposals.length > 0 && (
            <div className="iv-sidebar-tip iv-sidebar-tip--amber">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                {proposals.length} proposal{proposals.length > 1 ? 's' : ''} await{proposals.length === 1 ? 's' : ''} your response
              </span>
            </div>
          )}
          {!isEmpty && upcomingItems.length > 0 && (
            <div className="iv-sidebar-tip iv-sidebar-tip--indigo">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Next: {formatDate(upcomingItems[0].start_time, locale, { month: 'short', day: 'numeric' })} · {formatTime(upcomingItems[0].start_time, locale)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Interviews;
