import React from 'react';
import { useNavigate } from 'react-router-dom';
import './CandidatDetail.css';
import HRSidebar from '../components/HRSidebar';
import { useTheme } from '../context/ThemeContext';

const CandidatDetail = () => {
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();

    const candidate = {
        name: "Thomas Durand",
        role: "Développeur Full Stack Senior",
        location: "Paris, France",
        education: "Master 2",
        experience: "8 ans exp.",
        matchScore: 85,
        matchLabel: "Excellente adéquation",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBykzfBjKHfo_jTdW18LsZiPx_Nv1gu59XU44bN5FRIm6bNAgqlBYZZzUWmcmPNJsGGtzFkc0YuvkG9eFncsFkJXDqQYhsZXHMCZZWRmRcxudllG9cRsi1ncycQ0KhFBwZxBOhllIXSIsC3EXMNzNF15aexFdfwMicxK6I0XFRfZOtLAwjjgVZXEpOs43Bf1oYsn6Nm7iy_bSdS1FAZQZqvJo5cori45zZ-SZcRAkzUarazWdNg9XMEsrIlp0kKzr0Mz1L9tG0a3g"
    };

    return (
        <div className={`candidat-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="main-content-area">
                {/* Header */}
                <header className="cd-header">
                    <div className="cd-header-content">
                        <div className="cd-back-nav">
                            <button
                                onClick={() => navigate('/hr/candidats')}
                                className="cd-back-btn"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                                Retour à la liste
                            </button>
                        </div>

                        <div className="cd-profile-header">
                            <div className="cd-profile-info">
                                <div
                                    className="cd-avatar"
                                    style={{ backgroundImage: `url("${candidate.image}")` }}
                                    role="img"
                                    aria-label={`Portrait of ${candidate.name}`}
                                ></div>
                                <div className="cd-info-text">
                                    <h1 className="cd-name">{candidate.name}</h1>
                                    <p className="cd-role">{candidate.role}</p>
                                    <div className="cd-meta">
                                        <div className="cd-meta-item">
                                            <span className="material-symbols-outlined">location_on</span>
                                            {candidate.location}
                                        </div>
                                        <div className="cd-meta-item">
                                            <span className="material-symbols-outlined">school</span>
                                            {candidate.education}
                                        </div>
                                        <div className="cd-meta-item">
                                            <span className="material-symbols-outlined">schedule</span>
                                            {candidate.experience}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="cd-actions">
                                <button className="btn-share">
                                    <span className="material-symbols-outlined" style={{ marginRight: '0.5rem' }}>share</span>
                                    Partager
                                </button>
                                <button className="btn-contact">
                                    <span className="material-symbols-outlined" style={{ marginRight: '0.5rem' }}>mail</span>
                                    Contacter
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="cd-scroll-area">
                    <div className="cd-content-grid">

                        {/* Left Column */}
                        <div className="cd-main-col">
                            <section className="cd-card">
                                <div className="cd-card-header">
                                    <h3 className="cd-card-title">
                                        <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>work_history</span>
                                        Expérience Professionnelle
                                    </h3>
                                    <span className="cd-verified-badge">Vérifié</span>
                                </div>
                                <div className="cd-timeline">
                                    <div className="cd-timeline-line"></div>

                                    <div className="cd-job-item">
                                        <div className="cd-company-logo">
                                            <div className="cd-logo-img" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBtHvuvfUMQUQSdGV3IB13gv66aM17Hv19LITLQLbrnDze1cbxLSoyadORp8eVyXwvzWo5mu_BGQyWN9HkK69VNy0WxEYajWRwkVaXnoMcQ0KIwIISjEWQQ_1Lz-8ItkGYLQ1mYpa3y0WaW1SE2G8jtDDEwEMvfdhYO51ptwJPc5LW0PvIaL_DV6DV4_gSF-f3ObeReW_3m3W-3yHFJX7XUyAjFTI2njzWAQJYapnnfazkeGgiX923RAk_p7N4r1PKpYqA1zSzGag")' }}></div>
                                        </div>
                                        <div className="cd-job-details">
                                            <h4 className="cd-job-title">Lead Developer Full Stack</h4>
                                            <p className="cd-job-meta">Tech Solutions Inc. • 2020 - Présent</p>
                                            <p className="cd-job-desc">
                                                Architecture et développement d'applications web scalables. Management d'une équipe de 5 développeurs. Migration vers React/Node.js ayant amélioré les performances de 40%.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="cd-job-item">
                                        <div className="cd-company-logo">
                                            <div className="cd-logo-img" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBbQekBkD0y6FwqfmZJ7kYEJKBjjWLmZAZXzAGkug9Qps3yuIs-_rtphylOHCPtTVIgSGRURMqEbba_4FFWhKGLGx4Ta9tzCcVHQd8amQKZ7Q6aqDYk9qW1CLXErOzp5dcAwSqgBYV7C56Nacsn14A2lu8c_fzalbrrKq4cQ3voveZzYDZT5WMUlzul3WUC587Kp1JQYmqJj3e9hGqCL-ZCbl2j8i8Zpq4d92N0U4WEafwqXU5Rs-AujZPX6jBwzdXaZfKj8uiTFA")' }}></div>
                                        </div>
                                        <div className="cd-job-details">
                                            <h4 className="cd-job-title">Senior Developer</h4>
                                            <p className="cd-job-meta">Innovation Lab • 2017 - 2020</p>
                                            <p className="cd-job-desc">
                                                Développement d'API RESTful et intégration front-end. Mise en place de pipelines CI/CD.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="cd-job-item">
                                        <div className="cd-company-logo">
                                            <div className="cd-logo-img" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBGA08vFxv8HzaFkq8rfpURKCRj2-WAtr_N15yFWN3h45yN1y5rvauC8JNOuLYPTywXLF0CiMhk_S0lX3CfqTgKwJWnZMdebgNZIAI9RkegbXipHf0txu3D0LUHXMeMh7PRpFEmzuFTbQCiI30s4qZchxT7tFY6lanotoIovI521Za4chBVXWaPyFSJ7sMIh_o7XacwZSHqSsgAIpNX_AzOZoSVUJQMCwv-CfuMY-IYc-fDn7LHiSVVLywqkzJa7nyWZ3b_F5rQcQ")' }}></div>
                                        </div>
                                        <div className="cd-job-details">
                                            <h4 className="cd-job-title">Web Developer</h4>
                                            <p className="cd-job-meta">Web Agency Paris • 2015 - 2017</p>
                                            <p className="cd-job-desc">
                                                Création de sites vitrines et e-commerce pour divers clients. Stack LAMP.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="cd-card">
                                <div className="cd-card-header">
                                    <h3 className="cd-card-title">
                                        <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>school</span>
                                        Formation
                                    </h3>
                                </div>
                                <div className="cd-timeline" style={{ paddingLeft: 0, gap: '1rem' }}>
                                    <div className="cd-edu-item">
                                        <div>
                                            <h4 className="cd-degree">Master Informatique</h4>
                                            <p className="cd-school">Université Pierre et Marie Curie • 2015</p>
                                        </div>
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <span className="cd-mention">Mention Bien</span>
                                        </div>
                                    </div>
                                    <div className="cd-edu-item">
                                        <div>
                                            <h4 className="cd-degree">Licence Informatique</h4>
                                            <p className="cd-school">Université de Nantes • 2013</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Right Column */}
                        <div className="cd-sidebar-col">
                            <div className="cd-card cd-ai-card">
                                <div className="cd-ai-glow"></div>

                                <div className="cd-ai-header">
                                    <h3 className="cd-card-title">
                                        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>smart_toy</span>
                                        Analyse IA
                                    </h3>
                                    <span className="cd-beta-badge">Beta v2.4</span>
                                </div>

                                <div className="cd-score-display">
                                    <div className="cd-circle-chart">
                                        <svg className="size-full -rotate-90" viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                            <path style={{ color: 'var(--color-border)' }} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5"></path>
                                            <path style={{ color: 'var(--color-primary)' }} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="85, 100" strokeLinecap="round" strokeWidth="2.5"></path>
                                        </svg>
                                        <div className="cd-score-text">
                                            <span className="cd-score-number">85%</span>
                                            <span className="cd-score-label">Match Score</span>
                                        </div>
                                    </div>
                                    <p className="cd-score-summary">
                                        Excellente adéquation avec le poste de <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Lead Dev</span>. Profil technique solide.
                                    </p>
                                </div>

                                <hr className="cd-divider" />

                                <div className="mb-6" style={{ marginBottom: '1.5rem' }}>
                                    <p className="cd-section-title">
                                        <span className="material-symbols-outlined" style={{ color: '#16a34a', fontSize: '1rem' }}>check_circle</span>
                                        Points Forts Identifiés
                                    </p>
                                    <div className="cd-tags">
                                        {["Expert Python", "React Native", "Leadership", "Team Player"].map((tag, idx) => (
                                            <div key={idx} className="cd-tag success">
                                                <span>{tag}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-8" style={{ marginBottom: '2rem' }}>
                                    <p className="cd-section-title">
                                        <span className="material-symbols-outlined" style={{ color: '#737373', fontSize: '1rem' }}>warning</span>
                                        Points de vigilance
                                    </p>
                                    <div className="cd-tags">
                                        {["Disponibilité 3 mois", "Salaire élevé"].map((tag, idx) => (
                                            <div key={idx} className="cd-tag warning">
                                                <span>{tag}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button className="btn-download">
                                    <span className="material-symbols-outlined" style={{ marginRight: '0.5rem' }}>download</span>
                                    Télécharger le rapport IA
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CandidatDetail;
