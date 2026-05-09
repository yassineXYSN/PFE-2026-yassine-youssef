import { useLanguage } from '../../../../core/useLanguage';
import ConfirmationModal from '../../../../core/components/ConfirmationModal';
import CreateDepartmentModal from '../../components/CreateDepartmentModal';
import './JobCreate.css';
import { useTheme } from '../../context/ThemeContext';
import { apiFetch } from '../../../../core/api';
import { supabase } from '../../../../core/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import HRSidebar from '../../components/HRSidebar';
import AIAutomationSection from '../shared/AIAutomationSection';
import {
    buildAIAutomationPayload,
    createDefaultAIAutomation,
    validateAIAutomation,
    fetchParametrageDefaults
} from '../shared/aiAutomationConfig';

const COMMON_SKILLS = ['React', 'Node.js', 'Python', 'SQL', 'TypeScript', 'Docker', 'AWS', 'Java', 'Flutter'];
const COMMON_LANGUAGES = ['Français', 'Anglais', 'Arabe', 'Allemand', 'Espagnol', 'Italien'];

const JobCreate = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const mainContentRef = useRef(null);

    // State for dynamic features like filtering questions
    const [questions, setQuestions] = useState([{ id: Date.now(), text: '' }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [companyId, setCompanyId] = useState(null);
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [showCreateDeptModal, setShowCreateDeptModal] = useState(false);
    const [aiAutomation, setAiAutomation] = useState(createDefaultAIAutomation());
    const [aiAutomationErrors, setAiAutomationErrors] = useState({});
    
    const skillInputRef = useRef(null);
    const langInputRef = useRef(null);

    const [parametrage, setParametrage] = useState(null);

    // Fetch company parametrage defaults and apply them to the AI automation config
    useEffect(() => {
        fetchParametrageDefaults().then((params) => {
            setParametrage(params);
            setAiAutomation(createDefaultAIAutomation(params));
        });
    }, []);

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
        status: 'draft',
        requireMotivationLetter: false,
        skills: [],
        languages: []
    });

    const [skillInput, setSkillInput] = useState('');
    const [langInput, setLangInput] = useState('');

    const addSkill = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = skillInput.trim();
            if (val && !formData.skills.includes(val)) {
                setFormData(prev => ({ ...prev, skills: [...prev.skills, val] }));
            }
            setSkillInput('');
        }
    };

    const removeSkill = (skill) => {
        setFormData(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
    };

    const addLang = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = langInput.trim();
            if (val && !formData.languages.includes(val)) {
                setFormData(prev => ({ ...prev, languages: [...prev.languages, val] }));
            }
            setLangInput('');
        }
    };

    const removeLang = (lang) => {
        setFormData(prev => ({ ...prev, languages: prev.languages.filter(l => l !== lang) }));
    };

    const addQuestion = () => {
        setQuestions([...questions, { id: Date.now(), text: '' }]);
    };

    const removeQuestion = (id) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const [departments, setDepartments] = useState([]);
    const [loadingDept, setLoadingDept] = useState(true);

    const today = new Date().toISOString().split('T')[0];

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

        if (name === 'department_id' && value === 'ADD_NEW') {
            setShowCreateDeptModal(true);
            // We don't change the department_id value to ADD_NEW in state
            // to keep the select showing at its last valid state or empty
            return;
        }

        if (type === 'checkbox' && name === 'benefits') {
            setFormData(prev => {
                const currentBenefits = prev.benefits || [];
                if (checked) {
                    return { ...prev, benefits: [...currentBenefits, value] };
                } else {
                    return { ...prev, benefits: currentBenefits.filter(b => b !== value) };
                }
            });
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setAiAutomationErrors({});

        try {
            if (!companyId) throw new Error(t('google_connect_error'));

            // Validation for required fields
            if (!formData.title.trim()) {
                setError(t('hr-jobs-error-title-v'));
                if (mainContentRef.current) mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                setLoading(false);
                return;
            }

            if (!formData.department_id) {
                if (departments.length === 0) {
                    setShowDeptModal(true);
                    setLoading(false);
                    return;
                } else {
                    setError(t('hr-jobs-error-dept-v'));
                    if (mainContentRef.current) mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                    setLoading(false);
                    return;
                }
            }

            if (!formData.description.trim()) {
                setError(t('hr-jobs-error-desc-v'));
                if (mainContentRef.current) mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                setLoading(false);
                return;
            }

            if (!formData.deadline) {
                setError(t('hr-jobs-error-deadline-required') || 'La date limite de publication est requise.');
                if (mainContentRef.current) mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                setLoading(false);
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const deadlineDate = new Date(formData.deadline);
            deadlineDate.setHours(0, 0, 0, 0);
            if (deadlineDate < today) {
                setError(t('hr-jobs-error-deadline-past') || 'La date limite de publication ne peut pas Ãªtre dans le passÃ©.');
                if (mainContentRef.current) mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                setLoading(false);
                return;
            }

            const automationErrors = validateAIAutomation(aiAutomation, formData.deadline);
            if (Object.keys(automationErrors).length > 0) {
                setAiAutomationErrors(automationErrors);
                setError(t('hr-jobs-error-automation') || 'Please correct the AI auto-filtering settings before saving.');
                if (mainContentRef.current) mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                setLoading(false);
                return;
            }

            const payload = {
                title: formData.title,
                company_id: companyId,
                department_id: formData.department_id || null,
                description: formData.description,
                requirements: [
                    ...formData.profile.split('\n').filter(r => r.trim() !== ''),
                    ...formData.skills.map(s => `Skill: ${s}`),
                    ...formData.languages.map(l => `Langue: ${l}`)
                ],
                location: formData.location,
                type: formData.type,
                status: formData.status,
                salary_range: formData.salaryMin && formData.salaryMax
                    ? `${formData.salaryMin}-${formData.salaryMax} ${formData.currency.toUpperCase()}`
                    : null,
                // Additional fields for our extended model if needed
                missions: formData.missions.split('\n').filter(m => m.trim() !== '').join('\n'),
                work_mode: formData.workMode,
                experience_level: formData.experience,
                screening_questions: questions.map(q => q.text).filter(t => t.trim() !== ''),
                notification_email: formData.notificationEmail,
                deadline: formData.deadline,
                benefits: formData.benefits,
                require_motivation_letter: formData.requireMotivationLetter,
                ai_automation: buildAIAutomationPayload(aiAutomation)
            };

            await apiFetch('/jobs/', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            navigate('/hr/offres');
        } catch (err) {
            console.error("Error creating job:", err);
            setError(err.message || t('hr-jobs-error-create'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeptSuccess = (newDept) => {
        setDepartments(prev => [...prev, newDept]);
        setFormData(prev => ({
            ...prev,
            department_id: newDept._id
        }));
        setShowCreateDeptModal(false);
    };

    return (
        <div className={`job-create-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="job-create-main" ref={mainContentRef}>
                <div className="job-create-container">
                    <div className="job-create-header-row">
                        <div className="job-create-header-text-group">
                            <div className="back-link-wrapper">
                                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/hr/offres'); }} className="back-link">
                                    <span className="material-symbols-outlined arrow-icon">arrow_back</span>
                                    {t('hr-jobs-back')}
                                </a>
                            </div>
                            <h1 className="job-create-title">{t('hr-jobs-create-title')}</h1>
                            <p className="job-create-subtitle">
                                {t('hr-jobs-create-subtitle')}
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
                                <h2 className="section-title">{t('hr-jobs-section-general')}</h2>
                            </div>

                            <div className="form-grid">
                                <label className="form-field col-span-2">
                                    <span className="field-label">{t('hr-jobs-field-title')}</span>
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
                                    <span className="field-label">{t('hr-jobs-field-dept')}</span>
                                    <div className="select-wrapper">
                                        <select
                                            name="department_id"
                                            className="form-select"
                                            value={formData.department_id}
                                            onChange={handleChange}
                                            disabled={loadingDept}
                                        >
                                            <option value="">{loadingDept ? t('hr-candidates-loading') : t('hr-jobs-field-dept-placeholder')}</option>
                                            {departments.map(dept => (
                                                <option key={dept._id} value={dept._id}>{dept.name}</option>
                                            ))}
                                            <option value="ADD_NEW" style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{t('hr-jobs-field-dept-add')}</option>
                                        </select>
                                    </div>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">{t('hr-jobs-field-contract')}</span>
                                    <div className="select-wrapper">
                                        <select
                                            name="type"
                                            className="form-select"
                                            value={formData.type}
                                            onChange={handleChange}
                                        >
                                            <option value="cdi">{t('hr-jobs-contract-cdi')}</option>
                                            <option value="cdd">{t('hr-jobs-contract-cdd')}</option>
                                            <option value="internship">{t('hr-jobs-contract-internship')}</option>
                                            <option value="apprenticeship">{t('hr-jobs-contract-apprenticeship')}</option>
                                            <option value="freelance">{t('hr-jobs-contract-freelance')}</option>
                                        </select>
                                    </div>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">{t('hr-jobs-field-location')}</span>
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
                                    <span className="field-label">{t('hr-jobs-field-workmode')}</span>
                                    <div className="radio-group">
                                        <label className="radio-option">
                                            <input
                                                type="radio"
                                                name="workMode"
                                                value="onsite"
                                                checked={formData.workMode === 'onsite'}
                                                onChange={handleChange}
                                            />
                                            <span>{t('hr-jobs-workmode-onsite')}</span>
                                        </label>
                                        <label className="radio-option">
                                            <input
                                                type="radio"
                                                name="workMode"
                                                value="hybrid"
                                                checked={formData.workMode === 'hybrid'}
                                                onChange={handleChange}
                                            />
                                            <span>{t('hr-jobs-workmode-hybrid')}</span>
                                        </label>
                                        <label className="radio-option">
                                            <input
                                                type="radio"
                                                name="workMode"
                                                value="remote"
                                                checked={formData.workMode === 'remote'}
                                                onChange={handleChange}
                                            />
                                            <span>{t('hr-jobs-workmode-remote')}</span>
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
                                <h2 className="section-title">{t('hr-jobs-section-content')}</h2>
                            </div>

                            <div className="form-grid">
                                <label className="form-field col-span-2">
                                    <span className="field-label">{t('hr-jobs-field-description')}</span>
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
                                    <span className="field-label">{t('hr-jobs-field-missions')}</span>
                                    <textarea
                                        name="missions"
                                        className="form-textarea"
                                        placeholder="Listez les responsabilités quotidiennes..."
                                        value={formData.missions}
                                        onChange={handleChange}
                                    ></textarea>
                                </label>

                                <label className="form-field col-span-2">
                                    <span className="field-label">{t('hr-jobs-field-profile')}</span>
                                    <textarea
                                        name="profile"
                                        className="form-textarea"
                                        placeholder="Détaillez les Hard & Soft Skills attendus... (Une par ligne)"
                                        value={formData.profile}
                                        onChange={handleChange}
                                    ></textarea>
                                </label>

                                <label className="form-field col-span-2">
                                    <span className="field-label">{t('hr-jobs-field-skills')}</span>
                                    <div className="tag-system-container">
                                        <div 
                                            className="multi-select-container"
                                            onClick={() => skillInputRef.current?.focus()}
                                        >
                                            {formData.skills.map(skill => (
                                                <div className="tag-pill" key={skill}>
                                                    {skill}
                                                    <span className="material-symbols-outlined" onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}>close</span>
                                                </div>
                                            ))}
                                            <div className="tag-input-row">
                                                <input
                                                    ref={skillInputRef}
                                                    type="text"
                                                    className="tag-input"
                                                    placeholder={t('hr-jobs-skills-placeholder')}
                                                    value={skillInput}
                                                    onChange={(e) => setSkillInput(e.target.value)}
                                                    onKeyDown={addSkill}
                                                />
                                                <button 
                                                    type="button" 
                                                    className="btn-add-tag"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const val = skillInput.trim();
                                                        if (val && !formData.skills.includes(val)) {
                                                            setFormData(prev => ({ ...prev, skills: [...prev.skills, val] }));
                                                            setSkillInput('');
                                                        }
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined">add</span>
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="suggested-tags">
                                            <span className="suggestion-label">{t('hr-jobs-suggestions') || 'Suggestions:'}</span>
                                            {COMMON_SKILLS.filter(s => !formData.skills.includes(s)).slice(0, 8).map(s => (
                                                <button 
                                                    key={s} 
                                                    type="button" 
                                                    className="suggestion-chip"
                                                    onClick={() => setFormData(prev => ({ ...prev, skills: [...prev.skills, s] }))}
                                                >
                                                    +{s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">{t('hr-jobs-field-experience')}</span>
                                    <div className="select-wrapper">
                                        <select
                                            name="experience"
                                            className="form-select"
                                            value={formData.experience}
                                            onChange={handleChange}
                                        >
                                            <option value="junior">{t('hr-jobs-exp-junior')}</option>
                                            <option value="mid">{t('hr-jobs-exp-mid')}</option>
                                            <option value="senior">{t('hr-jobs-exp-senior')}</option>
                                            <option value="expert">{t('hr-jobs-exp-expert')}</option>
                                        </select>
                                    </div>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">{t('hr-jobs-field-languages')}</span>
                                    <div className="tag-system-container">
                                        <div 
                                            className="multi-select-container"
                                            onClick={() => langInputRef.current?.focus()}
                                        >
                                            {formData.languages.map(lang => (
                                                <div className="tag-pill" key={lang}>
                                                    {lang}
                                                    <span className="material-symbols-outlined" onClick={(e) => { e.stopPropagation(); removeLang(lang); }}>close</span>
                                                </div>
                                            ))}
                                            <div className="tag-input-row">
                                                <input
                                                    ref={langInputRef}
                                                    type="text"
                                                    className="tag-input"
                                                    placeholder={t('hr-jobs-language-placeholder')}
                                                    value={langInput}
                                                    onChange={(e) => setLangInput(e.target.value)}
                                                    onKeyDown={addLang}
                                                />
                                                <button 
                                                    type="button" 
                                                    className="btn-add-tag"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const val = langInput.trim();
                                                        if (val && !formData.languages.includes(val)) {
                                                            setFormData(prev => ({ ...prev, languages: [...prev.languages, val] }));
                                                            setLangInput('');
                                                        }
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined">add</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="suggested-tags">
                                            {COMMON_LANGUAGES.filter(l => !formData.languages.includes(l)).map(l => (
                                                <button 
                                                    key={l} 
                                                    type="button" 
                                                    className="suggestion-chip"
                                                    onClick={() => setFormData(prev => ({ ...prev, languages: [...prev.languages, l] }))}
                                                >
                                                    +{l}
                                                </button>
                                            ))}
                                        </div>
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
                                <h2 className="section-title">{t('hr-jobs-section-benefits')}</h2>
                            </div>

                            <div className="form-grid">
                                <div className="form-field">
                                    <span className="field-label">{t('hr-jobs-field-salary')}</span>
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
                                    <span className="field-label">{t('hr-jobs-field-frequency')}</span>
                                    <div className="select-wrapper">
                                        <select
                                            name="frequency"
                                            className="form-select"
                                            value={formData.frequency}
                                            onChange={handleChange}
                                        >
                                            <option value="annual">{t('hr-jobs-freq-annual')}</option>
                                            <option value="monthly">{t('hr-jobs-freq-monthly')}</option>
                                            <option value="hourly">{t('hr-jobs-freq-hourly')}</option>
                                        </select>
                                    </div>
                                </label>

                                <div className="form-field col-span-2">
                                    <span className="field-label">{t('hr-jobs-field-benefits')}</span>
                                    <div className="checkbox-grid">
                                        {['Tickets resto', 'Mutuelle', 'Assurance Transport', 'Salle de sport', 'Prime de performance'].map(benefit => (
                                            <label className="checkbox-option" key={benefit}>
                                                <input
                                                    type="checkbox"
                                                    name="benefits"
                                                    value={benefit}
                                                    checked={formData.benefits?.includes(benefit) || false}
                                                    onChange={handleChange}
                                                />
                                                <span>{benefit}</span>
                                            </label>
                                        ))}
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
                                <h2 className="section-title">{t('hr-jobs-section-settings')}</h2>
                            </div>

                            <div className="form-grid">
                                <div className="form-field col-span-2">
                                    <div className="field-header">
                                        <span className="field-label">{t('hr-jobs-field-questions')}</span>
                                        <button type="button" className="btn-text" onClick={addQuestion}>
                                            <span className="material-symbols-outlined">add</span> {t('hr-jobs-field-questions-add')}
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
                                    <span className="field-label">{t('hr-jobs-field-required-docs')}</span>
                                    <div className="checkbox-stack">
                                        <label className="checkbox-option">
                                            <input type="checkbox" defaultChecked />
                                            <span>CV</span>
                                        </label>
                                        <label className="checkbox-option">
                                            <input
                                                type="checkbox"
                                                name="requireMotivationLetter"
                                                checked={formData.requireMotivationLetter}
                                                onChange={handleChange}
                                            />
                                            <span>{t('hr-application-letter')}</span>
                                        </label>
                                        <label className="checkbox-option">
                                            <input type="checkbox" />
                                            <span>{t('hr-jobs-platform-portfolio')}</span>
                                        </label>
                                    </div>
                                </div>

                                <label className="form-field">
                                    <span className="field-label">{t('hr-jobs-field-notif-email')}</span>
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
                                    <span className="field-label">{t('hr-jobs-field-deadline')}</span>
                                    <div className="input-with-icon">
                                        <input
                                            type="date"
                                            name="deadline"
                                            className="form-input pl-10"
                                            min={today}
                                            value={formData.deadline}
                                            onChange={handleChange}
                                        />
                                        <span className="material-symbols-outlined field-icon">calendar_today</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <AIAutomationSection
                            config={aiAutomation}
                            onChange={setAiAutomation}
                            errors={aiAutomationErrors}
                            applicationDeadline={formData.deadline}
                            parametrage={parametrage}
                            aiEnabled={parametrage?.ai_enabled !== false}
                        />

                        {/* Section 5: Visibilité et Statut */}
                        <div className="form-section">
                            <div className="section-header">
                                <div className="section-icon-wrapper">
                                    <span className="material-symbols-outlined">visibility</span>
                                </div>
                                <h2 className="section-title">{t('hr-jobs-section-visibility')}</h2>
                            </div>

                            <div className="form-grid">
                                <div className="form-field">
                                    <span className="field-label">{t('hr-jobs-table-status')}</span>
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
                                                <span className="option-title">{t('hr-jobs-status-draft')}</span>
                                                <span className="option-desc">{t('hr-jobs-status-desc-draft')}</span>
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
                                                <span className="option-title">{t('hr-jobs-status-published')}</span>
                                                <span className="option-desc">{t('hr-jobs-status-desc-published')}</span>
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
                                                <span className="option-title">{t('hr-jobs-status-internal')}</span>
                                                <span className="option-desc">{t('hr-jobs-status-desc-internal')}</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="form-field">
                                    <span className="field-label">{t('hr-jobs-field-platforms')}</span>
                                    <div className="checkbox-stack">
                                        <label className="checkbox-option">
                                            <input type="checkbox" defaultChecked />
                                            <span>{t('hr-jobs-platform-site')}</span>
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
                                {t('hr-filter-reset')}
                            </button>
                            <button type="submit" className="btn btn-submit" disabled={loading}>
                                {loading ? t('hr-jobs-creating-btn') : t('hr-jobs-create-btn')}
                            </button>
                        </div>
                    </form>
                </div>
            </main>

            <ConfirmationModal
                isOpen={showDeptModal}
                onClose={() => setShowDeptModal(false)}
                onConfirm={() => {
                    setShowDeptModal(false);
                    setShowCreateDeptModal(true);
                }}
                title={t('hr-jobs-modal-no-dept-title')}
                message={t('hr-jobs-modal-no-dept-msg')}
                confirmText={t('hr-jobs-modal-create-dept')}
                cancelText={t('hr-filter-reset')}
                type="primary"
            />

            <CreateDepartmentModal
                isOpen={showCreateDeptModal}
                onClose={() => setShowCreateDeptModal(false)}
                companyId={companyId}
                onSuccess={handleDeptSuccess}
            />
        </div>
    );
};

export default JobCreate;
