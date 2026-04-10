import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch, SERVER_URL } from '../../../../core/api';
import { useLanguage } from '../../../../core/useLanguage';
import CandidatActivityTimeline from '../../../../components/ActivityTimeline/CandidatActivityTimeline';
import '../FindJobs/JobDetail.css';
import './ApplicationDetail.css';

const ApplicationDetail = () => {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const [appData, setAppData] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);

  const getStatusDetails = (status, interviewStatus) => {
    const details = {
      pending: {
        label: t('submissions-filter-applied', 'Applied'),
        progress: 0,
        colorClass: 'status-pending',
        timeline: [
          { label: t('submissions-timeline-applied', 'Applied'), active: true, current: true },
          { label: t('submissions-timeline-review', 'Reviewed'), active: false },
          { label: t('submissions-timeline-quiz', 'Quiz'), active: false },
          { label: t('submissions-timeline-interview', 'Interview'), active: false },
          { label: t('submissions-timeline-offer', 'Offer'), active: false },
        ]
      },
      reviewed: {
        label: t('submissions-filter-review', 'Reviewed'),
        progress: 25,
        colorClass: 'status-reviewed',
        timeline: [
          { label: t('submissions-timeline-applied', 'Applied'), active: true },
          { label: t('submissions-timeline-review', 'Reviewed'), active: true, current: true },
          { label: t('submissions-timeline-quiz', 'Quiz'), active: false },
          { label: t('submissions-timeline-interview', 'Interview'), active: false },
          { label: t('submissions-timeline-offer', 'Offer'), active: false },
        ]
      },
      quiz: {
        label: t('submissions-filter-quiz', 'Quiz'),
        progress: 50,
        colorClass: 'status-quiz',
        timeline: [
          { label: t('submissions-timeline-applied', 'Applied'), active: true },
          { label: t('submissions-timeline-review', 'Reviewed'), active: true },
          { label: t('submissions-timeline-quiz', 'Quiz'), active: true, current: true },
          { label: t('submissions-timeline-interview', 'Interview'), active: false },
          { label: t('submissions-timeline-offer', 'Offer'), active: false },
        ]
      },
      interview: {
        label: (() => {
          if (interviewStatus === 'completed' || interviewStatus === 'ended') return t('language') === 'fr' ? 'Entretien Terminé' : 'Interview Completed';
          if (interviewStatus === 'missed') return t('language') === 'fr' ? 'Entretien Manqué' : 'Interview Missed';
          if (interviewStatus === 'in_progress') return t('language') === 'fr' ? 'Entretien en cours' : 'Interviewing';
          return t('language') === 'fr' ? 'Entretien Planifié' : 'Interview Scheduled';
        })(),
        progress: 75,
        colorClass: 'status-interview',
        timeline: [
          { label: t('submissions-timeline-applied', 'Applied'), active: true },
          { label: t('submissions-timeline-review', 'Reviewed'), active: true },
          { label: t('submissions-timeline-quiz', 'Quiz'), active: true },
          { label: t('submissions-timeline-interview', 'Interview'), active: true, current: true },
          { label: t('submissions-timeline-offer', 'Offer'), active: false },
        ]
      },
      accepted: {
        label: t('submissions-filter-offer', 'Accepted'),
        progress: 100,
        colorClass: 'status-accepted',
        timeline: [
          { label: t('submissions-timeline-applied', 'Applied'), active: true },
          { label: t('submissions-timeline-review', 'Reviewed'), active: true },
          { label: t('submissions-timeline-quiz', 'Quiz'), active: true },
          { label: t('submissions-timeline-interview', 'Interview'), active: true },
          { label: t('submissions-timeline-offer', 'Offer'), active: true, current: true },
        ]
      },
      rejected: {
        label: 'Rejected',
        progress: 100,
        colorClass: 'status-rejected',
        timeline: [
          { label: t('submissions-timeline-applied', 'Applied'), active: true },
          { label: 'Rejected', active: true, current: true, isError: true },
        ]
      }
    };
    return details[status] || details.pending;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const applications = await apiFetch('/applications/my-applications');
        let currentApp = applications.find(a => a._id === applicationId || a.application_id === applicationId);
        
        if (currentApp) {
          if (currentApp.company_logo && currentApp.company_logo.startsWith('/')) {
            currentApp.company_logo = SERVER_URL + currentApp.company_logo;
          }
          setAppData(currentApp);

          if (currentApp.job_id) {
             try {
                const detailedJob = await apiFetch(`/jobs/${currentApp.job_id}`);
                setJobData(detailedJob);
             } catch (e) {
                console.error('Error fetching full job Details: ', e);
             }
          }
        }
      } catch (err) {
        console.error('Failed to fetch application details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [applicationId]);

  if (loading) {
    return (
      <div className="candidat-job-detail">
        <header className="job-detail-header">
           <div className="job-skeleton" style={{ width: '100px', height: '2.5rem' }}></div>
        </header>
        <div className="job-hero__grid" style={{ minHeight: '160px' }}>
          <div className="job-hero__brand">
            <div className="job-skeleton job-skeleton--avatar" style={{ width: '90px', height: '90px' }}></div>
            <div className="job-skeleton job-skeleton--title" style={{ width: '200px', height: '20px' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!appData) {
    return (
      <div className="candidat-job-detail" style={{ alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <h2 style={{ color: 'var(--dashboard-muted)' }}>Application not found</h2>
        <button className="back-btn" onClick={() => navigate('/candidat/dashboard/my-submissions')}>
           <span className="material-symbols-outlined">arrow_back</span>
           {t('submissions-back', 'Return to Submissions')}
        </button>
      </div>
    );
  }

  const { timeline, progress, label, colorClass } = getStatusDetails(appData.status, appData.interview_status);
  
  const isInterviewActive = appData.status === 'interview' && 
                            appData.interview_status !== 'completed' && 
                            appData.interview_status !== 'missed' &&
                            appData.interview_status !== 'ended';
  const isQuizActive = appData.status === 'quiz' && !appData.quiz_started;

  const handleJoinMeeting = () => {
    if (appData.interview_id || appData._id) {
      navigate('/candidat/interviews/room/' + (appData.interview_id || appData._id));
    }
  };

  const handleTakeQuiz = () => {
    if (appData.quiz_id) {
       navigate('/candidat/quiz/' + appData.quiz_id);
    }
  };

  return (
    <div className="candidat-job-detail fade-in-up">
      <header className="job-detail-header">
        <button onClick={() => navigate('/candidat/dashboard/my-submissions')} className="back-btn">
          <span className="material-symbols-outlined">arrow_back</span>
          {t('submissions-back', 'Back to My Submissions')}
        </button>
      </header>

      <div className="job-hero__grid highlight-border">
        <div className="job-hero__brand">
          <img src={appData.company_logo || (jobData?.company?.logo_url) || 'https://placeholder.pics/svg/200'} alt="Company Logo" className="job-hero__logo" />
          <div className="job-hero__text">
            <h1 className="job-hero__title">{appData.job_title || jobData?.title}</h1>
            <div className="job-hero__meta">
              <span>{appData.company_name || jobData?.company?.name || jobData?.company_name}</span>
              <span>•</span>
              <span className="material-symbols-outlined">location_on</span>
              <span>{appData.location || jobData?.location || 'Remote'}</span>
            </div>
          </div>
        </div>
        <div className="job-hero__actions list-end" style={{ alignSelf: 'center' }}>
           <div className={`app-status-pill ${colorClass}`}>
             <span className="material-symbols-outlined">
               {appData.status === 'interview' ? 'event_available' : 
                appData.status === 'reviewed' ? 'rate_review' : 
                appData.status === 'quiz' ? 'quiz' : 
                appData.status === 'accepted' ? 'check_circle' : 'forward_to_inbox'}
             </span>
             {label}
           </div>
        </div>
      </div>

      <div className="candidat-job-layout">
        <div className="candidat-job-main">
          
          <div className="detail-section app-tracking-section">
             <CandidatActivityTimeline applicationData={appData} />
          </div>

          {appData.motivation_letter && (
            <div className="detail-section">
              <div className="detail-header">
                <span className="material-symbols-outlined">sticky_note_2</span>
                <h2>Motivation Letter</h2>
              </div>
              <div className="motivation-text-card">
                <p>{appData.motivation_letter}</p>
              </div>
            </div>
          )}

          {jobData?.description && (
            <div className="detail-section" style={{marginTop: '2rem'}}>
              <div className="detail-header">
                <span className="material-symbols-outlined">description</span>
                <h2>{t('jobs-role-overview', 'Role Overview')}</h2>
              </div>
              <div className="paragraphs" dangerouslySetInnerHTML={{ __html: jobData.description }} />
            </div>
          )}
          
          {jobData?.responsibilities?.length > 0 && (
            <div className="detail-section">
              <div className="detail-header">
                <span className="material-symbols-outlined">task_alt</span>
                <h2>{t('jobs-responsibilities', 'Key Responsibilities')}</h2>
              </div>
              <ul className="icon-list">
                {jobData.responsibilities.map((resp, idx) => (
                  <li key={idx}>
                    <span className="material-symbols-outlined check-icon">check_circle</span>
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {jobData?.requirements?.length > 0 && (
            <div className="detail-section">
              <div className="detail-header">
                <span className="material-symbols-outlined">verified</span>
                <h2>{t('jobs-requirements', 'Requirements')}</h2>
              </div>
              <ul className="icon-list">
                {jobData.requirements.map((req, idx) => (
                  <li key={idx}>
                    <span className="material-symbols-outlined check-icon">check_circle</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="candidat-job-sidebar">
          
          <div className="sidebar-card highlight-card">
            <h3>Next Steps</h3>
            
            {isQuizActive && (
               <div className="action-panel-body">
                 <p>Your application reached the assessment phase. A technical quiz has been assigned.</p>
                 <button className="action-btn" onClick={handleTakeQuiz}>
                   <span className="material-symbols-outlined">quiz</span>
                   Start Technical Quiz
                 </button>
               </div>
            )}

            {isInterviewActive && (
               <div className="action-panel-body">
                 <p>An interview session has been configured by the recruiter. Ensure your microphone and camera work before joining.</p>
                 <button className="action-btn" onClick={handleJoinMeeting}>
                   <span className="material-symbols-outlined">videocam</span>
                   Join Meeting Room
                 </button>
               </div>
            )}

            {!isQuizActive && !isInterviewActive && (
               <div className="action-panel-body muted-body">
                 <span className="material-symbols-outlined icon-large">hourglass_empty</span>
                 <p className="wait-msg">You are currently waiting for the recruiter to update your status. Please check your notifications frequently.</p>
               </div>
            )}
          </div>

          {(jobData?.company || appData?.company_name) && (
             <div className="sidebar-card">
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.2rem', color: 'var(--dashboard-text)' }}>
                 {jobData?.company?.name || appData.company_name}
              </h3>
              {jobData?.company?.about && <p style={{lineHeight: 1.6, color: 'var(--dashboard-muted)', marginBottom: '1.5rem'}}>{jobData.company.about}</p>}
              
              <div className="sidebar-split">
                {jobData?.company?.industry && (
                <div>
                  <span className="material-symbols-outlined">domain</span>
                  <div style={{ marginLeft: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--dashboard-muted)' }}>Industry</div>
                    <div style={{ fontWeight: 600 }}>{jobData.company.industry}</div>
                  </div>
                </div>
                )}
                {jobData?.company?.size && (
                <div>
                  <span className="material-symbols-outlined">groups</span>
                  <div style={{ marginLeft: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--dashboard-muted)' }}>Company Size</div>
                    <div style={{ fontWeight: 600 }}>{jobData.company.size}</div>
                  </div>
                </div>
                )}
              </div>
            </div>
          )}
          
        </aside>
      </div>
    </div>
  );
};
export default ApplicationDetail;