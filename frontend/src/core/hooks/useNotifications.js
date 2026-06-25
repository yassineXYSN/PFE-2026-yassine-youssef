import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { getToken } from '../apiClient';

const normalizeServerUtcTimestamp = (value) => {
    if (typeof value !== 'string') return value;
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
        if (!getToken()) { setNotifications([]); setLoading(false); return; }
        if (!initialLoadDone.current) setLoading(true);
        try {
            const data = await apiFetch('/notifications/');
            setNotifications(data.map(normalizeNotification));
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            if (!initialLoadDone.current) { setLoading(false); initialLoadDone.current = true; }
        }
    }, []);

    const fetchUnreadCount = useCallback(async () => {
        if (!getToken()) { setUnreadCount(0); return; }
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
        if (!getToken()) { setLoading(false); return; }
        Promise.all([fetchUnreadCount(), fetchNotifications()]);

        const interval = setInterval(() => {
            if (getToken()) { fetchUnreadCount(); fetchNotifications(); }
        }, 10000);

        return () => clearInterval(interval);
    }, [fetchUnreadCount, fetchNotifications]);

    return useMemo(() => ({
        notifications, unreadCount, loading,
        fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead,
    }), [notifications, unreadCount, loading, fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead]);
}

export function NotificationsProvider({ children }) {
    const value = useNotificationsState();
    return createElement(NotificationsContext.Provider, { value }, children);
}

export function useNotifications() {
    const context = useContext(NotificationsContext);
    return context || useNotificationsState();
}
