# Design Spec: My Interviews Page + Notifications Scroll Fix

**Date:** 2026-05-06  
**Branch:** sprint1-partie-hr2  
**Status:** Approved

---

## 1. Overview

Two features:

1. **Notifications panel scroll fix** — Always show 10 notifications in the dashboard Analytics card with scroll if content overflows.
2. **My Interviews page** — New dashboard page listing all candidate interviews (proposals, upcoming, past) with a side mini-calendar. Added to sidebar as "My Interviews" with a video icon.

---

## 2. Feature 1: Notifications Panel Fix

### What changes

**`Analytics.jsx`**
- Remove `visibleNotificationCount` state and its `ResizeObserver` `useEffect` entirely.
- Replace `notificationItems.slice(0, visibleNotificationCount)` with `notificationItems.slice(0, 10)`.
- No change to the `useNotifications` hook or API calls.

**`Analytics.css`**
- Change `.an .card-body--notif` from `overflow: hidden` to `overflow-y: auto` so 10 items scroll vertically when they exceed the card height.
- Keep all other styles (padding, gap, flex) unchanged.

### Result
The dashboard notifications card always renders up to 10 items. If the card height is too short to show all 10, the user can scroll within the card. If fewer than 10 notifications exist, all are shown with no scroll.

---

## 3. Feature 2: My Interviews Page

### 3.1 Route & File Structure

```
frontend/src/apps/Candidat/Dashboard/Interviews/
  Interviews.jsx        ← page component
  Interviews.css        ← page styles

frontend/src/core/routesCandidat.jsx
  → add lazy import for Interviews
  → add route: /candidat/dashboard/interviews

frontend/src/apps/Candidat/Dashboard/components/Sidebar/Sidebar.jsx
  → add nav item "My Interviews" between "My Submissions" and "Notifications"
```

### 3.2 Sidebar Item

```js
{
  key: 'my_interviews',        // translation key
  icon: 'videocam',            // Material Symbols icon
  path: '/candidat/dashboard/interviews',
  badge: pendingProposalCount, // optional: highlight when proposals pending
}
```

Translation keys to add: `my_interviews` → "My Interviews" (EN) / "Mes Entretiens" (FR).

### 3.3 Data Fetching

**Interviews list:** `GET /api/interviews/candidate`  
Returns all interviews for the authenticated candidate with fields: `_id`, `application_id`, `company_id`, `type`, `start_time`, `end_time`, `status`, `created_at`.

**Proposals:** There is no "all proposals for candidate" endpoint. Proposals are fetched per application. Two options — go with **Option A**:

- **Option A (recommended):** Add `GET /api/interviews/proposals/candidate` backend route that returns all pending proposals for the authenticated candidate. Each proposal has: `_id`, `application_id`, `slots[]`, `duration_minutes`, `message`, `status`, `created_at`.
- **Option B (fallback):** Derive proposals from the applications list — filter applications with status `pending_candidate` and fetch their proposal per application. More API calls, acceptable only if backend endpoint can't be added.

**Company/job enrichment:** The interview object has `company_id` and `application_id` but not company name or job title. The page will attempt to enrich from already-loaded data (e.g., existing applications in state) or make a single batch call. If unavailable, display `type` (e.g., "Video call") as the subtitle fallback.

### 3.4 Page Layout

```
┌─────────────────────────────────────┬──────────────────┐
│  Section tabs / counts              │  Mini-calendar   │
│  ─────────────────────────────────  │  (sticky)        │
│  [Proposals] [Upcoming] [Past]      │  May 2026        │
│                                     │  ◀ M T W T F S ▶│
│  Interview cards (scrollable list)  │  . . . . 1 2 3  │
│                                     │  4 5 6 • 8 9 10 │
│                                     │  (• = has event) │
│                                     │                  │
└─────────────────────────────────────┴──────────────────┘
```

Left column takes `1fr`, right mini-calendar is fixed `280px` wide and sticks to top on scroll.

### 3.5 Interview Card (per section)

