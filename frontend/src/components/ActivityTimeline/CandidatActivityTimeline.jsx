import React, { useState, useMemo } from 'react';
import './CandidatActivityTimeline.css';

/**
 * CandidatActivityTimeline
 * 
 * A specialized version of ActivityTimeline optimized for candidate-facing interfaces.
 * Shows application pipeline events with focused, clean styling.
 */
const CandidatActivityTimeline = ({ 
  applicationData = {}, 
  title = "Application Progress" 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const events = useMemo(() => {
    const eventsList = [];
    
    if (applicationData.applied_at) {
      eventsList.push({
        id: 'received',
        label: 'Application Received',
        date: applicationData.applied_at,
        type: 'received',
        primary: false,
        description: 'Your application has been received and is in review'
      });
    }
    
    if (applicationData.status === 'reviewed' || 
        applicationData.status === 'quiz' || 
        applicationData.status === 'interview' || 
        applicationData.status === 'accepted') {
      eventsList.push({
        id: 'reviewed',
        label: 'Application Reviewed',
        date: applicationData.updated_at || applicationData.applied_at,
        type: 'ai_screening',
        primary: false,
        description: 'Your profile has been reviewed'
      });
    }
    
    if ((applicationData.status === 'quiz' || 
         applicationData.status === 'interview' || 
         applicationData.status === 'accepted') && 
        applicationData.quiz_id) {
      eventsList.push({
        id: 'quiz',
        label: 'Technical Assessment',
        date: applicationData.quiz_started_at || applicationData.updated_at,
        type: 'quiz',
        primary: true,
        description: 'You have been invited to complete a technical assessment'
      });
    }
    
    if ((applicationData.status === 'interview' || 
         applicationData.status === 'accepted') && 
        applicationData.interview_status) {
      eventsList.push({
        id: 'interview',
        label: applicationData.interview_status === 'completed' ? 'Interview Completed' : 'Interview Scheduled',
        date: applicationData.interview_date || applicationData.updated_at,
        type: 'interview',
        primary: true,
        description: applicationData.interview_status === 'completed' 
          ? 'Your interview has been completed'
          : 'You have been scheduled for an interview'
      });
    }
    
    if (applicationData.status === 'accepted') {
      eventsList.push({
        id: 'accepted',
        label: 'Offer Accepted',
        date: applicationData.accepted_at || applicationData.updated_at,
        type: 'accepted',
        primary: true,
        description: 'Congratulations! Your offer has been accepted'
      });
    }
    
    if (applicationData.status === 'rejected') {
      eventsList.push({
        id: 'rejected',
        label: 'Application Not Selected',
        date: applicationData.rejected_at || applicationData.updated_at,
        type: 'rejected',
        isError: true,
        description: 'We have decided to move forward with other candidates'
      });
    }
    
    return eventsList;
  }, [applicationData]);
  
  const maxVisible = 4;
  const hasMore = events.length > maxVisible;
  const visibleEvents = isExpanded ? events : events.slice(0, maxVisible);
  
  const getEventIcon = (eventType) => {
    const iconMap = {
      'received': 'mail',
      'ai_screening': 'auto_awesome',
      'quiz': 'assessment',
      'interview': 'video_call',
      'accepted': 'celebration',
      'rejected': 'close',
      'default': 'circle'
    };
    return iconMap[eventType] || iconMap['default'];
  };
  
  const formatDateFr = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.toLocaleString('fr-FR', { month: 'short' });
      const time = date.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return `${day} ${month}. ${time}`;
    } catch {
      return '';
    }
  };
  
  return (
    <div className="candidat-activity-timeline">
      <div className="cat-header">
        <div className="cat-title-wrapper">
          <span className="material-symbols-outlined cat-title-icon">timeline</span>
          <h3 className="cat-title">{title}</h3>
        </div>
        {hasMore && (
          <button 
            className="cat-toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <span className="material-symbols-outlined">unfold_less</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">unfold_more</span>
              </>
            )}
          </button>
        )}
      </div>
      
      <div className="cat-timeline">
        {visibleEvents.map((event, idx) => {
          const isLast = idx === visibleEvents.length - 1;
          const statusClass = event.isError ? 'cat-status-error' : (event.primary ? 'cat-status-primary' : 'cat-status-neutral');
          
          return (
            <div key={event.id} className={`cat-event ${statusClass} ${isLast ? 'cat-event-last' : ''}`}>
              {/* Dot with icon and vertical connector */}
              <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%'}}>
                {/* Top connector (not for first event) */}
                {idx !== 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    width: '2px',
                    height: 'calc(50% - 20px)',
                    background: '#eab308',
                    transform: 'translateX(-50%)',
                    zIndex: 1
                  }} />
                )}
                <div className={`cat-dot ${statusClass}`} style={{zIndex: 2}}>
                  <span className="material-symbols-outlined cat-dot-icon">
                    {getEventIcon(event.type)}
                  </span>
                </div>
                {/* Bottom connector (not for last event) */}
                {!isLast && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    width: '2px',
                    height: 'calc(50% - 20px)',
                    background: '#eab308',
                    transform: 'translateX(-50%)',
                    zIndex: 1
                  }} />
                )}
              </div>
              {/* Event content */}
              <div className="cat-content">
                <h4 className="cat-event-title">{event.label}</h4>
                {event.description && (
                  <p className="cat-event-desc">{event.description}</p>
                )}
                <span className="cat-event-date">
                  {formatDateFr(event.date)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {hasMore && !isExpanded && (
        <div className="cat-fade-out"></div>
      )}
      
      {events.length === 0 && (
        <div className="cat-empty">
          <span className="material-symbols-outlined">history</span>
          <p>Applications history appears here</p>
        </div>
      )}
    </div>
  );
};

export default CandidatActivityTimeline;
