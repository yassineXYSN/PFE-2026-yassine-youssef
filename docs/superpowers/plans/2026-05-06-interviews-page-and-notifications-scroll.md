# Interviews Page + Notifications Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "My Interviews" dashboard page with a list + mini-calendar, wire it to the sidebar, and fix the notifications panel to always show 10 items with scroll.

**Architecture:** New `Dashboard/Interviews/` page follows the same pattern as `Dashboard/Notifications/`. Shared interview utility functions are extracted to `Candidat/core/interviewUtils.js`. A new backend endpoint returns all pending proposals for the candidate. The notifications panel drops its ResizeObserver in favour of a static slice of 10.

**Tech Stack:** React 18, React Router v6, FastAPI/Python (backend), CSS variables matching existing design system, no external calendar library.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `backend/routers/interviews.py` |
| Create | `frontend/src/apps/Candidat/core/interviewUtils.js` |
| Modify | `frontend/src/apps/Candidat/Dashboard/Analytics/Analytics.jsx` |
| Modify | `frontend/src/apps/Candidat/Dashboard/Analytics/Analytics.css` |
| Create | `frontend/src/assets/translations/dashboard/interviews.js` |
| Modify | `frontend/src/apps/Candidat/core/translations.js` |
| Create | `frontend/src/apps/Candidat/Dashboard/Interviews/Interviews.jsx` |
| Create | `frontend/src/apps/Candidat/Dashboard/Interviews/Interviews.css` |
| Modify | `frontend/src/core/routesCandidat.jsx` |
| Modify | `frontend/src/apps/Candidat/Dashboard/components/Sidebar/Sidebar.jsx` |

---

## Task 1: Backend — Add `GET /interviews/proposals/candidate`

**Files:**
- Modify: `backend/routers/interviews.py` (insert before the `@router.get("/proposals/application/{application_id}")` route, around line 476)

- [ ] **Step 1: Insert the new route**

Open `backend/routers/interviews.py`. Find the comment `# ── GET Interview Proposal by Application` (around line 476). Insert the following block **directly before** it:

```python
# ── GET all pending proposals for candidate ────────────────────────────────
@router.get("/proposals/candidate")
async def get_proposals_for_candidate(
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "candidat":
        raise HTTPException(status_code=403, detail="Only candidates can access this endpoint")

    db = get_db()
    apps = list(db.job_applications.find({"candidate_id": current_user["id"]}, {"_id": 1}))
    app_ids = [str(a["_id"]) for a in apps]

    if not app_ids:
        return []

    cursor = db.hr_interview_proposals.find(
        {"application_id": {"$in": app_ids}, "status": "pending"}
    ).sort("created_at", -1)

    return serialize(list(cursor))
```

- [ ] **Step 2: Restart the backend and verify**

```bash
# In your backend directory
uvicorn main:app --reload
```

Then test with curl (replace TOKEN with a valid candidate JWT):
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/api/interviews/proposals/candidate
```
Expected: `200 []` or a JSON array of proposal objects.

- [ ] **Step 3: Commit**

```bash
git add backend/routers/interviews.py
git commit -m "feat: add GET /interviews/proposals/candidate endpoint"
```

---

## Task 2: Create Shared Interview Utilities

**Files:**
- Create: `frontend/src/apps/Candidat/core/interviewUtils.js`
- Modify: `frontend/src/apps/Candidat/Dashboard/Analytics/Analytics.jsx`

- [ ] **Step 1: Create `interviewUtils.js`**

```js
// frontend/src/apps/Candidat/core/interviewUtils.js

const INTERVIEW_END_FALLBACK_MINUTES = 45;
const INTERVIEW_JOIN_WINDOW_MINUTES = 10;

export function parseDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value, locale, options) {
  const parsed = parseDate(value);
  if (!parsed) return '';
  return parsed.toLocaleDateString(locale, options);
}

