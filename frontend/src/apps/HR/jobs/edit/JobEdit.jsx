import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import HRSidebar from '../../components/HRSidebar';
import { apiFetch } from '../../../../core/api';
import { supabase } from '../../../../core/supabaseClient';
import './JobEdit.css';
import AIAutomationSection from '../shared/AIAutomationSection';
import {
    buildAIAutomationPayload,
    createDefaultAIAutomation,
    hydrateAIAutomation,
    validateAIAutomation,
    fetchParametrageDefaults
} from '../shared/aiAutomationConfig';

const COMMON_SKILLS = ['React', 'Node.js', 'Python', 'SQL', 'TypeScript', 'Docker', 'AWS', 'Java', 'Flutter'];
const COMMON_LANGUAGES = ['Français', 'Anglais', 'Arabe', 'Allemand', 'Espagnol', 'Italien'];

const JobEdit = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const { id } = useParams();

    const [loading, setLoading] = useState(false);
    const [fetchingJob, setFetchingJob] = useState(true);
    const [error, setError] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [questions, setQuestions] = useState([{ id: Date.now(), text: '' }]);
    const [aiAutomation, setAiAutomation] = useState(createDefaultAIAutomation());
    const [aiAutomationErrors, setAiAutomationErrors] = useState({});
    const [parametrage, setParametrage] = useState(null);

    const skillInputRef = React.useRef(null);
    const langInputRef = React.useRef(null);

    useEffect(() => {
        fetchParametrageDefaults().then(setParametrage);
    }, []);

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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Fetch job data and departments in parallel
                const [jobData, profile] = await Promise.all([
                    apiFetch(`/jobs/${id}`),
                    apiFetch(`/profiles/${user.id}`)
                ]);

                if (profile.company_id) {
                    const depts = await apiFetch(`/departments/?company_id=${profile.company_id}`);
                    setDepartments(depts);
                }

                // Pre-fill form with existing job data
                const requirements = jobData.requirements || [];
                const screeningQuestions = jobData.screening_questions || [];

                setFormData({
                    title: jobData.title || '',
                    department_id: jobData.department_id || '',
                    type: jobData.type || 'cdi',
                    location: jobData.location || '',
                    workMode: jobData.work_mode || 'onsite',
                    experience: jobData.experience_level || 'junior',
                    description: jobData.description || '',
                    missions: jobData.missions || '',
                    deadline: jobData.deadline ? jobData.deadline.split('T')[0] : '',
                    status: jobData.status || 'draft',
                    skills: requirements.filter(r => r.startsWith('Skill: ')).map(r => r.replace('Skill: ', '')),
                    languages: requirements.filter(r => r.startsWith('Langue: ')).map(r => r.replace('Langue: ', '')),
                    profile: requirements.filter(r => !r.startsWith('Skill: ') && !r.startsWith('Langue: ')).join('\n')
                });
                setAiAutomation(hydrateAIAutomation(jobData.ai_automation));

                if (screeningQuestions.length > 0) {
                    setQuestions(screeningQuestions.map((text, i) => ({ id: i, text })));
                }
            } catch (err) {
                console.error('Error fetching job data:', err);
                setError("Impossible de charger l'offre d'emploi.");
            } finally {
                setFetchingJob(false);
            }
        };
        if (id) fetchData();
    }, [id]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const addQuestion = () => setQuestions([...questions, { id: Date.now(), text: '' }]);
    const removeQuestion = (qid) => setQuestions(questions.filter(q => q.id !== qid));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setAiAutomationErrors({});
        try {
            const automationErrors = validateAIAutomation(aiAutomation);
            if (Object.keys(automationErrors).length > 0) {
                setAiAutomationErrors(automationErrors);
                setError('Please correct the AI auto-filtering settings before saving.');
                setLoading(false);
                return;
            }

            const payload = {
                title: formData.title,
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
                missions: formData.missions.split('\n').filter(m => m.trim() !== '').join('\n'),
                work_mode: formData.workMode,
                experience_level: formData.experience,
                screening_questions: questions.map(q => q.text).filter(t => t.trim() !== ''),
                notification_email: formData.notificationEmail,
                deadline: formData.deadline,
                ai_automation: buildAIAutomationPayload(aiAutomation)
            };

            await apiFetch(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            navigate(`/hr/offres/${id}`);
        } catch (err) {
            console.error('Error updating job:', err);
            setError(err.message || "Une erreur est survenue lors de la mise à jour de l'offre.");
        } finally {
            setLoading(false);
        }
    };

    if (fetchingJob) {
        return (
            <div className={`job-edit-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="job-edit-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div>Chargement de l'offre...</div>
                </main>
            </div>
        );
    }

    return (
        <div className={`job-edit-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />
            <main className="job-edit-main">
                <div className="job-edit-container">
                    <div className="job-edit-header-row">
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/hr/offres/${id}`); }} className="back-link">
                            <span className="material-symbols-outlined">arrow_back</span>
                            Retour à l'offre
                        </a>
                        <h1 className="job-edit-title">Modifier l'offre d'emploi</h1>
                        <p className="job-edit-subtitle">Modifiez les informations de cette offre et sauvegardez vos changements.</p>
                    </div>

                    {error && (
                        <div className="error-banner" style={{ color: '#ef4444', padding: '1rem', marginBottom: '1.5rem', border: '1px solid #ef4444', borderRadius: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>error</span>
                            {error}
                        </div>
                    )}

                    <form className="job-edit-form" onSubmit={handleSubmit}>

                        {/* Section 1 */}
                        <div className="form-section">
                            <div className="section-header-simple">
                                <h2 className="job-edit-section-title">1. Informations Générales</h2>
                            </div>
                            <div className="form-grid">
                                <label className="form-field col-span-2">
                                    <span className="field-label">Titre du poste</span>
                                    <input type="text" name="title" className="form-input" placeholder="ex: Chef de Projet Marketing" value={formData.title} onChange={handleChange} required />
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Département</span>
                                    <div className="select-wrapper">
                                        <select name="department_id" className="form-select" value={formData.department_id} onChange={handleChange}>
                                            <option value="">Sélectionner un département</option>
                                            {departments.map(dept => (
                                                <option key={dept._id} value={dept._id}>{dept.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Type de contrat</span>
                                    <div className="select-wrapper">
                                        <select name="type" className="form-select" value={formData.type} onChange={handleChange}>
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
                                        <input type="text" name="location" className="form-input" placeholder="ex: Tunis, Sfax..." value={formData.location} onChange={handleChange} />
                                        <span className="material-symbols-outlined field-icon">location_on</span>
                                    </div>
                                </label>

                                <div className="form-field">
                                    <span className="field-label">Mode de travail</span>
                                    <div className="radio-group">
                                        {['onsite', 'hybrid', 'remote'].map(mode => (
                                            <label key={mode} className="radio-option">
                                                <input type="radio" name="workMode" value={mode} checked={formData.workMode === mode} onChange={handleChange} />
                                                <span>{mode === 'onsite' ? 'Sur site' : mode === 'hybrid' ? 'Hybride' : 'Télétravail'}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2 */}
                        <div className="form-section">
                            <div className="section-header-simple">
                                <h2 className="job-edit-section-title">2. Contenu de l'Annonce</h2>
                            </div>
                            <div className="form-grid">
                                <label className="form-field col-span-2">
                                    <span className="field-label">Présentation / Description</span>
                                    <textarea name="description" className="form-textarea" placeholder="Décrivez le contexte et l'entreprise..." value={formData.description} onChange={handleChange} required />
                                </label>
                                <label className="form-field col-span-2">
                                    <span className="field-label">Missions du poste</span>
                                    <textarea name="missions" className="form-textarea" placeholder="Listez les responsabilités..." value={formData.missions} onChange={handleChange} />
                                </label>
                                <label className="form-field col-span-2">
                                    <span className="field-label">{t('hr-jobs-field-profile')}</span>
                                    <textarea name="profile" className="form-textarea" placeholder="ex: 3 ans d'expérience, Rigoureux..." value={formData.profile} onChange={handleChange} />
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
                                        <select name="experience" className="form-select" value={formData.experience} onChange={handleChange}>
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

                        {/* Section 3 */}
                        <div className="form-section">
                            <div className="section-header-simple">
                                <h2 className="job-edit-section-title">3. Rémunération</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-field">
                                    <span className="field-label">Fourchette salariale</span>
                                    <div className="salary-group">
                                        <input type="number" name="salaryMin" className="form-input" placeholder="Min" value={formData.salaryMin} onChange={handleChange} />
                                        <span className="salary-sep">-</span>
                                        <input type="number" name="salaryMax" className="form-input" placeholder="Max" value={formData.salaryMax} onChange={handleChange} />
                                        <div className="select-wrapper currency-select">
                                            <select name="currency" className="form-select" value={formData.currency} onChange={handleChange}>
                                                <option value="tnd">TND</option>
                                                <option value="eur">EUR</option>
                                                <option value="usd">USD</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 4 */}
                        <div className="form-section">
                            <div className="section-header-simple">
                                <h2 className="job-edit-section-title">4. Paramètres</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-field col-span-2">
                                    <div className="field-header">
                                        <span className="field-label">Questions de filtrage</span>
                                        <button type="button" className="btn-text" onClick={addQuestion}>
                                            <span className="material-symbols-outlined">add</span> Ajouter
                                        </button>
                                    </div>
                                    <div className="dynamic-fields">
                                        {questions.map((q, idx) => (
                                            <div key={q.id} className="dynamic-input-group">
                                                <input type="text" className="form-input" placeholder="ex: Avez-vous le permis B ?" value={q.text}
                                                    onChange={(e) => { const n = [...questions]; n[idx].text = e.target.value; setQuestions(n); }} />
                                                <button type="button" className="btn-icon-danger" onClick={() => removeQuestion(q.id)}>
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <label className="form-field">
                                    <span className="field-label">Email de notification</span>
                                    <input type="email" name="notificationEmail" className="form-input" placeholder="recrutement@entreprise.com" value={formData.notificationEmail} onChange={handleChange} />
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Date limite</span>
                                    <div className="input-with-icon">
                                        <input type="date" name="deadline" className="form-input" value={formData.deadline} onChange={handleChange} />
                                        <span className="material-symbols-outlined field-icon">calendar_today</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <AIAutomationSection
                            config={aiAutomation}
                            onChange={setAiAutomation}
                            errors={aiAutomationErrors}
                            parametrage={parametrage}
                            aiEnabled={parametrage?.ai_enabled !== false}
                            sectionDescription="These settings are stored on the job now and can be edited here. Execution logic comes later."
                        />

                        {/* Section 5 */}
                        <div className="form-section">
                            <div className="section-header-simple">
                                <h2 className="job-edit-section-title">5. Statut de l'offre</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-field">
                                    <div className="radio-group-vertical">
                                        {[
                                            { value: 'draft', title: 'Brouillon', desc: 'Visible uniquement par vous' },
                                            { value: 'published', title: 'Publiée', desc: 'Visible par tous les candidats' },
                                            { value: 'internal', title: 'Interne', desc: 'Visible par vos employés seulement' }
                                        ].map(opt => (
                                            <label key={opt.value} className="radio-option">
                                                <input type="radio" name="status" value={opt.value} checked={formData.status === opt.value} onChange={handleChange} />
                                                <div className="option-text">
                                                    <span className="option-title">{opt.title}</span>
                                                    <span className="option-desc">{opt.desc}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button type="button" className="btn btn-cancel" onClick={() => navigate(`/hr/offres/${id}`)} disabled={loading}>Annuler</button>
                            <button type="submit" className="btn btn-submit" disabled={loading}>
                                {loading ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default JobEdit;
