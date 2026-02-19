import CountUp from 'react-countup';
import GlareHover from '../GlareHover/GlareHover';
import './StreakCard.css';

const StreakCard = ({ title, value, subtitle }) => {
  return (
    <GlareHover className="streak-card" borderRadius="1rem">
      <div className="streak-card__icon">
        <span className="material-symbols-outlined" aria-hidden="true">
          local_fire_department
        </span>
      </div>
      <div>
        <p className="streak-card__title">{title}</p>
        <div className="streak-card__value">
          <CountUp end={value} duration={1.2} />
          <span>+</span>
        </div>
        <p className="streak-card__subtitle">{subtitle}</p>
      </div>
    </GlareHover>
  );
};

export default StreakCard;
