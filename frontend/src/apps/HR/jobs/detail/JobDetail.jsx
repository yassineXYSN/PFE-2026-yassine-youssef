import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import HRSidebar from '../../components/HRSidebar';
import { apiFetch } from '../../../../core/api';
import './JobDetail.css';

const JobDetail = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const { id } = useParams();

    const [job, setJob] = useState(null);
    const [department, setDepartment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('missions');

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

    return (
        <div className={`job-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="job-detail-main">
                <div className="job-detail-container">
                    {/* Header */}
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
                                    <span className="mini-stat-value">0</span>
                                    <span className="mini-stat-label">Candidats</span>
                                </div>
                                <div className="mini-stat-divider"></div>
                                <div className="mini-stat">
                                    <span className="mini-stat-value highlight">--%</span>
                                    <span className="mini-stat-label">Score Moyen</span>
                                </div>
                                <div className="mini-stat-divider"></div>
                                <div className="mini-stat">
                                    <span className="mini-stat-value">-- jours</span>
                                    <span className="mini-stat-label">Temps Recrut.</span>
                                </div>
                            </div>

                            <div className="ai-match-badge">
                                <div className="ai-ring-mini">
                                    <svg viewBox="0 0 36 36" className="circular-chart-mini">
                                        <path className="circle-bg"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path className="circle"
                                            strokeDasharray={`0, 100`}
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                    </svg>
                                    <span className="ai-score-text">--%</span>
                                </div>
                                <div className="ai-badge-text">
                                    <span className="ai-label-bold">Match IA</span>
                                    <span className="ai-label-sub">Confiance N/A</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="dashboard-grid">
                        {/* Main Column */}
                        <div className="main-column">
                            {/* Candidates Section */}
                            <section className="dashboard-card">
                                <div className="card-header">
                                    <h2 className="card-title">Top Candidats</h2>
                                    <button className="btn-link">Voir tout</button>
                                </div>
                                <div className="candidates-list">
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <p>Aucun candidat pour le moment.</p>
                                    </div>
                                </div>
                            </section>

                            {/* Job Description & Profile - Tabs Look */}
                            <section className="dashboard-card">
                                <div className="card-header-tabs">
                                    <button
                                        className={`tab-btn ${activeTab === 'missions' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('missions')}
                                    >
                                        Missions
                                    </button>
                                    <button
                                        className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('profile')}
                                    >
                                        Profil
                                    </button>
                                    <button
                                        className={`tab-btn ${activeTab === 'benefits' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('benefits')}
                                    >
                                        Avantages
                                    </button>
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

                                    {activeTab === 'benefits' && (
                                        <div className="benefits-grid-large">
                                            <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                                Aucun avantage spécifique listé.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* Sidebar Column */}
                        <div className="sidebar-column">
                            {/* Pipeline Summary */}
                            <div className="dashboard-card p-0 overflow-hidden">
                                <div className="card-header-small">
                                    <h3>Pipeline</h3>
                                </div>
                                <div className="pipeline-stats">
                                    <div className="pipeline-row">
                                        <div className="pipeline-info">
                                            <span className={`icon-box neutral`}>
                                                <span className="material-symbols-outlined">inbox</span>
                                            </span>
                                            <span className="pipeline-label">Candidatures</span>
                                        </div>
                                        <span className="pipeline-count">0</span>
                                    </div>
                                    <div className="pipeline-row">
                                        <div className="pipeline-info">
                                            <span className={`icon-box blue`}>
                                                <span className="material-symbols-outlined">filter_list</span>
                                            </span>
                                            <span className="pipeline-label">Qualifiés (IA)</span>
                                        </div>
                                        <span className="pipeline-count">0</span>
                                    </div>
                                </div>
                            </div>

                            {/* AI Insights */}
                            <div className="dashboard-card ai-gradient-border">
                                <div className="card-header-small">
                                    <div className="flex-row gap-2">
                                        <span className="material-symbols-outlined text-purple">auto_awesome</span>
                                        <h3>Insights IA</h3>
                                    </div>
                                </div>
                                <div className="keywords-cloud">
                                    {job.requirements?.slice(0, 5).map((skill, i) => (
                                        <span key={i} className={`keyword-tag blue`}>
                                            {skill}
                                            <span className="keyword-dot"></span>
                                        </span>
                                    ))}
                                </div>
                                <div className="ai-insight-text">
                                    <p>Les candidats avec <strong>React.js</strong> et <strong>Node.js</strong> ont 40% plus de chances de réussite pour ce poste.</p>
                                </div>
                            </div>

                            {/* Info Box */}
                            <div className="dashboard-card bg-glass">
                                <div className="info-row">
                                    <span className="info-label">Salaire</span>
                                    <span className="info-value">{job.salary_range || 'Confidenciel'}</span>
                                </div>
                                <div className="divider"></div>
                                <div className="info-row">
                                    <span className="info-label">Type</span>
                                    <span className="info-value">{job.type?.toUpperCase()}</span>
                                </div>
                                <div className="divider"></div>
                                <div className="info-row">
                                    <span className="info-label">Questions</span>
                                    <span className="info-value">{job.screening_questions?.length || 0} Filtres</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default JobDetail;
