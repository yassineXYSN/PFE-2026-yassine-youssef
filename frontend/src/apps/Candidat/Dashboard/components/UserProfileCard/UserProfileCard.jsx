import { useState, useEffect } from 'react';
import { supabase } from '../../../../../core/supabaseClient';
import { apiFetch } from '../../../../../core/api';
import './UserProfileCard.css';

const UserProfileCard = ({ onClick }) => {
  const [user, setUser] = useState({
    name: '',
    initials: '',
    role: '',
    location: '',
    profileImage: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          try {
            const data = await apiFetch('/candidat/profile');
            const firstName = data.firstName || '';
            const lastName = data.lastName || '';

            // Resolve image the same way ProfilePage does
            let image = data.profileImage || data.profilePicture || null;
            if (image && !image.startsWith('http') && !image.startsWith('data:')) {
              image = `http://localhost:8000${image.startsWith('/') ? '' : '/'}${image}`;
            }

            setUser({
              name: `${firstName} ${lastName}`.trim() || 'User Profile',
              initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
              role: data.title || 'Candidate',
              location: data.address || data.location || '',
              profileImage: image
            });
          } catch (err) {
            console.error('Error fetching user data for sidebar:', err);
          }
        }
      } catch (error) {
        console.error('Error fetching user data for sidebar:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (isLoading) {
    return (
      <div className="dashboard-profile" style={{ cursor: 'default' }}>
        <div className="dashboard-profile__avatar pp-skeleton pp-skeleton-avatar"></div>
        <div style={{ flex: 1 }}>
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
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span>{user.initials || '??'}</span>
        )}
        <span className="dashboard-profile__status" />
      </div>
      <div>
        <div className="dashboard-profile__name">{user.name}</div>
        <div className="dashboard-profile__role">{user.role}</div>
        <div className="dashboard-profile__meta">{user.location}</div>
      </div>
    </div>
  );
};

export default UserProfileCard;
