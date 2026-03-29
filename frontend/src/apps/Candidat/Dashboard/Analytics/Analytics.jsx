import { motion as Motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../../core/api';
import { useLanguage } from '../../../../core/useLanguage';
import Skeleton from '../components/Skeleton/Skeleton';
import KPICard from './components/KPICard/KPICard';
import StreakCard from './components/StreakCard/StreakCard';
import ApplicationFunnel from './components/ApplicationFunnel/ApplicationFunnel';
import ProfileViewsChart from './components/ProfileViewsChart/ProfileViewsChart';
import GoalTracking from './components/GoalTracking/GoalTracking';
import SkillsGapAnalysis from './components/SkillsGapAnalysis/SkillsGapAnalysis';
import './Analytics.css';

const INITIAL_STATUSES = new Set(['new', 'pending']);
const INTERVIEW_STATUSES = new Set(['interview', 'accepted']);
const PERIOD_OPTIONS = [7, 30, 90];

const toValidDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getApplicationDate = (application) => (
  toValidDate(application.applied_at)
  || toValidDate(application.created_at)
  || toValidDate(application.updated_at)
);

const normalizeStatus = (status) => {
  const value = `${status || 'pending'}`.toLowerCase();
  return value === 'new' ? 'pending' : value;
};

const calculateRate = (numerator, denominator) => (
  denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0
);

const getMetricSnapshot = (applications) => {
  const total = applications.length;
  const responded = applications.filter((application) => !INITIAL_STATUSES.has(normalizeStatus(application.status))).length;
  const interviews = applications.filter((application) => INTERVIEW_STATUSES.has(normalizeStatus(application.status))).length;
  const offers = applications.filter((application) => normalizeStatus(application.status) === 'accepted').length;

  return {
    total,
    responded,
    interviews,
    offers,
    responseRate: calculateRate(responded, total),
    interviewRate: calculateRate(interviews, total),
  };
};

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const startOfWeek = (date) => {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
};

const getPeriodSlices = (applications, days, now) => {
  const currentPeriodStart = addDays(startOfDay(now), -(days - 1));
  const previousPeriodStart = addDays(currentPeriodStart, -days);

  const current = [];
  const previous = [];

  applications.forEach((application) => {
    const appliedAt = getApplicationDate(application);

    if (!appliedAt) {
      return;
    }

    if (appliedAt >= currentPeriodStart && appliedAt <= now) {
      current.push(application);
      return;
    }

    if (appliedAt >= previousPeriodStart && appliedAt < currentPeriodStart) {
      previous.push(application);
    }
  });

  return { current, previous };
};

const formatAbsoluteNumber = (value) => {
  const absolute = Math.abs(value);
  return Number.isInteger(absolute) ? absolute.toFixed(0) : absolute.toFixed(1);
};

const getTrend = ({ currentValue, previousValue, type = 'count', t }) => {
  if (currentValue === 0 && previousValue === 0) {
    return { direction: 'flat', value: t('analytics-trend-stable') };
  }

  if (previousValue === 0 && currentValue > 0) {
    return { direction: 'up', value: t('analytics-trend-new') };
  }

  const delta = Number((currentValue - previousValue).toFixed(1));

  if (delta === 0) {
    return { direction: 'flat', value: t('analytics-trend-stable') };
  }

  const suffix = type === 'rate' ? ` ${t('analytics-trend-points')}` : '';

  return {
    direction: delta > 0 ? 'up' : 'down',
    value: `${delta > 0 ? '+' : '-'}${formatAbsoluteNumber(delta)}${suffix}`,
  };
};

const getCurrentWeekStreak = (applications, now) => {
  const activeWeeks = new Set(
    applications
      .map((application) => getApplicationDate(application))
      .filter(Boolean)
      .map((date) => startOfWeek(date).toISOString().slice(0, 10))
  );

  let streak = 0;
  let cursor = startOfWeek(now);

  while (activeWeeks.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }

  return streak;
};

const getDecimals = (value) => (Number.isInteger(value) ? 0 : 1);

const Analytics = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  useEffect(() => {
    let isActive = true;

    const fetchAnalyticsData = async () => {
      setLoading(true);

      const [applicationsResult, profileResult] = await Promise.allSettled([
        apiFetch('/applications/my-applications'),
        apiFetch('/candidat/profile'),
      ]);

      if (!isActive) {
        return;
      }

      if (applicationsResult.status === 'fulfilled') {
        setApplications(Array.isArray(applicationsResult.value) ? applicationsResult.value : []);
      } else {
        console.error('Error fetching candidate applications:', applicationsResult.reason);
        setApplications([]);
      }

      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value || null);
      } else {
        console.error('Error fetching candidate profile:', profileResult.reason);
        setProfile(null);
      }

      setLoading(false);
    };

    fetchAnalyticsData();

    return () => {
      isActive = false;
    };
  }, []);

  const analyticsMetrics = useMemo(() => {
    const now = new Date();
    const selectedDays = Number(selectedPeriod);
    const allTime = getMetricSnapshot(applications);
    const { current, previous } = getPeriodSlices(applications, selectedDays, now);
    const currentPeriod = getMetricSnapshot(current);
    const previousPeriod = getMetricSnapshot(previous);
    const currentStreak = getCurrentWeekStreak(applications, now);

    const totalTrend = getTrend({
      currentValue: currentPeriod.total,
      previousValue: previousPeriod.total,
      t,
    });

    const responseTrend = getTrend({
      currentValue: currentPeriod.responseRate,
      previousValue: previousPeriod.responseRate,
      type: 'rate',
      t,
    });

    const interviewTrend = getTrend({
      currentValue: currentPeriod.interviewRate,
      previousValue: previousPeriod.interviewRate,
      type: 'rate',
      t,
    });

    const kpiCards = [
      {
        title: t('analytics-total-applications'),
        value: allTime.total,
        suffix: '',
        icon: 'work',
        iconBg: 'is-blue',
        trend: totalTrend,
      },
      {
        title: t('analytics-response-rate'),
        value: allTime.responseRate,
        suffix: '%',
        icon: 'forward_to_inbox',
        iconBg: 'is-green',
        trend: responseTrend,
        decimals: getDecimals(allTime.responseRate),
      },
      {
        title: t('analytics-interview-rate'),
        value: allTime.interviewRate,
        suffix: '%',
        icon: 'record_voice_over',
        iconBg: 'is-pink',
        trend: interviewTrend,
        decimals: getDecimals(allTime.interviewRate),
      },
    ];

    const funnelData = [
      {
        key: 'analytics-applied',
        count: allTime.total,
        rate: `${allTime.total > 0 ? 100 : 0}%`,
        icon: 'send',
      },
      {
        key: 'analytics-screening',
        count: allTime.responded,
        rate: `${Math.round(allTime.responseRate)}%`,
        icon: 'fact_check',
      },
      {
        key: 'analytics-interview',
        count: allTime.interviews,
        rate: `${Math.round(allTime.interviewRate)}%`,
        icon: 'forum',
      },
      {
        key: 'analytics-offer',
        count: allTime.offers,
        rate: `${Math.round(calculateRate(allTime.offers, allTime.total))}%`,
        icon: 'workspace_premium',
      },
    ];

    return {
      kpiCards,
      funnelData,
      currentStreak,
    };
  }, [applications, selectedPeriod, t]);

  const milestones = [
    { label: t('analytics-application-master'), progress: 72 },
    { label: t('analytics-fast-mover'), progress: 48 },
  ];

  const skills = [
    { name: 'React', you: 78, market: 88, gap: 10 },
    { name: 'Node.js', you: 62, market: 80, gap: 18 },
    { name: 'Data Analytics', you: 44, market: 72, gap: 28 },
    { name: 'System Design', you: 58, market: 74, gap: 16 },
  ];

  const profileViews = [
    { week: 'W1', views: 120 },
    { week: 'W2', views: 160 },
    { week: 'W3', views: 210 },
    { week: 'W4', views: 190 },
    { week: 'W5', views: 260 },
    { week: 'W6', views: 320 },
  ];

  return (
    <div className="analytics">
      <header className="analytics__header">
        <div>
          {loading ? (
            <>
              <Skeleton variant="text" width="200px" height="2.5rem" style={{ marginBottom: '0.5rem' }} />
              <Skeleton variant="text" width="150px" height="1rem" />
            </>
          ) : (
            <>
              <h1>{t('analytics-title')}</h1>
              <div className="analytics__status">
                <span>{t('analytics-status')}</span>
                <span className="analytics__badge">{t('analytics-open-to-work')}</span>
              </div>
            </>
          )}
        </div>
        <div className="analytics__actions">
          {loading ? (
            <>
              <Skeleton variant="rectangle" width="120px" height="42px" style={{ borderRadius: '0.6rem' }} />
              <Skeleton variant="rectangle" width="160px" height="42px" style={{ borderRadius: '0.6rem' }} />
            </>
          ) : (
            <>
              <select
                className="analytics__select"
                value={selectedPeriod}
                onChange={(event) => setSelectedPeriod(event.target.value)}
              >
                {PERIOD_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {t(`analytics-last-${days}-days`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="analytics__primary"
                onClick={() => navigate('/candidat/dashboard/find-jobs')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  add
                </span>
                {t('analytics-log-application')}
              </button>
            </>
          )}
        </div>
      </header>

      <section className="analytics__kpis">
        {loading ? (
          [1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="analytics__kpi-skeleton"
              style={{
                background: 'var(--dashboard-surface)',
                padding: '1.5rem',
                borderRadius: '1.25rem',
                border: '1px solid var(--dashboard-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <Skeleton variant="text" width="100px" height="1rem" />
                <Skeleton variant="circle" width="40px" height="40px" />
              </div>
              <Skeleton variant="text" width="60px" height="2.5rem" style={{ marginBottom: '0.5rem' }} />
              <Skeleton variant="text" width="80px" height="0.8rem" style={{ marginBottom: '0.45rem' }} />
              <Skeleton variant="text" width="100%" height="0.8rem" />
            </div>
          ))
        ) : (
          <>
            {analyticsMetrics.kpiCards.map((card) => (
              <Motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <KPICard {...card} />
              </Motion.div>
            ))}
            <Motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <StreakCard
                title={t('analytics-current-streak')}
                value={analyticsMetrics.currentStreak}
                subtitle={`${t('analytics-weeks')} - ${t('analytics-keep-it-up')}`}
              />
            </Motion.div>
          </>
        )}
      </section>

      <section className="analytics__row">
        {loading ? (
          <>
            <div style={{ flex: 1.5, background: 'var(--dashboard-surface)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--dashboard-border)' }}>
              <Skeleton variant="text" width="150px" height="1.2rem" style={{ marginBottom: '1.5rem' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} variant="rectangle" width="100%" height="40px" style={{ borderRadius: '0.8rem' }} />
                ))}
              </div>
            </div>
            <div style={{ flex: 2, background: 'var(--dashboard-surface)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--dashboard-border)' }}>
              <Skeleton variant="text" width="150px" height="1.2rem" style={{ marginBottom: '1.5rem' }} />
              <Skeleton variant="rectangle" width="100%" height="200px" style={{ borderRadius: '0.8rem' }} />
            </div>
          </>
        ) : (
          <>
            <ApplicationFunnel
              data={analyticsMetrics.funnelData}
              onAction={() => navigate('/candidat/dashboard/my-submissions')}
            />
            <ProfileViewsChart
              data={profileViews}
              title={t('analytics-profile-views')}
              value="1.3k"
              trend="+22%"
            />
          </>
        )}
      </section>

      <section className="analytics__row analytics__row--secondary">
        {loading ? (
          <>
            <div style={{ flex: 1, background: 'var(--dashboard-surface)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--dashboard-border)' }}>
              <Skeleton variant="text" width="150px" height="1.2rem" style={{ marginBottom: '1.5rem' }} />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Skeleton variant="circle" width="100px" height="100px" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem', justifyContent: 'center' }}>
                  <Skeleton variant="text" width="80%" height="0.8rem" />
                  <Skeleton variant="text" width="60%" height="0.8rem" />
                </div>
              </div>
            </div>
            <div style={{ flex: 1, background: 'var(--dashboard-surface)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--dashboard-border)' }}>
              <Skeleton variant="text" width="150px" height="1.2rem" style={{ marginBottom: '1.5rem' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} variant="text" width="100%" height="0.9rem" />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <GoalTracking percent={72} total={20} milestones={milestones} />
            <SkillsGapAnalysis role={profile?.title?.trim() || 'Product Engineer'} data={skills} />
          </>
        )}
      </section>
    </div>
  );
};

export default Analytics;
