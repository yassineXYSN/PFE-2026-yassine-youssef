import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import SuperAdminSidebar from '../../components/SuperAdminSidebar';
import './CompaniesList.css';

const CompaniesList = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const companies = [
        {
            id: 1,
            name: 'TechNova Solutions',
            sector: 'Technologie',
            status: 'active',
            users: 45,
            jobs: 23,
            createdAt: '15 Jan 2024',
            plan: 'Premium'
        },
        {
            id: 2,
            name: 'Digital Corp',
            sector: 'Marketing',
            status: 'active',
            users: 38,
            jobs: 19,
            createdAt: '08 Jan 2024',
            plan: 'Standard'
        },
        {
            id: 3,
            name: 'StartupX',
            sector: 'Finance',
            status: 'suspended',
            users: 12,
            jobs: 5,
            createdAt: '22 Dec 2023',
            plan: 'Basic'
        },
        {
            id: 4,
            name: 'InnoLabs',
            sector: 'R&D',
            status: 'active',
            users: 32,
            jobs: 15,
            createdAt: '10 Dec 2023',
            plan: 'Premium'
        },
        {
            id: 5,
            name: 'CloudSystems',
            sector: 'Cloud Computing',
            status: 'active',
            users: 28,
            jobs: 12,
            createdAt: '05 Dec 2023',
            plan: 'Standard'
        },
        {
            id: 6,
            name: 'DataTech',
            sector: 'Data Science',
            status: 'trial',
            users: 10,
            jobs: 3,
            createdAt: '01 Feb 2024',
            plan: 'Trial'
        },
    ];

    const filteredCompanies = companies.filter(company => {
        const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            company.sector.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' || company.status === filter;
        return matchesSearch && matchesFilter;
    });

    // Pagination
    const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCompanies = filteredCompanies.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'active': return 'status-success';
            case 'suspended': return 'status-danger';
            case 'trial': return 'status-warning';
            default: return '';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'active': return 'Actif';
            case 'suspended': return 'Suspendu';
            case 'trial': return 'Essai';
            default: return status;
        }
    };

    return (
        <div className={`sa-companies-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <SuperAdminSidebar />

            <main className="sa-companies-main">
                <div className="sa-companies-container">
                    {/* Header */}
                    <header className="page-header">
                        <div className="header-content">
                            <h1 className="page-title">Gestion des Entreprises</h1>
                            <p className="page-subtitle">
                                Gérez toutes les entreprises de la plateforme ({filteredCompanies.length} entreprises)
                            </p>
                        </div>
                        <button className="btn-primary" onClick={() => navigate('/superadmin/companies/create')}>
                            <span className="material-symbols-outlined">add</span>
                            Nouvelle Entreprise
                        </button>
                    </header>

                    {/* Filters */}
                    <div className="filters-bar">
                        <div className="search-wrapper">
                            <span className="material-symbols-outlined search-icon">search</span>
                            <input
                                type="text"
                                placeholder="Rechercher une entreprise..."
                                className="search-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="filter-tabs">
                            <button
                                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                                onClick={() => setFilter('all')}
                            >
                                Toutes
                            </button>
                            <button
                                className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
                                onClick={() => setFilter('active')}
                            >
                                Actives
                            </button>
                            <button
                                className={`filter-tab ${filter === 'suspended' ? 'active' : ''}`}
                                onClick={() => setFilter('suspended')}
                            >
                                Suspendues
                            </button>
                            <button
                                className={`filter-tab ${filter === 'trial' ? 'active' : ''}`}
                                onClick={() => setFilter('trial')}
                            >
                                Essai
                            </button>
                        </div>
                    </div>

                    {/* Companies Table */}
                    <div className="table-card">
                        <table className="companies-table">
                            <thead>
                                <tr>
                                    <th>Entreprise</th>
                                    <th>Secteur</th>
                                    <th className="text-center">Utilisateurs</th>
                                    <th className="text-center">Offres</th>
                                    <th>Plan</th>
                                    <th>Statut</th>
                                    <th>Créée le</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedCompanies.map(company => (
                                    <tr key={company.id} onClick={() => navigate(`/superadmin/companies/${company.id}`)}>
                                        <td>
                                            <div className="company-cell">
                                                <div className="company-logo">{company.name[0]}</div>
                                                <span className="company-name">{company.name}</span>
                                            </div>
                                        </td>
                                        <td className="sector-cell">{company.sector}</td>
                                        <td className="text-center">
                                            <span className="count-badge">{company.users}</span>
                                        </td>
                                        <td className="text-center">
                                            <span className="count-badge">{company.jobs}</span>
                                        </td>
                                        <td>
                                            <span className={`plan-badge plan-${company.plan.toLowerCase()}`}>
                                                {company.plan}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${getStatusClass(company.status)}`}>
                                                {getStatusLabel(company.status)}
                                            </span>
                                        </td>
                                        <td className="date-cell">{company.createdAt}</td>
                                        <td className="actions-cell text-center">
                                            <button
                                                className="action-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Action menu
                                                }}
                                            >
                                                <span className="material-symbols-outlined">more_vert</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination-container">
                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                    Précédent
                                </button>

                                <div className="pagination-numbers">
                                    {[...Array(totalPages)].map((_, index) => {
                                        const page = index + 1;
                                        // Show first page, last page, current page, and pages around current
                                        if (
                                            page === 1 ||
                                            page === totalPages ||
                                            (page >= currentPage - 1 && page <= currentPage + 1)
                                        ) {
                                            return (
                                                <button
                                                    key={page}
                                                    className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                                                    onClick={() => handlePageChange(page)}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                                            return <span key={page} className="pagination-dots">...</span>;
                                        }
                                        return null;
                                    })}
                                </div>

                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    Suivant
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CompaniesList;
