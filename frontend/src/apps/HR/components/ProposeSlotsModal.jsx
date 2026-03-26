import React, { useState, useEffect } from 'react';
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
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSlots, setSelectedSlots] = useState([]);
    const [duration, setDuration] = useState(45);
    const [interviewType, setInterviewType] = useState('Video call');
    const [message, setMessage] = useState('');
    const [currentMonth, setCurrentMonth] = useState(new Date());

    if (!isOpen) return null;

    // Calendar logic
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const firstDay = (getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth()) + 6) % 7; // Adjust to Monday start

    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const monthYearStr = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
        } else {
            setSelectedSlots([...selectedSlots, slotId]);
        }
    };

    const removeSlot = (slotId) => {
        setSelectedSlots(selectedSlots.filter(s => s !== slotId));
    };

    const formatSlotLabel = (slotId) => {
        const [datePart, timePart] = [slotId.substring(0, 15), slotId.substring(16)];
        const d = new Date(datePart);
        return `${d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} · ${timePart}`;
    };

    const handleSend = () => {
        onSend({
            slots: selectedSlots,
            duration,
            interviewType,
            message
        });
    };

    return (
        <div className="ps-modal-overlay" onClick={onClose}>
            <div className="ps-modal-container" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <header className="ps-modal-header">
                    <h1 className="ps-header-title">Propose Interview Slots</h1>
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
                    <h2 className="ps-main-title">Select one or more slots to propose to the candidate</h2>
                    <p className="ps-main-subtitle">Review candidate availability and suggest optimal meeting times.</p>

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
                                <label className="ps-section-label">SELECTED PROPOSALS</label>
                                <div className="ps-tags-container">
                                    {selectedSlots.length === 0 ? (
                                        <p style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>No slots selected yet.</p>
                                    ) : (
                                        selectedSlots.map(slot => (
                                            <div key={slot} className="ps-proposal-tag">
                                                <span>{formatSlotLabel(slot)}</span>
                                                <button className="ps-tag-remove" onClick={() => removeSlot(slot)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Times, Options, Message */}
                        <div className="ps-right-col">
                            <label className="ps-section-label">
                                AVAILABLE TIMES ({selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()})
                            </label>
                            <div className="ps-time-bubbles">
                                {TIME_SLOTS.map(time => {
                                    const slotId = `${selectedDate.toDateString()} ${time}`;
                                    return (
                                        <button 
                                            key={time} 
                                            className={`ps-time-bubble ${selectedSlots.includes(slotId) ? 'active' : ''}`}
                                            onClick={() => toggleTimeSlot(time)}
                                        >
                                            {time}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="ps-options-grid">
                                <div>
                                    <label className="ps-section-label">DURATION</label>
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
                                    <label className="ps-section-label">INTERVIEW TYPE</label>
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
                                <label className="ps-section-label">MESSAGE TO CANDIDATE</label>
                                <textarea 
                                    className="ps-textarea" 
                                    placeholder="Add a message to the candidate..."
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
                        <span>{selectedSlots.length} slots selected</span>
                    </div>
                    <div className="ps-footer-actions">
                        <button className="ps-cancel-link" onClick={onClose}>Cancel</button>
                        <button 
                            className="ps-submit-btn" 
                            disabled={selectedSlots.length === 0}
                            onClick={handleSend}
                        >
                            Send to Candidate
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default ProposeSlotsModal;
