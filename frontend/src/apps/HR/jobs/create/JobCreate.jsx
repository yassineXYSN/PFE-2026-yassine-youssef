import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import HRSidebar from '../../components/HRSidebar';
import { apiFetch } from '../../../../core/api';
import { supabase } from '../../../../core/supabaseClient';
import './JobCreate.css';

const JobCreate = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();

    // State for dynamic features like filtering questions
    const [questions, setQuestions] = useState([{ id: Date.now(), text: '' }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [companyId, setCompanyId] = useState(null);

    // Form fields state
    const [formData, setFormData] = useState({
        title: '',
        department_id: '',
        type: 'cdi',
        location: '',
        workMode: 'onsite',
        experience: 'junior',
        description: '',
        missions: '',
        profile: '',
        salaryMin: '',
        salaryMax: '',
        currency: 'tnd',
        frequency: 'monthly',
        notificationEmail: '',
        deadline: '',
        status: 'draft'
    });

    const addQuestion = () => {
        setQuestions([...questions, { id: Date.now(), text: '' }]);
    };

    const removeQuestion = (id) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const [departments, setDepartments] = useState([]);
    const [loadingDept, setLoadingDept] = useState(true);

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const profile = await apiFetch(`/profiles/${user.id}`);
                const companyId = profile.company_id;

                if (companyId) {
                    const depts = await apiFetch(`/departments/?company_id=${companyId}`);
                    setDepartments(depts);
                    setCompanyId(companyId);
                }
            } catch (err) {
                console.error("Error fetching data for job creation:", err);
            } finally {
                setLoadingDept(false);
            }
        };
        fetchDepts();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!companyId) throw new Error("ID de l'entreprise manquant.");

            const payload = {
                title: formData.title,
                company_id: companyId,
                department_id: formData.department_id || null,
                description: formData.description,
                requirements: formData.profile.split('\n').filter(r => r.trim() !== ''),
                location: formData.location,
                type: formData.type,
                status: formData.status,
                salary_range: formData.salaryMin && formData.salaryMax
                    ? `${formData.salaryMin}-${formData.salaryMax} ${formData.currency.toUpperCase()}`
                    : null,
                // Additional fields for our extended model if needed
                missions: formData.missions,
                work_mode: formData.workMode,
                experience_level: formData.experience,
                screening_questions: questions.map(q => q.text).filter(t => t.trim() !== ''),
                notification_email: formData.notificationEmail,
                deadline: formData.deadline
            };

            await apiFetch('/jobs/', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            navigate('/hr/offres');
        } catch (err) {
            console.error("Error creating job:", err);
            setError(err.message || "Une erreur est survenue lors de la création de l'offre.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`job-create-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="job-create-main">
                <div className="job-create-container">
                    <div className="job-create-header-row">
                        <div className="job-create-header-text-group">
                            <div className="back-link-wrapper">
                                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/hr/offres'); }} className="back-link">
                                    <span className="material-symbols-outlined arrow-icon">arrow_back</span>
                                    Retour aux offres
                                </a>
                            </div>
                            <h1 className="job-create-title">Nouvelle Offre d'Emploi</h1>
                            <p className="job-create-subtitle">
                                Créez une offre attractive et configurez les paramètres de recrutement pour trouver les meilleurs talents.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="error-banner card-glass" style={{ color: '#ef4444', padding: '1rem', marginBottom: '1.5rem', border: '1px solid #ef4444' }}>
                            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>error</span>
                            {error}
                        </div>
                    )}

                    <form className="job-create-form" onSubmit={handleSubmit}>

                        {/* Section 1: Informations Générales */}
                        <div className="form-section">
                            <div className="section-header">
                                <div className="section-icon-wrapper">
                                    <span className="material-symbols-outlined">info</span>
                                </div>
                                <h2 className="section-title">1. Informations Générales (L'essentiel)</h2>
                            </div>

                            <div className="form-grid">
                                <label className="form-field col-span-2">
                                    <span className="field-label">Titre du poste</span>
                                    <input
                                        type="text"
                                        name="title"
                                        className="form-input"
                                        placeholder="ex: Chef de Projet Marketing"
                                        value={formData.title}
                                        onChange={handleChange}
                                        required
                                    />
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Département</span>
                                    <div className="select-wrapper">
                                        <select
                                            name="department_id"
                                            className="form-select"
                                            value={formData.department_id}
                                            onChange={handleChange}
                                            disabled={loadingDept}
                                        >
                                            <option value="">{loadingDept ? 'Chargement...' : 'Sélectionner un département'}</option>
                                            {departments.map(dept => (
                                                <option key={dept._id} value={dept._id}>{dept.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Type de contrat</span>
                                    <div className="select-wrapper">
                                        <select
                                            name="type"
                                            className="form-select"
                                            value={formData.type}
                                            onChange={handleChange}
                                        >
                                            <option value="cdi">CDI</option>
                                            <option value="cdd">CDD</option>
                                            <option value="internship">Stage</option>
                                            <option value="apprenticeship">Alternance</option>
                                            <option value="freelance">Freelance</option>
                                        </select>
                                    </div>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Lieu</span>
                                    <div className="input-with-icon">
                                        <input
                                            type="text"
                                            name="location"
                                            className="form-input pl-10"
                                            placeholder="ex: Tunis, Sfax..."
                                            value={formData.location}
                                            onChange={handleChange}
                                        />
                                        <span className="material-symbols-outlined field-icon">location_on</span>
                                    </div>
                                </label>

                                <div className="form-field">
                                    <span className="field-label">Mode de travail</span>
                                    <div className="radio-group">
                                        <label className="radio-option">
                                            <input
                                                type="radio"
                                                name="workMode"
                                                value="onsite"
                                                checked={formData.workMode === 'onsite'}
                                                onChange={handleChange}
                                            />
                                            <span>Sur site</span>
                                        </label>
                                        <label className="radio-option">
                                            <input
                                                type="radio"
                                                name="workMode"
                                                value="hybrid"
                                                checked={formData.workMode === 'hybrid'}
                                                onChange={handleChange}
                                            />
                                            <span>Hybride</span>
                                        </label>
                                        <label className="radio-option">
                                            <input
                                                type="radio"
                                                name="workMode"
                                                value="remote"
                                                checked={formData.workMode === 'remote'}
                                                onChange={handleChange}
                                            />
                                            <span>Télétravail complet</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Contenu de l'Annonce */}
                        <div className="form-section">
                            <div className="section-header">
                                <div className="section-icon-wrapper">
                                    <span className="material-symbols-outlined">description</span>
                                </div>
                                <h2 className="section-title">2. Contenu de l'Annonce (Le descriptif)</h2>
                            </div>

                            <div className="form-grid">
                                <label className="form-field col-span-2">
                                    <span className="field-label">Présentation de l’entreprise</span>
                                    <div className="rich-text-container">
                                        <div className="rich-text-toolbar">
                                            <button type="button" className="toolbar-btn"><span className="material-symbols-outlined">format_bold</span></button>
                                            <button type="button" className="toolbar-btn"><span className="material-symbols-outlined">format_italic</span></button>
                                            <button type="button" className="toolbar-btn"><span className="material-symbols-outlined">format_list_bulleted</span></button>
                                        </div>
                                        <textarea
                                            name="description"
                                            className="form-textarea minimal"
                                            placeholder="Vendez la culture de votre boîte..."
                                            value={formData.description}
                                            onChange={handleChange}
                                            required
                                        ></textarea>
                                    </div>
                                </label>

                                <label className="form-field col-span-2">
                                    <span className="field-label">Missions du poste</span>
                                    <textarea
                                        name="missions"
                                        className="form-textarea"
                                        placeholder="Listez les responsabilités quotidiennes..."
                                        value={formData.missions}
                                        onChange={handleChange}
                                    ></textarea>
                                </label>

                                <label className="form-field col-span-2">
                                    <span className="field-label">Profil recherché</span>
                                    <textarea
                                        name="profile"
                                        className="form-textarea"
                                        placeholder="Détaillez les Hard & Soft Skills attendus... (Une par ligne)"
                                        value={formData.profile}
                                        onChange={handleChange}
                                    ></textarea>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Niveau d'expérience</span>
                                    <div className="select-wrapper">
                                        <select
                                            name="experience"
                                            className="form-select"
                                            value={formData.experience}
                                            onChange={handleChange}
                                        >
                                            <option value="junior">Débutant (0-2 ans)</option>
                                            <option value="mid">Confirmé (2-5 ans)</option>
                                            <option value="senior">Senior (5-8 ans)</option>
                                            <option value="expert">Expert (8+ ans)</option>
                                        </select>
                                    </div>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Langues requises</span>
                                    <div className="multi-select-container">
                                        <div className="tag-pill">Anglais <span className="material-symbols-outlined">close</span></div>
                                        <div className="tag-pill">Français <span className="material-symbols-outlined">close</span></div>
                                        <input type="text" className="tag-input" placeholder="Ajouter une langue..." />
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Section 3: Rémunération et Avantages */}
                        <div className="form-section">
                            <div className="section-header">
                                <div className="section-icon-wrapper">
                                    <span className="material-symbols-outlined">payments</span>
                                </div>
                                <h2 className="section-title">3. Rémunération et Avantages</h2>
                            </div>

                            <div className="form-grid">
                                <div className="form-field">
                                    <span className="field-label">Fourchette salariale</span>
                                    <div className="salary-group">
                                        <input
                                            type="number"
                                            name="salaryMin"
                                            className="form-input"
                                            placeholder="Min"
                                            value={formData.salaryMin}
                                            onChange={handleChange}
                                        />
                                        <span className="salary-sep">-</span>
                                        <input
                                            type="number"
                                            name="salaryMax"
                                            className="form-input"
                                            placeholder="Max"
                                            value={formData.salaryMax}
                                            onChange={handleChange}
                                        />
                                        <div className="select-wrapper currency-select">
                                            <select
                                                name="currency"
                                                className="form-select"
                                                value={formData.currency}
                                                onChange={handleChange}
                                            >
                                                <option value="tnd">TND</option>
                                                <option value="eur">EUR</option>
                                                <option value="usd">USD</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <label className="form-field">
                                    <span className="field-label">Fréquence de paie</span>
                                    <div className="select-wrapper">
                                        <select
                                            name="frequency"
                                            className="form-select"
                                            value={formData.frequency}
                                            onChange={handleChange}
                                        >
                                            <option value="annual">Annuelle</option>
                                            <option value="monthly">Mensuelle</option>
                                            <option value="hourly">Taux horaire</option>
                                        </select>
                                    </div>
                                </label>

                                <div className="form-field col-span-2">
                                    <span className="field-label">Avantages (Perks)</span>
                                    <div className="checkbox-grid">
                                        <label className="checkbox-option">
                                            <input type="checkbox" />
                                            <span>Tickets resto</span>
                                        </label>
                                        <label className="checkbox-option">
                                            <input type="checkbox" />
                                            <span>Mutuelle</span>
                                        </label>
                                        <label className="checkbox-option">
                                            <input type="checkbox" />
                                            <span>Assurance Transport</span>
                                        </label>
                                        <label className="checkbox-option">
                                            <input type="checkbox" />
                                            <span>Salle de sport</span>
                                        </label>
                                        <label className="checkbox-option">
                                            <input type="checkbox" />
                                            <span>Prime de performance</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Paramètres de Candidature */}
                        <div className="form-section">
                            <div className="section-header">
                                <div className="section-icon-wrapper">
                                    <span className="material-symbols-outlined">settings_suggest</span>
                                </div>
                                <h2 className="section-title">4. Paramètres de Candidature (Logistique)</h2>
                            </div>

                            <div className="form-grid">
                                <div className="form-field col-span-2">
                                    <div className="field-header">
                                        <span className="field-label">Questions de filtrage (Oui/Non)</span>
                                        <button type="button" className="btn-text" onClick={addQuestion}>
                                            <span className="material-symbols-outlined">add</span> Ajouter une question
                                        </button>
                                    </div>
                                    <div className="dynamic-fields">
                                        {questions.map((q, idx) => (
                                            <div key={q.id} className="dynamic-input-group">
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="ex: Avez-vous le permis B ?"
                                                    value={q.text}
                                                    onChange={(e) => {
                                                        const n = [...questions];
                                                        n[idx].text = e.target.value;
                                                        setQuestions(n);
                                                    }}
                                                />
                                                <button type="button" className="btn-icon-danger" onClick={() => removeQuestion(q.id)}>
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-field">
                                    <span className="field-label">Pièces jointes obligatoires</span>
                                    <div className="checkbox-stack">
                                        <label className="checkbox-option">
                                            <input type="checkbox" defaultChecked />
                                            <span>CV</span>
                                        </label>
                                        <label className="checkbox-option">
                                            <input type="checkbox" />
                                            <span>Lettre de motivation</span>
                                        </label>
                                        <label className="checkbox-option">
                                            <input type="checkbox" />
                                            <span>Portfolio / GitHub</span>
                                        </label>
                                    </div>
                                </div>

                                <label className="form-field">
                                    <span className="field-label">Email de notification</span>
                                    <input
                                        type="email"
                                        name="notificationEmail"
                                        className="form-input"
                                        placeholder="recrutement@entreprise.com"
                                        value={formData.notificationEmail}
                                        onChange={handleChange}
                                    />
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Date limite de publication</span>
                                    <div className="input-with-icon">
                                        <input
                                            type="date"
                                            name="deadline"
                                            className="form-input pl-10"
                                            value={formData.deadline}
                                            onChange={handleChange}
                                        />
                                        <span className="material-symbols-outlined field-icon">calendar_today</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Section 5: Visibilité et Statut */}
                        <div className="form-section">
                            <div className="section-header">
                                <div className="section-icon-wrapper">
                                    <span className="material-symbols-outlined">visibility</span>
                                </div>
                                <h2 className="section-title">5. Visibilité et Statut</h2>
                            </div>

                            <div className="form-grid">
                                <div className="form-field">
                                    <span className="field-label">Statut de l'offre</span>
                                    <div className="radio-group-vertical">
                                        <label className="radio-option">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="draft"
                                                checked={formData.status === 'draft'}
                                                onChange={handleChange}
                                            />
                                            <div className="option-text">
                                                <span className="option-title">Brouillon</span>
                                                <span className="option-desc">Visible uniquement par vous</span>
                                            </div>
                                        </label>
                                        <label className="radio-option">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="published"
                                                checked={formData.status === 'published'}
                                                onChange={handleChange}
                                            />
                                            <div className="option-text">
                                                <span className="option-title">Publiée</span>
                                                <span className="option-desc">Visible par tous les candidats</span>
                                            </div>
                                        </label>
                                        <label className="radio-option">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="internal"
                                                checked={formData.status === 'internal'}
                                                onChange={handleChange}
                                            />
                                            <div className="option-text">
                                                <span className="option-title">Interne uniquement</span>
                                                <span className="option-desc">Visible par vos employés</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="form-field">
                                    <span className="field-label">Plateformes de diffusion</span>
                                    <div className="checkbox-stack">
                                        <label className="checkbox-option">
                                            <input type="checkbox" defaultChecked />
                                            <span>Site carrière</span>
                                        </label>
                                        <label className="checkbox-option">
                                            <input type="checkbox" />
                                            <span>LinkedIn</span>
                                        </label>
                                        <label className="checkbox-option">
                                            <input type="checkbox" />
                                            <span>Indeed</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-cancel"
                                onClick={() => navigate('/hr/offres')}
                                disabled={loading}
                            >
                                Annuler
                            </button>
                            <button type="submit" className="btn btn-submit" disabled={loading}>
                                {loading ? 'Création en cours...' : 'Créer l\'offre d\'emploi'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default JobCreate;
