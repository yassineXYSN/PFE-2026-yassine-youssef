import React, { useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import './CompanyCreation.css';

const CompanyCreation = () => {
    const { effectiveTheme } = useTheme();
    const [step, setStep] = useState(1);
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
        values: '',
        benefits: [],
        // Step 4
        logo: null,
        primaryColor: '#000000',
        linkedin: '',
        twitter: '',
        // Step 5
        members: [
            { id: 1, email: 'jean.dupont@tech-solutions.com', role: 'admin', status: 'pending', addedAt: 'Il y a 2 min' },
            { id: 2, email: 'sophie.bertrand@tech-solutions.com', role: 'recruiter', status: 'pending', addedAt: 'A l\'instant' }
        ]
    });

    // Temp state for benefits input
    const [newMember, setNewMember] = useState({ email: '', role: 'recruiter' });
    const [benefitInput, setBenefitInput] = useState("");
    const fileInputRef = useRef(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNext = (e) => {
        e.preventDefault();
        if (step < 5) {
            setStep(step + 1);
        } else {
            console.log("Form Submitted:", formData);
            // Navigate to dashboard or next flow
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
            setFormData(prev => ({
                ...prev,
                benefits: [...prev.benefits, benefitInput.trim()]
            }));
            setBenefitInput("");
        }
    };

    const removeBenefit = (index) => {
        setFormData(prev => ({
            ...prev,
            benefits: prev.benefits.filter((_, i) => i !== index)
        }));
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, logo: imageUrl }));
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
                                        placeholder="Ex: Tech Solutions SAS"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </label>
                            <label className="cc-label">
                                <span className="cc-label-text">Numéro de SIRET/TVA</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">badge</span>
                                    <input
                                        className="cc-input"
                                        type="text"
                                        name="siret"
                                        placeholder="123 456 789 00012"
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
                                    placeholder="Adresse complète du siège"
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
                                    <input className="cc-input" type="text" name="city" placeholder="Paris" value={formData.city} onChange={handleInputChange} />
                                </div>
                            </label>
                            <label className="cc-label">
                                <span className="cc-label-text">Code Postal</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">mail</span>
                                    <input className="cc-input" type="text" name="zipCode" placeholder="75000" value={formData.zipCode} onChange={handleInputChange} />
                                </div>
                            </label>
                        </div>
                        <label className="cc-label">
                            <span className="cc-label-text">Pays</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">public</span>
                                <input className="cc-input" type="text" name="country" placeholder="France" value={formData.country} onChange={handleInputChange} />
                            </div>
                        </label>
                        <div className="cc-form-row">
                            <label className="cc-label">
                                <span className="cc-label-text">Email de contact</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">alternate_email</span>
                                    <input className="cc-input" type="email" name="email" placeholder="contact@entreprise.com" value={formData.email} onChange={handleInputChange} />
                                </div>
                            </label>
                            <label className="cc-label">
                                <span className="cc-label-text">Téléphone</span>
                                <div className="cc-input-wrapper">
                                    <span className="material-symbols-outlined cc-input-icon">call</span>
                                    <input className="cc-input" type="tel" name="phone" placeholder="+33 1 23 45 67 89" value={formData.phone} onChange={handleInputChange} />
                                </div>
                            </label>
                        </div>
                        <label className="cc-label">
                            <span className="cc-label-text">Site Web</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">language</span>
                                <input className="cc-input" type="url" name="website" placeholder="https://www.entreprise.com" value={formData.website} onChange={handleInputChange} />
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
                                    placeholder="Décrivez votre activité, votre histoire, votre vision..."
                                    value={formData.description}
                                    onChange={handleInputChange}
                                ></textarea>
                            </div>
                        </label>
                        <label className="cc-label">
                            <span className="cc-label-text">Nos Valeurs</span>
                            <div className="cc-input-wrapper">
                                <span className="material-symbols-outlined cc-input-icon">diversity_3</span>
                                <input
                                    className="cc-input"
                                    type="text"
                                    name="values"
                                    placeholder="Innovation, Bienveillance, Excellence..."
                                    value={formData.values}
                                    onChange={handleInputChange}
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
                                    placeholder="+ Ajouter un avantage"
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
                                    style={formData.logo ? { backgroundImage: `url(${formData.logo})`, borderStyle: 'solid' } : {}}
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
                                        placeholder="Lien LinkedIn de l'entreprise"
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
                                        placeholder="Lien Twitter / X"
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
                                        placeholder="adresse@entreprise.com"
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
                                    <button type="button" className="cc-btn-back" onClick={handleBack}>
                                        Retour
                                    </button>
                                )}
                                <button className="cc-btn-next" type="submit">
                                    <span>{step === 5 ? 'Terminer la configuration' : 'Suivant'}</span>
                                    <span className="material-symbols-outlined">
                                        {step === 5 ? 'check_circle' : 'arrow_forward'}
                                    </span>
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
