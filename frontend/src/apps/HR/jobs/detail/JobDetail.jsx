import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import HRSidebar from '../../components/HRSidebar';
import './JobDetail.css';

const JobDetail = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const { id } = useParams();

    // Mock data for the job
    const job = {
        id: id || '8932',
        title: 'Développeur Full Stack Senior',
        department: 'IT / Ingénierie',
        workMode: 'Hybride (Paris)',
        status: 'OUVERT',
        statusColor: 'green',
        location: 'Paris, France',
        type: 'CDI - Plein temps',
        description: {
            company: "TechFlow est une startup en pleine croissance qui révolutionne le secteur de la logistique grâce à l'IA. Nous sommes une équipe passionnée de 50 personnes basée à Paris, avec une culture axée sur l'innovation et l'autonomie.",
            missions: [
                "Concevoir et développer de nouvelles fonctionnalités pour notre plateforme SaaS",
                "Participer à l'architecture technique et aux choix technologiques",
                "Collaborer avec les équipes produit et design pour définir les meilleures solutions",
                "Mentorer les développeurs juniors et assurer la qualité du code"
            ],
            profile: [
                "5+ ans d'expérience en développement web (React, Node.js)",
                "Maîtrise de TypeScript et des bases de données SQL",
                "Expérience avec les architectures cloud (AWS/GCP)",
                "Capacité à travailler en équipe et à communiquer efficacement"
            ]
        },
        salary: {
            min: 55000,
            max: 75000,
            currency: 'EUR',
            frequency: 'Annuel'
        },
        benefits: [
            "Tickets resto",
            "Mutuelle 100%",
            "Télétravail flexible",
            "BSPCE"
        ],
        skills: [
            { name: 'React.js', level: 'Essentiel', color: 'green' },
            { name: 'TypeScript', level: 'Essentiel', color: 'green' },
            { name: 'Node.js', level: 'Avancé', color: 'green' },
            { name: 'PostgreSQL', level: 'Intermédiaire', color: 'blue' },
            { name: 'AWS', level: 'Souhaité', color: 'yellow' }
        ],
        recentCandidates: [
            {
                name: 'Sophie Martin',
                time: 'il y a 2 heures',
                role: 'Lead Dev @ TechFlow',
                score: 98,
                status: 'Entretien',
                statusColor: 'blue',
                avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDr6i1yxUn_MsRaWW4BBVjVCClqAydKUaNHd7T7xDz70l6gEArQ2_wkxuKUbMfGxEdZOtCZGsOsmvTAhBYn-kgoX1Ff5g2GpWdQ5CXLWD-nE_fXD8X4271dAFmnf5C9fPjl8V0BY4NARRalRSE-yNjrUmOWZi-1XJH5W_gTqqY-WY4fxOV2YsbsArHLYR8JuVGY_Yk6uAgglo3KXo10UlkQuVHDXg0G0BccAamD9-zWb3Ku8_zMMBXIS09dahk09-FYxG3OTaHalg'
            },
            {
                name: 'Thomas Dubois',
                time: 'il y a 5 heures',
                role: 'Frontend Engineer @ WebCorp',
                score: 89,
                status: 'À revoir',
                statusColor: 'orange',
                avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA_ndyAGJCAeGLk8NdQfkPoogBNIY9kS0q6S-YC1PO4B598Ys9-7Yv1lUNXuVmQxoElc4LmdI-1oWhEXNa5RZPRUlzjnt3CNS9uAiI_eS5BRA2ironGeo5kF3Oz92ZQl-h2bO7HzrMSTJNvtxb-GKmVszNF5HrtjV_bH3qJxPxla8a01EKdPEWIuRSeQwwDkOTOIb1NA6SYj0GJ82XTD5RXByzTqxajEaMNDIZ4bvQBE5uRq0oHGQm30gphhW5C9MZlzBFhf9JFoQ'
            },
            {
                name: 'Julie Chang',
                time: 'il y a 1 jour',
                role: 'Full Stack Dev @ StartUp',
                score: 74,
                status: 'Nouveau',
                statusColor: 'neutral',
                avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCQ0Fs9fnRTO4gDLrPB679MPk4_5G8vhSVBn85v9iMQHlIiBBb2uNJYiMxcFxyVjycGbl6aApyY0Nz9nuj5ytdwB6Dnur6mTIzqsdvnQgBP49VCbO5GG4DVdhLAuLbXsPj12wuAM_EKNq87x6VGlvUXy8tu1GZer5yEi818zlaIBkuPLR8W72NxrxbmBsVhkm02YflBWidlsZnxcahwL_btXpDtnr07GmUr0bz0gMLcH9EH0ud2rqf0IQug-6m2nR7Xcp7mPC5Cag'
            }
        ],
        stats: {
            totalCandidates: 124,
            pipeline: [
                { label: 'Candidatures', count: 45, icon: 'inbox', color: 'neutral' },
                { label: 'Qualifiés (IA)', count: 32, icon: 'filter_list', color: 'blue' },
                { label: 'Entretiens', count: 15, icon: 'video_chat', color: 'purple' },
                { label: 'Offres', count: 2, icon: 'check_circle', color: 'green' }
            ],
            avgScore: 87,
            scoreTrend: '+5%',
            recruitmentTime: '14 jours',
            aiConfidence: 'Haute',
            aiConfidenceValue: 85
        },
        screeningQuestions: [
            "Avez-vous le permis B ?",
            "Êtes-vous disponible sous 3 mois ?",
            "Avez-vous déjà travaillé en remote ?"
        ]
    };

    const [activeTab, setActiveTab] = React.useState('missions');

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
                                    <span className={`status-pill ${job.statusColor}`}>
                                        <span className="status-dot"></span>
                                        {job.status}
                                    </span>
                                </div>
                                <div className="job-meta-row">
                                    <span className="meta-item">
                                        <span className="material-symbols-outlined">domain</span>
                                        {job.department}
                                    </span>
                                    <span className="meta-dot">·</span>
                                    <span className="meta-item">
                                        <span className="material-symbols-outlined">location_on</span>
                                        {job.location}
                                    </span>
                                    <span className="meta-dot">·</span>
                                    <span className="meta-item">
                                        <span className="material-symbols-outlined">schedule</span>
                                        {job.type}
                                    </span>
                                </div>
                            </div>
                            <div className="header-actions-group">
                                <button className="btn btn-secondary icon-only" title="Partager">
                                    <span className="material-symbols-outlined">share</span>
                                </button>
                                <button className="btn btn-secondary icon-only" title="Modifier">
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
                                    <span className="mini-stat-value">{job.stats.totalCandidates}</span>
                                    <span className="mini-stat-label">Candidats</span>
                                </div>
                                <div className="mini-stat-divider"></div>
                                <div className="mini-stat">
                                    <span className="mini-stat-value highlight">{job.stats.avgScore}%</span>
                                    <span className="mini-stat-label">Score Moyen</span>
                                </div>
                                <div className="mini-stat-divider"></div>
                                <div className="mini-stat">
                                    <span className="mini-stat-value">{job.stats.recruitmentTime}</span>
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
                                            strokeDasharray={`${job.stats.aiConfidenceValue}, 100`}
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                    </svg>
                                    <span className="ai-score-text">{job.stats.aiConfidenceValue}%</span>
                                </div>
                                <div className="ai-badge-text">
                                    <span className="ai-label-bold">Match IA</span>
                                    <span className="ai-label-sub">Confiance Haute</span>
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
                                    {job.recentCandidates.map((candidate, i) => (
                                        <div key={i} className="candidate-card-item">
                                            <div className="candidate-avatar-wrapper">
                                                <img src={candidate.avatar} alt={candidate.name} className="candidate-avatar-large" />
                                                <div className="match-badge">{candidate.score}%</div>
                                            </div>
                                            <div className="candidate-details">
                                                <h3 className="candidate-name">{candidate.name}</h3>
                                                <p className="candidate-role">{candidate.role}</p>
                                                <div className="candidate-tags">
                                                    <span className={`status-tag ${candidate.statusColor}`}>{candidate.status}</span>
                                                    <span className="time-tag">{candidate.time}</span>
                                                </div>
                                            </div>
                                            <button className="btn-icon-soft">
                                                <span className="material-symbols-outlined">chevron_right</span>
                                            </button>
                                        </div>
                                    ))}
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
                                            {job.description.missions.map((m, i) => (
                                                <div key={i} className="modern-list-item">
                                                    <div className="list-icon-circle blue">
                                                        <span className="material-symbols-outlined">check</span>
                                                    </div>
                                                    <p className="list-content-text">{m}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {activeTab === 'profile' && (
                                        <div className="modern-list">
                                            {job.description.profile.map((p, i) => (
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
                                            {job.benefits.map((b, i) => (
                                                <div key={i} className="benefit-card">
                                                    <div className="benefit-icon-wrapper green">
                                                        <span className="material-symbols-outlined">verified</span>
                                                    </div>
                                                    <span className="benefit-text">{b}</span>
                                                </div>
                                            ))}
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
                                    {job.stats.pipeline.map((item, i) => (
                                        <div key={i} className="pipeline-row">
                                            <div className="pipeline-info">
                                                <span className={`icon-box ${item.color}`}>
                                                    <span className="material-symbols-outlined">{item.icon}</span>
                                                </span>
                                                <span className="pipeline-label">{item.label}</span>
                                            </div>
                                            <span className="pipeline-count">{item.count}</span>
                                        </div>
                                    ))}
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
                                    {job.skills.map((skill, i) => (
                                        <span key={i} className={`keyword-tag ${skill.color}`}>
                                            {skill.name}
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
                                    <span className="info-value">{job.salary.min / 1000}k - {job.salary.max / 1000}k €</span>
                                </div>
                                <div className="divider"></div>
                                <div className="info-row">
                                    <span className="info-label">Type</span>
                                    <span className="info-value">{job.type}</span>
                                </div>
                                <div className="divider"></div>
                                <div className="info-row">
                                    <span className="info-label">Questions</span>
                                    <span className="info-value">{job.screeningQuestions.length} Filtres</span>
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
