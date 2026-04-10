import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, SERVER_URL } from '../../../../core/api';
import { useLanguage } from '../../../../core/useLanguage';
import '../FindJobs/JobDetail.css';
import './ApplicationDetail.css';

const PIPELINE_STEPS = [
  { id: 'new', label: 'Applied', faIcon: 'fa-solid fa-check', colorClass: 'color-accent' },
  { id: 'in_review', label: 'Review', faIcon: 'fa-solid fa-search', colorClass: 'color-blue' },
  { id: 'technical_test', label: 'Quiz', faIcon: 'fa-solid fa-file-pen', colorClass: 'color-amber' },
  { id: 'interview', label: 'Interview', faIcon: 'fa-solid fa-video', colorClass: 'color-accent' },
  { id: 'accepted', label: 'Offer', faIcon: 'fa-solid fa-trophy', colorClass: 'color-green' },
];

const toAbsoluteAssetUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  return value.startsWith('/') ? `${SERVER_URL}${value}` : value;
};

const formatDateTime = (value, language) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatRelativeTime = (dateString, language) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return language === 'fr' ? "Aujourd'hui" : 'Today';
  if (diffDays === 1) return language === 'fr' ? 'Hier' : 'Yesterday';
  if (diffDays < 7) return language === 'fr' ? `Il y a ${diffDays} jours` : `${diffDays} days ago`;
  if (diffDays < 30) return language === 'fr' ? `Il y a ${Math.floor(diffDays / 7)} semaines` : `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' });
};

const ApplicationDetail = () => {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [appData, setAppData] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);

  const tt = (key, fallback, data) => {
    const translated = data ? t(key, data) : t(key);
    return translated === key ? fallback : translated;
  };

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const applications = await apiFetch('/applications/my-applications');
        const current = applications.find(
          (item) => item._id === applicationId || item.application_id === applicationId
        );

        if (!current) {
          if (!cancelled) {
            setAppData(null);
            setJobData(null);
          }
          return;
        }

        const normalizedApp = {
          ...current,
          company_logo: toAbsoluteAssetUrl(current.company_logo) || current.company_logo,
        };

        if (!cancelled) {
          setAppData(normalizedApp);
        }

        if (current.job_id) {
          try {
            const detailedJob = await apiFetch(`/jobs/${current.job_id}`);
            const normalizedJob = {
              ...detailedJob,
              logo: toAbsoluteAssetUrl(detailedJob.logo) || detailedJob.logo,
            };
            if (!cancelled) {
              setJobData(normalizedJob);
            }
          } catch (error) {
            if (!cancelled) {
              setJobData(null);
            }
          }
        } else if (!cancelled) {
          setJobData(null);
        }
      } catch (error) {
        if (!cancelled) {
          setAppData(null);
          setJobData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const normalizedStatus = useMemo(
    () => normalizeApplicationStatus(appData?.status || 'new'),
    [appData?.status]
  );

  const timeline = useMemo(() => {
    if (normalizedStatus === 'rejected') {
      return [
        { id: 'new', label: tt('submissions-timeline-applied', 'Applied'), faIcon: 'fa-solid fa-check', colorClass: 'color-accent', active: true, completed: true, current: false, error: false },
        { id: 'rejected', label: tt('submissions-summary-rejected', 'Rejected'), faIcon: 'fa-solid fa-xmark', colorClass: 'color-slate', active: true, completed: false, current: true, error: true },
      ];
    }

    const labels = {
      new: tt('submissions-timeline-applied', 'Applied'),
      in_review: tt('submissions-timeline-review', 'Review'),
      technical_test: tt('submissions-timeline-quiz', 'Quiz'),
      interview: tt('submissions-timeline-interview', 'Interview'),
      accepted: tt('submissions-timeline-offer', 'Offer'),
    };

    const currentIndex = PIPELINE_STEPS.findIndex((step) => step.id === normalizedStatus);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;

    return PIPELINE_STEPS.map((step, index) => ({
      id: step.id,
      label: labels[step.id],
      faIcon: step.faIcon,
      colorClass: step.colorClass,
      active: index <= safeIndex,
      current: index === safeIndex,
      completed: index < safeIndex,
      error: false,
    }));
  }, [normalizedStatus]);

  const progress = useMemo(() => {
    if (timeline.length <= 1) return 0;
    const currentIndex = timeline.findIndex((step) => step.current);
    if (currentIndex < 0) return 0;
    return (currentIndex / (timeline.length - 1)) * 100;
  }, [timeline]);

  const progressPercent = Math.round(progress);
  const currentStepOrder = useMemo(() => {
    const currentIndex = timeline.findIndex((step) => step.current);
    return currentIndex >= 0 ? currentIndex + 1 : 1;
  }, [timeline]);

  const stageMeta = useMemo(() => {
    if (normalizedStatus === 'rejected') {
      return { label: tt('submissions-summary-rejected', 'Rejected'), faIcon: 'fa-solid fa-circle-xmark', tone: 'rejected' };
    }

    if (normalizedStatus === 'interview') {
      if (appData?.interview_status === 'completed' || appData?.interview_status === 'ended') {
        return { label: language === 'fr' ? 'Entretien termine' : 'Interview Completed', faIcon: 'fa-solid fa-circle-check', tone: 'accepted' };
      }
      if (appData?.interview_status === 'missed') {
        return { label: language === 'fr' ? 'Entretien manque' : 'Missed', faIcon: 'fa-solid fa-calendar-xmark', tone: 'rejected' };
      }
      if (appData?.interview_status === 'in_progress') {
        return { label: language === 'fr' ? 'Entretien en cours' : 'In Progress', faIcon: 'fa-solid fa-video', tone: 'interview' };
      }
      if (appData?.interview_status === 'pending_candidate') {
        return { label: language === 'fr' ? 'Selection du creneau' : 'Select Slot', faIcon: 'fa-solid fa-calendar-check', tone: 'interview' };
      }
      return { label: tt('submissions-filter-interview', 'Interview'), faIcon: 'fa-solid fa-calendar', tone: 'interview' };
    }

    if (normalizedStatus === 'technical_test') {
      if (appData?.quiz_status === 'completed') {
        return { label: tt('submissions-pill-quiz-completed', 'Submitted'), faIcon: 'fa-solid fa-circle-check', tone: 'reviewed' };
      }
      return { label: tt('submissions-filter-quiz', 'Quiz'), faIcon: 'fa-solid fa-file-pen', tone: 'quiz' };
    }

    if (normalizedStatus === 'accepted') {
      return { label: tt('submissions-filter-offer', 'Offer'), faIcon: 'fa-solid fa-trophy', tone: 'accepted' };
    }

    if (normalizedStatus === 'in_review') {
      return { label: tt('submissions-filter-review', 'Review'), faIcon: 'fa-solid fa-magnifying-glass', tone: 'reviewed' };
    }

    return { label: tt('submissions-filter-applied', 'Applied'), faIcon: 'fa-solid fa-inbox', tone: 'pending' };
  }, [appData?.interview_status, appData?.quiz_status, language, normalizedStatus]);

  const companyLogo = appData?.company_logo || jobData?.logo || toAbsoluteAssetUrl(jobData?.company?.logo_url) || 'https://placeholder.pics/svg/200';
  const companyName = appData?.company_name || jobData?.company || jobData?.company_name || tt('jobdetail-about-title', 'Company');
  const roleTitle = appData?.job_title || jobData?.title || tt('jobs-role-overview', 'Application');
  const location = appData?.location || jobData?.location || 'Remote';
  const jobType = jobData?.job_type || appData?.job_type || (language === 'fr' ? 'Temps plein' : 'Full-time');
  const salary = jobData?.salary || appData?.salary || null;
  const workMode = jobData?.work_mode || appData?.work_mode || 'Remote';
  const postedDate = appData?.created_at || jobData?.created_at;
  const companyOverview = jobData?.company_about || jobData?.company?.about || (language === 'fr' ? "Informations sur l'entreprise indisponibles." : 'Company information is not available yet.');
  const companyIndustry = jobData?.company_industry || jobData?.company?.industry;
  const companySize = jobData?.company_size || jobData?.company?.size;

  const interviewStart = appData?.interview_start_time ? new Date(appData.interview_start_time) : null;
  const interviewEnd = appData?.interview_end_time ? new Date(appData.interview_end_time) : interviewStart ? new Date(interviewStart.getTime() + 45 * 60000) : null;
  const now = new Date();
  const interviewWindowOpen = interviewStart && interviewEnd && now >= new Date(interviewStart.getTime() - 10 * 60000) && now <= interviewEnd;

  const canStartQuiz = normalizedStatus === 'technical_test' && Boolean(appData?.quiz_id) && appData?.quiz_status !== 'completed';
  const canPickInterviewSlot = normalizedStatus === 'interview' && appData?.interview_status === 'pending_candidate' && Boolean(appData?.interview_proposal);
  const canJoinInterview = normalizedStatus === 'interview' && (appData?.interview_status === 'in_progress' || ((appData?.interview_status === 'scheduled' || appData?.interview_status === 'confirmed') && interviewWindowOpen));

  const handleTakeQuiz = () => {
    if (!appData?.quiz_id) return;
    navigate(`/candidat/quiz/${appData.quiz_id}`);
  };

  const handleSelectInterviewSlot = () => {
    navigate(`/candidat/interviews/select/${appData?.application_id || appData?._id}`);
  };

  const handleJoinMeeting = () => {
    navigate(`/candidat/interviews/room/${appData?.interview_id || appData?._id}`);
  };

  const getStepMeta = (step, index) => {
    const appliedAt = formatDateTime(appData?.created_at, language);
    if (step.completed) {
      return appliedAt || (language === 'fr' ? 'Etape completee' : 'Step completed');
    }

    if (step.current) {
      if (step.id === 'technical_test') {
        return appData?.quiz_status === 'completed'
          ? tt('submissions-pill-quiz-completed', 'Submitted')
          : language === 'fr'
            ? 'En attente de completion'
            : 'Awaiting completion';
      }

      if (step.id === 'interview') {
        return appData?.interview_start_time
          ? formatDateTime(appData?.interview_start_time, language)
          : language === 'fr'
            ? 'Planification requise'
            : 'Scheduling required';
      }

      return language === 'fr' ? 'Etape active' : 'Current stage';
    }

    if (index > currentStepOrder - 1) {
      return language === 'fr' ? 'Phase a venir' : 'Upcoming phase';
    }

    return '';
  };

  if (loading) {
    return (
      <div className="application-detail application-detail--loading">
        <div className="appd-back-nav">
          <div className="appd-skeleton" style={{ width: '160px', height: '42px', borderRadius: '99px' }}></div>
        </div>
        <div className="appd-skeleton appd-skeleton--hero"></div>
        <div className="appd-skeleton appd-skeleton--block"></div>
        <div className="appd-loading-grid">
          <div className="appd-skeleton appd-skeleton--block"></div>
          <div className="appd-skeleton appd-skeleton--block"></div>
        </div>
      </div>
    );
  }

  if (!appData) {
    return (
      <div className="application-detail application-detail--empty">
        <div className="appd-empty-card">
          <i className="fa-solid fa-folder-open"></i>
          <h2>{language === 'fr' ? 'Candidature introuvable' : 'Application not found'}</h2>
          <p>{language === 'fr' ? "Cette candidature n'est plus disponible." : 'This application is no longer available.'}</p>
          <button type="button" className="appd-back-button" onClick={() => navigate('/candidat/dashboard/my-submissions')}>
            <i className="fa-solid fa-arrow-left"></i>
            {tt('submissions-back', 'Back to My Submissions')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="application-detail">
      <header className="appd-nav">
        <button type="button" className="appd-back-button" onClick={() => navigate('/candidat/dashboard/my-submissions')}>
          <i className="fa-solid fa-arrow-left"></i>
          {tt('submissions-back', 'Back to My Submissions')}
        </button>
      </header>

      <section className="appd-hero">
        <div className="appd-hero-main">
          <div className="appd-hero-title">
            <img src={companyLogo} alt={`${companyName} logo`} onError={(event) => { event.currentTarget.src = 'https://placeholder.pics/svg/200'; }} />
            <div>
              <h1>{roleTitle}</h1>
              <div className="appd-hero-meta">
                <span className="is-company">{companyName}</span>
                <span className="appd-dot"></span>
                <span>{location}</span>
                <span className="appd-dot"></span>
                <span>{formatRelativeTime(postedDate, language)}</span>
              </div>
            </div>
          </div>
          <div className="appd-hero-status">
            <span>{language === 'fr' ? 'Statut actuel' : 'Current status'}</span>
            <div className={`appd-stage-pill appd-stage-pill--${stageMeta.tone}`}>
              <i className={stageMeta.faIcon}></i>
              {stageMeta.label}
            </div>
          </div>
        </div>
        <div className="appd-hero-tags">
          <span><i className="fa-solid fa-briefcase"></i>{jobType}</span>
          {salary && <span><i className="fa-solid fa-sack-dollar"></i>{salary}</span>}
          <span><i className="fa-solid fa-laptop-house"></i>{workMode}</span>
        </div>
      </section>

      <div className="candidat-job-layout">
        <div className="candidat-job-main">
          
          <div className="detail-section app-tracking-section">
             <div className="detail-header custom-margin">
               <span className="material-symbols-outlined">linear_scale</span>
               <h2>Application Tracking</h2>
             </div>
             <div className="tracking-timeline-box">
                <div className="tracking-timeline-track"></div>
                <div className="tracking-timeline-progress color-accent" style={{width: `${progress}%`}}></div>
                <div className="tracking-timeline-nodes">
                   {timeline.map((step, idx) => (
                      <div key={idx} className="tracking-node-wrapper">
                         <div className={`tracking-node ${step.active ? (step.current ? 'current' : 'active') : ''} ${step.isError ? 'error' : ''}`}></div>
                         <span className={`tracking-label ${step.active ? (step.current ? 'current' : 'active') : ''} ${step.isError ? 'error' : ''}`}>{step.label}</span>
                      </div>
                   ))}
                </div>
             </div>
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

            {!canPickInterviewSlot && canJoinInterview && (
              <div className="appd-action-card">
                <p>{language === 'fr' ? 'Votre entretien est accessible. Verifiez votre camera et microphone.' : 'Your interview room is available. Check camera and microphone.'}</p>
                <button type="button" className="appd-primary-btn" onClick={handleJoinMeeting}>
                  {tt('submissions-action-join-interview', 'Join Interview')}
                  <i className="fa-solid fa-video"></i>
                </button>
              </div>
            )}

            {!canStartQuiz && !canPickInterviewSlot && !canJoinInterview && (
              <div className="appd-waiting-state">
                <i className="fa-solid fa-hourglass-half"></i>
                <p>
                  {normalizedStatus === 'interview' && interviewStart
                    ? language === 'fr'
                      ? `Entretien le ${formatDateTime(appData?.interview_start_time, language)}. Lien actif 10 min avant.`
                      : `Interview ${formatDateTime(appData?.interview_start_time, language)}. Room opens 10 min before.`
                    : language === 'fr'
                      ? 'Aucune action immediate requise. Votre candidature continue.'
                      : 'No immediate action required. Your application is in progress.'}
                </p>
              </div>
            )}
          </div>

          <section className="appd-journey-card">
            <div className="appd-journey-head">
              <h3>
                <i className="fa-solid fa-route"></i>
                {language === 'fr' ? 'Parcours de candidature' : 'Application Journey'}
              </h3>
              <span className="appd-journey-progress-pill">
                {language === 'fr'
                  ? `Etape ${currentStepOrder}/${timeline.length}`
                  : `Step ${currentStepOrder}/${timeline.length}`}
              </span>
            </div>
            <div className="appd-journey-progress">
              <div className="appd-journey-progress-track"></div>
              <div className={`appd-journey-progress-fill ${normalizedStatus === 'rejected' ? 'is-error' : ''}`} style={{ width: `${progress}%` }}></div>
            </div>
            <div className="appd-journey-line">
              <div className={`appd-journey-line-fill ${normalizedStatus === 'rejected' ? 'is-error' : ''}`} style={{ height: `${progress}%` }}></div>
            </div>
            <div className="appd-journey-list">
              {timeline.map((step, index) => (
                <div
                  key={step.id}
                  className={[
                    'appd-journey-step',
                    step.active ? 'is-active' : '',
                    step.completed ? 'is-completed' : '',
                    step.current ? 'is-current' : '',
                    step.error ? 'is-error' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="appd-journey-step-icon">
                    <span className="appd-journey-step-ring"></span>
                    {step.completed ? <i className="fa-solid fa-check"></i> : <i className={step.faIcon}></i>}
                  </div>
                  <div className="appd-journey-step-content">
                    <p>{step.label}</p>
                    <span>{getStepMeta(step, index)}</span>
                    {step.current && (
                      <em>{language === 'fr' ? 'Etape actuelle' : 'Current step'}</em>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {appData?.motivation_letter && (
            <section className="appd-card appd-motivation-card">
              <h3>
                <i className="fa-solid fa-quote-left"></i>
                {language === 'fr' ? 'Lettre de motivation' : 'Motivation Letter'}
              </h3>
              <p>"{appData.motivation_letter}"</p>
            </section>
          )}

          <div className="appd-help-card">
            <div className="appd-help-icon">
              <i className="fa-solid fa-headset"></i>
            </div>
            <div className="appd-help-content">
              <p>{language === 'fr' ? 'Besoin d aide ?' : 'Need help?'}</p>
              <strong>{language === 'fr' ? 'Contactez le recruteur depuis vos notifications' : 'Contact the recruiter from notifications'}</strong>
            </div>
          </div>
        </aside>

        <div className="appd-right">
          <section className="appd-content-section">
            <h2>{tt('jobdetail-role-overview', 'Role Overview')}</h2>
            <div
              className="appd-rich-text"
              dangerouslySetInnerHTML={{
                __html: jobData?.description || (language === 'fr' ? 'Les details du poste seront ajoutes prochainement.' : 'Role details will be available soon.'),
              }}
            />
          </section>

          <section className="appd-content-section">
            <h3>{tt('jobdetail-responsibilities', 'Key Responsibilities')}</h3>
            <ul className="appd-list appd-list--responsibilities">
              {(jobData?.responsibilities || []).length > 0 ? (
                jobData.responsibilities.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <i className="fa-solid fa-circle-check"></i>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li>
                  <i className="fa-solid fa-circle-info"></i>
                  <span>{language === 'fr' ? 'Les responsabilites seront precisees par le recruteur.' : 'Responsibilities will be provided by the recruiter.'}</span>
                </li>
              )}
            </ul>
          </section>

          <section className="appd-content-section">
            <h3>{tt('jobdetail-requirements', 'Requirements')}</h3>
            <ul className="appd-list appd-list--requirements appd-list--grid">
              {(jobData?.requirements || []).length > 0 ? (
                jobData.requirements.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <i className="fa-solid fa-shield-halved"></i>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li>
                  <i className="fa-solid fa-circle-info"></i>
                  <span>{language === 'fr' ? 'Les exigences seront partagees par le recruteur.' : 'Requirements will be shared by the recruiter.'}</span>
                </li>
              )}
            </ul>
          </section>

          <div className="appd-company-card">
            <h3>
              <i className="fa-solid fa-building-columns"></i>
              {language === 'fr' ? "A propos de l'entreprise" : 'About the Company'}
            </h3>
            <div className="appd-company-info">
              <div className="appd-company-info-row">
                <span>
                  <i className="fa-solid fa-industry"></i>
                  {language === 'fr' ? 'Entreprise' : 'Company'}
                </span>
                <p>{companyName}</p>
              </div>
              <div className="appd-company-info-row">
                <span>
                  <i className="fa-solid fa-circle-info"></i>
                  {language === 'fr' ? 'Apercu' : 'Overview'}
                </span>
                <p>{companyOverview}</p>
              </div>
            </div>
            <div className="appd-company-grid">
              <div className="appd-company-grid-item">
                <span>
                  <i className="fa-solid fa-tag"></i>
                  {tt('jobdetail-company-industry', 'Industry')}
                </span>
                <p>{companyIndustry || (language === 'fr' ? 'Non specifie' : 'Not specified')}</p>
              </div>
              <div className="appd-company-grid-item">
                <span>
                  <i className="fa-solid fa-users"></i>
                  {tt('jobdetail-company-size', 'Size')}
                </span>
                <p>{companySize || (language === 'fr' ? 'Non specifie' : 'Not specified')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationDetail;
