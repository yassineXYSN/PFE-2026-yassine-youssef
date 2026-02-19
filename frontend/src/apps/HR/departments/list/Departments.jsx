import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HRSidebar from "../../components/HRSidebar";
import { useTheme } from '../../context/ThemeContext';
import './Departments.css';

const Departments = () => {
    const { effectiveTheme } = useTheme();

    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    // Mock Data based on HTML
    const departments = [
        {
            id: 1,
            name: 'Ingénierie & Tech',
            description: 'Développement backend, frontend, DevOps.',
            icon: 'terminal',
            colorClass: 'blue',
            stats: { activeJobs: 5, teamCount: 12 },
            team: [
                'https://i.pravatar.cc/150?u=1',
                'https://i.pravatar.cc/150?u=2'
            ]
        },
        {
            id: 2,
            name: 'Marketing',
            description: 'Communication, Growth, Branding.',
            icon: 'campaign',
            colorClass: 'purple',
            stats: { activeJobs: 2, teamCount: 4 },
            team: [
                'https://i.pravatar.cc/150?u=3'
            ]
        },
        {
            id: 3,
            name: 'Ressources Humaines',
            description: 'Recrutement, Culture, Admin RH.',
            icon: 'diversity_3',
            colorClass: 'pink',
            stats: { activeJobs: 1, teamCount: 3 },
            team: [
                'https://i.pravatar.cc/150?u=4',
                'https://i.pravatar.cc/150?u=5'
            ]
        },
        {
            id: 4,
            name: 'Ventes & Business',
            description: 'SDR, Account Executive, CSM.',
            icon: 'trending_up',
            colorClass: 'orange',
            stats: { activeJobs: 0, teamCount: 8 },
            team: [
                'https://i.pravatar.cc/150?u=6'
            ]
        },
        {
            id: 5,
            name: 'Produit & Design',
            description: 'Product Management, UX/UI.',
            icon: 'lightbulb',
            colorClass: 'teal',
            stats: { activeJobs: 3, teamCount: 5 },
            team: [
                'https://i.pravatar.cc/150?u=7',
                'https://i.pravatar.cc/150?u=8'
            ]
        },
        {
            id: 6,
            name: 'Finance & Légal',
            description: 'Comptabilité, Juridique, Compliance.',
            icon: 'account_balance',
            colorClass: 'indigo',
            stats: { activeJobs: 0, teamCount: 2 },
            team: [
                'https://i.pravatar.cc/150?u=9'
            ]
        }
    ];

    const filteredDepartments = departments.filter(dept =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={`departments-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="departments-main">
                {/* Header Section */}
                <header className="departments-header">
                    <div className="header-top-row">

                    </div>

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

                {/* Grid Content */}
                <div className="departments-grid">
                    {filteredDepartments.map(dept => (
                        <div key={dept.id} className="department-card-glass group" onClick={() => navigate(`/hr/departement/${dept.id}`)}>
                            <div className="dept-card-header">
                                <div className={`dept-icon-box ${dept.colorClass}`}>
                                    <span className="material-symbols-outlined">{dept.icon}</span>
                                </div>
                                <button className="btn-icon-soft">
                                    <span className="material-symbols-outlined">more_horiz</span>
                                </button>
                            </div>

                            <h3 className="dept-title">{dept.name}</h3>
                            <p className="dept-desc">{dept.description}</p>

                            <div className="dept-footer">
                                <div className="team-avatars">
                                    {dept.team.map((avatar, idx) => (
                                        <img key={idx} src={avatar} alt="Team member" className="avatar-circle" />
                                    ))}
                                    <div className="avatar-counter">+{dept.stats.teamCount}</div>
                                </div>
                                <div className={`status-badge ${dept.stats.activeJobs > 0 ? 'active' : 'inactive'}`}>
                                    {dept.stats.activeJobs} jobs actifs
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
