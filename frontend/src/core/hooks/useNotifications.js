import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

const NotificationsContext = createContext(null);

function useNotificationsState() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const initialLoadDone = useRef(false);

    const fetchNotifications = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setNotifications([]);
            setLoading(false);
            return;
        }
        if (!initialLoadDone.current) {
            setLoading(true);
        }
        try {
            const data = await apiFetch('/notifications/');
            const normalized = data.map(normalizeNotification);
            setNotifications(normalized);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            if (!initialLoadDone.current) {
                setLoading(false);
                initialLoadDone.current = true;
            }
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

    const markAsRead = useCallback(async (id) => {
        try {
            await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark notification as read', err);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await apiFetch('/notifications/read-all', { method: 'PATCH' });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read', err);
        }
    }, []);

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setLoading(false);
                return;
            }
            await Promise.all([fetchUnreadCount(), fetchNotifications()]);
        };
        load();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                setNotifications([]);
                setUnreadCount(0);
                setLoading(false);
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

    return useMemo(() => ({
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead
    }), [
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
    ]);
}

export function NotificationsProvider({ children }) {
    const value = useNotificationsState();

    return createElement(NotificationsContext.Provider, { value }, children);
}

export function useNotifications() {
    const context = useContext(NotificationsContext);
    return context || useNotificationsState();
}
