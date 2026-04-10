import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../../../core/useLanguage';
import HRSidebar from '../components/HRSidebar';
import { apiFetch } from '../../../core/api';
import { getApplicationPipelineSteps } from '../../../core/applicationPipeline';
import CreateQuizModal from '../components/CreateQuizModal';
import CVViewerModal from '../components/CVViewerModal';
import ProposeSlotsModal from '../components/ProposeSlotsModal';
import ActivityTimeline from '../../../components/ActivityTimeline/ActivityTimeline';
import './ApplicationTrack.css';
import InterviewHistoryModal from '../components/InterviewHistoryModal';

const ApplicationTrack = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();
    const { t, language } = useLanguage();

    const STEPS = useMemo(() => getApplicationPipelineSteps(t), [t]);

    const [application, setApplication] = useState(null);
    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [quizId, setQuizId] = useState(null);
    const [isCVModalOpen, setIsCVModalOpen] = useState(false);
    const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
    const [quizAiLoading, setQuizAiLoading] = useState(false);
    const [isQuizFeedbackExpanded, setIsQuizFeedbackExpanded] = useState(false);
    const [interview, setInterview] = useState(null);
    const [pendingProposal, setPendingProposal] = useState(null);
    const [pastInterviews, setPastInterviews] = useState([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const historyRef = useRef(null);

    // Live time for the interview logic
    const [liveNow, setLiveNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setLiveNow(new Date()), 30000); // 30s updates
        return () => clearInterval(timer);
    }, []);

    const checkQuizPresence = async () => {
        try {
            const data = await apiFetch(`/quiz/check/${id}`);
            if (data.exists) {
                setQuizId(data.quiz_id);
            } else {
                setQuizId(null);
            }
        } catch (err) {
            console.error("Failed to check quiz presence", err);
        }
    };

    const showToast = (message, type = 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        const fetchInterview = async (interviewId) => {
            try {
                const data = await apiFetch(`/interviews/${interviewId}`);
                setInterview(data);
            } catch (err) {
                console.error("Failed to fetch interview details", err);
                if (err.message?.includes('404') || err.message?.includes('not found')) {
                    setInterview(null);
                }
            }
        };

        const fetchPastInterviews = async () => {
            try {
                const data = await apiFetch(`/interviews/application/${id}/completed`);
                setPastInterviews(data);
            } catch (err) {
                console.error("Failed to fetch past interviews", err);
            }
        };

        const fetchApp = async () => {
            fetchPastInterviews();
            try {
                const data = await apiFetch(`/applications/${id}`);
                if (data.job_id) {
                    try {
                        const jobData = await apiFetch(`/jobs/${data.job_id}`);
                        data.job_title = jobData.title;
                        data.company_id = jobData.company_id; 
                    } catch { /* ignore */ }
                }

                const candId = data.candidate_id || data.candidat_id || data.user_id;

                if (candId) {
                    try {
                        const candData = await apiFetch(`/candidates/${candId}`);
                        setCandidate(candData);
                    } catch (e) {
                        console.error("Error fetching candidate profile:", e);
                    }
                }

                setApplication(data);
                if (data.interview_id) {
                    fetchInterview(data.interview_id);
                } else if (data.interview_proposal_id && data.interview_status === 'pending_candidate') {
                    try {
                        const propData = await apiFetch(`/interviews/proposals/application/${id}`);
                        if (propData && propData.status === 'pending') {
                            setPendingProposal(propData);
                        }
                    } catch (err) {
                        console.error("Failed to fetch pending proposal", err);
                    }
                }
            } catch (err) {
                console.error(err);
                setError('Error loading candidate profile.');
            } finally {
                setLoading(false);
            }
        };
        fetchApp();
        checkQuizPresence();
    }, [id]);

    useEffect(() => {
        if (!isQuizModalOpen) {
            checkQuizPresence();
        }
    }, [isQuizModalOpen]);

    // Polling effect to instantly detect when candidate confirms a slot
    useEffect(() => {
        let intervalId;
        if (application?.interview_status === 'pending_candidate') {
            intervalId = setInterval(async () => {
                try {
                    const data = await apiFetch(`/applications/${id}`);
                    if (data.interview_status !== 'pending_candidate') {
                        // Candidate has responded! Update the UI in real-time
                        setApplication(data);
                        if (data.interview_id) {
                            const intData = await apiFetch(`/interviews/${data.interview_id}`);
                            setInterview(intData);
                        }
                        showToast(language === 'fr' ? 'Le candidat a confirmé son entretien !' : 'Candidate has confirmed their interview!', 'success');
                    }
                } catch (err) {
                    // Silent fail for polling errors
                }
            }, 5000); // Poll every 5 seconds
        }
        return () => clearInterval(intervalId);
    }, [id, application?.interview_status, language]);

    const quizAnalysisText = useMemo(
        () => (application?.quiz_ai_analysis || '').replace(/\s+/g, ' ').trim(),
        [application?.quiz_ai_analysis]
    );
    const hasQuizAnalysis = Boolean(quizAnalysisText);
    const isQuizFeedbackLong = quizAnalysisText.length > 280;
    const quizFeedbackToggleLabel = language === 'fr'
        ? (isQuizFeedbackExpanded ? 'Voir moins' : 'Voir plus')
        : (isQuizFeedbackExpanded ? 'Show less' : 'Read more');
    const quizFeedbackStatusLabel = language === 'fr' ? 'Retour IA pret' : 'AI feedback ready';

    useEffect(() => {
        setIsQuizFeedbackExpanded(false);
    }, [id, quizAnalysisText]);

    const handleUpdateStatus = async (newStatus) => {
        setUpdating(true);
        try {
            await apiFetch(`/applications/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });
            setApplication(prev => ({ ...prev, status: newStatus }));
        } catch (err) {
            console.error(err);
            alert(t('app.track.update_status_error'));
        } finally {
            setUpdating(false);
        }
    };

    const handleAnalyze = async () => {
        if (!application || !application.job_id) return;
        setAiLoading(true);
        try {
            await apiFetch(`/ai-matching/applicant-scores/${application.job_id}?limit=50`);
            // The backend now sets status to 'in_review' during score generation
            const data = await apiFetch(`/applications/${id}`);
            setApplication(data);
        } catch (e) {
            console.error('Error in AI Analysis:', e);
            showToast(t('app.track.toast.ai_error'));
        } finally {
            setAiLoading(false);
        }
    };

    const handleAnalyzeQuiz = async () => {
        if (!id) return;
        setQuizAiLoading(true);
        try {
            await apiFetch(`/ai-matching/analyze-quiz/${id}`, { method: 'POST' });
            const data = await apiFetch(`/applications/${id}`);
            setApplication(data);
            showToast(t('app.track.toast.ai_success'), "info");
        } catch (e) {
            console.error('Error in Quiz analysis:', e);
            showToast(t('app.track.toast.quiz_error'));
        } finally {
            setQuizAiLoading(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm("RESET Candidate Progress? (Testing only)")) return;
        setUpdating(true);
        try {
            await apiFetch(`/applications/${id}/reset`, { method: 'POST' });
            // Refresh entire data
            const [appData] = await Promise.all([
                apiFetch(`/applications/${id}`),
                checkQuizPresence()
            ]);
            setApplication(appData);
            showToast("Application Reset!", "info");
        } catch (err) {
            console.error(err);
            showToast("Reset failed.");
        } finally {
            setUpdating(false);
        }
    };

    const handleSendProposal = async (proposalData) => {
        try {
            const returnedProposal = await apiFetch('/interviews/proposals', {
                method: 'POST',
                body: JSON.stringify({
                    application_id: id,
                    company_id: application.company_id,
                    candidate_name: `${finalFirstName} ${finalLastName}`,
                    candidate_email: finalEmail,
                    slots: proposalData.slots.map(s => {
                        // s is "Fri Mar 27 2026 08:30"
                        const d = new Date(s);
                        if (isNaN(d.getTime())) {
                            console.error("Invalid date string:", s);
                            return null;
                        }
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const hours = String(d.getHours()).padStart(2, '0');
                        const minutes = String(d.getMinutes()).padStart(2, '0');
                        // Return a naive ISO string (no 'Z') so the literal local time is preserved across browsers
                        return `${year}-${month}-${day}T${hours}:${minutes}:00`;
                    }).filter(s => s !== null),
                    duration_minutes: proposalData.duration,
                    interview_type: proposalData.interviewType,
                    message: proposalData.message
                })
            });
            showToast("Propositions envoyées au candidat !", "info");
            setIsProposeModalOpen(false);
            
            // Instantly update the UI states without needing a page refresh
            setApplication(prev => ({ 
                ...prev, 
                interview_status: 'pending_candidate', 
                interview_proposal_id: returnedProposal._id 
            }));
            setPendingProposal({...returnedProposal, status: 'pending'});
        } catch (err) {
            console.error("Failed to send proposal", err);
            showToast("Erreur lors de l'envoi des propositions.");
        }
    };

    if (loading) {
        return (
            <div className={`app-track-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="app-track-main tf-center-screen">
                    <div className="tf-spinner"></div>
                </main>
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className={`app-track-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="app-track-main tf-center-screen">
                    <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '3rem' }}>error</span>
                    <h2 className="tf-meta-title" style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>{t('app.track.not_found')}</h2>
                    <button className="tf-btn tf-btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: '1.5rem' }}>{t('app.track.go_back')}</button>
                </main>
            </div>
        );
    }

    const profile = application.profile_snapshot || {};

    // Accurate data prioritizing fresh candidate over static snapshot, covering aliased fields
    const candFirst = candidate?.firstName || candidate?.prenom || candidate?.first_name || '';
    const candLast = candidate?.lastName || candidate?.nom || candidate?.last_name || '';
    const finalFirstName = candFirst || profile.firstName || profile.prenom || '';
    const finalLastName = candLast || profile.lastName || profile.nom || '';

    const candEmail = candidate?.email || candidate?.contactEmail || '';
    const finalEmail = candEmail || profile.email || 'N/A';

    const candPhone = candidate?.phone || candidate?.telephone || candidate?.phoneNumber || '';
    const finalPhone = candPhone || profile.phone || profile.telephone || 'N/A';

    const candTitle = candidate?.title || candidate?.posteActuel || candidate?.headline || '';
    const finalTitle = candTitle || profile.title || profile.posteActuel || 'Unspecified';

    const candPic = candidate?.profileImage || candidate?.profilePicture || candidate?.avatar || candidate?.photo || '';
    const profileImage = candPic || profile.profileImage || profile.avatar || profile.photo || '';

    const isRejected = application.status === 'rejected';
    const isAccepted = application.status === 'accepted';
    const currentIndex = STEPS.findIndex(s => s.id === application.status);
    const activeIndex = isRejected ? -1 : (currentIndex === -1 ? 0 : currentIndex);

    const initials = finalFirstName || finalLastName
        ? `${finalFirstName.charAt(0) || ''}${finalLastName ? finalLastName.charAt(0) : ''}`.toUpperCase()
        : '?';

    const aiScore = application.ai_score;
    const aiText = application.ai_justification;

    // Check if analysis is missing or contains an error string
    const isAiError = aiText && (aiText.includes("Erreur") || aiText.includes("Error") || aiText.includes("404") || aiText.includes("Client error"));
    const noAiAnalysis = aiScore == null || aiScore === 0 || isAiError;

    // Check if motivation letter exists to adjust grid smartly
    const hasMotivation = !!application.motivation_letter;
    const metricsColClass = hasMotivation ? 'tf-col-4' : 'tf-col-6';

    const buildHistory = () => {
        const entries = [];
        if (application.applied_at) {
            entries.push({ label: t('app.track.event.received'), date: application.applied_at, primary: false });
        }
        if (aiScore != null) {
            entries.push({ label: t('app.track.event.ai_screening'), date: application.applied_at, primary: false });
        }
        if (application.updated_at && application.status !== 'pending') {
            const stepLabel = isRejected ? t('app.track.step.rejected') : isAccepted ? t('app.track.step.accepted') : STEPS.find(s => s.id === application.status)?.label || 'Updated';
            entries.push({ label: t('app.track.event.moved_to', { step: stepLabel }), date: application.updated_at, primary: true });
        }
        return entries;
    };

    const history = buildHistory().reverse(); // Newest first

    const formatDate = (d) => {
        if (!d) return '';
        try {
            const locale = language === 'fr' ? 'fr-FR' : 'en-US';
            return new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        } catch { return ''; }
    };

    return (
        <div className={`app-track-page ${effectiveTheme === 'dark' ? 'dark' : 'light'}`}>
            <HRSidebar />
            <main className="app-track-main">

                {/* ── Breadcrumbs / Meta Header ── */}
                <div className="tf-meta-header">
                    <div>
                        <span className="tf-meta-subtitle">{t('app.track.candidate_profile')}</span>
                        <h1 className="tf-meta-title">{finalFirstName || (language === 'fr' ? 'Inconnu' : 'Unknown')} {finalLastName || (language === 'fr' ? 'Candidat' : 'Candidate')}</h1>
                    </div>
                    <div className="tf-meta-actions">
                        {isRejected ? (
                            <button className="tf-btn tf-btn-secondary" onClick={() => handleUpdateStatus('pending')} disabled={updating}>
                                {t('app.track.reintegrate')}
                            </button>
                        ) : (
                            <>
                                <button className="tf-btn tf-btn-secondary" onClick={() => { if (window.confirm(t('app.track.reject_confirm'))) handleUpdateStatus('rejected'); }} disabled={updating}>
                                    {t('app.track.reject')}
                                </button>
                                <button className="tf-btn tf-btn-secondary" onClick={() => setIsCVModalOpen(true)}>
                                    {t('app.track.see_cv')}
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>visibility</span>
                                </button>
                                <button className="tf-btn tf-btn-secondary" style={{ backgroundColor: '#fff0f0', border: '1px solid #ba1a1a' }} onClick={handleReset} disabled={updating}>
                                    RESET
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#ba1a1a' }}>restart_alt</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Dashboard Grid (12-column) ── */}
                <div className="tf-grid">

                    {/* Profile Header Card */}
                    <section className="tf-col-12 tf-card">
                        <div className="tf-profile-row">
                            <div className="tf-profile-avatar" style={profileImage ? { backgroundImage: `url("${profileImage}")`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}}>
                                {!profileImage && initials}
                            </div>
                            <div className="tf-profile-details">
                                <div>
                                    <p className="tf-detail-label">{t('app.track.current_role')}</p>
                                    <p className="tf-detail-value">{finalTitle}</p>
                                </div>
                                <div>
                                    <p className="tf-detail-label">{t('app.track.job_applied')}</p>
                                    <p className="tf-detail-value">{application.job_title || t('app.track.unknown_position')}</p>
                                </div>
                                <div>
                                    <p className="tf-detail-label">{t('app.track.email')}</p>
                                    <p className="tf-detail-value" style={{ wordBreak: 'break-all' }}>{finalEmail}</p>
                                </div>
                                <div>
                                    <p className="tf-detail-label">{t('app.track.phone')}</p>
                                    <p className="tf-detail-value">{finalPhone}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Recruitment Stepper */}
                    <section className="tf-col-12 tf-card" style={{ padding: '2rem' }}>
                        <div className="tf-stepper-container">
                            <div className="tf-stepper-track-bg"></div>

                            {/* Calculate fill width based on active step */}
                            <div className="tf-stepper-track-fill" style={{
                                width: isRejected ? '0%' : `${activeIndex <= 0 ? 0 : (activeIndex / (STEPS.length - 1)) * 100}%`,
                                backgroundColor: isRejected ? '#ef4444' : 'var(--tf-primary)'
                            }}></div>

                            {isRejected ? (
                                <>
                                    <div className="tf-step-node">
                                        <div className="tf-step-icon-wrapper tf-step-icon-done" style={{ backgroundColor: 'var(--tf-outline-variant)' }}>
                                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>inbox</span>
                                        </div>
                                        <span className="tf-step-label tf-step-label-muted">{t('app.track.step.received')}</span>
                                    </div>
                                    <div className="tf-step-node">
                                        <div className="tf-step-icon-wrapper tf-step-icon-rejected">
                                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>close</span>
                                        </div>
                                        <span className="tf-step-label tf-step-label-rejected">{t('app.track.step.rejected')}</span>
                                    </div>
                                </>
                            ) : (
                                STEPS.map((step, idx) => {
                                    const isDone = idx < activeIndex;
                                    const isCurrent = idx === activeIndex;

                                    let iconClass = 'tf-step-icon-pending';
                                    if (isDone) iconClass = 'tf-step-icon-done';
                                    else if (isCurrent) iconClass = 'tf-step-icon-current';

                                    let labelClass = 'tf-step-label-muted';
                                    if (isDone) labelClass = '';
                                    else if (isCurrent) labelClass = 'tf-step-label-primary';

                                    return (
                                        <div key={step.id} className="tf-step-node">
                                            <div className={`tf-step-icon-wrapper ${iconClass}`}>
                                                <span className="material-symbols-outlined" style={{ fontSize: isCurrent ? '1.25rem' : '0.875rem', fontVariationSettings: isDone || isCurrent ? "'FILL' 1" : "'FILL' 0" }}>
                                                    {isDone ? 'check' : step.icon}
                                                </span>
                                            </div>
                                            <span className={`tf-step-label ${labelClass}`}>{step.label}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    {/* AI Job Match */}
                    <section className={`${metricsColClass} ${noAiAnalysis ? 'tf-locked-card' : 'tf-card'} tf-analysis-card`} style={{ display: 'flex', flexDirection: 'column' }}>
                        {!noAiAnalysis && (
                            <div className="tf-card-header-icon" style={{ marginBottom: '1.5rem' }}>
                                <span className="tf-detail-label">{t('app.track.ai_match_title')}</span>
                                <span className="material-symbols-outlined" style={{ color: 'var(--tf-primary)', fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                            </div>
                        )}

                        {noAiAnalysis ? (
                            <>
                                <div className="tf-locked-icon">
                                    <span className={`material-symbols-outlined ${aiLoading ? 'tf-loading-icon' : ''}`} style={{ color: 'var(--tf-primary)', fontVariationSettings: "'FILL' 1" }}>
                                        {aiLoading ? 'hourglass_empty' : 'auto_awesome'}
                                    </span>
                                </div>
                                <h3 className="tf-locked-title">{t('app.track.ai_match_title')}</h3>
                                <p className="tf-locked-desc" style={{ marginBottom: '1.5rem' }}>
                                    {t('app.track.ai_match_desc')}
                                </p>
                                <button
                                    className="tf-btn tf-btn-primary"
                                    style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content', opacity: aiLoading ? 0.7 : 1 }}
                                    onClick={handleAnalyze}
                                    disabled={aiLoading}
                                >
                                    <span className={`material-symbols-outlined ${aiLoading ? 'tf-loading-icon' : ''}`} style={{ fontSize: '1rem' }}>
                                        {aiLoading ? 'hourglass_empty' : 'auto_awesome'}
                                    </span>
                                    {aiLoading ? t('app.track.analyzing') : t('app.track.analyze_btn')}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="tf-score-display">
                                    <span className="tf-score-number">{aiScore}</span>
                                    <span className="tf-score-percent">%</span>
                                </div>
                                <p className="tf-card-body-text">
                                    {aiText}
                                </p>
                            </>
                        )}
                    </section>

                    {/* Motivation Letter (Optional) */}
                    {hasMotivation && (
                        <section className="tf-col-4 tf-card">
                            <span className="tf-detail-label block mb-4" style={{ marginBottom: '1rem', display: 'block' }}>{t('app.track.motivation_title')}</span>
                            <div className="tf-scroll-text">
                                <p className="tf-p-text">
                                    "{application.motivation_letter}"
                                </p>
                            </div>
                        </section>
                    )}

                    {/* Activity History */}
                    {history.length > 0 && (
                        <section className={`${metricsColClass} tf-card`} style={{ padding: 0, border: 'none', background: 'transparent' }}>
                            <ActivityTimeline 
                                title={t('app.track.activity_history')}
                                events={[
                                    ...history.map((entry, idx) => ({
                                        id: idx,
                                        label: entry.label,
                                        date: formatDate(entry.date),
                                        formattedDate: formatDate(entry.date),
                                        type: entry.type || 'default',
                                        primary: entry.primary,
                                        isError: entry.isError,
                                    })),
                                    ...pastInterviews.map((past, idx) => ({
                                        id: `past-${idx}`,
                                        label: past.label || 'Interview Completed',
                                        date: past.date || past.end_time,
                                        formattedDate: formatDate(past.date || past.end_time),
                                        type: 'completed',
                                        primary: true,
                                        action: 'View Report',
                                        onAction: () => setIsHistoryModalOpen(true),
                                    }))
                                ]}
                                maxVisibleItems={6}
                            />
                        </section>
                    )}

                    {/* Assessment Placeholders (Span 6) */}
                    <section className={`tf-col-6 ${hasQuizAnalysis ? 'tf-card tf-quiz-review-card' : 'tf-locked-card'} tf-analysis-card`}>
                        {hasQuizAnalysis ? (
                            <>
                                <div className="tf-quiz-review-header">
                                    <div className="tf-quiz-review-heading">
                                        <span className="tf-detail-label">{t('app.track.quiz_analysis_title')}</span>
                                        <h3 className="tf-quiz-review-title">{t('app.track.quiz_ai_feedback')}</h3>
                                    </div>
                                    <div className="tf-quiz-review-status">
                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>auto_awesome</span>
                                        <span>{quizFeedbackStatusLabel}</span>
                                    </div>
                                </div>

                                <div className="tf-quiz-review-scoreband">
                                    <div className="tf-quiz-review-scoreblock">
                                        <span className="tf-quiz-review-score-value">{Math.round(application.quiz_score)}</span>
                                        <span className="tf-quiz-review-score-unit">%</span>
                                    </div>
                                    <div className="tf-quiz-review-meta">
                                        <span className="tf-quiz-review-chip">
                                            {t('app.track.quiz_attempts', { count: application.quiz_attempts || 1 })}
                                        </span>
                                        {application.quiz_completed_at && (
                                            <span className="tf-quiz-review-chip">
                                                {t('app.track.quiz_completed_on', { date: formatDate(application.quiz_completed_at) })}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="tf-quiz-review-body">
                                    <div className="tf-quiz-review-body-head">
                                        <p className="tf-quiz-review-body-label">{t('app.track.quiz_ai_feedback')}</p>
                                        {isQuizFeedbackLong && (
                                            <button
                                                type="button"
                                                className="tf-quiz-review-toggle"
                                                onClick={() => setIsQuizFeedbackExpanded(prev => !prev)}
                                            >
                                                {quizFeedbackToggleLabel}
                                            </button>
                                        )}
                                    </div>
                                    <div className={`tf-quiz-review-text-shell ${!isQuizFeedbackExpanded && isQuizFeedbackLong ? 'is-collapsed' : 'is-expanded'}`}>
                                        <p className="tf-quiz-review-text">
                                            {quizAnalysisText}
                                        </p>
                                        {!isQuizFeedbackExpanded && isQuizFeedbackLong && (
                                            <div className="tf-quiz-review-fade" aria-hidden="true"></div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="tf-locked-icon">
                                    <span className="material-symbols-outlined">
                                        {application.quiz_status === 'completed' ? 'analytics' : (quizId ? 'task_alt' : 'lock')}
                                    </span>
                                </div>
                                <h3 className="tf-locked-title">{t('app.track.quiz_analysis_title')}</h3>

                                <div className="tf-locked-desc" style={{ marginBottom: '1.5rem', width: '100%' }}>
                                    {application.quiz_status === 'completed' ? (
                                        <div className="tf-quiz-analysis-summary">
                                            <div className="tf-score-display" style={{ marginBottom: 0 }}>
                                                <span className="tf-score-number" style={{ fontSize: '2.5rem' }}>{Math.round(application.quiz_score)}</span>
                                                <span className="tf-score-percent" style={{ fontSize: '1rem' }}>%</span>
                                            </div>
                                            <p className="tf-quiz-analysis-meta">
                                                {t('app.track.quiz_attempts', { count: application.quiz_attempts || 1 })}
                                            </p>
                                            <p className="tf-detail-label tf-quiz-analysis-date">
                                                {t('app.track.quiz_completed_on', { date: formatDate(application.quiz_completed_at) })}
                                            </p>
                                        </div>
                                    ) : (
                                        <p>
                                            {quizId
                                                ? (application.quiz_status === 'sent'
                                                    ? t('app.track.quiz_sent_waiting')
                                                    : t('app.track.quiz_ready'))
                                                : t('app.track.quiz_pending_alg')}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="tf-btn-group" style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center' }}>
                            {/* APPROVE BUTTON (Visible ONLY if in_review AND analyzed) */}
                            {application.status === 'in_review' && !noAiAnalysis && (
                                <button
                                    className="tf-btn tf-btn-primary"
                                    style={{ fontSize: '0.875rem', padding: '0.6rem 1.2rem' }}
                                    onClick={() => handleUpdateStatus('technical_test')}
                                    disabled={updating}
                                >
                                    {t('app.track.approve_to_quiz')}
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>arrow_forward</span>
                                </button>
                            )}

                            {/* QUIZ ACTIONS (Visible ONLY if in technical_test stage or later) */}
                            {STEPS.findIndex(s => s.id === application.status) >= 2 && quizId && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', alignItems: 'center' }}>
                                    <div className="tf-btn-group" style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button
                                            className="tf-btn tf-btn-secondary"
                                            style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
                                            onClick={() => navigate(`/hr/quizzes/${quizId}`)}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>visibility</span>
                                            {application.quiz_status === 'completed' ? t('app.track.view_quiz_details') : t('app.track.view_quiz')}
                                        </button>
                                    </div>
                                    {application.quiz_status === 'completed' && (
                                        <button
                                            className="tf-btn tf-btn-primary"
                                            style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
                                            onClick={handleAnalyzeQuiz}
                                            disabled={quizAiLoading}
                                        >
                                            <span className={`material-symbols-outlined ${quizAiLoading ? 'tf-loading-icon' : ''}`} style={{ fontSize: '1rem' }}>
                                                {quizAiLoading ? 'hourglass_empty' : 'auto_awesome'}
                                            </span>
                                            {quizAiLoading ? t('app.track.analyzing_perf') : t('app.track.analyze_performance')}
                                        </button>
                                    )}
                                </div>
                            )}
                            {STEPS.findIndex(s => s.id === application.status) >= 2 && (!application.quiz_status || application.quiz_status === 'pending') && (
                                <button
                                    className="tf-btn tf-btn-primary"
                                    style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
                                    onClick={() => setIsQuizModalOpen(true)}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{quizId ? 'edit_note' : 'quiz'}</span>
                                    {quizId ? t('app.track.update_quiz') : t('app.track.create_quiz')}
                                </button>
                            )}
                        </div>
                    </section>
                    <section className={`tf-col-6 ${interview || application?.interview_status === 'pending_candidate' ? 'tf-card tf-interview-card' : 'tf-locked-card'} tf-analysis-card`}>
                        {application?.interview_status === 'pending_candidate' ? (
                            <div className="tf-interview-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', alignItems: 'flex-start' }}>
                                {/* Header */}
                                <div className="tf-card-header-icon" style={{ marginBottom: '1.25rem', width: '100%', justifyContent: 'space-between' }}>
                                    <span className="tf-detail-label">{language === 'fr' ? 'Invitation Envoyée' : 'Invitation Sent'}</span>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        background: 'var(--tf-surface-low)', color: 'var(--tf-on-surface-variant)',
                                        border: '1px solid var(--tf-outline-variant)',
                                        borderRadius: '999px', padding: '3px 10px',
                                        fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em'
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '13px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>hourglass_empty</span>
                                        {language === 'fr' ? 'En attente' : 'Pending'}
                                    </span>
                                </div>

                                {/* Message */}
                                <p style={{ fontSize: '0.95rem', color: 'var(--tf-on-surface-variant)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                                    {language === 'fr' 
                                        ? `Le candidat a été invité à choisir l'un de ces ${pendingProposal?.slots?.length || 0} créneaux :` 
                                        : `The candidate was invited to choose one of these ${pendingProposal?.slots?.length || 0} slots:`}
                                </p>

                                {/* Slots Tray */}
                                <div style={{
                                    display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '0.8rem', marginBottom: '1.5rem', width: '100%',
                                    scrollbarWidth: 'thin', scrollbarColor: 'var(--tf-outline-variant) transparent'
                                }}>
                                    {pendingProposal?.slots?.map((slot, index) => {
                                        const d = new Date(slot);
                                        const dayName = d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
                                        const time = d.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

                                        return (
                                            <div key={index} style={{
                                                minWidth: '160px', flexShrink: 0,
                                                background: 'var(--tf-surface-low)',
                                                border: '1px solid var(--tf-outline-variant)',
                                                borderRadius: '10px', padding: '1rem',
                                                display: 'flex', flexDirection: 'column', gap: '4px'
                                            }}>
                                                <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tf-on-surface-variant)' }}>
                                                    {language === 'fr' ? `Proposition ${index + 1}` : `Option ${index + 1}`}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--tf-on-surface)' }}>
                                                    {dayName}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--tf-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>schedule</span>
                                                    {time}
                                                </p>
                                            </div>
                                        );
                                    }) || (
                                        <div style={{ padding: '2rem', width: '100%', textAlign: 'center', color: 'var(--tf-on-surface-variant)', fontSize: '0.9rem' }}>
                                            {language === 'fr' ? 'Chargement des créneaux...' : 'Loading slots...'}
                                        </div>
                                    )}
                                </div>

                                {/* Info pills */}
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', marginBottom: '1rem', width: '100%' }}>
                                    <div style={{
                                        flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem',
                                        background: 'var(--tf-surface-low)', border: '1px solid var(--tf-outline-variant)',
                                        borderRadius: '10px', padding: '1rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="material-symbols-outlined" style={{ color: 'var(--tf-primary)', fontSize: '1.25rem' }}>timer</span>
                                            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--tf-on-surface-variant)', margin: 0 }}>
                                                {language === 'fr' ? 'Durée' : 'Duration'}
                                            </p>
                                        </div>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--tf-on-surface)', margin: 0 }}>
                                            {pendingProposal?.duration_minutes || 45} min
                                        </p>
                                    </div>
                                    <div style={{
                                        flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem',
                                        background: 'var(--tf-surface-low)', border: '1px solid var(--tf-outline-variant)',
                                        borderRadius: '10px', padding: '1rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="material-symbols-outlined" style={{ color: 'var(--tf-primary)', fontSize: '1.25rem' }}>video_call</span>
                                            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--tf-on-surface-variant)', margin: 0 }}>
                                                {language === 'fr' ? 'Format' : 'Format'}
                                            </p>
                                        </div>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--tf-on-surface)', margin: 0 }}>
                                            {pendingProposal?.interview_type || 'Video call'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : interview ? (
                            <div className="tf-interview-content">
                                {/* Header */}
                                 <div className="tf-card-header-icon" style={{ marginBottom: '1rem' }}>
                                    <span className="tf-detail-label">{t('app.track.interview_confirmed')}</span>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        background: 'rgba(34,197,94,0.1)', color: '#16a34a',
                                        borderRadius: '999px', padding: '3px 10px',
                                        fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em'
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 1" }}>circle</span>
                                        {language === 'fr' ? 'Confirmé' : 'Confirmed'}
                                    </span>
                                </div>

                                {(interview.status !== 'completed' || !pastInterviews.length) ? (
                                    <>
                                        {/* Big date hero */}
                                        <div style={{
                                            background: 'var(--tf-surface-low)',
                                            borderRadius: '10px',
                                            padding: '1.25rem 1.5rem',
                                            marginBottom: '1rem',
                                            border: '1px solid var(--tf-outline-variant)'
                                        }}>
                                            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tf-on-surface-variant)', marginBottom: '0.25rem' }}>
                                                {language === 'fr' ? 'Date & Heure' : 'Date & Time'}
                                            </p>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--tf-font-headline)', color: 'var(--tf-on-surface)', margin: 0, letterSpacing: '-0.03em' }}>
                                                {new Date(interview.start_time).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>
                                            <p style={{ fontSize: '2.25rem', fontWeight: 800, fontFamily: 'var(--tf-font-headline)', color: 'var(--tf-primary)', margin: '0.1rem 0 0', letterSpacing: '-0.04em', lineHeight: 1 }}>
                                                {new Date(interview.start_time).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>

                                        {/* Info pills row */}
                                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                                            <div style={{
                                                flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem',
                                                background: 'var(--tf-surface-low)', border: '1px solid var(--tf-outline-variant)',
                                                borderRadius: '10px', padding: '1.5rem', minHeight: '120px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="material-symbols-outlined" style={{ color: 'var(--tf-primary)', fontSize: '1.5rem' }}>video_call</span>
                                                    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--tf-on-surface-variant)', margin: 0 }}>{language === 'fr' ? 'Format' : 'Format'}</p>
                                                </div>
                                                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--tf-on-surface)', margin: 0 }}>{interview.type}</p>
                                            </div>
                                            <div style={{
                                                flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem',
                                                background: 'var(--tf-surface-low)', border: '1px solid var(--tf-outline-variant)',
                                                borderRadius: '10px', padding: '1.5rem', minHeight: '120px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="material-symbols-outlined" style={{ color: 'var(--tf-primary)', fontSize: '1.5rem' }}>timelapse</span>
                                                    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--tf-on-surface-variant)', margin: 0 }}>{language === 'fr' ? 'Durée' : 'Duration'}</p>
                                                </div>
                                                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--tf-on-surface)', margin: 0 }}>
                                                    {interview.end_time ? `${Math.round((new Date(interview.end_time) - new Date(interview.start_time)) / 60000)} min` : '45 min'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Join Area */}
                                        {(() => {
                                            if (interview.type !== 'Video call') return null;
                                            const now = liveNow;
                                            const startTime = new Date(interview.start_time);
                                            const endTime = interview.end_time ? new Date(interview.end_time) : new Date(startTime.getTime() + 45 * 60000);
                                            const availableFrom = new Date(startTime.getTime() - 10 * 60000);

                                            // Bug #4 fix: Missed interview — hide join, show alert
                                            if (interview.status === 'missed') {
                                                return (
                                                    <div style={{
                                                        backgroundColor: 'rgba(239,68,68,0.06)',
                                                        border: '1px solid rgba(239,68,68,0.25)',
                                                        borderRadius: '10px', padding: '1rem',
                                                        display: 'flex', alignItems: 'center', gap: '12px'
                                                    }}>
                                                        <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '1.5rem', flexShrink: 0 }}>event_busy</span>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444', fontWeight: 600, lineHeight: 1.4 }}>
                                                            {language === 'fr'
                                                                ? "Cet entretien n'a pas eu lieu. Veuillez reprogrammer ci-dessous."
                                                                : 'This interview was missed. Please reschedule below.'}
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            if (now > endTime) return null;

                                            if (now < availableFrom) {
                                                return (
                                                    <div style={{
                                                        backgroundColor: 'var(--tf-surface-low)', color: 'var(--tf-on-surface-variant)',
                                                        padding: '1rem', borderRadius: '8px', border: '1px solid var(--tf-outline-variant)',
                                                        textAlign: 'center', fontSize: '0.85rem', fontWeight: 600
                                                    }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', marginBottom: '4px', display: 'block' }}>lock_clock</span>
                                                        {language === 'fr' ? "Le lien de visioconférence sera disponible 10 minutes avant le début de l'entretien." : 'The video call link will be available 10 minutes before the start time.'}
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <button
                                                        className="tf-btn tf-btn-primary tf-join-btn"
                                                        onClick={() => navigate(`/hr/interviews/live/${interview._id}`)}
                                                    >
                                                        <span className="material-symbols-outlined">videocam</span>
                                                        {language === 'fr' ? "Rejoindre l'entretien" : 'Join Interview'}
                                                    </button>
                                                );
                                            }
                                        })()}
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '1rem' }}>
                                        <div style={{
                                            width: '74px', height: '74px', borderRadius: '22px',
                                            background: 'rgba(252, 211, 77, 0.05)', border: '1px solid rgba(252, 211, 77, 0.1)',
                                            color: '#fcd34d', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginBottom: '1.5rem'
                                        }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '38px' }}>event_available</span>
                                        </div>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--tf-on-surface)', marginBottom: '0.5rem' }}>
                                            {language === 'fr' ? 'Prêt pour la suite ?' : 'Ready for the next step?'}
                                        </h3>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--tf-on-surface-variant)', marginBottom: '1.5rem', maxWidth: '280px', lineHeight: 1.6 }}>
                                            {language === 'fr' 
                                                ? "L'entretien précédent est terminé. Voulez-vous reprogrammer une nouvelle session ?" 
                                                : "The previous interview is finished. Would you like to reschedule a new session?"}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="tf-locked-icon">
                                    <span className="material-symbols-outlined">lock</span>
                                </div>
                                <h3 className="tf-locked-title">{t('app.track.video_meet_title')}</h3>
                                <p className="tf-locked-desc" style={{ marginBottom: '1.5rem' }}>{t('app.track.video_meet_desc')}</p>
                            </>
                        )}

                                 <div className="tf-btn-group" style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}>
                                    {/* APPROVE BUTTON (Visible ONLY if technical_test AND quiz analyzed) */}
                                    {application.status === 'technical_test' && application.quiz_ai_analysis && (
                                        <button
                                            className="tf-btn tf-btn-primary"
                                            style={{ fontSize: '0.875rem', padding: '0.6rem 1.2rem' }}
                                            onClick={() => handleUpdateStatus('interview')}
                                            disabled={updating}
                                        >
                                            {t('app.track.approve_to_interview')}
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>arrow_forward</span>
                                        </button>
                                    )}

                                    {/* ALWAYS SHOW RESCHEDULE/ORGANIZE IF AT INTERVIEW STAGE OR BEYOND */}
                                    {STEPS.findIndex(s => s.id === application.status) >= 3 && (
                                        <button
                                            className="tf-btn tf-btn-primary"
                                            disabled={application.interview_status === 'pending_candidate'}
                                            style={{
                                                fontSize: '0.75rem',
                                                padding: '0.5rem 1rem',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                width: '100%',
                                                justifyContent: 'center',
                                                // Bug #3 fix: Red button for missed interview
                                                background: interview?.status === 'missed'
                                                    ? '#dc2626'
                                                    : (interview || pastInterviews.length > 0) ? 'var(--tf-surface-low)' : 'var(--tf-primary)',
                                                color: interview?.status === 'missed'
                                                    ? 'white'
                                                    : (interview || pastInterviews.length > 0) ? 'var(--tf-on-surface)' : 'var(--tf-on-primary)',
                                                border: interview?.status === 'missed'
                                                    ? '1px solid #991b1b'
                                                    : (interview || pastInterviews.length > 0) ? '1px solid var(--tf-outline-variant)' : 'none',
                                                boxShadow: interview?.status === 'missed' ? '0 0 0 3px rgba(220,38,38,0.15)' : 'none',
                                                animation: interview?.status === 'missed' ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none'
                                            }}
                                            onClick={() => setIsProposeModalOpen(true)}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                                                {application.interview_status === 'pending_candidate' ? 'hourglass_empty'
                                                    : interview?.status === 'missed' ? 'warning'
                                                    : 'video_call'}
                                            </span>
                                            {application.interview_status === 'pending_candidate'
                                                ? t('app.track.waiting_for_response')
                                                : interview?.status === 'missed'
                                                    ? (language === 'fr' ? ' Reprogrammer' : 'Reschedule')
                                                    : (pastInterviews.length > 0 || interview ? (language === 'fr' ? 'Reprogrammer un entretien' : 'Reschedule interview') : t('app.track.organize_meeting'))}
                                        </button>
                                    )}
                                </div>
                    </section>

                    {/* PAST INTERVIEWS HISTORY (BIALN IA) - Full width below */}
                    {/* AI History is now in a modal */}
                </div>

                <CreateQuizModal
                    isOpen={isQuizModalOpen}
                    onClose={() => setIsQuizModalOpen(false)}
                    applicationId={id}
                    quizId={quizId}
                    quizStatus={application.quiz_status}
                    jobTitle={application.job_title}
                />

                <CVViewerModal
                    isOpen={isCVModalOpen}
                    onClose={() => setIsCVModalOpen(false)}
                    applicationId={id}
                    candidateName={`${finalFirstName} ${finalLastName}`}
                />

                <ProposeSlotsModal
                    isOpen={isProposeModalOpen}
                    onClose={() => setIsProposeModalOpen(false)}
                    candidate={{
                        firstName: finalFirstName,
                        lastName: finalLastName,
                        profileImage: profileImage
                    }}
                    application={application}
                    onSend={handleSendProposal}
                />

                <InterviewHistoryModal
                    isOpen={isHistoryModalOpen}
                    onClose={() => setIsHistoryModalOpen(false)}
                    pastInterviews={pastInterviews}
                    language={language}
                />
            </main>

            {/* Simple Toast Notification */}
            {toast && (
                <div className={`tf-toast-container ${toast.type}`}>
                    <span className="material-symbols-outlined">
                        {toast.type === 'error' ? 'error' : 'info'}
                    </span>
                    <span className="tf-toast-message">{toast.message}</span>
                    <button className="tf-toast-close" onClick={() => setToast(null)}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ApplicationTrack;
