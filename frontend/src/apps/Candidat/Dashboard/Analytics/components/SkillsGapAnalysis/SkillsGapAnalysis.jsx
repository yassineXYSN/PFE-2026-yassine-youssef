import { useLanguage } from '../../../../../../core/useLanguage';
import GlareHover from '../GlareHover/GlareHover';
import './SkillsGapAnalysis.css';

const SkillsGapAnalysis = ({ role, data }) => {
  const { t } = useLanguage();

  return (
    <GlareHover className="skills-card" borderRadius="1rem">
      <div className="skills-card__header">
        <div>
          <h3>{t('analytics-skills-gap')}</h3>
          <p>
            {t('analytics-skills-gap-subtitle')} <strong>{role}</strong>
          </p>
        </div>
        <div className="skills-card__legend">
          <span>
            <i className="dot dot-you" /> {t('analytics-you')}
          </span>
          <span>
            <i className="dot dot-market" /> {t('analytics-market-avg')}
          </span>
        </div>
      </div>
      <div className="skills-card__body">
        {data.map((skill) => (
          <div key={skill.name} className="skills-card__row">
            <div className="skills-card__label">
              <span>{skill.name}</span>
              <span
                className={`skills-card__tag ${skill.gap >= 20 ? 'is-gap' : 'is-match'
                  }`}
              >
                {skill.gap >= 20 ? t('analytics-high-gap') : t('analytics-match')}
              </span>
            </div>
            <div className="skills-card__bars">
              <div className="bar bar-you">
                <span style={{ width: `${skill.you}%` }} />
              </div>
              <div className="bar bar-market">
                <span style={{ width: `${skill.market}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlareHover>
  );
};

export default SkillsGapAnalysis;
