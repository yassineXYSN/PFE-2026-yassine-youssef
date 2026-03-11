import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { apiFetch, SERVER_URL } from '../../../../core/api';
import SuperAdminSidebar from '../../components/SuperAdminSidebar';
import { ToastContainer, useToast } from '../../components/Toast';
import './CompaniesList.css';

const CompaniesList = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const { toasts, addToast, removeToast } = useToast();

    // Helper to get full image URL
    const getFullImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('blob:') || path.startsWith('http')) return path;
        return `${SERVER_URL}${path}`;
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const [companies, setCompanies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Dropdown & action state
    const [openDropdown, setOpenDropdown] = useState(null);
    const [selectedCompanyForDropdown, setSelectedCompanyForDropdown] = useState(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [isActionSubmitting, setIsActionSubmitting] = useState(false);
    const dropdownRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        sector: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        city: '',
        zip_code: '',
        country: 'France'
    });

    useEffect(() => {
        fetchCompanies();
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdown(null);
                setSelectedCompanyForDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);



    const fetchCompanies = async () => {
        setIsLoading(true);
        try {
            const data = await apiFetch('/companies');
            // The API returns the raw data. We need to map it for the UI
            const transformedData = data.map(company => ({
                ...company,
                id: company._id, // Map MongoDB _id to id for the frontend
                users: company.users_count || 0,
                jobs: company.jobs_count || 0,
                plan: 'Standard',
                createdAt: new Date(company.created_at).toLocaleDateString()
            }));

            setCompanies(transformedData);
        } catch (error) {
            console.error('Error fetching companies:', error);
            addToast('Erreur lors du chargement des entreprises', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddCompany = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const newCompanyData = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                website: formData.website,
                address: formData.address,
                city: formData.city,
                zip_code: formData.zip_code,
                country: formData.country,
                description: formData.sector
            };

            await apiFetch('/companies', {
                method: 'POST',
                body: JSON.stringify(newCompanyData)
            });

            addToast('Entreprise créée avec succès !', 'success');

            setShowModal(false);
            fetchCompanies();
            setFormData({
                name: '', sector: '', email: '', phone: '',
                website: '', address: '', city: '', zip_code: '', country: 'France'
            });
        } catch (error) {
            addToast('Erreur lors de la création: ' + error.message, 'error');

        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Action handlers ──────────────────────────────────────
    const handleDeleteCompany = async () => {
        if (!selectedCompany) return;
        setIsActionSubmitting(true);
        try {
            await apiFetch(`/companies/${selectedCompany.id}`, {
                method: 'DELETE'
            });
            addToast('Entreprise supprimée avec succès.', 'success');
            setShowDeleteModal(false);
            setSelectedCompany(null);
            fetchCompanies();
        } catch (err) {
            addToast('Erreur lors de la suppression : ' + err.message, 'error');

        } finally {
            setIsActionSubmitting(false);
        }
    };

    const handleStatusChange = async () => {
        if (!selectedCompany || !newStatus) return;
        setIsActionSubmitting(true);
        try {
            await apiFetch(`/companies/${selectedCompany.id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            addToast('Statut mis à jour avec succès.', 'success');
            setShowStatusModal(false);
            setSelectedCompany(null);
            fetchCompanies();
        } catch (err) {
            addToast('Erreur lors du changement de statut : ' + err.message, 'error');

        } finally {
            setIsActionSubmitting(false);
        }
    };

    const openActionMenu = (e, company) => {
        e.stopPropagation();
        if (openDropdown === company.id) {
            setOpenDropdown(null);
            setSelectedCompanyForDropdown(null);
            return;
        }
        // Capture button position for portal placement
        const rect = e.currentTarget.getBoundingClientRect();
        setDropdownPos({
            top: rect.bottom + window.scrollY + 6,
            right: window.innerWidth - rect.right
        });
        setSelectedCompanyForDropdown(company);
        setOpenDropdown(company.id);
    };

    const filteredCompanies = companies.filter(company => {
        const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (company.description || '').toLowerCase().includes(searchTerm.toLowerCase());
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
        <>
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
                            <button className="btn-primary" onClick={() => setShowModal(true)}>
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
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="8" className="text-center py-8">Chargement des entreprises...</td>
                                        </tr>
                                    ) : paginatedCompanies.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center py-8">Aucune entreprise trouvée</td>
                                        </tr>
                                    ) : (
                                        paginatedCompanies.map(company => (
                                            <tr key={company.id} onClick={() => navigate(`/superadmin/companies/${company.id}`)}>
                                                <td>
                                                    <div className="company-cell">
                                                        <div className="company-logo">
                                                            {company.logo_url ? (
                                                                <img
                                                                    src={getFullImageUrl(company.logo_url)}
                                                                    alt={company.name}
                                                                    style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'contain' }}
                                                                />
                                                            ) : (
                                                                company.name[0]
                                                            )}
                                                        </div>
                                                        <span className="company-name">{company.name}</span>
                                                    </div>
                                                </td>
                                                <td className="sector-cell">{company.description || '-'}</td>
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
                                                    <span className={`status-badge ${getStatusClass(company.status || 'active')}`}>
                                                        {getStatusLabel(company.status || 'active')}
                                                    </span>
                                                </td>
                                                <td className="date-cell">{company.createdAt}</td>
                                                <td className="actions-cell text-center">
                                                    <button
                                                        className={`action-btn ${openDropdown === company.id ? 'active' : ''}`}
                                                        onClick={(e) => openActionMenu(e, company)}
                                                    >
                                                        <span className="material-symbols-outlined">more_vert</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
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


                {/* ── Portal Dropdown (simplified: Status & Delete only) ── */}
                {openDropdown !== null && selectedCompanyForDropdown && createPortal(
                    <div
                        ref={dropdownRef}
                        className={`action-dropdown-portal ${effectiveTheme === 'dark' ? 'dark' : ''}`}
                        style={{ top: dropdownPos.top, right: dropdownPos.right }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="dropdown-item"
                            onClick={() => {
                                setOpenDropdown(null);
                                setSelectedCompany(selectedCompanyForDropdown);
                                setNewStatus(selectedCompanyForDropdown.status || 'active');
                                setShowStatusModal(true);
                            }}
                        >
                            <span className="material-symbols-outlined">toggle_on</span>
                            <span>Modifier le statut</span>
                        </button>
                        <div className="dropdown-divider" />
                        <button
                            className="dropdown-item danger"
                            onClick={() => {
                                setOpenDropdown(null);
                                setSelectedCompany(selectedCompanyForDropdown);
                                setShowDeleteModal(true);
                            }}
                        >
                            <span className="material-symbols-outlined">delete</span>
                            <span>Supprimer</span>
                        </button>
                    </div>,
                    document.body
                )}

                {/* ── Delete Confirmation Modal ───────────────── */}
                {showDeleteModal && selectedCompany && (
                    <div className="modal-overlay">
                        <div className="modal-card confirm-modal">
                            <div className="modal-card__accent danger-accent" />
                            <div className="confirm-modal-body">
                                <div className="confirm-icon danger-icon">
                                    <span className="material-symbols-outlined">delete_forever</span>
                                </div>
                                <h2 className="confirm-title">Supprimer l'entreprise ?</h2>
                                <p className="confirm-desc">
                                    Vous allez supprimer définitivement <strong>{selectedCompany.name}</strong>.
                                    Cette action est <strong>irréversible</strong>.
                                </p>
                                <div className="confirm-actions">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => { setShowDeleteModal(false); setSelectedCompany(null); }}
                                        disabled={isActionSubmitting}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        className="btn-danger"
                                        onClick={handleDeleteCompany}
                                        disabled={isActionSubmitting}
                                    >
                                        <span className="material-symbols-outlined">
                                            {isActionSubmitting ? 'hourglass_empty' : 'delete'}
                                        </span>
                                        {isActionSubmitting ? 'Suppression...' : 'Supprimer'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Change Status Modal ─────────────────────── */}
                {showStatusModal && selectedCompany && (
                    <div className="modal-overlay">
                        <div className="modal-card status-modal">
                            <div className="modal-card__accent" />
                            <div className="modal-header">
                                <div className="modal-header-content">
                                    <div className="modal-icon">
                                        <span className="material-symbols-outlined">toggle_on</span>
                                    </div>
                                    <h2 className="modal-title">Modifier le statut</h2>
                                    <p className="modal-subtitle">{selectedCompany.name}</p>
                                </div>
                                <button
                                    className="close-btn"
                                    onClick={() => { setShowStatusModal(false); setSelectedCompany(null); }}
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="status-modal-body">
                                <div className="status-options">
                                    {[
                                        { value: 'active', label: 'Actif', icon: 'check_circle', cls: 'opt-success' },
                                        { value: 'suspended', label: 'Suspendu', icon: 'block', cls: 'opt-danger' },
                                        { value: 'trial', label: 'Essai', icon: 'hourglass_top', cls: 'opt-warning' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`status-option ${opt.cls} ${newStatus === opt.value ? 'selected' : ''}`}
                                            onClick={() => setNewStatus(opt.value)}
                                        >
                                            <span className="material-symbols-outlined">{opt.icon}</span>
                                            <span>{opt.label}</span>
                                            {newStatus === opt.value && (
                                                <span className="material-symbols-outlined check-mark">check</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    className="btn-secondary"
                                    onClick={() => { setShowStatusModal(false); setSelectedCompany(null); }}
                                    disabled={isActionSubmitting}
                                >
                                    Annuler
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={handleStatusChange}
                                    disabled={isActionSubmitting}
                                >
                                    <span className="material-symbols-outlined">
                                        {isActionSubmitting ? 'hourglass_empty' : 'save'}
                                    </span>
                                    {isActionSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* New Company Modal */}
                {showModal && (
                    <div className="modal-overlay">
                        <div className="modal-card">
                            <div className="modal-header">
                                <div className="modal-header-content">
                                    <div className="modal-icon">
                                        <span className="material-symbols-outlined">domain_add</span>
                                    </div>
                                    <h2 className="modal-title">Nouvelle Entreprise</h2>
                                    <p className="modal-subtitle">Ajouter une entreprise à la plateforme</p>
                                </div>
                                <button className="close-btn" onClick={() => setShowModal(false)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <form onSubmit={handleAddCompany}>
                                <div className="modal-body">
                                    <p className="form-section-label">Informations générales</p>
                                    <div className="form-group">
                                        <label>
                                            <span className="material-symbols-outlined">business</span>
                                            Nom de l'entreprise <i className="required-star">*</i>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Nom légal de l'organisation"
                                        />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>
                                                <span className="material-symbols-outlined">category</span>
                                                Secteur d'activité
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.sector}
                                                onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                                                placeholder="Secteur d'activité principal (ex : Conseil, Industrie...)"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>
                                                <span className="material-symbols-outlined">language</span>
                                                Site Web
                                            </label>
                                            <input
                                                type="url"
                                                value={formData.website}
                                                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                                placeholder="https://votre-domaine.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>
                                                <span className="material-symbols-outlined">mail</span>
                                                Email de contact
                                            </label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="contact@organisation.com"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>
                                                <span className="material-symbols-outlined">phone</span>
                                                Téléphone
                                            </label>
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="Numéro de standard ou support"
                                            />
                                        </div>
                                    </div>

                                    <p className="form-section-label">Localisation</p>
                                    <div className="form-group">
                                        <label>
                                            <span className="material-symbols-outlined">location_on</span>
                                            Adresse
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            placeholder="Adresse du siège social"
                                        />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>
                                                <span className="material-symbols-outlined">location_city</span>
                                                Ville
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.city}
                                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                                placeholder="Ville"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>
                                                <span className="material-symbols-outlined">markunread_mailbox</span>
                                                Code Postal
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.zip_code}
                                                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                                                placeholder="Code postal"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                                    <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                        <span className="material-symbols-outlined">{isSubmitting ? 'hourglass_empty' : 'add_business'}</span>
                                        {isSubmitting ? 'Création...' : 'Créer l\'entreprise'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
    );
};

export default CompaniesList;
