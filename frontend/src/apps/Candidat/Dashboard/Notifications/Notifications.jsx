import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../../../core/useLanguage';
import Skeleton from '../components/Skeleton/Skeleton';
import { useNotifications } from '../../../../core/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import './Notifications.css';

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

    const groupNotifications = (notifs) => {
        const groups = { today: [], earlier: [] };
        const today = new Date().setHours(0, 0, 0, 0);
        
        notifs.forEach(n => {
            const date = new Date(n.created_at).setHours(0, 0, 0, 0);
            if (date === today) groups.today.push(n);
            else groups.earlier.push(n);
        });
        return groups;
    };

    const grouped = useMemo(() => groupNotifications(filteredNotifications), [filteredNotifications]);

    const getIcon = (category) => {
        switch (category) {
            case 'quiz': return 'assignment';
            case 'application': return 'work';
            default: return 'notifications';
        }
    };

    const renderItem = (item) => (
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
                {item.link && (
                    <button className="notif-link-btn" onClick={(e) => { e.stopPropagation(); navigate(item.link); }}>
                        {item.category === 'quiz' ? t('notif.action.take_quiz') : t('notif.action.view_details')}
                    </button>
                )}
            </div>
        </div>
    );

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
                        {grouped.today.length > 0 && (
                            <section className="list-section">
                                <h2 className="section-label">Today</h2>
                                <div className="items-wrapper">
                                    {grouped.today.map(renderItem)}
                                </div>
                            </section>
                        )}
                        {grouped.earlier.length > 0 && (
                            <section className="list-section">
                                <h2 className="section-label">Earlier</h2>
                                <div className="items-wrapper">
                                    {grouped.earlier.map(renderItem)}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;
