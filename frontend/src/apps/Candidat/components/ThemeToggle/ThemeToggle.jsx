import { useEffect, useState } from 'react';
import './ThemeToggle.css';

const THEME_KEY = 'candidat-theme';

const getSystemTheme = () =>
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

const applyTheme = (preference) => {
  const resolved = preference === 'system' ? getSystemTheme() : preference;
  document.documentElement.setAttribute('data-theme', resolved);
};

const ThemeToggle = () => {
  const [preference, setPreference] = useState('system');

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const initial = stored || 'system';
    setPreference(initial);
    applyTheme(initial);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = localStorage.getItem(THEME_KEY) || 'system';
      if (current === 'system') {
        applyTheme('system');
      }
    };

    if (media?.addEventListener) {
      media.addEventListener('change', handleChange);
    } else if (media?.addListener) {
      media.addListener(handleChange);
    }

    return () => {
      if (media?.removeEventListener) {
        media.removeEventListener('change', handleChange);
      } else if (media?.removeListener) {
        media.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const cyclePreference = () => {
    const next =
      preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system';
    setPreference(next);
    localStorage.setItem(THEME_KEY, next);
  };

  const label =
    preference === 'system' ? 'System' : preference === 'light' ? 'Light' : 'Dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cyclePreference}
      aria-label={`Theme: ${label}`}
      title={`Theme: ${label}`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {preference === 'dark' ? (
          <i className="fa-solid fa-moon"></i>
        ) : preference === 'light' ? (
          <i className="fa-solid fa-sun"></i>
        ) : (
          <i className="fa-solid fa-desktop"></i>
        )}
      </span>
      <span className="theme-toggle__label">{label}</span>
    </button>
  );
};

export default ThemeToggle;
