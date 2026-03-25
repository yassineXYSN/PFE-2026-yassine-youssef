import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../../core/hooks/useNotifications';
import './Notifications.css';

const HRNotifications = () => {
    const navigate = useNavigate();
    const { notifications, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [filter, setFilter] = useState('all');
    const [selectedNotif, setSelectedNotif] = useState(null);

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') return !n.is_read;
        if (filter === 'application') return n.category === 'application';
        if (filter === 'quiz') return n.category === 'quiz';
        return true;
    });

    const handleNotifClick = (notif) => {
        setSelectedNotif(notif);
        if (!notif.is_read) {
            markAsRead(notif._id);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading && notifications.length === 0) {
        return <div className="hr-notif-loading">Chargement des notifications...</div>;
    }

    return (
        <div className="hr-notifications-page">
            <div className="hr-notif-page-header">
                <div>
                    <h1>Centre de Notifications</h1>
                    <p>Gérez vos alertes de recrutement et activités de quiz</p>
                </div>
                <button 
                    className="hr-notif-btn-secondary"
                    onClick={markAllAsRead}
                    disabled={notifications.every(n => n.is_read)}
                >
                    Tout marquer comme lu
                </button>
            </div>

            <div className="hr-notif-tabs">
                <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Toutes</button>
                <button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Non lues</button>
                <button className={filter === 'application' ? 'active' : ''} onClick={() => setFilter('application')}>Candidatures</button>
                <button className={filter === 'quiz' ? 'active' : ''} onClick={() => setFilter('quiz')}>Quiz</button>
            </div>

            <div className="hr-notif-main-grid">
                <div className="hr-notif-list-container">
                    {filteredNotifications.length === 0 ? (
                        <div className="hr-notif-empty-state">
                            <span className="material-symbols-outlined">notifications_off</span>
                            <p>Aucune notification trouvée</p>
                        </div>
                    ) : (
                        filteredNotifications.map(notif => (
                            <div 
                                key={notif._id}
                                className={`hr-notif-card ${notif.is_read ? 'read' : 'unread'} ${selectedNotif?._id === notif._id ? 'selected' : ''}`}
                                onClick={() => handleNotifClick(notif)}
                            >
                                <div className="hr-notif-card-icon">
                                    <span className="material-symbols-outlined">
                                        {notif.category === 'quiz' ? 'quiz' : 'description'}
                                    </span>
                                </div>
                                <div className="hr-notif-card-body">
                                    <h4>{notif.title}</h4>
                                    <p>{notif.message}</p>
                                    <span className="time">{formatDate(notif.created_at)}</span>
                                </div>
                                {!notif.is_read && <div className="unread-indicator"></div>}
                            </div>
                        ))
                    )}
                </div>

                <div className="hr-notif-detail-view">
                    {selectedNotif ? (
                        <div className="hr-notif-detail-content">
                            <div className="detail-header">
                                <span className="material-symbols-outlined large-icon">
                                    {selectedNotif.category === 'quiz' ? 'quiz' : 'description'}
                                </span>
                                <h2>{selectedNotif.title}</h2>
                                <p className="detail-time">{formatDate(selectedNotif.created_at)}</p>
                            </div>
                            <div className="detail-body">
                                <p>{selectedNotif.message}</p>
                                {selectedNotif.link && (
                                    <button 
                                        className="hr-notif-btn-primary"
                                        onClick={() => navigate(selectedNotif.link)}
                                    >
                                        Voir les détails
                                    </button>
                                )}
                            </div>
                            <div className="detail-actions">
                                <button 
                                    className="hr-notif-btn-danger"
                                    onClick={() => {
                                        deleteNotification(selectedNotif._id);
                                        setSelectedNotif(null);
                                    }}
                                >
                                    Supprimer cette notification
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="hr-notif-detail-placeholder">
                            <span className="material-symbols-outlined">info</span>
                            <p>Sélectionnez une notification pour voir les détails</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HRNotifications;
