import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../core/api';
import { useLanguage } from '../../../core/useLanguage';
import './OnboardingModal.css';

const OnboardingModal = ({ profile, onComplete }) => {
    const { t } = useLanguage();
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
            alert(t('hr-modal-onboarding-error-save'));
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
                        <h1 className="onboarding-title">{t('hr-modal-onboarding-welcome-title')}</h1>
                        <p className="onboarding-desc">
                            {t('hr-modal-onboarding-welcome-desc')}
                        </p>
                        <button className="onboarding-btn-primary" onClick={handleNext}>
                            {t('hr-modal-onboarding-welcome-cta')}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="onboarding-slide config-slide">
                        <h2 className="onboarding-title-small">{t('hr-modal-onboarding-config-title')}</h2>
                        <p className="onboarding-desc-small">
                            {t('hr-modal-onboarding-config-desc')}
                        </p>

                        <div className="onboarding-form">
                            <div className="onboarding-field">
                                <label>{t('hr-modal-onboarding-company-name-label')}</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={companyInfo.name}
                                    onChange={handleInfoChange}
                                    placeholder={t('hr-modal-onboarding-company-name-placeholder')}
                                />
                            </div>
                            <div className="onboarding-field">
                                <label>{t('hr-modal-onboarding-website-label')}</label>
                                <input
                                    type="url"
                                    name="website"
                                    value={companyInfo.website}
                                    onChange={handleInfoChange}
                                    placeholder={t('hr-modal-onboarding-website-placeholder')}
                                />
                            </div>
                            <div className="onboarding-field">
                                <label>{t('hr-modal-onboarding-sector-label')}</label>
                                <select name="sector" value={companyInfo.sector} onChange={handleInfoChange}>
                                    <option value="">{t('hr-modal-onboarding-sector-placeholder')}</option>
                                    <option value="tech">{t('hr-modal-onboarding-sector-tech')}</option>
                                    <option value="finance">{t('hr-modal-onboarding-sector-finance')}</option>
                                    <option value="sante">{t('hr-modal-onboarding-sector-health')}</option>
                                    <option value="retail">{t('hr-modal-onboarding-sector-retail')}</option>
                                    <option value="autre">{t('hr-modal-onboarding-sector-other')}</option>
                                </select>
                            </div>
                            <div className="onboarding-field">
                                <label>{t('hr-modal-onboarding-desc-label')}</label>
                                <textarea
                                    name="description"
                                    value={companyInfo.description}
                                    onChange={handleInfoChange}
                                    placeholder={t('hr-modal-onboarding-desc-placeholder')}
                                />
                            </div>
                        </div>

                        <div className="onboarding-actions">
                            <button className="onboarding-btn-primary" onClick={handleNext}>
                                {t('hr-modal-onboarding-next')}
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="onboarding-slide final-slide">
                        <div className="onboarding-icon-wrapper success">
                            <span className="material-symbols-outlined">task_alt</span>
                        </div>
                        <h1 className="onboarding-title">{t('hr-modal-onboarding-final-title')}</h1>
                        <p className="onboarding-desc">
                            {t('hr-modal-onboarding-final-desc')}
                        </p>
                        <button className="onboarding-btn-primary" onClick={handleFinish} disabled={loading}>
                            {loading ? t('hr-modal-onboarding-finalizing') : t('hr-modal-onboarding-go-dashboard')}
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
