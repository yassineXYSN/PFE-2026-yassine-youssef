import { useLanguage } from '../../../../core/useLanguage';
import '../ComingSoon.css';

const Profile = () => {
    const { t } = useLanguage();

    return (
        <div className="coming-soon">
            <span className="material-symbols-outlined coming-soon__icon">person</span>
            <h1 className="coming-soon__title">Profile</h1>
            <p className="coming-soon__subtitle">{t('coming-soon')}</p>
        </div>
    );
};

export default Profile;
