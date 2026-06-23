import CountUp from 'react-countup';
import GlareHover from '../GlareHover/GlareHover';
import './KPICard.css';

const KPICard = ({ icon, iconBg = '', title, value, suffix, trend, decimals = 0 }) => {
  return (
    <GlareHover className="kpi-card" borderRadius="1rem">
      <div className="kpi-card__header">
        <div className={`kpi-card__icon ${iconBg}`}>
          <span className="material-symbols-outlined" aria-hidden="true">
            {icon}
          </span>
        </div>
        {trend ? (
          <span className={`kpi-card__trend kpi-card__trend--${trend.direction}`}>
            <span className="material-symbols-outlined" aria-hidden="true">
              {trend.direction === 'up'
                ? 'trending_up'
                : trend.direction === 'down'
                  ? 'trending_down'
                  : 'trending_flat'}
            </span>
            {trend.value}
          </span>
        ) : null}
      </div>
      <div className="kpi-card__body">
        <p className="kpi-card__title">{title}</p>
        <div className="kpi-card__value">
          <CountUp end={value} duration={1.4} decimals={decimals} />
          {suffix ? <span className="kpi-card__suffix">{suffix}</span> : null}
        </div>
      </div>
    </GlareHover>
  );
};

export default KPICard;
