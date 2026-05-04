import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, SERVER_URL } from '../../../../core/api';
import { useLanguage } from '../../../../core/useLanguage';
import { normalizeApplicationStatus } from '../../../../core/applicationPipeline';
import './ApplicationDetail.css';

const PIPELINE_STEPS = [
  { id: 'new', label: 'Applied', faIcon: 'fa-solid fa-inbox', colorClass: 'color-accent' },
  { id: 'in_review', label: 'Review', faIcon: 'fa-solid fa-magnifying-glass', colorClass: 'color-blue' },
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

const formatAppliedDate = (dateString, language) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const ApplicationDetail = () => {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [appData, setAppData] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);

  const tt = useCallback((key, fallback, data) => {
    const translated = data ? t(key, data) : t(key);
    return translated === key ? fallback : translated;
  }, [t]);

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
          } catch {
            if (!cancelled) {
              setJobData(null);
            }
          }
        } else if (!cancelled) {
          setJobData(null);
        }
      } catch {
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
        { id: 'new', label: tt('submissions-timeline-applied', 'Applied'), faIcon: 'fa-solid fa-check', active: true, completed: true, current: false, error: false },
        { id: 'rejected', label: tt('submissions-summary-rejected', 'Rejected'), faIcon: 'fa-solid fa-xmark', active: true, completed: false, current: true, error: true },
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
      active: index <= safeIndex,
      current: index === safeIndex,
      completed: index < safeIndex,
      error: false,
    }));
  }, [normalizedStatus, tt]);

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
        return { label: language === 'fr' ? 'Entretien termine' : 'Interview Done', faIcon: 'fa-solid fa-circle-check', tone: 'accepted' };
      }
      if (appData?.interview_status === 'missed') {
        return { label: language === 'fr' ? 'Entretien manque' : 'Interview Missed', faIcon: 'fa-solid fa-calendar-xmark', tone: 'rejected' };
      }
      if (appData?.interview_status === 'in_progress') {
        return { label: language === 'fr' ? 'Entretien en cours' : 'Interview Live', faIcon: 'fa-solid fa-video', tone: 'interview' };
      }
      if (appData?.interview_status === 'pending_candidate') {
        return { label: language === 'fr' ? 'Choisir un creneau' : 'Select Slot', faIcon: 'fa-solid fa-calendar-check', tone: 'interview' };
      }
      return { label: tt('submissions-filter-interview', 'Interview'), faIcon: 'fa-solid fa-calendar', tone: 'interview' };
    }

    if (normalizedStatus === 'technical_test') {
      if (appData?.quiz_status === 'completed') {
        return { label: tt('submissions-pill-quiz-completed', 'Quiz Submitted'), faIcon: 'fa-solid fa-circle-check', tone: 'reviewed' };
      }
      if (appData?.quiz_deadline && new Date() > new Date(appData.quiz_deadline)) {
        return { label: language === 'fr' ? 'Quiz expiré' : 'Quiz Expired', faIcon: 'fa-solid fa-clock', tone: 'rejected' };
      }
      return { label: language === 'fr' ? 'Quiz en attente' : 'Quiz Pending', faIcon: 'fa-solid fa-file-pen', tone: 'quiz' };
    }

    if (normalizedStatus === 'accepted') {
      return { label: language === 'fr' ? 'Offre recue' : 'Offer Received', faIcon: 'fa-solid fa-trophy', tone: 'accepted' };
    }

    if (normalizedStatus === 'in_review') {
      return { label: language === 'fr' ? 'En cours d\'examen' : 'Under Review', faIcon: 'fa-solid fa-magnifying-glass', tone: 'reviewed' };
    }

    return { label: tt('submissions-filter-applied', 'Applied'), faIcon: 'fa-solid fa-inbox', tone: 'pending' };
  }, [appData?.interview_status, appData?.quiz_deadline, appData?.quiz_status, language, normalizedStatus]);

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

  const quizDeadlinePassed = normalizedStatus === 'technical_test' && Boolean(appData?.quiz_deadline) && new Date() > new Date(appData.quiz_deadline);
  const canStartQuiz = normalizedStatus === 'technical_test' && Boolean(appData?.quiz_id) && appData?.quiz_status !== 'completed' && !quizDeadlinePassed;
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

  const getStepSubLabel = (step) => {
    if (step.completed) return language === 'fr' ? 'Fait' : 'Done';
    if (step.current) {
      if (step.id === 'technical_test') {
        return appData?.quiz_status === 'completed'
          ? (language === 'fr' ? 'Soumis' : 'Submitted')
          : (language === 'fr' ? 'Actif' : 'Active now');
      }
      if (step.id === 'interview' && appData?.interview_start_time) {
        return formatDateTime(appData.interview_start_time, language);
      }
      return language === 'fr' ? 'Actif' : 'Active now';
    }
    return language === 'fr' ? 'A venir' : 'Upcoming';
  };

  if (loading) {
    return (
      <div className="application-detail application-detail--loading">
        <div className="appd-back-nav">
          <div className="appd-skeleton" style={{ width: '160px', height: '34px', borderRadius: '99px' }}></div>
        </div>
        <div className="appd-skeleton appd-skeleton--hero"></div>
        <div className="appd-skeleton" style={{ height: '110px', borderRadius: '1.25rem' }}></div>
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
            <span className="appd-back-arrow"><i className="fa-solid fa-arrow-left"></i></span>
            {tt('submissions-back', 'Back to My Submissions')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="application-detail">

      {/* Back nav */}
      <header className="appd-nav">
        <button type="button" className="appd-back-button" onClick={() => navigate('/candidat/dashboard/my-submissions')}>
          <span className="appd-back-arrow"><i className="fa-solid fa-arrow-left"></i></span>
          {tt('submissions-back', 'Back to My Submissions')}
        </button>
      </header>

      {/* Hero */}
      <section className="appd-hero">
        <div className="appd-hero-accent-bar"></div>
        <div className="appd-hero-inner">
          <div className="appd-hero-row">
            <div className="appd-hero-identity">
              <img
                src={companyLogo}
                alt={`${companyName} logo`}
                onError={(event) => { event.currentTarget.src = 'https://placeholder.pics/svg/200'; }}
              />
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
            <div className="appd-hero-right">
              <div className={`appd-stage-pill appd-stage-pill--${stageMeta.tone}`}>
                <i className={stageMeta.faIcon}></i>
                {stageMeta.label}
              </div>
              {postedDate && (
                <span className="appd-applied-date">
                  {language === 'fr' ? 'Candidature le ' : 'Applied '}{formatAppliedDate(postedDate, language)}
                </span>
              )}
            </div>
          </div>
          <div className="appd-hero-tags">
            <span><i className="fa-solid fa-briefcase"></i>{jobType}</span>
            <span><i className="fa-solid fa-laptop-house"></i>{workMode}</span>
            {salary && <span><i className="fa-solid fa-sack-dollar"></i>{salary}</span>}
          </div>
        </div>
      </section>

      {/* Horizontal pipeline track */}
      <div className="appd-pipeline-track">
        <div className="appd-pipeline-header">
          <span className="appd-pipeline-title">
            <i className="fa-solid fa-route"></i>
            {language === 'fr' ? 'Parcours de candidature' : 'Application Journey'}
          </span>
          <span className="appd-step-counter">
            {currentStepOrder} / {timeline.length}
          </span>
        </div>
        <div className="appd-pipeline-steps">
          {timeline.map((step) => (
            <div
              key={step.id}
              className={[
                'appd-pipeline-step',
                step.active ? 'is-active' : '',
                step.completed ? 'is-completed' : '',
                step.current ? 'is-current' : '',
                step.error ? 'is-error' : '',
              ].filter(Boolean).join(' ')}
            >
              <div className="appd-step-node">
                {step.completed
                  ? <i className="fa-solid fa-check"></i>
                  : <i className={step.faIcon}></i>
                }
              </div>
              <span className="appd-step-label">{step.label}</span>
              <span className="appd-step-sublabel">{getStepSubLabel(step)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="appd-layout">

        {/* Left column */}
        <aside className="appd-left">

          {/* Action card */}
          <div className="appd-next-steps">
            <div className="appd-card-head">
              <span className="appd-card-title">
                <i className="fa-solid fa-bolt"></i>
                {language === 'fr' ? 'Action requise' : 'Action Required'}
              </span>
            </div>
            <div className="appd-card-body">
              {canStartQuiz && (
                <>
                  <p className="appd-action-message">
                    {language === 'fr'
                      ? 'Un quiz technique vous attend. Terminez-le pour progresser vers la phase entretien.'
                      : 'A technical quiz is ready for you. Complete it to advance to the interview stage.'}
                  </p>
                  <button type="button" className="appd-primary-btn" onClick={handleTakeQuiz}>
                    {tt('submissions-action-start-quiz', 'Start Technical Quiz')}
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                </>
              )}

              {quizDeadlinePassed && appData?.quiz_status !== 'completed' && (
                <div className="appd-waiting-state">
                  <div className="appd-waiting-icon" style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <i className="fa-solid fa-clock" style={{ color: '#ef4444' }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="appd-waiting-text" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginBottom: '0.35rem' }}>
                      {language === 'fr' ? 'Délai du quiz dépassé' : 'Quiz deadline passed'}
                    </p>
                    <p className="appd-waiting-text" style={{ fontSize: '0.78rem' }}>
                      {language === 'fr'
                        ? `La date limite était le ${formatDateTime(appData.quiz_deadline, language)}. Vous ne pouvez plus passer ce quiz.`
                        : `The deadline was ${formatDateTime(appData.quiz_deadline, language)}. You can no longer take this quiz.`}
                    </p>
                  </div>
                </div>
              )}

              {canPickInterviewSlot && (
                <>
                  <p className="appd-action-message">
                    {language === 'fr'
                      ? 'Le recruteur a propose des creneaux. Choisissez votre horaire prefere pour confirmer.'
                      : 'The recruiter has proposed interview slots. Pick your preferred time to confirm.'}
                  </p>
                  <button type="button" className="appd-primary-btn" onClick={handleSelectInterviewSlot}>
                    {tt('submissions-action-choose-slot', 'Choose Interview Slot')}
                    <i className="fa-solid fa-calendar-check"></i>
                  </button>
                </>
              )}

              {!canPickInterviewSlot && canJoinInterview && (
                <>
                  {interviewStart && (
                    <div className="appd-interview-date-badge">
                      <i className="fa-solid fa-calendar-check"></i>
                      <span>{formatDateTime(appData?.interview_start_time, language)}</span>
                    </div>
                  )}
                  <p className="appd-action-message">
                    {language === 'fr'
                      ? 'Votre salle d\'entretien est disponible. Verifiez votre camera et microphone avant de rejoindre.'
                      : 'Your interview room is live. Check your camera and microphone before joining.'}
                  </p>
                  <button type="button" className="appd-primary-btn" onClick={handleJoinMeeting}>
                    {tt('submissions-action-join-interview', 'Join Interview')}
                    <i className="fa-solid fa-video"></i>
                  </button>
                </>
              )}

              {!canStartQuiz && !canPickInterviewSlot && !canJoinInterview && (
                <div className="appd-waiting-state">
                  <div className="appd-waiting-icon">
                    <i className={normalizedStatus === 'interview' && interviewStart ? 'fa-solid fa-calendar' : 'fa-solid fa-hourglass-half'}></i>
                  </div>
                  <p className="appd-waiting-text">
                    {normalizedStatus === 'interview' && interviewStart
                      ? (language === 'fr'
                          ? `Entretien prevu le ${formatDateTime(appData?.interview_start_time, language)}. Salle accessible 10 min avant.`
                          : `Interview scheduled for ${formatDateTime(appData?.interview_start_time, language)}. Room opens 10 min before start.`)
                      : normalizedStatus === 'accepted'
                        ? (language === 'fr'
                            ? 'Felicitations ! Vous avez recu une offre. Consultez vos notifications pour la suite.'
                            : 'Congratulations! You have received an offer. Check your notifications for next steps.')
                        : normalizedStatus === 'rejected'
                          ? (language === 'fr'
                              ? 'Cette candidature est cloturee. Continuez a postuler — la bonne opportunite vous attend.'
                              : 'This application is no longer active. Keep applying — the right opportunity is ahead.')
                          : (language === 'fr'
                              ? 'Aucune action immediate requise. Votre candidature avance, nous vous tiendrons informe.'
                              : 'No action needed right now. Your application is progressing — we\'ll notify you of updates.')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Motivation letter */}
          {appData?.motivation_letter && (
            <section className="appd-card appd-motivation-card">
              <div className="appd-card-head">
                <span className="appd-card-title">
                  <i className="fa-solid fa-quote-left"></i>
                  {language === 'fr' ? 'Lettre de motivation' : 'Motivation Letter'}
                </span>
              </div>
              <div className="appd-motivation-body">
                <span className="appd-motivation-quote">&ldquo;</span>
                <p className="appd-motivation-text">{appData.motivation_letter}</p>
              </div>
            </section>
          )}

          {/* Help card */}
          <div className="appd-help-card">
            <div className="appd-help-icon">
              <i className="fa-solid fa-headset"></i>
            </div>
            <div className="appd-help-content">
              <p>{language === 'fr' ? 'Besoin d\'aide ?' : 'Need help?'}</p>
              <strong>{language === 'fr' ? 'Contactez le recruteur depuis vos notifications' : 'Contact the recruiter from your notifications'}</strong>
            </div>
          </div>

        </aside>

        {/* Right column */}
        <div className="appd-right">

          {/* Role overview */}
          <section className="appd-content-section">
            <div className="appd-card-head">
              <span className="appd-card-title">
                <i className="fa-solid fa-align-left"></i>
                {tt('jobdetail-role-overview', 'Role Overview')}
              </span>
            </div>
            <div className="appd-card-body">
              <div
                className="appd-rich-text"
                dangerouslySetInnerHTML={{
                  __html: jobData?.description || (language === 'fr' ? 'Les details du poste seront ajoutes prochainement.' : 'Role details will be available soon.'),
                }}
              />
            </div>
          </section>

          {/* Responsibilities */}
          <section className="appd-content-section">
            <div className="appd-card-head">
              <span className="appd-card-title">
                <i className="fa-solid fa-list-check"></i>
                {tt('jobdetail-responsibilities', 'Key Responsibilities')}
              </span>
            </div>
            <div className="appd-card-body">
              <ul className="appd-check-list">
                {(jobData?.responsibilities || []).length > 0 ? (
                  jobData.responsibilities.map((item, index) => (
                    <li key={`${item}-${index}`}>
                      <span className="appd-list-icon"><i className="fa-solid fa-check"></i></span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li>
                    <span className="appd-list-icon is-info"><i className="fa-solid fa-info"></i></span>
                    <span>{language === 'fr' ? 'Les responsabilites seront precisees par le recruteur.' : 'Responsibilities will be provided by the recruiter.'}</span>
                  </li>
                )}
              </ul>
            </div>
          </section>

          {/* Requirements */}
          <section className="appd-content-section">
            <div className="appd-card-head">
              <span className="appd-card-title">
                <i className="fa-solid fa-shield-halved"></i>
                {tt('jobdetail-requirements', 'Requirements')}
              </span>
            </div>
            <div className="appd-card-body">
              {(jobData?.requirements || []).length > 0 ? (
                <div className="appd-req-grid">
                  {jobData.requirements.map((item, index) => (
                    <div className="appd-req-item" key={`${item}-${index}`}>
                      <span className="appd-req-icon"><i className="fa-solid fa-check"></i></span>
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="appd-check-list">
                  <li>
                    <span className="appd-list-icon is-info"><i className="fa-solid fa-info"></i></span>
                    <span>{language === 'fr' ? 'Les exigences seront partagees par le recruteur.' : 'Requirements will be shared by the recruiter.'}</span>
                  </li>
                </ul>
              )}
            </div>
          </section>

          {/* About company */}
          <div className="appd-company-card">
            <div className="appd-card-head">
              <span className="appd-card-title">
                <i className="fa-solid fa-building-columns"></i>
                {language === 'fr' ? "A propos de l'entreprise" : 'About the Company'}
              </span>
            </div>
            <div className="appd-card-body">
              <div className="appd-kv-section">
                <div className="appd-kv-row">
                  <span className="appd-kv-label">
                    <i className="fa-solid fa-industry"></i>
                    {language === 'fr' ? 'Entreprise' : 'Company'}
                  </span>
                  <p className="appd-kv-value">{companyName}</p>
                </div>
                <div className="appd-kv-row">
                  <span className="appd-kv-label">
                    <i className="fa-solid fa-circle-info"></i>
                    {language === 'fr' ? 'Apercu' : 'Overview'}
                  </span>
                  <p className="appd-kv-value">{companyOverview}</p>
                </div>
              </div>
              <div className="appd-company-chips">
                <div className="appd-company-chip">
                  <div className="appd-chip-label">
                    <i className="fa-solid fa-tag"></i>
                    {tt('jobdetail-company-industry', 'Industry')}
                  </div>
                  <div className="appd-chip-value">{companyIndustry || (language === 'fr' ? 'Non specifie' : 'Not specified')}</div>
                </div>
                <div className="appd-company-chip">
                  <div className="appd-chip-label">
                    <i className="fa-solid fa-users"></i>
                    {tt('jobdetail-company-size', 'Size')}
                  </div>
                  <div className="appd-chip-value">{companySize || (language === 'fr' ? 'Non specifie' : 'Not specified')}</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ApplicationDetail;
