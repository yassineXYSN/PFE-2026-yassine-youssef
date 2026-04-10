import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import HRSidebar from '../../components/HRSidebar';
import HRPageLoader from '../../components/HRPageLoader';
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
    const [searchTerm, setSearchTerm] = useState('');
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedLocation, setSelectedLocation] = useState('all');
    const [candidateThreshold, setCandidateThreshold] = useState('all');
    const [sortBy, setSortBy] = useState('recent');

    const [currentPage, setCurrentPage] = useState(1);
    const jobsPerPage = 5;

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const {
                    data: { user }
                } = await supabase.auth.getUser();

                if (!user) return;

                const profile = await apiFetch(`/profiles/${user.id}`);
                const companyId = profile.company_id;

                if (!companyId) {
                    setLoading(false);
                    return;
                }

                const [jobsData, deptsData] = await Promise.all([
                    apiFetch(`/jobs/?company_id=${companyId}`),
                    apiFetch(`/departments/?company_id=${companyId}`)
                ]);

                const deptMap = {};
                deptsData.forEach((department) => {
                    deptMap[department._id] = department.name;
                });

                setDepartments(deptMap);
                setJobs(jobsData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
            } catch (err) {
                console.error('Error fetching job overview data:', err);
                setError("Erreur lors du chargement des offres.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleDeleteClick = (event, job) => {
        event.stopPropagation();
        setJobToDelete(job);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!jobToDelete) return;

        try {
            await apiFetch(`/jobs/${jobToDelete._id}`, {
                method: 'DELETE'
            });
            setJobs((prev) => prev.filter((job) => job._id !== jobToDelete._id));
            setIsDeleteModalOpen(false);
            setJobToDelete(null);
        } catch (err) {
            console.error('Error deleting job:', err);
            alert("Erreur lors de la suppression de l'offre.");
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedStatus, selectedDepartment, selectedLocation, candidateThreshold, sortBy]);

    const departmentOptions = Array.from(
        new Set(
            jobs
                .map((job) => departments[job.department_id])
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));

    const locationOptions = Array.from(
        new Set(
            jobs
                .map((job) => (job.location || 'Remote').trim())
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));

    const activeFiltersCount = [
        selectedStatus !== 'all',
        selectedDepartment !== 'all',
        selectedLocation !== 'all',
        candidateThreshold !== 'all',
        sortBy !== 'recent'
    ].filter(Boolean).length;

    const filteredJobs = jobs.filter((job) => {
        const searchValue = searchTerm.trim().toLowerCase();
        const departmentName = departments[job.department_id] || '';
        const normalizedLocation = job.location || 'Remote';
        const candidateCount = Number(job.candidate_count ?? 0);

        const title = (job.title || '').toLowerCase();
        const location = normalizedLocation.toLowerCase();
        const status = (job.status || '').toLowerCase();
        const matchesSearch = !searchValue || (
            title.includes(searchValue) ||
            location.includes(searchValue) ||
            departmentName.toLowerCase().includes(searchValue) ||
            status.includes(searchValue)
        );
        const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
        const matchesDepartment = selectedDepartment === 'all' || departmentName === selectedDepartment;
        const matchesLocation = selectedLocation === 'all' || normalizedLocation === selectedLocation;
        const matchesCandidates =
            candidateThreshold === 'all' ||
            (candidateThreshold === '0' && candidateCount === 0) ||
            (candidateThreshold === '1-5' && candidateCount >= 1 && candidateCount <= 5) ||
            (candidateThreshold === '6+' && candidateCount >= 6);

        return matchesSearch && matchesStatus && matchesDepartment && matchesLocation && matchesCandidates;
    }).sort((a, b) => {
        if (sortBy === 'oldest') {
            return new Date(a.created_at) - new Date(b.created_at);
        }

        if (sortBy === 'title') {
            return (a.title || '').localeCompare(b.title || '');
        }

        if (sortBy === 'candidates') {
            return Number(b.candidate_count ?? 0) - Number(a.candidate_count ?? 0);
        }

        return new Date(b.created_at) - new Date(a.created_at);
    });

    const clearFilters = () => {
        setSelectedStatus('all');
        setSelectedDepartment('all');
        setSelectedLocation('all');
        setCandidateThreshold('all');
        setSortBy('recent');
    };

    const totalPages = Math.max(1, Math.ceil(filteredJobs.length / jobsPerPage));
    const paginatedJobs = filteredJobs.slice((currentPage - 1) * jobsPerPage, currentPage * jobsPerPage);

    if (loading) {
        return (
            <div className={`job-overview-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="job-overview-main">
                    <div className="job-overview-container">
                        <HRPageLoader variant="table" title="Chargement des offres..." />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={`job-overview-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="job-overview-main">
                <div className="job-overview-container">
                    <div className="page-header">
                        <div className="page-header-text">
                            <h2 className="page-title">Vue d'ensemble des Offres</h2>
                        </div>
                    </div>

                    <div className="search-bar-container">
                        <div className="search-box">
                            <span className="material-symbols-outlined search-icon">search</span>
                            <input
                                className="search-input"
                                type="text"
                                placeholder="Rechercher une offre a Tunis, Sfax..."
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                            />
                        </div>
                        <button
                            className={`btn btn-primary toolbar-button job-filter-toggle ${isFiltersOpen ? 'is-active' : ''}`}
                            onClick={() => setIsFiltersOpen((prev) => !prev)}
                        >
                            <span className="material-symbols-outlined">filter_list</span>
                            <span>Filtres{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}</span>
                        </button>
                        <button className="btn btn-primary toolbar-button" onClick={() => navigate('/hr/offres/new')}>
                            <span className="material-symbols-outlined">add</span>
                            <span>Ajouter une offre</span>
                        </button>
                    </div>

                    <div className="job-content-card">
                        <table className="jobs-table">
                            <thead>
                                <tr>
                                    <th>Titre du Job</th>
                                    <th>Departement</th>
                                    <th>Date de creation</th>
                                    <th>Candidats</th>
                                    <th>Statut</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {error ? (
                                    <tr>
                                        <td colSpan="6" className="text-center" style={{ padding: '3rem', color: '#ef4444' }}>
                                            {error}
                                        </td>
                                    </tr>
                                ) : filteredJobs.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center" style={{ padding: '3rem', color: 'var(--text-secondary)' }}>
                                            Aucune offre ne correspond a votre recherche.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedJobs.map((job) => {
                                        const candidateCount = Number(job.candidate_count ?? 0);

                                        return (
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
                                                        {departments[job.department_id] || 'Non assigne'}
                                                    </span>
                                                </td>
                                                <td className="job-date">{new Date(job.created_at).toLocaleDateString()}</td>
                                                <td>
                                                    <div className="candidates-stack">
                                                        <span className={candidateCount > 0 ? 'has-candidates' : 'no-candidates'}>
                                                            {candidateCount}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${job.status === 'published' ? 'open' : 'closed'}`}>
                                                        <span className="status-dot"></span>
                                                        {job.status === 'published' ? 'Publiee' : job.status === 'draft' ? 'Brouillon' : 'Interne'}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    <div className="table-actions">
                                                        <button
                                                            className="btn-icon delete"
                                                            title="Supprimer"
                                                            onClick={(event) => handleDeleteClick(event, job)}
                                                        >
                                                            <span className="material-symbols-outlined">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>

                        {filteredJobs.length > 0 && (
                            <div className="pagination-container">
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                    Precedent
                                </button>
                                <div className="pagination-numbers">
                                    {[...Array(totalPages)].map((_, index) => (
                                        <button
                                            key={index + 1}
                                            className={`pagination-number ${currentPage === index + 1 ? 'active' : ''}`}
                                            onClick={() => setCurrentPage(index + 1)}
                                        >
                                            {index + 1}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                >
                                    Suivant
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <div
                className={`job-filters-overlay ${isFiltersOpen ? 'is-open' : ''}`}
                onClick={() => setIsFiltersOpen(false)}
            />
            <aside className={`job-filters-drawer ${isFiltersOpen ? 'is-open' : ''}`}>
                <div className="job-filters-header">
                    <div>
                        <p className="job-filters-eyebrow">Affinage</p>
                        <h3 className="job-filters-title">Filtres des offres</h3>
                    </div>
                    <button
                        type="button"
                        className="job-filters-close"
                        onClick={() => setIsFiltersOpen(false)}
                        aria-label="Fermer les filtres"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="job-filters-body">
                    <div className="job-filter-group">
                        <label className="job-filter-label">Statut</label>
                        <select className="job-filter-select" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
                            <option value="all">Tous les statuts</option>
                            <option value="published">Publiees</option>
                            <option value="draft">Brouillons</option>
                            <option value="internal">Internes</option>
                        </select>
                    </div>

                    <div className="job-filter-group">
                        <label className="job-filter-label">Departement</label>
                        <select className="job-filter-select" value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}>
                            <option value="all">Tous les departements</option>
                            {departmentOptions.map((department) => (
                                <option key={department} value={department}>
                                    {department}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="job-filter-group">
                        <label className="job-filter-label">Localisation</label>
                        <select className="job-filter-select" value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)}>
                            <option value="all">Toutes les localisations</option>
                            {locationOptions.map((location) => (
                                <option key={location} value={location}>
                                    {location}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="job-filter-group">
                        <label className="job-filter-label">Nombre de candidats</label>
                        <select className="job-filter-select" value={candidateThreshold} onChange={(event) => setCandidateThreshold(event.target.value)}>
                            <option value="all">Tous les volumes</option>
                            <option value="0">Aucun candidat</option>
                            <option value="1-5">Entre 1 et 5</option>
                            <option value="6+">6 et plus</option>
                        </select>
                    </div>

                    <div className="job-filter-group">
                        <label className="job-filter-label">Tri</label>
                        <select className="job-filter-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                            <option value="recent">Plus recentes</option>
                            <option value="oldest">Plus anciennes</option>
                            <option value="title">Titre A-Z</option>
                            <option value="candidates">Plus de candidats</option>
                        </select>
                    </div>

                    <div className="job-filter-summary">
                        <span className="job-filter-summary-value">{filteredJobs.length}</span>
                        <span className="job-filter-summary-label">offres correspondent a vos filtres</span>
                    </div>
                </div>

                <div className="job-filters-footer">
                    <button type="button" className="btn btn-secondary job-filter-action" onClick={clearFilters}>
                        Reinitialiser
                    </button>
                    <button type="button" className="btn btn-primary job-filter-action" onClick={() => setIsFiltersOpen(false)}>
                        Appliquer
                    </button>
                </div>
            </aside>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Supprimer l'offre"
                message={`Etes-vous sur de vouloir supprimer l'offre "${jobToDelete?.title}" ? Cette action est irreversible et supprimera toutes les donnees associees.`}
                confirmText="Supprimer definitivement"
                cancelText="Annuler"
                type="danger"
            />
        </div>
    );
};

export default JobOverview;
