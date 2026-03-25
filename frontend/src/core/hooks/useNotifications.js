import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

export function useNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch('/notifications/');
            setNotifications(data);
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
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead
    };
}
