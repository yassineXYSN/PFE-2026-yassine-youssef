import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../core/api';
import './OnboardingModal.css';

const OnboardingModal = ({ profile, onComplete }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [companyInfo, setCompanyInfo] = useState({
        name: '',
        website: '',
        sector: '',
        description: ''
    });

    useEffect(() => {
        const fetchCompany = async () => {
            if (profile.company_id) {
                try {
                    const data = await apiFetch(`/companies/${profile.company_id}`);
                    setCompanyInfo({
                        name: data.name || '',
                        website: data.website || '',
                        sector: data.sector || '',
                        description: data.description || ''
                    });
                } catch (err) {
                    console.error('Error fetching company for onboarding:', err);
                }
            }
        };
        fetchCompany();
    }, [profile.company_id]);

    const handleInfoChange = (e) => {
        const { name, value } = e.target;
        setCompanyInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleNext = () => setStep(step + 1);

    const handleFinish = async () => {
        setLoading(true);
        try {
            // 1. Update Company Info
            if (profile.company_id) {
                await apiFetch(`/companies/${profile.company_id}`, {
                    method: 'PUT',
                    body: JSON.stringify(companyInfo)
                });
            }

            // 2. Update User Profile Preferences
            const updatedPreferences = {
                ...(profile.preferences || {}),
                onboarding_done: true
            };
            await apiFetch(`/profiles/${profile._id}`, {
                method: 'PUT',
                body: JSON.stringify({ preferences: updatedPreferences })
            });

            onComplete();
        } catch (err) {
            console.error('Onboarding update failed:', err);
            // Even if it fails, we might want to let the user through or show an error
            alert("Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-card">
                {step === 1 && (
                    <div className="onboarding-slide welcome-slide">
                        <div className="onboarding-icon-wrapper">
                            <span className="material-symbols-outlined">celebration</span>
                        </div>
                        <h1 className="onboarding-title">Bienvenue sur HumatiQ !</h1>
                        <p className="onboarding-desc">
                            Nous sommes ravis de vous compter parmi nous. HumatiQ va transformer votre manière de recruter grâce à une gestion fluide et intelligente.
                        </p>
                        <button className="onboarding-btn-primary" onClick={handleNext}>
                            Commencer la configuration
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="onboarding-slide config-slide">
                        <h2 className="onboarding-title-small">Configurons votre entreprise</h2>
                        <p className="onboarding-desc-small">
                            Ces informations seront visibles par les candidats sur vos offres d'emploi.
                        </p>

                        <div className="onboarding-form">
                            <div className="onboarding-field">
                                <label>Nom de l'entreprise</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={companyInfo.name}
                                    onChange={handleInfoChange}
                                    placeholder="Ex: Humatiq Tech"
                                />
                            </div>
                            <div className="onboarding-field">
                                <label>Site Web</label>
                                <input
                                    type="url"
                                    name="website"
                                    value={companyInfo.website}
                                    onChange={handleInfoChange}
                                    placeholder="https://www.entreprise.com"
                                />
                            </div>
                            <div className="onboarding-field">
                                <label>Secteur d'activité</label>
                                <select name="sector" value={companyInfo.sector} onChange={handleInfoChange}>
                                    <option value="">Sélectionner un secteur</option>
                                    <option value="tech">Technologie</option>
                                    <option value="finance">Finance</option>
                                    <option value="sante">Santé</option>
                                    <option value="retail">Commerce</option>
                                    <option value="autre">Autre</option>
                                </select>
                            </div>
                            <div className="onboarding-field">
                                <label>Description courte</label>
                                <textarea
                                    name="description"
                                    value={companyInfo.description}
                                    onChange={handleInfoChange}
                                    placeholder="En quelques mots, que fait votre entreprise ?"
                                />
                            </div>
                        </div>

                        <div className="onboarding-actions">
                            <button className="onboarding-btn-primary" onClick={handleNext}>
                                Suivant
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="onboarding-slide final-slide">
                        <div className="onboarding-icon-wrapper success">
                            <span className="material-symbols-outlined">task_alt</span>
                        </div>
                        <h1 className="onboarding-title">Tout est prêt !</h1>
                        <p className="onboarding-desc">
                            Votre configuration initiale est terminée. Vous pouvez maintenant commencer à créer des départements et publier des offres d'emploi.
                        </p>
                        <button className="onboarding-btn-primary" onClick={handleFinish} disabled={loading}>
                            {loading ? 'Finalisation...' : "Accéder au tableau de bord"}
                        </button>
                    </div>
                )}

                <div className="onboarding-progress">
                    <div className={`progress-dot ${step >= 1 ? 'active' : ''}`}></div>
                    <div className={`progress-dot ${step >= 2 ? 'active' : ''}`}></div>
                    <div className={`progress-dot ${step >= 3 ? 'active' : ''}`}></div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingModal;
