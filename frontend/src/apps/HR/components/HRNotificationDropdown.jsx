import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../core/useLanguage';
import './HRNotificationDropdown.css';

const HRNotificationDropdown = ({ notifications, onClose, onMarkRead, onMarkAllRead }) => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const handleNotifClick = (notif) => {
        onMarkRead(notif._id);
        if (notif.link) {
            navigate(notif.link);
        }
        onClose();
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="hr-notif-dropdown">
            <div className="hr-notif-header">
                <h3>{t('hr-notif-title')}</h3>
                <button onClick={onMarkAllRead} className="hr-notif-clear">{t('hr-notif-mark-all-read')}</button>
            </div>
            <div className="hr-notif-list">
                {notifications.length === 0 ? (
                    <div className="hr-notif-empty">{t('hr-notif-empty')}</div>
                ) : (
                    notifications.map((notif) => (
                        <div 
                            key={notif._id} 
                            className={`hr-notif-item ${notif.is_read ? 'is-read' : 'unread'}`}
                            onClick={() => handleNotifClick(notif)}
                        >
                            <div className="hr-notif-icon">
                                <span className="material-symbols-outlined">
                                    {notif.category === 'quiz' ? 'quiz' : 'description'}
                                </span>
                            </div>
                            <div className="hr-notif-content">
                                <p className="hr-notif-title">{notif.title}</p>
                                <p className="hr-notif-msg">{notif.message}</p>
                                <span className="hr-notif-time">{formatDate(notif.created_at)}</span>
                            </div>
                            {!notif.is_read && <div className="hr-notif-unread-dot"></div>}
                        </div>
                    ))
                )}
            </div>
            <div className="hr-notif-footer">
                <button onClick={() => navigate('/hr/notifications')}>{t('hr-notif-see-all')}</button>
            </div>
        </div>
    );
};

export default HRNotificationDropdown;
