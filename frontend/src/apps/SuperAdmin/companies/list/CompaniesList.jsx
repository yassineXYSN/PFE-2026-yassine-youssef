import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../../../core/supabaseClient';
import SuperAdminSidebar from '../../components/SuperAdminSidebar';
import './CompaniesList.css';

const CompaniesList = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const [companies, setCompanies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const fetchCompanies = async () => {
        setIsLoading(true);
        try {
            // Fetch companies with counts of profiles and jobs
            const { data, error } = await supabase
                .from('companies')
                .select(`
                    *,
                    profiles (id),
                    jobs (id)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform data to include counts
            const transformedData = data.map(company => ({
                ...company,
                users: company.profiles?.length || 0,
                jobs: company.jobs?.length || 0,
                plan: 'Standard', // Default plan if not in DB
                createdAt: new Date(company.created_at).toLocaleDateString()
            }));

            setCompanies(transformedData);
        } catch (error) {
            console.error('Error fetching companies:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddCompany = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('companies')
                .insert([
                    {
                        name: formData.name,
                        email: formData.email,
                        phone: formData.phone,
                        website: formData.website,
                        address: formData.address,
                        city: formData.city,
                        zip_code: formData.zip_code,
                        country: formData.country,
                        description: formData.sector // Mapping sector to description to avoid schema errors
                    }
                ])
                .select();

            if (error) throw error;

            alert('Entreprise créée avec succès !');
            setShowModal(false);
            fetchCompanies();
            setFormData({
                name: '', sector: '', email: '', phone: '',
                website: '', address: '', city: '', zip_code: '', country: 'France'
            });
        } catch (error) {
            alert('Erreur lors de la création: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
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
                                                    <div className="company-logo">{company.name[0]}</div>
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
    );
};

export default CompaniesList;
