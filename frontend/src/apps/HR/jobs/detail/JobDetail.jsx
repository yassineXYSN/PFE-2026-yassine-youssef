import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import HRSidebar from '../../components/HRSidebar';
import { apiFetch } from '../../../../core/api';
import './JobDetail.css';

// ─── Helpers ───────────────────────────────────────────────────
const ScoreRing = ({ score, size = 48 }) => {
    const radius = 15.9155;
    const circumference = 2 * Math.PI * radius;
    const dash = ((score ?? 0) / 100) * circumference;
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
    return (
        <svg viewBox="0 0 36 36" width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="3" />
            <circle
                cx="18" cy="18" r={radius}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
            <text x="18" y="20.5" textAnchor="middle" fontSize="8" fontWeight="700" fill={color}>
                {score ?? '--'}
            </text>
        </svg>
    );
};

const Avatar = ({ name, size = 36 }) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
    const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: color, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontWeight: 700,
            fontSize: size * 0.35, flexShrink: 0
        }}>{initials}</div>
    );
};

const getStatusBadge = (status) => {
    switch (status) {
        case 'reviewed': return <span className="status-pill blue"><span className="status-dot"></span>En cours</span>;
        case 'accepted': return <span className="status-pill green"><span className="status-dot"></span>Accepté</span>;
        case 'rejected': return <span className="status-pill red"><span className="status-dot"></span>Refusé</span>;
        case 'pending':
        default: return <span className="status-pill neutral"><span className="status-dot"></span>Nouveau</span>;
    }
};

