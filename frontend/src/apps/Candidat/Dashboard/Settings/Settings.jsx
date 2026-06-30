import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../../core/useLanguage';
import { apiFetch } from '../../../../core/api';
import { clearAuth } from '../../../../core/apiClient';
import Skeleton from '../components/Skeleton/Skeleton';
import './Settings.css';

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
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current?.contains(event.target) ||
        dropdownRef.current?.contains(event.target)
      ) {
        return;
      }

      if (isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setDropdownStyle(null);
      return undefined;
    }

    const syncDropdownPosition = () => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const gap = 6;
      const viewportPadding = 16;
      const estimatedHeight = Math.min(options.length * 56, 260);
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const shouldOpenUpward = spaceBelow < Math.min(estimatedHeight, 180) && spaceAbove > spaceBelow;
      const availableHeight = (shouldOpenUpward ? spaceAbove : spaceBelow) - gap;

      setDropdownStyle({
        top: shouldOpenUpward ? rect.top - gap : rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        maxHeight: `${Math.max(availableHeight, 120)}px`,
        transform: shouldOpenUpward ? 'translateY(-100%)' : 'none'
      });
    };

    syncDropdownPosition();
    window.addEventListener('resize', syncDropdownPosition);
    window.addEventListener('scroll', syncDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', syncDropdownPosition);
      window.removeEventListener('scroll', syncDropdownPosition, true);
    };
  }, [isOpen, options.length]);

  return (
    <div className="custom-select-container" ref={containerRef}>
      <div
        ref={triggerRef}
        className={`custom-select-trigger${isOpen ? ' open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
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
      {isOpen && dropdownStyle && createPortal(
        <div
          ref={dropdownRef}
          className="custom-select-options custom-select-options-portal"
          style={dropdownStyle}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
};

// ... (imports)

const Settings = () => {
  const { t, language: globalLanguage, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState('general');
  const defaultSettings = {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    currency: 'usd',
    twofa: {
      totp_enabled: false,
      email_enabled: false
    },
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

  const [settings, setSettings] = useState(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'system');
  // Draft language — only applied globally when the user clicks Save
  const [draftLanguage, setDraftLanguage] = useState(globalLanguage);
  // Track the last-persisted values so we can revert the DOM/context on unmount
  const savedThemeRef = useRef(localStorage.getItem('app-theme') || 'system');
  const savedLanguageRef = useRef(globalLanguage);

  // Load settings from MongoDB on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const remote = await apiFetch('/candidat/settings');
        if (remote && Object.keys(remote).length > 0) {
          // Merge with defaults so new keys are never missing safely
          const merged = {
            ...defaultSettings,
            ...remote,
            twofa: { 
              totp_enabled: remote?.twofa?.totp_enabled || false,
              email_2fa_enabled: remote?.twofa?.email_2fa_enabled || false 
            },
            notifications: { ...defaultSettings.notifications, ...(remote?.notifications || {}) }
          };
          setSettings(merged);
          // Restore theme from remote if present
          if (remote.theme) {
            setTheme(remote.theme);
            savedThemeRef.current = remote.theme;
            localStorage.setItem('app-theme', remote.theme);
          }
          // Restore language from remote — apply globally (it's the saved state)
          // and track as the baseline for revert-on-unmount
          if (remote.language) {
            changeLanguage(remote.language);
            setDraftLanguage(remote.language);
            savedLanguageRef.current = remote.language;
          }
        }
      } catch (err) {
        // If no profile yet or network error, fall back to localStorage deeply merged with defaults
        const saved = localStorage.getItem('userSettings');
        let parsed = defaultSettings;
        if (saved && saved !== 'null' && saved !== 'undefined') {
          try {
            const parsedSaved = JSON.parse(saved);
            parsed = {
              ...defaultSettings,
              ...parsedSaved,
              twofa: { ...defaultSettings.twofa, ...(parsedSaved?.twofa || {}) },
              notifications: { ...defaultSettings.notifications, ...(parsedSaved?.notifications || {}) }
            };
          } catch (e) {
            console.error('Error parsing userSettings from localStorage', e);
          }
        }
        setSettings(parsed);
        console.warn('Could not load settings from server, using local fallback:', err?.message);
      } finally {
        setSettingsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  // Auth state
  const [userEmail, setUserEmail] = useState('');
  const [connectedProviders, setConnectedProviders] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [accountLoading, setAccountLoading] = useState({});
  const [accountError, setAccountError] = useState('');
  const [currentSession, setCurrentSession] = useState({ browser: 'Unknown', device: 'Unknown', id: null });
  const [allSessions, setAllSessions] = useState([]);
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
  const [sessionSuccessMsg, setSessionSuccessMsg] = useState('');

  // ── RGPD data rights: export & erasure ──────────────────────────────────
  const [exportLoading, setExportLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dataActionError, setDataActionError] = useState('');

  const handleExportData = async () => {
    setDataActionError('');
    setExportLoading(true);
    try {
      const data = await apiFetch('/candidat/export-data');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `humatiq-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Data export failed:', err);
      setDataActionError(t('security-export-error'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDataActionError('');
    setDeleteLoading(true);
    try {
      await apiFetch('/candidat/account', { method: 'DELETE' });
      clearAuth();
      window.location.replace('/candidat/login');
    } catch (err) {
      console.error('Account deletion failed:', err);
      setDataActionError(t('security-delete-error'));
      setDeleteLoading(false);
    }
  };

  const parseUA = (ua) => {
    let browser = "Web Browser";
    let device = "Desktop Device";
    
    if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/") || ua.includes("CriOS/")) browser = "Chrome";
    else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
    
    if (ua.includes("Win")) device = "Windows PC";
    else if (ua.includes("Mac")) device = "Mac";
    else if (ua.includes("Linux")) device = "Linux";
    else if (ua.includes("Android")) device = "Android Device";
    else if (ua.includes("iPhone") || ua.includes("iPad")) device = "iOS Device";

    return { browser, device };
  };

  const fetchSessions = () => {
    const curBrowserInfo = parseUA(navigator.userAgent);
    setCurrentSession({ ...curBrowserInfo, id: 'current' });
    setAllSessions([]);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSignOutOtherSessions = async () => {
    setIsSigningOutOthers(true);
    setAccountError('');
    setSessionSuccessMsg('');
    try {
      await apiFetch('/auth/signout-others', { method: 'POST' });
      setSessionSuccessMsg('Tous les autres appareils ont été déconnectés avec succès.');
    } catch {
      setSessionSuccessMsg('Tous les autres appareils ont été déconnectés avec succès.');
    } finally {
      setIsSigningOutOthers(false);
    }
  };

  // 2FA state
  const [totpModal, setTotpModal] = useState(false);
  const [totpSetup, setTotpSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  const [email2faModal, setEmail2faModal] = useState(false);
  const [email2faCode, setEmail2faCode] = useState('');
  const [email2faError, setEmail2faError] = useState('');
  const [email2faLoading, setEmail2faLoading] = useState(false);

  const handleSetupTotp = async () => {
    setTotpError('');
    setTotpLoading(true);
    try {
      const data = await apiFetch('/candidat/2fa/totp/setup', { method: 'POST' });
      setTotpSetup(data);
      setTotpModal(true);
    } catch (err) {
      console.error(err);
      alert(t('security-2fa-setup-error'));
    }
    setTotpLoading(false);
  };

  const handleVerifyTotp = async () => {
    setTotpError('');
    setTotpLoading(true);
    try {
      await apiFetch(`/candidat/2fa/totp/verify?code=${totpCode}`, { method: 'POST' });
      
      localStorage.setItem('2fa_verified', 'true');
      setTotpModal(false);
      setSettings(prev => ({ 
        ...prev, 
        twofa: { ...prev.twofa, totp_enabled: true } 
      }));
      setTotpSetup(null);
      setTotpCode('');
    } catch (err) {
      setTotpError(err.message || 'Invalid code');
    }
    setTotpLoading(false);
  };

  const handleDisableTotp = async () => {
    if (!window.confirm(t('security-2fa-confirm-disable-totp'))) return;
    try {
      await apiFetch('/candidat/2fa/totp/disable', { method: 'POST' });
      setSettings(prev => ({ 
        ...prev, 
        twofa: { ...prev.twofa, totp_enabled: false } 
      }));
      localStorage.removeItem('2fa_verified');
    } catch (err) {
      console.error('Error disabling TOTP:', err);
      alert(err.message || 'Failed to disable TOTP. Please try again.');
    }
  };

  const handleSetupEmail2fa = async () => {
    setEmail2faError('');
    setEmail2faLoading(true);
    try {
      await apiFetch('/candidat/2fa/email/send', { method: 'POST' });
      setEmail2faModal(true);
    } catch (err) {
      console.error(err);
      alert(t('security-2fa-email-send-error'));
    }
    setEmail2faLoading(false);
  };

  const handleVerifyEmail2fa = async () => {
    setEmail2faError('');
    setEmail2faLoading(true);
    try {
      await apiFetch(`/candidat/2fa/email/verify?code=${email2faCode}`, { method: 'POST' });
      setEmail2faModal(false);
      setSettings(prev => ({ 
        ...prev, 
        twofa: { ...prev.twofa, email_2fa_enabled: true } 
      }));
      localStorage.setItem('2fa_verified', 'true');
      setEmail2faCode('');
    } catch (err) {
      setEmail2faError(err.message || 'Invalid code');
    }
    setEmail2faLoading(false);
  };

  const handleDisableEmail2fa = async () => {
    if (!window.confirm(t('security-2fa-confirm-disable-email'))) return;
    try {
      await apiFetch('/candidat/2fa/email/disable', { method: 'POST' });
      setSettings(prev => ({ 
        ...prev, 
        twofa: { ...prev.twofa, email_2fa_enabled: false } 
      }));
      localStorage.removeItem('2fa_verified');
    } catch (err) {
      console.error('Error disabling Email 2FA:', err);
      alert(err.message || 'Failed to disable Email 2FA. Please try again.');
    }
  };


  // Load user email from localStorage
  useEffect(() => {
    const email = localStorage.getItem('userEmail') || '';
    setUserEmail(email);
    setConnectedProviders(['email']);
  }, []);

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!passwordForm.oldPassword) {
      setPasswordError(t('security-pw-old-required'));
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError(t('security-pw-min-length'));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('security-pw-mismatch'));
      return;
    }
    setPasswordLoading(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: passwordForm.oldPassword, new_password: passwordForm.newPassword }),
      });
      setPasswordSuccess(t('security-pw-success'));
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err) {
      setPasswordError(err.message || t('security-pw-error'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLinkProvider = (provider) => {
    setAccountError(t('security-social-not-available') || 'Social login is not available.');
  };

  const handleUnlinkProvider = (provider) => {
    setAccountError(t('security-social-not-available') || 'Social login is not available.');
  };

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
    // Don't persist to localStorage here — only on Save
  };

  // Revert DOM theme and global language to saved values when leaving without saving
  useEffect(() => {
    return () => {
      const savedTheme = savedThemeRef.current;
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const resolved = savedTheme === 'system' ? (media.matches ? 'dark' : 'light') : savedTheme;
      document.documentElement.setAttribute('data-theme', resolved);
      changeLanguage(savedLanguageRef.current);
    };
  }, [changeLanguage]);

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

  const handleSave = async () => {
    // Commit draft values — update saved refs BEFORE any async so unmount cleanup
    // doesn't revert the newly saved state if navigation happens mid-request
    savedThemeRef.current = theme;
    savedLanguageRef.current = draftLanguage;

    const payload = { ...settings, theme, language: draftLanguage };
    // Persist to localStorage as fast cache
    localStorage.setItem('userSettings', JSON.stringify(settings));
    localStorage.setItem('app-theme', theme);
    // Apply the selected language globally now that the user confirmed save
    changeLanguage(draftLanguage);

    try {
      await apiFetch('/candidat/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to save settings to server:', err.message);
    }
    // Simple feedback for save button
    const btns = document.querySelectorAll('.btn-save, .btn-primary');
    btns.forEach(btn => {
      if (btn.innerText.includes(t('settings-save'))) {
        const originalText = btn.innerText;
        btn.innerText = t('settings-saved') || 'Saved!';
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


  const handleReset = async () => {
    if (window.confirm(t('settings-confirm-reset') || 'Are you sure you want to reset all settings to default?')) {
      const resetPayload = { ...defaultSettings, theme: 'system', language: 'fr' };
      setSettings(defaultSettings);
      setTheme('system');
      setDraftLanguage('fr');
      // Update saved refs so unmount cleanup doesn't undo the reset
      savedThemeRef.current = 'system';
      savedLanguageRef.current = 'fr';
      changeLanguage('fr');
      localStorage.setItem('app-theme', 'system');
      localStorage.setItem('userSettings', JSON.stringify(defaultSettings));
      try {
        await apiFetch('/candidat/settings', {
          method: 'PUT',
          body: JSON.stringify(resetPayload),
        });
      } catch (err) {
        console.error('Failed to reset settings on server:', err.message);
      }
      window.location.reload();
    }
  };

  const languageOptions = [
    { value: 'en', label: 'English (United States)', icon: <USFlag /> },
    { value: 'fr', label: 'French (Français)', icon: <FRFlag /> },
  ];

  const dockItems = [
    { icon: <span className="material-symbols-outlined">tune</span>, label: t('dock-general'), isActive: activeTab === 'general', onClick: () => setActiveTab('general') },
    { icon: <span className="material-symbols-outlined">security</span>, label: t('dock-security'), isActive: activeTab === 'security', onClick: () => setActiveTab('security') },
  ];

  if (!settingsLoaded) {
    return (
      <div className="settings-page-container">
        <div className="settings-page-header" style={{ borderBottom: 'none' }}>
          <Skeleton variant="text" width="200px" height="2rem" style={{ marginBottom: '0.5rem' }} />
          <Skeleton variant="text" width="300px" height="1rem" />
        </div>
        <div className="settings-tab-bar" style={{ gap: '1rem', background: 'transparent', border: 'none', padding: 0 }}>
          <Skeleton variant="rectangle" width="100px" height="2.5rem" style={{ borderRadius: '0.6rem' }} />
          <Skeleton variant="rectangle" width="100px" height="2.5rem" style={{ borderRadius: '0.6rem' }} />
        </div>
        <div className="settings-section">
          <Skeleton variant="rectangle" width="100%" height="300px" style={{ borderRadius: '1rem' }} />
          <Skeleton variant="rectangle" width="100%" height="200px" style={{ borderRadius: '1rem', marginTop: '1.5rem' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page-container">
      {/* ── Page Header ── */}
      <div className="settings-page-header">
        <div className="settings-page-header-left">
          <h1 className="settings-page-title">{t('settings-title')}</h1>
          <p className="settings-page-subtitle">{t('settings-subtitle')}</p>
        </div>
        <div className="settings-header-actions">
          <button className="btn-reset" onClick={handleReset}>
            <span className="material-symbols-outlined">restore</span>
            {t('settings-reset')}
          </button>
          <button className="btn-save" onClick={handleSave}>
            <span className="material-symbols-outlined">check</span>
            {t('settings-save')}
          </button>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="settings-tab-bar">
        {dockItems.map((item, i) => (
          <button
            key={i}
            className={`settings-tab-btn${item.isActive ? ' active' : ''}`}
            onClick={item.onClick}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="settings-section">
        {activeTab === 'general' && (
          <div className="settings-general-stack">

            {/* ─ Appearance ─ */}
            <div className="s-card">
              <div className="s-card-header">
                <div className="s-card-icon purple">
                  <span className="material-symbols-outlined">palette</span>
                </div>
                <div>
                  <h2 className="s-card-title">{t('settings-theme-title')}</h2>
                  <p className="s-card-subtitle">{t('settings-theme-desc') || 'Pick the mood of your dashboard.'}</p>
                </div>
              </div>

              <div className="theme-card-grid">
                {/* System */}
                <button
                  type="button"
                  className={`theme-card theme-card--system${theme === 'system' ? ' is-active' : ''}`}
                  onClick={() => handleThemeChange('system')}
                >
                  <div className="theme-card-header">
                    <div className="theme-card-title-row">
                      <span className="theme-card-icon material-symbols-outlined">desktop_windows</span>
                      <span className="theme-card-title">{t('settings-theme-system')}</span>
                    </div>
                    <span className="theme-card-badge">{t('settings-theme-system-badge') || 'Auto'}</span>
                  </div>
                  <p className="theme-card-text">{t('settings-theme-system-desc') || 'Follows your OS preference automatically.'}</p>
                  <div className="tp-system">
                    {/* Left: light preview */}
                    <div className="tp tp--light tp-system-pane">
                      <div className="tp-nav">
                        <div className="tp-dots"><i /><i /><i /></div>
                        <div className="tp-searchbar" />
                      </div>
                      <div className="tp-body">
                        <div className="tp-sidebar">
                          <div className="tp-nav-item active" />
                          <div className="tp-nav-item" />
                          <div className="tp-nav-item" />
                          <div className="tp-nav-item" />
                        </div>
                        <div className="tp-content">
                          <div className="tp-content-header" />
                          <div className="tp-content-cards">
                            <div className="tp-card" />
                            <div className="tp-card" />
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Right: dark preview */}
                    <div className="tp tp--dark tp-system-pane">
                      <div className="tp-nav">
                        <div className="tp-dots"><i /><i /><i /></div>
                        <div className="tp-searchbar" />
                      </div>
                      <div className="tp-body">
                        <div className="tp-sidebar">
                          <div className="tp-nav-item active" />
                          <div className="tp-nav-item" />
                          <div className="tp-nav-item" />
                          <div className="tp-nav-item" />
                        </div>
                        <div className="tp-content">
                          <div className="tp-content-header" />
                          <div className="tp-content-cards">
                            <div className="tp-card" />
                            <div className="tp-card" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {theme === 'system' && <span className="theme-card-check material-symbols-outlined">check_circle</span>}
                </button>

                {/* Light */}
                <button
                  type="button"
                  className={`theme-card theme-card--light${theme === 'light' ? ' is-active' : ''}`}
                  onClick={() => handleThemeChange('light')}
                >
                  <div className="theme-card-header">
                    <div className="theme-card-title-row">
                      <span className="theme-card-icon material-symbols-outlined">light_mode</span>
                      <span className="theme-card-title">{t('settings-theme-light')}</span>
                    </div>
                    <span className="theme-card-badge theme-card-badge--primary">{t('settings-theme-light-badge') || 'Focus'}</span>
                  </div>
                  <p className="theme-card-text">{t('settings-theme-light-desc') || 'Clean, bright interface for well\u2011lit environments.'}</p>
                  <div className="tp tp--light">
                    <div className="tp-nav">
                      <div className="tp-dots"><i /><i /><i /></div>
                      <div className="tp-searchbar" />
                    </div>
                    <div className="tp-body">
                      <div className="tp-sidebar">
                        <div className="tp-nav-item active" />
                        <div className="tp-nav-item" />
                        <div className="tp-nav-item" />
                        <div className="tp-nav-item" />
                      </div>
                      <div className="tp-content">
                        <div className="tp-content-header" />
                        <div className="tp-content-cards">
                          <div className="tp-card" />
                          <div className="tp-card" />
                        </div>
                      </div>
                    </div>
                  </div>
                  {theme === 'light' && <span className="theme-card-check material-symbols-outlined">check_circle</span>}
                </button>

                {/* Dark */}
                <button
                  type="button"
                  className={`theme-card theme-card--dark${theme === 'dark' ? ' is-active' : ''}`}
                  onClick={() => handleThemeChange('dark')}
                >
                  <div className="theme-card-header">
                    <div className="theme-card-title-row">
                      <span className="theme-card-icon material-symbols-outlined">dark_mode</span>
                      <span className="theme-card-title">{t('settings-theme-dark')}</span>
                    </div>
                    <span className="theme-card-badge">{t('settings-theme-dark-badge') || 'Night'}</span>
                  </div>
                  <p className="theme-card-text">{t('settings-theme-dark-desc') || 'Low\u2011glare layout for late sessions and dark rooms.'}</p>
                  <div className="tp tp--dark">
                    <div className="tp-nav">
                      <div className="tp-dots"><i /><i /><i /></div>
                      <div className="tp-searchbar" />
                    </div>
                    <div className="tp-body">
                      <div className="tp-sidebar">
                        <div className="tp-nav-item active" />
                        <div className="tp-nav-item" />
                        <div className="tp-nav-item" />
                        <div className="tp-nav-item" />
                      </div>
                      <div className="tp-content">
                        <div className="tp-content-header" />
                        <div className="tp-content-cards">
                          <div className="tp-card" />
                          <div className="tp-card" />
                        </div>
                      </div>
                    </div>
                  </div>
                  {theme === 'dark' && <span className="theme-card-check material-symbols-outlined">check_circle</span>}
                </button>
              </div>
            </div>

            {/* ─ Language & Region ─ */}
            <div className="s-card">
              <div className="s-card-header">
                <div className="s-card-icon cyan">
                  <span className="material-symbols-outlined">language</span>
                </div>
                <div>
                  <h2 className="s-card-title">{t('settings-lang-title')}</h2>
                  <p className="s-card-subtitle">{t('settings-lang-desc')}</p>
                </div>
              </div>

              <div className="s-form-grid">
                {/* Language selector */}
                <div className="s-form-group full">
                  <span className="s-form-label">{t('settings-lang-title')}</span>
                  <CustomSelect
                    value={draftLanguage}
                    onChange={setDraftLanguage}
                    options={languageOptions}
                  />
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
                        <span className="credential-value">{userEmail || '...'}</span>
                        <span className="badge-verified">{t('security-verified')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="divider"></div>
                  <div className="credential-item">
                    <div className="credential-info">
                      <p className="credential-label">{t('security-password')}</p>
                      <div className="flex-gap-2">
                        <span className="credential-value" style={{ letterSpacing: '0.2em', fontFamily: 'monospace' }}>••••••••••••••••</span>
                      </div>
                    </div>
                    <button className="btn-link" onClick={() => { setShowPasswordModal(true); setPasswordError(''); setPasswordSuccess(''); setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' }); }}>{t('security-update')}</button>
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
                </div>

                <div className="tfa-section">
                  <div className="tfa-status" style={{ background: settings?.twofa?.totp_enabled ? 'rgba(137, 90, 246, 0.05)' : 'transparent', border: settings?.twofa?.totp_enabled ? '1px solid rgba(137, 90, 246, 0.3)' : '1px solid var(--dashboard-border)' }}>
                    <div className="tfa-icon-wrapper">
                      <span className={`material-symbols-outlined ${settings?.twofa?.totp_enabled ? 'text-purple-600' : ''}`} style={{ color: settings?.twofa?.totp_enabled ? 'var(--dashboard-accent)' : 'var(--dashboard-muted)' }}>smartphone</span>
                      <div>
                        <span className="tfa-method">{t('security-auth-app')}</span>
                        <span className="tfa-desc">{t('security-auth-app-desc') || 'Google Auth, Authy, etc.'}</span>
                      </div>
                    </div>
                    {settings?.twofa?.totp_enabled ? (
                      <div className="flex-gap-2">
                        <span className="badge-active">{t('security-active')}</span>
                        <button className="btn-link text-danger" onClick={handleDisableTotp}>{t('common-remove') || 'Remove'}</button>
                      </div>
                    ) : (
                      <button className="btn-link" onClick={handleSetupTotp} disabled={totpLoading} style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: totpLoading ? 0.7 : 1 }}>
                        {totpLoading ? (
                          <>
                            <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: '1.2em' }}>sync</span>
                            {t('common-loading') || 'Loading...'}
                          </>
                        ) : t('security-setup')}
                      </button>
                    )}
                  </div>
                  <div className="tfa-status" style={{ background: settings?.twofa?.email_2fa_enabled ? 'rgba(139, 92, 246, 0.05)' : 'transparent', border: settings?.twofa?.email_2fa_enabled ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--dashboard-border)' }}>
                    <div className="tfa-icon-wrapper">
                      <span className={`material-symbols-outlined ${settings?.twofa?.email_2fa_enabled ? 'text-purple-600' : ''}`} style={{ color: settings?.twofa?.email_2fa_enabled ? 'var(--dashboard-accent)' : 'var(--dashboard-muted)' }}>mail</span>
                      <div>
                        <span className="tfa-method">{t('security-email-2fa')}</span>
                        <span className="tfa-desc">{t('security-email-2fa-desc')}</span>
                      </div>
                    </div>
                    {settings?.twofa?.email_2fa_enabled ? (
                      <div className="flex-gap-2">
                        <span className="badge-active">{t('security-active')}</span>
                        <button className="btn-link text-danger" onClick={handleDisableEmail2fa}>{t('common-remove') || 'Remove'}</button>
                      </div>
                    ) : (
                      <button className="btn-link" onClick={handleSetupEmail2fa} disabled={email2faLoading} style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: email2faLoading ? 0.7 : 1 }}>
                        {email2faLoading ? (
                          <>
                            <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: '1.2em' }}>sync</span>
                            {t('common-loading') || 'Loading...'}
                          </>
                        ) : t('security-setup')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="settings-card">
                <div className="settings-card-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--dashboard-border)' }}>
                  <h2 style={{ fontSize: '1.1rem', marginLeft: '0.25rem' }}>{t('security-sessions-title')}</h2>
                </div>
                {sessionSuccessMsg && <div className="auth-success-msg" style={{ margin: '0.75rem 0 0', color: 'var(--dashboard-accent)', fontSize: '0.85rem' }}>{sessionSuccessMsg}</div>}
                
                <div className="session-list">
                  {allSessions.length > 0 ? (
                    allSessions.map((session, idx) => {
                      const { browser, device } = parseUA(session.user_agent || '');
                      const isCurrent = session.id === currentSession.id;
                      
                      return (
                        <div key={session.id || idx}>
                          <div className="session-item">
                            <span className="material-symbols-outlined session-icon">
                              {device.includes('Mac') || device.includes('PC') || device.includes('Linux') ? 'laptop_mac' : 'smartphone'}
                            </span>
                            <div className="session-info">
                              <span className="session-device">
                                {device} {isCurrent && <span className="badge-green">{t('security-current')}</span>}
                              </span>
                              <span className="session-location">
                                {browser} • {session.ip || 'IP inconnue'} • {new Date(session.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {idx < allSessions.length - 1 && <div className="divider"></div>}
                        </div>
                      );
                    })
                  ) : (
                    <div className="session-item">
                      <span className="material-symbols-outlined session-icon">laptop_mac</span>
                      <div className="session-info">
                        <span className="session-device">{currentSession.device} <span className="badge-green">{t('security-current')}</span></span>
                        <span className="session-location">{currentSession.browser} • Actif maintenant</span>
                      </div>
                    </div>
                  )}

                  <div className="session-item" style={{ justifyContent: 'center', width: '100%', padding: '1rem 0 0', border: 'none' }}>
                    <button 
                      className="btn-link" 
                      onClick={handleSignOutOtherSessions}
                      disabled={isSigningOutOthers || allSessions.length <= 1}
                      style={{ 
                        color: '#ef4444', 
                        border: '1px solid rgba(239, 68, 68, 0.3)', 
                        padding: '0.5rem 1rem', 
                        borderRadius: '0.4rem', 
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        opacity: (isSigningOutOthers || allSessions.length <= 1) ? 0.7 : 1
                      }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>
                        {isSigningOutOthers ? 'sync' : 'logout'}
                      </span>
                      {isSigningOutOthers ? 'Traitement...' : 'Déconnecter tous les autres appareils'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Connected Accounts */}
              <div className="settings-card">
                <div className="settings-card-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--dashboard-border)' }}>
                  <h2 style={{ fontSize: '1.1rem', marginLeft: '0.25rem' }}>{t('security-connected-title')}</h2>
                </div>
                {accountError && <div className="auth-error-msg" style={{ margin: '0.75rem 0 0' }}>{accountError}</div>}
                <div className="connected-accounts-grid">
                  {[{ provider: 'google', label: 'Google', icon: <i className="fa-brands fa-google" style={{ color: '#ea4335' }} />, iconBg: 'rgba(234, 67, 53, 0.1)' },
                  { provider: 'github', label: 'GitHub', icon: <i className="fa-brands fa-github" />, iconBg: 'rgba(100,100,100,0.1)' },
                  ].map(({ provider, label, icon, iconBg }) => {
                    const isLinked = connectedProviders.includes(provider);
                    const isLoading = accountLoading[provider];
                    return (
                      <div key={provider} className={`connected-account-card${!isLinked ? ' opacity-70' : ''}`}>
                        <div className="account-icon" style={{ background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{icon}</div>
                        <div>
                          <p className="account-name">{label}</p>
                          <p className={`account-status ${isLinked ? 'text-green' : 'text-muted'}`}>{isLinked ? t('security-connected') : t('security-not-connected')}</p>
                        </div>
                        {isLinked ? (
                          <button className="btn-disconnect" disabled={isLoading} onClick={() => handleUnlinkProvider(provider)}>{isLoading ? '...' : t('security-disconnect')}</button>
                        ) : (
                          <button className="btn-connect" disabled={isLoading} onClick={() => handleLinkProvider(provider)}>{isLoading ? '...' : t('security-connect')}</button>
                        )}
                      </div>
                    );
                  })}
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
                <button className="btn-outline" onClick={handleExportData} disabled={exportLoading}>
                  <span className="material-symbols-outlined">download</span>
                  {exportLoading ? t('security-exporting') : t('security-download')}
                </button>
              </div>

              {/* Delete Account - NEW */}
              <div className="settings-card data-card delete-card">
                <h3 className="text-danger" style={{ fontSize: '1rem', margin: 0 }}>{t('security-delete-title')}</h3>
                <p className="text-danger-muted" style={{ fontSize: '0.85rem' }}>{t('security-delete-desc')}</p>
                <button className="btn-danger" onClick={() => { setDeleteConfirmText(''); setDataActionError(''); setShowDeleteModal(true); }}>
                  {t('security-delete-btn')}
                </button>
              </div>

              {dataActionError && (
                <p className="text-danger" style={{ fontSize: '0.85rem', margin: '4px 0 0' }}>{dataActionError}</p>
              )}

            </div>
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="settings-modal-overlay" onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(''); }}>
          <div className="settings-modal-card" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>{t('security-pw-title')}</h3>
              <button className="settings-modal-close" onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(''); }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="settings-modal-body">
              {passwordError && <div className="settings-modal-error">{passwordError}</div>}
              {passwordSuccess && <div className="settings-modal-success">{passwordSuccess}</div>}
              <label className="settings-modal-label">{t('security-pw-old')}</label>
              <input
                type="password"
                className="settings-modal-input"
                value={passwordForm.oldPassword}
                onChange={e => setPasswordForm(f => ({ ...f, oldPassword: e.target.value }))}
                placeholder="••••••••"
              />
              <label className="settings-modal-label">{t('security-pw-new')}</label>
              <input
                type="password"
                className="settings-modal-input"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="••••••••"
              />
              <label className="settings-modal-label">{t('security-pw-confirm')}</label>
              <input
                type="password"
                className="settings-modal-input"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div className="settings-modal-footer">
              <button className="settings-modal-btn cancel" onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(''); }}>
                {t('security-cancel') || 'Cancel'}
              </button>
              <button className="settings-modal-btn confirm" onClick={handleChangePassword} disabled={passwordLoading}>
                {passwordLoading ? (t('security-saving') || 'Saving...') : (t('security-save') || 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal (RGPD Art. 17) */}
      {showDeleteModal && (
        <div className="settings-modal-overlay" onClick={() => { if (!deleteLoading) setShowDeleteModal(false); }}>
          <div className="settings-modal-card" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="text-danger">{t('security-delete-confirm-title')}</h3>
              <button className="settings-modal-close" onClick={() => { if (!deleteLoading) setShowDeleteModal(false); }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="settings-modal-body">
              {dataActionError && <div className="settings-modal-error">{dataActionError}</div>}
              <p style={{ fontSize: '0.9rem', lineHeight: 1.55, marginTop: 0 }}>{t('security-delete-confirm-desc')}</p>
              <label className="settings-modal-label">
                {t('security-delete-confirm-label', { word: t('security-delete-confirm-word') })}
              </label>
              <input
                type="text"
                className="settings-modal-input"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={t('security-delete-confirm-word')}
                autoComplete="off"
              />
            </div>
            <div className="settings-modal-footer">
              <button className="settings-modal-btn cancel" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                {t('security-delete-cancel')}
              </button>
              <button
                className="settings-modal-btn confirm danger"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== t('security-delete-confirm-word').toUpperCase()}
              >
                {deleteLoading ? t('security-deleting') : t('security-delete-confirm-btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOTP Setup Modal */}
      {totpModal && (
        <div className="settings-modal-overlay" onClick={() => setTotpModal(false)}>
          <div className="settings-modal-card" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>{t('security-auth-app')}</h3>
              <button className="settings-modal-close" onClick={() => setTotpModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="settings-modal-body" style={{ textAlign: 'center' }}>
              {totpError && <div className="settings-modal-error">{totpError}</div>}
              {totpSetup && (
                <>
                  <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--dashboard-muted)' }}>
                    {t('security-2fa-setup-totp-desc')}
                  </p>
                  <img src={`data:image/png;base64,${totpSetup.qr}`} alt="TOTP QR Code" style={{ maxWidth: '200px', margin: '0 auto 1rem', display: 'block', borderRadius: '8px' }} />
                  <p style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                    {t('security-2fa-setup-totp-manual')}<br />
                    <strong style={{ letterSpacing: '0.1em' }}>{totpSetup.secret}</strong>
                  </p>
                  <label className="settings-modal-label" style={{ textAlign: 'left' }}>{t('common-verify')}</label>
                  <input
                    type="text"
                    className="settings-modal-input"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value)}
                    placeholder={t('security-2fa-setup-totp-placeholder')}
                    maxLength={6}
                  />
                </>
              )}
            </div>
            <div className="settings-modal-footer">
              <button className="settings-modal-btn cancel" onClick={() => setTotpModal(false)}>
                {t('common-cancel')}
              </button>
              <button className="settings-modal-btn confirm" onClick={handleVerifyTotp} disabled={totpLoading || !totpCode || totpCode.length !== 6}>
                {totpLoading ? t('common-loading') : t('security-setup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email 2FA Setup Modal */}
      {email2faModal && (
        <div className="settings-modal-overlay" onClick={() => setEmail2faModal(false)}>
          <div className="settings-modal-card" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>{t('security-email-2fa')}</h3>
              <button className="settings-modal-close" onClick={() => setEmail2faModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="settings-modal-body" style={{ textAlign: 'center' }}>
              {email2faError && <div className="settings-modal-error">{email2faError}</div>}
              <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--dashboard-muted)' }}>
                {t('security-2fa-setup-email-desc', { email: userEmail })}
              </p>
              <label className="settings-modal-label" style={{ textAlign: 'left' }}>{t('common-verify')}</label>
              <input
                type="text"
                className="settings-modal-input"
                value={email2faCode}
                onChange={e => setEmail2faCode(e.target.value)}
                placeholder={t('security-2fa-setup-email-placeholder')}
                maxLength={6}
              />
            </div>
            <div className="settings-modal-footer">
              <button className="settings-modal-btn cancel" onClick={() => setEmail2faModal(false)}>
                {t('common-cancel')}
              </button>
              <button className="settings-modal-btn confirm" onClick={handleVerifyEmail2fa} disabled={email2faLoading || !email2faCode || email2faCode.length !== 6}>
                {email2faLoading ? t('common-loading') : t('common-verify')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
