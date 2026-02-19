import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../../../core/useLanguage';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import Dock from '../components/Dock/Dock';
import './Settings.css';
import './SettingsNotifications.css';

// SVG Flags
const USFlag = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <mask id="maskUS" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
      <circle cx="12" cy="12" r="12" fill="white" />
    </mask>
    <g mask="url(#maskUS)">
      <rect width="24" height="24" fill="#B22234" />
      <path fillRule="evenodd" clipRule="evenodd" d="M0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12Z" fill="#3C3B6E" />
      <rect y="1.125" width="24" height="2.415" fill="white" />
      <rect y="5.955" width="24" height="2.415" fill="white" />
      <rect y="10.785" width="24" height="2.415" fill="white" />
      <rect y="15.615" width="24" height="2.415" fill="white" />
      <rect y="20.445" width="24" height="2.415" fill="white" />
      <path d="M0 0H12.075V13.275H0V0Z" fill="#3C3B6E" />
      <path d="M1.875 1.875L2.325 3.225H3.75L2.625 4.05L3.075 5.4L1.875 4.575L0.675 5.4L1.125 4.05L0 3.225H1.425L1.875 1.875Z" fill="white" />
      <path d="M6 1.875L6.45 3.225H7.875L6.75 4.05L7.2 5.4L6 4.575L4.8 5.4L5.25 4.05L4.125 3.225H5.55L6 1.875Z" fill="white" />
      <path d="M10.125 1.875L10.575 3.225H12L10.875 4.05L11.325 5.4L10.125 4.575L8.925 5.4L9.375 4.05L8.25 3.225H9.675L10.125 1.875Z" fill="white" />
      <path d="M3.9375 4.5L4.3875 5.85H5.8125L4.6875 6.675L5.1375 8.025L3.9375 7.2L2.7375 8.025L3.1875 6.675L2.0625 5.85H3.4875L3.9375 4.5Z" fill="white" />
      <path d="M8.0625 4.5L8.5125 5.85H9.9375L8.8125 6.675L9.2625 8.025L8.0625 7.2L6.8625 8.025L7.3125 6.675L6.1875 5.85H7.6125L8.0625 4.5Z" fill="white" />
      <path d="M1.875 7.125L2.325 8.475H3.75L2.625 9.3L3.075 10.65L1.875 9.825L0.675 10.65L1.125 9.3L0 8.475H1.425L1.875 7.125Z" fill="white" />
      <path d="M6 7.125L6.45 8.475H7.875L6.75 9.3L7.2 10.65L6 9.825L4.8 10.65L5.25 9.3L4.125 8.475H5.55L6 7.125Z" fill="white" />
      <path d="M10.125 7.125L10.575 8.475H12L10.875 9.3L11.325 10.65L10.125 9.825L8.925 10.65L9.375 9.3L8.25 8.475H9.675L10.125 7.125Z" fill="white" />
      <path d="M3.9375 9.75L4.3875 11.1H5.8125L4.6875 11.925L5.1375 13.275L3.9375 12.45L2.7375 13.275L3.1875 11.925L2.0625 11.1H3.4875L3.9375 9.75Z" fill="white" />
      <path d="M8.0625 9.75L8.5125 11.1H9.9375L8.8125 11.925L9.2625 13.275L8.0625 12.45L6.8625 13.275L7.3125 11.925L6.1875 11.1H7.6125L8.0625 9.75Z" fill="white" />
    </g>
  </svg>
);

const FRFlag = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <mask id="maskFR" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
      <circle cx="12" cy="12" r="12" fill="white" />
    </mask>
    <g mask="url(#maskFR)">
      <rect width="24" height="24" fill="white" />
      <path fillRule="evenodd" clipRule="evenodd" d="M0 12C0 5.37258 5.37258 0 12 0V24C5.37258 24 0 18.6274 0 12Z" fill="#00267F" />
      <path fillRule="evenodd" clipRule="evenodd" d="M12 0H24C24 0 24 5.37258 24 12C24 18.6274 24 24 24 24H12V0Z" fill="#F31830" />
      <rect x="8" width="8" height="24" fill="white" />
    </g>
  </svg>
);

