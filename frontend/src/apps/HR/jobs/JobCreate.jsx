import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import HRSidebar from '../components/HRSidebar';
import './JobCreate.css';

const JobCreate = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();

    // State for dynamic features like filtering questions
    const [questions, setQuestions] = useState([{ id: Date.now(), text: '' }]);

    const addQuestion = () => {
        setQuestions([...questions, { id: Date.now(), text: '' }]);
    };

    const removeQuestion = (id) => {
        setQuestions(questions.filter(q => q.id !== id));
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

                    <form className="job-create-form" onSubmit={(e) => e.preventDefault()}>

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
                                    <input type="text" className="form-input" placeholder="ex: Chef de Projet Marketing" />
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Département</span>
                                    <div className="select-wrapper">
                                        <select className="form-select">
                                            <option value="">Sélectionner un département</option>
                                            <option value="sales">Ventes</option>
                                            <option value="it">IT / Ingénierie</option>
                                            <option value="marketing">Marketing</option>
                                            <option value="hr">Ressources Humaines</option>
                                            <option value="finance">Finance</option>
                                        </select>
                                    </div>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Type de contrat</span>
                                    <div className="select-wrapper">
                                        <select className="form-select">
                                            <option value="">Sélectionner un type</option>
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
                                        <input type="text" className="form-input pl-10" placeholder="ex: Tunis, Sfax..." />
                                        <span className="material-symbols-outlined field-icon">location_on</span>
                                    </div>
                                </label>

                                <div className="form-field">
                                    <span className="field-label">Mode de travail</span>
                                    <div className="radio-group">
                                        <label className="radio-option">
                                            <input type="radio" name="workMode" value="onsite" />
                                            <span>Sur site</span>
                                        </label>
                                        <label className="radio-option">
                                            <input type="radio" name="workMode" value="hybrid" />
                                            <span>Hybride</span>
                                        </label>
                                        <label className="radio-option">
                                            <input type="radio" name="workMode" value="remote" />
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
                                        <textarea className="form-textarea minimal" placeholder="Vendez la culture de votre boîte..."></textarea>
                                    </div>
                                </label>

                                <label className="form-field col-span-2">
                                    <span className="field-label">Missions du poste</span>
                                    <textarea className="form-textarea" placeholder="Listez les responsabilités quotidiennes..."></textarea>
                                </label>

                                <label className="form-field col-span-2">
                                    <span className="field-label">Profil recherché</span>
                                    <textarea className="form-textarea" placeholder="Détaillez les Hard & Soft Skills attendus..."></textarea>
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Niveau d'expérience</span>
                                    <div className="select-wrapper">
                                        <select className="form-select">
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
                                        <input type="number" className="form-input" placeholder="Min" />
                                        <span className="salary-sep">-</span>
                                        <input type="number" className="form-input" placeholder="Max" />
                                        <div className="select-wrapper currency-select">
                                            <select className="form-select">
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
                                        <select className="form-select">
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
                                                <input type="text" className="form-input" placeholder="ex: Avez-vous le permis B ?" />
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
                                    <input type="email" className="form-input" placeholder="recrutement@entreprise.com" />
                                </label>

                                <label className="form-field">
                                    <span className="field-label">Date limite de publication</span>
                                    <div className="input-with-icon">
                                        <input type="date" className="form-input pl-10" />
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
                                            <input type="radio" name="jobStatus" value="draft" defaultChecked />
                                            <div className="option-text">
                                                <span className="option-title">Brouillon</span>
                                                <span className="option-desc">Visible uniquement par vous</span>
                                            </div>
                                        </label>
                                        <label className="radio-option">
                                            <input type="radio" name="jobStatus" value="published" />
                                            <div className="option-text">
                                                <span className="option-title">Publiée</span>
                                                <span className="option-desc">Visible par tous les candidats</span>
                                            </div>
                                        </label>
                                        <label className="radio-option">
                                            <input type="radio" name="jobStatus" value="internal" />
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
                            >
                                Annuler
                            </button>
                            <button type="submit" className="btn btn-submit">
                                Créer l'offre d'emploi
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default JobCreate;
