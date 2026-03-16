import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../../../core/useLanguage';
import Skeleton from '../../components/Skeleton/Skeleton';
import './Notifications.css';

const Notifications = () => {
    const { t } = useLanguage();
    // --- State ---
    const [mainTab, setMainTab] = useState('notifications'); // 'notifications' or 'messages'
    const [listFilter, setListFilter] = useState('all'); // 'all', 'unread', etc.
    const [selectedItemId, setSelectedItemId] = useState(null); // ID of active generic notification OR chat
    const [chatInput, setChatInput] = useState('');
    const [isMobileViewActive, setIsMobileViewActive] = useState(false); // For responsive sliding panes
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1200);
        return () => clearTimeout(timer);
    }, []);

    const messagesEndRef = useRef(null);

    // Auto-scroll chat to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (mainTab === 'messages') {
            scrollToBottom();
        }
    }, [selectedItemId]);

    // Disable main dashboard scrolling while on this page only
    useEffect(() => {
        const mainEl = document.querySelector('.dashboard-main');
        if (!mainEl) return;
        mainEl.classList.add('notifications-no-scroll');
        return () => {
            mainEl.classList.remove('notifications-no-scroll');
        };
    }, []);

    // --- Mock Data ---
    const [notifications, setNotifications] = useState([
        {
            id: 'n1',
            type: 'application',
            title: 'Interview Scheduled',
            message: 'TechFlow has requested a first-round interview.',
            fullMessage: 'TechFlow has successfully scheduled your first-round interview for next Tuesday. Please check your email to confirm the calendar invite and review the preparation materials.',
            time: '10m ago',
            read: false,
            icon: 'event_available',
            iconClass: 'icon-purple',
            actionText: 'View Application'
        },
        {
            id: 'n2',
            type: 'job',
            title: '5 New Matches',
            message: 'New roles match your saved search criteria.',
            fullMessage: 'We found 5 new roles matching your "Frontend Developer" criteria. One from Nexus Corp features a 95% skill overlap with your profile. Apply within the next 24 hours to secure early-applicant status.',
            time: '2h ago',
            read: true,
            icon: 'work',
            iconClass: 'icon-blue',
            actionText: 'Review Jobs'
        },
        {
            id: 'n3',
            type: 'profile',
            title: 'Stand out globally',
            message: 'Add languages to boost your visibility.',
            fullMessage: 'Your profile is currently 80% complete. Add your Language proficiencies to increase your visibility to global recruiters who use multi-lingual filtering.',
            time: '1d ago',
            read: true,
            icon: 'translate',
            iconClass: 'icon-orange',
            actionText: 'Complete Profile'
        }
    ]);

    const [conversations, setConversations] = useState([
        {
            id: 'c1',
            recruiterName: 'Sarah Jenkins',
            company: 'Nexus Corp',
            role: 'Technical Recruiter',
            avatar: 'SJ',
            avatarColor: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            online: true,
            unread: true,
            lastMessageTime: '10:42 AM',
            messages: [
                { id: 'm1', sender: 'recruiter', text: 'Hi there! Your profile caught my eye. Are you actively looking for new opportunities?', time: '10:30 AM' },
                { id: 'm2', sender: 'candidate', text: 'Hello Sarah! Yes, I am currently exploring Senior Frontend roles.', time: '10:35 AM' },
                { id: 'm3', sender: 'recruiter', text: 'Great! We have an opening at Nexus Corp that aligns perfectly with your React experience. Do you have 15 minutes for a quick chat tomorrow?', time: '10:42 AM' }
            ]
        },
        {
            id: 'c2',
            recruiterName: 'David Lee',
            company: 'TechFlow',
            role: 'Talent Acquisition',
            avatar: 'DL',
            avatarColor: 'linear-gradient(135deg, #0f172a, #334155)',
            online: false,
            unread: false,
            lastMessageTime: 'Yesterday',
            messages: [
                { id: 'm1', sender: 'recruiter', text: 'Thanks for applying to the Product Designer role! We are reviewing your portfolio.', time: 'Yesterday 2:00 PM' },
                { id: 'm2', sender: 'recruiter', text: 'I will be your main point of contact. Feel free to reach out if you have any questions about the process.', time: 'Yesterday 2:02 PM' }
            ]
        }
    ]);

    // --- Derived State ---
    const activeDataList = mainTab === 'notifications' ? notifications : conversations;

    // In mobile, we select via state, in desktop we default to the first if none selected
    const currentSelectedItem = activeDataList.find(item => item.id === selectedItemId)
        || (window.innerWidth > 768 && activeDataList.length > 0 ? activeDataList[0] : null);

    // --- Handlers ---
    const handleItemClick = (id) => {
        setSelectedItemId(id);
        setIsMobileViewActive(true);

        // Mark as read logic
        if (mainTab === 'notifications') {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } else {
            setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: false } : c));
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !currentSelectedItem || mainTab !== 'messages') return;

        const newMessage = {
            id: `m${Date.now()}`,
            sender: 'candidate',
            text: chatInput,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setConversations(prev => prev.map(c => {
            if (c.id === currentSelectedItem.id) {
                return { ...c, messages: [...c.messages, newMessage], lastMessageTime: newMessage.time };
            }
            return c;
        }));
        setChatInput('');
        setTimeout(scrollToBottom, 50);
    };


    // --- Render Helpers ---
    const renderSidebarItem = (item) => {
        if (mainTab === 'notifications') {
            const isActive = currentSelectedItem?.id === item.id;
            return (
                <div
                    key={item.id}
                    className={`list-item ${isActive ? 'active' : ''} ${!item.read ? 'unread' : ''}`}
                    onClick={() => handleItemClick(item.id)}
                >
                    {!item.read && <div className="unread-dot"></div>}
                    <div className={`item-icon ${item.iconClass}`}>
                        <span className="material-symbols-outlined">{item.icon}</span>
                    </div>
                    <div className="item-content">
                        <div className="item-header-row">
                            <h4 className="item-title">{item.title}</h4>
                            <span className="item-time">{item.time}</span>
                        </div>
                        <p className="item-subtitle">{item.message}</p>
                    </div>
                </div>
            );
        } else {
            // Messages Tab
            const isActive = currentSelectedItem?.id === item.id;
            const lastMsg = item.messages[item.messages.length - 1];
            return (
                <div
                    key={item.id}
                    className={`list-item ${isActive ? 'active' : ''} ${item.unread ? 'unread' : ''}`}
                    onClick={() => handleItemClick(item.id)}
                >
                    {item.unread && <div className="unread-dot"></div>}
                    <div className="item-avatar" style={{ background: item.avatarColor, position: 'relative' }}>
                        {item.avatar}
                        {item.online && <div className="online-indicator"></div>}
                    </div>
                    <div className="item-content">
                        <div className="item-header-row">
                            <h4 className="item-title">{item.recruiterName}</h4>
                            <span className="item-time">{item.lastMessageTime}</span>
                        </div>
                        <p className="item-subtitle" style={{ fontWeight: item.unread ? 600 : 400 }}>
                            {lastMsg.sender === 'candidate' ? 'You: ' : ''}{lastMsg.text}
                        </p>
                    </div>
                </div>
            );
        }
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

        if (loading) {
            return (
                <div style={{ padding: '2rem' }}>
                    <div className="panel-header" style={{ padding: '0 0 1.5rem 0', borderBottom: '1px solid var(--dashboard-border)', marginBottom: '2rem' }}>
                        <div className="panel-header-info">
                            <Skeleton variant="circle" width="48px" height="48px" />
                            <div className="header-text">
                                <Skeleton variant="text" width="150px" height="1.2rem" style={{ marginBottom: '0.4rem' }} />
                                <Skeleton variant="text" width="100px" height="0.8rem" />
                            </div>
                        </div>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <Skeleton variant="rectangle" width="70%" height="80px" style={{ borderRadius: '1rem' }} />
                        <Skeleton variant="rectangle" width="60%" height="60px" style={{ borderRadius: '1rem', alignSelf: 'flex-end' }} />
                        <Skeleton variant="rectangle" width="80%" height="100px" style={{ borderRadius: '1rem' }} />
                    </div>
                </div>
            );
        }

        if (mainTab === 'notifications') {
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
                            <div className={`detail-icon ${item.iconClass}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>{item.icon}</span>
                            </div>
                            <h2>{item.title}</h2>
                            <p>{item.fullMessage}</p>
                            <button className="detail-btn">
                                {item.actionText}
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_forward</span>
                            </button>
                        </div>
                    </div>
                </>
            );
        } else {
            // Chat View
            const chat = currentSelectedItem;
            return (
                <>
                    <div className="panel-header">
                        <div className="panel-header-info">
                            <button className="mobile-back-btn" onClick={() => setIsMobileViewActive(false)}>
                                <span className="material-symbols-outlined">arrow_back_ios_new</span>
                            </button>
                            <div className="header-avatar" style={{ background: chat.avatarColor }}>
                                {chat.avatar}
                                {chat.online && <div className="online-indicator"></div>}
                            </div>
                            <div className="header-text">
                                <h3>{chat.recruiterName}</h3>
                                <p>{chat.role} at {chat.company}</p>
                            </div>
                        </div>
                        <div className="panel-actions">
                            <button className="action-icon-btn" title={t('notif-page-view-profile') || 'View Profile'}><span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>person</span></button>
                            <button className="action-icon-btn" title={t('notif-page-more-options') || 'More options'}><span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>more_vert</span></button>
                        </div>
                    </div>

                    <div className="panel-body">
                        {chat.messages.map((msg) => (
                            <div key={msg.id} className={`message-row ${msg.sender === 'candidate' ? 'sent' : 'received'}`}>
                                <div className="chat-bubble">
                                    {msg.text}
                                    <span className="bubble-time">{msg.time}</span>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="panel-footer" onSubmit={handleSendMessage}>
                        <div className="chat-input-wrapper">
                            <button type="button" className="chat-attach-btn">
                                <span className="material-symbols-outlined">attach_file</span>
                            </button>
                            <textarea
                                className="chat-input"
                                placeholder={t('notif-page-type-message') || 'Type a message...'}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                                rows={1}
                            />
                            <button type="submit" className="chat-send-btn" disabled={!chatInput.trim()}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>send</span>
                            </button>
                        </div>
                    </form>
                </>
            );
        }
    };


    // --- Main Render ---
    return (
        <div className="notifications-container">
            <div className="notifications-page-header">
                <h1 className="notifications-title">
                    {t('notif-page-inbox') || 'Inbox'}
                    {activeDataList.filter(i => (i.read === false || i.unread === true)).length > 0 && (
                        <span className="notifications-badge">
                            {activeDataList.filter(i => (i.read === false || i.unread === true)).length}
                        </span>
                    )}
                </h1>
            </div>

            <div className={`notifications-layout`}>
                {/* Left Sidebar */}
                <div className={`notifications-sidebar ${isMobileViewActive ? 'hide-on-mobile' : ''}`}>
                    <div className="sidebar-header">
                        <div className="sidebar-tabs">
                            <button
                                className={`sidebar-tab-btn ${mainTab === 'notifications' ? 'active' : ''}`}
                                onClick={() => { setMainTab('notifications'); setListFilter('all'); setSelectedItemId(null); setIsMobileViewActive(false); }}
                            >
                                {t('notif-page-notifications') || 'Notifications'}
                            </button>
                            <button
                                className={`sidebar-tab-btn ${mainTab === 'messages' ? 'active' : ''}`}
                                onClick={() => { setMainTab('messages'); setListFilter('all'); setSelectedItemId(null); setIsMobileViewActive(false); }}
                            >
                                {t('notif-page-messages') || 'Messages'}
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
                            <button className="mark-read-btn" title={t('notif-page-mark-read') || 'Mark all as read'}>
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
                        ) : activeDataList.filter(item => {
                            if (listFilter === 'all') return true;
                            if (listFilter === 'unread') return mainTab === 'notifications' ? !item.read : item.unread;
                            return true;
                        }).length > 0 ? (
                            activeDataList.filter(item => {
                                if (listFilter === 'all') return true;
                                if (listFilter === 'unread') return mainTab === 'notifications' ? !item.read : item.unread;
                                return true;
                            }).map(renderSidebarItem)
                        ) : (
                            <div className="list-empty-state">
                                <span className="material-symbols-outlined">
                                    {mainTab === 'notifications' ? 'notifications_off' : 'forum'}
                                </span>
                                <p>No {listFilter === 'unread' ? 'unread ' : ''}{mainTab} here.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Main Panel */}
                <div className={`main-panel ${isMobileViewActive ? 'show-on-mobile' : ''}`}>
                    {renderMainPanel()}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