**Proposal card:**
- Title: job title (if available) or "Interview Proposal"
- Subtitle: company name or interview type
- Details: "Choose a slot before [expiry or none]"
- Proposed slots preview: first 2-3 slots shown
- CTA button: "Choose a slot" → navigates to `/candidat/interviews/select/:applicationId`
- Accent: amber (pending action required)

**Upcoming card:**
- Title: job title or interview type
- Subtitle: company name
- Details: formatted date + time + duration
- Status badge: "Scheduled" / "In Progress"
- CTA: "Join" button (enabled only when `isJoinableInterview()` returns true) → navigates to `/candidat/interviews/room/:interviewId`
- Accent: indigo

**Past card:**
- Title: job title or interview type
- Subtitle: company name
- Details: date, status badge (Completed / Missed / Cancelled)
- No CTA button
- Accent: grey / muted

### 3.6 Mini-Calendar

- Custom-built (no external library) — a simple month grid.
- Days with interviews are highlighted with a dot indicator.
- Days with pending proposals get an amber dot.
- Clicking a day with events scrolls the list to that date's section (using element refs or `scrollIntoView`).
- Clicking a day with no events does nothing.
- Prev/Next month navigation arrows.
- "Today" always visible with a subtle ring.
- Calendar starts on the current month. Prev/next navigation is always enabled; months with no interviews simply show no dots.

### 3.7 Sections

**Proposals** — `status === 'pending'` proposals. If none: show empty state ("No pending interview invitations").

**Upcoming** — interviews where `status` is `scheduled` or `in_progress`, and `start_time` is in the future (or started but not ended). Sorted ascending by `start_time`.

**Past** — interviews where `status` is `completed`, `no_show`, `missed`, or `cancelled`, OR `end_time` is in the past. Sorted descending by `start_time`.

### 3.8 Empty State

If all three sections are empty, show a centered empty state with an icon and copy: "No interviews yet — apply to jobs to get started" with a link to `/candidat/dashboard/find-jobs`.

### 3.9 Loading & Error States

- Show skeleton cards (consistent with existing `Skeleton` components in `Dashboard/components/Skeleton/`) during fetch.
- On error, show an inline error message with a retry button.

---

## 4. Backend Change Required

Add route to `backend/routers/interviews.py`:

```
GET /api/interviews/proposals/candidate
```

- Auth: required, role `candidat`
- Returns: all proposals where `candidate_email` matches the authenticated user's email and `status === 'pending'`
- Response: array of proposal objects (same shape as existing proposal endpoints)

---

## 5. Translation Keys

Add to `frontend/src/apps/Candidat/core/translations.js`:

| Key | EN | FR |
|-----|----|----|
| `my_interviews` | My Interviews | Mes Entretiens |
| `interviews_proposals` | Interview Invitations | Invitations à un entretien |
| `interviews_upcoming` | Upcoming | À venir |
| `interviews_past` | Past | Passés |
| `interviews_empty` | No interviews yet — apply to jobs to get started | Aucun entretien pour l'instant — postulez pour commencer |
| `interviews_choose_slot` | Choose a slot | Choisir un créneau |
| `interviews_join` | Join | Rejoindre |
| `interviews_proposal_slots` | Available slots | Créneaux disponibles |
| `interviews_no_proposals` | No pending interview invitations | Aucune invitation en attente |
| `interviews_no_upcoming` | No upcoming interviews | Aucun entretien à venir |
| `interviews_no_past` | No past interviews | Aucun entretien passé |

---

## 6. What Is NOT in Scope

- AI analysis results display on past interview cards (future feature)
- Rescheduling interviews from this page
- Cancelling interviews from this page
- Google Calendar sync UI
- Any changes to the InterviewRoom or InterviewSelection components

---

## 7. Shared Utility

`isJoinableInterview` and `parseDate` are currently defined in `Analytics.jsx`. They must be extracted to a shared utility (e.g., `frontend/src/apps/Candidat/core/interviewUtils.js`) so both `Analytics.jsx` and the new `Interviews.jsx` can import them without duplication.