export function formatTime(value, locale) {
  const parsed = parseDate(value);
  if (!parsed) return '';
  return parsed.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

export function isJoinableInterview(status, startTime, endTime) {
  const start = parseDate(startTime);
  if (!start) return false;

  const end =
    parseDate(endTime) ||
    new Date(start.getTime() + INTERVIEW_END_FALLBACK_MINUTES * 60_000);
  const now = new Date();
  const statusValue = `${status || ''}`.toLowerCase();

  if (statusValue === 'in_progress') return true;
  if (!['scheduled', 'confirmed'].includes(statusValue)) return false;

  return (
    now >= new Date(start.getTime() - INTERVIEW_JOIN_WINDOW_MINUTES * 60_000) &&
    now <= end
  );
}
```

- [ ] **Step 2: Update `Analytics.jsx` to import from the shared util**

At the top of `Analytics.jsx`, add this import after the existing imports:

```js
import { parseDate, formatDate, formatTime, isJoinableInterview } from '../../core/interviewUtils';
```

Then **delete** the four function definitions that are now duplicated in the file (they are plain functions, not inside the component). Delete these blocks:

```js
function parseDate(value) { … }
function formatDate(value, locale, options) { … }
function formatTime(value, locale) { … }
function isJoinableInterview(status, startTime, endTime) { … }
```

Also delete the two constants that are now inside `interviewUtils.js` and only used by `isJoinableInterview`:

```js
const INTERVIEW_END_FALLBACK_MINUTES = 45;
const INTERVIEW_JOIN_WINDOW_MINUTES = 10;
```

- [ ] **Step 3: Verify the frontend still compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: no errors mentioning `parseDate`, `formatDate`, `formatTime`, or `isJoinableInterview`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/apps/Candidat/core/interviewUtils.js \
        frontend/src/apps/Candidat/Dashboard/Analytics/Analytics.jsx
git commit -m "refactor: extract interview utils to shared module"
```

---

## Task 3: Fix Notifications Panel (static 10 items + scroll)

**Files:**
- Modify: `frontend/src/apps/Candidat/Dashboard/Analytics/Analytics.jsx`
- Modify: `frontend/src/apps/Candidat/Dashboard/Analytics/Analytics.css`

- [ ] **Step 1: Remove dynamic sizing state and ref from `Analytics.jsx`**

Find and **delete** these two lines (around lines 582–583):

```js
  const notificationsBodyRef = useRef(null);
  const [visibleNotificationCount, setVisibleNotificationCount] = useState(5);
```

- [ ] **Step 2: Remove the ResizeObserver `useEffect` from `Analytics.jsx`**

Find and **delete** the entire `useEffect` block that starts with:

```js
  useEffect(() => {
    const element = notificationsBodyRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
```

Delete from that line through its closing `}, []);` (the effect with empty dependency array for the ResizeObserver).

- [ ] **Step 3: Replace `visibleNotificationItems` useMemo**

Find:

```js
  const visibleNotificationItems = useMemo(
    () => notificationItems.slice(0, visibleNotificationCount),
    [notificationItems, visibleNotificationCount],
  );
```

Replace with:

```js
  const visibleNotificationItems = useMemo(
    () => notificationItems.slice(0, 10),
    [notificationItems],
  );
```

- [ ] **Step 4: Remove the `ref` from the notifications body div**

Find (around line 1529):

```jsx
            <div ref={notificationsBodyRef} className="card-body card-body--notif">
```

Replace with:

```jsx
            <div className="card-body card-body--notif">
```

- [ ] **Step 5: Update `Analytics.css` to allow scroll**

Find:

```css
.an .card-body--notif {
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding-top: 6px;
  padding-bottom: 6px;
}
```

Replace `overflow: hidden` with `overflow-y: auto`:

```css
.an .card-body--notif {
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: 6px;
  padding-bottom: 6px;
}
```

- [ ] **Step 6: Also remove unused `useRef` import if `notificationsBodyRef` was the only ref**

Search `Analytics.jsx` for any remaining `useRef(` calls. If none remain, remove `useRef` from the React import line:

```js
// Before (if useRef is still needed elsewhere, keep it)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// After (only if no other useRef calls remain)
import { useCallback, useEffect, useMemo, useState } from 'react';
```

- [ ] **Step 7: Verify in the browser**

Start the dev server and navigate to the Analytics dashboard. Confirm the notifications card shows up to 10 items and scrolls when the card height is smaller than the total item height. If fewer than 10 notifications exist, no scroll bar appears.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/apps/Candidat/Dashboard/Analytics/Analytics.jsx \
        frontend/src/apps/Candidat/Dashboard/Analytics/Analytics.css
git commit -m "fix: notifications panel always shows 10 items with scroll"
```

---

## Task 4: Add Translations for Interviews Page

**Files:**
- Create: `frontend/src/assets/translations/dashboard/interviews.js`
- Modify: `frontend/src/apps/Candidat/core/translations.js`

- [ ] **Step 1: Create the translation file**

```js
// frontend/src/assets/translations/dashboard/interviews.js
export const interviewsTranslations = {
  fr: {
    'sidebar-my-interviews': 'Mes Entretiens',
    'interviews-proposals': 'Invitations',
    'interviews-upcoming': 'À venir',
    'interviews-past': 'Passés',
    'interviews-empty': 'Aucun entretien pour l\'instant — postulez pour commencer',
    'interviews-choose-slot': 'Choisir un créneau',
    'interviews-join': 'Rejoindre',
    'interviews-no-proposals': 'Aucune invitation en attente',
    'interviews-no-upcoming': 'Aucun entretien à venir',
    'interviews-no-past': 'Aucun entretien passé',
    'interviews-scheduled': 'Planifié',
    'interviews-in-progress': 'En cours',
    'interviews-completed': 'Terminé',
    'interviews-missed': 'Manqué',
    'interviews-cancelled': 'Annulé',
    'interviews-video-call': 'Appel vidéo',
    'interviews-slots-available': 'créneaux disponibles',
  },
  en: {
    'sidebar-my-interviews': 'My Interviews',
    'interviews-proposals': 'Invitations',
    'interviews-upcoming': 'Upcoming',
    'interviews-past': 'Past',
    'interviews-empty': 'No interviews yet — apply to jobs to get started',
    'interviews-choose-slot': 'Choose a slot',
    'interviews-join': 'Join',
    'interviews-no-proposals': 'No pending interview invitations',
    'interviews-no-upcoming': 'No upcoming interviews',
    'interviews-no-past': 'No past interviews',
    'interviews-scheduled': 'Scheduled',
    'interviews-in-progress': 'In Progress',
    'interviews-completed': 'Completed',
    'interviews-missed': 'Missed',
    'interviews-cancelled': 'Cancelled',
    'interviews-video-call': 'Video Call',
    'interviews-slots-available': 'slots available',
  },
};
```

- [ ] **Step 2: Register in `translations.js`**

At the top of `frontend/src/apps/Candidat/core/translations.js`, add the import after the existing dashboard imports:

```js
import { interviewsTranslations } from '../../../assets/translations/dashboard/interviews.js';
```

Then inside both the `fr:` and `en:` objects in the `translations` export, add the spread (after `...mySubmissionsTranslations.fr` and `...mySubmissionsTranslations.en`):

```js
// fr block
...interviewsTranslations.fr,

// en block
...interviewsTranslations.en,
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/assets/translations/dashboard/interviews.js \
        frontend/src/apps/Candidat/core/translations.js
git commit -m "feat: add interviews page translations"
```

---

## Task 5: Create `Interviews.jsx`

**Files:**
- Create: `frontend/src/apps/Candidat/Dashboard/Interviews/Interviews.jsx`

- [ ] **Step 1: Create the file with the full component**

```jsx
// frontend/src/apps/Candidat/Dashboard/Interviews/Interviews.jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/Candidat/Dashboard/Interviews/Interviews.jsx
git commit -m "feat: add Interviews page component with mini-calendar"
```

---

## Task 6: Create `Interviews.css`

**Files:**
- Create: `frontend/src/apps/Candidat/Dashboard/Interviews/Interviews.css`

- [ ] **Step 1: Create the stylesheet**

```css
/* frontend/src/apps/Candidat/Dashboard/Interviews/Interviews.css */

/* ── Page layout ── */
.iv-page {
  height: 100%;
  overflow-y: auto;
  padding: 28px 32px;
}

.iv-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  max-width: 1100px;
}

