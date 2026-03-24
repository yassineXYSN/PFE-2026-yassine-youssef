import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import HRSidebar from '../components/HRSidebar';
import { apiFetch } from '../../../core/api';
import CreateQuizModal from '../components/CreateQuizModal';
import './ApplicationTrack.css';

const STEPS = [
    { id: 'pending',   label: 'New',            icon: 'check',          desc: 'Application Received' },
    { id: 'reviewed',  label: 'In Review',      icon: 'check',          desc: 'Screening Complete' },
    { id: 'quiz',      label: 'Technical Test', icon: 'check',          desc: 'Assessment Passed' },
    { id: 'interview', label: 'Interview',      icon: 'person_search',  desc: 'Interviewing Phase' },
    { id: 'accepted',  label: 'Offer Accepted', icon: 'hourglass_empty',desc: 'Awaiting Signature' },
];

const ApplicationTrack = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();

    const [application, setApplication] = useState(null);
    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [quizId, setQuizId] = useState(null);

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
            alert('Failed to update status.');
        } finally {
            setUpdating(false);
        }
    };

    const handleAnalyze = async () => {
        if (!application || !application.job_id) return;
        setAiLoading(true);
        try {
            await apiFetch(`/ai-matching/applicant-scores/${application.job_id}?limit=50`);
            const data = await apiFetch(`/applications/${id}`);
            setApplication(data);
        } catch (e) {
            console.error('Error in AI Analysis:', e);
            showToast("Erreur lors de l'analyse IA. Veuillez réessayer.");
        } finally {
            setAiLoading(false);
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
                    <h2 className="tf-meta-title" style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Application Not Found</h2>
                    <button className="tf-btn tf-btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: '1.5rem' }}>Go Back</button>
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
            entries.push({ label: 'Application Received', date: application.applied_at, primary: false });
        }
        if (aiScore != null) {
            entries.push({ label: 'AI Screening Completed', date: application.applied_at, primary: false });
        }
        if (application.updated_at && application.status !== 'pending') {
            const stepLabel = isRejected ? 'Rejected' : isAccepted ? 'Offer Accepted' : STEPS.find(s => s.id === application.status)?.label || 'Updated';
            entries.push({ label: `Moved to ${stepLabel}`, date: application.updated_at, primary: true });
        }
        return entries;
    };

    const history = buildHistory().reverse(); // Newest first

    const formatDate = (d) => {
        if (!d) return '';
        try {
            return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        } catch { return ''; }
    };

    return (
        <div className={`app-track-page ${effectiveTheme === 'dark' ? 'dark' : 'light'}`}>
            <HRSidebar />
            <main className="app-track-main">
                
                {/* ── Breadcrumbs / Meta Header ── */}
                <div className="tf-meta-header">
                    <div>
                        <span className="tf-meta-subtitle">Candidate Profile</span>
                        <h1 className="tf-meta-title">{finalFirstName || 'Unknown'} {finalLastName || 'Candidate'}</h1>
                    </div>
                    <div className="tf-meta-actions">
                        {isRejected ? (
                            <button className="tf-btn tf-btn-secondary" onClick={() => handleUpdateStatus('pending')} disabled={updating}>
                                Reintegrate
                            </button>
                        ) : (
                            <>
                                <button className="tf-btn tf-btn-secondary" onClick={() => { if (window.confirm('Reject this candidate?')) handleUpdateStatus('rejected'); }} disabled={updating}>
                                    Reject
                                </button>
                                {STEPS.map((step, idx) => {
                                    if (idx !== activeIndex + 1) return null;
                                    return (
                                        <button key={step.id} className="tf-btn tf-btn-primary" onClick={() => handleUpdateStatus(step.id)} disabled={updating}>
                                            Approve to Next Stage
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_forward</span>
                                        </button>
                                    );
                                })}
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
                                    <p className="tf-detail-label">Current Role</p>
                                    <p className="tf-detail-value">{finalTitle}</p>
                                </div>
                                <div>
                                    <p className="tf-detail-label">Job Applied For</p>
                                    <p className="tf-detail-value">{application.job_title || 'Unknown Position'}</p>
                                </div>
                                <div>
                                    <p className="tf-detail-label">Email</p>
                                    <p className="tf-detail-value" style={{ wordBreak: 'break-all' }}>{finalEmail}</p>
                                </div>
                                <div>
                                    <p className="tf-detail-label">Phone</p>
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
                                        <span className="tf-step-label tf-step-label-muted">Received</span>
                                    </div>
                                    <div className="tf-step-node">
                                        <div className="tf-step-icon-wrapper tf-step-icon-rejected">
                                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>close</span>
                                        </div>
                                        <span className="tf-step-label tf-step-label-rejected">Rejected</span>
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
                                <span className="tf-detail-label">AI Job Match</span>
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
                                <h3 className="tf-locked-title">AI Job Match Analysis</h3>
                                <p className="tf-locked-desc" style={{ marginBottom: '1.5rem' }}>
                                    AI profile analysis has not yet processed this candidate's history against the active job description.
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
                                    {aiLoading ? 'Analyse en cours...' : 'Analyser'}
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
                            <span className="tf-detail-label block mb-4" style={{ marginBottom: '1rem', display: 'block' }}>Motivation Letter</span>
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
                            <span className="tf-detail-label block mb-4" style={{ marginBottom: '1rem', display: 'block' }}>Activity History</span>
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
                            <span className="material-symbols-outlined">lock</span>
                        </div>
                        <h3 className="tf-locked-title">Technical Quiz Analysis</h3>
                        <p className="tf-locked-desc" style={{ marginBottom: '1.5rem' }}>Analysis will populate after algorithmic challenge completion. Status: Pending</p>
                        <button 
                            className="tf-btn tf-btn-primary" 
                            style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
                            onClick={() => setIsQuizModalOpen(true)}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>quiz</span>
                            Créer un Quiz
                        </button>
                    </section>

                    <section className="tf-col-6 tf-locked-card tf-analysis-card">
                        <div className="tf-locked-icon">
                            <span className="material-symbols-outlined">lock</span>
                        </div>
                        <h3 className="tf-locked-title">Video Meet Analysis</h3>
                        <p className="tf-locked-desc" style={{ marginBottom: '1.5rem' }}>AI sentiment and keyword analysis will populate after the panel interview. Status: Pending</p>
                        <button 
                            className="tf-btn tf-btn-primary" 
                            style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
                            onClick={() => console.log('Arrange Meeting clicked')}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>video_call</span>
                            Organiser une réunion
                        </button>
                    </section>

                </div>

                <CreateQuizModal 
                    isOpen={isQuizModalOpen}
                    onClose={() => setIsQuizModalOpen(false)}
                    applicationId={id}
                    jobTitle={application.job_title}
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
