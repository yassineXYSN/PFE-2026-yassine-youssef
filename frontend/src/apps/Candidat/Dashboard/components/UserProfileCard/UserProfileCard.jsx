import { useState, useEffect } from 'react';
import { SERVER_URL, getCandidateProfile } from '../../../../../core/api';
import { useLanguage } from '../../../../../core/useLanguage';
import './UserProfileCard.css';

const UserProfileCard = ({ onClick }) => {
  const { t, language } = useLanguage();
  const [user, setUser] = useState({
    name: '',
    initials: '',
    role: '',
    location: '',
    profileImage: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const resolveImageUrl = (value) => {
      if (!value || typeof value !== 'string') return null;
      if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
        return value;
      }

      return `${SERVER_URL}${value.startsWith('/') ? '' : '/'}${value}`;
    };

    const fetchUserData = async () => {
      try {
        const data = await getCandidateProfile();
        if (!data || !active) return;

        const firstName = data.firstName || '';
        const lastName = data.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || data.name || data.email || t('sidebar-profile-name-default');
        const resolvedInitials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || displayName.slice(0, 2).toUpperCase();

        const image = resolveImageUrl(
          data.profileImage
          || data.profilePicture
          || data.avatar_url
          || data.avatar
          || data.photo
          || null,
        );

        if (!active) return;

        setUser({
          name: displayName,
          initials: resolvedInitials,
          role: data.title || data.role || t('sidebar-profile-role-default'),
          location: data.address || data.location || data.country || '',
          profileImage: image,
        });
      } catch (error) {
        console.error('Error fetching user data for sidebar:', error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchUserData();

    return () => {
      active = false;
    };
  }, [language]);

  if (isLoading) {
    return (
      <div className="dashboard-profile" style={{ cursor: 'default' }}>
        <div className="dashboard-profile__avatar pp-skeleton pp-skeleton-avatar"></div>
        <div className="dashboard-profile__details" style={{ flex: 1 }}>
          <div className="pp-skeleton pp-skeleton-text" style={{ width: '80%', height: '1.2rem', marginBottom: '0.4rem' }}></div>
          <div className="pp-skeleton pp-skeleton-text" style={{ width: '60%', height: '0.8rem', marginBottom: '0.3rem' }}></div>
          <div className="pp-skeleton pp-skeleton-text" style={{ width: '40%', height: '0.7rem' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="dashboard-profile"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="dashboard-profile__avatar">
        {user.profileImage ? (
          <img
            src={user.profileImage}
            alt="Profile"
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span>{user.initials || '??'}</span>
        )}
        <span className="dashboard-profile__status" />
      </div>
      <div className="dashboard-profile__details">
        <div className="dashboard-profile__name">{user.name}</div>
        <div className="dashboard-profile__role">{user.role}</div>
        {user.location ? <div className="dashboard-profile__meta">{user.location}</div> : null}
      </div>
    </div>
  );
};

export default UserProfileCard;
