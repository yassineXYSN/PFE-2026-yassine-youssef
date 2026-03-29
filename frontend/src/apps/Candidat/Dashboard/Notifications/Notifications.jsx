import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../../../core/useLanguage';
import Skeleton from '../components/Skeleton/Skeleton';
import { useNotifications } from '../../../../core/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import './Notifications.css';

const QUIZ_LINKLESS_TITLES = new Set([
    'notif.quiz.created.title',
    'Assessment Prepared',
    'Evaluation Preparee',
    'Évaluation Préparée',
]);

const Notifications = () => {
    const { t } = useLanguage();
    const { 
        notifications: backendNotifications, 
        loading: backendLoading, 
        markAsRead, 
        markAllAsRead 
    } = useNotifications();
    const navigate = useNavigate();

    const [listFilter, setListFilter] = useState('all'); 
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        if (!backendLoading) {
            setInitialLoading(false);
        }
    }, [backendLoading]);

    const filteredNotifications = useMemo(() => {
        return backendNotifications.filter(n => {
            if (listFilter === 'unread') return !n.is_read;
            return true;
        });
    }, [backendNotifications, listFilter]);

    const groupNotificationsByDay = (notifs) => {
        const groups = {};
        const now = new Date();
        const todayKey = now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toDateString();

        notifs.forEach(n => {
            const dateKey = new Date(n.created_at).toDateString();
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(n);
        });

        // Convert to array sorted by date descending
        return Object.entries(groups)
            .sort(([a], [b]) => new Date(b) - new Date(a))
            .map(([dateKey, items]) => {
                let label;
                if (dateKey === todayKey) label = t('notif.group.today') || 'Today';
                else if (dateKey === yesterdayKey) label = t('notif.group.yesterday') || 'Yesterday';
                else label = new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
                return { label, items };
            });
    };

    const grouped = useMemo(() => groupNotificationsByDay(filteredNotifications), [filteredNotifications]);

    const getIcon = (category) => {
        switch (category) {
            case 'quiz': return 'assignment';
            case 'application': return 'work';
            default: return 'notifications';
        }
    };

    const getNotificationActionLink = (item) => {
        if (!item.link) {
            return null;
        }

        if (QUIZ_LINKLESS_TITLES.has(item.title)) {
            return null;
        }

        return item.link;
    };

    const renderItem = (item) => {
        const actionLink = getNotificationActionLink(item);

        return (
        <div 
            key={item._id} 
            className={`notif-item ${!item.is_read ? 'is-unread' : ''}`}
            onClick={() => {
                if (!item.is_read) markAsRead(item._id);
            }}
        >
            <div className="notif-status-dot"></div>
            <div className="notif-icon-wrapper">
                <span className="material-symbols-outlined">{getIcon(item.category)}</span>
            </div>
            <div className="notif-content">
                <div className="notif-header">
                    <span className="notif-category">{t(`notif.cat.${item.category === 'quiz' ? 'quiz' : item.category === 'application' ? 'app' : 'system'}`)}</span>
                    <span className="notif-time">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <h3 className="notif-title">{t(item.title)}</h3>
                <p className="notif-message">{t(item.message)}</p>
                {actionLink && (
                    <button className="notif-link-btn" onClick={(e) => { e.stopPropagation(); navigate(actionLink); }}>
                        {item.category === 'quiz' ? t('notif.action.take_quiz') : t('notif.action.view_details')}
                    </button>
                )}
            </div>
        </div>
        );
    };

    return (
        <div className="essential-notif-root">
            <div className="essential-header">
                <div className="header-top">
                    <h1 className="page-title">{t('notif.page.inbox')}</h1>
                    <button className="mark-read-all-btn" onClick={markAllAsRead}>
                        {t('notif.page.mark_all_read')}
                    </button>
                </div>
                <div className="filter-tabs">
                    <button 
                        className={`tab-btn ${listFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setListFilter('all')}
                    >
                        {t('notif.filter.all')}
                        <span className="count-tag">{backendNotifications.length}</span>
                    </button>
                    <button 
                        className={`tab-btn ${listFilter === 'unread' ? 'active' : ''}`}
                        onClick={() => setListFilter('unread')}
                    >
                        {t('notif.filter.unread')}
                        <span className="count-tag unread">{backendNotifications.filter(n=>!n.is_read).length}</span>
                    </button>
                </div>
            </div>

            <div className="essential-list-container">
                {initialLoading ? (
                    <div className="notif-skeleton-list">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton-item">
                                <Skeleton variant="circular" width={40} height={40} />
                                <div style={{ flex: 1, marginLeft: '1rem' }}>
                                    <Skeleton variant="text" width="20%" height={15} />
                                    <Skeleton variant="text" width="60%" height={25} style={{ marginTop: '0.5rem' }} />
                                    <Skeleton variant="text" width="90%" height={20} style={{ marginTop: '0.25rem' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="empty-state-v5">
                        <span className="material-symbols-outlined">inbox</span>
                        <p>{t('notif.page.empty_list') || 'No notifications yet'}</p>
                    </div>
                ) : (
                    <div className="grouped-list">
                        {grouped.map(group => (
                            <section key={group.label} className="list-section">
                                <h2 className="section-label">{group.label}</h2>
                                <div className="items-wrapper">
                                    {group.items.map(renderItem)}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;
