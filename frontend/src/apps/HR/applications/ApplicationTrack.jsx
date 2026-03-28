import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../../../core/useLanguage';
import HRSidebar from '../components/HRSidebar';
import { apiFetch } from '../../../core/api';
import CreateQuizModal from '../components/CreateQuizModal';
import CVViewerModal from '../components/CVViewerModal';
import ProposeSlotsModal from '../components/ProposeSlotsModal';
import './ApplicationTrack.css';

const ApplicationTrack = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();
    const { t, language } = useLanguage();

    const STEPS = [
        { id: 'new', label: t('app.track.step.new'), icon: 'check', desc: t('app.track.step.received') },
        { id: 'in_review', label: t('app.track.step.in_review'), icon: 'check', desc: t('app.track.step.in_review') },
        { id: 'technical_test', label: t('app.track.step.technical_test'), icon: 'check', desc: t('app.track.step.technical_test') },
        { id: 'interview', label: t('app.track.step.interview'), icon: 'person_search', desc: t('app.track.step.interview') },
        { id: 'accepted', label: t('app.track.step.accepted'), icon: 'hourglass_empty', desc: t('app.track.step.accepted') },
    ];

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
        const fetchApp = async () => {
            try {
                const data = await apiFetch(`/applications/${id}`);
                if (data.job_id) {
                    try {
                        const jobData = await apiFetch(`/jobs/${data.job_id}`);
                        data.job_title = jobData.title;
                        data.company_id = jobData.company_id; // Added to fix 422 validation
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
            await apiFetch('/interviews/proposals', {
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
                        return d.toISOString();
                    }).filter(s => s !== null),
                    duration_minutes: proposalData.duration,
                    interview_type: proposalData.interviewType,
                    message: proposalData.message
                })
            });
            showToast("Propositions envoyées au candidat !", "info");
            setIsProposeModalOpen(false);
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
                        <section className={`${metricsColClass} tf-card`}>
                            <span className="tf-detail-label block mb-4" style={{ marginBottom: '1rem', display: 'block' }}>{t('app.track.activity_history')}</span>
                            <div className="tf-history-list">
                                {history.map((entry, idx) => (
                                    <div className="tf-history-item" key={idx}>
                                        <div className={`tf-history-dot ${entry.primary ? 'tf-dot-primary' : 'tf-dot-muted'}`}></div>
                                        <div>
                                            <p className="tf-history-event">{entry.label}</p>
                                            <p className="tf-history-time">{formatDate(entry.date)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Assessment Placeholders (Span 6) */}
                    <section className="tf-col-6 tf-locked-card tf-analysis-card">
                        <div className="tf-locked-icon">
                            <span className="material-symbols-outlined">
                                {application.quiz_status === 'completed' ? 'analytics' : (quizId ? 'task_alt' : 'lock')}
                            </span>
                        </div>
                        <h3 className="tf-locked-title">{t('app.track.quiz_analysis_title')}</h3>

                        <div className="tf-locked-desc" style={{ marginBottom: '1.5rem', width: '100%' }}>
                            {application.quiz_status === 'completed' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                                    <div className="tf-score-display" style={{ marginBottom: 0 }}>
                                        <span className="tf-score-number" style={{ fontSize: '2.5rem' }}>{Math.round(application.quiz_score)}</span>
                                        <span className="tf-score-percent" style={{ fontSize: '1rem' }}>%</span>
                                    </div>
                                    <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                                        {t('app.track.quiz_attempts', { count: application.quiz_attempts || 1 })}
                                    </p>
                                    <p className="tf-detail-label" style={{ marginTop: '0.25rem' }}>
                                        {t('app.track.quiz_completed_on', { date: formatDate(application.quiz_completed_at) })}
                                    </p>
                                    {application.quiz_ai_analysis && (
                                        <div className="tf-ai-feedback-box" style={{ marginTop: '1rem', textAlign: 'left', padding: '1rem', borderRadius: '8px', background: 'var(--bg-secondary)', fontSize: '0.875rem', borderLeft: '4px solid var(--tf-primary)' }}>
                                            <p style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--tf-primary)' }}>auto_awesome</span>
                                                {t('app.track.quiz_ai_feedback')}
                                            </p>
                                            <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                                                "{application.quiz_ai_analysis}"
                                            </p>
                                        </div>
                                    )}
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

                    <section className="tf-col-6 tf-locked-card tf-analysis-card">
                        <div className="tf-locked-icon">
                            <span className="material-symbols-outlined">lock</span>
                        </div>
                        <h3 className="tf-locked-title">{t('app.track.video_meet_title')}</h3>
                        <p className="tf-locked-desc" style={{ marginBottom: '1.5rem' }}>{t('app.track.video_meet_desc')}</p>

                        <div className="tf-btn-group" style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center' }}>
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

                            {/* INTERVIEW ACTIONS (Visible ONLY if in interview stage or later) */}
                            {STEPS.findIndex(s => s.id === application.status) >= 3 && (
                                <button
                                    className="tf-btn tf-btn-primary"
                                    style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
                                    onClick={() => setIsProposeModalOpen(true)}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>video_call</span>
                                    {t('app.track.organize_meeting')}
                                </button>
                            )}
                        </div>
                    </section>

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
