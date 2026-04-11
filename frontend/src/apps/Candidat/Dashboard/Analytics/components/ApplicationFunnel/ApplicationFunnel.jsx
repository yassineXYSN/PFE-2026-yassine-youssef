import { useLanguage } from '../../../../../../core/useLanguage';
import './ApplicationFunnel.css';

const ApplicationFunnel = ({ data, onAction }) => {
  const { t } = useLanguage();
  const maxCount = Math.max(...data.map((s) => s.count), 1);

  return (
    <div className="fnl">
      <h3 className="fnl__title">{t('analytics-application-funnel')}</h3>
      <div className="fnl__list">
        {data.map((step) => (
          <div key={step.id} className="fnl__step">
            <div className="fnl__left">
              <div className="fnl__icon-box">
                <span className="material-symbols-outlined">{step.icon}</span>
              </div>
              <div className="fnl__text">
                <span className="fnl__label">{step.label}</span>
                <span className="fnl__count">{step.count}</span>
              </div>
            </div>
            <div className="fnl__bar-wrap">
              <div className="fnl__bar-track">
                <div
                  className="fnl__bar-fill"
                  style={{ width: `${Math.max((step.count / maxCount) * 100, 2)}%` }}
                />
              </div>
            </div>
            <span className="fnl__pct">{step.rate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApplicationFunnel;
