/**
 * Usage Example: Activity Timeline Components
 * 
 * This file demonstrates how to use both ActivityTimeline and CandidatActivityTimeline
 * components in your application.
 */

// ============================================
// EXAMPLE 1: HR Admin Dashboard (ApplicationTrack)
// ============================================

import ActivityTimeline from '@/components/ActivityTimeline/ActivityTimeline';

function ApplicationTrackExample() {
  const history = [
    {
      label: 'Candidature Reçue',
      date: new Date('2026-04-06T16:35:00'),
      primary: false,
      type: 'received'
    },
    {
      label: 'Screening IA Terminé',
      date: new Date('2026-04-06T16:35:00'),
      primary: false,
      type: 'ai_screening'
    },
    {
      label: 'Passé à Entretien',
      date: new Date('2026-04-06T18:50:00'),
      primary: true,
      type: 'moved_to'
    }
  ];

  const pastInterviews = [
    {
      id: 'interview-1',
      label: 'Bilan d\'entretien disponible',
      date: new Date('2026-04-06T18:00:00'),
      type: 'completed',
      primary: true,
      action: 'Voir',
      onAction: () => console.log('Show interview report')
    }
  ];

  return (
    <div className="application-track">
      <ActivityTimeline 
        title="Historique d'Activité"
        events={[
          ...history.map((entry, idx) => ({
            id: idx,
            label: entry.label,
            date: entry.date.toISOString(),
            formattedDate: formatDate(entry.date), // Use your formatter
            type: entry.type,
            primary: entry.primary,
            isError: entry.isError
          })),
          ...pastInterviews
        ]}
        maxVisibleItems={6}
      />
    </div>
  );
}

// ============================================
// EXAMPLE 2: Candidate Dashboard (ApplicationDetail)
// ============================================

import CandidatActivityTimeline from '@/components/ActivityTimeline/CandidatActivityTimeline';

function ApplicationDetailExample() {
  const applicationData = {
    _id: 'app-123',
    job_title: 'Senior React Developer',
    company_name: 'TechCorp Inc',
    status: 'interview', // pending, reviewed, quiz, interview, accepted, rejected
    interview_status: 'scheduled', // or: completed, missed, in_progress
    applied_at: new Date('2026-04-06T16:35:00'),
    updated_at: new Date('2026-04-06T18:50:00'),
    quiz_id: 'quiz-123',
    interview_date: new Date('2026-04-10T10:00:00'),
    motivation_letter: 'I am excited about this opportunity...'
  };

  return (
    <div className="candidat-application-detail">
      {/* Other sections... */}
      
      <aside className="detail-sidebar">
        {/* Status information */}
        
        {/* Activity Timeline */}
        <CandidatActivityTimeline 
          applicationData={applicationData}
          title="Historique de Candidature"
        />
        
        {/* Other sidebar sections... */}
      </aside>
    </div>
  );
}

// ============================================
// EXAMPLE 3: Advanced - Custom Events
// ============================================

function AdvancedTimelineExample() {
  const customEvents = [
    {
      id: 1,
      label: 'Application Started',
      date: '2026-04-01T09:00:00Z',
      formattedDate: 'Apr 1 at 9:00 AM',
      type: 'received',
      description: 'You began filling out the application',
      primary: false
    },
    {
      id: 2,
      label: 'Profile Complete',
      date: '2026-04-02T14:30:00Z',
      formattedDate: 'Apr 2 at 2:30 PM',
      type: 'moved_to',
      description: 'Your application was completed and submitted',
      primary: false
    },
    {
      id: 3,
      label: 'Pre-Screening Quiz',
      date: '2026-04-03T10:00:00Z',
      formattedDate: 'Apr 3 at 10:00 AM',
      type: 'quiz',
      description: 'Technical assessment assigned',
      primary: true,
      action: 'Retake Quiz',
      onAction: () => window.location.href = '/quiz/123'
    },
    {
      id: 4,
      label: 'Interview Scheduled',
      date: '2026-04-10T15:00:00Z',
      formattedDate: 'Apr 10 at 3:00 PM',
      type: 'interview',
      description: 'Your interview has been confirmed',
      primary: true,
      action: 'Join Meeting',
      onAction: () => window.location.href = '/interview/room/123'
    },
    {
      id: 5,
      label: 'Offer Extended',
      date: '2026-04-12T11:30:00Z',
      formattedDate: 'Apr 12 at 11:30 AM',
      type: 'accepted',
      description: 'Congratulations! We would like to offer you the position',
      primary: true,
      action: 'Review Offer',
      onAction: () => alert('Show offer details')
    }
  ];

  return (
    <ActivityTimeline 
      title="Your Application Journey"
      events={customEvents}
      maxVisibleItems={3}
    />
  );
}

// ============================================
// EXAMPLE 4: Error Handling
// ============================================

function ErrorTimelineExample() {
  const events = [
    {
      id: 1,
      label: 'Application Received',
      date: '2026-04-06T16:35:00Z',
      formattedDate: 'Apr 6 at 4:35 PM',
      type: 'received',
      primary: false
    },
    {
      id: 2,
      label: 'Application Rejected',
      date: '2026-04-07T09:15:00Z',
      formattedDate: 'Apr 7 at 9:15 AM',
      type: 'rejected',
      isError: true,
      description: 'We have decided to move forward with other candidates',
      primary: false
    }
  ];

  return (
    <ActivityTimeline 
      title="Application Status"
      events={events}
    />
  );
}

// ============================================
// EXAMPLE 5: Empty State
// ============================================

function EmptyTimelineExample() {
  return (
    <ActivityTimeline 
      title="No Activity Yet"
      events={[]}
    />
  );
}

// ============================================
// Helper Functions
// ============================================

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// ============================================
// CSS Integration Example
// ============================================

/*
When using the ActivityTimeline component, make sure your CSS variables are set:

:root {
  --tf-primary: #eab308;
  --tf-surface: #ffffff;
  --tf-surface-low: #f1f5f9;
  --tf-outline-variant: #e5e7eb;
  --tf-on-surface: #0f172a;
  --tf-on-surface-variant: #64748b;
  --tf-on-primary: #000000;
}

[data-theme='dark'] {
  --tf-primary: #eab308;
  --tf-surface: #1a1a2e;
  --tf-surface-low: #16213e;
  --tf-outline-variant: rgba(255, 255, 255, 0.1);
  --tf-on-surface: #f8fafc;
  --tf-on-surface-variant: rgba(255, 255, 255, 0.7);
  --tf-on-primary: #000000;
}
*/

export {
  ApplicationTrackExample,
  ApplicationDetailExample,
  AdvancedTimelineExample,
  ErrorTimelineExample,
  EmptyTimelineExample,
  formatDate
};
