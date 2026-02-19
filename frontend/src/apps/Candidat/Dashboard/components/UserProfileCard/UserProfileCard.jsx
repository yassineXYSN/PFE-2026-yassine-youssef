import './UserProfileCard.css';

const UserProfileCard = ({ onClick }) => {
  return (
    <div
      className="dashboard-profile"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="dashboard-profile__avatar">
        <span>YH</span>
        <span className="dashboard-profile__status" />
      </div>
      <div>
        <div className="dashboard-profile__name">Yassine H.</div>
        <div className="dashboard-profile__role">Full-Stack Engineer</div>
        <div className="dashboard-profile__meta">Casablanca, MA</div>
      </div>
    </div>
  );
};

export default UserProfileCard;
