import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../../core/api';
import { useLanguage } from '../../../../core/useLanguage';
import { parseDate, formatDate, formatTime, isJoinableInterview, INTERVIEW_END_FALLBACK_MINUTES } from '../../core/interviewUtils';
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

function getDateStr(isoStr) {
  const d = parseDate(isoStr);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function MiniCalendar({ interviews, proposals, language, onDayClick }) {
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

  return (
    <div className="iv-cal">
      <div className="iv-cal__nav">
        <button
          type="button"
          className="iv-cal__arrow"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="iv-cal__month">{monthLabel}</span>
        <button
          type="button"
          className="iv-cal__arrow"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="iv-cal__grid">
        {dow.map((d, i) => (
          <div key={i} className="iv-cal__dow">{d}</div>
        ))}
        {Array.from({ length: startOffset }, (_, i) => (
          <div key={`pad-${i}`} className="iv-cal__pad" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const hasInterview = interviewDays.has(day);
          const hasProposal = proposalDays.has(day);
          const isToday = isCurrentMonth && today.getDate() === day;
          const clickable = hasInterview || hasProposal;
          return (
            <button
              key={day}
              type="button"
              className={`iv-cal__day${isToday ? ' is-today' : ''}${clickable ? ' is-event' : ''}`}
              onClick={() => clickable && onDayClick(new Date(year, month, day))}
              disabled={!clickable}
            >
              <span>{day}</span>
              {hasProposal && <span className="iv-cal__dot iv-cal__dot--amber" />}
              {hasInterview && !hasProposal && <span className="iv-cal__dot iv-cal__dot--indigo" />}
            </button>
          );
        })}
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
        (!end && start && start < now && !['scheduled', 'in_progress'].includes(status));

      if (isPast) past.push(iv);
      else upcoming.push(iv);
    });

    upcoming.sort((a, b) => (parseDate(a.start_time)?.getTime() || 0) - (parseDate(b.start_time)?.getTime() || 0));
    past.sort((a, b) => (parseDate(b.start_time)?.getTime() || 0) - (parseDate(a.start_time)?.getTime() || 0));

    return { upcomingItems: upcoming, pastItems: past };
  }, [interviews]);

  const isEmpty = proposals.length === 0 && upcomingItems.length === 0 && pastItems.length === 0;

  const handleDayClick = useCallback((date) => {
    if (!listRef.current) return;
    const dateStr = getDateStr(date.toISOString());
    const target = listRef.current.querySelector(`[data-date="${dateStr}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  if (loading) {
    return (
      <div className="iv-page">
        <div className="iv-layout">
          <div className="iv-list">
            {[1, 2, 3].map((n) => <div key={n} className="iv-skeleton-card" />)}
          </div>
          <div className="iv-sidebar">
            <div className="iv-cal iv-cal--loading" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="iv-page">
        <div className="iv-error">
          <p>{error}</p>
          <button type="button" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="iv-page">
      <div className="iv-layout">
        <div className="iv-list" ref={listRef}>
          {isEmpty ? (
            <div className="iv-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p>{t('interviews-empty')}</p>
              <button type="button" className="iv-empty__cta" onClick={() => navigate('/candidat/dashboard/find-jobs')}>
                {t('sidebar-find-jobs')}
              </button>
            </div>
          ) : (
            <>
              {/* ── Proposals ── */}
              <section className="iv-section">
                <h2 className="iv-section__title">
                  {t('interviews-proposals')}
                  {proposals.length > 0 && (
                    <span className="iv-section__count iv-section__count--amber">{proposals.length}</span>
                  )}
                </h2>
                {proposals.length === 0 ? (
                  <p className="iv-section__empty">{t('interviews-no-proposals')}</p>
                ) : (
                  proposals.map((proposal) => (
                    <div
                      key={proposal._id}
                      className="iv-card iv-card--proposal"
                      data-date={getDateStr(proposal.slots?.[0])}
                    >
                      <div className="iv-card__accent iv-card__accent--amber" />
                      <div className="iv-card__body">
                        <div className="iv-card__head">
                          <div>
                            <div className="iv-card__title">
                              {proposal.interview_type || t('interviews-video-call')}
                            </div>
                            <div className="iv-card__sub">
                              {proposal.slots?.length || 0} {t('interviews-slots-available')}
                            </div>
                          </div>
                          <span className="iv-badge iv-badge--amber">{t('interviews-proposals')}</span>
                        </div>
                        {proposal.message && (
                          <p className="iv-card__message">"{proposal.message}"</p>
                        )}
                        <div className="iv-card__slots">
                          {(proposal.slots || []).slice(0, 3).map((slot, i) => (
                            parseDate(slot) ? (
                              <span key={i} className="iv-slot-chip">
                                {formatDate(slot, locale, { weekday: 'short', month: 'short', day: 'numeric' })}
                                {' · '}
                                {formatTime(slot, locale)}
                              </span>
                            ) : null
                          ))}
                          {(proposal.slots?.length || 0) > 3 && (
                            <span className="iv-slot-chip iv-slot-chip--more">
                              +{proposal.slots.length - 3}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="iv-card__cta iv-card__cta--amber"
                          onClick={() => navigate(`/candidat/interviews/select/${proposal.application_id}`)}
                        >
                          {t('interviews-choose-slot')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </section>

              {/* ── Upcoming ── */}
              <section className="iv-section">
                <h2 className="iv-section__title">
                  {t('interviews-upcoming')}
                  {upcomingItems.length > 0 && (
                    <span className="iv-section__count iv-section__count--indigo">{upcomingItems.length}</span>
                  )}
                </h2>
                {upcomingItems.length === 0 ? (
                  <p className="iv-section__empty">{t('interviews-no-upcoming')}</p>
                ) : (
                  upcomingItems.map((iv) => {
                    const joinable = isJoinableInterview(iv.status, iv.start_time, iv.end_time);
                    const meta = STATUS_META[iv.status] || { key: 'interviews-scheduled', color: 'indigo' };
                    return (
                      <div
                        key={iv._id}
                        className="iv-card iv-card--upcoming"
                        data-date={getDateStr(iv.start_time)}
                      >
                        <div className="iv-card__accent iv-card__accent--indigo" />
                        <div className="iv-card__body">
                          <div className="iv-card__head">
                            <div>
                              <div className="iv-card__title">{iv.type || t('interviews-video-call')}</div>
                              <div className="iv-card__sub">
                                {formatDate(iv.start_time, locale, { weekday: 'long', month: 'long', day: 'numeric' })}
                                {iv.start_time && ` · ${formatTime(iv.start_time, locale)}`}
                                {iv.end_time && ` – ${formatTime(iv.end_time, locale)}`}
                              </div>
                            </div>
                            <span className={`iv-badge iv-badge--${meta.color}`}>{t(meta.key)}</span>
                          </div>
                          {joinable && (
                            <button
                              type="button"
                              className="iv-card__cta iv-card__cta--indigo"
                              onClick={() => navigate(`/candidat/interviews/room/${iv._id}`)}
                            >
                              {t('interviews-join')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </section>

              {/* ── Past ── */}
              <section className="iv-section">
                <h2 className="iv-section__title">
                  {t('interviews-past')}
                  {pastItems.length > 0 && (
                    <span className="iv-section__count">{pastItems.length}</span>
                  )}
                </h2>
                {pastItems.length === 0 ? (
                  <p className="iv-section__empty">{t('interviews-no-past')}</p>
                ) : (
                  pastItems.map((iv) => {
                    const meta = STATUS_META[iv.status] || { key: 'interviews-completed', color: 'gray' };
                    return (
                      <div
                        key={iv._id}
                        className="iv-card iv-card--past"
                        data-date={getDateStr(iv.start_time)}
                      >
                        <div className="iv-card__accent iv-card__accent--gray" />
                        <div className="iv-card__body">
                          <div className="iv-card__head">
                            <div>
                              <div className="iv-card__title">{iv.type || t('interviews-video-call')}</div>
                              <div className="iv-card__sub">
                                {formatDate(iv.start_time, locale, { weekday: 'long', month: 'long', day: 'numeric' })}
                                {iv.start_time && ` · ${formatTime(iv.start_time, locale)}`}
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
            </>
          )}
        </div>

        <div className="iv-sidebar">
          <MiniCalendar
            interviews={interviews}
            proposals={proposals}
            language={language}
            onDayClick={handleDayClick}
          />
        </div>
      </div>
    </div>
  );
};

export default Interviews;
