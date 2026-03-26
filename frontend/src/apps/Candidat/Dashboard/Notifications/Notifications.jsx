import React, { useState, useRef, useEffect, useMemo } from 'react';
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
        markAllAsRead, 
        fetchNotifications 
    } = useNotifications();
    const navigate = useNavigate();

    // --- State ---
    const [mainTab, setMainTab] = useState('notifications'); // 'notifications' or 'messages'
    const [listFilter, setListFilter] = useState('all'); // 'all', 'unread'
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [isMobileViewActive, setIsMobileViewActive] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!backendLoading) {
            setLoading(false);
        }
    }, [backendLoading]);

    const messagesEndRef = useRef(null);

    // Filtered notifications based on UI state
    const filteredNotifications = useMemo(() => {
        return backendNotifications.filter(n => {
            if (listFilter === 'unread') return !n.is_read;
            return true;
        });
    }, [backendNotifications, listFilter]);

    // Current selected item
    const currentSelectedItem = useMemo(() => {
        if (!selectedItemId && filteredNotifications.length > 0 && window.innerWidth > 768) {
            return filteredNotifications[0];
        }
        return filteredNotifications.find(n => n._id === selectedItemId);
    }, [filteredNotifications, selectedItemId]);

    // --- Handlers ---
    const handleItemClick = (id) => {
        setSelectedItemId(id);
        setIsMobileViewActive(true);
        markAsRead(id);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

    const getIcon = (category) => {
        switch (category) {
            case 'quiz': return 'quiz';
            case 'application': return 'description';
            default: return 'notifications';
        }
    };

    const renderSidebarItem = (item) => {
        const isActive = currentSelectedItem?._id === item._id;
        return (
            <div
                key={item._id}
                className={`list-item ${isActive ? 'active' : ''} ${!item.is_read ? 'unread' : ''}`}
                onClick={() => handleItemClick(item._id)}
            >
                {!item.is_read && <div className="unread-dot"></div>}
                <div className={`item-icon icon-blue`}>
                    <span className="material-symbols-outlined">{getIcon(item.category)}</span>
                </div>
                <div className="item-content">
                    <div className="item-header-row">
                        <h4 className="item-title">{item.title}</h4>
                        <span className="item-time">{formatDate(item.created_at)}</span>
                    </div>
                    <p className="item-subtitle">{item.message}</p>
                </div>
            </div>
        );
    };

    const renderMainPanel = () => {
        if (!currentSelectedItem) {
            return (
                <div className="main-empty-state">
                    <span className="material-symbols-outlined">forum</span>
                    <h3>{t('notif-page-select-item') || 'Select an item to view'}</h3>
                    <p>{t('notif-page-select-desc') || 'Choose a notification or conversation from the sidebar.'}</p>
                </div>
            );
        }

        const item = currentSelectedItem;
        return (
            <>
                <div className="panel-header">
                    <div className="panel-header-info">
                        <button className="mobile-back-btn" onClick={() => setIsMobileViewActive(false)}>
                            <span className="material-symbols-outlined">arrow_back_ios_new</span>
                        </button>
                        <div className="header-text">
                            <h3>{t('notif-page-details') || 'Notification Details'}</h3>
                        </div>
                    </div>
                    <div className="panel-actions">
                        <button className="action-icon-btn"><span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>delete</span></button>
                    </div>
                </div>
                <div className="panel-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <div className="detail-card">
                        <div className={`detail-icon icon-blue`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>{getIcon(item.category)}</span>
                        </div>
                        <h2>{item.title}</h2>
                        <p>{item.message}</p>
                        {item.link && (
                            <button className="detail-btn" onClick={() => navigate(item.link)}>
                                {item.category === 'quiz' ? 'Prendre le Quiz' : 'View Details'}
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_forward</span>
                            </button>
                        )}
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="notifications-container">
            <div className="notifications-page-header">
                <h1 className="notifications-title">
                    {t('notif-page-inbox') || 'Inbox'}
                    {filteredNotifications.filter(n => !n.is_read).length > 0 && (
                        <span className="notifications-badge">
                            {filteredNotifications.filter(n => !n.is_read).length}
                        </span>
                    )}
                </h1>
            </div>

            <div className={`notifications-layout`}>
                <div className={`notifications-sidebar ${isMobileViewActive ? 'hide-on-mobile' : ''}`}>
                    <div className="sidebar-header">
                        <div className="sidebar-tabs">
                            <button
                                className={`sidebar-tab-btn ${mainTab === 'notifications' ? 'active' : ''}`}
                                onClick={() => setMainTab('notifications')}
                            >
                                {t('notif-page-notifications') || 'Notifications'}
                            </button>
                            <button
                                className={`sidebar-tab-btn ${mainTab === 'messages' ? 'active' : ''}`}
                                disabled
                            >
                                {t('notif-page-messages') || 'Messages (Coming Soon)'}
                            </button>
                        </div>

                        <div className="list-filter-row">
                            <div className="list-filter-pills">
                                <button
                                    className={`pill-btn ${listFilter === 'all' ? 'active' : ''}`}
                                    onClick={() => setListFilter('all')}
                                >
                                    {t('notif-page-all') || 'All'}
                                </button>
                                <button
                                    className={`pill-btn ${listFilter === 'unread' ? 'active' : ''}`}
                                    onClick={() => setListFilter('unread')}
                                >
                                    {t('notif-page-unread') || 'Unread'}
                                </button>
                            </div>
                            <button className="mark-read-btn" onClick={markAllAsRead} title={t('notif-page-mark-read') || 'Mark all as read'}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>done_all</span>
                            </button>
                        </div>
                    </div>

                    <div className="sidebar-list">
                        {loading ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="list-item" style={{ gap: '1rem', padding: '1rem' }}>
                                    <Skeleton variant="circle" width="44px" height="44px" />
                                    <div className="item-content" style={{ flex: 1 }}>
                                        <div className="item-header-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <Skeleton variant="text" width="60%" height="0.9rem" />
                                            <Skeleton variant="text" width="30px" height="0.7rem" />
                                        </div>
                                        <Skeleton variant="text" width="90%" height="0.8rem" />
                                    </div>
                                </div>
                            ))
                        ) : filteredNotifications.length > 0 ? (
                            filteredNotifications.map(renderSidebarItem)
                        ) : (
                            <div className="list-empty-state">
                                <span className="material-symbols-outlined">notifications_off</span>
                                <p>No {listFilter === 'unread' ? 'unread ' : ''}notifications here.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`main-panel ${isMobileViewActive ? 'show-on-mobile' : ''}`}>
                    {renderMainPanel()}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
