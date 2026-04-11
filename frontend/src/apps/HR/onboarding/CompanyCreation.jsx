import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../../../core/supabaseClient';
import { apiFetch, SERVER_URL } from '../../../core/api';
import ImageCropperModal from '../components/ImageCropperModal';
import './CompanyCreation.css';

const CompanyCreation = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();

    // Helper to get full image URL
    const getFullImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('blob:') || path.startsWith('http')) return path;
        return `${SERVER_URL}${path}`;
    };
    const [step, setStep] = useState(1); // 1-5 = Company Form
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
        sector: '',
        // Step 2
        city: '',
        zipCode: '',
        country: '',
        email: '',
        phone: '',
        website: '',
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
    const [isLoadingData, setIsLoadingData] = useState(true);
    const fileInputRef = useRef(null);

    // Pre-fill form with existing company data created by SuperAdmin
    useEffect(() => {
        const fetchExistingData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
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
                    sector: company.domain || '',
                    city: company.city || '',
                    zipCode: company.zip_code || '',
                    country: company.country || '',
                    // contact fields — backend stores as email/phone
                    email: company.contact_email || company.email || '',
                    phone: company.contact_phone || company.phone || '',
                    website: company.website || '',
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

        if (step < 5) {
            setStep(step + 1);
        } else {
            // Final Step - Submit to backend
            setIsSubmitting(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
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
                            size: formData.size || undefined, // Added size field
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
                // Ideally, show an error toast here
            } finally {
                setIsSubmitting(false);
            }
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
                    addedAt: 'A l\'instant'
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
        if (!croppedBlob) return;

        // Preview
        const previewUrl = URL.createObjectURL(croppedBlob);
        setFormData(prev => ({ ...prev, logo: previewUrl }));

        try {
            const { data: { user } } = await supabase.auth.getUser();
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
            setFormData(prev => ({ ...prev, logo: logo_url, logoUrl: logo_url }));
        } catch (err) {
            console.warn('Logo upload error:', err.message);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <>
                        <div className="cc-form-row">
                            <label className="cc-label">
                                <span className="cc-label-text">Nom légal</span>
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
                                <span className="cc-label-text">Matricule Fiscale</span>
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
                            <span className="cc-label-text">Siège social</span>
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
                            <span className="cc-label-text">Domaine d'activité</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">category</span>
                                <select
                                    className="cc-select"
                                    name="sector"
                                    value={formData.sector}
                                    onChange={handleInputChange}
                                >
                                    <option disabled value="">Sélectionnez votre secteur</option>
                                    <option value="tech">Technologie & Logiciel</option>
                                    <option value="finance">Banque & Finance</option>
                                    <option value="sante">Santé & Médical</option>
                                    <option value="retail">Commerce & Distribution</option>
                                    <option value="industrie">Industrie & Manufacturier</option>
                                    <option value="education">Éducation & Formation</option>
                                    <option value="autre">Autre</option>
                                </select>
                                <span className="material-symbols-outlined cc-select-arrow">arrow_drop_down</span>
                            </div>
                        </label>
                    </>
                );
            case 2:
                return (
                    <>
                        <div className="cc-form-row">
                            <label className="cc-label">
                                <span className="cc-label-text">Ville</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">apartment</span>
                                    <input className="cc-input" type="text" name="city" placeholder="Sfax" value={formData.city} onChange={handleInputChange} />
                                </div>
                            </label>
                            <label className="cc-label">
                                <span className="cc-label-text">Code Postal</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">mail</span>
                                    <input className="cc-input" type="text" name="zipCode" placeholder="3000" value={formData.zipCode} onChange={handleInputChange} />
                                </div>
                            </label>
                        </div>
                        <label className="cc-label">
                            <span className="cc-label-text">Pays</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">public</span>
                                <input className="cc-input" type="text" name="country" placeholder="Tunisie" value={formData.country} onChange={handleInputChange} />
                            </div>
                        </label>
                        <div className="cc-form-row">
                            <label className="cc-label">
                                <span className="cc-label-text">Email de contact</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">alternate_email</span>
                                    <input className="cc-input" type="email" name="email" placeholder="contact@carthagedigital.tn" value={formData.email} onChange={handleInputChange} />
                                </div>
                            </label>
                            <label className="cc-label">
                                <span className="cc-label-text">Téléphone</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">call</span>
                                    <input className="cc-input" type="tel" name="phone" placeholder="+216 74 123 456" value={formData.phone} onChange={handleInputChange} />
                                </div>
                            </label>
                        </div>
                        <label className="cc-label">
                            <span className="cc-label-text">Site Web</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">language</span>
                                <input className="cc-input" type="url" name="website" placeholder="https://www.carthagedigital.tn" value={formData.website} onChange={handleInputChange} />
                            </div>
                        </label>
                    </>
                );
            case 3:
                return (
                    <>
                        <label className="cc-label">
                            <span className="cc-label-text">Description de l'entreprise</span>
                            <div className="cc-input-wrapper">
                                <textarea
                                    className="cc-textarea"
                                    name="description"
                                    placeholder="Décrivez votre activité, votre histoire, votre vision (ex: Leader du digital en Tunisie...)"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                ></textarea>
                            </div>
                        </label>
                        <label className="cc-label">
                            <span className="cc-label-text">Nos Valeurs (Appuyez sur Entrée pour ajouter)</span>
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
                                    placeholder="+ Ajouter une valeur (ex: Intégrité, Innovation)"
                                    value={valueInput}
                                    onChange={(e) => setValueInput(e.target.value)}
                                    onKeyDown={addValue}
                                />
                            </div>
                        </label>
                        <label className="cc-label">
                            <span className="cc-label-text">Avantages (Appuyez sur Entrée pour ajouter)</span>
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
                                    placeholder="+ Ajouter un avantage (ex: Tickets resto, Transport, Mutuelle)"
                                    value={benefitInput}
                                    onChange={(e) => setBenefitInput(e.target.value)}
                                    onKeyDown={addBenefit}
                                />
                            </div>
                        </label>
                    </>
                );
            case 4:
                return (
                    <>
                        <div className="cc-form-row">
                            <label className="cc-label" style={{ flex: 1 }}>
                                <span className="cc-label-text">Logo de l'entreprise</span>
                                <div
                                    className="cc-upload-area"
                                    onClick={() => fileInputRef.current.click()}
                                    style={formData.logo ? { backgroundImage: `url(${getFullImageUrl(formData.logo)})`, borderStyle: 'solid' } : {}}
                                >
                                    <input
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
                                                <p className="cc-upload-title">Cliquez ou déposez votre logo ici</p>
                                                <p className="cc-upload-subtitle">SVG, PNG, JPG (max. 2MB)</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </label>
                        </div>

                        <label className="cc-label">
                            <span className="cc-label-text">Couleur principale</span>
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
                                    Cette couleur sera utilisée pour les boutons et les accents de votre page carrière.
                                </div>
                            </div>
                        </label>

                        <div className="cc-form-row">
                            <label className="cc-label">
                                <span className="cc-label-text">Réseaux sociaux</span>
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
            case 5:
                return (
                    <>
                        {/* Add Member Box */}
                        <div className="cc-add-member-box">
                            <h3 className="cc-section-title">Ajouter un collaborateur</h3>
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
                                        <option value="recruiter">Recruteur</option>
                                        <option value="admin">Administrateur</option>
                                    </select>
                                    <span className="material-symbols-outlined cc-select-arrow">expand_more</span>
                                </div>
                                <button type="button" className="cc-btn-add" onClick={addMember}>
                                    <span className="material-symbols-outlined">add</span>
                                    <span className="cc-btn-text">Ajouter</span>
                                </button>
                            </div>
                        </div>

                        {/* Members List */}
                        <div className="cc-members-section">
                            <div className="cc-members-header">
                                <h3 className="cc-section-title" style={{ fontSize: '1rem', color: 'var(--cc-primary)' }}>Invités ({formData.members.length})</h3>
                                <div className="cc-badge-neutral">{formData.members.length}/5 sièges utilisés</div>
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
                                                    <span className="cc-status-text">En attente</span>
                                                    <span className="cc-dot"></span>
                                                    <span>Ajouté {member.addedAt}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="cc-member-actions">
                                            <div className="cc-role-badge">
                                                {member.role === 'admin' ? 'Administrateur' : 'Recruteur'}
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
            case 1: return "Informations de l'entreprise";
            case 2: return "Coordonnées & Contact";
            case 3: return "Culture & Valeurs";
            case 4: return "Personnalisation Marque";
            case 5: return "Invitation de l'Équipe";
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
                        Initialisation de l'espace
                    </p>
                </div>
            )}

            {/* Main Content */}
            <main className="cc-main">
                <div className="cc-container">
                    {/* Progress Bar Section */}
                    <div className="cc-progress-section">
                        <div className="cc-progress-labels">
                            <p className="cc-step-count">Étape {step} sur 5</p>
                            <p className="cc-step-name">{getReviewText()}</p>
                        </div>
                        <div className="cc-progress-track">
                            <div
                                className="cc-progress-fill"
                                style={{ width: `${(step / 5) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Card Container */}
                    <div className="cc-card">
                        {/* Page Heading */}
                        <div className="cc-heading-group">
                            <h1 className="cc-title">
                                {step === 5 ? "Invitation de l'Équipe" : "Création de l'Entreprise"}
                            </h1>
                            <p className="cc-subtitle">
                                {step === 5
                                    ? "Invitez vos collaborateurs à rejoindre l'espace RH. Vous pourrez ajuster ces accès plus tard."
                                    : "Configurez votre organisation pour commencer à recruter vos futurs talents."}
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
                                        Retour
                                    </button>
                                )}
                                <button className="cc-btn-next" type="submit" disabled={isSubmitting}>
                                    <span>
                                        {isSubmitting ? 'Traitement...' : step === 5 ? 'Terminer la configuration' : 'Suivant'}
                                    </span>
                                    {!isSubmitting && (
                                        <span className="material-symbols-outlined">
                                            {step === 5 ? 'check_circle' : 'arrow_forward'}
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
        </div>
    );
};

export default CompanyCreation;
