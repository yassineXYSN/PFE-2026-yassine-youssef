import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { getStoredUserId } from '../../../core/apiClient';
import { apiFetch, SERVER_URL } from '../../../core/api';
import { useLanguage } from '../../../core/useLanguage';
import ImageCropperModal from '../components/ImageCropperModal';
import MapLocationPicker from '../../../components/MapLocationPicker';
import './CompanyCreation.css';

const CompanyCreation = () => {
    const { effectiveTheme } = useTheme();
    const { t } = useLanguage();
    const navigate = useNavigate();

    // Helper to get full image URL
    const getFullImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('blob:') || path.startsWith('http')) return path;
        return `${SERVER_URL}${path}`;
    };
    const [step, setStep] = useState(1); // 1-6 = Company Form
    const [isLoading, setIsLoading] = useState(true);

    // Cropper State
    const [imageToCrop, setImageToCrop] = useState(null);
    const [isCropperOpen, setIsCropperOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        // Step 1
        name: '',
        siret: '',
        address: '',
        latitude: null,
        longitude: null,
        sector: '',
        // Step 2
        // (position map only)
        // Step 3
        city: '',
        zipCode: '',
        country: '',
        email: '',
        phone: '',
        website: '',
        employeeCount: '',
        // Step 3
        description: '',
        values: [],
        benefits: [],
        // Step 4
        logo: null,       // preview URL (blob or server URL)
        logoUrl: '',      // persisted server URL
        primaryColor: '#000000',
        linkedin: '',
        twitter: '',
        // Step 5
        members: []
    });

    // Temp state for benefits input
    const [newMember, setNewMember] = useState({ email: '', role: 'recruiter' });
    const [benefitInput, setBenefitInput] = useState("");
    const [valueInput, setValueInput] = useState("");
    const [mapLocationError, setMapLocationError] = useState('');
    const [isLoadingData, setIsLoadingData] = useState(true);
    const fileInputRef = useRef(null);
    const logoPreviewUrlRef = useRef(null);

    // Pre-fill form with existing company data created by SuperAdmin
    useEffect(() => {
        const fetchExistingData = async () => {
            try {
                const user = { id: getStoredUserId() };
                if (!user) return;

                const profile = await apiFetch(`/profiles/${user.id}`);
                const companyId = profile?.company_id;
                if (!companyId) return;

                const company = await apiFetch(`/companies/${companyId}`);
                if (!company) return;

                setFormData(prev => ({
                    ...prev,
                    name: company.name || '',
                    siret: company.siret || '',
                    address: company.address || '',
                    latitude: typeof company.latitude === 'number' ? company.latitude : null,
                    longitude: typeof company.longitude === 'number' ? company.longitude : null,
                    sector: company.domain || '',
                    city: company.city || '',
                    zipCode: company.zip_code || '',
                    country: company.country || '',
                    // contact fields — backend stores as email/phone
                    email: company.contact_email || company.email || '',
                    phone: company.contact_phone || company.phone || '',
                    website: company.website || '',
                    employeeCount: company.employee_count || '',
                    description: company.description || '',
                    values: Array.isArray(company.values) ? company.values : (typeof company.values === 'string' ? company.values.split(',').filter(v => v.trim()) : []),
                    benefits: Array.isArray(company.benefits) ? company.benefits : [],
                    linkedin: company.linkedin || '',
                    twitter: company.twitter || '',
                    primaryColor: company.primary_color || '#000000',
                    logo: company.logo_url || null,
                    logoUrl: company.logo_url || '',
                }));
            } catch (err) {
                console.warn('Could not pre-fill company data:', err.message);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchExistingData();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNext = async (e) => {
        if (e) e.preventDefault();

        if (step === 2) {
            if (formData.latitude == null || formData.longitude == null) {
                setMapLocationError(t('hr-onboard-step2-map-error'));
                return;
            }
            setMapLocationError('');
            setStep(3);
            return;
        }

        if (step < 6) {
            setStep(step + 1);
            return;
        }

        // Final Step - Submit to backend
        setIsSubmitting(true);
        try {
            const user = { id: getStoredUserId() };
            if (!user) throw new Error("Non authentifié");

            // 1. Get current profile to find company ID (should be created by SuperAdmin)
            const profile = await apiFetch(`/profiles/${user.id}`);
            const companyId = profile.company_id;

            // 2. Update Company Details — send all collected fields
            if (companyId) {
                await apiFetch(`/companies/${companyId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: formData.name || undefined,
                        siret: formData.siret || undefined,
                        domain: formData.sector || undefined,
                        size: formData.size || undefined,
                        employee_count: formData.employeeCount ? parseInt(formData.employeeCount) : undefined,
                        description: formData.description || undefined,
                        values: formData.values || undefined,
                        benefits: formData.benefits && formData.benefits.length > 0
                            ? formData.benefits : undefined,
                        email: formData.email || undefined,
                        phone: formData.phone || undefined,
                        website: formData.website || undefined,
                        address: formData.address || undefined,
                        city: formData.city || undefined,
                        zip_code: formData.zipCode || undefined,
                        country: formData.country || undefined,
                        latitude: typeof formData.latitude === 'number' ? formData.latitude : undefined,
                        longitude: typeof formData.longitude === 'number' ? formData.longitude : undefined,
                        linkedin: formData.linkedin || undefined,
                        twitter: formData.twitter || undefined,
                        primary_color: formData.primaryColor || undefined,
                        onboarding_done: true,
                    })
                });
            }

            // 3. Update User Profile to mark onboarding as done
            await apiFetch(`/profiles/${user.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    preferences: {
                        ...profile.preferences,
                        onboarding_done: true
                    }
                })
            });

            // Navigate to dashboard
            navigate('/hr/dashboard');
        } catch (error) {
            console.error("Error submitting onboarding:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const addMember = () => {
        if (newMember.email) {
            setFormData(prev => ({
                ...prev,
                members: [...prev.members, {
                    id: Date.now(),
                    email: newMember.email,
                    role: newMember.role,
                    status: 'pending',
                    addedAt: t('hr-onboard-step6-added-at')
                }]
            }));
            setNewMember({ email: '', role: 'recruiter' });
        }
    };

    const removeMember = (id) => {
        setFormData(prev => ({
            ...prev,
            members: prev.members.filter(m => m.id !== id)
        }));
    };

    const addBenefit = (e) => {
        if (e.key === 'Enter' && benefitInput.trim()) {
            e.preventDefault();
            if (!formData.benefits.includes(benefitInput.trim())) {
                setFormData(prev => ({
                    ...prev,
                    benefits: [...prev.benefits, benefitInput.trim()]
                }));
            }
            setBenefitInput("");
        }
    };

    const removeBenefit = (index) => {
        setFormData(prev => ({
            ...prev,
            benefits: prev.benefits.filter((_, i) => i !== index)
        }));
    };

    const addValue = (e) => {
        if (e.key === 'Enter' && valueInput.trim()) {
            e.preventDefault();
            if (!formData.values.includes(valueInput.trim())) {
                setFormData(prev => ({
                    ...prev,
                    values: [...prev.values, valueInput.trim()]
                }));
            }
            setValueInput("");
        }
    };

    const removeValue = (index) => {
        setFormData(prev => ({
            ...prev,
            values: prev.values.filter((_, i) => i !== index)
        }));
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        // Allow selecting the same file again later.
        e.target.value = '';
        if (!file) return;

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setImageToCrop(reader.result);
            setIsCropperOpen(true);
        });
        reader.readAsDataURL(file);
    };

    const handleCropComplete = async (croppedBlob) => {
        setIsCropperOpen(false);
        setImageToCrop(null);
        if (!croppedBlob) return;

        // Preview
        if (logoPreviewUrlRef.current) {
            URL.revokeObjectURL(logoPreviewUrlRef.current);
            logoPreviewUrlRef.current = null;
        }
        const previewUrl = URL.createObjectURL(croppedBlob);
        logoPreviewUrlRef.current = previewUrl;
        setFormData(prev => ({ ...prev, logo: previewUrl }));

        try {
            const user = { id: getStoredUserId() };
            if (!user) return;
            const profile = await apiFetch(`/profiles/${user.id}`);
            const companyId = profile?.company_id;
            if (!companyId) return;

            const formPayload = new FormData();
            formPayload.append('file', croppedBlob, 'logo.png');

            const result = await apiFetch(`/companies/${companyId}/logo`, {
                method: 'POST',
                body: formPayload,
            });

            const { logo_url } = result;
            if (logoPreviewUrlRef.current) {
                URL.revokeObjectURL(logoPreviewUrlRef.current);
                logoPreviewUrlRef.current = null;
            }
            setFormData(prev => ({ ...prev, logo: logo_url, logoUrl: logo_url }));
        } catch (err) {
            console.warn('Logo upload error:', err.message);
        }
    };

    useEffect(() => {
        return () => {
            if (logoPreviewUrlRef.current) {
                URL.revokeObjectURL(logoPreviewUrlRef.current);
            }
        };
    }, []);

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <>
                        <div className="cc-form-row">
                            <label className="cc-label">
                                <span className="cc-label-text">{t('hr-onboard-step1-name')}</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">domain</span>
                                    <input
                                        className="cc-input"
                                        type="text"
                                        name="name"
                                        placeholder="Ex: Carthage Digital SARL"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </label>
                            <label className="cc-label">
                                <span className="cc-label-text">{t('hr-onboard-step1-siret')}</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">badge</span>
                                    <input
                                        className="cc-input"
                                        type="text"
                                        name="siret"
                                        placeholder="1234567A"
                                        value={formData.siret}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </label>
                        </div>
                        <label className="cc-label">
                            <span className="cc-label-text">{t('hr-onboard-step1-address')}</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">location_on</span>
                                <input
                                    className="cc-input"
                                    type="text"
                                    name="address"
                                    placeholder="Ex: 12 Avenue Habib Bourguiba, Sousse"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </label>
                        <label className="cc-label">
                            <span className="cc-label-text">{t('hr-onboard-step1-sector')}</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">category</span>
                                <select
                                    className="cc-select"
                                    name="sector"
                                    value={formData.sector}
                                    onChange={handleInputChange}
                                >
                                    <option disabled value="">{t('hr-onboard-step1-sector-ph')}</option>
                                    <option value="tech">{t('hr-onboard-sector-tech')}</option>
                                    <option value="finance">{t('hr-onboard-sector-finance')}</option>
                                    <option value="sante">{t('hr-onboard-sector-health')}</option>
                                    <option value="retail">{t('hr-onboard-sector-retail')}</option>
                                    <option value="industrie">{t('hr-onboard-sector-industry')}</option>
                                    <option value="education">{t('hr-onboard-sector-education')}</option>
                                    <option value="autre">{t('hr-onboard-sector-other')}</option>
                                </select>
                                <span className="material-symbols-outlined cc-select-arrow">arrow_drop_down</span>
                            </div>
                        </label>
                    </>
                );
            case 2:
                return (
                    <>
                        <div className="cc-map-block">
                            <span className="cc-label-text">{t('hr-onboard-step2-map')}</span>
                            <MapLocationPicker
                                latitude={formData.latitude}
                                longitude={formData.longitude}
                                height={420}
                                className="cc-map-picker"
                                onLocationChange={({ latitude: lat, longitude: lng }) => {
                                    setMapLocationError('');
                                    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
                                }}
                            />
                            {mapLocationError ? (
                                <p className="cc-map-error" role="alert">{mapLocationError}</p>
                            ) : null}
                        </div>
                    </>
                );
            case 3:
                return (
                    <>
                        <div className="cc-form-row">
                            <label className="cc-label">
                                <span className="cc-label-text">{t('hr-onboard-step3-city')}</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">apartment</span>
                                    <input className="cc-input" type="text" name="city" placeholder="Sfax" value={formData.city} onChange={handleInputChange} />
                                </div>
                            </label>
                            <label className="cc-label">
                                <span className="cc-label-text">{t('hr-onboard-step3-zip')}</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">mail</span>
                                    <input className="cc-input" type="text" name="zipCode" placeholder="3000" value={formData.zipCode} onChange={handleInputChange} />
                                </div>
                            </label>
                        </div>
                        <label className="cc-label">
                            <span className="cc-label-text">{t('hr-onboard-step3-country')}</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">public</span>
                                <input className="cc-input" type="text" name="country" placeholder="Tunisie" value={formData.country} onChange={handleInputChange} />
                            </div>
                        </label>
                        <div className="cc-form-row">
                            <label className="cc-label">
                                <span className="cc-label-text">{t('hr-onboard-step3-email')}</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">alternate_email</span>
                                    <input className="cc-input" type="email" name="email" placeholder="contact@carthagedigital.tn" value={formData.email} onChange={handleInputChange} />
                                </div>
                            </label>
                            <label className="cc-label">
                                <span className="cc-label-text">{t('hr-onboard-step3-phone')}</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">call</span>
                                    <input className="cc-input" type="tel" name="phone" placeholder="+216 74 123 456" value={formData.phone} onChange={handleInputChange} />
                                </div>
                            </label>
                        </div>
                        <label className="cc-label">
                            <span className="cc-label-text">{t('hr-onboard-step3-website')}</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">language</span>
                                <input className="cc-input" type="url" name="website" placeholder="https://www.carthagedigital.tn" value={formData.website} onChange={handleInputChange} />
                            </div>
                        </label>
                        <label className="cc-label">
                            <span className="cc-label-text">Number of employees</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">group</span>
                                <input className="cc-input" type="number" name="employeeCount" placeholder="e.g., 50" value={formData.employeeCount} onChange={handleInputChange} min="0" />
                            </div>
                        </label>
                    </>
                );
            case 4:
                return (
                    <>
                        <label className="cc-label">
                            <span className="cc-label-text">{t('hr-onboard-step4-description')}</span>
                            <div className="cc-input-wrapper">
                                <textarea
                                    className="cc-textarea"
                                    name="description"
                                    placeholder={t('hr-onboard-step4-description-ph')}
                                    value={formData.description}
                                    onChange={handleInputChange}
                                ></textarea>
                            </div>
                        </label>
                        <label className="cc-label">
                            <span className="cc-label-text">{t('hr-onboard-step4-values')}</span>
                            <div className="cc-tags-container">
                                {formData.values.map((val, idx) => (
                                    <button key={idx} type="button" className="cc-tag-btn active" onClick={() => removeValue(idx)}>
                                        {val} ✕
                                    </button>
                                ))}
                                <input
                                    className="cc-input"
                                    style={{ width: 'auto', flex: 1, minWidth: '200px', paddingLeft: '1rem' }}
                                    type="text"
                                    placeholder={t('hr-onboard-step4-values-ph')}
                                    value={valueInput}
                                    onChange={(e) => setValueInput(e.target.value)}
                                    onKeyDown={addValue}
                                />
                            </div>
                        </label>
                        <label className="cc-label">
                            <span className="cc-label-text">{t('hr-onboard-step4-benefits')}</span>
                            <div className="cc-tags-container">
                                {formData.benefits.map((benefit, idx) => (
                                    <button key={idx} type="button" className="cc-tag-btn active" onClick={() => removeBenefit(idx)}>
                                        {benefit} ✕
                                    </button>
                                ))}
                                <input
                                    className="cc-input"
                                    style={{ width: 'auto', flex: 1, minWidth: '200px', paddingLeft: '1rem' }}
                                    type="text"
                                    placeholder={t('hr-onboard-step4-benefits-ph')}
                                    value={benefitInput}
                                    onChange={(e) => setBenefitInput(e.target.value)}
                                    onKeyDown={addBenefit}
                                />
                            </div>
                        </label>
                    </>
                );
            case 5:
                return (
                    <>
                        <div className="cc-form-row">
                            <label className="cc-label" style={{ flex: 1 }}>
                                <span className="cc-label-text">{t('hr-onboard-step5-logo')}</span>
                                <label
                                    htmlFor="cc-company-logo-input"
                                    className="cc-upload-area"
                                    style={formData.logo ? { backgroundImage: `url(${getFullImageUrl(formData.logo)})`, borderStyle: 'solid' } : {}}
                                >
                                    <input
                                        id="cc-company-logo-input"
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                    />
                                    {!formData.logo && (
                                        <>
                                            <div className="cc-upload-icon-box">
                                                <span className="material-symbols-outlined">cloud_upload</span>
                                            </div>
                                            <div className="cc-upload-text-group">
                                                <p className="cc-upload-title">{t('hr-onboard-step5-logo-click')}</p>
                                                <p className="cc-upload-subtitle">{t('hr-onboard-step5-logo-formats')}</p>
                                            </div>
                                        </>
                                    )}
                                </label>
                            </label>
                        </div>

                        <label className="cc-label">
                            <span className="cc-label-text">{t('hr-onboard-step5-color')}</span>
                            <div className="cc-color-picker-row">
                                <div className="cc-color-input-wrapper">
                                    <input
                                        type="color"
                                        name="primaryColor"
                                        className="cc-color-input"
                                        value={formData.primaryColor || '#000000'}
                                        onChange={handleInputChange}
                                    />
                                    <div className="cc-input-wrapper" style={{ flex: 1 }}>
                                        <span className="cc-input-icon" style={{ left: '1rem', fontSize: '1rem' }}>#</span>
                                        <input
                                            type="text"
                                            className="cc-input"
                                            style={{ paddingLeft: '2rem', textTransform: 'uppercase' }}
                                            value={formData.primaryColor ? formData.primaryColor.replace('#', '') : '000000'}
                                            readOnly
                                        />
                                    </div>
                                </div>
                                <div className="cc-color-help">
                                    {t('hr-onboard-step5-color-help')}
                                </div>
                            </div>
                        </label>

                        <div className="cc-form-row">
                            <label className="cc-label">
                                <span className="cc-label-text">{t('hr-onboard-step5-social')}</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">work</span>
                                    <input
                                        className="cc-input"
                                        type="url"
                                        name="linkedin"
                                        placeholder="Lien LinkedIn de l'entreprise (ex: https://linkedin.com/company/carthagedigital)"
                                        value={formData.linkedin || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="cc-input-wrapper" style={{ marginTop: '0.75rem' }}>
                                    <span className="material-symbols-outlined cc-input-icon">alternate_email</span>
                                    <input
                                        className="cc-input"
                                        type="url"
                                        name="twitter"
                                        placeholder="Lien X (ex: https://x.com/carthagedigital)"
                                        value={formData.twitter || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </label>
                        </div>
                    </>
                );
            case 6:
                return (
                    <>
                        {/* Add Member Box */}
                        <div className="cc-add-member-box">
                            <h3 className="cc-section-title">{t('hr-onboard-step6-add-member')}</h3>
                            <div className="cc-add-member-form">
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <span className="material-symbols-outlined cc-input-icon">mail</span>
                                    <input
                                        className="cc-input"
                                        type="email"
                                        placeholder="nom.prenom@carthagedigital.tn"
                                        value={newMember.email}
                                        onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                                    />
                                </div>
                                <div style={{ width: '100%', maxWidth: '200px', position: 'relative' }}>
                                    <select
                                        className="cc-select"
                                        value={newMember.role}
                                        onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                                    >
                                        <option value="recruiter">{t('hr-onboard-step6-member-role-recruiter')}</option>
                                        <option value="admin">{t('hr-onboard-step6-member-role-admin')}</option>
                                    </select>
                                    <span className="material-symbols-outlined cc-select-arrow">expand_more</span>
                                </div>
                                <button type="button" className="cc-btn-add" onClick={addMember}>
                                    <span className="material-symbols-outlined">add</span>
                                    <span className="cc-btn-text">{t('hr-onboard-step6-btn-add')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Members List */}
                        <div className="cc-members-section">
                            <div className="cc-members-header">
                                <h3 className="cc-section-title" style={{ fontSize: '1rem', color: 'var(--cc-primary)' }}>
                                    {t('hr-onboard-step6-invited', { count: formData.members.length })}
                                </h3>
                                <div className="cc-badge-neutral">{t('hr-onboard-step6-seats', { count: formData.members.length })}</div>
                            </div>
                            <div className="cc-members-list">
                                {formData.members.map(member => (
                                    <div key={member.id} className="cc-member-card">
                                        <div className="cc-member-info">
                                            <div className={`cc-member-avatar ${member.role === 'admin' ? 'blue' : 'purple'}`}>
                                                {member.email.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span className="cc-member-email">{member.email}</span>
                                                <div className="cc-member-meta">
                                                    <span className="cc-status-text">{t('hr-onboard-step6-pending')}</span>
                                                    <span className="cc-dot"></span>
                                                    <span>{t('hr-onboard-step6-added-at')} {member.addedAt}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="cc-member-actions">
                                            <div className="cc-role-badge">
                                                {member.role === 'admin' ? t('hr-onboard-step6-role-admin') : t('hr-onboard-step6-role-recruiter')}
                                            </div>
                                            <button
                                                type="button"
                                                className="cc-btn-remove"
                                                onClick={() => removeMember(member.id)}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                );
            default:
                return null;
        }
    };

    const getReviewText = () => {
        switch (step) {
            case 1: return t('hr-onboard-review-1');
            case 2: return t('hr-onboard-review-2');
            case 3: return t('hr-onboard-review-3');
            case 4: return t('hr-onboard-review-4');
            case 5: return t('hr-onboard-review-5');
            case 6: return t('hr-onboard-review-6');
            default: return "";
        }
    };

    return (
        <div className={`company-creation-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>

            {/* Loading overlay while fetching existing data */}
            {isLoadingData && (
                <div className="cc-loading-overlay">
                    <div className="fine-linear-loader" style={{ maxWidth: '300px' }}></div>
                    <p style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        opacity: 0.4,
                        marginTop: '1rem'
                    }}>
                        {t('hr-onboard-loading')}
                    </p>
                </div>
            )}

            {/* Main Content */}
            <main className="cc-main">
                <div className="cc-container">
                    {/* Progress Bar Section */}
                    <div className="cc-progress-section">
                        <div className="cc-progress-labels">
                            <p className="cc-step-count">{t('hr-onboard-step-of', { step })}</p>
                            <p className="cc-step-name">{getReviewText()}</p>
                        </div>
                        <div className="cc-progress-track">
                            <div
                                className="cc-progress-fill"
                                style={{ width: `${(step / 6) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Card Container */}
                    <div className="cc-card">
                        {/* Page Heading */}
                        <div className="cc-heading-group">
                            <h1 className="cc-title">
                                {step === 6 ? t('hr-onboard-title-team') : t('hr-onboard-title-company')}
                            </h1>
                            <p className="cc-subtitle">
                                {step === 6 ? t('hr-onboard-subtitle-team') : t('hr-onboard-subtitle-company')}
                            </p>
                        </div>

                        {/* Form Fields */}
                        <form className="cc-form" onSubmit={handleNext}>
                            {renderStepContent()}

                            {/* Spacing */}
                            <div style={{ height: '1rem' }}></div>

                            {/* Action Buttons */}
                            <div className="cc-actions">
                                {step > 1 && (
                                    <button type="button" className="cc-btn-back" onClick={handleBack} disabled={isSubmitting}>
                                        {t('hr-onboard-btn-back')}
                                    </button>
                                )}
                                <button className="cc-btn-next" type="submit" disabled={isSubmitting}>
                                    <span>
                                        {isSubmitting ? t('hr-onboard-btn-processing') : step === 6 ? t('hr-onboard-btn-finish') : t('hr-onboard-btn-next')}
                                    </span>
                                    {!isSubmitting && (
                                        <span className="material-symbols-outlined">
                                            {step === 6 ? 'check_circle' : 'arrow_forward'}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                </div>
            </main>

            {/* Background Decorative Element */}
            <div className="cc-bg-gradient">
                <div className="cc-blob-1"></div>
                <div className="cc-blob-2"></div>
            </div>

            {isCropperOpen && imageToCrop ? (
                <ImageCropperModal
                    image={imageToCrop}
                    onCropComplete={handleCropComplete}
                    onCancel={() => {
                        setIsCropperOpen(false);
                        setImageToCrop(null);
                    }}
                />
            ) : null}
        </div>
    );
};

export default CompanyCreation;
