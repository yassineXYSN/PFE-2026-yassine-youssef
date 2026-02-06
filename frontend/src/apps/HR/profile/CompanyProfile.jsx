import React from 'react';
import { useTheme } from '../context/ThemeContext';
import HRSidebar from '../components/HRSidebar';
import './CompanyProfile.css';

const CompanyProfile = () => {
    const { effectiveTheme } = useTheme();
    const [logo, setLogo] = React.useState(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const fileInputRef = React.useRef(null);

    // Form Data State
    const [formData, setFormData] = React.useState({
        companyName: "TechNova Solutions",
        sector: "Technologie & Software",
        size: "100-500 employés",
        website: "https://technova.io",
        description: "TechNova Solutions est pionnier dans le développement de solutions logicielles assistées par IA pour optimiser les processus de recrutement. Nous croyons en une technologie qui remet l'humain au centre des décisions.",
        // New Contact Data
        address: "123 Avenue de la République",
        city: "Paris",
        zipCode: "75011",
        country: "France",
        email: "contact@technova.io",
        phone: "+33 1 23 45 67 89",
        linkedin: "linkedin.com/company/technova",
        // New Culture Data
        values: "Innovation, Transparence, Bienveillance, Excellence",
        benefits: ["Télétravail partiel", "Titres restaurant", "Mutuelle Alan", "Salle de sport", "Séminaires annuels"]
    });

    // Temp state for editing benefits
    const [benefitInput, setBenefitInput] = React.useState("");

    const handleLogoClick = () => {
        if (isEditing) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setLogo(imageUrl);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleEdit = () => {
        setIsEditing(!isEditing);
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
            setFormData(prev => ({
                ...prev,
                benefits: [...prev.benefits, benefitInput.trim()]
            }));
            setBenefitInput("");
        }
    };

    return (
        <div className={`company-profile-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <div className="cp-layout-container">
                {/* Side Navigation */}
                <div className="cp-sidebar-wrapper">
                    <HRSidebar />
                </div>

                {/* Main Content Area */}
                <main className="cp-main-content">
                    <div className="cp-content-container">

                        {/* Header Image */}
                        <div className="cp-hero-section">
                            <div className="cp-hero-banner">
                                <div
                                    className="cp-hero-img"
                                    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC8SMFlyH5gf0P5vG80QNIcbj9M9yuRW55y_qjFoc2iFy2CHqPJnnO4ArZsmpm7BPavFoFPNT0rY3E23SxwESu4Hnj_kZ75dwam3dPDLgI4WWhQ4NCqm6S4k3nWE_URiELdk79M6Z0dmN8rHjaDhJywULIVmSGy5XH9aN1ihvapMmh9Cw9fINeJqbO99sletM8p4hz8bRpFv8fjNa_ehpcHgXBR-yWpY0BlrH3pJvdcQnhlfr6VMu9IvDtVgwltolsmWznWVF4mNw")' }}
                                ></div>
                                <div className="cp-hero-overlay"></div>
                            </div>
                        </div>

                        {/* Profile Header */}
                        <div className="cp-profile-header">
                            <div className="cp-header-flex">
                                <div className={`cp-logo-container ${isEditing ? 'editable' : ''}`} onClick={handleLogoClick}>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        disabled={!isEditing}
                                    />
                                    <div className="cp-logo-box" style={logo ? { backgroundImage: `url(${logo})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                                        {!logo && <span className="material-symbols-outlined" style={{ fontSize: '3.75rem' }}>token</span>}
                                        {isEditing && (
                                            <div className="cp-logo-overlay">
                                                <span className="material-symbols-outlined">edit</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="cp-header-info">
                                    <h1 className="cp-company-name">{formData.companyName}</h1>
                                    <p className="cp-company-subtitle">Intelligence Artificielle & Recrutement</p>
                                </div>
                                <div className="cp-header-actions">
                                    {!isEditing && (
                                        <button className="btn-secondary" onClick={toggleEdit}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>edit</span>
                                            Modifier le profil
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content Grid */}
                        <div className="cp-sections-grid">

                            {/* Section: General Info */}
                            <section className="cp-card">
                                <div className="cp-card-header">
                                    <h2 className="cp-card-title">Informations Générales</h2>
                                    <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>info</span>
                                </div>
                                <div className="cp-card-body">
                                    <div className="cp-form-grid">
                                        <div className="cp-form-group">
                                            <label className="cp-label">Nom de l'entreprise</label>
                                            {isEditing ? (
                                                <input className="cp-input" type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} />
                                            ) : (
                                                <p className="cp-view-text">{formData.companyName}</p>
                                            )}
                                        </div>
                                        <div className="cp-form-group">
                                            <label className="cp-label">Secteur d'activité</label>
                                            {isEditing ? (
                                                <div className="cp-select-wrapper">
                                                    <select className="cp-select" name="sector" value={formData.sector} onChange={handleInputChange}>
                                                        <option>Technologie & Software</option>
                                                        <option>Finance</option>
                                                        <option>Santé</option>
                                                    </select>
                                                    <span className="material-symbols-outlined cp-select-icon">expand_more</span>
                                                </div>
                                            ) : (
                                                <p className="cp-view-text">{formData.sector}</p>
                                            )}
                                        </div>
                                        <div className="cp-form-group">
                                            <label className="cp-label">Taille de l'entreprise</label>
                                            {isEditing ? (
                                                <div className="cp-select-wrapper">
                                                    <select className="cp-select" name="size" value={formData.size} onChange={handleInputChange}>
                                                        <option>50-100 employés</option>
                                                        <option>100-500 employés</option>
                                                        <option>500+ employés</option>
                                                    </select>
                                                    <span className="material-symbols-outlined cp-select-icon">expand_more</span>
                                                </div>
                                            ) : (
                                                <p className="cp-view-text">{formData.size}</p>
                                            )}
                                        </div>
                                        <div className="cp-form-group">
                                            <label className="cp-label">Site Web</label>
                                            {isEditing ? (
                                                <div className="cp-select-wrapper">
                                                    <span className="material-symbols-outlined cp-input-icon">language</span>
                                                    <input className="cp-input cp-input-pl" type="text" name="website" value={formData.website} onChange={handleInputChange} />
                                                </div>
                                            ) : (
                                                <a href={formData.website} target="_blank" rel="noopener noreferrer" className="cp-view-link">
                                                    {formData.website}
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Section: Contact & Localisation (NEW) */}
                            <section className="cp-card">
                                <div className="cp-card-header">
                                    <h2 className="cp-card-title">Coordonnées & Localisation</h2>
                                    <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>location_on</span>
                                </div>
                                <div className="cp-card-body">
                                    <div className="cp-form-grid">
                                        <div className="cp-form-group">
                                            <label className="cp-label">Adresse du Siège</label>
                                            {isEditing ? (
                                                <input className="cp-input" type="text" name="address" value={formData.address} onChange={handleInputChange} />
                                            ) : (
                                                <p className="cp-view-text">{formData.address}</p>
                                            )}
                                        </div>
                                        <div className="cp-form-grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div className="cp-form-group">
                                                <label className="cp-label">Ville</label>
                                                {isEditing ? (
                                                    <input className="cp-input" type="text" name="city" value={formData.city} onChange={handleInputChange} />
                                                ) : (
                                                    <p className="cp-view-text">{formData.city}</p>
                                                )}
                                            </div>
                                            <div className="cp-form-group">
                                                <label className="cp-label">Code Postal</label>
                                                {isEditing ? (
                                                    <input className="cp-input" type="text" name="zipCode" value={formData.zipCode} onChange={handleInputChange} />
                                                ) : (
                                                    <p className="cp-view-text">{formData.zipCode}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="cp-form-group">
                                            <label className="cp-label">Pays</label>
                                            {isEditing ? (
                                                <input className="cp-input" type="text" name="country" value={formData.country} onChange={handleInputChange} />
                                            ) : (
                                                <p className="cp-view-text">{formData.country}</p>
                                            )}
                                        </div>
                                        <div className="cp-form-group">
                                            <label className="cp-label">Email de contact</label>
                                            {isEditing ? (
                                                <input className="cp-input" type="email" name="email" value={formData.email} onChange={handleInputChange} />
                                            ) : (
                                                <p className="cp-view-text">{formData.email}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Section: Description */}
                            <section className="cp-card">
                                <div className="cp-card-header">
                                    <h2 className="cp-card-title">À propos</h2>
                                </div>
                                <div className="cp-card-body">
                                    <div className="cp-form-group">
                                        <label className="cp-label">Description de l'entreprise</label>
                                        {isEditing ? (
                                            <>
                                                <textarea
                                                    className="cp-textarea"
                                                    rows="4"
                                                    name="description"
                                                    value={formData.description}
                                                    onChange={handleInputChange}
                                                ></textarea>
                                                <p className="cp-char-count">{formData.description.length}/500 caractères</p>
                                            </>
                                        ) : (
                                            <p className="cp-view-text" style={{ lineHeight: '1.6' }}>{formData.description}</p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Section: Culture & Avantages (NEW) */}
                            <section className="cp-card">
                                <div className="cp-card-header">
                                    <h2 className="cp-card-title">Culture & Avantages</h2>
                                    <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>diversity_3</span>
                                </div>
                                <div className="cp-card-body">
                                    <div className="cp-form-group" style={{ marginBottom: '1.5rem' }}>
                                        <label className="cp-label">Nos Valeurs</label>
                                        {isEditing ? (
                                            <input
                                                className="cp-input"
                                                type="text"
                                                name="values"
                                                value={formData.values}
                                                onChange={handleInputChange}
                                                placeholder="Séparez les valeurs par des virgules"
                                            />
                                        ) : (
                                            <div className="cp-tags-list">
                                                {formData.values.split(',').map((val, idx) => (
                                                    <span key={idx} className="cp-tag-value">{val.trim()}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="cp-form-group">
                                        <label className="cp-label">Avantages & Bénéfices</label>
                                        <div className="cp-benefits-container">
                                            {formData.benefits.map((benefit, idx) => (
                                                <div key={idx} className="cp-benefit-tag">
                                                    <span>{benefit}</span>
                                                    {isEditing && (
                                                        <button
                                                            onClick={() => removeBenefit(idx)}
                                                            className="cp-benefit-remove"
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '0.875rem' }}>close</span>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {isEditing && (
                                                <div className="cp-benefit-input-wrapper">
                                                    <input
                                                        type="text"
                                                        className="cp-benefit-input"
                                                        placeholder="+ Ajouter (Entrée)"
                                                        value={benefitInput}
                                                        onChange={(e) => setBenefitInput(e.target.value)}
                                                        onKeyDown={addBenefit}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Section: AI Settings */}
                            

                            {/* Section: Media */}
                            <section className="cp-card" style={{ marginBottom: '4rem' }}>
                                <div className="cp-card-header">
                                    <h2 className="cp-card-title">Médias & Bureaux</h2>
                                    {isEditing && (
                                        <button style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--cp-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                            Gérer la galerie
                                        </button>
                                    )}
                                </div>
                                <div className="cp-card-body">
                                    <div className="cp-media-grid">
                                        {/* Upload Button - visible only in edit */}
                                        {isEditing && (
                                            <button className="cp-upload-btn">
                                                <span className="material-symbols-outlined">add_photo_alternate</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Ajouter une photo</span>
                                            </button>
                                        )}

                                        {/* Images */}
                                        {[
                                            "https://lh3.googleusercontent.com/aida-public/AB6AXuCsi5PQyAzy5JISDDbmRPhZu-URf6nzhXj0aljbq9YR0cEmPP449pXvxDqtwoyuFM6nS7WuJskfXHXIDQQYB3tgRQfcZ1Vc-iOU6vyJe-FYLBp43R20AvYX7wjqz3Q50WKmae_0hA32Pi_KJLRATeZ6rfSPFw2_N1edMdHxgiz74cklhJLQ0ZHBT_poVCq2r5MKlKA0c55zbVkStAwHTGc8UBzqFL4_skMwNvln-y5ZErQDrSnaOH-p6VywDElmkuajH9m8AtRshg",
                                            "https://lh3.googleusercontent.com/aida-public/AB6AXuAXXzQzlTqLAH-NBJgzrDckGjxtkukoZjwgxk3UhKrv2l7ZLkLmJxGR-ophhFmcdLHtpIg4NHFL81zT2tZaOja9bgouZETrusesUGt55jNlkX6wQZH6maf2mEgJ6g5KLHkV1y6no7gGkf8Bv0cfHZxPwxaUvVA7lTh1PWTj6-j17cj3SAypuf6LkTU_JMgkNH_ibMpCipTp0zGs27KiU00AxithsF8LBY3d8lmhGJ3BfSUudO8RAgpeFur_ZkpBJnEqDQZpj7BCcQ",
                                            "https://lh3.googleusercontent.com/aida-public/AB6AXuDMlp5YJycM5EmHoKzQxrwrfUy76nt1bU2VETonzQxt0hZnKLdJcjIeKE5Dj3iIkKWjOlRuUPpCdp934xT4U3vOIsPxioVORXDqOEwOeTkbOcH53cuKuQDid7whA7JQacnQB5MNKEmMRfOsWrD9ROH_SiQqCZuIc7wXEDn3E7CSTQa9bT23yF_bt44gXnWTnH2kRt0JY2nHC8uKTJAR3LJ1iKLpcuAJ0ojfFzrKq0_qnhI8g571Gc4L-MPRBAQQYu6Xwpm2CPeaOA"
                                        ].map((url, idx) => (
                                            <div key={idx} className="cp-media-item">
                                                <div className="cp-media-img" style={{ backgroundImage: `url("${url}")` }}></div>
                                                {isEditing && (
                                                    <div className="cp-media-overlay">
                                                        <button className="cp-delete-btn">
                                                            <span className="material-symbols-outlined">delete</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                        </div>
                    </div>

                    {/* Sticky Footer */}
                    {isEditing && (
                        <div className="cp-footer-actions">
                            <div className="cp-footer-content">
                                <p className="cp-last-edit">Mode édition activé</p>
                                <div className="cp-action-buttons">
                                    <button className="btn-cancel" onClick={toggleEdit}>
                                        Annuler
                                    </button>
                                    <button className="btn-save" onClick={toggleEdit}>
                                        Enregistrer les modifications
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default CompanyProfile;
