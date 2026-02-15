# Career Performance Analytics Dashboard Implementation Plan

## Overview

This document provides a **detailed implementation plan** to convert the Career Performance Analytics design (HTML/Tailwind mockup) into a fully functional React dashboard page, integrated into the existing Candidat app structure.

---

## Design Reference

The design (`stitch (1)/career_performance_analytics/screen.png`) includes:
- **Dark sidebar** with user profile, navigation, and subscription info
- **KPI Cards** - Total Applications, Response Rate, Interview Rate, Gamified Streak
- **Application Funnel** - Visual pipeline from Applied → Offer
- **Profile Views Chart** - Area chart with gradient
- **Goal Tracking** - Circular progress with milestones
- **Skills Gap Analysis** - Comparison bars

---

## Architecture Decision

After analyzing your codebase, I recommend **Option B: Dashboard as a Layout Component with Nested Pages**.

### Why This Approach?

| Aspect | Option A (Single Folder) | **Option B (Layout + Pages)** ✅ |
|--------|--------------------------|-----------------------------------|
| Scalability | Limited | Highly scalable |
| Code Reuse | Sidebar duplicated | Sidebar as shared component |
| Routing | Complex nested routes | Clean nested routes |
| Maintenance | Harder to maintain | Modular and clean |

This approach uses the **Dashboard folder** as a layout with the reusable sidebar, while individual pages (Analytics, Applications, Resume Builder, etc.) live in their own folders and are rendered within the dashboard layout.

---

## Technology Stack & Libraries

### Existing (Already Installed)
- **React** `^19.2.0` - UI library
- **react-router-dom** `^7.13.0` - Routing with nested layouts
- **Tailwind CSS** `^4.1.18` - Styling framework
- **@tailwindcss/forms** `^0.5.11` - Form styling
- **@tailwindcss/container-queries** `^0.1.1` - Container queries

### New Libraries to Install

```bash
npm install recharts framer-motion @headlessui/react react-countup
```

| Library | Purpose | Version |
|---------|---------|---------|
| **recharts** | Charts (Line, Area, Progress charts) | `^2.x` |
| **framer-motion** | Animations & transitions | `^11.x` |
| **@headlessui/react** | Accessible UI components (dropdowns, modals) | `^2.x` |
| **react-countup** | Animated number counting for KPIs | `^6.x` |

### Already Available via CDN/CSS (No npm needed)
- **Material Symbols Outlined** - Icons (via Google Fonts CSS)
- **Inter Font** - Typography (via Google Fonts)

---

## Proposed Folder Structure

```
frontend/src/
├── apps/Candidat/
│   ├── Dashboard/                        # [NEW] Main Dashboard Layout
│   │   ├── Dashboard.jsx                 # Layout component with sidebar
│   │   ├── Dashboard.css                 # Dashboard layout styles
│   │   └── components/
│   │       ├── Sidebar/
│   │       │   ├── Sidebar.jsx           # Reusable sidebar component
│   │       │   └── Sidebar.css
│   │       ├── MobileHeader/
│   │       │   ├── MobileHeader.jsx      # Mobile header with menu toggle
│   │       │   └── MobileHeader.css
│   │       └── UserProfileCard/
│   │           ├── UserProfileCard.jsx   # User profile in sidebar
│   │           └── UserProfileCard.css
│   │
│   ├── Analytics/                        # [NEW] Career Performance Analytics Page
│   │   ├── Analytics.jsx                 # Main analytics page
│   │   ├── Analytics.css
│   │   └── components/
│   │       ├── KPICard/
│   │       │   ├── KPICard.jsx           # Reusable KPI stat card
│   │       │   └── KPICard.css
│   │       ├── StreakCard/
│   │       │   └── StreakCard.jsx        # Gamified streak card
│   │       ├── ApplicationFunnel/
│   │       │   ├── ApplicationFunnel.jsx # Funnel visualization
│   │       │   └── ApplicationFunnel.css
│   │       ├── ProfileViewsChart/
│   │       │   └── ProfileViewsChart.jsx # Area chart for profile views
│   │       ├── GoalTracking/
│   │       │   ├── GoalTracking.jsx      # Circular progress + milestones
│   │       │   └── GoalTracking.css
│   │       └── SkillsGapAnalysis/
│   │           ├── SkillsGapAnalysis.jsx # Skills comparison bars
│   │           └── SkillsGapAnalysis.css
│   │
│   ├── Applications/                     # [FUTURE] Application tracking page
│   ├── ResumeBuilder/                    # [FUTURE] Resume builder page
│   ├── MarketTrends/                     # [FUTURE] Market trends page
│   └── Settings/                         # [FUTURE] Settings page
│
├── assets/translations/
│   ├── dashboard/                        # [NEW] Dashboard translations
│   │   ├── sidebar.js                    # Sidebar navigation labels
│   │   └── analytics.js                  # Analytics page translations
│   └── ...
│
└── core/
    ├── translations.js                   # [MODIFY] Add new translation imports
    └── routesCandidat.jsx                # [MODIFY] Add dashboard routes
```

