import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../../../core/supabaseClient';
import { apiFetch, SERVER_URL } from '../../../core/api';
import { fetchPasswordPolicy, validatePassword } from '../../../core/passwordPolicy';
import SuperAdminSidebar from '../components/SuperAdminSidebar';
import { ToastContainer, useToast } from '../components/Toast';
import SuperAdminLoading from '../components/SuperAdminLoading';
import './UsersList.css';

/** Valeur réservée : ouvre la création d’entreprise (pas une vraie entreprise). */
const ADD_COMPANY_SELECT_VALUE = '__add_company__';

const UsersList = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const { toasts, addToast, removeToast } = useToast();
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
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isActionSubmitting, setIsActionSubmitting] = useState(false);

    // Dropdown state
    const [openDropdown, setOpenDropdown] = useState(null);
    const [selectedUserForDropdown, setSelectedUserForDropdown] = useState(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
    const [selectedUser, setSelectedUser] = useState(null);
    const dropdownRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'admin',
        companyId: '',
        departmentId: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [imgError, setImgError] = useState({});
    const [passwordPolicy, setPasswordPolicy] = useState(null);
    const [passwordError, setPasswordError] = useState('');

    useEffect(() => {
        fetchData();
        fetchPasswordPolicy().then(setPasswordPolicy);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdown(null);
                setSelectedUserForDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync formData when editing
    useEffect(() => {
        if (showEditModal && selectedUser) {
            setFormData({
                firstName: selectedUser.first_name || selectedUser.firstName || '',
                lastName: selectedUser.last_name || selectedUser.lastName || '',
                email: selectedUser.email || '',
                role: selectedUser.role || 'admin',
                companyId: selectedUser.company_id || selectedUser.companyId || '',
                departmentId: selectedUser.department_id || selectedUser.departmentId || ''
            });
        }
    }, [showEditModal, selectedUser]);

    const fetchData = async () => {
        setIsLoading(true);

        try {
            const [profilesData, companiesData, departmentsData] = await Promise.all([
                apiFetch('/profiles'),
                apiFetch('/companies'),
                apiFetch('/departments')
            ]);

            // Re-map MongoDB _id to id
            const mappedProfiles = profilesData.map(p => {
                const comp = companiesData.find(c => c._id === p.company_id);
                const dept = departmentsData.find(d => d._id === p.department_id);
                return {
                    ...p,
                    id: p._id,
                    company: comp ? { name: comp.name } : null,
                    department: dept ? { name: dept.name } : null
                };
            });

            setUsers(mappedProfiles);
            setCompanies(companiesData.map(c => ({ ...c, id: c._id })));
            setDepartments(departmentsData.map(d => ({ ...d, id: d._id })));
        } catch (error) {
            console.error('Error fetching data:', error);
            addToast('Erreur lors du chargement des données', 'error');
        } finally {
            // Smooth transition
            setTimeout(() => setIsLoading(false), 800);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        const pwdErr = validatePassword(formData.password, passwordPolicy);
        if (pwdErr) { setPasswordError(pwdErr); return; }
        setPasswordError('');
        setIsSubmitting(true);
        try {
            const tempSupabase = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false } }
            );

            const { data, error } = await tempSupabase.auth.signUp({
                email: formData.email,
                password: formData.password || 'TempPassword123!',
                options: {
                    data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        role: formData.role,
                        company_id: formData.companyId || null,
                        department_id: formData.departmentId || null
                    }
                }
            });

            if (error) throw error;

            const newUserId = data?.user?.id;
            if (!newUserId) throw new Error("Impossible de récupérer l'ID du nouvel utilisateur.");

            await apiFetch('/profiles', {
                method: 'POST',
                body: JSON.stringify({
                    id: newUserId,
                    email: formData.email,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    role: formData.role,
                    status: 'pending',
                    company_id: formData.companyId || null,
                    department_id: formData.departmentId || null,
                })
            });

            addToast('Utilisateur créé avec succès !', 'success');

            setShowModal(false);
            fetchData();
            setFormData({ firstName: '', lastName: '', email: '', password: '', role: 'admin', companyId: '', departmentId: '' });
        } catch (error) {
            addToast('Erreur lors de la création: ' + error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!selectedUser) return;
        setIsSubmitting(true);
        try {
            await apiFetch(`/profiles/${selectedUser.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    role: formData.role,
                    company_id: formData.companyId || null,
                    department_id: formData.departmentId || null
                })
            });

            addToast('Utilisateur mis à jour avec succès !', 'success');

            setShowEditModal(false);
            setSelectedUser(null);
            fetchData();
        } catch (error) {
            addToast('Erreur lors de la mise à jour: ' + error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        setIsActionSubmitting(true);
        try {
            await apiFetch(`/profiles/${selectedUser.id}`, {
                method: 'DELETE'
            });

            addToast('Utilisateur supprimé avec succès !', 'success');

            setShowDeleteModal(false);
            setSelectedUser(null);
            fetchData();
        } catch (error) {
            addToast('Erreur lors de la suppression: ' + error.message, 'error');
        } finally {
            setIsActionSubmitting(false);
        }
    };

    const openActionMenu = (e, user) => {
        e.stopPropagation();
        if (openDropdown === user.id) {
            setOpenDropdown(null);
            setSelectedUserForDropdown(null);
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        setDropdownPos({
            top: rect.bottom + window.scrollY + 6,
            right: window.innerWidth - rect.right
        });
        setSelectedUserForDropdown(user);
        setOpenDropdown(user.id);
    };

    const openAddModal = () => {
        setFormData({
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            role: 'admin',
            companyId: '',
            departmentId: ''
        });
        setShowPassword(false);
        setPasswordError('');
        setSelectedUser(null);
        setShowModal(true);
    };

    const openEditModal = (user) => {
        setSelectedUser(user);
        setFormData({
            firstName: user.first_name || user.firstName || '',
            lastName: user.last_name || user.lastName || '',
            email: user.email || '',
            password: '',
            role: user.role || 'admin',
            companyId: user.company_id || user.companyId || '',
            departmentId: user.department_id || user.departmentId || ''
        });
        setShowPassword(false);
        setShowEditModal(true);
        setOpenDropdown(null);
    };

    const openDeleteModal = (user) => {
        setSelectedUser(user);
        setShowDeleteModal(true);
        setOpenDropdown(null);
    };

    const filteredUsers = users.filter(user => {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesCompany = companyFilter === 'all' || user.company_id === companyFilter;
        return matchesSearch && matchesRole && matchesCompany;
    });

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    if (isLoading) return <SuperAdminLoading />;

    return (
        <>
            <div className={`sa-users-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <SuperAdminSidebar />

                <main className="sa-users-main">
                    <div className="sa-users-container">
                        <header className="page-header">
                            <div className="header-content">
                                <h1 className="page-title">Gestion des Utilisateurs</h1>
                                <p className="page-subtitle">{filteredUsers.length} utilisateurs sur la plateforme</p>
                            </div>
                            <button className="btn-primary" onClick={openAddModal}>
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
                                        <th className="text-center">Entreprise</th>
                                        <th className="text-center">Département</th>
                                        <th className="text-center">Rôle</th>
                                        <th className="text-center">Statut</th>
                                        <th className="text-center">Création</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="text-center py-8">Aucun utilisateur trouvé</td>
                                        </tr>
                                    ) : paginatedUsers.map(user => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="user-cell">
                                                    <div className="user-avatar">
                                                    {user.avatar_url && !imgError[user.id] ? (
                                                        <img
                                                            src={`${SERVER_URL}${user.avatar_url}`}
                                                            alt=""
                                                            className="user-avatar-img"
                                                            onError={() => setImgError(prev => ({ ...prev, [user.id]: true }))}
                                                        />
                                                    ) : (user.first_name || 'U')[0]}
                                                </div>
                                                    <div className="user-info">
                                                        <span className="user-name">{user.first_name} {user.last_name}</span>
                                                        <span className="user-email">{user.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-center">{user.companies?.name || user.company?.name || 'Indépendant'}</td>
                                            <td className="text-center">{user.departments?.name || user.department?.name || '-'}</td>
                                            <td className="text-center">
                                                <span className={`role-badge role-${user.role.toLowerCase()}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <span className={`status-badge ${user.status === 'active' ? 'status-success' : user.status === 'pending' ? 'status-pending' : 'status-inactive'}`}>
                                                    {user.status === 'active' ? 'Actif' : user.status === 'pending' ? 'En attente' : 'Inactif'}
                                                </span>
                                            </td>
                                            <td className="text-center date-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                                            <td className="actions-cell text-center">
                                                <button
                                                    className={`action-btn ${openDropdown === user.id ? 'active' : ''}`}
                                                    onClick={(e) => openActionMenu(e, user)}
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
                    {(showModal || showEditModal) && (
                        <div className="modal-overlay">
                            <div className="modal-card">
                                <div className="modal-header">
                                    <div className="modal-header-content">
                                        <div className="modal-icon">
                                            <span className="material-symbols-outlined">{showEditModal ? 'edit' : 'person_add'}</span>
                                        </div>
                                        <h2 className="modal-title">{showEditModal ? 'Modifier l\'utilisateur' : 'Nouvel Utilisateur'}</h2>
                                        <p className="modal-subtitle">
                                            {showEditModal ? 'Mettre à jour les informations du profil' : 'Créer un compte pour un nouveau membre de l\'équipe'}
                                        </p>
                                    </div>
                                    <button className="close-btn" onClick={() => {
                                        setShowModal(false);
                                        setShowEditModal(false);
                                        setSelectedUser(null);
                                        setFormData({ firstName: '', lastName: '', email: '', password: '', role: 'admin', companyId: '', departmentId: '' });
                                        setShowPassword(false);
                                    }}>
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                <form onSubmit={showEditModal ? handleUpdateUser : handleAddUser}>
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
                                                disabled={showEditModal}
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="prenom.utilisateur@organisation.com"
                                            />
                                        </div>

                                        {!showEditModal && (
                                            <div className="form-group">
                                                <label>
                                                    <span className="material-symbols-outlined">lock</span>
                                                    Mot de passe <i className="required-star">*</i>
                                                </label>
                                                <div className="password-input-wrapper">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        required
                                                        value={formData.password}
                                                        onChange={(e) => {
                                                            setFormData({ ...formData, password: e.target.value });
                                                            setPasswordError('');
                                                        }}
                                                        placeholder={`Min. ${passwordPolicy?.minPasswordLength ?? 16} caractères`}
                                                        style={passwordError ? { borderColor: '#ef4444' } : {}}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="password-toggle-btn"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                    >
                                                        <span className="material-symbols-outlined">
                                                            {showPassword ? 'visibility_off' : 'visibility'}
                                                        </span>
                                                    </button>
                                                </div>
                                                {passwordError && (
                                                    <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '4px' }}>
                                                        {passwordError}
                                                    </p>
                                                )}
                                            </div>
                                        )}

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
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (v === ADD_COMPANY_SELECT_VALUE) {
                                                            navigate('/superadmin/companies', {
                                                                state: { openCreateCompanyModal: true },
                                                            });
                                                            setShowModal(false);
                                                            setShowEditModal(false);
                                                            addToast(
                                                                'Créez l’entreprise sur la page suivante, puis revenez ici pour finaliser l’utilisateur.',
                                                                'info',
                                                            );
                                                            return;
                                                        }
                                                        setFormData({ ...formData, companyId: v, departmentId: '' });
                                                    }}
                                                >
                                                    <option value="">Sélectionner...</option>
                                                    {companies.map((c) => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                    {!showEditModal && (
                                                        <option value={ADD_COMPANY_SELECT_VALUE}>
                                                            + Ajouter une entreprise…
                                                        </option>
                                                    )}
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
                                        <button type="button" className="btn-secondary" onClick={() => {
                                            setShowModal(false);
                                            setShowEditModal(false);
                                            setSelectedUser(null);
                                            setFormData({ firstName: '', lastName: '', email: '', password: '', role: 'admin', companyId: '', departmentId: '' });
                                            setShowPassword(false);
                                        }}>Annuler</button>
                                        <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                            <span className="material-symbols-outlined">{isSubmitting ? 'hourglass_empty' : (showEditModal ? 'save' : 'person_add')}</span>
                                            {isSubmitting ? 'Traitement...' : (showEditModal ? 'Sauvegarder' : 'Créer l\'utilisateur')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Dropdown Portal */}
                    {openDropdown !== null && selectedUserForDropdown && createPortal(
                        <div
                            ref={dropdownRef}
                            className={`action-dropdown-portal ${effectiveTheme === 'dark' ? 'dark' : ''}`}
                            style={{ top: dropdownPos.top, right: dropdownPos.right }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button className="dropdown-item" onClick={() => openEditModal(selectedUserForDropdown)}>
                                <span className="material-symbols-outlined">edit</span>
                                <span>Modifier</span>
                            </button>
                            <div className="dropdown-divider" />
                            <button className="dropdown-item danger" onClick={() => openDeleteModal(selectedUserForDropdown)}>
                                <span className="material-symbols-outlined">delete</span>
                                <span>Supprimer</span>
                            </button>
                        </div>,
                        document.body
                    )}

                    {/* Delete Confirmation Modal */}
                    {showDeleteModal && selectedUser && (
                        <div className="modal-overlay">
                            <div className="confirm-modal">
                                <div className="confirm-modal-header danger">
                                    <span className="material-symbols-outlined">warning</span>
                                    <h3>Supprimer l'utilisateur ?</h3>
                                </div>
                                <div className="confirm-modal-body">
                                    <p>Êtes-vous sûr de vouloir supprimer <strong>{selectedUser.first_name} {selectedUser.last_name}</strong> ?</p>
                                    <p className="warning-text">Cette action supprimera son profil définitivement.</p>
                                </div>
                                <div className="confirm-modal-footer">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => { setShowDeleteModal(false); setSelectedUser(null); }}
                                        disabled={isActionSubmitting}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        className="btn-danger"
                                        onClick={handleDeleteUser}
                                        disabled={isActionSubmitting}
                                    >
                                        {isActionSubmitting ? 'Suppression...' : 'Supprimer'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
    );
};

export default UsersList;
