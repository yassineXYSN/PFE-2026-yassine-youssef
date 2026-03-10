import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HRSidebar from "../../components/HRSidebar";
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const profile = await apiFetch(`/profiles/${session.user.id}`);
                    if (profile?.company_id) {
                        const depts = await apiFetch(`/departments/?company_id=${profile.company_id}`);
                        setDepartments(depts);
                    }
                }
            } catch (err) {
                console.error("Error fetching departments:", err);
                setError("Erreur lors du chargement des départements.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredDepartments = departments.filter(dept =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className={`departments-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="departments-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loading-spinner">Chargement des départements...</div>
                </main>
            </div>
        );
    }

    return (
        <div className={`departments-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="departments-main">
                {/* Header Section */}
                <header className="departments-header">
                    <div className="header-top-row"></div>

                    <div className="header-title-row">
                        <div className="title-content">
                            <h1 className="page-title">Départements</h1>
                            <p className="page-subtitle">
                                Gérez l'organisation de votre entreprise et suivez les recrutements par équipe. Vous avez {departments.length} départements actifs.
                            </p>
                        </div>
                        <button className="btn btn-primary glow-effect" onClick={() => navigate('/hr/departement/new')}>
                            <span className="material-symbols-outlined">add</span>
                            Nouveau département
                        </button>
                    </div>

                    {/* Filters Toolbar */}
                    <div className="departments-toolbar">
                        <div className="search-wrapper">
                            <span className="material-symbols-outlined search-icon">search</span>
                            <input
                                type="text"
                                placeholder="Filtrer les départements..."
                                className="search-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="toolbar-actions">
                            <button className="btn btn-secondary">
                                <span className="material-symbols-outlined">filter_list</span>
                                Filtres
                            </button>
                            <button className="btn btn-secondary">
                                <span className="material-symbols-outlined">sort</span>
                                Trier
                            </button>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="error-banner card-glass" style={{ color: '#ef4444', padding: '1rem', margin: '0 2rem 2rem 2rem', borderLeft: '4px solid #ef4444' }}>
                        <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>error</span>
                        {error}
                    </div>
                )}

                {/* Grid Content */}
                <div className="departments-grid">
                    {filteredDepartments.map(dept => (
                        <div key={dept._id || dept.id} className="department-card-glass group" onClick={() => navigate(`/hr/departement/${dept._id || dept.id}`)}>
                            <div className="dept-card-header">
                                <div className={`dept-icon-box ${dept.color || 'black'}`}>
                                    <span className="material-symbols-outlined">{dept.icon || 'group'}</span>
                                </div>
                                <button className="btn-icon-soft">
                                    <span className="material-symbols-outlined">more_horiz</span>
                                </button>
                            </div>

                            <h3 className="dept-title">{dept.name}</h3>
                            <p className="dept-desc">{dept.description || 'Aucune description'}</p>

                            <div className="dept-footer">
                                <div className="team-avatars">
                                    {/* Placeholder for real team members if ever added */}
                                    <div className="avatar-circle" style={{ backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person</span>
                                    </div>
                                    <div className="avatar-counter">+0</div>
                                </div>
                                <div className={`status-badge inactive`}>
                                    0 jobs actifs
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Add New Card Placeholder */}
                    <div className="create-dept-card" onClick={() => navigate('/hr/departement/new')}>
                        <div className="create-icon-wrapper">
                            <span className="material-symbols-outlined">add</span>
                        </div>
                        <h3>Créer un département</h3>
                        <p>Ajoutez une nouvelle équipe à votre organisation</p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Departments;