const CustomSelect = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="custom-select-container" ref={containerRef}>
      <div className="custom-select-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="select-value">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="select-icon">{selectedOption.icon}</span>}
              {selectedOption.label}
            </>
          ) : 'Select...'}
        </div>
        <span className={`material-symbols-outlined select-arrow ${isOpen ? 'open' : ''}`}>expand_more</span>
      </div>
      {isOpen && (
        <div className="custom-select-options">
          {options.map((option) => (
            <div
              key={option.value}
              className={`custom-select-option ${value === option.value ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.icon && <span className="select-icon">{option.icon}</span>}
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ... (imports)

const Settings = () => {
  const { t, language, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState('general');
  const defaultSettings = {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    currency: 'usd',
    notifications: {
      push: true,
      email: true,
      sms: false,
      emailFreq: 'daily',
      appUpdates: { viewed: true, interview: true, status: true },
      jobAlerts: { newMatches: true, company: false },
      community: { achievements: true },
      quietHours: { enabled: false, start: '22:00', end: '08:00' }
    }
  };

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('userSettings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'system');

  // Apply theme; when on system, mirror OS preference and keep listening to changes
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const resolveTheme = (val) => {
      if (val === 'system') return media.matches ? 'dark' : 'light';
      return val;
    };

    const apply = (val) => {
      root.setAttribute('data-theme', resolveTheme(val));
    };

    apply(theme);

    if (theme === 'system') {
      const listener = () => apply('system');
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme]);


  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateNestedSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const updateNotificationSubSetting = (subCategory, key, value) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [subCategory]: {
          ...prev.notifications[subCategory],
          [key]: value
        }
      }
    }));
  };

  const handleSave = () => {
    localStorage.setItem('userSettings', JSON.stringify(settings));
    // Simple feedback for all save buttons
    const btns = document.querySelectorAll('.btn-save, .btn-primary');
    btns.forEach(btn => {
      if (btn.innerText.includes(t('settings-save'))) {
        const originalText = btn.innerText;
        btn.innerText = 'Saved!';
        btn.style.backgroundColor = '#22c55e';
        btn.style.borderColor = '#22c55e';
        setTimeout(() => {
          btn.innerText = originalText;
          btn.style.backgroundColor = '';
          btn.style.borderColor = '';
        }, 2000);
      }
    });
  };


  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      setSettings(defaultSettings);
      setTheme('system');
      changeLanguage('fr'); // Default language
      localStorage.setItem('app-theme', 'system');
      localStorage.setItem('userSettings', JSON.stringify(defaultSettings));
      window.location.reload(); // Reload to ensure all global states (like language context) catch up cleanly
    }
  };

  const languageOptions = [
    { value: 'en', label: 'English (United States)', icon: <USFlag /> },
    { value: 'fr', label: 'French (Français)', icon: <FRFlag /> },
  ];

  const dockItems = [
    { icon: <span className="material-symbols-outlined">tune</span>, label: t('dock-general'), isActive: activeTab === 'general', onClick: () => setActiveTab('general') },
    { icon: <span className="material-symbols-outlined">security</span>, label: t('dock-security'), isActive: activeTab === 'security', onClick: () => setActiveTab('security') },
    { icon: <span className="material-symbols-outlined">notifications</span>, label: t('dock-notifications'), isActive: activeTab === 'notifications', onClick: () => setActiveTab('notifications') },
  ];

  return (
    <div className="settings-page-container">
      <div className="settings-header-wrapper">
        <div className="settings-header-inner">
          <div>
            <h1 className="settings-page-title">{t('settings-title')}</h1>
            <p className="settings-page-desc">{t('settings-subtitle')}</p>
          </div>
          <div className="settings-header-actions">
            <button className="btn-reset" onClick={handleReset}>
              <span className="material-symbols-outlined">restore</span>
              {t('settings-reset')}
            </button>
            <button className="btn-save" onClick={handleSave}>
              {t('settings-save')}
            </button>
          </div>
        </div>
        <Dock
          items={dockItems}
          panelHeight={68}
          baseWidth={140}
          baseHeight={48}
          magnification={1.05} // Subtle magnification
        />
      </div>


      <div className="settings-content-wrapper animate-fade-in">
        {activeTab === 'general' && (
          <div className="settings-grid">
            {/* Appearance Section */}
            <div className="settings-card full-width">
              <div className="settings-card-header">
                <span className="material-symbols-outlined text-primary">palette</span>
                <h2>{t('settings-theme-title')}</h2>
              </div>
              <p className="settings-card-desc">Customize your visual experience.</p>

              <div className="theme-selector-grid">
                <label className="theme-option">
                  <input type="radio" name="theme" value="system" checked={theme === 'system'} onChange={() => handleThemeChange('system')} className="hidden" />
                  <div className="theme-preview system">
                    <span className="material-symbols-outlined">desktop_windows</span>
                  </div>
                  <span className="theme-label">{t('settings-theme-system')}</span>
                </label>
                <label className="theme-option">
                  <input type="radio" name="theme" value="light" checked={theme === 'light'} onChange={() => handleThemeChange('light')} className="hidden" />
                  <div className="theme-preview light">
                    <div className="preview-nav"></div>
                    <div className="preview-sidebar"></div>
                    <div className="preview-content"></div>
                  </div>
                  <span className="theme-label">{t('settings-theme-light')}</span>
                </label>
                <label className="theme-option">
                  <input type="radio" name="theme" value="dark" checked={theme === 'dark'} onChange={() => handleThemeChange('dark')} className="hidden" />
                  <div className="theme-preview dark">
                    <div className="preview-nav"></div>
                    <div className="preview-sidebar"></div>
                    <div className="preview-content"></div>
                  </div>
                  <span className="theme-label">{t('settings-theme-dark')}</span>
                </label>
              </div>
            </div>

            {/* Language Section */}
            <div className="settings-card">
              <div className="settings-card-header">
                <span className="material-symbols-outlined text-secondary">language</span>
                <h2>{t('settings-lang-title')}</h2>
              </div>
              <p className="settings-card-desc">{t('settings-lang-desc')}</p>

              <div className="settings-input-wrapper">
                <CustomSelect
                  value={language}
                  onChange={changeLanguage}
                  options={languageOptions}
                />
              </div>
            </div>

            {/* Currency Section */}
            <div className="settings-card">
              <div className="settings-card-header">
                <span className="material-symbols-outlined text-primary">payments</span>
                <h2>{t('settings-currency-title')}</h2>
              </div>
              <p className="settings-card-desc">{t('settings-currency-desc')}</p>

              <div className="settings-input-wrapper">
                <select
                  className="settings-select"
                  value={settings.currency}
                  onChange={(e) => updateSetting('currency', e.target.value)}
                >
                  <option value="usd">$ USD (United States Dollar)</option>
                  <option value="eur">€ EUR (Euro)</option>
                  <option value="gbp">£ GBP (British Pound)</option>
                </select>
                <div className="select-arrow">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </div>

            {/* Regional Section */}
            <div className="settings-card full-width">
              <div className="settings-card-header">
                <span className="material-symbols-outlined text-primary">public</span>
                <h2>{t('settings-regional-title')}</h2>
              </div>
              <p className="settings-card-desc">{t('settings-regional-desc')}</p>

              <div className="regional-grid">
                <div>
                  <span className="group-label">{t('settings-date-format')}</span>
                  <div className="radio-options">
                    <label className="radio-card">
                      <div className="radio-check">
                        <input
                          type="radio"
                          name="dateFormat"
                          checked={settings.dateFormat === 'DD/MM/YYYY'}
                          onChange={() => updateSetting('dateFormat', 'DD/MM/YYYY')}
                        />
                        <span>DD/MM/YYYY</span>
                      </div>
                      <span className="radio-hint">31/12/2024</span>
                    </label>
                    <label className="radio-card">
                      <div className="radio-check">
                        <input
                          type="radio"
                          name="dateFormat"
                          checked={settings.dateFormat === 'MM/DD/YYYY'}
                          onChange={() => updateSetting('dateFormat', 'MM/DD/YYYY')}
                        />
                        <span>MM/DD/YYYY</span>
                      </div>
                      <span className="radio-hint">12/31/2024</span>
                    </label>
                  </div>
                </div>
                <div>
                  <span className="group-label">{t('settings-time-format')}</span>
                  <div className="radio-options">
                    <label className="radio-card">
                      <div className="radio-check">
                        <input
                          type="radio"
                          name="timeFormat"
                          checked={settings.timeFormat === '24h'}
                          onChange={() => updateSetting('timeFormat', '24h')}
                        />
                        <span>{t('settings-24h')}</span>
                      </div>
                      <span className="radio-hint">14:30</span>
                    </label>
                    <label className="radio-card">
                      <div className="radio-check">
                        <input
                          type="radio"
                          name="timeFormat"
                          checked={settings.timeFormat === '12h'}
                          onChange={() => updateSetting('timeFormat', '12h')}
                        />
                        <span>{t('settings-12h')}</span>
                      </div>
                      <span className="radio-hint">02:30 PM</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab CONTENT (Same as before) */}
        {activeTab === 'security' && (
          <div className="settings-grid">
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Login Credentials */}
              <div className="settings-card">
                <div className="settings-card-header" style={{ marginBottom: '0.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--dashboard-border)' }}>
                  <div className="p-2 bg-primary/10 rounded-lg text-primary" style={{ background: 'rgba(137, 90, 246, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--dashboard-accent)' }}>
                    <span className="material-symbols-outlined">lock</span>
                  </div>
                  <h2 style={{ fontSize: '1.1rem' }}>{t('security-credentials-title')}</h2>
                </div>

                <div className="credentials-list">
                  <div className="credential-item">
                    <div className="credential-info">
                      <p className="credential-label">{t('security-email')}</p>
                      <div className="flex-gap-2">
                        <span className="credential-value">yassine@example.com</span>
                        <span className="badge-verified">{t('security-verified')}</span>
                      </div>
                    </div>
                    <button className="btn-link">{t('security-change')}</button>
                  </div>
                  <div className="divider"></div>
                  <div className="credential-item">
                    <div className="credential-info">
                      <p className="credential-label">{t('security-password')}</p>
                      <div className="flex-gap-2">
                        <span className="credential-value" style={{ letterSpacing: '0.2em', fontFamily: 'monospace' }}>••••••••••••••••</span>
                      </div>
                      <span className="credential-hint">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
                        {t('security-strong')}
                      </span>
                    </div>
                    <button className="btn-link">{t('security-update')}</button>
                  </div>
                </div>
              </div>

              {/* 2FA */}
              <div className="settings-card">
                <div className="settings-card-header" style={{ justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--dashboard-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: '#ec4899', display: 'flex' }}>
                      <span className="material-symbols-outlined">verified_user</span>
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.1rem', marginBottom: 0 }}>{t('security-2fa-title')}</h2>
                      <p className="settings-card-desc" style={{ marginLeft: 0, fontSize: '0.8rem' }}>{t('security-2fa-desc')}</p>
                    </div>
                  </div>
                  <div className="toggle-wrapper">
                    {/* Native toggle can be used here or custom */}
                    <input type="checkbox" className="toggle-input" defaultChecked />
                  </div>
                </div>

                <div className="tfa-section">
                  <div className="tfa-status" style={{ background: 'rgba(137, 90, 246, 0.05)', border: '1px solid rgba(137, 90, 246, 0.3)' }}>
                    <div className="tfa-icon-wrapper">
                      <span className="material-symbols-outlined text-primary">smartphone</span>
                      <div>
                        <span className="tfa-method">{t('security-auth-app')}</span>
                        <span className="tfa-desc">Google Auth, Authy, etc.</span>
                      </div>
                    </div>
                    <span className="badge-active">{t('security-active')}</span>
                  </div>
                  <div className="tfa-status" style={{ background: 'transparent', border: '1px solid var(--dashboard-border)' }}>
                    <div className="tfa-icon-wrapper">
                      <span className="material-symbols-outlined" style={{ color: 'var(--dashboard-muted)' }}>sms</span>
                      <div>
                        <span className="tfa-method">{t('security-sms')}</span>
                        <span className="tfa-desc">+1 (555) ***-**89</span>
                      </div>
                    </div>
                    <button className="btn-link" style={{ fontSize: '0.8rem' }}>{t('security-setup')}</button>
                  </div>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="settings-card">
                <div className="settings-card-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--dashboard-border)' }}>
                  <h2 style={{ fontSize: '1.1rem', marginLeft: '0.25rem' }}>{t('security-sessions-title')}</h2>
                </div>
                <div className="session-list">
                  <div className="session-item">
                    <span className="material-symbols-outlined session-icon">laptop_mac</span>
                    <div className="session-info">
                      <span className="session-device">Macbook Pro 16" <span className="badge-green">{t('security-current')}</span></span>
                      <span className="session-location">San Francisco, US • Chrome • Active now</span>
                    </div>
                  </div>
                  <div className="divider"></div>
                  <div className="session-item" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <span className="material-symbols-outlined session-icon">smartphone</span>
                      <div className="session-info">
                        <span className="session-device">iPhone 14 Pro</span>
                        <span className="session-location">San Francisco, US • App • 2 hours ago</span>
                      </div>
                    </div>
                    <button className="btn-link" style={{ color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.75rem' }}>{t('security-revoke')}</button>
                  </div>
                </div>
              </div>

              {/* Connected Accounts - NEW */}
              <div className="settings-card">
                <div className="settings-card-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--dashboard-border)' }}>
                  <h2 style={{ fontSize: '1.1rem', marginLeft: '0.25rem' }}>{t('security-connected-title')}</h2>
                </div>
                <div className="connected-accounts-grid">
                  {/* Google */}
                  <div className="connected-account-card">
                    <div className="account-icon text-blue">G</div>
                    <div>
                      <p className="account-name">Google</p>
                      <p className="account-status text-green">{t('security-connected')}</p>
                    </div>
                    <button className="btn-disconnect">{t('security-disconnect')}</button>
                  </div>
                  {/* LinkedIn */}
                  <div className="connected-account-card">
                    <div className="account-icon bg-linkedin">in</div>
                    <div>
                      <p className="account-name">LinkedIn</p>
                      <p className="account-status text-green">{t('security-connected')}</p>
                    </div>
                    <button className="btn-disconnect">{t('security-disconnect')}</button>
                  </div>
                  {/* GitHub */}
                  <div className="connected-account-card opacity-70">
                    <div className="account-icon bg-github"><span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>code</span></div>
                    <div>
                      <p className="account-name">GitHub</p>
                      <p className="account-status text-muted">{t('security-not-connected')}</p>
                    </div>
                    <button className="btn-connect">{t('security-connect')}</button>
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Privacy Controls - NEW */}
              <div className="settings-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="privacy-header">
                  <span className="material-symbols-outlined">visibility</span>
                  <h3>{t('security-privacy-title')}</h3>
                </div>
                <div className="privacy-options">
                  <p className="privacy-desc" style={{ fontSize: '0.85rem' }}>{t('security-privacy-desc')}</p>

                  <label className="privacy-option selected">
                    <input type="radio" name="privacy" className="privacy-radio" defaultChecked />
                    <div className="privacy-label-group">
                      <span className="privacy-title">{t('security-privacy-public')}</span>
                      <span className="privacy-desc">{t('security-privacy-public-desc')}</span>
                    </div>
                  </label>

                  <label className="privacy-option">
                    <input type="radio" name="privacy" className="privacy-radio" />
                    <div className="privacy-label-group">
                      <span className="privacy-title">{t('security-privacy-recruiters')}</span>
                      <span className="privacy-desc">{t('security-privacy-recruiters-desc')}</span>
                    </div>
                  </label>

                  <label className="privacy-option">
                    <input type="radio" name="privacy" className="privacy-radio" />
                    <div className="privacy-label-group">
                      <span className="privacy-title">{t('security-privacy-private')}</span>
                      <span className="privacy-desc">{t('security-privacy-private-desc')}</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Export Data - NEW */}
              <div className="settings-card data-card">
                <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('security-export-title')}</h3>
                <p className="privacy-desc">{t('security-export-desc')}</p>
                <button className="btn-outline">
                  <span className="material-symbols-outlined">download</span>
                  {t('security-download')}
                </button>
              </div>

              {/* Delete Account - NEW */}
              <div className="settings-card data-card delete-card">
                <h3 className="text-danger" style={{ fontSize: '1rem', margin: 0 }}>{t('security-delete-title')}</h3>
                <p className="text-danger-muted" style={{ fontSize: '0.85rem' }}>{t('security-delete-desc')}</p>
                <button className="btn-danger">{t('security-delete-btn')}</button>
              </div>

            </div>
          </div>
        )}

        {/* Notifications Tab CONTENT (Same as before) */}
        {activeTab === 'notifications' && (
          <div className="settings-notifications-wrapper">
            <div className="notif-grid">
              {/* LEFT COLUMN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Notification Channels */}
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-title-row">
                      <div className="notif-icon-box primary">
                        <span className="material-symbols-outlined">cell_tower</span>
                      </div>
                      <h3>{t('notif-channels-title')}</h3>
                    </div>
                    <p className="notif-card-desc">{t('notif-channels-desc')}</p>
                  </div>

                  <div className="notif-content">
                    <div className="notif-item-row">
                      <div className="notif-info">
                        <span className="notif-label">{t('notif-push')}</span>
                        <span className="notif-subtext">{t('notif-push-desc')}</span>
                      </div>
                      <label className="notif-toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications.push}
                          onChange={(e) => updateNestedSetting('notifications', 'push', e.target.checked)}
                        />
                        <span className="notif-slider"></span>
                      </label>
                    </div>

                    <div className="notif-item-row">
                      <div className="notif-info">
                        <span className="notif-label">{t('notif-email')}</span>
                        <span className="notif-subtext">{t('notif-email-desc')}</span>
                      </div>
                      <label className="notif-toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications.email}
                          onChange={(e) => updateNestedSetting('notifications', 'email', e.target.checked)}
                        />
                        <span className="notif-slider"></span>
                      </label>
                    </div>

                    <div className="notif-item-row">
                      <div className="notif-info">
                        <span className="notif-label">{t('notif-sms')}</span>
                        <span className="notif-subtext">{t('notif-sms-desc')}</span>
                      </div>
                      <label className="notif-toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications.sms}
                          onChange={(e) => updateNestedSetting('notifications', 'sms', e.target.checked)}
                        />
                        <span className="notif-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="email-freq-section">
                    <p className="freq-title">{t('notif-freq-title')}</p>
                    <div className="freq-options">
                      <label className="freq-radio">
                        <input
                          type="radio"
                          name="email-freq"
                          checked={settings.notifications.emailFreq === 'realtime'}
                          onChange={() => updateNestedSetting('notifications', 'emailFreq', 'realtime')}
                        />
                        <span>{t('notif-freq-realtime')}</span>
                      </label>
                      <label className="freq-radio">
                        <input
                          type="radio"
                          name="email-freq"
                          checked={settings.notifications.emailFreq === 'daily'}
                          onChange={() => updateNestedSetting('notifications', 'emailFreq', 'daily')}
                        />
                        <span>{t('notif-freq-daily')}</span>
                      </label>
                      <label className="freq-radio">
                        <input
                          type="radio"
                          name="email-freq"
                          checked={settings.notifications.emailFreq === 'weekly'}
                          onChange={() => updateNestedSetting('notifications', 'emailFreq', 'weekly')}
                        />
                        <span>{t('notif-freq-weekly')}</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Notification Categories */}
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-title-row">
                      <div className="notif-icon-box secondary">
                        <span className="material-symbols-outlined">tune</span>
                      </div>
                      <h3>{t('notif-cats-title')}</h3>
                    </div>
                    <p className="notif-card-desc">{t('notif-cats-desc')}</p>
                  </div>

                  <div className="notif-content">
                    {/* Application Updates */}
                    <div className="cat-group">
                      <div className="cat-header">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>work</span>
                        {t('notif-cat-app')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="notif-item-row">
                          <div className="notif-info">
                            <span className="notif-label">{t('notif-app-viewed')}</span>
                            <span className="notif-subtext">{t('notif-app-viewed-desc')}</span>
                          </div>
                          <label className="notif-toggle">
                            <input
                              type="checkbox"
                              checked={settings.notifications.appUpdates.viewed}
                              onChange={(e) => updateNotificationSubSetting('appUpdates', 'viewed', e.target.checked)}
                            />
                            <span className="notif-slider"></span>
                          </label>
                        </div>
                        <div className="notif-item-row">
                          <div className="notif-info">
                            <span className="notif-label">{t('notif-interview')}</span>
                            <span className="notif-subtext">{t('notif-interview-desc')}</span>
                          </div>
                          <label className="notif-toggle">
                            <input
                              type="checkbox"
                              checked={settings.notifications.appUpdates.interview}
                              onChange={(e) => updateNotificationSubSetting('appUpdates', 'interview', e.target.checked)}
                            />
                            <span className="notif-slider"></span>
                          </label>
                        </div>
                        <div className="notif-item-row">
                          <div className="notif-info">
                            <span className="notif-label">{t('notif-status')}</span>
                            <span className="notif-subtext">{t('notif-status-desc')}</span>
                          </div>
                          <label className="notif-toggle">
                            <input
                              type="checkbox"
                              checked={settings.notifications.appUpdates.status}
                              onChange={(e) => updateNotificationSubSetting('appUpdates', 'status', e.target.checked)}
                            />
                            <span className="notif-slider"></span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="divider"></div>

                    {/* Job Alerts */}
                    <div className="cat-group">
                      <div className="cat-header">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>notifications_active</span>
                        {t('notif-cat-jobs')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="notif-item-row">
                          <div className="notif-info">
                            <span className="notif-label">{t('notif-jobs-new')}</span>
                            <span className="notif-subtext">{t('notif-jobs-new-desc')}</span>
                          </div>
                          <label className="notif-toggle">
                            <input
                              type="checkbox"
                              checked={settings.notifications.jobAlerts.newMatches}
                              onChange={(e) => updateNotificationSubSetting('jobAlerts', 'newMatches', e.target.checked)}
                            />
                            <span className="notif-slider"></span>
                          </label>
                        </div>
                        <div className="notif-item-row">
                          <div className="notif-info">
                            <span className="notif-label">{t('notif-company')}</span>
                            <span className="notif-subtext">{t('notif-company-desc')}</span>
                          </div>
                          <label className="notif-toggle">
                            <input
                              type="checkbox"
                              checked={settings.notifications.jobAlerts.company}
                              onChange={(e) => updateNotificationSubSetting('jobAlerts', 'company', e.target.checked)}
                            />
                            <span className="notif-slider"></span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="divider"></div>

                    {/* Community */}
                    <div className="cat-group">
                      <div className="cat-header">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>emoji_events</span>
                        {t('notif-cat-community')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="notif-item-row">
                          <div className="notif-info">
                            <span className="notif-label">{t('notif-achievement')}</span>
                            <span className="notif-subtext">{t('notif-achievement-desc')}</span>
                          </div>
                          <label className="notif-toggle">
                            <input
                              type="checkbox"
                              checked={settings.notifications.community.achievements}
                              onChange={(e) => updateNotificationSubSetting('community', 'achievements', e.target.checked)}
                            />
                            <span className="notif-slider"></span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Quiet Hours */}
                <div className="notif-card">
                  <div className="notif-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div className="notif-icon-box indigo">
                        <span className="material-symbols-outlined">bedtime</span>
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dashboard-text)' }}>{t('notif-quiet-title')}</h3>
                        <p className="notif-subtext">{t('notif-quiet-desc')}</p>
                      </div>
                    </div>

                    <div className="notif-item-row" style={{ marginBottom: '1rem' }}>
                      <span className="notif-label" style={{ fontSize: '0.9rem' }}>{t('notif-quiet-enable')}</span>
                      <label className="notif-toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications.quietHours.enabled}
                          onChange={(e) => updateNotificationSubSetting('quietHours', 'enabled', e.target.checked)}
                        />
                        <span className="notif-slider"></span>
                      </label>
                    </div>

                    <div className={`time-inputs ${!settings.notifications.quietHours.enabled ? 'disabled' : ''}`}>
                      <div className="time-field">
                        <label>{t('notif-quiet-from')}</label>
                        <input
                          type="time"
                          value={settings.notifications.quietHours.start}
                          onChange={(e) => updateNotificationSubSetting('quietHours', 'start', e.target.value)}
                        />
                      </div>
                      <div className="time-field">
                        <label>{t('notif-quiet-to')}</label>
                        <input
                          type="time"
                          value={settings.notifications.quietHours.end}
                          onChange={(e) => updateNotificationSubSetting('quietHours', 'end', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="quiet-info">
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>info</span>
                      {t('notif-quiet-info')}
                    </div>
                  </div>
                </div>

                {/* Troubleshoot */}
                <div className="troubleshoot-card">
                  <div className="troubleshoot-blur"></div>
                  <div className="troubleshoot-content">
                    <h3 className="img troubleshoot-title">{t('notif-troubleshoot')}</h3>
                    <p className="notif-subtext" style={{ marginBottom: '1rem' }}>{t('notif-troubleshoot-desc')}</p>
                    <button className="troubleshoot-btn">
                      <span className="material-symbols-outlined">send</span>
                      {t('notif-test-btn')}
                    </button>
                  </div>
                </div>

                {/* Links */}
                <div className="quick-links">
                  <div className="quick-link-item">
                    <div className="ql-left">
                      <span className="material-symbols-outlined ql-icon">phonelink_setup</span>
                      <span className="ql-text">{t('notif-manage-devices')}</span>
                    </div>
                    <span className="material-symbols-outlined ql-icon" style={{ fontSize: '1rem' }}>arrow_forward_ios</span>
                  </div>
                  <div className="quick-link-item">
                    <div className="ql-left">
                      <span className="material-symbols-outlined ql-icon">unsubscribe</span>
                      <span className="ql-text">{t('notif-unsubscribe')}</span>
                    </div>
                    <span className="material-symbols-outlined ql-icon" style={{ fontSize: '1rem' }}>arrow_forward_ios</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
