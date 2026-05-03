import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import HRSidebar from '../components/HRSidebar';
import { useNotifications } from '../../../core/hooks/useNotifications';
import './Notifications.css';

const CATEGORY_META = {
    application: { icon: 'description',    label: 'Candidature',  color: '#eab308' }, // Yellow
    quiz:        { icon: 'quiz',            label: 'Quiz',         color: '#f59e0b' }, // Amber
    interview:   { icon: 'video_call',      label: 'Entretien',    color: '#d97706' }, // Darker Amber
    security:    { icon: 'security',        label: 'Sécurité',     color: '#ef4444' }, // Keep red for security
    system:      { icon: 'notifications',   label: 'Système',      color: '#fcd34d' }, // Light yellow
    default:     { icon: 'circle_notifications', label: 'Général', color: '#94a3b8' },
};

const getCategoryMeta = (cat) => CATEGORY_META[cat] || CATEGORY_META.default;

const groupByDay = (notifs) => {
    const groups = {};
    const todayKey = new Date().toDateString();
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yesterdayKey = yest.toDateString();

    notifs.forEach(n => {
        const key = new Date(n.created_at).toDateString();
        if (!groups[key]) groups[key] = [];
        groups[key].push(n);
    });

    return Object.entries(groups)
        .sort(([a], [b]) => new Date(b) - new Date(a))
        .map(([key, items]) => ({
            label: key === todayKey ? "Aujourd'hui" : key === yesterdayKey ? 'Hier'
                : new Date(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
            items,
        }));
};

const fmtTime = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) + ' à ' + fmtTime(d);

const FILTERS = [
    { key: 'all',         label: 'Toutes',       icon: 'all_inbox' },
    { key: 'unread',      label: 'Non lues',     icon: 'mark_email_unread' },
    { key: 'application', label: 'Candidatures', icon: 'description' },
    { key: 'quiz',        label: 'Quiz',         icon: 'quiz' },
    { key: 'interview',   label: 'Entretiens',   icon: 'video_call' },
];

