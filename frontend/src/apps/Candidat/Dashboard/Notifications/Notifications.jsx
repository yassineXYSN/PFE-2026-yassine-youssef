import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
          <p className="notif-center__header-subtitle">{t('notif.header.subtitle')}</p>
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
        {/* ── Pane 1: Categories ── */}
        <aside className="notif-center__categories">
          <button 
            className={`notif-cat-btn ${categoryFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            <span className="material-symbols-outlined">inbox</span>
            <span>{t('notif.filters.category_all')}</span>
            <span className="notif-cat-badge">{localizedNotifications.length}</span>
          </button>
          <button 
            className={`notif-cat-btn ${categoryFilter === 'application' ? 'is-active' : ''}`}
            onClick={() => setCategoryFilter('application')}
          >
            <span className="material-symbols-outlined">work_history</span>
            <span>{t('notif.cat.app')}</span>
          </button>
          <button 
            className={`notif-cat-btn ${categoryFilter === 'quiz' ? 'is-active' : ''}`}
            onClick={() => setCategoryFilter('quiz')}
          >
            <span className="material-symbols-outlined">quiz</span>
            <span>{t('notif.cat.quiz')}</span>
          </button>
          
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--dashboard-border)' }}>
             <button 
              className={`notif-cat-btn ${visibilityFilter === 'unread' ? 'is-active' : ''}`}
              onClick={() => setVisibilityFilter(v => v === 'unread' ? 'all' : 'unread')}
            >
              <span className="material-symbols-outlined">mark_email_unread</span>
              <span>{t('notif.filter.unread')}</span>
              {unreadCount > 0 && <span className="notif-cat-badge">{unreadCount}</span>}
            </button>
          </div>
        </aside>

        {/* ── Pane 2: List ── */}
        <section className="notif-center__list-pane">
          <div className="notif-center__list-controls">
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
              [1,2,3].map(i => <Skeleton key={i} height="80px" borderRadius="1rem" />)
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
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* ── Pane 3: Detail ── */}
        <main className="notif-center__detail-pane">
          {selectedNotification ? (
            <div className="notif-detail__content">
              <div className="notif-detail__main">
                <div className="notif-detail__header-meta">
                  <span className="notif-cat-badge">{selectedNotification.categoryLabel}</span>
                  <span className="notif-detail__time">{formatTime(selectedNotification.created_at, true)}</span>
                </div>
                <h2>{selectedNotification.titleText}</h2>
                <div className="notif-detail__separator" />
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