---

## Proposed Changes

### Core Infrastructure

---

### [MODIFY] routesCandidat.jsx

Add dashboard routes with nested layout:

```jsx
import Dashboard from '../apps/Candidat/Dashboard/Dashboard.jsx'
import Analytics from '../apps/Candidat/Analytics/Analytics.jsx'

export const routesCandidature = [
  // ... existing routes
  {
    path: '/candidat/dashboard',
    element: <Dashboard />,
    children: [
      { index: true, element: <Analytics /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'applications', element: <ComingSoon page="Applications" /> },
      { path: 'resume-builder', element: <ComingSoon page="Resume Builder" /> },
      { path: 'market-trends', element: <ComingSoon page="Market Trends" /> },
      { path: 'settings', element: <ComingSoon page="Settings" /> },
    ]
  },
]
```

---

### [MODIFY] translations.js

Import new dashboard translations:

```javascript
import { sidebarTranslations } from '../../../assets/translations/dashboard/sidebar.js';
import { analyticsTranslations } from '../../../assets/translations/dashboard/analytics.js';

export const translations = {
  fr: {
    // ... existing
    ...sidebarTranslations.fr,
    ...analyticsTranslations.fr,
  },
  en: {
    // ... existing
    ...sidebarTranslations.en,
    ...analyticsTranslations.en,
  },
};
```

---

## New Translation Files

---

### [NEW] assets/translations/dashboard/sidebar.js

```javascript
export const sidebarTranslations = {
  fr: {
    'sidebar-dashboard': 'Tableau de bord',
    'sidebar-applications': 'Candidatures',
    'sidebar-resume-builder': 'CV Builder',
    'sidebar-market-trends': 'Tendances du marché',
    'sidebar-settings': 'Paramètres',
    'sidebar-pro-plan': 'Plan Pro',
    'sidebar-active': 'ACTIF',
    'sidebar-subscription-renews': 'Votre abonnement se renouvelle dans',
    'sidebar-days': 'jours',
    'sidebar-manage-plan': 'Gérer le plan',
  },
  en: {
    'sidebar-dashboard': 'Dashboard',
    'sidebar-applications': 'Applications',
    'sidebar-resume-builder': 'Resume Builder',
    'sidebar-market-trends': 'Market Trends',
    'sidebar-settings': 'Settings',
    'sidebar-pro-plan': 'Pro Plan',
    'sidebar-active': 'ACTIVE',
    'sidebar-subscription-renews': 'Your subscription renews in',
    'sidebar-days': 'days',
    'sidebar-manage-plan': 'Manage Plan',
  },
};
```

---

### [NEW] assets/translations/dashboard/analytics.js

