import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../../../core/supabaseClient';
import SuperAdminSidebar from '../components/SuperAdminSidebar';
import './UsersList.css';

const UsersList = () => {
    const { effectiveTheme } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [companyFilter, setCompanyFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        role: 'admin',
        companyId: '',
        departmentId: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);

        // Use explicit FK hints to avoid "more than one relationship" errors
        // profiles -> companies via profiles.company_id
        // profiles -> departments via profiles.department_id (not the other direction)
        const [profilesRes, companiesRes, departmentsRes] = await Promise.all([
            supabase.from('profiles').select('*, companies!profiles_company_id_fkey(name), departments!profiles_department_id_fkey(name)'),
            supabase.from('companies').select('id, name'),
            supabase.from('departments').select('id, name, company_id')
        ]);

        if (profilesRes.error) {
            console.error('Error fetching profiles:', profilesRes.error);
        } else {
            setUsers(profilesRes.data || []);
        }

        if (companiesRes.error) {
            console.error('Error fetching companies:', companiesRes.error);
        } else {
            setCompanies(companiesRes.data || []);
        }

        if (departmentsRes.error) {
            console.error('Error fetching departments:', departmentsRes.error);
        } else {
            setDepartments(departmentsRes.data || []);
        }

        setIsLoading(false);
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // 1. Create User in Supabase Auth
            // For now, we use a simple signup. In a real app, this might be handled by an Edge Function
            // if we want to bypass auto-login or send custom invites.
            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: 'TempPassword123!', // User should change this
                options: {
                    data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        role: formData.role,
                        company_id: formData.companyId,
                        department_id: formData.departmentId
                    }
                }
            });

            if (error) throw error;

            alert('Utilisateur créé avec succès !');
            setShowModal(false);
            fetchData();
            setFormData({ firstName: '', lastName: '', email: '', role: 'admin', companyId: '', departmentId: '' });
        } catch (error) {
            alert('Erreur lors de la création: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredUsers = users.filter(user => {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesCompany = companyFilter === 'all' || user.company_id === companyFilter;
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
                        <button className="btn-primary" onClick={() => setShowModal(true)}>
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
                            <option value="admin">Administrateur</option>
                            <option value="recruiter">Recruteur</option>
                            <option value="chef_departement">Chef de Département</option>
                            <option value="superadmin">SuperAdmin</option>
                        </select>
                        <select className="filter-select" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                            <option value="all">Toutes les entreprises</option>
                            {companies.map(company => (
                                <option key={company.id} value={company.id}>{company.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="table-card">
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Utilisateur</th>
                                    <th>Entreprise</th>
                                    <th>Département</th>
                                    <th>Rôle</th>
                                    <th>Statut</th>
                                    <th>Création</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8">Chargement des utilisateurs...</td>
                                    </tr>
                                ) : paginatedUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8">Aucun utilisateur trouvé</td>
                                    </tr>
                                ) : paginatedUsers.map(user => (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-avatar">{(user.first_name || 'U')[0]}</div>
                                                <div className="user-info">
                                                    <span className="user-name">{user.first_name} {user.last_name}</span>
                                                    <span className="user-email">{user.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{user.companies?.name || user.company?.name || 'Indépendant'}</td>
                                        <td>{user.departments?.name || user.department?.name || '-'}</td>
                                        <td>
                                            <span className={`role-badge role-${user.role.toLowerCase()}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${user.status === 'active' ? 'status-success' : user.status === 'pending' ? 'status-pending' : 'status-inactive'}`}>
                                                {user.status === 'active' ? 'Actif' : user.status === 'pending' ? 'En attente' : 'Inactif'}
                                            </span>
                                        </td>
                                        <td className="date-cell">{new Date(user.created_at).toLocaleDateString()}</td>
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
                {/* New User Modal */}
                {showModal && (
                    <div className="modal-overlay">
                        <div className="modal-card">
                            <div className="modal-header">
                                <div className="modal-header-content">
                                    <div className="modal-icon">
                                        <span className="material-symbols-outlined">person_add</span>
                                    </div>
                                    <h2 className="modal-title">Nouvel Utilisateur</h2>
                                    <p className="modal-subtitle">Créer un compte pour un nouveau membre de l'équipe</p>
                                </div>
                                <button className="close-btn" onClick={() => setShowModal(false)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <form onSubmit={handleAddUser}>
                                <div className="modal-body">
                                    <p className="form-section-label">Identité</p>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>
                                                <span className="material-symbols-outlined">badge</span>
                                                Prénom <i className="required-star">*</i>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.firstName}
                                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                placeholder="Prénom du collaborateur"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>
                                                <span className="material-symbols-outlined">badge</span>
                                                Nom <i className="required-star">*</i>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.lastName}
                                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                                placeholder="Nom du collaborateur"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <span className="material-symbols-outlined">mail</span>
                                            Email professionnel <i className="required-star">*</i>
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="prenom.utilisateur@organisation.com"
                                        />
                                    </div>

                                    <p className="form-section-label">Rôle & Affectation</p>
                                    <div className="form-group">
                                        <label>
                                            <span className="material-symbols-outlined">admin_panel_settings</span>
                                            Rôle
                                        </label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        >
                                            <option value="admin">Administrateur</option>
                                            <option value="recruiter">Recruteur</option>
                                            <option value="chef_departement">Chef de département</option>
                                        </select>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>
                                                <span className="material-symbols-outlined">business</span>
                                                Entreprise <i className="required-star">*</i>
                                            </label>
                                            <select
                                                required
                                                value={formData.companyId}
                                                onChange={(e) => setFormData({ ...formData, companyId: e.target.value, departmentId: '' })}
                                            >
                                                <option value="">Sélectionner...</option>
                                                {companies.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>
                                                <span className="material-symbols-outlined">apartment</span>
                                                Département
                                            </label>
                                            <select
                                                value={formData.departmentId}
                                                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                                disabled={!formData.companyId}
                                            >
                                                <option value="">Optionnel</option>
                                                {departments.filter(d => d.company_id === formData.companyId).map(d => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                                    <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                        <span className="material-symbols-outlined">{isSubmitting ? 'hourglass_empty' : 'person_add'}</span>
                                        {isSubmitting ? 'Création...' : 'Créer l\'utilisateur'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default UsersList;