.iv-list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.iv-sidebar {
  width: 260px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
}

/* ── Section ── */
.iv-section__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--text);
  margin: 0 0 12px;
}

.iv-section__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  background: var(--bg3, var(--border));
  color: var(--text-muted, var(--text));
}

.iv-section__count--amber {
  background: var(--amber-bg);
  color: var(--amber);
}

.iv-section__count--indigo {
  background: var(--indigo-bg);
  color: var(--indigo);
}

.iv-section__empty {
  font-size: 13px;
  color: var(--text-muted, var(--text));
  opacity: 0.6;
  padding: 12px 0;
  margin: 0;
}

/* ── Cards ── */
.iv-card {
  display: flex;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 10px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.iv-card:hover {
  border-color: var(--border2, var(--border));
}

.iv-card__accent {
  width: 4px;
  flex-shrink: 0;
  background: var(--border);
}

.iv-card__accent--amber  { background: var(--amber); }
.iv-card__accent--indigo { background: var(--indigo); }
.iv-card__accent--gray   { background: var(--border); }

.iv-card__body {
  flex: 1;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.iv-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.iv-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 3px;
}

.iv-card__sub {
  font-size: 12px;
  color: var(--text-muted, var(--text));
  opacity: 0.7;
}

.iv-card__message {
  font-size: 13px;
  color: var(--text);
  opacity: 0.8;
  margin: 0;
  font-style: italic;
}

/* ── Slot chips ── */
.iv-card__slots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.iv-slot-chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--amber-bg);
  color: var(--amber);
  font-weight: 500;
}

