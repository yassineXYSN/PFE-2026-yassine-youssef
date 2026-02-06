import { useLanguage } from '../../../../core/useLanguage';
import '../ComingSoon.css';

const MySubmissions = () => {
    const { t } = useLanguage();

    return (
        <div className="coming-soon">
            <span className="material-symbols-outlined coming-soon__icon">assignment</span>
            <h1 className="coming-soon__title">My Submissions</h1>
            <p className="coming-soon__subtitle">{t('coming-soon')}</p>
        </div>
    );
};

export default MySubmissions;
