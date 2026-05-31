import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HRSidebar from "../../components/HRSidebar";
import { useTheme } from '../../context/ThemeContext';
import ConfirmationModal from '../../../../core/components/ConfirmationModal';
import { apiFetch } from '../../../../core/api';
import './DepartmentDetail.css';

const ROLE_LABELS = {
    chef_departement: 'Chef de département',
    recruiter: 'Recruteur',
    admin: 'Admin',
    hr: 'RH',
};

const JOB_STATUS = {
    published: { label: 'Actif', cls: 'active' },
    draft:     { label: 'Brouillon', cls: 'paused' },
    closed:    { label: 'Fermé', cls: 'closed' },
    paused:    { label: 'En pause', cls: 'paused' },
};

const getMemberName = (m) =>
    [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email || 'Membre';

const getInitials = (m) => {
    const parts = [m.first_name, m.last_name].filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (m.email || '?')[0].toUpperCase();
};

const JOBS_PER_PAGE = 5;

const DepartmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();

    const [department, setDepartment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [team, setTeam] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            try {
                const [deptData, jobsData, teamData] = await Promise.all([
                    apiFetch(`/departments/${id}`),
                    apiFetch(`/jobs/?department_id=${id}`),
                    apiFetch(`/profiles/?department_id=${id}`)
                ]);
                setDepartment(deptData);
                setJobs(jobsData || []);
                setTeam(teamData || []);
            } catch (err) {
                console.error('Error fetching department detail:', err);
                setError('Informations du département introuvables.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const totalPages = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
    const pagedJobs = jobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE);

    const confirmDelete = async () => {
        try {
            await apiFetch(`/departments/${id}`, { method: 'DELETE' });
            navigate('/hr/departement');
        } catch (err) {
            alert('Erreur lors de la suppression : ' + err.message);
        }
    };

    const isDark = effectiveTheme === 'dark';

    if (loading) {
        return (
            <div className={`dd-page ${isDark ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="dd-main dd-main--center">
                    <div className="dd-spinner">
                        <span className="material-symbols-outlined dd-spin">progress_activity</span>
                        <p>Chargement du département…</p>
                    </div>
                </main>
            </div>
        );
    }

    if (error || !department) {
        return (
            <div className={`dd-page ${isDark ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="dd-main dd-main--center">
                    <div className="dd-error-card">
                        <span className="material-symbols-outlined dd-error-icon">domain_disabled</span>
                        <h2>{error || 'Département introuvable'}</h2>
                        <button className="dd-btn dd-btn--ghost" onClick={() => navigate('/hr/departement')}>
                            <span className="material-symbols-outlined">arrow_back</span>
                            Retour à la liste
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    const activeJobs = jobs.filter(j => j.status === 'published').length;

    return (
        <div className={`dd-page ${isDark ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="dd-main">
                <div className="dd-container">

                    {/* ── Breadcrumb ── */}
                    <nav className="dd-breadcrumb">
                        <button className="dd-breadcrumb__link" onClick={() => navigate('/hr/departement')}>
                            Départements
                        </button>
                        <span className="dd-breadcrumb__sep material-symbols-outlined">chevron_right</span>
                        <span className="dd-breadcrumb__current">{department.name}</span>
                    </nav>

                    {/* ── Header ── */}
                    <header className="dd-header">
                        <div className="dd-header__left">
                            <div className={`dd-icon-box ${department.color || 'black'}`}>
                                <span className="material-symbols-outlined">{department.icon || 'group'}</span>
                            </div>
                            <div>
                                <h1 className="dd-title">{department.name}</h1>
                                {department.description && (
                                    <p className="dd-desc">{department.description}</p>
                                )}
                            </div>
                        </div>
                        <div className="dd-header__actions">
                            <button className="dd-btn dd-btn--ghost" onClick={() => navigate(`/hr/departement/${id}/edit`)}>
                                <span className="material-symbols-outlined">edit</span>
                                Modifier
                            </button>
                            <button className="dd-btn dd-btn--danger" onClick={() => setIsDeleteModalOpen(true)}>
                                <span className="material-symbols-outlined">delete</span>
                                Supprimer
                            </button>
                        </div>
                    </header>

                    {/* ── KPI Strip ── */}
                    <div className="dd-kpi-strip">
                        <div className="dd-kpi-card">
                            <div className="dd-kpi-card__icon dd-kpi-card__icon--blue">
                                <span className="material-symbols-outlined">work_outline</span>
                            </div>
                            <div>
                                <p className="dd-kpi-card__label">Postes actifs</p>
                                <p className="dd-kpi-card__value">{activeJobs}</p>
                            </div>
                        </div>
                        <div className="dd-kpi-card">
                            <div className="dd-kpi-card__icon dd-kpi-card__icon--purple">
                                <span className="material-symbols-outlined">folder_open</span>
                            </div>
                            <div>
                                <p className="dd-kpi-card__label">Total offres</p>
                                <p className="dd-kpi-card__value">{jobs.length}</p>
                            </div>
                        </div>
                        <div className="dd-kpi-card">
                            <div className="dd-kpi-card__icon dd-kpi-card__icon--teal">
                                <span className="material-symbols-outlined">groups</span>
                            </div>
                            <div>
                                <p className="dd-kpi-card__label">Membres</p>
                                <p className="dd-kpi-card__value">{team.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* ── Main layout ── */}
                    <div className="dd-layout">

                        {/* Jobs table */}
                        <section className="dd-section dd-section--main">
                            <div className="dd-section__header">
                                <h2 className="dd-section__title">Offres de poste</h2>
                                <span className="dd-badge">{jobs.length}</span>
                            </div>

                            <div className="dd-card">
                                {jobs.length > 0 ? (
                                    <>
                                        <table className="dd-table">
                                            <thead>
                                                <tr>
                                                    <th>Poste</th>
                                                    <th>Statut</th>
                                                    <th className="text-center">Candidats</th>
                                                    <th className="text-right">Créé le</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pagedJobs.map(job => {
                                                    const st = JOB_STATUS[job.status] || { label: job.status || 'Inconnu', cls: 'paused' };
                                                    return (
                                                        <tr key={job._id} className="dd-table__row">
                                                            <td>
                                                                <p className="dd-table__job-title">{job.title}</p>
                                                                <p className="dd-table__job-meta">{job.location || 'Remote'}</p>
                                                            </td>
                                                            <td>
                                                                <span className={`dd-status-badge dd-status-badge--${st.cls}`}>{st.label}</span>
                                                            </td>
                                                            <td className="text-center">
                                                                <span className="dd-table__count">{job.candidate_count ?? 0}</span>
                                                            </td>
                                                            <td className="text-right dd-table__date">
                                                                {job.created_at ? new Date(job.created_at).toLocaleDateString('fr-FR') : '—'}
                                                            </td>
                                                            <td>
                                                                <button
                                                                    className="dd-btn-icon"
                                                                    onClick={() => navigate(`/hr/offres/${job._id}`)}
                                                                    title="Voir l'offre"
                                                                >
                                                                    <span className="material-symbols-outlined">arrow_outward</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        {totalPages > 1 && (
                                            <div className="dd-pagination">
                                                <button
                                                    className="dd-pagination__btn"
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                >
                                                    <span className="material-symbols-outlined">chevron_left</span>
                                                </button>
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                                                    <button
                                                        key={n}
                                                        className={`dd-pagination__num ${currentPage === n ? 'active' : ''}`}
                                                        onClick={() => setCurrentPage(n)}
                                                    >
                                                        {n}
                                                    </button>
                                                ))}
                                                <button
                                                    className="dd-pagination__btn"
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={currentPage === totalPages}
                                                >
                                                    <span className="material-symbols-outlined">chevron_right</span>
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="dd-empty">
                                        <span className="material-symbols-outlined dd-empty__icon">work_off</span>
                                        <p>Aucune offre pour ce département.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Team sidebar */}
                        <aside className="dd-section dd-section--aside">
                            <div className="dd-section__header">
                                <h2 className="dd-section__title">Équipe RH</h2>
                                <span className="dd-badge">{team.length}</span>
                            </div>

                            <div className="dd-card dd-team-list">
                                {team.length > 0 ? (
                                    team.map(member => {
                                        const name = getMemberName(member);
                                        const initials = getInitials(member);
                                        const roleLabel = ROLE_LABELS[member.role] || member.role || '';
                                        return (
                                            <div key={member._id} className="dd-team-item">
                                                <div className="dd-avatar">
                                                    {member.avatar_url
                                                        ? <img src={member.avatar_url} alt={name} className="dd-avatar__img" />
                                                        : <span className="dd-avatar__initials">{initials}</span>
                                                    }
                                                </div>
                                                <div className="dd-team-item__meta">
                                                    <span className="dd-team-item__name">{name}</span>
                                                    <span className="dd-team-item__role">{roleLabel}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="dd-empty">
                                        <span className="material-symbols-outlined dd-empty__icon">group_off</span>
                                        <p>Aucun membre assigné.</p>
                                    </div>
                                )}
                            </div>
                        </aside>
                    </div>
                </div>
            </main>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Supprimer le département"
                message={`Êtes-vous sûr de vouloir supprimer "${department.name}" ? Les postes et membres associés seront désassignés.`}
                confirmText="Supprimer définitivement"
                cancelText="Annuler"
                type="danger"
            />
        </div>
    );
};

export default DepartmentDetail;
