import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../core/api';
import { supabase } from '../../../core/supabaseClient';
import { useLanguage } from '../../../core/useLanguage';
import './ProposeSlotsModal.css';

const TIME_SLOTS = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', 
    '16:00', '16:30', '17:00', '17:30', '18:00'
];

const DURATIONS = [
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '1h', value: 60 }
];

const INTERVIEW_TYPES = ['In-person', 'Video call'];

const ProposeSlotsModal = ({ isOpen, onClose, candidate, application, onSend }) => {
    const { t } = useLanguage();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSlots, setSelectedSlots] = useState([]);
    const [duration, setDuration] = useState(45);
    const [interviewType, setInterviewType] = useState('Video call');
    const [message, setMessage] = useState('');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [busySlots, setBusySlots] = useState([]);
    const [fetchingBusy, setFetchingBusy] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        const loadBusySlots = async () => {
            if (!isOpen) return;
            setFetchingBusy(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const recruiterId = session?.user?.id;
                if (recruiterId) {
                    const data = await apiFetch(`/interviews/busy-slots/${recruiterId}`);
                    setBusySlots(data || []);
                }
            } catch (err) {
                console.error("Failed to load busy slots", err);
            } finally {
                setFetchingBusy(false);
            }
        };
        loadBusySlots();
    }, [isOpen]);

    if (!isOpen) return null;

    // Calendar logic
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const firstDay = (getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth()) + 6) % 7; // Adjust to Monday start

    const dayLabels = [
        t('hr-modal-slots-day-mon'),
        t('hr-modal-slots-day-tue'),
        t('hr-modal-slots-day-wed'),
        t('hr-modal-slots-day-thu'),
        t('hr-modal-slots-day-fri'),
        t('hr-modal-slots-day-sat'),
        t('hr-modal-slots-day-sun'),
    ];
    const monthYearStr = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const isToday = (day) => {
        const today = new Date();
        return day === today.getDate() && 
               currentMonth.getMonth() === today.getMonth() && 
               currentMonth.getFullYear() === today.getFullYear();
    };

    const isDisabled = (day) => {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d < today;
    };

    const isSelected = (day) => {
        return day === selectedDate.getDate() && 
               currentMonth.getMonth() === selectedDate.getMonth() && 
               currentMonth.getFullYear() === selectedDate.getFullYear();
    };

    const handleDateClick = (day) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        setSelectedDate(newDate);
    };

    const toggleTimeSlot = (time) => {
        const slotId = `${selectedDate.toDateString()} ${time}`;
        if (selectedSlots.includes(slotId)) {
            setSelectedSlots(selectedSlots.filter(s => s !== slotId));
        } else if (selectedSlots.length < 6) {
            setSelectedSlots([...selectedSlots, slotId]);
        }
    };

    const removeSlot = (slotId) => {
        setSelectedSlots(selectedSlots.filter(s => s !== slotId));
    };

    // Group slots by date for better display
    const groupedSlots = selectedSlots.reduce((acc, slotId) => {
        const [datePart, timePart] = [slotId.substring(0, 15), slotId.substring(16)];
        if (!acc[datePart]) acc[datePart] = [];
        acc[datePart].push({ id: slotId, time: timePart });
        return acc;
    }, {});

    // Sort dates
    const sortedDates = Object.keys(groupedSlots).sort((a, b) => new Date(a) - new Date(b));

    const formatLongDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const handleSend = async () => {
        setSending(true);
        try {
            await onSend({
                slots: selectedSlots,
                duration,
                interviewType,
                message
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="ps-modal-overlay" onClick={onClose}>
            <div className="ps-modal-container" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <header className="ps-modal-header">
                    <h1 className="ps-header-title">{t('hr-modal-slots-header-title')}</h1>
                    <div className="ps-header-meta">
                        <div className="ps-candidate-info">
                            <span className="ps-candidate-name">
                                {candidate?.firstName} {candidate?.lastName}
                            </span>
                            {candidate?.profileImage ? (
                                <img src={candidate.profileImage} alt="Avatar" className="ps-candidate-avatar" />
                            ) : (
                                <div className="ps-avatar-fallback">
                                    {candidate?.firstName?.[0]}{candidate?.lastName?.[0]}
                                </div>
                            )}
                        </div>
                        <button className="ps-close-btn" onClick={onClose}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </header>

                {/* Body */}
                <div className="ps-modal-body">
                    <h2 className="ps-main-title">{t('hr-modal-slots-main-title')}</h2>
                    <p className="ps-main-subtitle">{t('hr-modal-slots-main-subtitle')}</p>

                    <div className="ps-layout-grid">
                        {/* Left Column: Calendar & Selected Proposals */}
                        <div className="ps-left-col">
                            <div className="ps-calendar-card">
                                <div className="ps-cal-nav">
                                    <span className="ps-cal-month">{monthYearStr}</span>
                                    <div className="ps-cal-arrows">
                                        <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}>
                                            <span className="material-symbols-outlined">chevron_left</span>
                                        </button>
                                        <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}>
                                            <span className="material-symbols-outlined">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="ps-cal-grid">
                                    {dayLabels.map((l, i) => <div key={i} className="ps-day-label">{l}</div>)}
                                    {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
                                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                        const disabled = isDisabled(day);
                                        return (
                                            <div 
                                                key={day} 
                                                className={`ps-day-cell ${isSelected(day) ? 'active' : ''} ${isToday(day) ? 'today' : ''} ${disabled ? 'disabled' : ''}`}
                                                onClick={() => !disabled && handleDateClick(day)}
                                            >
                                                {day}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                             <div className="ps-selected-proposals">
                                <label className="ps-section-label">{t('hr-modal-slots-selected-label')}</label>
                                <div className="ps-groups-container">
                                    {selectedSlots.length === 0 ? (
                                        <p style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>{t('hr-modal-slots-none-selected')}</p>
                                    ) : (
                                        sortedDates.map(dateStr => (
                                            <div key={dateStr} className="ps-date-group">
                                                <div className="ps-group-header">{formatLongDate(dateStr)}</div>
                                                <div className="ps-group-times">
                                                    {groupedSlots[dateStr].sort((a,b) => a.time.localeCompare(b.time)).map(slot => (
                                                        <div key={slot.id} className="ps-proposal-tag">
                                                            <span>{slot.time}</span>
                                                            <button className="ps-tag-remove" onClick={() => removeSlot(slot.id)}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Times, Options, Message */}
                        <div className="ps-right-col">
                             <label className="ps-section-label">
                                {t('hr-modal-slots-available-label')} ({selectedDate.toLocaleDateString('fr-FR', { month: 'long', day: 'numeric' }).toUpperCase()})
                                {fetchingBusy && <span style={{ marginLeft: '10px', fontSize: '10px', color: 'var(--tf-primary)' }}>{t('hr-modal-slots-loading')}</span>}
                            </label>
                            <div className="ps-time-bubbles">
                                {TIME_SLOTS.map(time => {
                                     const slotId = `${selectedDate.toDateString()} ${time}`;
                                    const isSelected = selectedSlots.includes(slotId);
                                    
                                    const slotStart = new Date(selectedDate);
                                    const [hours, minutes] = time.split(':').map(Number);
                                    slotStart.setHours(hours, minutes, 0, 0);
                                    const slotEnd = new Date(slotStart.getTime() + duration * 60000);

                                    // Block past slots
                                    const isPast = slotStart <= new Date();

                                    let isConfirmedBusy = false;
                                    let isPendingBusy = false;

                                    busySlots.forEach(busy => {
                                        const bStart = new Date(busy.start);
                                        const bEnd = new Date(busy.end);
                                        if (slotStart < bEnd && slotEnd > bStart) {
                                            if (busy.is_pending) isPendingBusy = true;
                                            else isConfirmedBusy = true;
                                        }
                                    });

                                    const isBusy = isConfirmedBusy || isPendingBusy;
                                    const isLimitReached = selectedSlots.length >= 6;
                                    const isClosed = (isLimitReached && !isSelected) || isBusy || isPast;

                                    return (
                                        <button 
                                            key={time} 
                                            className={`ps-time-bubble ${isSelected ? 'active' : ''} ${isBusy ? 'busy' : ''} ${isPast && !isBusy ? 'closed' : ''} ${isClosed && !isBusy && !isPast ? 'closed' : ''}`}
                                            style={isPendingBusy && !isConfirmedBusy ? { borderStyle: 'dashed', opacity: 0.8 } : {}}
                                            onClick={() => !isBusy && !isPast && toggleTimeSlot(time)}
                                            disabled={isClosed}
                                            title={isConfirmedBusy ? t('hr-modal-slots-busy-confirmed') : isPendingBusy ? t('hr-modal-slots-busy-pending') : isPast ? t('hr-modal-slots-past') : ""}
                                        >
                                            {time}
                                            {isConfirmedBusy && <span className="ps-busy-label" style={{ fontSize: '8px', position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', opacity: 0.7 }}>{t('hr-modal-slots-busy-label-confirmed')}</span>}
                                            {isPendingBusy && !isConfirmedBusy && <span className="ps-busy-label" style={{ fontSize: '8px', position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', opacity: 0.7, color: 'var(--tf-warning-muted)' }}>{t('hr-modal-slots-busy-label-pending')}</span>}
                                            {isPast && !isBusy && <span className="ps-busy-label" style={{ fontSize: '8px', position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', opacity: 0.7 }}>{t('hr-modal-slots-past-label')}</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="ps-options-grid">
                                 <div>
                                    <label className="ps-section-label">{t('hr-modal-slots-duration-label')}</label>
                                    <div className="ps-segmented-control">
                                        {DURATIONS.map(d => (
                                            <button 
                                                key={d.value}
                                                className={`ps-segment-btn ${duration === d.value ? 'active' : ''}`}
                                                onClick={() => setDuration(d.value)}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                 <div>
                                    <label className="ps-section-label">{t('hr-modal-slots-type-label')}</label>
                                    <div className="ps-type-group">
                                        {INTERVIEW_TYPES.map(t => (
                                            <button 
                                                key={t}
                                                className={`ps-type-btn ${interviewType === t ? 'active' : ''}`}
                                                onClick={() => setInterviewType(t)}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                             <div className="ps-message-area">
                                <label className="ps-section-label">{t('hr-modal-slots-message-label')}</label>
                                <textarea
                                    className="ps-textarea"
                                    placeholder={t('hr-modal-slots-message-placeholder')}
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="ps-modal-footer">
                    <div className="ps-footer-status">
                         <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>event_available</span>
                        <span>{t('hr-modal-slots-footer-count', { count: selectedSlots.length })}</span>
                    </div>
                         <div className="ps-footer-actions">
                        <button className="ps-cancel-link" onClick={onClose}>{t('hr-modal-slots-cancel')}</button>
                        <button
                            className="ps-submit-btn"
                            disabled={selectedSlots.length === 0 || sending}
                            onClick={handleSend}
                        >
                            {sending ? (
                                <>
                                    <span className="ps-submit-spinner" />
                                    {t('hr-modal-slots-sending')}
                                </>
                            ) : t('hr-modal-slots-send')}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default ProposeSlotsModal;
