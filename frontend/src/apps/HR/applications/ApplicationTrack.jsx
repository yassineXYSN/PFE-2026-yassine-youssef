import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../../../core/useLanguage';
import HRSidebar from '../components/HRSidebar';
import { apiFetch, SERVER_URL } from '../../../core/api';
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
    const [quizzes, setQuizzes] = useState([]);
    const [isCVModalOpen, setIsCVModalOpen] = useState(false);
    const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
    const [quizAiLoading, setQuizAiLoading] = useState(false);
    const [isQuizFeedbackExpanded, setIsQuizFeedbackExpanded] = useState(false);
    const [interview, setInterview] = useState(null);
    const [pendingProposal, setPendingProposal] = useState(null);
    const [pastInterviews, setPastInterviews] = useState([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [cnnMatch, setCnnMatch] = useState(null);
    const [cnnMatchLoading, setCnnMatchLoading] = useState(false);
    const [isCnnModalOpen, setIsCnnModalOpen] = useState(false);
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

    // Live time for the interview logic
    const [liveNow, setLiveNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setLiveNow(new Date()), 30000); // 30s updates
        return () => clearInterval(timer);
    }, []);

    const fetchApplicationQuizzes = async () => {
        try {
            const params = new URLSearchParams({
                application_id: id,
                limit: '50',
            });
            const data = await apiFetch(`/quiz/quizzes?${params.toString()}`);
            setQuizzes(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch application quizzes", err);
            setQuizzes([]);
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
            await Promise.all([
                fetchPastInterviews(),
                fetchApplicationQuizzes()
            ]);
            try {
                const data = await apiFetch(`/applications/${id}`);
                if (data.job_id) {
                    try {
                        const jobData = await apiFetch(`/jobs/${data.job_id}`);
                        data.job_title = jobData.title;
                        data.company_id = jobData.company_id;
                        data.allow_hr = jobData.allow_hr;
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
    }, [id]);

    useEffect(() => {
        if (!isQuizModalOpen) {
            fetchApplicationQuizzes();
        }
    }, [isQuizModalOpen]);

    useEffect(() => {
        if (!application) return;
        const candidateId = application.candidate_id || application.candidat_id || application.user_id;
        const jobId = application.job_id;
        if (!candidateId || !jobId) return;

        let active = true;
        setCnnMatchLoading(true);

        // Fetch detailed CNN breakdown
        apiFetch(`/ai-analysis/candidate/${candidateId}/job-match/${jobId}`)
            .then((data) => { if (active) setCnnMatch(data); })
            .catch(() => {})
            .finally(() => { if (active) setCnnMatchLoading(false); });

        // Also fetch up-to-date scores (in case they were updated recently)
        apiFetch(`/ai-matching/applicant-scores/${jobId}`)
            .then((data) => {
                if (active && data && Array.isArray(data)) {
                    const myScore = data.find(s => 
                        (s.candidate_id && s.candidate_id.toString() === candidateId.toString()) || 
                        (s.user_id && s.user_id.toString() === candidateId.toString()) ||
                        (s.application_id && s.application_id.toString() === id.toString())
                    );
                    if (myScore) {
                        setApplication(prev => ({
                            ...prev,
                            llm_score: myScore.llm_score || myScore.ai_score,
                            cnn_score: myScore.cnn_score,
                            ai_score: myScore.llm_score || myScore.ai_score
                        }));
                    }
                }
            })
            .catch(() => {});

        return () => { active = false; };
    }, [application?.candidate_id, application?.candidat_id, application?.user_id, application?.job_id]);

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
            await fetchApplicationQuizzes();
            showToast(t('app.track.toast.ai_success'), "info");
        } catch (e) {
            console.error('Error in Quiz analysis:', e);
            showToast(t('app.track.toast.quiz_error'));
        } finally {
            setQuizAiLoading(false);
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
            setPendingProposal({ ...returnedProposal, status: 'pending' });
        } catch (err) {
            console.error("Failed to send proposal", err);
            showToast("Erreur lors de l'envoi des propositions.");
        }
    };

    if (loading) {
        return (
            <div className={`app-track-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="app-track-main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 0 }}>
                    <div className="fine-linear-loader" style={{ position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 10000 }}></div>
                    <p style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        opacity: 0.4,
                        fontFamily: 'var(--tf-font-headline)'
                    }}>
                        Chargement du profil
                    </p>
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

    const parseDateValue = (value) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const normalizeQuizStatusValue = (status) => (status === 'published' ? 'sent' : status);
    const getQuizTimelineDate = (quiz) => quiz?.submitted_at || quiz?.published_at || quiz?.updated_at || quiz?.generated_at || null;
    const getQuizStatusLabel = (status) => {
        if (status === 'completed') return t('app.track.quiz_status_completed');
        if (status === 'sent') return t('app.track.quiz_status_sent');
        if (status === 'archived') return t('app.track.quiz_status_archived');
        return t('app.track.quiz_status_draft');
    };

    const sortedQuizzes = [...quizzes].sort((first, second) => {
        const firstDate = parseDateValue(getQuizTimelineDate(first));
        const secondDate = parseDateValue(getQuizTimelineDate(second));
        return (secondDate?.getTime() || 0) - (firstDate?.getTime() || 0);
    });
    const latestQuiz = sortedQuizzes[0] || null;
    const latestCompletedQuiz = sortedQuizzes.find((quiz) => quiz.status === 'completed') || null;
    const hasAnyQuiz = sortedQuizzes.length > 0;
    const latestQuizStatus = latestQuiz ? normalizeQuizStatusValue(latestQuiz.status) : normalizeQuizStatusValue(application.quiz_status);
    const completedQuizCount = sortedQuizzes.filter((quiz) => quiz.status === 'completed').length;
    const quizAttemptCount = application.quiz_attempts || completedQuizCount;
    const quizDisplayScore = (() => {
        const appScore = Number(application.quiz_score);
        if (Number.isFinite(appScore)) return appScore;
        const latestCompletedScore = Number(latestCompletedQuiz?.score);
        if (Number.isFinite(latestCompletedScore)) return latestCompletedScore;
        return null;
    })();
    const hasCompletedQuizWithScore = latestQuizStatus === 'completed' && Number.isFinite(quizDisplayScore);
    const quizDisplayCompletedAt = application.quiz_completed_at || latestCompletedQuiz?.submitted_at || null;
    const hasReachedQuizStage = STEPS.findIndex(s => s.id === application.status) >= 2;

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
        sortedQuizzes.forEach((quiz) => {
            const quizIdValue = quiz.id || quiz._id;
            const quizTitle = quiz.title || (language === 'fr' ? 'Quiz sans titre' : 'Untitled quiz');

            if (quiz.generated_at) {
                entries.push({
                    kind: 'quiz',
                    quizId: quizIdValue,
                    label: t('app.track.quiz_event_created', { title: quizTitle }),
                    date: quiz.generated_at,
                    primary: false,
                });
            }
            if (quiz.published_at) {
                entries.push({
                    kind: 'quiz',
                    quizId: quizIdValue,
                    label: t('app.track.quiz_event_sent', { title: quizTitle }),
                    date: quiz.published_at,
                    primary: true,
                });
            }
            if (quiz.started_at) {
                entries.push({
                    kind: 'quiz',
                    quizId: quizIdValue,
                    label: t('app.track.quiz_event_started', { title: quizTitle }),
                    date: quiz.started_at,
                    primary: false,
                });
            }
            if (quiz.submitted_at) {
                const roundedScore = typeof quiz.score === 'number' ? Math.round(quiz.score) : null;
                entries.push({
                    kind: 'quiz',
                    quizId: quizIdValue,
                    score: roundedScore,
                    label: `${t('app.track.quiz_event_completed', { title: quizTitle })}${roundedScore !== null ? ` (${roundedScore}%)` : ''}`,
                    date: quiz.submitted_at,
                    primary: true,
                });
            }
            if (quiz.ai_analyzed_at) {
                entries.push({
                    kind: 'quiz',
                    quizId: quizIdValue,
                    label: t('app.track.quiz_event_ai', { title: quizTitle }),
                    date: quiz.ai_analyzed_at,
                    primary: false,
                });
            }
        });
        pastInterviews.forEach((past, idx) => {
            entries.push({
                kind: 'interview',
                key: `past-${idx}`,
                label: language === 'fr' ? "Bilan d'entretien disponible" : "Interview Analysis Available",
                date: past.start_time,
                primary: true,
            });
        });
        return entries
            .filter((entry) => entry.date)
            .sort((first, second) => {
                const firstDate = parseDateValue(first.date);
                const secondDate = parseDateValue(second.date);
                return (secondDate?.getTime() || 0) - (firstDate?.getTime() || 0);
            });
    };

    const history = buildHistory();
    const interviewFault = interview?.no_show_fault
        || (application?.interview_status === 'hr_no_show' ? 'hr' : null)
        || (application?.interview_status === 'candidate_no_show' ? 'candidate' : null);
    const interviewNeedsAttention = interview?.status === 'missed'
        || interview?.status === 'no_show'
        || application?.interview_status === 'hr_no_show'
        || application?.interview_status === 'candidate_no_show';

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
                                <button className="tf-btn tf-btn-primary" onClick={async () => {
                                    try {
                                        const res = await apiFetch('/interviews/test-create-and-send', {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                application_id: id,
                                                candidate_name: `${finalFirstName} ${finalLastName}`.trim() || 'Test Candidate',
                                                candidate_email: finalEmail,
                                                company_id: application.company_id || 'test_company'
                                            })
                                        });
                                        showToast(language === 'fr' ? 'Entretien test créé ! Redirection...' : 'Test interview created! Redirecting...', 'success');
                                        if (res?.interview_id) {
                                            // Update local state
                                            setApplication(prev => ({
                                                ...prev,
                                                interview_id: res.interview_id,
                                                interview_status: 'scheduled'
                                            }));
                                            // Navigate to the live interview
                                            navigate(`/hr/interviews/live/${res.interview_id}`);
                                        }
                                    } catch (e) {
                                        console.error('Error creating test interview:', e);
                                        showToast(language === 'fr' ? "Erreur lors de la création de l'entretien." : 'Error creating interview.', 'error');
                                    }
                                }}>
                                    {language === 'fr' ? 'Entretien Immédiat (Test)' : 'Instant Interview (Test)'}
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>video_camera_front</span>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <span className="tf-detail-label" style={{ marginBottom: 0 }}>{t('app.track.recruitment_stepper')}</span>
                            <button 
                                className="tf-btn tf-btn-secondary" 
                                style={{ fontSize: '0.7rem', padding: '0.4rem 0.8rem' }}
                                onClick={() => setIsActivityModalOpen(true)}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>history</span>
                                {t('app.track.activity_history')}
                            </button>
                        </div>
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
                    <section className={`tf-col-6 tf-card tf-analysis-card ${cnnMatchLoading ? 'tf-locked-card' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="tf-card-header-icon" style={{ marginBottom: '1.5rem' }}>
                            <span className="tf-detail-label">
                                {language === 'fr' ? 'Analyse IA Avancée' : 'Advanced AI Analysis'}
                            </span>
                            <span className="material-symbols-outlined" style={{ color: 'var(--tf-primary)', fontVariationSettings: "'FILL' 1" }}>
                                psychology
                            </span>
                        </div>

                        {cnnMatchLoading ? (
                             <div className="cnn-loading-shimmer" style={{ width: '100%' }}>
                                <div className="shimmer-line"></div>
                                <div className="shimmer-line w-75"></div>
                                <div className="shimmer-line w-50"></div>
                            </div>
                        ) : cnnMatch ? (() => {
                            const hasLlmScore = application?.llm_score !== undefined;
                            const rawEmbedding = hasLlmScore ? application.llm_score : (application?.ai_score || 0);
                            const rawCnn = cnnMatch.score ?? 0;
                            const boost = rawEmbedding / 10;
                            const compositeScore = Math.min(100, Math.round(rawCnn + boost));
                            
                            // Gauge calculation
                            const radius = 50;
                            const circumference = 2 * Math.PI * radius;
                            const offset = circumference - (compositeScore / 100) * circumference;

                            return (
                                <div className="tf-analysis-v2">
                                    <div className="tf-analysis-main-row">
                                        <div className="tf-analysis-gauge-wrap">
                                            <svg className="tf-analysis-gauge-svg" width="120" height="120">
                                                <circle className="tf-analysis-gauge-bg" cx="60" cy="60" r={radius} />
                                                <circle 
                                                    className="tf-analysis-gauge-fill" 
                                                    cx="60" cy="60" r={radius} 
                                                    style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
                                                />
                                            </svg>
                                            <div className="tf-analysis-gauge-content">
                                                <span className="tf-analysis-gauge-val">{compositeScore}</span>
                                                <span className="tf-analysis-gauge-label">/100</span>
                                            </div>
                                        </div>

                                        <div className="tf-analysis-info">
                                            <div className="tf-analysis-title-row">
                                                <h3 className="tf-analysis-main-title">
                                                    {language === 'fr' ? 'Score de Compatibilité' : 'Compatibility Score'}
                                                </h3>
                                                {boost > 0 && (
                                                    <div className="tf-analysis-boost-tag">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>auto_awesome</span>
                                                        +{boost.toFixed(1)}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <p className="tf-analysis-desc">
                                                {language === 'fr' 
                                                    ? `Analyse multicritère basée sur le profil technique et l'adéquation sémantique.` 
                                                    : `Multi-criteria analysis based on technical profile and semantic fit.`}
                                            </p>

                                            <div className="tf-analysis-stats-row">
                                                <span className="tf-analysis-stat-pill">
                                                    {language === 'fr' ? 'Technique: ' : 'Technical: '}{rawCnn}%
                                                </span>
                                                <span className="tf-analysis-stat-pill">
                                                    {language === 'fr' ? 'Sémantique: ' : 'Semantic: '}+{boost.toFixed(1)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="tf-skill-matrix-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <div className="tf-skill-matrix-title">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>grid_view</span>
                                            {language === 'fr' ? 'Matrice des Compétences' : 'Skills Matrix'}
                                        </div>

                                        <div className="tf-skill-grid-v2">
                                            {(cnnMatch.breakdown || []).slice(0, 10).map((b, idx) => {
                                                const statusLabels = {
                                                    matched: language === 'fr' ? 'Maîtrisée' : 'Mastered',
                                                    similar: language === 'fr' ? 'Équivalente' : 'Equivalent',
                                                    learnable: language === 'fr' ? 'Apprenable' : 'Learnable',
                                                    missing: language === 'fr' ? 'Absente' : 'Missing'
                                                };
                                                return (
                                                    <div key={idx} className={`tf-skill-item-v2 tf-status-${b.status}`}>
                                                        <span className="tf-skill-name-v2">{b.skill}</span>
                                                        <span className="tf-skill-status-v2">
                                                            {statusLabels[b.status]}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="tf-view-all-row">
                                        <button 
                                            className="tf-btn tf-btn-secondary" 
                                            style={{ width: '100%', justifyContent: 'center', borderRadius: '0.75rem' }}
                                            onClick={() => setIsCnnModalOpen(true)}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>analytics</span>
                                            {language === 'fr' ? 'Accéder au rapport détaillé' : 'Access Detailed Report'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })() : (
                            <div style={{ textAlign: 'center', opacity: 0.5, padding: '3rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '3rem', marginBottom: '1rem' }}>monitoring</span>
                                <p>{language === 'fr' ? 'Analyse non disponible' : 'Analysis not available'}</p>
                            </div>
                        )}
                    </section>

                    <section className={`${noAiAnalysis ? 'tf-locked-card' : 'tf-card'} tf-col-6 tf-analysis-card`} style={{ display: 'flex', flexDirection: 'column' }}>
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
                                {application?.allow_hr === false ? (
                                    <div style={{ backgroundColor: '#fff3cd', color: '#92400e', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', width: '100%', textAlign: 'center' }}>
                                        {t('app.track.ai_automation_locked')}
                                    </div>
                                ) : (
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
                                )}
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
                                {application.status === 'in_review' && (
                                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem', width: '100%' }}>
                                        <button
                                            className="tf-btn tf-btn-primary"
                                            style={{ fontSize: '0.875rem', padding: '0.6rem 1.2rem', width: '100%', justifyContent: 'center' }}
                                            onClick={() => handleUpdateStatus('technical_test')}
                                            disabled={updating}
                                        >
                                            {t('app.track.approve_to_quiz')}
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>arrow_forward</span>
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    {/* Motivation Letter (Optional) */}
                    {hasMotivation && (
                        <section className="tf-col-12 tf-card">
                            <span className="tf-detail-label block mb-4" style={{ marginBottom: '1rem', display: 'block' }}>{t('app.track.motivation_title')}</span>
                            <div className="tf-scroll-text" style={{ height: 'auto', maxHeight: '18rem' }}>
                                <p className="tf-p-text">
                                    "{application.motivation_letter}"
                                </p>
                            </div>
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
                                        <span className="tf-quiz-review-score-value">
                                            {Number.isFinite(quizDisplayScore) ? Math.round(quizDisplayScore) : 'N/A'}
                                        </span>
                                        <span className="tf-quiz-review-score-unit">%</span>
                                    </div>
                                    <div className="tf-quiz-review-meta">
                                        <span className="tf-quiz-review-chip">
                                            {t('app.track.quiz_attempts', { count: quizAttemptCount || 1 })}
                                        </span>
                                        {quizDisplayCompletedAt && (
                                            <span className="tf-quiz-review-chip">
                                                {t('app.track.quiz_completed_on', { date: formatDate(quizDisplayCompletedAt) })}
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
                                        {latestQuizStatus === 'completed' ? 'analytics' : (hasAnyQuiz ? 'task_alt' : 'lock')}
                                    </span>
                                </div>
                                <h3 className="tf-locked-title">{t('app.track.quiz_analysis_title')}</h3>

                                <div className="tf-locked-desc" style={{ marginBottom: '1.5rem', width: '100%' }}>
                                    {latestQuizStatus === 'completed' ? (
                                        <div className="tf-quiz-analysis-summary">
                                            <div className="tf-score-display" style={{ marginBottom: 0 }}>
                                                <span className="tf-score-number" style={{ fontSize: '2.5rem' }}>
                                                    {Number.isFinite(quizDisplayScore) ? Math.round(quizDisplayScore) : 'N/A'}
                                                </span>
                                                {Number.isFinite(quizDisplayScore) && (
                                                    <span className="tf-score-percent" style={{ fontSize: '1rem' }}>%</span>
                                                )}
                                            </div>
                                            <p className="tf-quiz-analysis-meta">
                                                {t('app.track.quiz_attempts', { count: quizAttemptCount || 1 })}
                                            </p>
                                            {quizDisplayCompletedAt && (
                                                <p className="tf-detail-label tf-quiz-analysis-date">
                                                    {t('app.track.quiz_completed_on', { date: formatDate(quizDisplayCompletedAt) })}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <p>
                                                {hasAnyQuiz
                                                    ? (latestQuizStatus === 'sent'
                                                        ? t('app.track.quiz_sent_waiting')
                                                        : t('app.track.quiz_ready'))
                                                    : t('app.track.quiz_pending_alg')}
                                            </p>
                                            {hasAnyQuiz && (
                                                <p className="tf-detail-label tf-quiz-analysis-date">
                                                    {t('app.track.quiz_count', { count: sortedQuizzes.length })}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {hasAnyQuiz && (
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.75rem',
                                    width: '100%',
                                    padding: '0.75rem 0.9rem',
                                    borderRadius: '12px',
                                    background: 'var(--tf-surface-low)',
                                    border: '1px solid var(--tf-outline-variant)'
                                }}>
                                    <span className="tf-detail-label">{t('app.track.quiz_list_title')}</span>
                                    <span className="tf-detail-label">{t('app.track.quiz_count', { count: sortedQuizzes.length })}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%', maxHeight: '280px', overflowY: 'auto' }}>
                                    {sortedQuizzes.map((quiz, idx) => {
                                        const quizDate = formatDate(getQuizTimelineDate(quiz));
                                        const quizStatus = getQuizStatusLabel(normalizeQuizStatusValue(quiz.status));
                                        const quizIdValue = quiz.id || quiz._id;

                                        return (
                                            <div
                                                key={quizIdValue || idx}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '0.75rem',
                                                    width: '100%',
                                                    padding: '0.85rem 0.95rem',
                                                    borderRadius: '12px',
                                                    background: 'var(--tf-surface-low)',
                                                    border: '1px solid var(--tf-outline-variant)'
                                                }}
                                            >
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <p className="tf-history-event" style={{ marginBottom: '0.2rem' }}>
                                                        {quiz.title || `${t('app.track.view_quiz')} ${sortedQuizzes.length - idx}`}
                                                    </p>
                                                    <p className="tf-history-time">
                                                        {quizStatus}{quizDate ? ` - ${quizDate}` : ''}
                                                    </p>
                                                </div>
                                                {'score' in quiz && (quiz.score !== undefined && quiz.score !== null) && (
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem',
                                                        padding: '0.4rem 0.75rem',
                                                        borderRadius: '8px',
                                                        background: quiz.score >= 70 ? 'rgba(34, 197, 94, 0.12)' : (quiz.score >= 50 ? 'rgba(251, 191, 36, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                                                        border: `1px solid ${quiz.score >= 70 ? 'rgba(34, 197, 94, 0.35)' : (quiz.score >= 50 ? 'rgba(251, 191, 36, 0.35)' : 'rgba(239, 68, 68, 0.35)')}`,
                                                    }}>
                                                        <span style={{
                                                            fontSize: '1.25rem',
                                                            fontWeight: 800,
                                                            fontFamily: 'var(--tf-font-headline)',
                                                            color: quiz.score >= 70 ? '#16a34a' : (quiz.score >= 50 ? '#ca8a04' : '#dc2626'),
                                                        }}>{Math.round(quiz.score)}</span>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            color: quiz.score >= 70 ? '#16a34a' : (quiz.score >= 50 ? '#ca8a04' : '#dc2626'),
                                                        }}>%</span>
                                                    </div>
                                                )}
                                                <button
                                                    className="tf-btn tf-btn-secondary"
                                                    style={{ fontSize: '0.75rem', padding: '0.45rem 0.85rem', flexShrink: 0 }}
                                                    onClick={() => navigate(`/hr/quizzes/${quizIdValue}`)}
                                                >
                                                    {quiz.status === 'completed' ? t('app.track.view_quiz_details') : t('app.track.view_quiz')}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="tf-btn-group" style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {latestCompletedQuiz && (
                                application?.allow_hr === false ? (
                                    <div style={{ backgroundColor: '#fff3cd', color: '#92400e', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', width: '100%', textAlign: 'center' }}>
                                        {t('app.track.ai_automation_locked')}
                                    </div>
                                ) : (
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
                                )
                            )}

                            {hasReachedQuizStage && (
                                <button
                                    className="tf-btn tf-btn-primary"
                                    style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
                                    onClick={() => setIsQuizModalOpen(true)}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>quiz</span>
                                    {hasAnyQuiz ? t('app.track.create_another_quiz') : t('app.track.create_quiz')}
                                </button>
                            )}

                            {/* APPROVE BUTTON – moves candidate from technical_test to interview */}
                            {application.status === 'technical_test' && hasCompletedQuizWithScore && (
                                <button
                                    className="tf-btn"
                                    style={{
                                        fontSize: '0.875rem',
                                        padding: '0.6rem 1.2rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: 'transparent',
                                        border: '1.5px solid #ffffff',
                                        color: '#ffffff',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                    }}
                                    onClick={() => handleUpdateStatus('interview')}
                                    disabled={updating}
                                >
                                    {t('app.track.approve_to_interview')}
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>arrow_forward</span>
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
                                        background: interviewNeedsAttention ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                                        color: interviewNeedsAttention ? '#ef4444' : '#16a34a',
                                        borderRadius: '999px', padding: '3px 10px',
                                        fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em'
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 1" }}>
                                            {interviewNeedsAttention ? 'warning' : 'circle'}
                                        </span>
                                        {interviewNeedsAttention
                                            ? (interviewFault === 'candidate'
                                                ? (language === 'fr' ? 'Candidat absent' : 'Candidate absent')
                                                : (language === 'fr' ? 'RH absent' : 'HR absent'))
                                            : (language === 'fr' ? 'Confirmé' : 'Confirmed')}
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
                                            if (interviewNeedsAttention) {
                                                const alertText = interviewFault === 'hr'
                                                    ? (language === 'fr'
                                                        ? "Le recruteur n'a pas rejoint l'entretien. Une reprogrammation est requise."
                                                        : 'The recruiter did not join. A new interview must be scheduled.')
                                                    : interviewFault === 'candidate'
                                                        ? (language === 'fr'
                                                            ? "Le candidat n'a pas rejoint l'entretien. La reprogrammation est optionnelle."
                                                            : 'The candidate did not join. Rescheduling is optional.')
                                                        : (language === 'fr'
                                                            ? "Cet entretien n'a pas eu lieu. Veuillez reprogrammer ci-dessous."
                                                            : 'This interview was missed. Please reschedule below.');
                                                return (
                                                    <div style={{
                                                        backgroundColor: 'rgba(239,68,68,0.06)',
                                                        border: '1px solid rgba(239,68,68,0.25)',
                                                        borderRadius: '10px', padding: '1rem',
                                                        display: 'flex', alignItems: 'center', gap: '12px'
                                                    }}>
                                                        <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '1.5rem', flexShrink: 0 }}>event_busy</span>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444', fontWeight: 600, lineHeight: 1.4 }}>
                                                            {alertText}
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
                                        background: interviewNeedsAttention
                                            ? '#dc2626'
                                            : (interview || pastInterviews.length > 0) ? 'var(--tf-surface-low)' : 'var(--tf-primary)',
                                        color: interviewNeedsAttention
                                            ? 'white'
                                            : (interview || pastInterviews.length > 0) ? 'var(--tf-on-surface)' : 'var(--tf-on-primary)',
                                        border: interviewNeedsAttention
                                            ? '1px solid #991b1b'
                                            : (interview || pastInterviews.length > 0) ? '1px solid var(--tf-outline-variant)' : 'none',
                                        boxShadow: interviewNeedsAttention ? '0 0 0 3px rgba(220,38,38,0.15)' : 'none',
                                        animation: interviewNeedsAttention ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none'
                                    }}
                                    onClick={() => setIsProposeModalOpen(true)}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                                        {application.interview_status === 'pending_candidate' ? 'hourglass_empty'
                                            : interviewNeedsAttention ? 'warning'
                                                : 'video_call'}
                                    </span>
                                    {application.interview_status === 'pending_candidate'
                                        ? t('app.track.waiting_for_response')
                                        : interviewNeedsAttention
                                            ? (interviewFault === 'candidate'
                                                ? (language === 'fr' ? 'Reprogrammer (optionnel)' : 'Reschedule (optional)')
                                                : (language === 'fr' ? 'Reprogrammer requis' : 'Reschedule required'))
                                            : (pastInterviews.length > 0 || interview ? (language === 'fr' ? 'Reprogrammer un entretien' : 'Reschedule interview') : t('app.track.organize_meeting'))}
                                </button>
                            )}
                        </div>
                    </section>
                </div>

                <CreateQuizModal
                    isOpen={isQuizModalOpen}
                    onClose={() => setIsQuizModalOpen(false)}
                    applicationId={id}
                    quizId={null}
                    quizStatus={null}
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

                {isActivityModalOpen && (
                    <div className="tf-modal-overlay" onClick={() => setIsActivityModalOpen(false)}>
                        <div className="tf-modal-content tf-card" style={{ maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                            <div className="tf-modal-header" style={{ marginBottom: '2rem' }}>
                                <div className="tf-card-header-icon" style={{ marginBottom: 0 }}>
                                    <span className="tf-detail-label">
                                        {t('app.track.activity_history')}
                                    </span>
                                    <button className="tf-modal-close" onClick={() => setIsActivityModalOpen(false)}>
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>
                            <div className="tf-history-list">
                                {history.length > 0 ? history.map((entry, idx) => (
                                    <div className="tf-history-item" key={idx}>
                                        <div
                                            className={`tf-history-dot ${entry.primary ? 'tf-dot-primary' : 'tf-dot-muted'}`}
                                            style={entry.kind === 'interview' ? { background: '#fcd34d' } : undefined}
                                        ></div>
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                            <div>
                                                <p className="tf-history-event">{entry.label}</p>
                                                <p className="tf-history-time">{formatDate(entry.date)}</p>
                                            </div>
                                            {entry.kind === 'quiz' && entry.quizId && (
                                                <button
                                                    onClick={() => navigate(`/hr/quizzes/${entry.quizId}`)}
                                                    style={{
                                                        background: 'rgba(59, 130, 246, 0.08)',
                                                        color: '#2563eb',
                                                        border: '1px solid rgba(59, 130, 246, 0.18)',
                                                        borderRadius: '6px',
                                                        padding: '4px 8px',
                                                        fontSize: '10px',
                                                        fontWeight: 800,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    DÉTAILS
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <p style={{ opacity: 0.4, textAlign: 'center', padding: '2rem' }}>{language === 'fr' ? 'Aucune activité' : 'No activity'}</p>
                                )}
                            </div>
                            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="tf-btn tf-btn-primary" onClick={() => setIsActivityModalOpen(false)}>
                                    {language === 'fr' ? 'Fermer' : 'Close'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isCnnModalOpen && cnnMatch && (
                    <div className="tf-modal-overlay" onClick={() => setIsCnnModalOpen(false)}>
                        <div className="tf-modal-content tf-card" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                            <div className="tf-modal-header" style={{ marginBottom: '2rem' }}>
                                <div className="tf-card-header-icon" style={{ marginBottom: 0 }}>
                                    <span className="tf-detail-label">
                                        {language === 'fr' ? 'Analyse IA Avancée : Détail des compétences' : 'Advanced AI Analysis: Skill Breakdown'}
                                    </span>
                                    <button className="tf-modal-close" onClick={() => setIsCnnModalOpen(false)}>
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>

                            <div className="cnn-match-body">
                                <div className="cnn-modal-summary-card" style={{ 
                                    background: 'var(--tf-surface-low)', 
                                    padding: '2rem', 
                                    borderRadius: '1rem', 
                                    marginBottom: '2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    border: '1px solid var(--tf-outline-variant)',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                                            <div style={{ textAlign: 'center', minWidth: '80px' }}>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--tf-on-surface-variant)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>TECHNICAL (CNN)</p>
                                                <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--tf-primary)' }}>{Math.round(cnnMatch.score)}%</p>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ opacity: 0.3, fontSize: '1.5rem' }}>add</span>
                                            <div style={{ textAlign: 'center', minWidth: '120px' }}>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--tf-on-surface-variant)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>SEMANTIC FIT (LLM)</p>
                                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
                                                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#166534' }}>{Math.round(application?.llm_score || application?.ai_score || 0)}</p>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.5 }}>/100</span>
                                                </div>
                                                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', marginTop: '0.25rem' }}>
                                                    Boost: +{( (application?.llm_score || application?.ai_score || 0) / 10 ).toFixed(1)} pts
                                                </p>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ opacity: 0.3, fontSize: '1.5rem' }}>drag_handle</span>
                                            <div style={{ textAlign: 'center', padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, var(--tf-primary-container), var(--tf-surface-variant))', borderRadius: '1rem', border: '1px solid var(--tf-primary)', minWidth: '140px' }}>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--tf-primary)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>COMPOSITE SCORE</p>
                                                <p style={{ fontSize: '2.5rem', fontWeight: 950, color: 'var(--tf-primary)' }}>
                                                    {Math.min(100, Math.round(cnnMatch.score + ( (application?.llm_score || application?.ai_score || 0) / 10 )))}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ padding: '0.75rem', background: 'rgba(var(--tf-primary-rgb), 0.05)', borderRadius: '0.5rem', borderLeft: '3px solid var(--tf-primary)' }}>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--tf-on-surface-variant)', margin: 0, lineHeight: 1.5 }}>
                                                <strong>{language === 'fr' ? 'Note de calcul :' : 'Scoring Note:'}</strong> {language === 'fr' 
                                                    ? "Le score final est une pondération entre l'adéquation technique stricte et l'intelligence sémantique (LLM) qui évalue le contexte et le potentiel."
                                                    : "The final score weights strict technical matching against semantic intelligence (LLM) which evaluates context and potential."}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <ul className="cnn-bd-list">
                                    {(cnnMatch.breakdown || []).map((b, idx) => {
                                        const statusLabels = {
                                            matched: language === 'fr' ? 'Maîtrisée' : 'Mastered',
                                            similar: language === 'fr' ? 'Équivalente' : 'Equivalent',
                                            learnable: language === 'fr' ? 'Apprenable' : 'Learnable',
                                            missing: language === 'fr' ? 'Absente' : 'Missing'
                                        };

                                        return (
                                            <li key={idx} className={`cnn-bd-item cnn-status-${b.status}`} style={{ transform: 'none', boxShadow: 'none' }}>
                                                <div className="cnn-bd-main">
                                                    <div className="cnn-bd-skill-row">
                                                        <span className="cnn-bd-skill">{b.skill}</span>
                                                        <span className={`cnn-status-pill pill-${b.status}`}>
                                                            {statusLabels[b.status]}
                                                        </span>
                                                    </div>
                                                    <div className="cnn-bd-justification">
                                                        {b.justification}
                                                    </div>
                                                </div>
                                                <div className="cnn-bd-metrics">
                                                    <div className="cnn-importance-label">
                                                        Poids: {b.importance_pct}%
                                                    </div>
                                                    <div className="cnn-mini-bar-wrap">
                                                        <div className="cnn-mini-bar" style={{ 
                                                            width: `${b.match_score * 100}%`,
                                                            backgroundColor: `var(--status-color-${b.status})`
                                                        }}></div>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="tf-btn tf-btn-primary" onClick={() => setIsCnnModalOpen(false)}>
                                    {language === 'fr' ? 'Fermer' : 'Close'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isHistoryModalOpen && (
                    <InterviewHistoryModal
                        isOpen={isHistoryModalOpen}
                        onClose={() => setIsHistoryModalOpen(false)}
                        pastInterviews={pastInterviews}
                        language={language}
                    />
                )}
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
