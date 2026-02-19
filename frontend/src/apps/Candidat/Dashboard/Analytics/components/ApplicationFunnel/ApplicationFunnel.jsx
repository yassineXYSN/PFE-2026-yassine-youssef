import { useLanguage } from '../../../../../../core/useLanguage';
import GlareHover from '../GlareHover/GlareHover';
import './ApplicationFunnel.css';

const ApplicationFunnel = ({ data }) => {
  const { t } = useLanguage();

  return (
    <GlareHover className="funnel-card" borderRadius="1rem">
      <div className="funnel-card__header">
        <div>
          <h3>{t('analytics-application-funnel')}</h3>
          <p>{t('analytics-funnel-subtitle')}</p>
        </div>
        <button type="button" className="funnel-card__action">
          {t('analytics-view-details')}
        </button>
      </div>
      <div className="funnel-card__body">
        {data.map((step, index) => (
          <div key={step.key} className="funnel-step">
            <div className="funnel-step__icon">
              <span className="material-symbols-outlined" aria-hidden="true">
                {step.icon}
              </span>
            </div>
            <div className="funnel-step__info">
              <div className="funnel-step__label">{t(step.key)}</div>
              <div className="funnel-step__value">{step.count}</div>
            </div>
            <div className="funnel-step__rate">{step.rate}</div>
            {index < data.length - 1 ? <span className="funnel-step__line" /> : null}
          </div>
        ))}
      </div>
    </GlareHover>
  );
};

export default ApplicationFunnel;
