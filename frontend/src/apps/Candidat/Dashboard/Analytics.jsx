import { motion } from 'framer-motion';
import { useLanguage } from '../../../core/useLanguage';
import KPICard from './components/KPICard/KPICard';
import StreakCard from './components/StreakCard/StreakCard';
import ApplicationFunnel from './components/ApplicationFunnel/ApplicationFunnel';
import ProfileViewsChart from './components/ProfileViewsChart/ProfileViewsChart';
import GoalTracking from './components/GoalTracking/GoalTracking';
import SkillsGapAnalysis from './components/SkillsGapAnalysis/SkillsGapAnalysis';
import './Analytics.css';

const Analytics = () => {
  const { t } = useLanguage();

  const kpiCards = [
    {
      title: t('analytics-total-applications'),
      value: 142,
      suffix: '',
      icon: 'work',
      iconBg: 'is-blue',
      trend: { direction: 'up', value: '+12%' },
    },
    {
      title: t('analytics-response-rate'),
      value: 38,
      suffix: '%',
      icon: 'forward_to_inbox',
      iconBg: 'is-green',
      trend: { direction: 'up', value: '+6%' },
    },
    {
      title: t('analytics-interview-rate'),
      value: 17,
      suffix: '%',
      icon: 'record_voice_over',
      iconBg: 'is-pink',
      trend: { direction: 'down', value: '-2%' },
    },
  ];

  const funnelData = [
    { key: 'analytics-applied', count: 142, rate: '100%', icon: 'send' },
    { key: 'analytics-screening', count: 54, rate: '38%', icon: 'fact_check' },
    { key: 'analytics-interview', count: 24, rate: '17%', icon: 'forum' },
    { key: 'analytics-offer', count: 4, rate: '3%', icon: 'workspace_premium' },
  ];

  const profileViews = [
    { week: 'W1', views: 120 },
    { week: 'W2', views: 160 },
    { week: 'W3', views: 210 },
    { week: 'W4', views: 190 },
    { week: 'W5', views: 260 },
    { week: 'W6', views: 320 },
  ];

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

  return (
    <div className="analytics">
      <header className="analytics__header">
        <div>
          <h1>{t('analytics-title')}</h1>
          <div className="analytics__status">
            <span>{t('analytics-status')}</span>
            <span className="analytics__badge">{t('analytics-open-to-work')}</span>
          </div>
        </div>
        <div className="analytics__actions">
          <select className="analytics__select" defaultValue="30">
            <option value="7">7 days</option>
            <option value="30">{t('analytics-last-30-days')}</option>
            <option value="90">90 days</option>
          </select>
          <button type="button" className="analytics__primary">
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
            {t('analytics-log-application')}
          </button>
        </div>
      </header>

      <section className="analytics__kpis">
        {kpiCards.map((card) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <KPICard {...card} />
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <StreakCard
            title={t('analytics-current-streak')}
            value={6}
            subtitle={`${t('analytics-weeks')} - ${t('analytics-keep-it-up')}`}
          />
        </motion.div>
      </section>

      <section className="analytics__row">
        <ApplicationFunnel data={funnelData} />
        <ProfileViewsChart
          data={profileViews}
          title={t('analytics-profile-views')}
          value="1.3k"
          trend="+22%"
        />
      </section>

      <section className="analytics__row analytics__row--secondary">
        <GoalTracking percent={72} total={20} milestones={milestones} />
        <SkillsGapAnalysis role="Product Engineer" data={skills} />
      </section>
    </div>
  );
};

export default Analytics;
