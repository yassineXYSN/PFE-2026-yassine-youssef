import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import HRSidebar from '../../components/HRSidebar';
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
                    {/* Header Background (Subtle) */}
                    <div className="cp-header-bg"></div>

                    <div className="cp-layout-split">

                        {/* LEFT COLUMN: IDENTITY (Sticky) */}
                        <aside className="cp-identity-sidebar">
                            <div className="cp-identity-card glass-panel">
                                {/* Logo Section */}
                                <div className={`cp-logo-section ${isEditing ? 'editable' : ''}`} onClick={handleLogoClick}>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        disabled={!isEditing}
                                    />
                                    <div className="cp-logo-xl" style={logo ? { backgroundImage: `url(${logo})` } : {}}>
                                        {!logo && <span className="material-symbols-outlined">business</span>}
                                        {isEditing && <div className="cp-edit-overlay"><span className="material-symbols-outlined">edit</span></div>}
                                    </div>
                                </div>

                                {/* Company Identity Inputs */}
                                <div className="cp-identity-info">
                                    {isEditing ? (
                                        <input className="cp-input-title" type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} />
                                    ) : (
                                        <h1 className="cp-company-title">{formData.companyName}</h1>
                                    )}

                                    <div className="cp-meta-row">
                                        {isEditing ? (
                                            <select className="cp-select-sm" name="sector" value={formData.sector} onChange={handleInputChange}>
                                                <option>Technologie & Software</option>
                                                <option>Finance</option>
                                                <option>Santé</option>
                                            </select>
                                        ) : (
                                            <span className="cp-meta-badge"><span className="material-symbols-outlined">domain</span> {formData.sector}</span>
                                        )}
                                        {isEditing ? (
                                            <select className="cp-select-sm" name="size" value={formData.size} onChange={handleInputChange}>
                                                <option>50-100 employés</option>
                                                <option>100-500 employés</option>
                                                <option>500+ employés</option>
                                            </select>
                                        ) : (
                                            <span className="cp-meta-badge"><span className="material-symbols-outlined">group</span> {formData.size}</span>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="cp-identity-actions">
                                        {!isEditing ? (
                                            <button className="btn-primary-full" onClick={toggleEdit}>
                                                <span className="material-symbols-outlined">edit</span>
                                                Modifier le profil
                                            </button>
                                        ) : (
                                            <div className="cp-edit-actions">
                                                <button className="btn-cancel" onClick={toggleEdit}>Annuler</button>
                                                <button className="btn-save" onClick={toggleEdit}>Enregistrer</button>
                                            </div>
                                        )}
                                        <a href={formData.website} target="_blank" rel="noopener noreferrer" className="btn-secondary-full">
                                            <span className="material-symbols-outlined">language</span>
                                            Visiter le site web
                                        </a>
                                    </div>
                                </div>

                                {/* Contact Details Block */}
                                <div className="cp-identity-details">
                                    <h3 className="cp-sidebar-heading">Coordonnées</h3>
                                    <div className="cp-detail-item">
                                        <span className="material-symbols-outlined icon">location_on</span>
                                        <div className="cp-detail-content">
                                            {isEditing ? (
                                                <>
                                                    <input className="cp-input-sm" name="address" value={formData.address} onChange={handleInputChange} placeholder="Adresse" />
                                                    <div className="cp-input-row">
                                                        <input className="cp-input-sm" name="city" value={formData.city} onChange={handleInputChange} placeholder="Ville" />
                                                        <input className="cp-input-sm" name="zipCode" value={formData.zipCode} onChange={handleInputChange} placeholder="CP" />
                                                    </div>
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
                        </aside>

                        {/* RIGHT COLUMN: NARRATIVE (Scrollable) */}
                        <div className="cp-narrative-content">

                            {/* SECTION 1: ABOUT */}
                            <section className="cp-narrative-section">
                                <h2 className="cp-section-title">À propos de nous</h2>
                                <div className="cp-about-text">
                                    {isEditing ? (
                                        <>
                                            <textarea
                                                className="cp-textarea-large"
                                                rows="6"
                                                name="description"
                                                value={formData.description}
                                                onChange={handleInputChange}
                                            ></textarea>
                                            <p className="cp-char-count">{formData.description.length}/500</p>
                                        </>
                                    ) : (
                                        <p>{formData.description}</p>
                                    )}
                                </div>
                            </section>

                            {/* SECTION 2: VALUES & CULTURE */}
                            <section className="cp-narrative-section">
                                <div className="cp-values-grid">
                                    <div className="cp-value-card highlight">
                                        <span className="material-symbols-outlined">diamond</span>
                                        <h3>Nos Valeurs</h3>
                                        <div className="cp-tags-container">
                                            {isEditing ? (
                                                <input
                                                    className="cp-input"
                                                    name="values"
                                                    value={formData.values}
                                                    onChange={handleInputChange}
                                                    placeholder="Séparez par des virgules"
                                                />
                                            ) : (
                                                formData.values.split(',').map((val, i) => (
                                                    <span key={i} className="cp-value-tag">{val.trim()}</span>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="cp-value-card benefits">
                                        <span className="material-symbols-outlined">redeem</span>
                                        <h3>Avantages</h3>
                                        <div className="cp-benefits-list">
                                            {formData.benefits.map((b, i) => (
                                                <div key={i} className="cp-benefit-item">
                                                    <span className="check-icon material-symbols-outlined">check_circle</span>
                                                    <span>{b}</span>
                                                    {isEditing && <button onClick={() => removeBenefit(i)} className="btn-icon-xs"><span className="material-symbols-outlined">close</span></button>}
                                                </div>
                                            ))}
                                            {isEditing && (
                                                <div className="cp-add-benefit">
                                                    <input
                                                        value={benefitInput}
                                                        onChange={(e) => setBenefitInput(e.target.value)}
                                                        onKeyDown={addBenefit}
                                                        placeholder="Ajouter (Entrée)"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 3: MEDIA GALLERY */}
                            <section className="cp-narrative-section">
                                <div className="cp-section-header-row">
                                    <h2 className="cp-section-title">La vie chez {formData.companyName}</h2>
                                    {isEditing && <button className="btn-secondary-sm"><span className="material-symbols-outlined">add_a_photo</span> Ajouter</button>}
                                </div>
                                <div className="cp-gallery-grid">
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
                    </div>
                </main>
            </div>
        </div>
    );
};

export default CompanyProfile;