.iv-slot-chip--more {
  background: var(--border);
  color: var(--text);
  opacity: 0.7;
}

/* ── CTA buttons ── */
.iv-card__cta {
  align-self: flex-start;
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  font: inherit;
  transition: opacity 0.15s;
}

.iv-card__cta:hover { opacity: 0.85; }

.iv-card__cta--amber {
  background: var(--amber-bg);
  color: var(--amber);
}

.iv-card__cta--indigo {
  background: var(--indigo);
  color: #fff;
}

/* ── Badges ── */
.iv-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

.iv-badge--amber  { background: var(--amber-bg);  color: var(--amber);  }
.iv-badge--indigo { background: var(--indigo-bg); color: var(--indigo); }
.iv-badge--green  { background: var(--green-bg);  color: var(--green);  }
.iv-badge--red    { background: var(--red-bg, #fee2e2); color: var(--red, #dc2626); }
.iv-badge--gray   { background: var(--border); color: var(--text); opacity: 0.75; }

/* ── Mini-Calendar ── */
.iv-cal {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  user-select: none;
}

.iv-cal--loading {
  height: 220px;
  opacity: 0.4;
}

.iv-cal__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.iv-cal__month {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  text-transform: capitalize;
}

.iv-cal__arrow {
  background: none;
  border: none;
  color: var(--text);
  font-size: 18px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.iv-cal__arrow:hover { opacity: 1; }

.iv-cal__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.iv-cal__dow {
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  color: var(--text);
  opacity: 0.45;
  padding: 2px 0 6px;
}

.iv-cal__pad { /* empty grid cells */ }

.iv-cal__day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: 6px;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--text);
  cursor: default;
  padding: 0;
  gap: 1px;
}

.iv-cal__day.is-event {
  cursor: pointer;
  font-weight: 600;
}

.iv-cal__day.is-event:hover {
  background: var(--border);
}

.iv-cal__day.is-today > span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--indigo);
  color: #fff;
}

.iv-cal__dot {
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

.iv-cal__dot--amber  { background: var(--amber);  }
.iv-cal__dot--indigo { background: var(--indigo); }

/* ── Empty state ── */
.iv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 24px;
  color: var(--text);
  opacity: 0.6;
  text-align: center;
}

.iv-empty p {
  margin: 0;
  font-size: 14px;
}

