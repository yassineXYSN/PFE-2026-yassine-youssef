import { useLanguage } from '../../../../core/useLanguage';
import '../ComingSoon.css';

const Notifications = () => {
    const { t } = useLanguage();

    return (
        <div className="coming-soon">
            <span className="material-symbols-outlined coming-soon__icon">notifications</span>
            <h1 className="coming-soon__title">Notifications</h1>
            <p className="coming-soon__subtitle">{t('coming-soon')}</p>
        </div>
    );
};

export default Notifications;
