import { useLanguage } from '../../../../core/useLanguage';
import './MarketTrends.css';

const MarketTrends = () => {
  const { t } = useLanguage();
  return (
    <div className="coming-soon">
      <div className="coming-soon__card">
        <span className="material-symbols-outlined" aria-hidden="true">
          auto_awesome
        </span>
        <h2>{t('sidebar-market') || 'Market Trends'}</h2>
        <p>{t('coming-soon-desc') || 'New experience in progress. Stay tuned for the full release.'}</p>
      </div>
    </div>
  );
};

export default MarketTrends;