// ─── Main Component ────────────────────────────────────────────
const JobDetail = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const { id } = useParams();

    const [job, setJob] = useState(null);
    const [department, setDepartment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('missions');

    // Applications state (real data from MongoDB)
    const [applications, setApplications] = useState([]);
    const [appLoading, setAppLoading] = useState(false);

    // AI State
    const [suggestions, setSuggestions] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiApplicantLoading, setAiApplicantLoading] = useState(false);
    const [expandedApps, setExpandedApps] = useState({});

    const toggleExpand = (appId) => {
        setExpandedApps(prev => ({
            ...prev,
            [appId]: !prev[appId]
        }));
    };

    useEffect(() => {
        const fetchJobData = async () => {
            if (!id) return;
            try {
                const jobData = await apiFetch(`/jobs/${id}`);
                setJob(jobData);
                if (jobData.department_id) {
                    const deptData = await apiFetch(`/departments/${jobData.department_id}`);
                    setDepartment(deptData);
                }
            } catch (err) {
                console.error("Error fetching job details:", err);
                setError("Offre d'emploi introuvable.");
            } finally {
                setLoading(false);
            }
        };
        fetchJobData();
    }, [id]);

    // Load suggestions lazily once job is loaded
    useEffect(() => {
        if (!id || !job) return;
        const loadSuggestions = async () => {
            setAiLoading(true);
            try {
                const data = await apiFetch(`/ai-matching/suggestions/${id}?limit=5`);
                setSuggestions(data || []);
            } catch (e) {
                console.error('Suggestions error:', e);
            } finally {
                setAiLoading(false);
            }
        };
        loadSuggestions();
    }, [id, job]);

    // Load real applications from MongoDB job_applications collection
    useEffect(() => {
        if (!id) return;
        const loadApplications = async () => {
            setAppLoading(true);
            try {
                const data = await apiFetch(`/applications/job/${id}`);
                setApplications(data || []);
            } catch (e) {
                console.error('Applications load error:', e);
            } finally {
                setAppLoading(false);
            }
        };
        loadApplications();
    }, [id]);

    const handleStatusChange = async (applicationId, newStatus) => {
        try {
            await apiFetch(`/applications/${applicationId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });
            setApplications(prev => prev.map(app => 
                app._id === applicationId ? { ...app, status: newStatus } : app
            ));
        } catch (e) {
            console.error('Update status error:', e);
            alert("Erreur lors de la mise à jour du statut.");
        }
    };

    const loadApplicantScores = useCallback(async () => {
        if (!id) return;
        setAiApplicantLoading(true);
        try {
            const data = await apiFetch(`/ai-matching/applicant-scores/${id}?limit=10`);
            // data is an array of scored applications.
            // We map these scores and justifications back to the applications state.
            if (data && data.length > 0) {
                setApplications(prevApps => {
                    const newApps = [...prevApps];
                    data.forEach(scoredApp => {
                        const idx = newApps.findIndex(a => a._id === scoredApp.application_id);
                        if (idx !== -1) {
                            newApps[idx] = {
                                ...newApps[idx],
                                ai_score: scoredApp.ai_score,
                                ai_justification: scoredApp.ai_justification,
                            };
                        }
                    });
                    
                    // Sort by AI score descending, keep unscored ones at the bottom
                    newApps.sort((a, b) => {
                        const scoreA = a.ai_score ?? -1;
                        const scoreB = b.ai_score ?? -1;
                        return scoreB - scoreA;
                    });
                    
                    return newApps;
                });
            }
        } catch (e) {
            console.error('Applicant scores error:', e);
        } finally {
            setAiApplicantLoading(false);
        }
    }, [id]);

    if (loading) {
        return (
            <div className={`job-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="job-detail-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loading-spinner">Chargement de l'offre...</div>
                </main>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className={`job-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="job-detail-main">
                    <div className="error-container card-glass" style={{ margin: '2rem', padding: '2rem', textAlign: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ef4444' }}>error</span>
                        <h2 style={{ marginTop: '1rem' }}>{error || "Offre introuvable"}</h2>
                        <button className="btn btn-secondary" onClick={() => navigate('/hr/offres')} style={{ marginTop: '1rem' }}>
                            Retour aux offres
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    const scoredApps = applications.filter(a => a.ai_score != null);
    const avgScore = scoredApps.length > 0
        ? Math.round(scoredApps.reduce((s, c) => s + c.ai_score, 0) / scoredApps.length)
        : null;

    return (
        <div className={`job-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="job-detail-main">
                <div className="job-detail-container">
                    {/* ── Header ── */}
                    <header className="job-header-card">
                        <div className="header-main">
                            <div className="job-icon-large">
                                <span className="material-symbols-outlined">business_center</span>
                            </div>
                            <div className="header-text-content">
                                <div className="header-title-row">
                                    <h1 className="job-main-title">{job.title}</h1>
                                    <span className={`status-pill ${job.status === 'published' ? 'green' : 'neutral'}`}>
                                        <span className="status-dot"></span>
                                        {job.status === 'published' ? 'OUVERT' : job.status === 'draft' ? 'BROUILLON' : 'INTERNE'}
                                    </span>
                                </div>
                                <div className="job-meta-row">
                                    <span className="meta-item">
                                        <span className="material-symbols-outlined">domain</span>
                                        {department?.name || 'Non assigné'}
                                    </span>
                                    <span className="meta-dot">·</span>
                                    <span className="meta-item">
                                        <span className="material-symbols-outlined">location_on</span>
                                        {job.location || 'Remote'}
                                    </span>
                                    <span className="meta-dot">·</span>
                                    <span className="meta-item">
                                        <span className="material-symbols-outlined">schedule</span>
                                        {job.type?.toUpperCase()}
                                    </span>
                                    {job.work_mode && (
                                        <>
                                            <span className="meta-dot">·</span>
                                            <span className="meta-item">
                                                <span className="material-symbols-outlined">computer</span>
                                                {job.work_mode === 'onsite' ? 'Sur site' : job.work_mode === 'remote' ? 'Télétravail' : 'Hybride'}
                                            </span>
                                        </>
                                    )}
                                    {job.experience_level && (
                                        <>
                                            <span className="meta-dot">·</span>
                                            <span className="meta-item">
                                                <span className="material-symbols-outlined">trending_up</span>
                                                {job.experience_level === 'junior' ? 'Junior' : job.experience_level === 'mid' ? 'Confirmé' : job.experience_level === 'senior' ? 'Sénior' : 'Expert'}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="header-actions-group">
                                <button className="btn btn-secondary icon-only" title="Partager">
                                    <span className="material-symbols-outlined">share</span>
                                </button>
                                <button className="btn btn-secondary icon-only" title="Modifier" onClick={() => navigate(`/hr/offres/${id}/edit`)}>
                                    <span className="material-symbols-outlined">edit</span>
                                </button>
                                <button className="btn btn-primary">
                                    <span className="material-symbols-outlined">person_add</span>
                                    Inviter
                                </button>
                            </div>
                        </div>

                        <div className="header-secondary-row">
                            <div className="stats-group">
                                <div className="mini-stat">
                                    <span className="mini-stat-value">{applications.length || 0}</span>
                                    <span className="mini-stat-label">Candidats</span>
                                </div>
                                <div className="mini-stat-divider"></div>
                                <div className="mini-stat">
                                    <span className="mini-stat-value highlight">
                                        {avgScore !== null ? `${avgScore}%` : '--%'}
                                    </span>
                                    <span className="mini-stat-label">Score Moyen IA</span>
                                </div>
                                <div className="mini-stat-divider"></div>
                                <div className="mini-stat">
                                    <span className="mini-stat-value">{suggestions.length} profils</span>
                                    <span className="mini-stat-label">Suggestions IA</span>
                                </div>
                            </div>

                            <div className="ai-match-badge">
                                <div className="ai-ring-mini">
                                    <ScoreRing score={avgScore} size={36} />
                                </div>
                                <div className="ai-badge-text">
                                    <span className="ai-label-bold">Match IA Moyen</span>
                                    <span className="ai-label-sub">
                                        {avgScore !== null ? `Score : ${avgScore}/100` : 'Aucune donnée'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="dashboard-grid">
                        {/* ── Main Column ── */}
                        <div className="main-column">

                            {/* ── Real Applications List (Merged with AI Scores) ── */}
                            <section className="dashboard-card">
                                <div className="card-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#6366f1' }}>inbox</span>
                                        <h2 className="card-title">Candidatures ({applications.length})</h2>
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                        onClick={loadApplicantScores}
                                        disabled={aiApplicantLoading || applications.length === 0}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                            {aiApplicantLoading ? 'hourglass_empty' : 'auto_awesome'}
                                        </span>
                                        {aiApplicantLoading ? 'Analyse...' : 'Lancer l\'analyse (Top 10 max)'}
                                    </button>
                                </div>
                                <div className="candidates-list">
                                    {appLoading && !aiApplicantLoading ? (
                                        <div className="ai-loading-state">
                                            <div className="ai-pulse-dots"><span></span><span></span><span></span></div>
                                            <p>Chargement des candidatures...</p>
                                        </div>
                                    ) : aiApplicantLoading ? (
                                        <div className="ai-loading-state">
                                            <div className="ai-pulse-dots">
                                                <span></span><span></span><span></span>
                                            </div>
                                            <p>Analyse IA en cours par Qwen2.5...</p>
                                        </div>
                                    ) : applications.length === 0 ? (
                                        <div className="empty-state-box">
                                            <span className="material-symbols-outlined">inbox</span>
                                            <p>Aucune candidature pour le moment.</p>
                                        </div>
                                    ) : (
                                        applications.map((app, i) => (
                                            <div key={app._id} className="candidate-score-row" style={{ alignItems: 'flex-start' }}>
                                                {app.ai_score != null && (
                                                    <span className="rank-badge">#{i + 1}</span>
                                                )}
                                                <Avatar name={`${app.firstName} ${app.lastName}`} size={40} />
                                                <div className="candidate-score-info" style={{ flex: 1 }}>
                                                    <span className="cand-name">{app.firstName} {app.lastName}</span>
                                                    <span className="cand-email">{app.email}</span>
                                                    <span className="suggestion-title" style={{ display: 'block', marginTop: '4px' }}>
                                                        {app.headline || 'Candidat'}
                                                    </span>
                                                    {app.ai_justification && (
                                                        <div className="justification-container">
                                                            <p className={`cand-justification ${expandedApps[app._id] ? 'expanded' : ''}`} style={{ marginTop: '0.5rem' }}>
                                                                {app.ai_justification}
                                                            </p>
                                                            {app.ai_justification.length > 150 && (
                                                                <button 
                                                                    className="btn-read-more"
                                                                    onClick={() => toggleExpand(app._id)}
                                                                >
                                                                    {expandedApps[app._id] ? 'Voir moins' : 'Voir plus'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                                        {getStatusBadge(app.status)}
                                                    </div>
                                                    {app.ai_score != null && (
                                                        <div className="score-ring-container" style={{ marginTop: 'auto' }}>
                                                            <ScoreRing score={app.ai_score} size={52} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>

                            {/* ── TOP SUGGESTIONS IA ── */}
                            <div className="dashboard-card ai-gradient-border" style={{ marginBottom: '1.5rem' }}>
                                <div className="card-header-small">
                                    <div className="flex-row gap-2">
                                        <span className="material-symbols-outlined text-purple">psychology</span>
                                        <h3>Top Suggestions IA</h3>
                                    </div>
                                    <span className="ai-badge-tiny">Recherche Vectorielle</span>
                                </div>

                                {aiLoading ? (
                                    <div className="ai-loading-state" style={{ padding: '1.5rem' }}>
                                        <div className="ai-pulse-dots"><span></span><span></span><span></span></div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Recherche en cours...</p>
                                    </div>
                                ) : suggestions.length === 0 ? (
                                    <div className="empty-state-box" style={{ padding: '1.5rem', fontSize: '0.8rem' }}>
                                        <span className="material-symbols-outlined">search_off</span>
                                        <p>Aucun profil trouvé dans le pool.</p>
                                    </div>
                                ) : (
                                    <div className="suggestions-list">
                                        {suggestions.map((s, i) => {
                                            const name = `${s.firstName || s.prenom || ''} ${s.lastName || s.nom || ''}`.trim() || 'Inconnu';
                                            const vectorScore = s.score != null ? Math.round(s.score * 100) : null;
                                            return (
                                                <div key={s._id || i} className="suggestion-row">
                                                    <Avatar name={name} size={34} />
                                                    <div className="suggestion-info">
                                                        <span className="suggestion-name">{name}</span>
                                                        <span className="suggestion-title">
                                                            {s.title || s.posteActuel || s.headline || 'Candidat'}
                                                        </span>
                                                    </div>
                                                    <div className="suggestion-score">
                                                        {vectorScore !== null ? (
                                                            <span style={{
                                                                background: vectorScore >= 75 ? '#dcfce7' : vectorScore >= 50 ? '#fef9c3' : '#fee2e2',
                                                                color: vectorScore >= 75 ? '#16a34a' : vectorScore >= 50 ? '#d97706' : '#dc2626',
                                                                borderRadius: '999px', padding: '2px 8px',
                                                                fontSize: '0.75rem', fontWeight: 700
                                                            }}>{vectorScore}%</span>
                                                        ) : (
                                                            <span className="keyword-tag blue" style={{ fontSize: '0.7rem' }}>Match</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>



                            {/* ── Job Description Tabs ── */}
                            <section className="dashboard-card">
                                <div className="card-header-tabs">
                                    <button className={`tab-btn ${activeTab === 'missions' ? 'active' : ''}`} onClick={() => setActiveTab('missions')}>Missions</button>
                                    <button className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Profil</button>
                                    <button className={`tab-btn ${activeTab === 'benefits' ? 'active' : ''}`} onClick={() => setActiveTab('benefits')}>Avantages</button>
                                    <button className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`} onClick={() => setActiveTab('questions')}>Questions</button>
                                </div>
                                <div className="card-content-padded">
                                    {activeTab === 'missions' && (
                                        <div className="modern-list">
                                            {job.missions ? (
                                                job.missions.split('\n').map((m, i) => (
                                                    <div key={i} className="modern-list-item">
                                                        <div className="list-icon-circle blue">
                                                            <span className="material-symbols-outlined">check</span>
                                                        </div>
                                                        <p className="list-content-text">{m}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="list-content-text">{job.description}</p>
                                            )}
                                        </div>
                                    )}
                                    {activeTab === 'profile' && (
                                        <div className="modern-list">
                                            {job.requirements?.map((p, i) => (
                                                <div key={i} className="modern-list-item">
                                                    <div className="list-icon-circle purple">
                                                        <span className="material-symbols-outlined">person</span>
                                                    </div>
                                                    <p className="list-content-text">{p}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {activeTab === 'questions' && (
                                        <div className="modern-list">
                                            {job.screening_questions && job.screening_questions.length > 0 ? (
                                                job.screening_questions.map((q, i) => (
                                                    <div key={`q-${i}`} className="modern-list-item">
                                                        <div className="list-icon-circle neutral">
                                                            <span className="material-symbols-outlined">help_outline</span>
                                                        </div>
                                                        <p className="list-content-text" style={{ fontStyle: 'italic' }}>{q}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="benefits-grid-large">
                                                    <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                                        Aucune question de filtrage configurée.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {activeTab === 'benefits' && (
                                        <div className="modern-list">
                                            {job.benefits && job.benefits.length > 0 ? (
                                                job.benefits.map((benefit, i) => (
                                                    <div key={i} className="modern-list-item">
                                                        <div className="list-icon-circle green">
                                                            <span className="material-symbols-outlined">star</span>
                                                        </div>
                                                        <p className="list-content-text">{benefit}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="benefits-grid-large">
                                                    <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                                        Aucun avantage spécifique listé.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* ── Sidebar Column ── */}
                        <div className="sidebar-column">


                            {/* ── Pipeline Summary ── */}
                            <div className="dashboard-card p-0 overflow-hidden">
                                <div className="card-header-small">
                                    <h3>Pipeline</h3>
                                </div>
                                <div className="pipeline-stats">
                                    <div className="pipeline-row">
                                        <div className="pipeline-info">
                                            <span className="icon-box neutral">
                                                <span className="material-symbols-outlined">inbox</span>
                                            </span>
                                            <span className="pipeline-label">Candidatures</span>
                                        </div>
                                        <span className="pipeline-count">{applications.length || 0}</span>
                                    </div>
                                    <div className="pipeline-row">
                                        <div className="pipeline-info">
                                            <span className="icon-box blue">
                                                <span className="material-symbols-outlined">filter_list</span>
                                            </span>
                                            <span className="pipeline-label">Score ≥ 70 (IA)</span>
                                        </div>
                                        <span className="pipeline-count">
                                            {scoredApps.filter(c => c.ai_score >= 70).length}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ── AI Insights ── */}
                            <div className="dashboard-card ai-gradient-border">
                                <div className="card-header-small">
                                    <div className="flex-row gap-2">
                                        <span className="material-symbols-outlined text-purple">auto_awesome</span>
                                        <h3>Insights IA</h3>
                                    </div>
                                </div>
                                <div className="keywords-cloud">
                                    {job.requirements?.slice(0, 5).map((skill, i) => (
                                        <span key={i} className="keyword-tag blue">
                                            {skill}
                                            <span className="keyword-dot"></span>
                                        </span>
                                    ))}
                                </div>
                                <div className="ai-insight-text">
                                    <p>Les profils suggérés sont calculés par similarité sémantique via <strong>nomic-embed-text</strong>. Le score final est évalué par <strong>Qwen2.5:7b</strong>.</p>
                                </div>
                            </div>

                            {/* ── Info Box ── */}
                            <div className="dashboard-card bg-glass">
                                <div className="info-row">
                                    <span className="info-label">Salaire</span>
                                    <span className="info-value">{job.salary_range || 'Confidentiel'}</span>
                                </div>
                                <div className="divider"></div>
                                <div className="info-row">
                                    <span className="info-label">Type</span>
                                    <span className="info-value">{job.type?.toUpperCase()}</span>
                                </div>
                                {job.deadline && (
                                    <>
                                        <div className="divider"></div>
                                        <div className="info-row">
                                            <span className="info-label">Date Limite</span>
                                            <span className="info-value" style={{ color: '#ef4444', fontWeight: '500' }}>
                                                {new Date(job.deadline).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default JobDetail;
