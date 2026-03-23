import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import HRSidebar from '../components/HRSidebar';
import { apiFetch, SERVER_URL } from '../../../core/api';
import './ApplicationTrack.css';

const STEPS = [
    { id: 'pending', label: 'Nouveau', icon: 'inbox' },
    { id: 'reviewed', label: 'En revue', icon: 'rate_review' },
    { id: 'quiz', label: 'Test technique', icon: 'quiz' },
    { id: 'interview', label: 'Entretien', icon: 'groups' },
    { id: 'accepted', label: 'Offre acceptée', icon: 'celebration' }
];

const ApplicationTrack = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();

    const [application, setApplication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchApp = async () => {
            try {
                const data = await apiFetch(`/applications/${id}`);
                // Also fetch job to get title
                if (data.job_id) {
                    const jobData = await apiFetch(`/jobs/${data.job_id}`);
                    data.job_title = jobData.title;
                }
                setApplication(data);
            } catch (err) {
                console.error(err);
                setError('Erreur lors du chargement de la candidature.');
            } finally {
                setLoading(false);
            }
        };
        fetchApp();
    }, [id]);

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
            alert('Erreur lors de la mise à jour du statut.');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className={`app-track-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="app-track-main">
                    <div className="loading-spinner">Chargement du dossier...</div>
                </main>
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className={`app-track-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="app-track-main">
                    <div className="error-container">
                        <span className="material-symbols-outlined icon-error">error</span>
                        <h2>{error || "Candidature introuvable"}</h2>
                        <button className="btn btn-secondary mt-4" onClick={() => navigate(-1)}>Retour</button>
                    </div>
                </main>
            </div>
        );
    }

    const { profile_snapshot: profile } = application;
    const isRejected = application.status === 'rejected';
    
    // Find current index
    const currentIndex = STEPS.findIndex(s => s.id === application.status);
    // If not found (e.g. status changed unexpectedly) or rejected, default to 0 for calculations if not rejected
    const activeIndex = isRejected ? 0 : (currentIndex === -1 ? 0 : currentIndex);
    const progress = isRejected ? 100 : (activeIndex / (STEPS.length - 1)) * 100;

    return (
        <div className={`app-track-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />
            <main className="app-track-main">
                <div className="app-track-container">
                    {/* Header */}
                    <header className="track-header" style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '1.5rem', alignItems: 'center', padding: '1.5rem 2rem', background: 'var(--color-card-bg)', borderRadius: '1.25rem', border: '1px solid var(--color-border)', width: '100%', boxSizing: 'border-box' }}>
                        <button className="btn btn-icon-only text-muted" onClick={() => navigate(-1)} title="Retour" style={{ margin: 0, padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>arrow_back</span>
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
                            <h1 className="track-title" style={{ margin: 0, textAlign: 'left' }}>Dossier Candidat</h1>
                            <p className="track-subtitle" style={{ margin: '0.25rem 0 0 0', textAlign: 'left' }}>Pour le poste : {application?.job_title || 'Offre inconnue'}</p>
                        </div>
                    </header>

                    <div className="track-grid">
                        {/* Profile Info (Small column Left) */}
                        <div className="track-profile-card" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div className="profile-header-main" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingBottom: '1rem', borderBottom: 'none' }}>
                                <div className="avatar-large" style={{ width: '5rem', height: '5rem', fontSize: '2rem', marginBottom: '1rem' }}>
                                    {profile?.firstName ? `${profile.firstName.charAt(0)}${profile.lastName ? profile.lastName.charAt(0) : ''}`.toUpperCase() : '?'}
                                </div>
                                <div style={{ width: '100%' }}>
                                    <h2 className="profile-name">
                                        {profile?.firstName || ''} {profile?.lastName || ''}
                                    </h2>
                                    <p className="profile-headline">{profile?.title || 'Candidat(e)'}</p>
                                    <p className="profile-email" style={{ justifyContent: 'center' }}>
                                        <span className="material-symbols-outlined">mail</span>
                                        {profile?.email || 'Email non fourni'}
                                    </p>
                                </div>
                            </div>

                            {Array.isArray(profile?.skills) && profile.skills.length > 0 && (
                                <div className="mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                                    <h3 className="section-subtitle" style={{ fontSize: '0.95rem', margin: '0 0 0.75rem 0' }}>Compétences</h3>
                                    <div className="skills-wrap" style={{ justifyContent: 'center' }}>
                                        {profile.skills.map((skill, i) => (
                                            <span key={i} className="skill-tag">
                                                {typeof skill === 'object' ? skill.name : skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* AI Insights to fill the bottom space */}
                            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
                                {application?.ai_score != null && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--color-card-bg)', border: '1px solid var(--color-border)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
                                        <div style={{ fontSize: '1.6rem', fontWeight: '800', color: application.ai_score >= 75 ? '#22c55e' : application.ai_score >= 50 ? '#f59e0b' : '#ef4444' }}>
                                            {application.ai_score}%
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: '1.3', flex: 1 }}>
                                            <strong>Force du profil</strong> mesurée par notre intelligence artificielle HumatiQ.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pipeline Tracker (Large column Right) */}
                        <div className="track-pipeline-card">
                            <div className="pipeline-header">
                                <h2>Progression du recrutement</h2>
                                <span className={`status-badge ${isRejected ? 'rejected' : 'active'}`}>
                                    {isRejected ? 'Rejeté' : STEPS[activeIndex]?.label || 'En cours'}
                                </span>
                            </div>

                            <div className="hr-timeline-wrapper">
                                <div className="hr-timeline">
                                    <div className="hr-timeline-track"></div>
                                    <div 
                                        className={`hr-timeline-progress ${isRejected ? 'progress-rejected' : 'progress-active'}`} 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                    
                                    <div className="hr-timeline-steps">
                                        {isRejected ? (
                                            <>
                                                <div className="hr-timeline-step">
                                                    <div className="hr-timeline-dot done"><span className="material-symbols-outlined">inbox</span></div>
                                                    <span className="hr-timeline-label">Candidature</span>
                                                </div>
                                                <div className="hr-timeline-step">
                                                    <div className="hr-timeline-dot rejected-dot"><span className="material-symbols-outlined">close</span></div>
                                                    <span className="hr-timeline-label rejected-label">Rejeté</span>
                                                </div>
                                            </>
                                        ) : (
                                            STEPS.map((step, idx) => {
                                                const isDone = idx <= activeIndex;
                                                const isCurrent = idx === activeIndex;
                                                return (
                                                    <div key={step.id} className="hr-timeline-step">
                                                        <div className={`hr-timeline-dot ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                                                            <span className="material-symbols-outlined">{step.icon}</span>
                                                        </div>
                                                        <span className={`hr-timeline-label ${isCurrent ? 'current-label' : ''}`}>{step.label}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pipeline-actions">
                                <h3>Actions</h3>
                                <p className="actions-subtitle">Faites avancer le candidat dans le processus ou rejetez sa candidature.</p>
                                
                                <div className="actions-buttons-grid">
                                    {isRejected ? (
                                        <button 
                                            className="btn btn-secondary action-btn" 
                                            onClick={() => handleUpdateStatus('pending')}
                                            disabled={updating}
                                        >
                                            <span className="material-symbols-outlined">restore</span>
                                            Réintégrer le candidat
                                        </button>
                                    ) : (
                                        <>
                                            {STEPS.map((step, idx) => {
                                                if (idx <= activeIndex) return null; // Already passed
                                                // Only show the IMMEDIATE next step
                                                if (idx !== activeIndex + 1) return null;
                                                return (
                                                    <button 
                                                        key={step.id}
                                                        className="btn btn-primary action-btn" 
                                                        onClick={() => handleUpdateStatus(step.id)}
                                                        disabled={updating}
                                                    >
                                                        <span className="material-symbols-outlined">arrow_forward</span>
                                                        Passer à : {step.label}
                                                    </button>
                                                );
                                            })}
                                            <button 
                                                className="btn action-btn btn-danger" 
                                                onClick={() => {
                                                    if(window.confirm("Êtes-vous sûr de vouloir rejeter cette candidature ?")) {
                                                        handleUpdateStatus('rejected');
                                                    }
                                                }}
                                                disabled={updating}
                                            >
                                                <span className="material-symbols-outlined">block</span>
                                                Rejeter le candidat
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

// Error Boundary wrapper to prevent white screens
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorStr: '' };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, errorStr: error.toString() };
    }
    componentDidCatch(error, errorInfo) {
        console.error("ApplicationTrack Render Error:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
                    <h2 style={{ color: 'red' }}>Oups, une erreur d'affichage est survenue.</h2>
                    <p>L'écran ne restera pas blanc ! Voici l'erreur technique :</p>
                    <pre style={{ background: '#eee', padding: '1rem', overflowX: 'auto', textAlign: 'left' }}>
                        {this.state.errorStr}
                    </pre>
                    <button onClick={() => window.history.back()} style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer' }}>
                        Retour
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const SafeApplicationTrack = () => (
    <ErrorBoundary>
        <ApplicationTrack />
    </ErrorBoundary>
);

export default SafeApplicationTrack;
