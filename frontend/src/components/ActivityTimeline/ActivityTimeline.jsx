import React, { useState } from 'react';
import './ActivityTimeline.css';

const ActivityTimeline = ({ events = [], maxVisibleItems = 6, title = "Activity Timeline" }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Determine if we need to show expand button
    const hasMoreItems = events.length > maxVisibleItems;
    const visibleEvents = isExpanded ? events : events.slice(0, maxVisibleItems);
    
    // Map event types to icons
    const getEventIcon = (eventType) => {
        const iconMap = {
            'received': 'inbox',
            'ai_screening': 'psychology',
            'moved_to': 'arrow_forward',
            'quiz': 'quiz',
            'interview': 'videocam',
            'accepted': 'check_circle',
            'rejected': 'cancel',
            'completed': 'task_alt',
            'default': 'event'
        };
        return iconMap[eventType] || iconMap['default'];
    };
    
    // Get color class for event
    const getEventColor = (event) => {
        if (event.isError) return 'timeline-error';
        if (event.primary) return 'timeline-primary';
        return 'timeline-muted';
    };
    
    return (
        <div className="activity-timeline-container">
            <div className="timeline-header">
                <div className="timeline-title">
                    <span className="material-symbols-outlined timeline-title-icon">history</span>
                    <h3>{title}</h3>
                </div>
                {hasMoreItems && (
                    <button 
                        className="timeline-expand-btn"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? (
                            <>
                                <span className="material-symbols-outlined">expand_less</span>
                                Show Less
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">expand_more</span>
                                Show All ({events.length})
                            </>
                        )}
                    </button>
                )}
            </div>
            
            <div className="timeline-wrapper">
                {visibleEvents.length > 0 ? (
                    <div className="timeline-list">
                        {visibleEvents.map((event, index) => {
                            const isLast = index === visibleEvents.length - 1;
                            const colorClass = getEventColor(event);
                            const icon = getEventIcon(event.type || 'default');
                            
                            return (
                                <div 
                                    key={`${event.id || index}`} 
                                    className={`timeline-item ${colorClass} ${isLast ? 'timeline-item-last' : ''}`}
                                    style={{ animationDelay: `${index * 0.1}s` }}
                                >
                                    {/* Timeline connector line */}
                                    <div className="timeline-connector"></div>
                                    
                                    {/* Timeline node/dot with icon */}
                                    <div className={`timeline-dot ${colorClass}`}>
                                        <span className="material-symbols-outlined timeline-icon">
                                            {icon}
                                        </span>
                                    </div>
                                    
                                    {/* Event content */}
                                    <div className="timeline-content">
                                        <p className="timeline-event-label">{event.label}</p>
                                        {event.description && (
                                            <p className="timeline-event-description">{event.description}</p>
                                        )}
                                        <p className="timeline-event-time">
                                            <span className="material-symbols-outlined timeline-time-icon">schedule</span>
                                            {event.formattedDate || event.date}
                                        </p>
                                    </div>
                                    
                                    {/* Action button if provided */}
                                    {event.action && (
                                        <button 
                                            className="timeline-action-btn"
                                            onClick={event.onAction}
                                        >
                                            {event.action}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="timeline-empty">
                        <span className="material-symbols-outlined">event_note</span>
                        <p>No activity yet</p>
                    </div>
                )}
                
                {hasMoreItems && !isExpanded && (
                    <div className="timeline-fade-gradient"></div>
                )}
            </div>
        </div>
    );
};

export default ActivityTimeline;
