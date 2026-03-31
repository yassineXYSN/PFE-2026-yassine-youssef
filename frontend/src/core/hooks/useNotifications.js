import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

const normalizeServerUtcTimestamp = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const hasExplicitTimezone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(value);
    return hasExplicitTimezone ? value : `${value}Z`;
};

const normalizeNotification = (notification) => ({
    ...notification,
    created_at: normalizeServerUtcTimestamp(notification.created_at),
});

export function useNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [imminentInterview, setImminentInterview] = useState(null);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch('/notifications/');
            const normalized = data.map(normalizeNotification);
            setNotifications(normalized);
            
            // Detect if any unread notification is about an imminent interview (within last hour)
            const oneHourAgo = new Date(Date.now() - 3600000);
            const imminent = normalized.find(n => 
                !n.is_read && 
                n.category === 'interview' && 
                new Date(n.created_at) > oneHourAgo &&
                (n.message.toLowerCase().includes('commence') || n.message.toLowerCase().includes('imminent'))
            );
            
            if (imminent) {
                setImminentInterview({
                    id: imminent._id,
                    link: imminent.link || `/candidat/interviews/room/${imminent._id}`,
                    message: imminent.message
                });
            } else {
                setImminentInterview(null);
            }
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const data = await apiFetch('/notifications/unread-count');
            setUnreadCount(data.count);
        } catch (err) {
            console.error('Failed to fetch unread count', err);
        }
    }, []);

    const markAsRead = async (id) => {
        try {
            await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark notification as read', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await apiFetch('/notifications/read-all', { method: 'PATCH' });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read', err);
        }
    };

    useEffect(() => {
        fetchUnreadCount();
        fetchNotifications();

        const interval = setInterval(() => {
            fetchUnreadCount();
            fetchNotifications();
        }, 10000); // Poll every 10 seconds

        return () => clearInterval(interval);
    }, [fetchUnreadCount, fetchNotifications]);

    return {
        notifications,
        unreadCount,
        imminentInterview,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead
    };
}
