import React, { useState } from 'react';
import './ProfilePage.css';
import EducationForm from './components/EducationForm';
import ExperienceForm from './components/ExperienceForm';
import CertificateForm from './components/CertificateForm';
import AboutForm from './components/AboutForm';
import PersonalDetailsForm from './components/PersonalDetailsForm';
import LanguagesForm from './components/LanguagesForm';
import SkillsForm from './components/SkillsForm';
import HobbiesForm from './components/HobbiesForm';
import GlareHover from '../Analytics/components/GlareHover/GlareHover';
import { useLanguage } from '../../../../core/useLanguage';

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button className="btn-ghost" style={{ padding: '0.5rem', border: 'none' }} onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

const ProfilePage = () => {
    const { t } = useLanguage();

    // --- State Management ---
    const [profile, setProfile] = useState({
        name: 'Alex Sterling',
        title: 'Senior Product Designer',
        profileImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXSpxBmQzQ0YnS6_conRCkEzhsBb5r_vxL63WxF_uRooiw_mn75eExDTFMqYaAfOC4AS5_J9Xpc1iXPdYIzpaKa-UB7zb4HtdgA4iAjRSr61IjqPc06aaOEeeOcxj8eQG1p6JNYoLsfykGXk0a0O1CngEgduCHljMNU6qtV4900W4CkQ3-W5wEfU29O4fm2WgHIlJfLs3McYfml-3E3yYZsnpT0ojSNnlY6VxzOWj8vuabNj1eYp2qnFawgs7T38VQsi_dKgz6oOo',
        coverImage: null,
        about: 'I am a product designer with a passion for creating accessible and user-centric digital experiences. With over 8 years of experience, I\'ve had the privilege of working with forward-thinking companies in fintech and e-commerce. I believe that good design is invisible—it just works.\n\nCurrently, I\'m focused on navigating the intersection of AI and user interface design to build the next generation of productivity tools.',
        experiences: [
            { id: 1, role: 'Senior Product Designer', company: 'TechFlow Inc.', startYear: '2021', endYear: 'Present', ongoing: true, description: 'Spearheading the redesign of the core dashboard, resulting in a 25% increase in user engagement. Mentoring junior designers and maintaining the "FlowUI" design system.' },
            { id: 2, role: 'UI/UX Designer', company: 'Creative Agency X', startYear: '2018', endYear: '2021', ongoing: false, description: 'Delivered 15+ web and mobile projects for high-profile clients. Conducted extensive user research and A/B testing to optimize conversion funnels.' }
        ],
        educations: [
            { id: 1, institution: 'Stanford University', degree: 'Master of Science in Human-Computer Interaction', startYear: '2014', endYear: '2016' },
            { id: 2, institution: 'UC Berkeley', degree: 'Bachelor of Arts in Design', startYear: '2010', endYear: '2014' }
        ],
        certificates: [
            { id: 1, name: 'Google UX Design Professional', fileName: 'Google_UX.pdf', fileSize: '2.4 MB', year: '2022' },
            { id: 2, name: 'Figma Masterclass', fileName: 'Figma_Cert.pdf', fileSize: '1.8 MB', year: '2021' }
        ],
        languages: [
            { id: 'lang-1', name: 'English', level: 100 },
            { id: 'lang-2', name: 'French', level: 75 },
            { id: 'lang-3', name: 'Spanish', level: 50 }
        ],
        skills: [
            { id: 'skill-1', name: 'Product Design', level: 95 },
            { id: 'skill-2', name: 'UI/UX', level: 90 },
            { id: 'skill-3', name: 'Figma', level: 85 },
            { id: 'skill-4', name: 'Prototyping', level: 80 },
            { id: 'skill-5', name: 'User Research', level: 70 }
        ],
        hobbies: [
            { id: 'hobby-1', name: 'Photography' },
            { id: 'hobby-2', name: 'Hiking' },
            { id: 'hobby-3', name: 'Reading' },
            { id: 'hobby-4', name: 'Gaming' }
        ]
    });

    const getLanguageLabel = (level) => {
        if (level >= 95) return 'Native';
        if (level >= 75) return 'Fluent';
        if (level >= 50) return 'Conversational';
        return 'Beginner';
    };

    const getSkillLabel = (level) => {
        if (level >= 80) return 'Expert';
        if (level >= 50) return 'Intermediate';
        return 'Beginner';
    };

    const [modalConfig, setModalConfig] = useState({ isOpen: false, type: null, data: null });
    const [isDirty, setIsDirty] = useState(false);

    // --- Handlers ---

    // Open Modals
    const openModal = (type, data = null) => {
        setModalConfig({ isOpen: true, type, data });
    };

    const closeModal = () => {
        setModalConfig({ isOpen: false, type: null, data: null });
    };

    // Save Generic (from forms)
    const handleSaveItem = (type, item) => {
        setProfile(prev => {
            // Handle languages, skills, hobbies (full array replacement)
            if (type === 'languages' || type === 'skills' || type === 'hobbies') {
                return { ...prev, [type]: Array.isArray(item) ? item : [] };
            }

            // Handle simple types (about, personal)
            if (type === 'about') {
                return { ...prev, about: item.about };
            }
            if (type === 'personal') {
                return { ...prev, ...item }; // Merge name and title
            }

            const list = prev[type]; // 'experiences', 'educations', 'certificates'

            // Handle array types
            if (Array.isArray(list)) {
                const index = list.findIndex(i => i.id === item.id);
                let newList;
                if (index >= 0) {
                    newList = [...list];
                    newList[index] = item;
                } else {
                    newList = [item, ...list];
                }
                return { ...prev, [type]: newList };
            }

            return prev;
        });
        setIsDirty(true);
        closeModal();
    };

    // Save Profile (Global)
    const handleGlobalSave = () => {
        console.log("Saving Profile Data:", profile);
        setIsDirty(false);
        alert("Changes Saved! (Check Console)");
    };

    // Delete Item
    const handleDeleteItem = (type, id) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            setProfile(prev => ({
                ...prev,
                [type]: prev[type].filter(item => item.id !== id)
            }));
            setIsDirty(true);
        }
    };

    // Handle Image Uploads
    const handleProfileImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile(prev => ({ ...prev, profileImage: reader.result }));
                setIsDirty(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCoverImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile(prev => ({ ...prev, coverImage: reader.result }));
                setIsDirty(true);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="profile-container">

            {/* --- Sticky Header for Actions --- */}


            {/* --- Left Column: Sidebar & Hero --- */}
            <aside className="profile-sidebar">

                {/* Hero Card */}
                <GlareHover
                    className="card-premium hero-card"
                    background="var(--bg-card)"
                    borderRadius="var(--radius-xl)"
                    borderColor="var(--border-subtle)"
                    glareOpacity={0.35}
                    glareSize={260}
                >
                    {/* Editable Cover Image */}
                    <div
                        className="hero-cover"
                        style={profile.coverImage ? { backgroundImage: `url(${profile.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                    >
                        <label className="cover-edit-overlay">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleCoverImageChange}
                                style={{ display: 'none' }}
                            />
                            <span className="material-symbols-outlined">photo_camera</span>
                            <span>Change Cover</span>
                        </label>
                    </div>

                    {/* Editable Profile Image */}
                    <div className="hero-avatar-wrapper">
                        <img
                            src={profile.profileImage}
                            alt="Profile"
                            className="hero-avatar"
                        />
                        <label className="avatar-edit-overlay">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleProfileImageChange}
                                style={{ display: 'none' }}
                            />
                            <span className="material-symbols-outlined">photo_camera</span>
                        </label>
                        <div className="hero-status"></div>
                    </div>

                    <div className="hero-info">
                        <h1>{profile.name}</h1>
                        <p>{profile.title}</p>
                    </div>

                    <div className="hero-stats">
                        <div className="stat-item">
                            <span className="stat-value">124</span>
                            <span className="stat-label">Projects</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">8.5yrs</span>
                            <span className="stat-label">Experience</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">4.9</span>
                            <span className="stat-label">Rating</span>
                        </div>
                    </div>

                    <div className="hero-actions">
                        <button className="btn-primary">
                            <span className="material-symbols-outlined">mail</span>
                            Contact
                        </button>
                        <button className="btn-soft" onClick={() => openModal('personal', { name: profile.name, title: profile.title })}>
                            <span className="material-symbols-outlined">edit</span>
                        </button>
                    </div>

                    {/* Details List */}
                    <div className="details-list" style={{ marginTop: '2rem' }}>
                        <div className="detail-item">
                            <div className="detail-icon">
                                <span className="material-symbols-outlined">location_on</span>
                            </div>
                            <span>San Francisco, CA</span>
                        </div>
                    </div>
                </GlareHover>

                {/* Languages Card */}
                <GlareHover
                    className="card-premium"
                    background="var(--bg-card)"
                    borderRadius="var(--radius-xl)"
                    borderColor="var(--border-subtle)"
                    glareOpacity={0.3}
                    glareSize={220}
                    style={{ padding: '1.5rem' }}
                >
                    <div className="section-header">
                        <h3 className="section-title">{t('profile-title-languages')}</h3>
                        <button className="btn-soft" style={{ padding: '0.5rem' }} onClick={() => openModal('languages', profile.languages)}>
                            <span className="material-symbols-outlined">edit</span>
                        </button>
                    </div>
                    <div className="tag-list">
                        {profile.languages.map((lang, index) => (
                            <span key={lang.id || `lang-${index}`} className="tag-item tag-language">
                                {lang.name} <span className="tag-level">• {getLanguageLabel(lang.level)}</span>
                            </span>
                        ))}
                    </div>
                </GlareHover>

                {/* Skills Card */}
                <GlareHover
                    className="card-premium"
                    background="var(--bg-card)"
                    borderRadius="var(--radius-xl)"
                    borderColor="var(--border-subtle)"
                    glareOpacity={0.3}
                    glareSize={220}
                    style={{ padding: '1.5rem' }}
                >
                    <div className="section-header">
                        <h3 className="section-title">{t('profile-title-skills')}</h3>
                        <button className="btn-soft" style={{ padding: '0.5rem' }} onClick={() => openModal('skills', profile.skills)}>
                            <span className="material-symbols-outlined">edit</span>
                        </button>
                    </div>
                    <div className="tag-list">
                        {profile.skills.map((skill, index) => (
                            <span key={skill.id || `skill-${index}`} className="tag-item tag-skill">
                                {skill.name} <span className="tag-level" style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>• {getSkillLabel(skill.level)}</span>
                            </span>
                        ))}
                    </div>
                </GlareHover>

                {/* Hobbies Card */}
                <GlareHover
                    className="card-premium"
                    background="var(--bg-card)"
                    borderRadius="var(--radius-xl)"
                    borderColor="var(--border-subtle)"
                    glareOpacity={0.3}
                    glareSize={220}
                    style={{ padding: '1.5rem' }}
                >
                    <div className="section-header">
                        <h3 className="section-title">{t('profile-title-hobbies')}</h3>
                        <button className="btn-soft" style={{ padding: '0.5rem' }} onClick={() => openModal('hobbies', profile.hobbies)}>
                            <span className="material-symbols-outlined">edit</span>
                        </button>
                    </div>
                    <div className="tag-list">
                        {profile.hobbies.map((hobby, index) => (
                            <span key={hobby.id || `hobby-${index}`} className="tag-item tag-hobby">
                                {hobby.name}
                            </span>
                        ))}
                    </div>
                </GlareHover>

            </aside>

            {/* --- Right Column: Main Content --- */}
            <main className="profile-content">
                {/* --- Sticky Header for Actions --- */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button
                        className={`btn-primary ${!isDirty ? 'btn-soft' : ''}`}
                        onClick={handleGlobalSave}
                        disabled={!isDirty}
                    >
                        <span className="material-symbols-outlined">save</span>
                        {isDirty ? t('profile-save-changes') : t('profile-saved')}
                    </button>
                </div>

                {/* About Section */}
                <GlareHover
                    className="card-premium"
                    background="var(--bg-card)"
                    borderRadius="var(--radius-xl)"
                    borderColor="var(--border-subtle)"
                    glareOpacity={0.3}
                    glareSize={240}
                    style={{ padding: '2rem' }}
                >
                    <div className="section-header">
                        <h2 className="section-title" style={{ fontSize: '1.5rem' }}>{t('profile-title-about')}</h2>
                        <button className="btn-soft" onClick={() => openModal('about', { about: profile.about })}>
                            <span className="material-symbols-outlined">edit_square</span>
                            Edit
                        </button>
                    </div>
                    <p style={{ lineHeight: '1.8', color: 'var(--text-secondary)', fontSize: '1.05rem', whiteSpace: 'pre-line' }}>
                        {profile.about}
                    </p>
                </GlareHover>

                {/* Experience Section */}
                <GlareHover
                    className="card-premium"
                    background="var(--bg-card)"
                    borderRadius="var(--radius-xl)"
                    borderColor="var(--border-subtle)"
                    glareOpacity={0.3}
                    glareSize={240}
                    style={{ padding: '2rem' }}
                >
                    <div className="section-header">
                        <h2 className="section-title" style={{ fontSize: '1.5rem' }}>{t('profile-title-experience')}</h2>
                        <button className="btn-soft" onClick={() => openModal('experiences')}>
                            <span className="material-symbols-outlined">add</span>
                        </button>
                    </div>

                    <div className="timeline-elegant">
                        {profile.experiences.map(exp => (
                            <div className="exp-item" key={exp.id}>
                                <div className="exp-bullet"></div>
                                <div className="exp-header">
                                    <div style={{ paddingRight: '1rem', flex: 1 }}>
                                        <div className="exp-role">{exp.role}</div>
                                        <div className="exp-company">{exp.company}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="exp-date">{exp.startYear} - {exp.endYear}</span>
                                        <button className="btn-icon-sm" onClick={() => openModal('experiences', exp)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit</span>
                                        </button>
                                        <button className="btn-icon-sm" onClick={() => handleDeleteItem('experiences', exp.id)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--secondary-color)' }}>delete</span>
                                        </button>
                                    </div>
                                </div>
                                <p className="exp-desc">{exp.description}</p>
                            </div>
                        ))}
                    </div>
                </GlareHover>

                {/* Education Section */}
                <GlareHover
                    className="card-premium"
                    background="var(--bg-card)"
                    borderRadius="var(--radius-xl)"
                    borderColor="var(--border-subtle)"
                    glareOpacity={0.3}
                    glareSize={240}
                    style={{ padding: '2rem' }}
                >
                    <div className="section-header">
                        <h2 className="section-title" style={{ fontSize: '1.5rem' }}>{t('profile-title-education')}</h2>
                        <button className="btn-soft" onClick={() => openModal('educations')}>
                            <span className="material-symbols-outlined">add</span>
                        </button>
                    </div>

                    <div className="timeline-elegant">
                        {profile.educations.map(edu => (
                            <div className="exp-item" key={edu.id}>
                                <div className="exp-bullet"></div>
                                <div className="exp-header">
                                    <div style={{ paddingRight: '1rem', flex: 1 }}>
                                        <div className="edu-institution">{edu.institution}</div>
                                        <div className="edu-degree">{edu.degree}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="exp-date">{edu.startYear} - {edu.endYear}</span>
                                        <button className="btn-icon-sm" onClick={() => openModal('educations', edu)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit</span>
                                        </button>
                                        <button className="btn-icon-sm" onClick={() => handleDeleteItem('educations', edu.id)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--secondary-color)' }}>delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlareHover>

                {/* Certificates Section */}
                <GlareHover
                    className="card-premium"
                    background="var(--bg-card)"
                    borderRadius="var(--radius-xl)"
                    borderColor="var(--border-subtle)"
                    glareOpacity={0.3}
                    glareSize={240}
                    style={{ padding: '2rem' }}
                >
                    <div className="section-header">
                        <h2 className="section-title" style={{ fontSize: '1.5rem' }}>{t('profile-title-certifications')}</h2>
                        <button className="btn-soft" onClick={() => openModal('certificates')}>
                            <span className="material-symbols-outlined">add</span>
                        </button>
                    </div>

                    <div className="cert-list">
                        {profile.certificates.map(cert => (
                            <div className="cert-file-item" key={cert.id}>
                                <div className="cert-file-icon">
                                    <span className="material-symbols-outlined">description</span>
                                </div>
                                <div className="cert-file-info">
                                    <span className="cert-file-name">{cert.fileName || cert.name}</span>
                                    <span className="cert-file-meta">{cert.fileSize || 'PDF'} • {cert.year}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="cert-file-action" onClick={() => openModal('certificates', cert)}>
                                        <span className="material-symbols-outlined">edit</span>
                                    </button>
                                    <button className="cert-file-action" onClick={() => handleDeleteItem('certificates', cert.id)}>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--secondary-color)' }}>delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlareHover>

            </main>

            {/* --- Modals --- */}
            <Modal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                title={modalConfig.data ? t('profile-modal-edit-item') : t('profile-modal-add-item')}
            >
                {modalConfig.type === 'experiences' && (
                    <ExperienceForm
                        initialData={modalConfig.data}
                        onSave={(data) => handleSaveItem('experiences', data)}
                        onCancel={closeModal}
                    />
                )}
                {modalConfig.type === 'educations' && (
                    <EducationForm
                        initialData={modalConfig.data}
                        onSave={(data) => handleSaveItem('educations', data)}
                        onCancel={closeModal}
                    />
                )}
                {modalConfig.type === 'about' && (
                    <AboutForm
                        initialData={modalConfig.data}
                        onSave={(data) => handleSaveItem('about', data)}
                        onCancel={closeModal}
                    />
                )}
                {modalConfig.type === 'personal' && (
                    <PersonalDetailsForm
                        initialData={modalConfig.data}
                        onSave={(data) => handleSaveItem('personal', data)}
                        onCancel={closeModal}
                    />
                )}
                {modalConfig.type === 'certificates' && (
                    <CertificateForm
                        initialData={modalConfig.data}
                        onSave={(data) => handleSaveItem('certificates', data)}
                        onCancel={closeModal}
                    />
                )}
                {modalConfig.type === 'languages' && (
                    <LanguagesForm
                        initialData={modalConfig.data}
                        onSave={(data) => handleSaveItem('languages', data)}
                        onCancel={closeModal}
                    />
                )}
                {modalConfig.type === 'skills' && (
                    <SkillsForm
                        initialData={modalConfig.data}
                        onSave={(data) => handleSaveItem('skills', data)}
                        onCancel={closeModal}
                    />
                )}
                {modalConfig.type === 'hobbies' && (
                    <HobbiesForm
                        initialData={modalConfig.data}
                        onSave={(data) => handleSaveItem('hobbies', data)}
                        onCancel={closeModal}
                    />
                )}
            </Modal>
        </div>
    );
};

export default ProfilePage;