```javascript
export const analyticsTranslations = {
  fr: {
    'analytics-title': 'Vue d\'ensemble analytique',
    'analytics-status': 'Statut',
    'analytics-open-to-work': 'Ouvert aux opportunités',
    'analytics-last-30-days': '30 derniers jours',
    'analytics-log-application': 'Ajouter candidature',
    'analytics-total-applications': 'Candidatures totales',
    'analytics-response-rate': 'Taux de réponse',
    'analytics-interview-rate': 'Taux d\'entretien',
    'analytics-current-streak': 'Série actuelle',
    'analytics-weeks': 'Semaines',
    'analytics-keep-it-up': 'Continuez comme ça !',
    'analytics-application-funnel': 'Entonnoir de candidature',
    'analytics-funnel-subtitle': 'Conversion de la soumission à l\'offre',
    'analytics-view-details': 'Voir détails',
    'analytics-applied': 'Soumises',
    'analytics-screening': 'Présélection',
    'analytics-interview': 'Entretien',
    'analytics-offer': 'Offre',
    'analytics-profile-views': 'Vues du profil',
    'analytics-goal-tracking': 'Suivi des objectifs',
    'analytics-weekly-target': 'Objectif hebdomadaire',
    'analytics-goal-progress': 'Vous êtes à {percent}% de votre objectif hebdomadaire !',
    'analytics-of-apps': 'sur {total} candidatures',
    'analytics-top-5': 'Top 5%',
    'analytics-fast-mover': 'Rapide',
    'analytics-upcoming-milestones': 'Prochains jalons',
    'analytics-application-master': 'Maître des candidatures',
    'analytics-skills-gap': 'Analyse des compétences',
    'analytics-skills-gap-subtitle': 'Comparaison de vos compétences vs les demandes du marché pour',
    'analytics-match': 'Correspond',
    'analytics-high-gap': 'Écart élevé',
    'analytics-you': 'Vous',
    'analytics-market-avg': 'Moyenne du marché',
  },
  en: {
    'analytics-title': 'Analytics Overview',
    'analytics-status': 'Status',
    'analytics-open-to-work': 'Open to Work',
    'analytics-last-30-days': 'Last 30 Days',
    'analytics-log-application': 'Log Application',
    'analytics-total-applications': 'Total Applications',
    'analytics-response-rate': 'Response Rate',
    'analytics-interview-rate': 'Interview Rate',
    'analytics-current-streak': 'Current Streak',
    'analytics-weeks': 'Weeks',
    'analytics-keep-it-up': 'Keep it up!',
    'analytics-application-funnel': 'Application Funnel',
    'analytics-funnel-subtitle': 'Conversion from submission to offer',
    'analytics-view-details': 'View Details',
    'analytics-applied': 'Applied',
    'analytics-screening': 'Screening',
    'analytics-interview': 'Interview',
    'analytics-offer': 'Offer',
    'analytics-profile-views': 'Profile Views',
    'analytics-goal-tracking': 'Goal Tracking',
    'analytics-weekly-target': 'Weekly Target',
    'analytics-goal-progress': 'You\'re {percent}% of the way to your weekly goal!',
    'analytics-of-apps': 'of {total} Apps',
    'analytics-top-5': 'Top 5%',
    'analytics-fast-mover': 'Fast Mover',
    'analytics-upcoming-milestones': 'Upcoming Milestones',
    'analytics-application-master': 'Application Master',
    'analytics-skills-gap': 'Skills Gap Analysis',
    'analytics-skills-gap-subtitle': 'Comparison of your profile skills vs. current market demand for',
    'analytics-match': 'Match',
    'analytics-high-gap': 'High Gap',
    'analytics-you': 'You',
    'analytics-market-avg': 'Market Avg',
  },
};
```

---

## Dashboard Layout Components

---

### [NEW] Dashboard/Dashboard.jsx

Main layout component that renders the sidebar and an `<Outlet />` for nested pages.

**Key Features:**
- Responsive sidebar (hidden on mobile, visible on lg+)
- Mobile hamburger menu with slide-out drawer
- Active route highlighting
- Theme-aware (dark/light mode via existing ThemeToggle)
- Internationalized navigation labels

```jsx
import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import Sidebar from './components/Sidebar/Sidebar';
import MobileHeader from './components/MobileHeader/MobileHeader';
import './Dashboard.css';

const Dashboard = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden lg:flex" />
      
      {/* Mobile Header */}
      <MobileHeader onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      {/* Mobile Sidebar Drawer */}
      {isMobileMenuOpen && (
        <div className="mobile-sidebar-overlay">
          <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
        </div>
      )}
      
      {/* Main Content */}
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
};

export default Dashboard;
```

---

### [NEW] Dashboard/components/Sidebar/Sidebar.jsx

**Key Features:**
- User profile summary with avatar and online status
- Navigation links with Material Symbols icons
- Active state with primary color highlight
- Pro Plan subscription card
- Smooth hover transitions

---

## Analytics Page Components

---

### [NEW] Analytics/Analytics.jsx

The main analytics page matching the design:

**Sections:**
1. **Header** - Title, status badge, date filter, add application button
2. **KPI Cards Grid** - 4 cards (Total Applications, Response Rate, Interview Rate, Streak)
3. **Charts Row** - Application Funnel (2/3) + Profile Views chart (1/3)
4. **Secondary Row** - Goal Tracking + Skills Gap Analysis

---

### [NEW] Analytics/components/KPICard/KPICard.jsx

Reusable stat card component:

