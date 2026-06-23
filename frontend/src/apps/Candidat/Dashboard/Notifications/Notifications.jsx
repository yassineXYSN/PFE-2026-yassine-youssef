import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../../core/useLanguage';
import { useNotifications } from '../../../../core/hooks/useNotifications';
import Skeleton from '../components/Skeleton/Skeleton';
import './Notifications.css';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const CATEGORY_META = {
  quiz: { icon: 'quiz', label: 'notif.cat.quiz' },
  application: { icon: 'work_history', label: 'notif.cat.app' },
  system: { icon: 'notifications', label: 'notif.cat.system' },
};

const Notifications = () => {
  const { t, language } = useLanguage();
  const {
    notifications: backendNotifications,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const navigate = useNavigate();
  const location = useLocation();
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');

  // ── Logic ──
  const localizedNotifications = useMemo(() => 
    backendNotifications.map(n => ({
      ...n,
      titleText: t(n.title),
      messageText: t(n.message),
      meta: CATEGORY_META[n.category] || CATEGORY_META.system,
      categoryLabel: t(CATEGORY_META[n.category]?.label || 'notif.cat.system')
    })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  , [backendNotifications, t]);

  const filteredNotifications = useMemo(() => {
    return localizedNotifications.filter(n => {
      const matchesSearch = !searchQuery ||
        n.titleText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.messageText.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = categoryFilter === 'all' || n.category === categoryFilter;
      const matchesVis = visibilityFilter === 'all' || (visibilityFilter === 'unread' && !n.is_read);

      return matchesSearch && matchesCat && matchesVis;
    });
  }, [localizedNotifications, searchQuery, categoryFilter, visibilityFilter]);

  useEffect(() => {
    if (location.state?.selectedId) {
      setSelectedId(location.state.selectedId);
      // clean up so refresh won't stay stuck
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.selectedId, location.pathname, navigate]);

  const selectedNotification = useMemo(() =>
    localizedNotifications.find(n => n._id === selectedId) || filteredNotifications[0]
  , [localizedNotifications, filteredNotifications, selectedId]);

  useEffect(() => {
    if (selectedNotification && !selectedId) {
      setSelectedId(selectedNotification._id);
    }
  }, [selectedNotification, selectedId]);

  // Mark as read when selectedNotification changes
  useEffect(() => {
    if (selectedNotification && !selectedNotification.is_read) {
      markAsRead(selectedNotification._id);
    }
  }, [selectedNotification?._id, markAsRead]);

  const handleSelect = (n) => {
    setSelectedId(n._id);
    if (!n.is_read) markAsRead(n._id);
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (isToday) return d.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const unreadCount = localizedNotifications.filter(n => !n.is_read).length;

  return (
    <div className="notif-inbox">
      {/* ── Header ── */}
      <header className="notif-center__header">
        <div className="notif-center__header-title">
          <h1>{t('notif.page.inbox')}</h1>
        </div>
        <div className="notif-center__header-actions">
          <button 
            className="tf-btn tf-btn-secondary" 
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            style={{ fontSize: '0.85rem' }}
          >
            <span className="material-symbols-outlined">drafts</span>
            {t('notif.page.mark_all_read')}
          </button>
        </div>
      </header>

      <div className="notif-center__body">
        

        {/* ── Pane 2: List ── */}
        <section className="notif-center__list-pane">
          <div className="notif-center__list-controls">

            {/* Category Badges directly above the list */}
            <div className="notif-category-badges">
              <button
                className={`notif-badge-filter ${categoryFilter === 'all' && visibilityFilter !== 'unread' ? 'is-active' : ''}`}
                onClick={() => { setCategoryFilter('all'); setVisibilityFilter('all'); }}
              >
                {t('notif.filters.category_all')} ({localizedNotifications.length})
              </button>
              <button
                className={`notif-badge-filter ${visibilityFilter === 'unread' ? 'is-active' : ''}`}
                onClick={() => { setCategoryFilter('all'); setVisibilityFilter('unread'); }}
              >
                {t('notif.filter.unread')} {unreadCount > 0 && `(${unreadCount})`}
              </button>
              <button
                className={`notif-badge-filter ${categoryFilter === 'application' && visibilityFilter !== 'unread' ? 'is-active' : ''}`}
                onClick={() => { setCategoryFilter('application'); setVisibilityFilter('all'); }}
              >
                {t('notif.cat.app')}
              </button>
              <button
                className={`notif-badge-filter ${categoryFilter === 'quiz' && visibilityFilter !== 'unread' ? 'is-active' : ''}`}
                onClick={() => { setCategoryFilter('quiz'); setVisibilityFilter('all'); }}
              >
                {t('notif.cat.quiz')}
              </button>
            </div>

            <div className="notif-search-field">
              <span className="material-symbols-outlined">search</span>
              <input 
                type="text" 
                placeholder={t('notif.filters.search')} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="notif-list-container">
            {loading && localizedNotifications.length === 0 ? (
              [1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ padding: '1.75rem 2rem', borderBottom: '1px solid var(--notif-border)' }}>
                  <Skeleton variant="text" width="70%" height="1.2rem" style={{ marginBottom: '0.75rem' }} />
                  <Skeleton variant="text" width="90%" height="0.9rem" style={{ marginBottom: '0.25rem' }} />
                  <Skeleton variant="text" width="60%" height="0.9rem" style={{ marginBottom: '1rem' }} />
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Skeleton variant="text" width="50px" height="0.75rem" />
                    <Skeleton variant="text" width="50px" height="0.75rem" />
                  </div>
                </div>
              ))
            ) : filteredNotifications.length === 0 ? (
              <div className="notif-detail__placeholder" style={{ padding: '2rem' }}>
                <span className="material-symbols-outlined">search_off</span>
                <p>{t('notif.list.empty_description')}</p>
              </div>
            ) : (
              filteredNotifications.map(n => (
                <button 
                  key={n._id}
                  className={`notif-card ${selectedId === n._id ? 'is-selected' : ''} ${!n.is_read ? 'is-unread' : ''}`}
                  onClick={() => handleSelect(n)}
                >
                  <div className="notif-card__content">
                    <h3 className="notif-card__title">{n.titleText}</h3>
                    <p className="notif-card__msg">{n.messageText}</p>
                    <div className="notif-card__meta">
                      <span>{formatTime(n.created_at)}</span>
                      <span>•</span>
                      <span>{n.categoryLabel}</span>
                      {n.metadata?.company_name && (
                        <>
                          <span>•</span>
                          <span>{n.metadata.company_name}</span>
                        </>
                      )}
                      {n.metadata?.job_title && (
                        <>
                          <span>•</span>
                          <span>{n.metadata.job_title}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* ── Pane 3: Detail ── */}
        <main className="notif-center__detail-pane">
          {loading && localizedNotifications.length === 0 ? (
            <div className="notif-detail__content">
              <div className="notif-detail__main">
                <div className="notif-detail__header-meta" style={{ marginBottom: '2rem' }}>
                  <Skeleton variant="text" width="100px" height="1rem" />
                  <Skeleton variant="text" width="120px" height="1rem" />
                </div>
                <Skeleton variant="text" width="60%" height="4rem" style={{ marginBottom: '0.5rem' }} />
                <Skeleton variant="text" width="40%" height="4rem" style={{ marginBottom: '2.5rem' }} />
                <div className="notif-detail__separator" />
                <Skeleton variant="text" width="100%" height="1.5rem" style={{ marginBottom: '0.5rem' }} />
                <Skeleton variant="text" width="90%" height="1.5rem" style={{ marginBottom: '0.5rem' }} />
                <Skeleton variant="text" width="85%" height="1.5rem" style={{ marginBottom: '0.5rem' }} />
                <Skeleton variant="text" width="40%" height="1.5rem" />
                
                <div style={{ marginTop: '3.5rem' }}>
                  <Skeleton variant="rectangle" width="180px" height="3rem" />
                </div>
              </div>
            </div>
          ) : selectedNotification ? (
            <div className="notif-detail__content">
              <div className="notif-detail__main">
                <div className="notif-detail__header-meta">
                  <span className="notif-cat-badge">{selectedNotification.categoryLabel}</span>
                  <span className="notif-detail__time">{formatTime(selectedNotification.created_at, true)}</span>
                </div>
                <h2>{selectedNotification.titleText}</h2>
                <div className="notif-detail__separator" />

                {(selectedNotification.metadata?.company_name || selectedNotification.metadata?.job_title) && (
                  <div className="notif-detail__inline-meta" style={{ display: 'flex', gap: '1rem', color: 'var(--notif-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    {selectedNotification.metadata?.company_name && (
                      <span style={{display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
                        <span className="material-symbols-outlined" style={{fontSize: '1.1rem'}}>business</span>
                        {selectedNotification.metadata.company_name}
                      </span>
                    )}
                    {selectedNotification.metadata?.job_title && (
                      <span style={{display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
                        <span className="material-symbols-outlined" style={{fontSize: '1.1rem'}}>work</span>
                        {selectedNotification.metadata.job_title}
                      </span>
                    )}
                  </div>
                )}

                <p className="notif-detail__message">{selectedNotification.messageText}</p>

                {selectedNotification.link && (
                  <button
                    className="notif-detail__action"
                    onClick={() => navigate(selectedNotification.link)}
                  >
                    <span className="material-symbols-outlined">open_in_new</span>
                    {selectedNotification.category === 'quiz' ? t('notif.action.take_quiz') : t('notif.action.view_details')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="notif-detail__placeholder">
              <span className="material-symbols-outlined">drafts</span>
              <h3>{t('notif.queue.empty_global_title')}</h3>
              <p>{t('notif.queue.empty_global_description')}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Notifications;