.iv-empty__cta {
  opacity: 1;
  padding: 8px 20px;
  background: var(--indigo);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font: inherit;
}

/* ── Error ── */
.iv-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 24px;
  color: var(--text);
  text-align: center;
}

.iv-error button {
  padding: 7px 16px;
  background: var(--indigo);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
}

/* ── Skeleton ── */
.iv-skeleton-card {
  height: 100px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 10px;
  animation: iv-pulse 1.4s ease infinite;
}

@keyframes iv-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .iv-page {
    padding: 20px 16px;
  }

  .iv-layout {
    flex-direction: column-reverse;
  }

  .iv-sidebar {
    width: 100%;
    position: static;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/Candidat/Dashboard/Interviews/Interviews.css
git commit -m "feat: add Interviews page styles"
```

---

## Task 7: Wire Route and Sidebar

**Files:**
- Modify: `frontend/src/core/routesCandidat.jsx`
- Modify: `frontend/src/apps/Candidat/Dashboard/components/Sidebar/Sidebar.jsx`

- [ ] **Step 1: Add lazy import to `routesCandidat.jsx`**

After the existing `const Notifications = lazy(...)` line, add:

```js
const Interviews = lazy(() => import('../apps/Candidat/Dashboard/Interviews/Interviews.jsx'))
```

- [ ] **Step 2: Add the child route to `routesCandidat.jsx`**

Inside the `children` array of the `/candidat/dashboard` route, after `{ path: 'my-submissions', element: <MySubmissions /> }`, add:

```js
{ path: 'interviews', element: <Interviews /> },
```

The children array should then look like:

```js
children: [
  { index: true, element: <Analytics /> },
  { path: 'find-jobs', element: <FindJobs /> },
  { path: 'find-jobs/:jobId', element: <JobDetail /> },
  { path: 'my-submissions', element: <MySubmissions /> },
  { path: 'interviews', element: <Interviews /> },
  { path: 'applications/:applicationId', element: <ApplicationDetail /> },
  { path: 'notifications', element: <Notifications /> },
  { path: 'profile', element: <Profile /> },
  { path: 'settings', element: <Settings /> },
],
```

- [ ] **Step 3: Add the sidebar nav item to `Sidebar.jsx`**

Inside the `navItems` array, after the `sidebar-my-submissions` entry and before the `sidebar-notifications` entry, add:

```js
    {
      key: 'sidebar-my-interviews',
      icon: 'videocam',
      path: '/candidat/dashboard/interviews',
    },
```

The array should look like:

```js
  const navItems = [
    { key: 'sidebar-dashboard',      icon: 'grid_view',   path: '/candidat/dashboard' },
    { key: 'sidebar-find-jobs',      icon: 'work',        path: '/candidat/dashboard/find-jobs' },
    { key: 'sidebar-my-submissions', icon: 'assignment',  path: '/candidat/dashboard/my-submissions' },
    { key: 'sidebar-my-interviews',  icon: 'videocam',    path: '/candidat/dashboard/interviews' },
    { key: 'sidebar-notifications',  icon: 'notifications', path: '/candidat/dashboard/notifications', badge: unreadCount },
    { key: 'sidebar-settings',       icon: 'settings',    path: '/candidat/dashboard/settings' },
  ];
```

- [ ] **Step 4: Verify in the browser**

Start the dev server:
```bash
cd frontend && npm run dev
```

1. Log in as a candidate.
2. Confirm "My Interviews" appears in the sidebar between "My Submissions" and "Notifications" with a video camera icon.
3. Click it — the page should load at `/candidat/dashboard/interviews`.
4. With no interviews: confirm the empty state renders with a "Find Jobs" CTA.
5. With interviews present: confirm sections (Invitations, Upcoming, Past) render correctly.
6. Click a highlighted calendar day — confirm the list scrolls to a card with that date.
7. Navigate to the Analytics page — confirm the notifications panel shows up to 10 items and scrolls correctly.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/core/routesCandidat.jsx \
        frontend/src/apps/Candidat/Dashboard/components/Sidebar/Sidebar.jsx
git commit -m "feat: wire My Interviews page to sidebar and routing"
```
