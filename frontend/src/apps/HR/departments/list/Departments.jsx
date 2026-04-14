import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HRSidebar from "../../components/HRSidebar";
import HRPageLoader from "../../components/HRPageLoader";
import { useTheme } from '../../context/ThemeContext';
import { apiFetch } from '../../../../core/api';
import { supabase } from '../../../../core/supabaseClient';
import './Departments.css';

const Departments = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deptStats, setDeptStats] = useState({});
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [selectedDescriptionFilter, setSelectedDescriptionFilter] = useState('all');
    const [sortBy, setSortBy] = useState('name_asc');
    const sortRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const profile = await apiFetch(`/profiles/${session.user.id}`);
                    if (profile?.company_id) {
                        const [depts, jobs] = await Promise.all([
                            apiFetch(`/departments/?company_id=${profile.company_id}`),
                            apiFetch(`/jobs/?company_id=${profile.company_id}`)
                        ]);
                        setDepartments(depts);

                        const stats = {};
                        (depts || []).forEach((department) => {
                            const deptId = department?._id || department?.id;
                            if (!deptId) return;
                            const deptJobs = (jobs || []).filter((job) => String(job.department_id) === String(deptId));
                            const activeJobs = deptJobs.filter((job) => job.status === 'published').length;
                            const candidateCount = deptJobs.reduce((sum, job) => sum + Number(job.candidate_count ?? 0), 0);
                            stats[deptId] = {
                                activeJobs,
                                candidateCount,
                            };
                        });
                        setDeptStats(stats);
                    }
                }
            } catch (err) {
                console.error('Error fetching departments:', err);
                setError('Erreur lors du chargement des departements.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const onPointerDown = (event) => {
            if (sortRef.current && !sortRef.current.contains(event.target)) {
                setIsSortOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, []);

    const filteredDepartments = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();
        const list = departments.filter((department) => {
            const name = (department.name || '').toLowerCase();
            const description = (department.description || '').toLowerCase();
            const hasDescription = Boolean((department.description || '').trim());
            const matchesSearch = !search || name.includes(search) || description.includes(search);
            const matchesDescription =
                selectedDescriptionFilter === 'all' ||
                (selectedDescriptionFilter === 'with_description' && hasDescription) ||
                (selectedDescriptionFilter === 'without_description' && !hasDescription);
            return matchesSearch && matchesDescription;
        });

        const sorted = [...list];
        if (sortBy === 'name_desc') {
            sorted.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'fr'));
        } else if (sortBy === 'recent') {
            sorted.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
        } else if (sortBy === 'oldest') {
            sorted.sort((a, b) => new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0));
        } else {
            sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
        }

        return sorted;
    }, [departments, searchTerm, selectedDescriptionFilter, sortBy]);

    if (loading) {
        return (
            <div className={`departments-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="departments-main">
                    <HRPageLoader variant="table" title="Chargement des departements..." />
                </main>
            </div>
        );
    }

    return (
        <div className={`departments-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="departments-main">
                <header className="departments-header">
                    <div className="header-top-row"></div>

                    <div className="header-title-row">
                        <div className="title-content">
                            <h1 className="page-title">Departements</h1>
                            <p className="page-subtitle">
                                Gerez l'organisation de votre entreprise et suivez les recrutements par equipe.
                            </p>
                        </div>
                    </div>

                    <div className="departments-toolbar">
                        <div className="search-wrapper">
                            <span className="material-symbols-outlined search-icon">search</span>
                            <input
                                type="text"
                                placeholder="Filtrer les departements..."
                                className="search-input"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                            />
                        </div>
                        <div className="toolbar-actions">
                            <div className="toolbar-menu-wrap" ref={sortRef}>
                                <button
                                    className={`btn btn-secondary toolbar-btn toolbar-btn-contrast ${isSortOpen ? 'is-active' : ''}`}
                                    onClick={() => {
                                        setIsSortOpen((prev) => !prev);
                                    }}
                                >
                                    <span className="material-symbols-outlined">sort</span>
                                    Trier
                                </button>
                                {isSortOpen && (
                                    <div className="toolbar-menu">
                                        <p className="toolbar-menu-title">Ordre</p>
                                        <button className={`toolbar-option ${sortBy === 'name_asc' ? 'active' : ''}`} onClick={() => setSortBy('name_asc')}>
                                            Nom (A → Z)
                                        </button>
                                        <button className={`toolbar-option ${sortBy === 'name_desc' ? 'active' : ''}`} onClick={() => setSortBy('name_desc')}>
                                            Nom (Z → A)
                                        </button>
                                        <button className={`toolbar-option ${sortBy === 'recent' ? 'active' : ''}`} onClick={() => setSortBy('recent')}>
                                            Plus récents
                                        </button>
                                        <button className={`toolbar-option ${sortBy === 'oldest' ? 'active' : ''}`} onClick={() => setSortBy('oldest')}>
                                            Plus anciens
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </header>

                {error && (
                    <div className="error-banner card-glass" style={{ color: '#ef4444', padding: '1rem', margin: '0 2rem 2rem 2rem', borderLeft: '4px solid #ef4444' }}>
                        <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>error</span>
                        {error}
                    </div>
                )}

                <div className="departments-grid">
                    {filteredDepartments.map((department) => (
                        <div
                            key={department._id || department.id}
                            className="department-card-glass group"
                            onClick={() => navigate(`/hr/departement/${department._id || department.id}`)}
                        >
                            {(() => {
                                const deptId = department._id || department.id;
                                const stats = deptStats[deptId] || { activeJobs: 0, candidateCount: 0 };
                                const candidateCount = stats.candidateCount;
                                const activeJobs = stats.activeJobs;
                                return (
                                    <>
                            <div className="dept-card-header">
                                <div className={`dept-icon-box ${department.color || 'black'}`}>
                                    <span className="material-symbols-outlined">{department.icon || 'group'}</span>
                                </div>
                                <button className="btn-icon-soft">
                                    <span className="material-symbols-outlined">more_horiz</span>
                                </button>
                            </div>

                            <h3 className="dept-title">{department.name}</h3>
                            <p className="dept-desc">{department.description || 'Aucune description'}</p>

                            <div className="dept-footer">
                                <div className="team-avatars">
                                    <div className="avatar-circle" style={{ backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person</span>
                                    </div>
                                    <div className="avatar-counter">+{candidateCount}</div>
                                </div>
                                <div className={`status-badge ${activeJobs > 0 ? 'active' : 'inactive'}`}>
                                    {activeJobs} job{activeJobs > 1 ? 's' : ''} actifs
                                </div>
                            </div>
                                    </>
                                );
                            })()}
                        </div>
                    ))}

                    <div className="create-dept-card" onClick={() => navigate('/hr/departement/new')}>
                        <div className="create-icon-wrapper">
                            <span className="material-symbols-outlined">add</span>
                        </div>
                        <h3>Creer un departement</h3>
                        <p>Ajoutez une nouvelle equipe a votre organisation</p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Departments;
