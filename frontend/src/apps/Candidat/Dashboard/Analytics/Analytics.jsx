import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVER_URL, apiFetch, getCandidateDashboardSummary, getCandidateProfile } from '../../../../core/api';
import { useLanguage } from '../../../../core/useLanguage';
import { useNotifications } from '../../../../core/hooks/useNotifications';
import { normalizeApplicationStatus } from '../../../../core/applicationPipeline';
import './Analytics.css';
import { parseDate, formatDate, formatTime, isJoinableInterview } from '../../core/interviewUtils';

const TRACKER_STEPS = [
  {
    key: 'submitted',
    labelKey: 'analytics-tracker-submitted',
    renderIcon: (stroke) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    key: 'review',
    labelKey: 'analytics-tracker-review',
    renderIcon: (stroke) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    key: 'test',
    labelKey: 'analytics-tracker-test',
    renderIcon: (stroke) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    key: 'interview',
    labelKey: 'analytics-tracker-interview',
    renderIcon: (stroke) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: 'offer',
    labelKey: 'analytics-tracker-offer',
    renderIcon: (stroke) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
];

const APPLICATION_PALETTES = [
  { background: 'var(--indigo-bg)', color: 'var(--indigo)' },
  { background: 'var(--green-bg)', color: 'var(--green)' },
  { background: 'var(--purple-bg)', color: 'var(--purple)' },
  { background: 'var(--amber-bg)', color: 'var(--amber)' },
];

const OFFER_PALETTES = [
  { background: 'var(--indigo-bg)', color: 'var(--indigo)' },
  { background: 'var(--purple-bg)', color: 'var(--purple)' },
  { background: 'var(--amber-bg)', color: 'var(--amber)' },
];

const SECTION_LABEL_FALLBACK = {
  info: { en: 'contact info', fr: 'coordonnées' },
  bio: { en: 'bio', fr: 'bio' },
  skills: { en: 'skills', fr: 'compétences' },
  experience: { en: 'experience', fr: 'expérience' },
  education: { en: 'education', fr: 'formation' },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getDisplayName(profile, fallback) {
  if (!profile) return fallback;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  return name || profile.name || fallback;
}

function getInitials(name) {
  const parts = `${name || ''}`.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CJ';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}

function resolveAssetUrl(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  return `${SERVER_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

function truncate(text, max) {
  const value = `${text || ''}`.trim();
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function matchPercentFromJob(job) {
  if (typeof job?.match_score === 'number') return clamp(job.match_score, 0, 100);
  const match = `${job?.match || ''}`.match(/(\d+)\s*%/);
  return match ? clamp(Number(match[1]), 0, 100) : null;
}

function getTrackerStage(application) {
  const normalized = normalizeApplicationStatus(application?.status);

  if (normalized === 'accepted') {
    return { activeStep: 4, refused: false };
  }

  if (normalized === 'interview') {
    return { activeStep: 3, refused: false };
  }

  if (normalized === 'technical_test') {
    return { activeStep: 2, refused: false };
  }

  if (normalized === 'in_review') {
    return { activeStep: 1, refused: false };
  }

  if (normalized === 'rejected') {
    if (application?.interview_id || application?.interview_start_time || application?.interview_details?.start_time) {
      return { activeStep: 3, refused: true };
    }

    if (application?.quiz_id || application?.quiz_status) {
      return { activeStep: 2, refused: true };
    }

    return { activeStep: 1, refused: true };
  }

  return { activeStep: 0, refused: false };
}

function timeAgo(iso, t) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 2) return t('time_ago_just_now');
  if (minutes < 60) return t('time_ago_minute', { m: minutes, s: minutes > 1 ? 's' : '' });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time_ago_hour', { h: hours, s: hours > 1 ? 's' : '' });
  const days = Math.floor(hours / 24);
  return days === 1 ? t('time_ago_yesterday') : t('time_ago_days', { d: days });
}

function translateMaybe(value, t) {
  if (!value) return '';
  const translated = t(value);
  return translated === value ? value : translated;
}

function useAnimatedCount(target, delay) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let timeoutId = 0;
    let startTime = 0;
    const duration = 750;

    timeoutId = window.setTimeout(() => {
      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));

        if (progress < 1) {
          frameId = window.requestAnimationFrame(step);
        }
      };

      frameId = window.requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(frameId);
    };
  }, [delay, target]);

  return value;
}

function AnimatedCount({ target, delay }) {
  const value = useAnimatedCount(target, delay);
  return value;
}

function ChevronRightIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function TimeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function NotificationIcon({ category, color }) {
  if (category === 'application') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
      </svg>
    );
  }

  if (category === 'quiz') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }

  if (category === 'alert' || category === 'system') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }

  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function StepTracker({ activeStep, refused = false, t }) {
  return (
    <div className="step-track">
      <div className="step-track-line-wrap">
        {TRACKER_STEPS.slice(0, -1).map((step, index) => (
          <div key={step.key} className="step-seg">
            <div className={`step-seg-fill ${index < activeStep ? 'done' : 'none'}`} />
          </div>
        ))}
      </div>

      {TRACKER_STEPS.map((step, index) => {
        const isDone = index < activeStep;
        const isActive = index === activeStep;
        const isRefused = refused && isActive;
        let circleClassName = 'inactive';
        let labelClassName = '';
        let icon = step.renderIcon('var(--text3)');

        if (isRefused) {
          circleClassName = 'refused';
          labelClassName = 'refused';
          icon = (
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          );
        } else if (isDone) {
          circleClassName = 'done';
          labelClassName = 'done';
          icon = (
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          );
        } else if (isActive) {
          circleClassName = 'active';
          labelClassName = 'active';
          icon = step.renderIcon('var(--indigo)');
        }

        return (
          <div key={step.key} className="step-node">
            <div className={`step-circle ${circleClassName}`}>{icon}</div>
            <div className={`step-label ${labelClassName}`}>{t(step.labelKey)}</div>
          </div>
        );
      })}
    </div>
  );
}

function HeroFigure({
  displayName,
  profileTitle,
  profileImage,
  initials,
  profileScore,
  topMatchText,
  nextInterviewTime,
  nextInterviewTitle,
  metrics,
  liveLabel,
}) {
  const [metricOne, metricTwo, metricThree] = metrics;
  // Use currentColor for text/strokes where we want light theme adaptability,
  // or define them directly with CSS variables via stroke/fill. To make it work in SVG
  // neatly without polluting JSX too much, we will map them directly.

  return (
    <svg className="hero-figure-svg" viewBox="0 0 340 220" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="hero-svg-dots">
        <circle cx="280" cy="30" r="2" />
        <circle cx="296" cy="30" r="2" />
        <circle cx="312" cy="30" r="2" />
        <circle cx="280" cy="46" r="2" />
        <circle cx="296" cy="46" r="2" />
        <circle cx="312" cy="46" r="2" />
        <circle cx="280" cy="62" r="2" />
        <circle cx="296" cy="62" r="2" />
        <circle cx="312" cy="62" r="2" />
      </g>

      <circle cx="270" cy="110" r="72" className="hero-svg-ring" strokeWidth="1" strokeDasharray="5 5" />
      <circle cx="270" cy="110" r="48" className="hero-svg-ring param2" strokeWidth="1" strokeDasharray="3 6" />

      <rect x="30" y="44" width="190" height="120" rx="12" className="hero-svg-card" strokeWidth="1" />
      <rect x="35" y="45" width="180" height="4" rx="2" fill="url(#hero-card-top)" />

      <defs>
        <linearGradient id="hero-card-top" x1="30" y1="44" x2="220" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C6FEF" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="hero-avatar-gradient" x1="44" y1="62" x2="72" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C6FEF" />
          <stop offset="1" stopColor="#c4b5fd" />
        </linearGradient>
        <clipPath id="hero-avatar-clip">
          <circle cx="58" cy="76" r="14" />
        </clipPath>
        <linearGradient id="hero-bar-1" x1="80" y1="108" x2="180" y2="113" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C6FEF" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="hero-bar-2" x1="80" y1="122" x2="180" y2="127" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4FD1C5" />
          <stop offset="1" stopColor="#81E6D9" />
        </linearGradient>
        <linearGradient id="hero-bar-3" x1="80" y1="136" x2="180" y2="141" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F6AD55" />
          <stop offset="1" stopColor="#FBD38D" />
        </linearGradient>
      </defs>

      <circle cx="58" cy="76" r="14" fill="url(#hero-avatar-gradient)" />
      {profileImage ? (
        <image
          href={profileImage}
          x="44"
          y="62"
          width="28"
          height="28"
          clipPath="url(#hero-avatar-clip)"
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <text x="58" y="80" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="sans-serif">{initials}</text>
      )}

      <text x="80" y="73" className="hero-svg-text-primary" fontSize="9" fontWeight="700" fontFamily="sans-serif">
        {truncate(displayName, 16)}
      </text>
      <text x="80" y="84" className="hero-svg-text-secondary" fontSize="7.5" fontFamily="sans-serif">
        {truncate(profileTitle, 20)}
      </text>

      <rect x="182" y="65" width="28" height="16" rx="5" className="hero-svg-pill" strokeWidth="1" />
      <text x="196" y="76" textAnchor="middle" className="hero-svg-pill-text" fontSize="9" fontWeight="700" fontFamily="sans-serif">{profileScore}</text>

      <line x1="44" y1="100" x2="206" y2="100" className="hero-svg-line" strokeWidth="1" />

      <text x="44" y="114" className="hero-svg-text-secondary" fontSize="8" fontFamily="sans-serif">{metricOne.label}</text>
      <rect x="100" y="108" width="100" height="5" rx="2.5" className="hero-svg-bar-bg" />
      <rect x="100" y="108" width={metricOne.width} height="5" rx="2.5" fill="url(#hero-bar-1)" />

      <text x="44" y="128" className="hero-svg-text-secondary" fontSize="8" fontFamily="sans-serif">{metricTwo.label}</text>
      <rect x="100" y="122" width="100" height="5" rx="2.5" className="hero-svg-bar-bg" />
      <rect x="100" y="122" width={metricTwo.width} height="5" rx="2.5" fill="url(#hero-bar-2)" />

      <text x="44" y="142" className="hero-svg-text-secondary" fontSize="8" fontFamily="sans-serif">{metricThree.label}</text>
      <rect x="100" y="136" width="100" height="5" rx="2.5" className="hero-svg-bar-bg" />
      <rect x="100" y="136" width={metricThree.width} height="5" rx="2.5" fill="url(#hero-bar-3)" />

      <rect x="218" y="20" width="86" height="30" rx="8" className="hero-svg-match-bg" strokeWidth="1" />
      <circle cx="232" cy="35" r="7" className="hero-svg-match-icon-bg" />
      <circle cx="232" cy="35" r="4" className="hero-svg-match-icon-fill" />
      <text x="243" y="39" className="hero-svg-match-text" fontSize="9" fontWeight="600" fontFamily="sans-serif">{truncate(topMatchText, 11)}</text>

      <rect x="198" y="148" width="120" height="52" rx="9" className="hero-svg-card" strokeWidth="1" />
      <rect x="210" y="161" width="8" height="28" rx="2" className="hero-svg-live-track" />
      <rect x="210" y="161" width="8" height="10" rx="2" fill="var(--indigo)" />
      <text x="226" y="170" className="hero-svg-text-primary" fontSize="8" fontWeight="600" fontFamily="sans-serif">
        {truncate(nextInterviewTime, 16)}
      </text>
      <text x="226" y="181" className="hero-svg-text-secondary" fontSize="8" fontFamily="sans-serif">
        {truncate(nextInterviewTitle, 17)}
      </text>
      <rect x="226" y="187" width="40" height="8" rx="3" fill="var(--indigo)" />
      <text x="246" y="194" textAnchor="middle" fill="var(--bg2)" fontSize="7" fontWeight="600" fontFamily="sans-serif">{liveLabel}</text>

      <line x1="14" y1="26" x2="14" y2="38" className="hero-svg-line-accent" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="32" x2="20" y2="32" className="hero-svg-line-accent" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="192" x2="8" y2="202" className="hero-svg-line-match" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="197" x2="13" y2="197" className="hero-svg-line-match" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const PROFILE_DESCRIPTIONS = {
  senior_frontend_engineer: '8 years React, design systems, accessibility',
  staff_ui_engineer: 'Strong in component architecture & DX',
  product_engineer: 'Full-stack range with TS + Postgres',
  frontend_developer: 'React, TypeScript, component design',
  fullstack_developer: 'JavaScript, Node.js, cloud deployments',
  backend_developer: 'APIs, microservices, databases',
  data_scientist: 'ML, statistics, data analysis',
  devops_engineer: 'CI/CD, containers, infrastructure',
  mobile_developer: 'iOS/Android, React Native',
  ml_engineer: 'Model training, inference, pipelines',
  ui_engineer: 'Design systems, accessibility, DX',
  software_engineer: 'Algorithms, systems, code quality',
};

const RADAR_AXES = [
  { key: 'frontend', label: 'FRONTEND' },
  { key: 'systems', label: 'SYSTEMS' },
  { key: 'design', label: 'DESIGN' },
  { key: 'infra', label: 'INFRA' },
  { key: 'data_ai', label: 'DATA/AI' },
  { key: 'lead', label: 'LEAD' },
];

function RadarChart({ yourScores, targetScores }) {
  const cx = 140;
  const cy = 125;
  const r = 78;
  const labelR = 108;
  const n = RADAR_AXES.length;

  const angleOf = (i) => (i * 2 * Math.PI) / n - Math.PI / 2;

  const ptAt = (score, i) => {
    const a = angleOf(i);
    const s = Math.max(0, Math.min(1, score)) * r;
    return [cx + s * Math.cos(a), cy + s * Math.sin(a)];
  };

  const toPath = (scores) =>
    scores.map((s, i) => {
      const [x, y] = ptAt(s, i);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ') + 'Z';

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox="0 0 280 250" className="ai-radar-svg">
      <defs>
        <linearGradient id="radar-you-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--indigo)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--indigo)" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {gridLevels.map((level) => (
        <polygon
          key={level}
          className="radar-grid-ring"
          points={RADAR_AXES.map((_, i) => { const [x, y] = ptAt(level, i); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ')}
        />
      ))}

      {RADAR_AXES.map((axis, i) => {
        const [x, y] = ptAt(1, i);
        return <line key={axis.key} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} className="radar-axis-line" />;
      })}

      <path d={toPath(targetScores)} className="radar-target-path" />
      <path d={toPath(yourScores)} className="radar-you-path" fill="url(#radar-you-grad)" />

      {RADAR_AXES.map((axis, i) => {
        const a = angleOf(i);
        const lx = cx + labelR * Math.cos(a);
        const ly = cy + labelR * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.15 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        return (
          <text key={axis.key} x={lx.toFixed(1)} y={ly.toFixed(1)} className="radar-axis-label" textAnchor={anchor} dominantBaseline="middle">
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

function Analytics() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { notifications, loading: notificationsLoading, markAsRead } = useNotifications();

  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [summary, setSummary] = useState({ applications: [], interviews: [] });
  const [savedJobIds, setSavedJobIds] = useState(() => new Set());
  const [offers, setOffers] = useState([]);
  const [aiSkills, setAiSkills] = useState(null);
  const [aiSkillsLoading, setAiSkillsLoading] = useState(false);
  const [aiSkillsUnavailable, setAiSkillsUnavailable] = useState(false);
  const [aiSkillsNoSkills, setAiSkillsNoSkills] = useState(false);
  const [aiSkillsTab, setAiSkillsTab] = useState('overview');
  const notificationsBodyRef = useRef(null);
  const [visibleNotificationCount, setVisibleNotificationCount] = useState(5);
  const [loading, setLoading] = useState({
    profile: true,
    applications: true,
    summary: true,
    saved: true,
    offers: true,
  });

  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const copy = useMemo(() => (language === 'fr' ? {
    candidateFallback: 'Candidat',
    greetingMorning: 'Bonjour',
    greetingAfternoon: 'Bon après-midi',
    greetingEvening: 'Bonsoir',
    heroFallback: 'Voici votre aperçu carrière en direct pour aujourd’hui.',
    actionsTitle: 'Actions requises',
    pendingWord: 'en attente',
    urgent: 'Urgent',
    awaiting: 'À suivre',
    required: 'Requis',
    optional: 'Conseillé',
    takeTest: 'Passer le test technique',
    chooseSlot: 'Choisir un créneau',
    prepareInterview: 'Préparer l’entretien',
    completeSection: 'Compléter',
    improveProfile: 'Améliorer le profil',
    actionsEmpty: 'Aucune action urgente pour le moment.',
    actionsEmptyHint: 'Votre pipeline est à jour.',
    notificationsTitle: 'Notifications',
    myApplicationsTitle: 'Mes candidatures',
    aiOffersTitle: 'Offres suggérées par IA pour vous',
    viewAll: 'Voir tout',
    browseAll: 'Parcourir',
    applicationButton: 'Candidature',
    interviewsButton: 'Entretiens',
    detailsButton: 'Détails',
    join: 'Rejoindre',
    save: 'Enregistrer',
    saved: 'Enregistré',
    noApplications: 'Aucune candidature pour le moment.',
    noOffers: 'Aucune recommandation disponible pour le moment.',
    noNotifications: 'Aucune notification récente.',
    noUpcomingFigure: 'Aucun entretien',
    noUpcomingRole: 'En attente',
    profileLabel: 'Profil',
    skillsLabel: 'Compétences',
    experienceLabel: 'Expérience',
    educationLabel: 'Formation',
    applicationsThisMonth: 'ce mois-ci',
    nothingBooked: 'Aucun programmé',
    nothingPending: 'Tout est à jour',
    nothingSaved: 'Aucun favori',
    bookmarked: 'favoris',
    nextLabel: 'Prochain',
    videoInterview: 'Entretien vidéo',
    applicationSubmitted: 'Soumise',
    applicationReview: 'En revue',
    applicationTest: 'Test',
    applicationInterview: 'Entretien',
    applicationOffer: 'Offre',
    applicationRefused: 'Refusée',
    completeProfile: 'Compléter le profil',
    testsNeedAttention: 'tests à compléter',
    slotsNeedAttention: 'créneaux à choisir',
  } : {
    candidateFallback: 'Candidate',
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    heroFallback: 'Here is your live career overview for today.',
    actionsTitle: 'Actions needed',
    pendingWord: 'pending',
    urgent: 'Urgent',
    awaiting: 'Awaiting',
    required: 'Required',
    optional: 'Recommended',
    takeTest: 'Take tech test',
    chooseSlot: 'Choose interview slot',
    prepareInterview: 'Prepare interview',
    completeSection: 'Complete',
    improveProfile: 'Improve profile',
    actionsEmpty: 'No urgent actions right now.',
    actionsEmptyHint: 'Your dashboard is up to date.',
    notificationsTitle: 'Notifications',
    myApplicationsTitle: 'My applications',
    aiOffersTitle: 'AI-suggested offers for you',
    viewAll: 'View all',
    browseAll: 'Browse all',
    applicationButton: 'Application',
    interviewsButton: 'Interviews',
    detailsButton: 'Details',
    join: 'Join',
    save: 'Save',
    saved: 'Saved',
    noApplications: 'No applications yet.',
    noOffers: 'No recommendations available right now.',
    noNotifications: 'No recent notifications.',
    noUpcomingFigure: 'No interview yet',
    noUpcomingRole: 'Stand by',
    profileLabel: 'Profile',
    skillsLabel: 'Skills',
    experienceLabel: 'Experience',
    educationLabel: 'Education',
    applicationsThisMonth: 'this month',
    nothingBooked: 'Nothing booked',
    nothingPending: 'All caught up',
    nothingSaved: 'Nothing saved yet',
    bookmarked: 'bookmarked',
    nextLabel: 'Next',
    videoInterview: 'Video interview',
    applicationSubmitted: 'Submitted',
    applicationReview: 'In Review',
    applicationTest: 'Tech Test',
    applicationInterview: 'Interview',
    applicationOffer: 'Offer',
    applicationRefused: 'Refused',
    completeProfile: 'Complete profile :           ',
    testsNeedAttention: 'tests to complete',
    slotsNeedAttention: 'slots to choose',
  }), [language]);

  Object.assign(copy, {
    candidateFallback: t('analytics-candidate-fallback'),
    greetingMorning: t('analytics-greeting-morning'),
    greetingAfternoon: t('analytics-greeting-afternoon'),
    greetingEvening: t('analytics-greeting-evening'),
    heroFallback: t('analytics-hero-fallback'),
    actionsTitle: t('analytics-actions-title'),
    pendingWord: t('analytics-pending-word'),
    urgent: t('analytics-urgent'),
    awaiting: t('analytics-awaiting'),
    required: t('analytics-required'),
    optional: t('analytics-optional'),
    takeTest: t('analytics-action-take-test'),
    chooseSlot: t('analytics-action-choose-slot'),
    prepareInterview: t('analytics-action-prepare-interview'),
    completeSection: t('analytics-action-complete-section'),
    improveProfile: t('analytics-action-improve-profile'),
    actionsEmpty: t('analytics-actions-empty'),
    actionsEmptyHint: t('analytics-actions-empty-hint'),
    notificationsTitle: t('analytics-notifications-title'),
    myApplicationsTitle: t('analytics-my-applications-title'),
    aiOffersTitle: t('analytics-ai-offers-title'),
    viewAll: t('analytics-view-all'),
    browseAll: t('analytics-browse-all'),
    applicationButton: t('analytics-application-button'),
    interviewsButton: t('analytics-interviews-button'),
    detailsButton: t('analytics-details-button'),
    join: t('analytics-join'),
    save: t('analytics-save'),
    saved: t('analytics-saved'),
    noApplications: t('analytics-no-applications'),
    noOffers: t('analytics-no-offers'),
    noNotifications: t('analytics-no-notifications'),
    noUpcomingFigure: t('analytics-no-upcoming-figure'),
    noUpcomingRole: t('analytics-no-upcoming-role'),
    profileLabel: t('analytics-profile-label'),
    skillsLabel: t('analytics-skills-label'),
    experienceLabel: t('analytics-experience-label'),
    educationLabel: t('analytics-education-label'),
    applicationsThisMonth: t('analytics-applications-this-month'),
    nothingBooked: t('analytics-nothing-booked'),
    nothingPending: t('analytics-nothing-pending'),
    nothingSaved: t('analytics-nothing-saved'),
    bookmarked: t('analytics-bookmarked'),
    nextLabel: t('analytics-next-label'),
    videoInterview: t('analytics-video-interview'),
    applicationSubmitted: t('analytics-application-submitted'),
    applicationReview: t('analytics-application-review'),
    applicationTest: t('analytics-application-test'),
    applicationInterview: t('analytics-application-interview'),
    applicationOffer: t('analytics-application-offer'),
    applicationRefused: t('analytics-application-refused'),
    completeProfile: t('analytics-complete-profile'),
    testsNeedAttention: t('analytics-tests-need-attention'),
    slotsNeedAttention: t('analytics-slots-need-attention'),
    profileStrengthLabel: t('analytics-profile-strength'),
    matchLabel: t('analytics-match-label'),
    remoteLabel: t('analytics-remote-label'),
    liveLabel: t('analytics-live-label'),
  });

  const loadDashboardData = useCallback(async () => {
    const results = await Promise.allSettled([
      getCandidateProfile(),
      apiFetch('/applications/my-applications'),
      getCandidateDashboardSummary(),
      apiFetch('/jobs/saved'),
      apiFetch('/candidat/jobs/?page=1&limit=3&sort=match'),
    ]);

    const [profileResult, applicationsResult, summaryResult, savedJobsResult, offersResult] = results;
    const summaryApplications = summaryResult.status === 'fulfilled' && Array.isArray(summaryResult.value?.applications)
      ? summaryResult.value.applications
      : [];

    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value || null);
    }

    if (applicationsResult.status === 'fulfilled') {
      setApplications(Array.isArray(applicationsResult.value) ? applicationsResult.value : []);
    } else if (summaryApplications.length > 0) {
      setApplications(summaryApplications);
    }

    if (summaryResult.status === 'fulfilled') {
      setSummary({
        applications: summaryApplications,
        interviews: Array.isArray(summaryResult.value?.interviews) ? summaryResult.value.interviews : [],
      });
    }

    if (savedJobsResult.status === 'fulfilled') {
      const savedIds = Array.isArray(savedJobsResult.value)
        ? savedJobsResult.value
          .map((item) => (typeof item === 'string' ? item : item?.job_id || item?._id || null))
          .filter(Boolean)
        : [];
      setSavedJobIds(new Set(savedIds));
    }

    if (offersResult.status === 'fulfilled') {
      setOffers(Array.isArray(offersResult.value?.jobs) ? offersResult.value.jobs : []);
    }

    setLoading({
      profile: false,
      applications: false,
      summary: false,
      saved: false,
      offers: false,
    });
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        await loadDashboardData();
      } catch (error) {
        console.error('Candidate dashboard load error:', error);
        if (active) {
          setLoading({
            profile: false,
            applications: false,
            summary: false,
            saved: false,
            offers: false,
          });
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [loadDashboardData]);

  useEffect(() => {
    const element = notificationsBodyRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const updateVisibleCount = () => {
      const height = element.clientHeight;
      const nextCount = Math.max(Math.floor((height + 8) / 64), 5);
      setVisibleNotificationCount(nextCount);
    };

    updateVisibleCount();

    const observer = new ResizeObserver(() => {
      updateVisibleCount();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!profile) return undefined;
    const candidateId = profile?.user_id || profile?._id || profile?.id;
    if (!candidateId) return undefined;

    let active = true;
    setAiSkillsLoading(true);

    apiFetch(`/ai-analysis/candidate/${candidateId}`)
      .then((data) => { if (active) setAiSkills(data); })
      .catch((err) => { 
        if (active) {
          if (err.status === 400) {
            setAiSkillsNoSkills(true);
          } else {
            setAiSkillsUnavailable(true);
          }
        } 
      })
      .finally(() => { if (active) setAiSkillsLoading(false); });

    return () => { active = false; };
  }, [profile]);

  const displayName = useMemo(() => getDisplayName(profile, copy.candidateFallback), [profile, copy.candidateFallback]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return copy.greetingMorning;
    if (hour < 18) return copy.greetingAfternoon;
    return copy.greetingEvening;
  }, [copy]);

  const profileScore = typeof profile?.profileStrength === 'number' ? profile.profileStrength : 0;
  const missingSections = Array.isArray(profile?.profileMissing) ? profile.profileMissing : [];
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  const experiences = Array.isArray(profile?.experiences) ? profile.experiences : Array.isArray(profile?.experience) ? profile.experience : [];
  const educations = Array.isArray(profile?.educations) ? profile.educations : Array.isArray(profile?.education) ? profile.education : [];

  const aiProfileRows = useMemo(() => (aiSkills?.profile_recommendation || []).slice(0, 3).map((item) => {
    const raw = item.profile || '';
    const pct = Math.round((item.confidence || 0) * 100);
    const displayName = raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const description = item.description || PROFILE_DESCRIPTIONS[raw] || displayName;
    return { profile: raw, displayName, description, pct };
  }), [aiSkills]);

  const aiTopPercentile = useMemo(() => {
    if (typeof aiSkills?.percentile === 'number') return Math.round(aiSkills.percentile * 100);
    return Math.round((aiSkills?.profile_recommendation?.[0]?.confidence || 0) * 100);
  }, [aiSkills]);

  const aiTopProfileName = useMemo(() => {
    const raw = aiSkills?.profile_recommendation?.[0]?.profile || '';
    return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Senior Engineer';
  }, [aiSkills]);

  const aiRadarYourScores = useMemo(() => {
    if (aiSkills?.skill_map) {
      return RADAR_AXES.map((a) => Math.min(1, Math.max(0, (aiSkills.skill_map[a.key] || 0) / 100)));
    }
    const topConf = aiSkills?.profile_recommendation?.[0]?.confidence || 0.5;
    return [topConf * 0.98, topConf * 0.75, topConf * 0.85, topConf * 0.52, topConf * 0.64, topConf * 0.68];
  }, [aiSkills]);

  const aiRadarTargetScores = useMemo(() => {
    if (aiSkills?.target_map) {
      return RADAR_AXES.map((a) => Math.min(1, Math.max(0, (aiSkills.target_map[a.key] || 0) / 100)));
    }
    return [0.88, 0.80, 0.75, 0.70, 0.72, 0.65];
  }, [aiSkills]);

  const aiStrengths = useMemo(() => (aiSkills?.skill_importance || []).slice(0, 5).map((item, i) => {
    const raw = typeof item.importance === 'number' ? item.importance : typeof item.score === 'number' ? item.score / 100 : 0;
    const score = raw > 1 ? Math.round(raw) : raw > 0 ? Math.round(raw * 100) : Math.round((0.95 - i * 0.04) * 100);
    return { skill: item.skill, score };
  }), [aiSkills]);

  const aiGaps = useMemo(() => {
    const GAP_LABELS = ['explore', 'in progress', 'trending', 'explore'];
    const GAP_VARIANTS = ['explore', 'progress', 'trending', 'explore'];
    return (aiSkills?.explore_skills || []).slice(0, 4).map((item, i) => {
      const raw = typeof item.priority === 'number' ? item.priority : 0;
      const barWidth = raw > 0 ? Math.round(raw * 100) : Math.round((0.28 + i * 0.12) * 100);
      return {
        skill: item.skill,
        label: item.status || GAP_LABELS[i % GAP_LABELS.length],
        labelVariant: GAP_VARIANTS[i % GAP_VARIANTS.length],
        barWidth,
      };
    });
  }, [aiSkills]);

  const heroMetrics = useMemo(() => ([
    {
      label: copy.skillsLabel,
      width: clamp(skills.length * 14, 0, 100),
    },
    {
      label: copy.experienceLabel,
      width: clamp(experiences.length * 28, 0, 100),
    },
    {
      label: copy.educationLabel,
      width: clamp(educations.length * 34, 0, 100),
    },
  ]), [copy, educations.length, experiences.length, skills.length]);

  const sortedApplications = useMemo(() => (
    [...applications].sort((a, b) => {
      const dateA = parseDate(a?.updated_at || a?.created_at)?.getTime() || 0;
      const dateB = parseDate(b?.updated_at || b?.created_at)?.getTime() || 0;
      return dateB - dateA;
    })
  ), [applications]);

  const applicationCount = sortedApplications.length;
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const applicationsThisMonth = useMemo(() => sortedApplications.filter((application) => {
    const createdAt = parseDate(application?.created_at);
    return createdAt && createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
  }).length, [currentMonth, currentYear, sortedApplications]);

  const pendingTests = useMemo(() => sortedApplications.filter((application) => {
    const normalized = normalizeApplicationStatus(application?.status);
    return normalized === 'technical_test' && application?.quiz_id && application?.quiz_status !== 'completed';
  }), [sortedApplications]);

  const pendingInterviewSelections = useMemo(() => sortedApplications.filter((application) => {
    const normalized = normalizeApplicationStatus(application?.status);
    return normalized === 'interview' && application?.interview_status === 'pending_candidate' && application?.interview_proposal;
  }), [sortedApplications]);

  const summaryInterviews = useMemo(() => {
    if (Array.isArray(summary?.interviews) && summary.interviews.length > 0) {
      return summary.interviews;
    }

    return sortedApplications
      .filter((application) => application?.interview_start_time || application?.interview_details?.start_time)
      .map((application) => ({
        _id: application?.interview_id || application?._id,
        application_id: application?._id,
        start_time: application?.interview_start_time || application?.interview_details?.start_time,
        end_time: application?.interview_end_time || application?.interview_details?.end_time,
        status: application?.interview_status || application?.interview_details?.status,
        type: application?.interview_details?.type,
        meeting_link: application?.interview_details?.meeting_link,
        job_title: application?.job_title,
        company_name: application?.company_name,
      }));
  }, [sortedApplications, summary?.interviews]);

  const upcomingInterviews = useMemo(() => summaryInterviews
    .filter((interview) => {
      const start = parseDate(interview?.start_time);
      if (!start) return false;

      const end = parseDate(interview?.end_time) || new Date(start.getTime() + 45 * 60_000);
      const status = `${interview?.status || ''}`.toLowerCase();
      if (['completed', 'ended', 'cancelled', 'canceled', 'missed'].includes(status)) return false;
      return end.getTime() > Date.now();
    })
    .sort((a, b) => (parseDate(a?.start_time)?.getTime() || 0) - (parseDate(b?.start_time)?.getTime() || 0)), [summaryInterviews]);

  const nextInterview = upcomingInterviews[0] || null;
  const savedCount = savedJobIds.size;
  const topOffer = offers[0] || null;
  const topOfferPercent = matchPercentFromJob(topOffer);
  const profileImage = resolveAssetUrl(
    profile?.profileImage
    || profile?.profilePicture
    || profile?.avatar_url
    || profile?.avatar
    || profile?.photo,
  );

  const heroSubtitle = useMemo(() => {
    if (nextInterview) {
      const dateText = formatDate(nextInterview.start_time, locale, { month: 'short', day: 'numeric' });
      const roleText = nextInterview.job_title ? ` ${language === 'fr' ? 'pour' : 'for'} ${nextInterview.job_title}` : '';
      return language === 'fr'
        ? `Votre prochain entretien est prévu le ${dateText}${roleText}.`
        : `Your next interview is scheduled for ${dateText}${roleText}.`;
    }

    if (applicationCount > 0) {
      return language === 'fr'
        ? `Vous avez ${applicationCount} candidatures suivies dans votre tableau de bord.`
        : `You currently have ${applicationCount} tracked applications on your dashboard.`;
    }

    return copy.heroFallback;
  }, [applicationCount, copy.heroFallback, language, locale, nextInterview]);

  const heroDate = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const heroStats = useMemo(() => ([
    {
      label: language === 'fr' ? 'Candidatures envoyées' : 'Applications sent',
      count: applicationCount,
      valueColor: 'var(--indigo)',
      subText: `${applicationsThisMonth} ${copy.applicationsThisMonth}`,
      subColor: 'oklch(65% 0.24 280 / 0.6)',
    },
    {
      label: language === 'fr' ? 'Entretiens programmés' : 'Interviews scheduled',
      count: upcomingInterviews.length,
      valueColor: 'var(--green)',
      subText: nextInterview ? `${copy.nextLabel}: ${formatDate(nextInterview.start_time, locale, { month: 'short', day: 'numeric' })}` : copy.nothingBooked,
      subColor: 'oklch(70% 0.18 145 / 0.6)',
    },
    {
      label: language === 'fr' ? 'Tests à faire' : 'Tests pending',
      count: pendingTests.length,
      valueColor: 'var(--amber)',
      subText: pendingTests[0]?.job_title || copy.nothingPending,
      subColor: 'oklch(72% 0.18 62 / 0.6)',
    },
    {
      label: language === 'fr' ? 'Offres sauvegardées' : 'Saved offers',
      count: savedCount,
      valueColor: 'var(--text)',
      subText: savedCount ? `${savedCount} ${copy.bookmarked}` : copy.nothingSaved,
      subColor: 'var(--text3)',
    },
  ]), [
    applicationCount,
    applicationsThisMonth,
    copy,
    language,
    locale,
    nextInterview,
    pendingTests,
    savedCount,
    upcomingInterviews.length,
  ]);

  const resolvedHeroSubtitle = useMemo(() => {
    if (nextInterview) {
      const dateText = formatDate(nextInterview.start_time, locale, { month: 'short', day: 'numeric' });
      const roleText = nextInterview.job_title ? ` ${t('analytics-hero-role-prefix')} ${nextInterview.job_title}` : '';
      return t('analytics-hero-next-interview', { date: dateText, role: roleText });
    }

    if (applicationCount > 0) {
      return t('analytics-hero-application-count', { count: applicationCount });
    }

    return copy.heroFallback;
  }, [applicationCount, copy.heroFallback, locale, nextInterview, t]);

  const resolvedHeroStats = useMemo(() => ([
    { ...heroStats[0], label: t('analytics-stat-applications-sent') },
    { ...heroStats[1], label: t('analytics-stat-interviews-scheduled') },
    { ...heroStats[2], label: t('analytics-stat-tests-pending') },
    { ...heroStats[3], label: t('analytics-stat-saved-offers') },
  ]), [heroStats, t]);

  const notificationItems = useMemo(() => [...notifications]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((notification) => {
      let iconBackground = 'var(--indigo-bg)';
      let iconColor = 'var(--indigo)';

      if (notification.category === 'application') {
        iconBackground = 'var(--green-bg)';
        iconColor = 'var(--green)';
      } else if (notification.category === 'quiz') {
        iconBackground = 'var(--amber-bg)';
        iconColor = 'var(--amber)';
      } else if (notification.category === 'alert' || notification.notification_type === 'error') {
        iconBackground = 'var(--red-bg)';
        iconColor = 'var(--red)';
      }

      return {
        id: notification._id,
        category: notification.category,
        unread: !notification.is_read,
        title: translateMaybe(notification.title, t),
        message: translateMaybe(notification.message, t),
        time: timeAgo(notification.created_at, t),
        iconBackground,
        iconColor,
      };
    }), [notifications, t]);

  const visibleNotificationItems = useMemo(
    () => notificationItems.slice(0, visibleNotificationCount),
    [notificationItems, visibleNotificationCount],
  );

  const actionItems = useMemo(() => {
    const items = [];

    pendingTests.slice(0, 2).forEach((application) => {
      items.push({
        id: `quiz-${application._id}`,
        text: copy.takeTest,
        detail: `${application.job_title || copy.applicationTest} - ${application.company_name || ''}`.trim(),
        badgeLabel: copy.urgent,
        badgeClassName: 'bg-urgent',
        dotStyle: { background: 'var(--red)', boxShadow: '0 0 8px var(--red-bg)' },
        onClick: () => navigate(`/candidat/quiz/${application.quiz_id}`),
      });
    });

    pendingInterviewSelections.slice(0, 2).forEach((application) => {
      if (items.length >= 4) return;
      items.push({
        id: `slot-${application._id}`,
        text: copy.chooseSlot,
        detail: `${application.job_title || copy.applicationInterview} - ${application.company_name || ''}`.trim(),
        badgeLabel: copy.required,
        badgeClassName: 'bg-required',
        dotStyle: { background: 'var(--indigo)' },
        onClick: () => navigate(`/candidat/interviews/select/${application._id}`),
      });
    });

    upcomingInterviews.forEach((interview) => {
      if (items.length >= 4) return;
      const startsAt = parseDate(interview.start_time);
      if (!startsAt) return;
      const diffHours = (startsAt.getTime() - Date.now()) / 3_600_000;
      if (diffHours < 0 || diffHours > 48 || isJoinableInterview(interview.status, interview.start_time, interview.end_time)) {
        return;
      }

      items.push({
        id: `prep-${interview._id}`,
        text: copy.prepareInterview,
        detail: `${interview.company_name || copy.applicationInterview}, ${formatDate(interview.start_time, locale, { month: 'short', day: 'numeric' })}`,
        badgeLabel: copy.awaiting,
        badgeClassName: 'bg-awaiting',
        dotStyle: { background: 'var(--amber)' },
        onClick: () => navigate(`/candidat/dashboard/applications/${interview.application_id}`),
      });
    });

    missingSections.forEach((section) => {
      if (items.length >= 4) return;
      const translationKey = `jobs-section-${section}`;
      const fallback = SECTION_LABEL_FALLBACK[section]?.[language] || section;
      const translated = t(translationKey);
      const sectionLabel = translated === translationKey ? fallback : translated;
      const isRequired = ['info', 'skills', 'experience'].includes(section);

      items.push({
        id: `profile-${section}`,
        text: `${copy.completeSection} ${sectionLabel}`,
        detail: copy.improveProfile,
        badgeLabel: isRequired ? copy.required : copy.optional,
        badgeClassName: isRequired ? 'bg-required' : 'bg-optional',
        dotStyle: { background: isRequired ? 'var(--indigo)' : 'var(--purple)' },
        onClick: () => navigate('/candidat/dashboard/profile'),
      });
    });

    return items.slice(0, 4);
  }, [
    copy,
    language,
    locale,
    missingSections,
    navigate,
    pendingInterviewSelections,
    pendingTests,
    t,
    upcomingInterviews,
  ]);

  const displayedApplications = useMemo(() => sortedApplications.slice(0, 3).map((application, index) => {
    const normalizedStatus = normalizeApplicationStatus(application?.status);
    const palette = APPLICATION_PALETTES[index % APPLICATION_PALETTES.length];
    const tracker = getTrackerStage(application);
    const badge = (() => {
      if (normalizedStatus === 'accepted') return { label: copy.applicationOffer, className: 's-offer' };
      if (normalizedStatus === 'interview') return { label: copy.applicationInterview, className: 's-interview' };
      if (normalizedStatus === 'technical_test') return { label: copy.applicationTest, className: 's-test' };
      if (normalizedStatus === 'in_review') return { label: copy.applicationReview, className: 's-pending' };
      if (normalizedStatus === 'rejected') return { label: copy.applicationRefused, className: 's-refused' };
      return { label: copy.applicationSubmitted, className: 's-pending' };
    })();

    return {
      id: application._id,
      logo: getInitials(application.company_name || application.job_title || displayName),
      logoStyle: palette,
      name: application.job_title || copy.applicationSubmitted,
      company: application.company_name || copy.candidateFallback,
      badge,
      tracker,
    };
  }), [copy, displayName, sortedApplications]);

  const displayedOffers = useMemo(() => offers.slice(0, 3).map((offer, index) => {
    const palette = OFFER_PALETTES[index % OFFER_PALETTES.length];
    const matchPercent = matchPercentFromJob(offer);
    const matchColor = matchPercent !== null && matchPercent >= 80 ? 'var(--green)' : 'var(--amber)';

    return {
      ...offer,
      id: offer._id || offer.id,
      logo: getInitials(offer.company || offer.title),
      logoStyle: palette,
      companyLine: `${offer.company || copy.candidateFallback} \u00B7 ${offer.location || offer.work_mode || copy.remoteLabel}`,
      matchPercent,
      matchColor,
      strokeOffset: matchPercent !== null ? clamp(88 - (88 * matchPercent) / 100, 0, 88) : 88,
      isSaved: savedJobIds.has(offer._id || offer.id),
    };
  }), [copy.candidateFallback, copy.remoteLabel, offers, savedJobIds]);

  const profileTitle = profile?.title || copy.profileLabel;
  const nextInterviewTime = nextInterview
    ? `${formatDate(nextInterview.start_time, locale, { month: 'short', day: 'numeric' })}, ${formatTime(nextInterview.start_time, locale)}`
    : copy.noUpcomingFigure;
  const nextInterviewTitle = nextInterview?.job_title || copy.noUpcomingRole;
  const topMatchText = topOfferPercent !== null ? `${topOfferPercent}% ${copy.matchLabel}` : `${profileScore}%`;

  const handleToggleSave = async (jobId, event) => {
    if (event) event.stopPropagation();
    try {
      const response = await apiFetch(`/jobs/saved/${jobId}`, { method: 'POST' });
      setSavedJobIds((previous) => {
        const next = new Set(previous);
        if (response?.saved) {
          next.add(jobId);
        } else {
          next.delete(jobId);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to toggle saved job:', error);
    }
  };

  if (loading.profile || loading.applications) {
    return (
      <div className="an-loader-wrap">
        <div className="an-skeleton an-sk-hero" />
        <div className="an-sk-grid">
          <div className="an-sk-card">
            <div className="an-skeleton an-sk-title" />
            <div className="an-skeleton an-sk-item" />
            <div className="an-skeleton an-sk-item" />
            <div className="an-skeleton an-sk-item" />
          </div>
          <div className="an-sk-card" style={{ gridColumn: 'span 2' }}>
            <div className="an-skeleton an-sk-title" />
            <div className="an-skeleton an-sk-item" />
            <div className="an-skeleton an-sk-item" />
            <div className="an-skeleton an-sk-item" />
          </div>
          <div className="an-sk-card large">
            <div className="an-skeleton an-sk-title" />
            <div className="an-skeleton an-sk-item" />
            <div className="an-skeleton an-sk-item" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="an">
      <div className="page">
        <div className="hero a1">
          <div className="hero-orb1" />
          <div className="hero-orb2" />
          <div className="hero-grid-lines" />

          <div className="hero-left">
            <div className="hero-date">
              <div className="hero-date-dot" />
              <span>{heroDate}</span>
            </div>

            <h1 className="hero-title">
              {greeting},
              <br />
              <span className="hero-title-name">{displayName}</span>
            </h1>

            <p className="hero-sub">{resolvedHeroSubtitle}</p>

            <div className="profile-bar-row">
              <span className="pbar-label">
                {copy.profileStrengthLabel} <strong className="pbar-score">{profileScore}%</strong>
              </span>
              <div className="pbar-track">
                <div className="pbar-fill" style={{ width: `${profileScore}%` }} />
              </div>
              {profileScore < 100 ? (
                <button type="button" className="pbar-cta" onClick={() => navigate('/candidat/dashboard/profile')}>
                  {copy.completeProfile}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              ) : null}
            </div>

            <div className="hero-kpi-strip">
              {resolvedHeroStats.map((stat, index) => (
                <div key={stat.label} className="hkpi">
                  <div className="hkpi-label">{stat.label}</div>
                  <div className="hkpi-value" style={{ color: stat.valueColor }}>
                    <AnimatedCount target={stat.count} delay={250 + index * 90} />
                  </div>
                  <div className="hkpi-sub" style={{ color: stat.subColor }}>{stat.subText}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-right">
            <HeroFigure
              displayName={displayName}
              profileTitle={profileTitle}
              profileImage={profileImage}
              initials={initials}
              profileScore={profileScore}
              topMatchText={topMatchText}
              nextInterviewTime={nextInterviewTime}
              nextInterviewTitle={nextInterviewTitle}
              metrics={heroMetrics}
              liveLabel={copy.liveLabel}
            />
          </div>
        </div>

        <div className="dash-grid">
          <div className="card a2">
            <div className="card-head">
              <div className="card-title">
                <div className="ctitle-icon" style={{ background: 'var(--red-bg)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                {copy.actionsTitle}
              </div>
              <span className="card-pill card-pill--red">
                {actionItems.length} {copy.pendingWord}
              </span>
            </div>

            <div className="card-body">
              {actionItems.length > 0 ? actionItems.map((action) => (
                <button key={action.id} type="button" className="action-item" onClick={action.onClick}>
                  <div className="a-dot" style={action.dotStyle} />
                  <div className="a-text">
                    {action.text} - <span>{action.detail}</span>
                  </div>
                  <span className={`a-badge ${action.badgeClassName}`}>{action.badgeLabel}</span>
                </button>
              )) : (
                <div className="card-empty">
                  <p className="card-empty__title">{copy.actionsEmpty}</p>
                  <p className="card-empty__hint">{copy.actionsEmptyHint}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card a3">
            <div className="card-head">
              <div className="card-title">
                <div className="ctitle-icon" style={{ background: 'var(--green-bg)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                  </svg>
                </div>
                {t('upcoming_interviews')}
              </div>
              <button type="button" className="card-viewall" onClick={() => navigate('/candidat/dashboard/my-submissions')}>
                {copy.viewAll}
                <ChevronRightIcon />
              </button>
            </div>

            <div className="card-body">
              {upcomingInterviews.length > 0 ? upcomingInterviews.slice(0, 2).map((interview) => {
                const canJoin = isJoinableInterview(interview.status, interview.start_time, interview.end_time);
                const day = formatDate(interview.start_time, locale, { day: '2-digit' });
                const month = formatDate(interview.start_time, locale, { month: 'short' }).toUpperCase();

                return (
                  <div key={interview._id} className="iv-item">
                    <div className="iv-date" style={!canJoin ? { background: 'var(--surface)', borderColor: 'var(--border)' } : undefined}>
                      <div className="iv-day" style={!canJoin ? { color: 'var(--text2)' } : undefined}>{day}</div>
                      <div className="iv-mon">{month}</div>
                    </div>

                    <div className="iv-info">
                      <div className="iv-title">{`${interview.job_title || copy.applicationInterview} - ${interview.company_name || copy.candidateFallback}`}</div>
                      <div className="iv-meta">
                        <TimeIcon />
                        {`${formatTime(interview.start_time, locale)} \u00B7 ${interview.type || copy.videoInterview}`}
                      </div>

                      <div className="iv-btns">
                        {canJoin ? (
                          <button type="button" className="ivbtn primary" onClick={() => navigate(`/candidat/interviews/room/${interview._id}`)}>
                            {copy.join}
                          </button>
                        ) : null}
                        <button type="button" className="ivbtn" onClick={() => navigate(`/candidat/dashboard/applications/${interview.application_id}`)}>
                          {copy.applicationButton}
                        </button>
                        <button type="button" className="ivbtn" onClick={() => navigate('/candidat/dashboard/my-submissions')}>
                          {copy.interviewsButton}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="card-empty">
                  <p className="card-empty__title">{t('no_upcoming_interviews')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card notif-panel a4">
            <div className="card-head">
              <div className="card-title">
                <div className="ctitle-icon" style={{ background: 'var(--amber-bg)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                {copy.notificationsTitle}
              </div>
              <button type="button" className="card-viewall" onClick={() => navigate('/candidat/dashboard/notifications')}>
                {copy.viewAll}
                <ChevronRightIcon />
              </button>
            </div>

            <div ref={notificationsBodyRef} className="card-body card-body--notif">
              {visibleNotificationItems.length > 0 ? visibleNotificationItems.map((notification) => (
                <div
                  key={notification.id}
                  className="notif-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (notification.unread) markAsRead(notification.id);
                    navigate('/candidat/dashboard/notifications', { state: { selectedId: notification.id } });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (notification.unread) markAsRead(notification.id);
                      navigate('/candidat/dashboard/notifications', { state: { selectedId: notification.id } });
                    }
                  }}
                >
                  <div className="notif-icon" style={{ background: notification.iconBackground }}>
                    <NotificationIcon category={notification.category} color={notification.iconColor} />
                  </div>

                  <div className="notif-body">
                    <div className="notif-title">{notification.title}</div>
                    <div className="notif-time">{notification.message ? `${notification.message} \u00B7 ${notification.time}` : notification.time}</div>
                  </div>

                  {notification.unread && <div className="notif-unread" />}
                </div>
              )) : (
                <div className="card-empty">
                  <p className="card-empty__title">
                    {notificationsLoading ? '...' : copy.noNotifications}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card a5 applications-card">
            <div className="card-head">
              <div className="card-title">
                <div className="ctitle-icon" style={{ background: 'var(--indigo-bg)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                {copy.myApplicationsTitle}
              </div>
              <button type="button" className="card-viewall" onClick={() => navigate('/candidat/dashboard/my-submissions')}>
                {copy.viewAll}
                <ChevronRightIcon />
              </button>
            </div>

            <div className="card-body">
              {displayedApplications.length > 0 ? displayedApplications.map((application) => (
                <div
                  key={application.id}
                  className="app-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/candidat/dashboard/applications/${application.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/candidat/dashboard/applications/${application.id}`);
                    }
                  }}
                >
                  <div className="app-row-top">
                    <div className="app-logo" style={application.logoStyle}>{application.logo}</div>
                    <div className="app-info">
                      <div className="app-name">{application.name}</div>
                      <div className="app-co">{application.company}</div>
                    </div>
                    <span className={`app-status ${application.badge.className}`}>{application.badge.label}</span>
                  </div>

                  <StepTracker
                    activeStep={application.tracker.activeStep}
                    refused={application.tracker.refused}
                    t={t}
                  />
                </div>
              )) : (
                <div className="card-empty">
                  <p className="card-empty__title">{copy.noApplications}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ai-offers a6">
          <div className="ai-offers-head">
            <div className="ai-offers-title">
              {copy.aiOffersTitle}
              <span className="ai-chip">AI</span>
            </div>

            <button type="button" className="card-viewall" onClick={() => navigate('/candidat/dashboard/find-jobs')}>
              {copy.browseAll}
              <ChevronRightIcon />
            </button>
          </div>

          <div className="ai-offers-grid">
            {displayedOffers.length > 0 ? displayedOffers.map((offer, index) => (
              <div
                key={offer.id}
                className="offer-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/candidat/dashboard/find-jobs/${offer.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/candidat/dashboard/find-jobs/${offer.id}`);
                  }
                }}
              >
                <div className="o-logo" style={offer.logoStyle}>{offer.logo}</div>
                <div className="o-title">{offer.title || copy.aiOffersTitle}</div>
                <div className="o-company">{offer.companyLine}</div>

                <div className="o-footer">
                  <div className="o-match-wrap">
                    <svg className="o-ring" width="38" height="38" viewBox="0 0 38 38">
                      <circle className="track" cx="19" cy="19" r="14" />
                      <circle
                        className="fill"
                        cx="19"
                        cy="19"
                        r="14"
                        stroke={offer.matchColor}
                        strokeDasharray="88"
                        strokeDashoffset={offer.strokeOffset}
                        transform="rotate(-90 19 19)"
                        style={{ animation: `ring-draw .9s ${0.6 + index * 0.1}s ease both` }}
                      />
                    </svg>
                    <span className="o-match-pct" style={{ color: offer.matchColor }}>
                      {offer.matchPercent !== null ? `${offer.matchPercent}%` : '—'}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`o-save${offer.isSaved ? ' is-active' : ''}`}
                    onClick={(event) => handleToggleSave(offer.id, event)}
                  >
                    {offer.isSaved ? copy.saved : copy.save}
                  </button>
                </div>
              </div>
            )) : (
              <div className="card-empty card-empty--offers">
                <p className="card-empty__title">{loading.offers ? '...' : copy.noOffers}</p>
              </div>
            )}
          </div>
        </div>

        {skills.length > 0 && (
          <div className="ai-skills a7">
            {/* Header */}
            <div className="ai-skills-head">
              <div className="ai-skills-title-row">
                <span className="ai-chip">CNN</span>
                <span className="ai-skills-name">
                  {language === 'fr' ? 'Analyse de compétences IA' : 'AI Skills Intelligence'}
                </span>
                <span className="ai-skills-trained">· trained on 1.2M candidate-role pairs</span>
              </div>
              <div className="ai-skills-tabs-row">
                <div className="ai-tabs">
                  {['overview', 'gaps', 'trends'].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`ai-tab${aiSkillsTab === tab ? ' active' : ''}`}
                      onClick={() => setAiSkillsTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
                <button type="button" className="ai-settings-btn" aria-label="Settings">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* States */}
            {aiSkillsLoading ? (
              <div className="ai-skills-panels ai-skills-panels--loading">
                <div className="ai-panel"><div className="an-skeleton ai-sk-line" /><div className="an-skeleton ai-sk-line short" /></div>
                <div className="ai-panel"><div className="an-skeleton ai-sk-line" /><div className="an-skeleton ai-sk-line short" /></div>
                <div className="ai-panel"><div className="an-skeleton ai-sk-line" /><div className="an-skeleton ai-sk-line short" /></div>
              </div>
            ) : aiSkillsNoSkills ? (
              <div className="ai-sk-unavailable">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {language === 'fr' ? 'Veuillez ajouter des compétences à votre profil pour activer l\'analyse IA.' : 'Please add skills to your profile to enable AI analysis.'}
              </div>
            ) : aiSkillsUnavailable ? (
              <div className="ai-sk-unavailable">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {language === 'fr' ? 'Modèle CNN non disponible — lancez le backend avec Modele-CNN pour activer cette section.' : 'CNN model unavailable — start the backend with Modele-CNN to enable this section.'}
              </div>
            ) : (
              <div className="ai-skills-panels">

                {/* ── Panel 1: Profile Fit ── */}
                <div className="ai-panel ai-panel--fit">
                  <div className="ai-panel-head">
                    <span className="ai-panel-dot" />
                    <span className="ai-panel-lbl">PROFILE FIT</span>
                  </div>
                  <p className="ai-panel-desc">
                    {language === 'fr' ? 'Archétypes de rôles classés par Copilot.' : 'Top role archetypes Copilot ranks you against.'}
                  </p>
                  <div className="ai-fit-list">
                    {aiProfileRows.map((item) => (
                      <div key={item.profile} className="ai-fit-row">
                        <div className="ai-fit-row-top">
                          <span className="ai-fit-name">{item.displayName}</span>
                          <span className="ai-fit-pct">{item.pct}%</span>
                        </div>
                        <p className="ai-fit-subdesc">{item.description}</p>
                        <div className="ai-fit-bar-track">
                          <div className="ai-fit-bar-fill" style={{ width: `${item.pct}%` }} />
                          <div className="ai-fit-bar-marker" style={{ left: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {aiTopPercentile > 0 && (
                    <div className="ai-outmatch-banner">
                      <span className="ai-outmatch-star">✦</span>
                      {language === 'fr' ? (
                        <>Vous surpassez <strong>{aiTopPercentile}%</strong> des candidats pour votre profil principal.</>
                      ) : (
                        <>You out-match <strong>{aiTopPercentile}%</strong> of candidates for your top profile.</>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Panel 2: Skill Map ── */}
                <div className="ai-panel ai-panel--map">
                  <div className="ai-panel-head">
                    <span className="ai-panel-dot" />
                    <span className="ai-panel-lbl">SKILL MAP</span>
                  </div>
                  <p className="ai-panel-desc">
                    {language === 'fr'
                      ? `Vos forces vs. la cible ${aiTopProfileName}.`
                      : `Your strengths vs. typical ${aiTopProfileName} target.`}
                  </p>
                  <RadarChart yourScores={aiRadarYourScores} targetScores={aiRadarTargetScores} />
                  <div className="ai-radar-legend">
                    <span className="ai-legend-item ai-legend-you">
                      <span className="ai-legend-line" />
                      {language === 'fr' ? 'Vous' : 'You'}
                    </span>
                    <span className="ai-legend-item ai-legend-target">
                      <span className="ai-legend-line ai-legend-line--dashed" />
                      {language === 'fr' ? 'Rôle cible' : 'Target role'}
                    </span>
                  </div>
                </div>

                {/* ── Panel 3: Skills & Gaps ── */}
                <div className="ai-panel ai-panel--gaps">
                  <div className="ai-panel-head">
                    <span className="ai-panel-dot ai-panel-dot--pink" />
                    <span className="ai-panel-lbl">SKILLS & GAPS</span>
                  </div>
                  <p className="ai-panel-desc">
                    {language === 'fr' ? 'Signaux forts · lacunes à fort impact.' : 'Strongest signals · highest-leverage gaps.'}
                  </p>

                  <div className="ai-section-lbl">{language === 'fr' ? 'FORCES' : 'STRENGTHS'}</div>
                  <div className="ai-strength-chips">
                    {aiStrengths.map((item) => (
                      <span key={item.skill} className="ai-strength-chip">
                        {item.skill}
                        <em className="ai-strength-score">{item.score}</em>
                      </span>
                    ))}
                  </div>

                  <div className="ai-section-lbl">{language === 'fr' ? 'LACUNES À COMBLER' : 'GAPS TO CLOSE'}</div>
                  <div className="ai-gap-list">
                    {aiGaps.map((item) => (
                      <div key={item.skill} className="ai-gap-row">
                        <span className="ai-gap-name">{item.skill}</span>
                        <div className="ai-gap-bar-track">
                          <div className="ai-gap-bar-fill" style={{ width: `${item.barWidth}%` }} />
                          <div className="ai-gap-bar-needle" style={{ left: `${item.barWidth}%` }} />
                        </div>
                        <span className={`ai-gap-label ai-gap-label--${item.labelVariant}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="ai-learning-btn">
                    {language === 'fr' ? 'Générer un plan d\'apprentissage' : 'Generate learning plan'} →
                  </button>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;
