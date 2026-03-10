import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HRSidebar from "../../components/HRSidebar";
import { useTheme } from '../../context/ThemeContext';
import StatCard from '../../components/StatCard';
import { apiFetch } from '../../../../core/api';
import './DepartmentDetail.css';

const DepartmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();

    const [department, setDepartment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [jobs, setJobs] = useState([]);
    const [team, setTeam] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            try {
                // Parallel fetch for better performance
                const [deptData, jobsData, teamData] = await Promise.all([
                    apiFetch(`/departments/${id}`),
                    apiFetch(`/jobs/?department_id=${id}`),
                    apiFetch(`/profiles/?department_id=${id}`)
                ]);
                setDepartment(deptData);
                setJobs(jobsData);
                setTeam(teamData);
            } catch (err) {
                console.error("Error fetching department detail data:", err);
                setError("Informations du département introuvables.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const [currentPage, setCurrentPage] = useState(1);
    const jobsPerPage = 5;
    const totalPages = Math.ceil(jobs.length / jobsPerPage) || 1;

    const indexOfLastJob = currentPage * jobsPerPage;
    const indexOfFirstJob = indexOfLastJob - jobsPerPage;
    const currentJobs = jobs.slice(indexOfFirstJob, indexOfLastJob);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const handleDelete = async () => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer le département "${department.name}" ?`)) {
            try {
                await apiFetch(`/departments/${id}`, { method: 'DELETE' });
                navigate('/hr/departement');
            } catch (err) {
                console.error("Error deleting department:", err);
                alert("Erreur lors de la suppression : " + err.message);
            }
        }
    };

    if (loading) {
        return (
            <div className={`dept-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="dept-detail-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loading-spinner">Chargement du département...</div>
                </main>
            </div>
        );
    }

    if (error || !department) {
        return (
            <div className={`dept-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="dept-detail-main">
                    <div className="error-container card-glass" style={{ margin: '2rem', padding: '2rem', textAlign: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ef4444' }}>error</span>
                        <h2 style={{ marginTop: '1rem' }}>{error || "Département introuvable"}</h2>
                        <button className="btn btn-secondary" onClick={() => navigate('/hr/departement')} style={{ marginTop: '1rem' }}>
                            Retour à la liste
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={`dept-detail-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="dept-detail-main">
                <div className="dept-detail-container">
                    {/* Header Section */}
                    <header className="dept-detail-header">
                        <div className="header-info-with-icon">
                            <div className={`dept-icon-box ${department.color || 'black'}`}>
                                <span className="material-symbols-outlined">{department.icon || 'group'}</span>
                            </div>
                            <div className="header-info">
                                <h1 className="page-title">{department.name}</h1>
                                <div className="responsible-row">
                                    <span className="material-symbols-outlined">badge</span>
                                    <span>Responsable : {department.manager_id || 'Non assigné'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="header-actions">
                            <button className="btn btn-secondary" onClick={() => navigate('/hr/departement')} style={{ marginRight: '0.5rem' }}>
                                <span className="material-symbols-outlined">arrow_back</span>
                                Retour
                            </button>
                            <button className="btn btn-secondary" onClick={() => navigate(`/hr/departement/${id}/edit`)} style={{ marginRight: '0.5rem' }}>
                                <span className="material-symbols-outlined">edit</span>
                                Modifier
                            </button>
                            <button className="btn btn-secondary" onClick={handleDelete} style={{ marginRight: '0.5rem', border: '1px solid #ef4444', color: '#ef4444' }}>
                                <span className="material-symbols-outlined">delete</span>
                                Supprimer
                            </button>
                            <button className="btn btn-primary glow-effect">
                                <span className="material-symbols-outlined">manage_accounts</span>
                                Gérer les membres
                            </button>
                        </div>
                    </header>

                    {/* KPI Stats Grid */}
                    <section className="stats-grid">
                        <StatCard
                            icon="work_outline"
                            label="Jobs Actifs"
                            value={jobs.length}
                            trend={jobs.length > 0 ? `+${jobs.length}` : "0"}
                            trendType="success"
                        />
                        <StatCard
                            icon="groups"
                            label="Total Membres"
                            value={team.length}
                        />
                        <StatCard
                            icon="hub"
                            label="Score de matching"
                            value="84%"
                            trend="+12%"
                            trendType="success"
                        />
                    </section>

                    {/* AI Insights Banner */}
                    <div className="ai-insights-banner glass-card">
                        <div className="ai-icon-wrapper">
                            <span className="material-symbols-outlined">auto_awesome</span>
                        </div>
                        <div className="ai-content">
                            <h3 className="ai-title">IA Insights</h3>
                            <p className="ai-text">{department.description || "Aucune description fournie pour ce département."}</p>
                        </div>
                        <button className="btn-analyze-banner">
                            Analyser
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>

                    <div className="detail-layout">
                        {/* Main Content: Jobs Table */}
                        <div className="main-content">
                            <div className="section-header">
                                <h2 className="section-title">Postes Ouverts</h2>
                                <button className="text-btn">Voir tout</button>
                            </div>

                            <div className="table-container glass-card">
                                {jobs.length > 0 ? (
                                    <>
                                        <table className="jobs-table">
                                            <thead>
                                                <tr>
                                                    <th>Intitulé du poste</th>
                                                    <th>Statut</th>
                                                    <th className="text-center">Candidats</th>
                                                    <th className="text-right">Création</th>
                                                    <th className="action-col"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentJobs.map(job => (
                                                    <tr key={job._id}>
                                                        <td>
                                                            <div className="job-info-cell">
                                                                <span className="job-name">{job.title}</span>
                                                                <span className="job-loc">{job.location || 'Remote'}</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className={`status-badge active`}>Actif</span>
                                                        </td>
                                                        <td className="text-center">
                                                            <div className="candidates-cell">
                                                                <span className="candidate-count">0</span>
                                                            </div>
                                                        </td>
                                                        <td className="text-right date-cell">
                                                            {new Date(job.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="action-col">
                                                            <button className="btn-icon-soft" onClick={() => navigate(`/hr/offres/${job._id}`)}>
                                                                <span className="material-symbols-outlined">visibility</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="table-pagination">
                                            {/* ... pagination logic ... */}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <p>Aucun poste ouvert pour le moment.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sidebar: Team */}
                        <aside className="detail-sidebar">
                            <div className="section-header">
                                <h2 className="section-title">Équipe RH</h2>
                                <button className="btn-icon-circle">
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>

                            <div className="team-list glass-card">
                                {team.length > 0 ? (
                                    team.map((member, idx) => (
                                        <div key={member._id} className="team-item">
                                            <div className="avatar-wrapper">
                                                <img src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}`} alt="" className="avatar" />
                                                <span className="status-dot online"></span>
                                            </div>
                                            <div className="member-meta">
                                                <span className="member-name">{member.full_name}</span>
                                                <span className="member-role">{member.role}</span>
                                            </div>
                                            <button className="btn-message">
                                                <span className="material-symbols-outlined">forum</span>
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <p>Aucun membre assigné.</p>
                                    </div>
                                )}
                                <button className="btn-view-team">Voir toute l'équipe</button>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DepartmentDetail;
