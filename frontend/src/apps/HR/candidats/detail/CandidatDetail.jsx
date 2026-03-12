import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './CandidatDetail.css';
import HRSidebar from '../../components/HRSidebar';
import { useTheme } from '../../context/ThemeContext';
import { apiFetch } from '../../../../core/api';

const CandidatDetail = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { effectiveTheme } = useTheme();
    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCandidate = async () => {
            try {
                setLoading(true);
                const data = await apiFetch(`/candidates/${id}`);
                setCandidate(data);
            } catch (err) {
                console.error('Error fetching candidate:', err);
                setError('Impossible de charger le profil de ce candidat.');
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchCandidate();
    }, [id]);

    // Parse AI justification to extract strengths and weaknesses
    const parseStrengths = (justification) => {
        if (!justification) return [];
        const match = justification.match(/points?\s*forts?\s*[:\-]?\s*([\s\S]*?)(?=points?\s*(de\s*)?vigilance|$)/i);
        if (match) return match[1].split(/[•\-\n]/g).map(s => s.trim()).filter(s => s.length > 3).slice(0, 5);
        return justification.split('.').map(s => s.trim()).filter(s => s.length > 10).slice(0, 3);
    };

    const parseWeaknesses = (justification) => {
        if (!justification) return [];
        const match = justification.match(/points?\s*(de\s*)?vigilance\s*[:\-]?\s*([\s\S]*?)$/i);
        if (match) return match[2].split(/[•\-\n]/g).map(s => s.trim()).filter(s => s.length > 3).slice(0, 3);
        return [];
    };

    const displayName = candidate
        ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email || 'Candidat'
        : '';

    const score = candidate?.best_score || 0;
    const skills = candidate?.skills || [];
    const experiences = candidate?.experiences || [];
    const educations = candidate?.educations || [];
    const certificates = candidate?.certificates || [];
    const languages = candidate?.languages || [];
    const hobbies = candidate?.hobbies || [];
    const strengths = parseStrengths(candidate?.ai_justification);
    const weaknesses = parseWeaknesses(candidate?.ai_justification);
    const initials = displayName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const ScoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';

    if (loading) {
        return (
            <div className={`candidat-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="main-content-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}>person_search</span>
                        <p>Chargement du profil...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (error || !candidate) {
        return (
            <div className={`candidat-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="main-content-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#ef4444', display: 'block', marginBottom: '1rem' }}>error</span>
                        <p>{error || 'Profil introuvable'}</p>
                        <button className="cd-back-btn" onClick={() => navigate('/hr/candidats')} style={{ marginTop: '1rem' }}>Retour à la liste</button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={`candidat-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="main-content-area">

                {/* ─── HEADER ─── */}
                <header className="cd-header">
                    <div className="cd-header-content">
                        <div className="cd-back-nav">
                            <button onClick={() => navigate('/hr/candidats')} className="cd-back-btn">
                                <span className="material-symbols-outlined">arrow_back</span>
                                Retour à la liste
                            </button>
                        </div>

                        <div className="cd-profile-header">
                            <div className="cd-profile-info">
                                {/* Avatar */}
                                <div
                                    className="cd-avatar"
                                    style={candidate.profileImage
                                        ? { backgroundImage: `url("${candidate.profileImage}")` }
                                        : { background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                                    }
                                    role="img" aria-label={`Portrait de ${displayName}`}
                                >
                                    {!candidate.profileImage && (
                                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.5rem' }}>{initials || '?'}</span>
                                    )}
                                </div>

                                <div className="cd-info-text">
                                    <h1 className="cd-name">{displayName}</h1>
                                    {candidate.title && <p className="cd-role">{candidate.title}</p>}

                                    <div className="cd-meta">
                                        {candidate.email && (
                                            <div className="cd-meta-item">
                                                <span className="material-symbols-outlined">mail</span>
                                                <a href={`mailto:${candidate.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{candidate.email}</a>
                                            </div>
                                        )}
                                        {candidate.phone && (
                                            <div className="cd-meta-item">
                                                <span className="material-symbols-outlined">call</span>
                                                {candidate.phone}
                                            </div>
                                        )}
                                        {(candidate.address || candidate.location) && (
                                            <div className="cd-meta-item">
                                                <span className="material-symbols-outlined">location_on</span>
                                                {candidate.address || candidate.location}
                                            </div>
                                        )}
                                        {educations.length > 0 && (
                                            <div className="cd-meta-item">
                                                <span className="material-symbols-outlined">school</span>
                                                {educations[0].degree || educations[0].institution || 'Formation'}
                                            </div>
                                        )}
                                        {experiences.length > 0 && (
                                            <div className="cd-meta-item">
                                                <span className="material-symbols-outlined">work</span>
                                                {experiences.length} expérience{experiences.length > 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </div>

                                    {/* Social Links */}
                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                        {candidate.linkedinUrl && (
                                            <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#0a66c2', textDecoration: 'none', fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>link</span>LinkedIn
                                            </a>
                                        )}
                                        {candidate.github && (
                                            <a href={candidate.github} target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', textDecoration: 'none', fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>code</span>GitHub
                                            </a>
                                        )}
                                        {candidate.website && (
                                            <a href={candidate.website} target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>public</span>Portfolio
                                            </a>
                                        )}
                                        {candidate.twitter && (
                                            <a href={candidate.twitter} target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#1da1f2', textDecoration: 'none', fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>alternate_email</span>Twitter
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="cd-actions">
                                {candidate.email && (
                                    <a href={`mailto:${candidate.email}`} className="btn-contact"
                                        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="material-symbols-outlined">mail</span>
                                        Contacter
                                    </a>
                                )}
                                {candidate.cv && (
                                    <a href={`http://localhost:8000/candidat/profile/cv/download`}
                                        className="btn-share"
                                        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="material-symbols-outlined">download</span>
                                        Télécharger CV
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* ─── CONTENT ─── */}
                <div className="cd-scroll-area">
                    <div className="cd-content-grid">

                        {/* ── LEFT COLUMN ── */}
                        <div className="cd-main-col">

                            {/* About / Bio */}
                            {candidate.about && (
                                <section className="cd-card">
                                    <div className="cd-card-header">
                                        <h3 className="cd-card-title">
                                            <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>person</span>
                                            À propos
                                        </h3>
                                    </div>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{candidate.about}</p>
                                </section>
                            )}

                            {/* Experience */}
                            <section className="cd-card">
                                <div className="cd-card-header">
                                    <h3 className="cd-card-title">
                                        <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>work_history</span>
                                        Expérience Professionnelle
                                    </h3>
                                    {experiences.length > 0 && (
                                        <span className="cd-verified-badge">{experiences.length} poste{experiences.length > 1 ? 's' : ''}</span>
                                    )}
                                </div>
                                {experiences.length > 0 ? (
                                    <div className="cd-timeline">
                                        <div className="cd-timeline-line"></div>
                                        {experiences.map((exp, idx) => (
                                            <div className="cd-job-item" key={idx}>
                                                <div className="cd-company-logo">
                                                    <div className="cd-logo-img" style={{ background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--color-text-secondary)' }}>business</span>
                                                    </div>
                                                </div>
                                                <div className="cd-job-details">
                                                    <h4 className="cd-job-title">{exp.title || exp.position || 'Poste'}</h4>
                                                    <p className="cd-job-meta">
                                                        <strong>{exp.company || exp.organization || 'Entreprise'}</strong>
                                                        {(exp.contract_type || exp.type) && ` · ${exp.contract_type || exp.type}`}
                                                        {(exp.start_date || exp.startDate || exp.start_year) &&
                                                            ` · ${exp.start_date || exp.startDate || exp.start_year}`}
                                                        {exp.current ? ' – Présent'
                                                            : (exp.end_date || exp.endDate || exp.end_year)
                                                                ? ` – ${exp.end_date || exp.endDate || exp.end_year}`
                                                                : ''}
                                                    </p>
                                                    {(exp.location || exp.city) && (
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0.2rem 0' }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', verticalAlign: 'middle' }}>location_on</span>
                                                            {exp.location || exp.city}
                                                        </p>
                                                    )}
                                                    {exp.description && <p className="cd-job-desc" style={{ marginTop: '0.5rem' }}>{exp.description}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Aucune expérience renseignée.</p>
                                )}
                            </section>

                            {/* Education */}
                            {educations.length > 0 && (
                                <section className="cd-card">
                                    <div className="cd-card-header">
                                        <h3 className="cd-card-title">
                                            <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>school</span>
                                            Formation
                                        </h3>
                                        <span className="cd-verified-badge">{educations.length}</span>
                                    </div>
                                    <div className="cd-timeline" style={{ paddingLeft: 0, gap: '1rem' }}>
                                        {educations.map((edu, idx) => (
                                            <div className="cd-edu-item" key={idx}>
                                                <div>
                                                    <h4 className="cd-degree">{edu.degree || edu.field || edu.level || 'Diplôme'}</h4>
                                                    <p className="cd-school">
                                                        <strong>{edu.institution || edu.school || edu.university || 'Établissement'}</strong>
                                                        {edu.field_of_study && ` · ${edu.field_of_study}`}
                                                    </p>
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                        {(edu.start_date || edu.startDate || edu.start_year) &&
                                                            `${edu.start_date || edu.startDate || edu.start_year}`}
                                                        {(edu.end_date || edu.year || edu.end_year) &&
                                                            ` – ${edu.end_date || edu.year || edu.end_year}`}
                                                    </p>
                                                </div>
                                                {(edu.mention || edu.grade || edu.honors) && (
                                                    <div style={{ marginTop: '0.4rem' }}>
                                                        <span className="cd-mention">{edu.mention || edu.grade || edu.honors}</span>
                                                    </div>
                                                )}
                                                {edu.description && (
                                                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '0.4rem' }}>{edu.description}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Certificates */}
                            {certificates.length > 0 && (
                                <section className="cd-card">
                                    <div className="cd-card-header">
                                        <h3 className="cd-card-title">
                                            <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>verified</span>
                                            Certifications
                                        </h3>
                                        <span className="cd-verified-badge">{certificates.length}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {certificates.map((cert, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex', alignItems: 'center', gap: '1rem',
                                                padding: '0.75rem', borderRadius: '0.5rem',
                                                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)'
                                            }}>
                                                <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: '1.8rem' }}>workspace_premium</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
                                                        {cert.name || cert.title || 'Certification'}
                                                    </div>
                                                    {cert.issuer && (
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{cert.issuer}</div>
                                                    )}
                                                    {(cert.date || cert.issue_date || cert.year) && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                            {cert.date || cert.issue_date || cert.year}
                                                            {cert.expiry_date && ` · Expire : ${cert.expiry_date}`}
                                                        </div>
                                                    )}
                                                </div>
                                                {cert.credential_id && (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                                                        #{cert.credential_id}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Skills */}
                            {skills.length > 0 && (
                                <section className="cd-card">
                                    <div className="cd-card-header">
                                        <h3 className="cd-card-title">
                                            <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>psychology</span>
                                            Compétences Techniques
                                        </h3>
                                        <span className="cd-verified-badge">{skills.length}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {skills.map((skill, idx) => {
                                            const skillName = typeof skill === 'string' ? skill : (skill?.name || skill?.label);
                                            const skillLevel = typeof skill === 'object' ? skill?.level : null;
                                            return skillName ? (
                                                <div key={idx} className="cd-tag success" title={skillLevel || ''}>
                                                    <span>{skillName}</span>
                                                    {skillLevel && <span style={{ opacity: 0.6, fontSize: '0.7em', marginLeft: '0.3em' }}>· {skillLevel}</span>}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Languages */}
                            {languages.length > 0 && (
                                <section className="cd-card">
                                    <div className="cd-card-header">
                                        <h3 className="cd-card-title">
                                            <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>language</span>
                                            Langues
                                        </h3>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                        {languages.map((lang, idx) => {
                                            const langName = typeof lang === 'string' ? lang : (lang?.name || lang?.language);
                                            const langLevel = typeof lang === 'object' ? (lang?.level || lang?.proficiency) : null;
                                            return langName ? (
                                                <div key={idx} style={{
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                    padding: '0.6rem 1.2rem', borderRadius: '0.5rem',
                                                    background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', minWidth: '80px'
                                                }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>{langName}</span>
                                                    {langLevel && <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>{langLevel}</span>}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Hobbies */}
                            {hobbies.length > 0 && (
                                <section className="cd-card">
                                    <div className="cd-card-header">
                                        <h3 className="cd-card-title">
                                            <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>favorite</span>
                                            Centres d'intérêt
                                        </h3>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {hobbies.map((hobby, idx) => {
                                            const hobbyName = typeof hobby === 'string' ? hobby : hobby?.name;
                                            return hobbyName ? (
                                                <div key={idx} style={{
                                                    padding: '0.3rem 0.8rem', borderRadius: '99px',
                                                    background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                                                    fontSize: '0.85rem', color: 'var(--color-text-secondary)'
                                                }}>{hobbyName}</div>
                                            ) : null;
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Applications History */}
                            {candidate.applications && candidate.applications.length > 0 && (
                                <section className="cd-card">
                                    <div className="cd-card-header">
                                        <h3 className="cd-card-title">
                                            <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>description</span>
                                            Candidatures
                                        </h3>
                                        <span className="cd-verified-badge">{candidate.applications.length}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {candidate.applications.map((app, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '0.75rem', borderRadius: '0.5rem',
                                                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)'
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--color-text-main)', fontSize: '0.9rem' }}>{app.job_title}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                        {app.created_at ? new Date(app.created_at).toLocaleDateString('fr-FR') : ''}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '1rem', color: app.ai_score >= 80 ? '#22c55e' : app.ai_score >= 50 ? '#eab308' : '#ef4444' }}>
                                                        {app.ai_score || 0}%
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: '99px', fontWeight: 600,
                                                        background: app.status === 'pending' ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
                                                        color: app.status === 'pending' ? '#eab308' : '#22c55e'
                                                    }}>
                                                        {app.status === 'pending' ? 'En attente' : app.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* ── RIGHT COLUMN – AI Analysis ── */}
                        <div className="cd-sidebar-col">
                            <div className="cd-card cd-ai-card">
                                <div className="cd-ai-glow"></div>

                                <div className="cd-ai-header">
                                    <h3 className="cd-card-title">
                                        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>smart_toy</span>
                                        Analyse IA
                                    </h3>
                                    <span className="cd-beta-badge">HumatiQ AI</span>
                                </div>

                                {/* Score Circle */}
                                <div className="cd-score-display">
                                    <div className="cd-circle-chart">
                                        <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                            <path style={{ color: 'var(--color-border)' }}
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none" stroke="currentColor" strokeWidth="2.5" />
                                            <path
                                                style={{ color: ScoreColor }}
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none" stroke="currentColor"
                                                strokeDasharray={`${score}, 100`}
                                                strokeLinecap="round" strokeWidth="2.5"
                                            />
                                        </svg>
                                        <div className="cd-score-text">
                                            <span className="cd-score-number" style={{ color: ScoreColor }}>{score}%</span>
                                            <span className="cd-score-label">Match Score</span>
                                        </div>
                                    </div>
                                    <p className="cd-score-summary">
                                        {score >= 80
                                            ? <><span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{candidate.best_match_job}</span> — Excellente adéquation. Profil recommandé.</>
                                            : score >= 50
                                            ? <>Bonne correspondance avec <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{candidate.best_match_job}</span>.</>
                                            : candidate.applications?.length > 0
                                            ? <>Faible correspondance avec <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{candidate.best_match_job}</span>. À revoir.</>
                                            : "Aucune candidature soumise pour l'instant."}
                                    </p>
                                </div>

                                <hr className="cd-divider" />

                                {/* Strengths */}
                                {strengths.length > 0 ? (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <p className="cd-section-title">
                                            <span className="material-symbols-outlined" style={{ color: '#16a34a', fontSize: '1rem' }}>check_circle</span>
                                            Points Forts
                                        </p>
                                        <div className="cd-tags">
                                            {strengths.map((tag, idx) => <div key={idx} className="cd-tag success"><span>{tag}</span></div>)}
                                        </div>
                                    </div>
                                ) : skills.length > 0 ? (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <p className="cd-section-title">
                                            <span className="material-symbols-outlined" style={{ color: '#16a34a', fontSize: '1rem' }}>check_circle</span>
                                            Compétences Clés
                                        </p>
                                        <div className="cd-tags">
                                            {skills.slice(0, 5).map((skill, idx) => {
                                                const name = typeof skill === 'string' ? skill : skill?.name;
                                                return name ? <div key={idx} className="cd-tag success"><span>{name}</span></div> : null;
                                            })}
                                        </div>
                                    </div>
                                ) : null}

                                {/* Weaknesses */}
                                {weaknesses.length > 0 && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <p className="cd-section-title">
                                            <span className="material-symbols-outlined" style={{ color: '#737373', fontSize: '1rem' }}>warning</span>
                                            Points de vigilance
                                        </p>
                                        <div className="cd-tags">
                                            {weaknesses.map((tag, idx) => <div key={idx} className="cd-tag warning"><span>{tag}</span></div>)}
                                        </div>
                                    </div>
                                )}

                                {/* AI Justification */}
                                {candidate.ai_justification && (
                                    <>
                                        <hr className="cd-divider" />
                                        <div>
                                            <p className="cd-section-title">
                                                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '1rem' }}>auto_awesome</span>
                                                Justification IA
                                            </p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginTop: '0.5rem' }}>
                                                {candidate.ai_justification.slice(0, 400)}{candidate.ai_justification.length > 400 ? '...' : ''}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Quick Info Card */}
                            <div className="cd-card" style={{ marginTop: '1.5rem' }}>
                                <div className="cd-card-header">
                                    <h3 className="cd-card-title">
                                        <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>info</span>
                                        Informations
                                    </h3>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    {candidate.created_at && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'var(--color-text-secondary)' }}>Inscrit le</span>
                                            <span style={{ fontWeight: 600 }}>{new Date(candidate.created_at).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                    )}
                                    {candidate.status && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'var(--color-text-secondary)' }}>Statut</span>
                                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{candidate.status}</span>
                                        </div>
                                    )}
                                    {candidate.applications && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'var(--color-text-secondary)' }}>Candidatures</span>
                                            <span style={{ fontWeight: 600 }}>{candidate.applications.length}</span>
                                        </div>
                                    )}
                                    {skills.length > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'var(--color-text-secondary)' }}>Compétences</span>
                                            <span style={{ fontWeight: 600 }}>{skills.length}</span>
                                        </div>
                                    )}
                                    {certificates.length > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'var(--color-text-secondary)' }}>Certifications</span>
                                            <span style={{ fontWeight: 600 }}>{certificates.length}</span>
                                        </div>
                                    )}
                                    {languages.length > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'var(--color-text-secondary)' }}>Langues</span>
                                            <span style={{ fontWeight: 600 }}>{languages.length}</span>
                                        </div>
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

export default CandidatDetail;
