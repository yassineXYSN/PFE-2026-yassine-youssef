import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import SuperAdminSidebar from '../components/SuperAdminSidebar';
import './UsersList.css';

const UsersList = () => {
    const { effectiveTheme } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [companyFilter, setCompanyFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const users = [
        { id: 1, name: 'Marie Dubois', email: 'marie@technova.com', role: 'Admin', company: 'TechNova Solutions', status: 'active', lastActive: '2 min' },
        { id: 2, name: 'Jean Martin', email: 'jean@digitalcorp.com', role: 'Recruiter', company: 'Digital Corp', status: 'active', lastActive: '15 min' },
        { id: 3, name: 'Sophie Bernard', email: 'sophie@startupx.com', role: 'Manager', company: 'StartupX', status: 'inactive', lastActive: '2 days' },
        { id: 4, name: 'Pierre Leroy', email: 'pierre@innolabs.com', role: 'Recruiter', company: 'InnoLabs', status: 'active', lastActive: '1 hour' },
        { id: 5, name: 'Claire Petit', email: 'claire@cloudsystems.com', role: 'Admin', company: 'CloudSystems', status: 'active', lastActive: '30 min' },
        { id: 6, name: 'Thomas Roux', email: 'thomas@datatech.com', role: 'Recruiter', company: 'DataTech', status: 'active', lastActive: '5 min' },
    ];

    const companies = ['TechNova Solutions', 'Digital Corp', 'StartupX', 'InnoLabs', 'CloudSystems', 'DataTech'];

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesCompany = companyFilter === 'all' || user.company === companyFilter;
        return matchesSearch && matchesRole && matchesCompany;
    });

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    return (
        <div className={`sa-users-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <SuperAdminSidebar />

            <main className="sa-users-main">
                <div className="sa-users-container">
                    <header className="page-header">
                        <div className="header-content">
                            <h1 className="page-title">Gestion des Utilisateurs</h1>
                            <p className="page-subtitle">{filteredUsers.length} utilisateurs sur la plateforme</p>
                        </div>
                        <button className="btn-primary">
                            <span className="material-symbols-outlined">person_add</span>
                            Nouvel Utilisateur
                        </button>
                    </header>

                    <div className="filters-section">
                        <div className="search-wrapper">
                            <span className="material-symbols-outlined search-icon">search</span>
                            <input
                                type="text"
                                placeholder="Rechercher un utilisateur..."
                                className="search-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select className="filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                            <option value="all">Tous les rôles</option>
                            <option value="Admin">Admin</option>
                            <option value="Recruiter">Recruteur</option>
                            <option value="Manager">Manager</option>
                        </select>
                        <select className="filter-select" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                            <option value="all">Toutes les entreprises</option>
                            {companies.map(company => (
                                <option key={company} value={company}>{company}</option>
                            ))}
                        </select>
                    </div>

                    <div className="table-card">
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Utilisateur</th>
                                    <th>Entreprise</th>
                                    <th>Rôle</th>
                                    <th>Statut</th>
                                    <th>Dernière activité</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedUsers.map(user => (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-avatar">{user.name[0]}</div>
                                                <div className="user-info">
                                                    <span className="user-name">{user.name}</span>
                                                    <span className="user-email">{user.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{user.company}</td>
                                        <td>
                                            <span className={`role-badge role-${user.role.toLowerCase()}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${user.status === 'active' ? 'status-success' : 'status-inactive'}`}>
                                                {user.status === 'active' ? 'Actif' : 'Inactif'}
                                            </span>
                                        </td>
                                        <td className="date-cell">{user.lastActive}</td>
                                        <td className="actions-cell text-center">
                                            <button className="action-btn">
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

export default UsersList;
