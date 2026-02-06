import CountUp from 'react-countup';
import { useLanguage } from '../../../../../../core/useLanguage';
import GlareHover from '../GlareHover/GlareHover';
import './GoalTracking.css';

const GoalTracking = ({ percent, total, milestones }) => {
  const { t } = useLanguage();

  return (
    <GlareHover className="goal-card" borderRadius="1rem">
      <div className="goal-card__header">
        <div className="goal-card__header-content">
          <div className="goal-card__icon-wrapper">
            <span className="material-symbols-outlined" aria-hidden="true">
              flag
            </span>
          </div>
          <div>
            <h3>{t('analytics-goal-tracking')}</h3>
            <p>{t('analytics-weekly-target')}</p>
          </div>
        </div>
        <span className="goal-card__badge">{t('analytics-top-5')}</span>
      </div>

      <div className="goal-card__progress">
        <div className="goal-card__stats">
          <div className="goal-card__stat">
            <span className="material-symbols-outlined">trending_up</span>
            <div>
              <div className="goal-card__stat-value">
                <CountUp end={percent} duration={1.2} />%
              </div>
              <div className="goal-card__stat-label">
                {t('analytics-goal-progress').replace('{percent}', '')}
              </div>
            </div>
          </div>
          <div className="goal-card__stat">
            <span className="material-symbols-outlined">checklist</span>
            <div>
              <div className="goal-card__stat-value">{total}</div>
              <div className="goal-card__stat-label">{t('analytics-of-apps').replace('{total}', '')}</div>
            </div>
          </div>
        </div>

        <div className="goal-card__bar-large">
          <div className="goal-card__bar-fill" style={{ width: `${percent}%` }}>
            <span className="goal-card__bar-label">{percent}%</span>
          </div>
        </div>
      </div>

      <div className="goal-card__milestones">
        <div className="goal-card__milestones-title">
          <span className="material-symbols-outlined">emoji_events</span>
          {t('analytics-upcoming-milestones')}
        </div>
        {milestones.map((item) => (
          <div key={item.label} className="goal-card__milestone">
            <div className="goal-card__milestone-info">
              <span className="material-symbols-outlined">military_tech</span>
              <span className="goal-card__milestone-label">{item.label}</span>
            </div>
            <div className="goal-card__milestone-progress">
              <div className="goal-card__milestone-bar">
                <span style={{ width: `${item.progress}%` }} />
              </div>
              <span className="goal-card__milestone-percent">{item.progress}%</span>
            </div>
          </div>
        ))}
      </div>
    </GlareHover>
  );
};

export default GoalTracking;
