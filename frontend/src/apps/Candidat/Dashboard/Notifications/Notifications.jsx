import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../../core/useLanguage';
import { useNotifications } from '../../../../core/hooks/useNotifications';
import Skeleton from '../components/Skeleton/Skeleton';
import './Notifications.css';

const PAGE_SIZE = 8;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const QUIZ_LINKLESS_TITLES = new Set([
  'notif.quiz.created.title',
  'Assessment Prepared',
  'Evaluation Preparee',
  'ÃƒÆ’Ã¢â‚¬Â°valuation PrÃƒÆ’Ã‚Â©parÃƒÆ’Ã‚Â©e',
]);

const LEGACY_LINK_MAP = {
  '/candidat/applications': '/candidat/dashboard/my-submissions',
};

const CATEGORY_META = {
  quiz: {
    icon: 'quiz',
    accent: '#7c3aed',
    soft: 'rgba(124, 58, 237, 0.10)',
  },
  application: {
    icon: 'work_history',
    accent: '#0f766e',
    soft: 'rgba(15, 118, 110, 0.10)',
  },
  system: {
    icon: 'notifications',
    accent: '#d97706',
    soft: 'rgba(217, 119, 6, 0.10)',
  },
};

const getLocale = (language) => (language === 'fr' ? 'fr-FR' : 'en-US');

const getToneStyle = (meta) => ({
  '--notif-accent': meta.accent,
  '--notif-accent-soft': meta.soft,
});

const getActionLink = (notification) => {
  if (!notification.link) {
    return null;
  }

  if (QUIZ_LINKLESS_TITLES.has(notification.title)) {
    return null;
  }

  return LEGACY_LINK_MAP[notification.link] || notification.link;
};

const searchMatches = (notification, query) => {
  if (!query.trim()) {
    return true;
  }

  const haystack = [
    notification.titleText,
    notification.messageText,
    notification.categoryLabel,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.trim().toLowerCase());
};

const matchesCategoryFilter = (notification, categoryFilter) =>
  categoryFilter === 'all' || notification.category === categoryFilter;

const matchesDateFilter = (notification, dateFilter) => {
  if (dateFilter === 'all') {
    return true;
  }

  const createdAt = new Date(notification.created_at).getTime();
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  if (dateFilter === 'today') {
    return createdAt >= startOfToday.getTime();
  }

  if (dateFilter === 'week') {
    return createdAt >= now - 7 * DAY_IN_MS;
  }

  if (dateFilter === 'month') {
    return createdAt >= now - 30 * DAY_IN_MS;
  }

  return true;
};

const matchesPassiveFilters = (notification, categoryFilter, dateFilter, query) =>
  matchesCategoryFilter(notification, categoryFilter) &&
  matchesDateFilter(notification, dateFilter) &&
  searchMatches(notification, query);

const matchesNotification = (notification, visibilityFilter, categoryFilter, dateFilter, query) => {
  if (visibilityFilter === 'unread' && notification.is_read) {
    return false;
  }

  return matchesPassiveFilters(notification, categoryFilter, dateFilter, query);
};