export default function HRNotifications() {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const { notifications, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState(null);

    const isDark = effectiveTheme === 'dark';

    const filtered = notifications.filter(n => {
        if (filter === 'unread') return !n.is_read;
        if (filter === 'all') return true;
        return n.category === filter;
    });

    const grouped = groupByDay(filtered);
    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleClick = (notif) => {
        setSelected(notif);
        if (!notif.is_read) markAsRead(notif._id);
    };

    const handleDelete = (id) => {
        deleteNotification(id);
        if (selected?._id === id) setSelected(null);
    };

    return (
        <div className={`hr-notif-shell ${isDark ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="hr-notif-main">
                {/* ── Header ── */}
                <div className="hr-notif-header">
                    <div className="hr-notif-header-left">
                        <h1 className="hr-notif-title">
                            Centre de Notifications
                            {unreadCount > 0 && (
                                <span className="hr-notif-badge">{unreadCount}</span>
                            )}
                        </h1>
                        <p className="hr-notif-subtitle">Gérez vos alertes de recrutement et activités en temps réel</p>
                    </div>
                    <button
                        className="hr-notif-btn-outline"
                        onClick={markAllAsRead}
                        disabled={unreadCount === 0}
                    >
                        <span className="material-symbols-outlined">done_all</span>
                        Tout marquer comme lu
                    </button>
                </div>

                {/* ── Filter chips ── */}
                <div className="hr-notif-filters">
                    {FILTERS.map(f => {
                        const cnt = f.key === 'all' ? notifications.length
                            : f.key === 'unread' ? unreadCount
                            : notifications.filter(n => n.category === f.key).length;
                        return (
                            <button
                                key={f.key}
                                className={`hr-notif-chip ${filter === f.key ? 'active' : ''}`}
                                onClick={() => setFilter(f.key)}
                            >
                                <span className="material-symbols-outlined">{f.icon}</span>
                                {f.label}
                                {cnt > 0 && <span className="chip-count">{cnt}</span>}
                            </button>
                        );
                    })}
                </div>

                {/* ── Split panel ── */}
                <div className="hr-notif-body">
                    {/* List panel */}
                    <div className="hr-notif-list">
                        {loading && notifications.length === 0 ? (
                            <div className="hr-notif-skeleton">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="skeleton-card">
                                        <div className="skeleton-icon" />
                                        <div className="skeleton-lines">
                                            <div className="skeleton-line w70" />
                                            <div className="skeleton-line w50" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="hr-notif-empty">
                                <span className="material-symbols-outlined">notifications_off</span>
                                <p>Aucune notification</p>
                                <span>Vous êtes à jour !</span>
                            </div>
                        ) : (
                            grouped.map(group => (
                                <div key={group.label} className="hr-notif-group">
                                    <div className="hr-notif-group-label">{group.label}</div>
                                    {group.items.map(notif => {
                                        const meta = getCategoryMeta(notif.category);
                                        const isSelected = selected?._id === notif._id;
                                        return (
                                            <div
                                                key={notif._id}
                                                className={`hr-notif-item ${notif.is_read ? 'read' : 'unread'} ${isSelected ? 'selected' : ''}`}
                                                onClick={() => handleClick(notif)}
                                            >
                                                <div
                                                    className="hr-notif-item-icon"
                                                    style={{ '--cat-color': meta.color }}
                                                >
                                                    <span className="material-symbols-outlined">{meta.icon}</span>
                                                </div>
                                                <div className="hr-notif-item-body">
                                                    <div className="hr-notif-item-top">
                                                        <span className="hr-notif-item-category" style={{ color: meta.color }}>
                                                            {meta.label}
                                                        </span>
                                                        <span className="hr-notif-item-time">{fmtTime(notif.created_at)}</span>
                                                    </div>
                                                    <p className="hr-notif-item-title">{notif.title}</p>
                                                    <p className="hr-notif-item-msg">{notif.message}</p>
                                                </div>
                                                {!notif.is_read && <div className="hr-notif-dot" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Detail panel */}
                    <div className="hr-notif-detail">
                        {selected ? (() => {
                            const meta = getCategoryMeta(selected.category);
                            return (
                                <div className="hr-notif-detail-content">
                                    <div className="hr-notif-detail-top">
                                        <div className="hr-notif-detail-icon" style={{ '--cat-color': meta.color }}>
                                            <span className="material-symbols-outlined">{meta.icon}</span>
                                        </div>
                                        <div>
                                            <span className="hr-notif-detail-cat" style={{ color: meta.color }}>{meta.label}</span>
                                            <h2 className="hr-notif-detail-title">{selected.title}</h2>
                                            <p className="hr-notif-detail-date">{fmtDate(selected.created_at)}</p>
                                        </div>
                                    </div>

                                    <div className="hr-notif-detail-divider" />

                                    <p className="hr-notif-detail-msg">{selected.message}</p>

                                    {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                                        <div className="hr-notif-detail-meta">
                                            {selected.metadata.job_title && (
                                                <div className="meta-chip">
                                                    <span className="material-symbols-outlined">work</span>
                                                    {selected.metadata.job_title}
                                                </div>
                                            )}
                                            {selected.metadata.company_name && (
                                                <div className="meta-chip">
                                                    <span className="material-symbols-outlined">business</span>
                                                    {selected.metadata.company_name}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="hr-notif-detail-actions">
                                        {selected.link && (
                                            <button
                                                className="hr-notif-btn-primary"
                                                onClick={() => navigate(selected.link)}
                                            >
                                                <span className="material-symbols-outlined">open_in_new</span>
                                                Voir les détails
                                            </button>
                                        )}
                                        <button
                                            className="hr-notif-btn-danger"
                                            onClick={() => handleDelete(selected._id)}
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                            Supprimer
                                        </button>
                                    </div>
                                </div>
                            );
                        })() : (
                            <div className="hr-notif-detail-empty">
                                <div className="hr-notif-detail-empty-icon">
                                    <span className="material-symbols-outlined">touch_app</span>
                                </div>
                                <p>Sélectionnez une notification</p>
                                <span>Les détails s'afficheront ici</span>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
