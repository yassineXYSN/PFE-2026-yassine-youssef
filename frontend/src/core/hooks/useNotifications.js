import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';
import { supabase } from '../supabaseClient';

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

    const fetchNotifications = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setNotifications([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await apiFetch('/notifications/');
            const normalized = data.map(normalizeNotification);
            setNotifications(normalized);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUnreadCount = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setUnreadCount(0);
            return;
        }
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
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;
            await Promise.all([fetchUnreadCount(), fetchNotifications()]);
        };
        load();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                setNotifications([]);
                setUnreadCount(0);
                return;
            }
            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.access_token) {
                fetchUnreadCount();
                fetchNotifications();
            }
        });

        const interval = setInterval(() => {
            fetchUnreadCount();
            fetchNotifications();
        }, 10000);

        return () => {
            clearInterval(interval);
            subscription.unsubscribe();
        };
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