const formatRelativeTime = (value, language, t) => {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });

  if (absMs < 60 * 1000) {
    return t('notif.time.just_now');
  }

  if (absMs < 60 * 60 * 1000) {
    return rtf.format(Math.round(diffMs / (60 * 1000)), 'minute');
  }

  if (absMs < 24 * 60 * 60 * 1000) {
    return rtf.format(Math.round(diffMs / (60 * 60 * 1000)), 'hour');
  }

  if (absMs < 7 * DAY_IN_MS) {
    return rtf.format(Math.round(diffMs / DAY_IN_MS), 'day');
  }

  return new Intl.DateTimeFormat(getLocale(language), {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const getDetailVisualization = (notification, t) => {
  if (notification.category === 'quiz') {
    return {
      label: t('notif.detail.type_quiz'),
      flowTitle: t('notif.detail.quiz_flow_title'),
      steps: [
        t('notif.detail.quiz_step_review'),
        t('notif.detail.quiz_step_launch'),
        t('notif.detail.quiz_step_submit'),
      ],
      focusTitle: t('notif.detail.quiz_focus_title'),
      focusBody: t('notif.detail.quiz_focus_body'),
    };
  }

  if (notification.category === 'application') {
    return {
      label: t('notif.detail.type_application'),
      flowTitle: t('notif.detail.application_flow_title'),
      steps: [
        t('notif.detail.application_step_update'),
        t('notif.detail.application_step_track'),
        t('notif.detail.application_step_prepare'),
      ],
      focusTitle: t('notif.detail.application_focus_title'),
      focusBody: t('notif.detail.application_focus_body'),
    };
  }

  return {
    label: t('notif.detail.type_system'),
    flowTitle: t('notif.detail.system_flow_title'),
    steps: [
      t('notif.detail.system_step_read'),
      t('notif.detail.system_step_check'),
      t('notif.detail.system_step_return'),
    ],
    focusTitle: t('notif.detail.system_focus_title'),
    focusBody: t('notif.detail.system_focus_body'),
  };
};

const getPrimaryActionLabel = (notification, t) =>
  notification.category === 'quiz' ? t('notif.action.take_quiz') : t('notif.action.view_details');

const Notifications = () => {
  const { t, language } = useLanguage();
  const {
    notifications: backendNotifications,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const navigate = useNavigate();
  const activeItemRef = useRef(null);
  const listScrollRef = useRef(null);
  const detailScrollRef = useRef(null);

  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [preservedSelectionId, setPreservedSelectionId] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [mobileView, setMobileView] = useState('list');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!loading) {
      setHasLoadedOnce(true);
    }
  }, [loading]);

  const localizedNotifications = useMemo(
    () =>
      backendNotifications.map((notification) => {
        const meta = CATEGORY_META[notification.category] || CATEGORY_META.system;
        const categoryKey =
          notification.category === 'quiz'
            ? 'notif.cat.quiz'
            : notification.category === 'application'
              ? 'notif.cat.app'
              : 'notif.cat.system';

        return {
          ...notification,
          meta,
          actionLink: getActionLink(notification),
          categoryLabel: t(categoryKey),
          titleText: t(notification.title),
          messageText: t(notification.message),
        };
      }),
    [backendNotifications, t]
  );

  const sortedNotifications = useMemo(
    () =>
      [...localizedNotifications].sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      ),
    [localizedNotifications]
  );

  const unreadCount = useMemo(
    () => sortedNotifications.filter((notification) => !notification.is_read).length,
    [sortedNotifications]
  );

  const filteredNotifications = useMemo(
    () =>
      sortedNotifications.filter((notification) =>
        matchesNotification(
          notification,
          visibilityFilter,
          categoryFilter,
          dateFilter,
          searchQuery
        )
      ),
    [sortedNotifications, visibilityFilter, categoryFilter, dateFilter, searchQuery]
  );

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE));

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  const paginatedNotifications = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredNotifications.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredNotifications, page]);

  const selectedNotification = useMemo(
    () => sortedNotifications.find((notification) => notification._id === selectedId) || null,
    [sortedNotifications, selectedId]
  );

  const visibleSelectionOnPage = useMemo(
    () => paginatedNotifications.some((notification) => notification._id === selectedId),
    [paginatedNotifications, selectedId]
  );

  const preservedSelection =
    Boolean(selectedNotification) &&
    selectedId === preservedSelectionId &&
    selectedNotification.is_read &&
    matchesPassiveFilters(selectedNotification, categoryFilter, dateFilter, searchQuery);

  const canKeepSelection =
    Boolean(selectedNotification) && (visibleSelectionOnPage || preservedSelection);

  useEffect(() => {
    if (canKeepSelection) {
      return;
    }

    const fallbackId = paginatedNotifications[0]?._id ?? null;

    if (fallbackId !== selectedId) {
      setSelectedId(fallbackId);
    }
  }, [canKeepSelection, paginatedNotifications, selectedId]);

  useEffect(() => {
    if (!selectedId || !visibleSelectionOnPage) {
      return;
    }

    activeItemRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [selectedId, visibleSelectionOnPage, page]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    detailScrollRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [selectedId]);

  useEffect(() => {
    listScrollRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [page, visibilityFilter, categoryFilter, dateFilter, searchQuery]);

  useEffect(() => {
    if (!selectedNotification && mobileView === 'detail') {
      setMobileView('list');
    }
  }, [selectedNotification, mobileView]);

  const categoryOptions = useMemo(
    () => [
      { id: 'all', label: t('notif.filters.category_all') },
      { id: 'quiz', label: t('notif.cat.quiz') },
      { id: 'application', label: t('notif.cat.app') },
      { id: 'system', label: t('notif.cat.system') },
    ],
    [t]
  );

  const dateOptions = useMemo(
    () => [
      { id: 'all', label: t('notif.filters.date_all') },
      { id: 'today', label: t('notif.filters.date_today') },
      { id: 'week', label: t('notif.filters.date_week') },
      { id: 'month', label: t('notif.filters.date_month') },
    ],
    [t]
  );

  const stats = [
    { key: 'unread', label: t('notif.summary.unread'), value: unreadCount },
    { key: 'total', label: t('notif.summary.total'), value: sortedNotifications.length },
    { key: 'filtered', label: t('notif.summary.filtered'), value: filteredNotifications.length },
  ];

  const hasActiveFilters =
    visibilityFilter !== 'all' ||
    categoryFilter !== 'all' ||
    dateFilter !== 'all' ||
    Boolean(searchQuery.trim());

  const isDetailView = mobileView === 'detail' && Boolean(selectedNotification);
  const rangeStart = filteredNotifications.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = filteredNotifications.length ? rangeStart + paginatedNotifications.length - 1 : 0;
  const detailVisualization = selectedNotification
    ? getDetailVisualization(selectedNotification, t)
    : null;

  const handleSelectNotification = (notification) => {
    setSelectedId(notification._id);

    if (visibilityFilter === 'unread' && !notification.is_read) {
      setPreservedSelectionId(notification._id);
    } else {
      setPreservedSelectionId(null);
    }

    if (!notification.is_read) {
      void markAsRead(notification._id);
    }

    if (typeof window !== 'undefined' && window.innerWidth <= 920) {
      setMobileView('detail');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!unreadCount || isMarkingAll) {
      return;
    }

    if (visibilityFilter === 'unread' && selectedNotification && !selectedNotification.is_read) {
      setPreservedSelectionId(selectedNotification._id);
    } else {
      setPreservedSelectionId(null);
    }

    setIsMarkingAll(true);
    try {
      await markAllAsRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleVisibilityChange = (nextFilter) => {
    setVisibilityFilter(nextFilter);
    setPage(1);
    setPreservedSelectionId(null);
  };

  const handleCategoryChange = (event) => {
    setCategoryFilter(event.target.value);
    setPage(1);
    setPreservedSelectionId(null);
  };

  const handleDateChange = (event) => {
    setDateFilter(event.target.value);
    setPage(1);
    setPreservedSelectionId(null);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setPage(1);
    setPreservedSelectionId(null);
  };

  const handleResetFilters = () => {
    setVisibilityFilter('all');
    setCategoryFilter('all');
    setDateFilter('all');
    setSearchQuery('');
    setPage(1);
    setPreservedSelectionId(null);
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }

    setPage(nextPage);
    setPreservedSelectionId(null);
  };

  const renderListItem = (notification) => {
    const isSelected = notification._id === selectedId;

    return (
      <button
        key={notification._id}
        type="button"
        className={`notif-inbox__item ${!notification.is_read ? 'is-unread' : ''} ${
          isSelected ? 'is-selected' : ''
        }`}
        style={getToneStyle(notification.meta)}
        onClick={() => handleSelectNotification(notification)}
        aria-pressed={isSelected}
        ref={isSelected ? activeItemRef : null}
      >
        <div className="notif-inbox__item-icon">
          <span className="material-symbols-outlined">{notification.meta.icon}</span>
        </div>

        <div className="notif-inbox__item-body">
          <div className="notif-inbox__item-head">
            <h3>{notification.titleText}</h3>
            <span className="notif-inbox__item-time">
              {formatRelativeTime(notification.created_at, language, t)}
            </span>
          </div>

          <p>{notification.messageText}</p>

          <div className="notif-inbox__item-foot">
            <span className="notif-inbox__badge">{notification.categoryLabel}</span>
            {!notification.is_read && (
              <span className="notif-inbox__badge notif-inbox__badge--new">
                {t('notif.status.new')}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  const renderLoadingShell = () => (
    <div className="notif-inbox__shell is-list-view">
      <section className="notif-inbox__sidebar">
        <div className="notif-inbox__toolbar">
          <Skeleton width="100%" height="2.9rem" />
          <div className="notif-inbox__tabs">
            <Skeleton width="48%" height="2.7rem" />
            <Skeleton width="48%" height="2.7rem" />
          </div>
          <div className="notif-inbox__filter-grid">
            <Skeleton width="100%" height="4.5rem" />
            <Skeleton width="100%" height="4.5rem" />
          </div>
        </div>

        <div className="notif-inbox__list-meta">
          <Skeleton width="10rem" height="1rem" />
          <Skeleton width="6rem" height="1rem" />
        </div>

        <div className="notif-inbox__list">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="notif-inbox__item notif-inbox__item--loading">
              <Skeleton variant="circle" width="2.75rem" height="2.75rem" />
              <div className="notif-inbox__item-body">
                <Skeleton width="72%" height="1rem" />
                <Skeleton width="100%" height="0.9rem" style={{ marginTop: '0.65rem' }} />
                <Skeleton width="90%" height="0.9rem" style={{ marginTop: '0.45rem' }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="notif-inbox__detail">
        <div className="notif-inbox__detail-card">
          <Skeleton width="8rem" height="1rem" />
          <Skeleton width="75%" height="2rem" style={{ marginTop: '0.85rem' }} />
          <Skeleton width="100%" height="1rem" style={{ marginTop: '0.9rem' }} />
          <Skeleton width="94%" height="1rem" style={{ marginTop: '0.55rem' }} />
        </div>
      </aside>
    </div>
  );

  const renderGlobalEmptyState = () => (
    <div className="notif-inbox__empty-page">
      <div className="notif-inbox__empty-icon">
        <span className="material-symbols-outlined">notifications</span>
      </div>
      <h2>{t('notif.queue.empty_global_title')}</h2>
      <p>{t('notif.queue.empty_global_description')}</p>
    </div>
  );

  return (
    <div className="notif-inbox">
      <header className="notif-inbox__header">
        <div className="notif-inbox__header-copy">
          <p className="notif-inbox__eyebrow">{t('notif.header.kicker')}</p>
          <h1>{t('notif.page.inbox')}</h1>
          <p>{t('notif.header.subtitle')}</p>
        </div>

        <div className="notif-inbox__header-side">
          <div className="notif-inbox__stats">
            {stats.map((stat) => (
              <div key={stat.key} className="notif-inbox__stat">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>

          <div className="notif-inbox__header-actions">
            <span className="notif-inbox__sync-state">
              <span className={`notif-inbox__sync-dot ${loading ? 'is-loading' : ''}`} />
              <span>{loading ? t('notif.header.syncing') : t('notif.header.live')}</span>
            </span>

            <button
              type="button"
              className="notif-inbox__primary-btn"
              onClick={handleMarkAllAsRead}
              disabled={!unreadCount || isMarkingAll}
            >
              <span className="material-symbols-outlined">
                {isMarkingAll ? 'progress_activity' : 'drafts'}
              </span>
              <span>
                {isMarkingAll ? t('notif.page.marking_all_read') : t('notif.page.mark_all_read')}
              </span>
            </button>
          </div>
        </div>
      </header>

      {loading && !hasLoadedOnce ? (
        renderLoadingShell()
      ) : sortedNotifications.length === 0 ? (
        renderGlobalEmptyState()
      ) : (
        <div className={`notif-inbox__shell ${isDetailView ? 'is-detail-view' : 'is-list-view'}`}>
          <section className="notif-inbox__sidebar">
            <div className="notif-inbox__toolbar">
              <label className="notif-inbox__search">
                <span className="material-symbols-outlined">search</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder={t('notif.filters.search')}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="notif-inbox__search-clear"
                    onClick={() => handleSearchChange({ target: { value: '' } })}
                    aria-label={t('notif.toolbar.clear_search')}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </label>

              <div className="notif-inbox__tabs">
                <button
                  type="button"
                  className={visibilityFilter === 'all' ? 'is-active' : ''}
                  onClick={() => handleVisibilityChange('all')}
                >
                  <span>{t('notif.filter.all')}</span>
                  <strong>{sortedNotifications.length}</strong>
                </button>
                <button
                  type="button"
                  className={visibilityFilter === 'unread' ? 'is-active' : ''}
                  onClick={() => handleVisibilityChange('unread')}
                >
                  <span>{t('notif.filter.unread')}</span>
                  <strong>{unreadCount}</strong>
                </button>
              </div>

              <div className="notif-inbox__filter-grid">
                <label className="notif-inbox__field">
                  <span>{t('notif.filters.category')}</span>
                  <select value={categoryFilter} onChange={handleCategoryChange}>
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="notif-inbox__field">
                  <span>{t('notif.filters.date')}</span>
                  <select value={dateFilter} onChange={handleDateChange}>
                    {dateOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="notif-inbox__secondary-btn"
                  onClick={handleResetFilters}
                >
                  {t('notif.filters.reset')}
                </button>
              )}
            </div>

            <div className="notif-inbox__list-meta">
              <div>
                <strong>{t('notif.list.results', { count: filteredNotifications.length })}</strong>
                {filteredNotifications.length > 0 && (
                  <span>
                    {t('notif.pagination.summary', {
                      from: rangeStart,
                      to: rangeEnd,
                      count: filteredNotifications.length,
                    })}
                  </span>
                )}
              </div>

              {filteredNotifications.length > 0 && (
                <span>{t('notif.list.page', { page, total: totalPages })}</span>
              )}
            </div>

            <div ref={listScrollRef} className="notif-inbox__list">
              {paginatedNotifications.length > 0 ? (
                paginatedNotifications.map(renderListItem)
              ) : (
                <div className="notif-inbox__empty-list">
                  <div className="notif-inbox__empty-icon">
                    <span className="material-symbols-outlined">
                      {visibilityFilter === 'unread' ? 'done_all' : 'filter_alt_off'}
                    </span>
                  </div>
                  <h3>
                    {visibilityFilter === 'unread'
                      ? t('notif.list.empty_unread_title')
                      : t('notif.list.empty_title')}
                  </h3>
                  <p>
                    {visibilityFilter === 'unread'
                      ? t('notif.list.empty_unread_description')
                      : t('notif.list.empty_description')}
                  </p>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="notif-inbox__pagination">
                <button
                  type="button"
                  className="notif-inbox__secondary-btn notif-inbox__secondary-btn--compact"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                >
                  {t('notif.pagination.previous')}
                </button>

                <span>{t('notif.list.page', { page, total: totalPages })}</span>

                <button
                  type="button"
                  className="notif-inbox__secondary-btn notif-inbox__secondary-btn--compact"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                >
                  {t('notif.pagination.next')}
                </button>
              </div>
            )}
          </section>

          <aside ref={detailScrollRef} className="notif-inbox__detail">
            {selectedNotification ? (
              <div className="notif-inbox__detail-card" style={getToneStyle(selectedNotification.meta)}>
                <div className="notif-inbox__detail-toolbar">
                  <button
                    type="button"
                    className="notif-inbox__back-btn"
                    onClick={() => setMobileView('list')}
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                    <span>{t('notif.mobile.back')}</span>
                  </button>
                </div>

                <div className="notif-inbox__detail-body">
                  <section className="notif-inbox__detail-hero">
                    <div className="notif-inbox__detail-head">
                      <div className="notif-inbox__detail-icon">
                        <span className="material-symbols-outlined">
                          {selectedNotification.meta.icon}
                        </span>
                      </div>

                      <div className="notif-inbox__detail-copy">
                        <div className="notif-inbox__detail-badges">
                          <span className="notif-inbox__badge">{selectedNotification.categoryLabel}</span>
                          <span
                            className={`notif-inbox__badge ${
                              selectedNotification.is_read ? '' : 'notif-inbox__badge--new'
                            }`}
                          >
                            {selectedNotification.is_read
                              ? t('notif.status.viewed')
                              : t('notif.status.new')}
                          </span>
                        </div>

                        <p className="notif-inbox__detail-kicker">{detailVisualization.label}</p>
                        <h2>{selectedNotification.titleText}</h2>
                        <p className="notif-inbox__detail-message">{selectedNotification.messageText}</p>
                      </div>
                    </div>
                  </section>

                  <div className="notif-inbox__detail-grid">
                    <section className="notif-inbox__detail-panel">
                      <p className="notif-inbox__detail-panel-kicker">{t('notif.detail.panel_flow')}</p>
                      <h3>{detailVisualization.flowTitle}</h3>

                      <div className="notif-inbox__detail-steps">
                        {detailVisualization.steps.map((step, index) => (
                          <article key={step} className="notif-inbox__detail-step">
                            <span className="notif-inbox__detail-step-index">{index + 1}</span>
                            <p>{step}</p>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="notif-inbox__detail-panel">
                      <p className="notif-inbox__detail-panel-kicker">{t('notif.detail.panel_focus')}</p>
                      <h3>{detailVisualization.focusTitle}</h3>
                      <p>{detailVisualization.focusBody}</p>

                      {preservedSelection && (
                        <div className="notif-inbox__detail-note">
                          <span className="material-symbols-outlined">history</span>
                          <p>{t('notif.detail.preserved_hint')}</p>
                        </div>
                      )}
                    </section>
                  </div>

                  <div className="notif-inbox__detail-footer">
                    {selectedNotification.actionLink ? (
                      <button
                        type="button"
                        className="notif-inbox__primary-btn notif-inbox__primary-btn--full"
                        onClick={() => navigate(selectedNotification.actionLink)}
                      >
                        <span className="material-symbols-outlined">
                          {selectedNotification.category === 'quiz' ? 'rocket_launch' : 'open_in_new'}
                        </span>
                        <span>{getPrimaryActionLabel(selectedNotification, t)}</span>
                      </button>
                    ) : (
                      <div className="notif-inbox__detail-note">
                        <span className="material-symbols-outlined">info</span>
                        <p>{t('notif.detail.destination_none_note')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="notif-inbox__detail-card notif-inbox__detail-card--placeholder">
                <div className="notif-inbox__empty-icon">
                  <span className="material-symbols-outlined">notifications</span>
                </div>
                <h2>{t('notif.detail.empty_title')}</h2>
                <p>{t('notif.detail.empty_description')}</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default Notifications;
