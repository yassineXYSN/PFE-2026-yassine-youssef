import { useLanguage } from '../../../../core/useLanguage';
import '../ComingSoon.css';

const FindJobs = () => {
    const { t } = useLanguage();

    return (
        <div className="coming-soon">
            <span className="material-symbols-outlined coming-soon__icon">work</span>
            <h1 className="coming-soon__title">Find Jobs</h1>
            <p className="coming-soon__subtitle">{t('coming-soon')}</p>
        </div>
    );
};

export default FindJobs;
