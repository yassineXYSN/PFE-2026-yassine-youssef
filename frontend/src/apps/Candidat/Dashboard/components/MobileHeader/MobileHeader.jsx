import './MobileHeader.css';

const MobileHeader = ({ onMenuToggle }) => {
  return (
    <header className="dashboard-mobile-header">
      <button
        type="button"
        className="dashboard-mobile-header__menu"
        onClick={onMenuToggle}
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>
    </header>
  );
};

export default MobileHeader;