```jsx
const KPICard = ({ icon, iconBg, title, value, suffix, trend }) => {
  return (
    <div className="kpi-card">
      <div className="kpi-card-header">
        <div className={`kpi-icon ${iconBg}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        {trend && (
          <span className={`kpi-trend ${trend.direction}`}>
            <span className="material-symbols-outlined">
              {trend.direction === 'up' ? 'trending_up' : 'trending_down'}
            </span>
            {trend.value}
          </span>
        )}
      </div>
      <div className="kpi-card-body">
        <p className="kpi-title">{title}</p>
        <h3 className="kpi-value">
          {value}
          {suffix && <span className="kpi-suffix">{suffix}</span>}
        </h3>
      </div>
    </div>
  );
};
```

---

### [NEW] Analytics/components/ApplicationFunnel/ApplicationFunnel.jsx

Visual funnel with:
- 4 steps: Applied → Screening → Interview → Offer
- Connecting line animation
- Percentage conversion badges
- Material icons per stage

---

### [NEW] Analytics/components/ProfileViewsChart/ProfileViewsChart.jsx

Uses **Recharts** for the area chart:

```jsx
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const ProfileViewsChart = ({ data, title, value, trend }) => {
  return (
    <div className="profile-views-chart">
      <div className="chart-header">
        <div>
          <h3>{title}</h3>
          <div className="chart-value">
            <h4>{value}</h4>
            <span className="trend">{trend}</span>
          </div>
        </div>
        <div className="chart-icon">
          <span className="material-symbols-outlined">visibility</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="viewGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#895af6" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#895af6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="week" axisLine={false} tickLine={false} />
          <Tooltip />
          <Area 
            type="monotone" 
            dataKey="views" 
            stroke="#895af6" 
            strokeWidth={3}
            fill="url(#viewGradient)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
```

---

### [NEW] Analytics/components/GoalTracking/GoalTracking.jsx

Features:
- Circular progress ring (SVG-based)
- Animated counter with `react-countup`
- Achievement badges (Top 5%, Fast Mover)
- Milestone progress bar

---

### [NEW] Analytics/components/SkillsGapAnalysis/SkillsGapAnalysis.jsx

Features:
- Comparison bars with dual progress overlays
- Match/High Gap indicators
- Legend with colored dots

---

## Tailwind CSS Configuration

Add custom CSS variables for the dashboard theme:

```css
/* Add to frontend/src/core/index.css */
@theme {
  --color-primary: #895af6;
  --color-secondary: #ec4899;
  --color-background-light: #f6f5f8;
  --color-background-dark: #151022;
  --color-surface-light: #ffffff;
  --color-surface-dark: #1e1e24;
  --color-sidebar-dark: #131118;
  
  --shadow-soft: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
  --shadow-glow: 0 4px 20px -2px rgba(137, 90, 246, 0.25);
}
```

---

## Google Fonts Integration

Add to `frontend/index.html` if not present:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
```

---

## Verification Plan

### Manual Verification Steps

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install recharts framer-motion @headlessui/react react-countup
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Navigate to dashboard:**
   - Open `http://localhost:5173/candidat/dashboard`
   - Verify the Analytics page loads with sidebar

4. **Check responsive behavior:**
   - Resize browser to mobile width (< 1024px)
   - Verify sidebar hides and mobile header appears
   - Test hamburger menu opens sidebar drawer

5. **Verify theme toggle:**
   - Click theme toggle in sidebar
   - Confirm dark mode applies to entire dashboard

6. **Verify language toggle:**
   - Switch between FR and EN
   - Confirm all labels update correctly

7. **Check sidebar navigation:**
   - Click each nav item
   - Confirm URL changes and active state updates

8. **Verify charts render:**
   - Profile Views chart should display area graph
   - Application Funnel should show all 4 stages

---

## Implementation Order

1. **Phase 1: Infrastructure** (~30 min)
   - Install npm packages
   - Add Google Fonts to index.html
   - Create translation files
   - Update translations.js

2. **Phase 2: Dashboard Layout** (~1 hour)
   - Create Dashboard folder structure
   - Build Sidebar component
   - Build MobileHeader component
   - Create Dashboard layout with Outlet

3. **Phase 3: Analytics Page** (~2 hours)
   - Create Analytics folder structure
   - Build KPICard component
   - Build StreakCard component
   - Build ApplicationFunnel component
   - Build ProfileViewsChart with Recharts
   - Build GoalTracking component
   - Build SkillsGapAnalysis component
   - Assemble Analytics.jsx

4. **Phase 4: Routing & Integration** (~30 min)
   - Update routesCandidat.jsx
   - Test navigation
   - Verify all pages render

5. **Phase 5: Polish** (~30 min)
   - Add animations with framer-motion
   - Fine-tune responsive breakpoints
   - Test dark/light mode thoroughly

---

## Questions for Review

Please confirm the following before I proceed with implementation:

1. **Architecture choice** - Do you prefer Option B (Dashboard as layout with nested pages)?

2. **Library choices** - Are you okay with recharts, framer-motion, @headlessui/react, react-countup?

3. **Translation approach** - Should I continue the existing pattern with separate JS files, or would you prefer a different format (JSON, etc.)?

4. **Future pages** - Should I stub out the other pages (Applications, Resume Builder, etc.) with a "Coming Soon" placeholder?

---

## Summary

This implementation plan converts the Career Performance Analytics design into a modular, scalable React dashboard using:

- **Layout Pattern**: Dashboard as parent layout with sidebar, child pages render via `<Outlet />`
- **Component Architecture**: Atomic components (KPICard, Chart, etc.) for reusability
- **Styling**: Tailwind CSS with custom theme variables matching the design
- **Internationalization**: Follows existing translation pattern with new dashboard-specific files
- **Libraries**: Recharts for charts, Framer Motion for animations, Headless UI for accessibility
