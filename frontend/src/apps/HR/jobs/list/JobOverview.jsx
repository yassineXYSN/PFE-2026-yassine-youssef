import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import HRSidebar from '../../components/HRSidebar';
import ConfirmationModal from '../../../../core/components/ConfirmationModal';
import { apiFetch } from '../../../../core/api';
import { supabase } from '../../../../core/supabaseClient';
import './JobOverview.css';

const JobOverview = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();

    const [jobs, setJobs] = useState([]);
    const [departments, setDepartments] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const profile = await apiFetch(`/profiles/${user.id}`);
                const companyId = profile.company_id;

                if (!companyId) {
                    setLoading(false);
                    return;
                }

                // Parallel fetch for jobs and departments
                const [jobsData, deptsData] = await Promise.all([
                    apiFetch(`/jobs/?company_id=${companyId}`),
                    apiFetch(`/departments/?company_id=${companyId}`)
                ]);

                // Create a map of deptId -> name for easy lookup
                const deptMap = {};
                deptsData.forEach(d => {
                    deptMap[d._id] = d.name;
                });

                setDepartments(deptMap);
                setJobs(jobsData);
            } catch (err) {
                console.error("Error fetching job overview data:", err);
                setError("Erreur lors du chargement des offres.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleDeleteClick = (e, job) => {
        e.stopPropagation();
        setJobToDelete(job);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!jobToDelete) return;
        
        try {
            await apiFetch(`/jobs/${jobToDelete._id}`, {
                method: 'DELETE'
            });
            setJobs(prev => prev.filter(j => j._id !== jobToDelete._id));
            setIsDeleteModalOpen(false);
            setJobToDelete(null);
        } catch (err) {
            console.error("Error deleting job:", err);
            alert("Erreur lors de la suppression de l'offre.");
        }
    };

    const handleEdit = (e, jobId) => {
        e.stopPropagation();
        navigate(`/hr/offres/${jobId}/edit`);
    };

    const handleView = (e, jobId) => {
        e.stopPropagation();
        navigate(`/hr/offres/${jobId}`);
    };

    const getScoreClass = (score) => {
        if (score >= 80) return 'high';
        if (score >= 50) return 'mid';
        return 'low';
    };

    return (
        <div className={`job-overview-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="job-overview-main">
                <div className="job-overview-container">
                    {/* Header similar to Dashboard/CandidatsList */}
                    <div className="page-header">
                        <div className="page-header-text">

                            <h2 className="page-title">Vue d'ensemble des Jobs</h2>
                            <p className="page-subtitle">Gérez vos offres d'emploi actives et suivez les performances de recrutement IA en temps réel.</p>
                        </div>

                    </div>

                    <div className="search-bar-container">
                        <div className="search-box">
                            <span className="material-symbols-outlined search-icon">search</span>
                            <input
                                className="search-input"
                                type="text"
                                placeholder="Rechercher une offre à Tunis, Sfax..."
                            />
                        </div>
                        <div className="action-buttons">
                            <button className="btn btn-secondary">
                                <span className="material-symbols-outlined">filter_list</span>
                                <span>Filtres</span>
                            </button>
                            <button className="btn btn-primary" onClick={() => navigate('/hr/offres/new')}>
                                <span className="material-symbols-outlined">add</span>
                                <span>Ajouter une offre</span>
                            </button>
                        </div>
                    </div>

                    <div className="job-content-card">
                        <table className="jobs-table">
                            <thead>
                                <tr>
                                    <th>Titre du Job</th>
                                    <th>Département</th>
                                    <th>Date de création</th>
                                    <th>Candidats</th>
                                    <th>
                                        <div className="th-with-icon">
                                            Performance IA
                                            <span className="material-symbols-outlined info-icon" title="Meilleur score de matching">info</span>
                                        </div>
                                    </th>
                                    <th>Statut</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="text-center" style={{ padding: '3rem' }}>
                                            <div className="loading-spinner">Chargement des offres...</div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan="7" className="text-center" style={{ padding: '3rem', color: '#ef4444' }}>
                                            {error}
                                        </td>
                                    </tr>
                                ) : jobs.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center" style={{ padding: '3rem', color: 'var(--text-secondary)' }}>
                                            Aucune offre d'emploi trouvée.
                                        </td>
                                    </tr>
                                ) : (
                                    jobs.map(job => (
                                        <tr
                                            key={job._id}
                                            className={`job-row ${job.status === 'published' ? 'open' : 'closed'}`}
                                            onClick={() => navigate(`/hr/offres/${job._id}`)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td>
                                                <div className="job-info">
                                                    <div className="job-title">{job.title}</div>
                                                    <div className="job-location">{job.location || 'Remote'}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="department-badge">
                                                    {departments[job.department_id] || 'Non assigné'}
                                                </span>
                                            </td>
                                            <td className="job-date">{new Date(job.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <div className="candidates-stack">
                                                    <span className={job.candidate_count > 0 ? "has-candidates" : "no-candidates"}>
                                                        {job.candidate_count || 0} candidat{job.candidate_count > 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="ai-performance">
                                                    <div className={`score-badge ${getScoreClass(job.best_ai_score)}`}>
                                                        {job.best_ai_score > 0 ? `${job.best_ai_score}%` : '-- %'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${job.status === 'published' ? 'open' : 'closed'}`}>
                                                    <span className="status-dot"></span>
                                                    {job.status === 'published' ? 'Publiée' : job.status === 'draft' ? 'Brouillon' : 'Interne'}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <div className="table-actions">
                                                    <button 
                                                        className="btn-icon delete" 
                                                        title="Supprimer"
                                                        onClick={(e) => handleDeleteClick(e, job)}
                                                    >
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {jobs.length > 5 && (
                            <div className="pagination-container">
                                <button className="pagination-btn" disabled>
                                    <span className="material-symbols-outlined">chevron_left</span>
                                    Précédent
                                </button>
                                <div className="pagination-numbers">
                                    <button className="pagination-number active">1</button>
                                </div>
                                <button className="pagination-btn" disabled>
                                    Suivant
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Supprimer l'offre"
                message={`Êtes-vous sûr de vouloir supprimer l'offre "${jobToDelete?.title}" ? Cette action est irréversible et supprimera toutes les données associées.`}
                confirmText="Supprimer définitivement"
                cancelText="Annuler"
                type="danger"
            />
        </div>
    );
};

export default JobOverview;
