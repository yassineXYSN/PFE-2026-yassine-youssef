import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { apiFetch, SERVER_URL } from '../../../../core/api';
import { getStoredUserId } from '../../../../core/apiClient';
import HRSidebar from '../../components/HRSidebar';
import ImageCropperModal from '../../components/ImageCropperModal';
import { useLanguage } from '../../../../core/useLanguage';
import './CompanyProfile.css';

const CompanyProfile = () => {
    const { effectiveTheme } = useTheme();
    const { t } = useLanguage();
    const [logo, setLogo] = useState(null);
    const [logoUrl, setLogoUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [companyId, setCompanyId] = useState(null);
    const fileInputRef = useRef(null);

    // Cropper State
    const [imageToCrop, setImageToCrop] = useState(null);
    const [isCropperOpen, setIsCropperOpen] = useState(false);

    // Helper to get full image URL
    const getFullImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('blob:') || path.startsWith('http')) return path;
        return `${SERVER_URL}${path}`;
    };

    // Form Data State
    const [formData, setFormData] = useState({
        companyName: "",
        sector: "",
        size: "100-500 employés",
        employeeCount: "",
        website: "",
        description: "",
        address: "",
        city: "",
        zipCode: "",
        country: "",
        email: "",
        phone: "",
        linkedin: "",
        values: [],
        benefits: []
    });

    useEffect(() => {
        fetchCompanyData();
    }, []);

    const fetchCompanyData = async () => {
        setIsLoading(true);
        try {
            const userId = getStoredUserId();
            if (!userId) return;

            const profile = await apiFetch(`/profiles/${userId}`);
            const cid = profile?.company_id;
            if (!cid) return;
            setCompanyId(cid);

            const company = await apiFetch(`/companies/${cid}`);
            if (company) {
                setFormData({
                    companyName: company.name || '',
                    sector: company.domain || '',
                    size: company.size || '100-500 employés',
                    employeeCount: company.employee_count || '',
                    website: company.website || '',
                    description: company.description || '',
                    address: company.address || '',
                    city: company.city || '',
                    zipCode: company.zip_code || '',
                    country: company.country || 'France',
                    email: company.email || company.contact_email || '',
                    phone: company.phone || company.contact_phone || '',
                    linkedin: company.linkedin || '',
                    values: Array.isArray(company.values) ? company.values : (typeof company.values === 'string' ? company.values.split(',').filter(v => v.trim()) : []),
                    benefits: Array.isArray(company.benefits) ? company.benefits : []
                });
                setLogo(company.logo_url);
                setLogoUrl(company.logo_url);
            }
        } catch (err) {
            console.error('Error fetching company profile:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogoClick = () => {
        if (isEditing) fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file || !companyId) return;

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setImageToCrop(reader.result);
            setIsCropperOpen(true);
        });
        reader.readAsDataURL(file);
    };

    const handleCropComplete = async (croppedBlob) => {
        setIsCropperOpen(false);
        if (!croppedBlob || !companyId) return;

        // Preview
        const previewUrl = URL.createObjectURL(croppedBlob);
        setLogo(previewUrl);

        try {
            const formPayload = new FormData();
            formPayload.append('file', croppedBlob, 'logo.png');

            const result = await apiFetch(`/companies/${companyId}/logo`, {
                method: 'POST',
                body: formPayload,
            });

            const { logo_url } = result;
            setLogo(logo_url);
            setLogoUrl(logo_url);
        } catch (err) {
            console.error('Logo upload error:', err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleEdit = () => {
        setIsEditing(!isEditing);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiFetch(`/companies/${companyId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: formData.companyName,
                    domain: formData.sector,
                    size: formData.size,
                    employee_count: formData.employeeCount ? parseInt(formData.employeeCount) : null,
                    website: formData.website,
                    description: formData.description,
                    address: formData.address,
                    city: formData.city,
                    zip_code: formData.zipCode,
                    country: formData.country,
                    email: formData.email,
                    phone: formData.phone,
                    linkedin: formData.linkedin,
                    values: formData.values,
                    benefits: formData.benefits
                })
            });
            setIsEditing(false);
        } catch (err) {
            console.error('Error saving company profile:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const removeBenefit = (index) => {
        if (!isEditing) return;
        setFormData(prev => ({
            ...prev,
            benefits: prev.benefits.filter((_, i) => i !== index)
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

    const removeValue = (index) => {
        if (!isEditing) return;
        setFormData(prev => ({
            ...prev,
            values: prev.values.filter((_, i) => i !== index)
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

    // Temp state for editing
    const [benefitInput, setBenefitInput] = useState("");
    const [valueInput, setValueInput] = useState("");

    const fullAddress = useMemo(() => {
        const cityLine = [formData.zipCode, formData.city].filter(Boolean).join(' ').trim();
        return [formData.address, cityLine || null, formData.country].filter(Boolean).join(', ');
    }, [formData.address, formData.city, formData.zipCode, formData.country]);

    const mapQuery = useMemo(() => {
        if (fullAddress) return fullAddress;
        if (typeof formData.latitude === 'number' && typeof formData.longitude === 'number') {
            return `${formData.latitude},${formData.longitude}`;
        }
        return '';
    }, [fullAddress, formData.latitude, formData.longitude]);

    if (isLoading) {
        return (
            <div className={`company-profile-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <div className="cp-layout-container">
                    <HRSidebar />
                    <main className="cp-main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <div className="fine-linear-loader" style={{ position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 1000 }}></div>
                         <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ textAlign: 'center' }}
                         >
                            <div className="loading-spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>{t('hr-company-loading')}</p>
                         </motion.div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className={`company-profile-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <div className="cp-layout-container">
                <HRSidebar />

                <main className="cp-main-content">
                    <div className="cp-header-bg"></div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="cp-layout-split"
                    >
                        <motion.aside
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="cp-identity-sidebar"
                        >
                            <div className="cp-identity-card glass-panel">
                                <div className={`cp-logo-section ${isEditing ? 'editable' : ''}`} onClick={handleLogoClick}>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        disabled={!isEditing}
                                    />
                                    <div className="cp-logo-xl" style={logo ? { backgroundImage: `url(${getFullImageUrl(logo)})` } : {}}>
                                        {!logo && <span className="material-symbols-outlined">business</span>}
                                        {isEditing && <div className="cp-edit-overlay"><span className="material-symbols-outlined">edit</span></div>}
                                    </div>
                                </div>

                                <div className="cp-identity-info">
                                    {isEditing ? (
                                        <input className="cp-input-title" type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} />
                                    ) : (
                                        <h1 className="cp-company-title">{formData.companyName || t('hr-company-name-placeholder')}</h1>
                                    )}

                                    <div className="cp-meta-row">
                                        {isEditing ? (
                                            <select className="cp-select-sm" name="sector" value={formData.sector} onChange={handleInputChange}>
                                                <option value="Technologie & Software">{t('hr-company-sector-tech')}</option>
                                                <option value="Finance">{t('hr-company-sector-finance')}</option>
                                                <option value="Santé">{t('hr-company-sector-health')}</option>
                                                <option value="Conseil">{t('hr-company-sector-consulting')}</option>
                                                <option value="Industrie">{t('hr-company-sector-industry')}</option>
                                                <option value="Education">{t('hr-company-sector-education')}</option>
                                                <option value="Autre">{t('hr-company-sector-other')}</option>
                                            </select>
                                        ) : (
                                            <span className="cp-meta-badge"><span className="material-symbols-outlined">domain</span> {formData.sector || t('hr-company-label-sector')}</span>
                                        )}
                                        {isEditing ? (
                                            <select className="cp-select-sm" name="size" value={formData.size} onChange={handleInputChange}>
                                                <option value="1-10 employés">{t('hr-company-size-1-10')}</option>
                                                <option value="11-50 employés">{t('hr-company-size-11-50')}</option>
                                                <option value="51-200 employés">{t('hr-company-size-51-200')}</option>
                                                <option value="201-500 employés">{t('hr-company-size-201-500')}</option>
                                                <option value="500+ employés">{t('hr-company-size-500plus')}</option>
                                            </select>
                                        ) : (
                                            <span className="cp-meta-badge"><span className="material-symbols-outlined">group</span> {formData.size}</span>
                                        )}
                                    </div>

                                    <div className="cp-identity-actions">
                                        {!isEditing ? (
                                            <button className="btn-primary-full" onClick={toggleEdit}>
                                                <span className="material-symbols-outlined">edit</span>
                                                {t('hr-company-btn-edit')}
                                            </button>
                                        ) : (
                                            <div className="cp-edit-actions">
                                                <button className="cp-btn-cancel" onClick={() => { setIsEditing(false); fetchCompanyData(); }}>{t('hr-company-btn-cancel')}</button>
                                                <button className="cp-btn-save" onClick={handleSave} disabled={isSaving}>
                                                    {isSaving ? t('hr-company-btn-saving') : t('hr-company-btn-save')}
                                                </button>
                                            </div>
                                        )}
                                        {formData.website && (
                                            <a href={formData.website} target="_blank" rel="noopener noreferrer" className="btn-secondary-full">
                                                <span className="material-symbols-outlined">language</span>
                                                {t('hr-company-btn-website')}
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <div className="cp-identity-details">
                                    <h3 className="cp-sidebar-heading">{t('hr-company-section-contact')}</h3>
                                    <div className="cp-detail-item">
                                        <span className="material-symbols-outlined icon">location_on</span>
                                        <div className="cp-detail-content">
                                            {isEditing ? (
                                                <>
                                                    <input className="cp-input-sm" name="address" value={formData.address} onChange={handleInputChange} placeholder={t('hr-company-placeholder-address')} />
                                                    <div className="cp-input-row">
                                                        <input className="cp-input-sm" name="city" value={formData.city} onChange={handleInputChange} placeholder={t('hr-company-placeholder-city')} />
                                                        <input className="cp-input-sm" name="zipCode" value={formData.zipCode} onChange={handleInputChange} placeholder={t('hr-company-placeholder-zip')} />
                                                    </div>
                                                    <input className="cp-input-sm" name="country" value={formData.country} onChange={handleInputChange} placeholder={t('hr-company-placeholder-country')} />
                                                </>
                                            ) : (
                                                <p>{formData.address}<br />{formData.zipCode} {formData.city}, {formData.country}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="cp-detail-item">
                                        <span className="material-symbols-outlined icon">mail</span>
                                        {isEditing ? (
                                            <input className="cp-input-sm" name="email" value={formData.email} onChange={handleInputChange} />
                                        ) : (
                                            <a href={`mailto:${formData.email}`}>{formData.email}</a>
                                        )}
                                    </div>
                                    <div className="cp-detail-item">
                                        <span className="material-symbols-outlined icon">call</span>
                                        {isEditing ? (
                                            <input className="cp-input-sm" name="phone" value={formData.phone} onChange={handleInputChange} />
                                        ) : (
                                            <a href={`tel:${formData.phone}`}>{formData.phone}</a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.aside>

                        <div className="cp-narrative-content">
                            <section className="cp-narrative-section">
                                <h2 className="cp-section-title">{t('hr-company-section-key-info')}</h2>
                                <div className="cp-info-grid">
                                    <div className="cp-info-card">
                                        <span className="material-symbols-outlined">domain</span>
                                        <div>
                                            <p>{t('hr-company-label-sector')}</p>
                                            {isEditing ? (
                                                <select className="cp-select-sm" name="sector" value={formData.sector} onChange={handleInputChange} style={{marginTop: '0.5rem'}}>
                                                    <option value="">Select sector</option>
                                                    <option value="Technologie & Software">{t('hr-company-sector-tech')}</option>
                                                    <option value="Finance">{t('hr-company-sector-finance')}</option>
                                                    <option value="Santé">{t('hr-company-sector-health')}</option>
                                                    <option value="Conseil">{t('hr-company-sector-consulting')}</option>
                                                    <option value="Industrie">{t('hr-company-sector-industry')}</option>
                                                    <option value="Education">{t('hr-company-sector-education')}</option>
                                                    <option value="Autre">{t('hr-company-sector-other')}</option>
                                                </select>
                                            ) : (
                                                <strong>{formData.sector || t('hr-company-not-filled')}</strong>
                                            )}
                                        </div>
                                    </div>
                                    <div className="cp-info-card">
                                        <span className="material-symbols-outlined">group</span>
                                        <div>
                                            <p>{t('hr-company-label-size')}</p>
                                            {isEditing ? (
                                                <select className="cp-select-sm" name="size" value={formData.size} onChange={handleInputChange} style={{marginTop: '0.5rem'}}>
                                                    <option value="1-10 employés">{t('hr-company-size-1-10')}</option>
                                                    <option value="11-50 employés">{t('hr-company-size-11-50')}</option>
                                                    <option value="51-200 employés">{t('hr-company-size-51-200')}</option>
                                                    <option value="201-500 employés">{t('hr-company-size-201-500')}</option>
                                                    <option value="500+ employés">{t('hr-company-size-500plus')}</option>
                                                </select>
                                            ) : (
                                                <strong>{formData.size || t('hr-company-not-filled')}</strong>
                                            )}
                                        </div>
                                    </div>
                                    <div className="cp-info-card">
                                        <span className="material-symbols-outlined">badge</span>
                                        <div>
                                            <p>Employees</p>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    name="employeeCount"
                                                    value={formData.employeeCount}
                                                    onChange={handleInputChange}
                                                    placeholder="Number of employees"
                                                    min="0"
                                                    className="cp-input-sm"
                                                    style={{marginTop: '0.5rem'}}
                                                />
                                            ) : (
                                                <strong>{formData.employeeCount || t('hr-company-not-filled')}</strong>
                                            )}
                                        </div>
                                    </div>
                                    <div className="cp-info-card">
                                        <span className="material-symbols-outlined">language</span>
                                        <div>
                                            <p>{t('hr-company-label-website')}</p>
                                            {formData.website ? (
                                                <a href={formData.website} target="_blank" rel="noopener noreferrer">{formData.website}</a>
                                            ) : (
                                                <strong>{t('hr-company-not-filled')}</strong>
                                            )}
                                        </div>
                                    </div>
                                    <div className="cp-info-card">
                                        <span className="material-symbols-outlined">mail</span>
                                        <div>
                                            <p>{t('hr-company-label-email')}</p>
                                            {formData.email ? <a href={`mailto:${formData.email}`}>{formData.email}</a> : <strong>{t('hr-company-not-filled')}</strong>}
                                        </div>
                                    </div>
                                    <div className="cp-info-card">
                                        <span className="material-symbols-outlined">call</span>
                                        <div>
                                            <p>{t('hr-company-label-phone')}</p>
                                            {formData.phone ? <a href={`tel:${formData.phone}`}>{formData.phone}</a> : <strong>{t('hr-company-not-filled')}</strong>}
                                        </div>
                                    </div>
                                    <div className="cp-info-card">
                                        <span className="material-symbols-outlined">work</span>
                                        <div>
                                            <p>{t('hr-company-label-linkedin')}</p>
                                            {formData.linkedin ? (
                                                <a href={formData.linkedin} target="_blank" rel="noopener noreferrer">{formData.linkedin}</a>
                                            ) : (
                                                <strong>{t('hr-company-not-filled')}</strong>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="cp-narrative-section">
                                <h2 className="cp-section-title">{t('hr-company-section-location')}</h2>
                                <div className="cp-location-card">
                                    {mapQuery ? (
                                        <iframe
                                            className="cp-map-frame"
                                            title={t('hr-company-map-title')}
                                            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=14&ie=UTF8&iwloc=B&output=embed`}
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                        />
                                    ) : (
                                        <div className="cp-map-empty">
                                            <span className="material-symbols-outlined">map</span>
                                            <p>{t('hr-company-map-empty')}</p>
                                        </div>
                                    )}
                                    <div className="cp-location-meta">
                                        <p className="cp-location-label">{t('hr-company-address-label')}</p>
                                        <p className="cp-location-value">{fullAddress || t('hr-company-address-empty')}</p>
                                    </div>
                                </div>
                            </section>

                            <section className="cp-narrative-section">
                                <h2 className="cp-section-title">{t('hr-company-section-about')}</h2>
                                <div className="cp-about-text">
                                    {isEditing ? (
                                        <>
                                            <textarea
                                                className="cp-textarea-large"
                                                rows="6"
                                                name="description"
                                                value={formData.description}
                                                onChange={handleInputChange}
                                                placeholder={t('hr-company-description-ph')}
                                            ></textarea>
                                            <p className="cp-char-count">{formData.description.length}/500</p>
                                        </>
                                    ) : (
                                        <p>{formData.description || t('hr-company-description-empty')}</p>
                                    )}
                                </div>
                            </section>

                            <section className="cp-narrative-section">
                                <div className="cp-values-grid">
                                    <div className="cp-value-card highlight">
                                        <span className="material-symbols-outlined">diamond</span>
                                        <h3>{t('hr-company-our-values')}</h3>
                                        <div className="cp-values-list">
                                            {formData.values.length > 0 ? (
                                                formData.values.map((v, i) => (
                                                    <div key={i} className="cp-value-item">
                                                        <span className="star-icon material-symbols-outlined">star</span>
                                                        <span>{v}</span>
                                                        {isEditing && (
                                                            <button onClick={() => removeValue(i)} className="btn-icon-xs">
                                                                <span className="material-symbols-outlined">close</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                !isEditing && <p className="cp-empty-text">{t('hr-company-value-empty')}</p>
                                            )}
                                            {isEditing && (
                                                <div className="cp-add-value">
                                                    <input
                                                        value={valueInput}
                                                        onChange={(e) => setValueInput(e.target.value)}
                                                        onKeyDown={addValue}
                                                        placeholder={t('hr-company-value-placeholder')}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="cp-value-card benefits">
                                        <span className="material-symbols-outlined">redeem</span>
                                        <h3>{t('hr-company-advantages')}</h3>
                                        <div className="cp-benefits-list">
                                            {formData.benefits.length > 0 ? (
                                                formData.benefits.map((b, i) => (
                                                    <div key={i} className="cp-benefit-item">
                                                        <span className="check-icon material-symbols-outlined">check_circle</span>
                                                        <span>{b}</span>
                                                        {isEditing && <button onClick={() => removeBenefit(i)} className="btn-icon-xs"><span className="material-symbols-outlined">close</span></button>}
                                                    </div>
                                                ))
                                            ) : (
                                                !isEditing && <p className="cp-empty-text">{t('hr-company-benefits-empty')}</p>
                                            )}
                                            {isEditing && (
                                                <div className="cp-add-benefit">
                                                    <input
                                                        value={benefitInput}
                                                        onChange={(e) => setBenefitInput(e.target.value)}
                                                        onKeyDown={addBenefit}
                                                        placeholder={t('hr-company-benefit-placeholder')}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="cp-narrative-section">
                                <div className="cp-section-header-row">
                                    <h2 className="cp-section-title">{t('hr-company-life-at', { name: formData.companyName })}</h2>
                                    {isEditing && <button className="btn-secondary-sm"><span className="material-symbols-outlined">add_a_photo</span> {t('hr-company-btn-add-photo')}</button>}
                                </div>
                                <div className="cp-gallery-grid">
                                    {/* For now, keeping these as static placeholders until gallery model is implemented */}
                                    {[
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuCsi5PQyAzy5JISDDbmRPhZu-URf6nzhXj0aljbq9YR0cEmPP449pXvxDqtwoyuFM6nS7WuJskfXHXIDQQYB3tgRQfcZ1Vc-iOU6vyJe-FYLBp43R20AvYX7wjqz3Q50WKmae_0hA32Pi_KJLRATeZ6rfSPFw2_N1edMdHxgiz74cklhJLQ0ZHBT_poVCq2r5MKlKA0c55zbVkStAwHTGc8UBzqFL4_skMwNvln-y5ZErQDrSnaOH-p6VywDElmkuajH9m8AtRshg",
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuAXXzQzlTqLAH-NBJgzrDckGjxtkukoZjwgxk3UhKrv2l7ZLkLmJxGR-ophhFmcdLHtpIg4NHFL81zT2tZaOja9bgouZETrusesUGt55jNlkX6wQZH6maf2mEgJ6g5KLHkV1y6no7gGkf8Bv0cfHZxPwxaUvVA7lTh1PWTj6-j17cj3SAypuf6LkTU_JMgkNH_ibMpCipTp0zGs27KiU00AxithsF8LBY3d8lmhGJ3BfSUudO8RAgpeFur_ZkpBJnEqDQZpj7BCcQ",
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuDMlp5YJycM5EmHoKzQxrwrfUy76nt1bU2VETonzQxt0hZnKLdJcjIeKE5Dj3iIkKWjOlRuUPpCdp934xT4U3vOIsPxioVORXDqOEwOeTkbOcH53cuKuQDid7whA7JQacnQB5MNKEmMRfOsWrD9ROH_SiQqCZuIc7wXEDn3E7CSTQa9bT23yF_bt44gXnWTnH2kRt0JY2nHC8uKTJAR3LJ1iKLpcuAJ0ojfFzrKq0_qnhI8g571Gc4L-MPRBAQQYu6Xwpm2CPeaOA"
                                    ].map((url, idx) => (
                                        <div key={idx} className={`cp-gallery-item item-${idx}`}>
                                            <div className="cp-img-wrapper" style={{ backgroundImage: `url("${url}")` }}></div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </motion.div>
                </main>
            </div>
            {isCropperOpen && (
                <ImageCropperModal
                    image={imageToCrop}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setIsCropperOpen(false)}
                />
            )}
        </div>
    );
};

export default CompanyProfile;
