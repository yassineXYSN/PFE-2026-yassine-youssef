import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import './FormStyles.css'; // Load FormStyles first to establish base form styles
import './ProfilePage.css'; // Load ProfilePage second to handle layout and overrides
import AboutForm from './components/AboutForm';
import PersonalDetailsForm from './components/PersonalDetailsForm';
import HobbiesForm from './components/HobbiesForm';
import LanguagesForm from './components/LanguagesForm';
import SkillsForm from './components/SkillsForm';
import EducationForm from './components/EducationForm';
import ExperienceForm from './components/ExperienceForm';
import CertificateForm from './components/CertificateForm';
import ContactForm from './components/ContactForm';
import GlareHover from '../Analytics/components/GlareHover/GlareHover';
import { useLanguage } from '../../../../core/useLanguage';
import { supabase } from '../../../../core/supabaseClient';

const Modal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;
    const modalContent = (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button
                    className="modal-close-btn"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                    {children}
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return modalContent;

    return createPortal(modalContent, document.body);
};

const ProfilePage = () => {
    const { t } = useLanguage();

    // --- State Management ---
    const [profile, setProfile] = useState({
        firstName: '',
        lastName: '',
        title: '',
        profileImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXSpxBmQzQ0YnS6_conRCkEzhsBb5r_vxL63WxF_uRooiw_mn75eExDTFMqYaAfOC4AS5_J9Xpc1iXPdYIzpaKa-UB7zb4HtdgA4iAjRSr61IjqPc06aaOEeeOcxj8eQG1p6JNYoLsfykGXk0a0O1CngEgduCHljMNU6qtV4900W4CkQ3-W5wEfU29O4fm2WgHIlJfLs3McYfml-3E3yYZsnpT0ojSNnlY6VxzOWj8vuabNj1eYp2qnFawgs7T38VQsi_dKgz6oOo',
        coverImage: null,
        about: '',
        experiences: [],
        educations: [],
        certificates: [],
        languages: [],
        skills: [],
        hobbies: [],
        // Contact fields
        phone: '',
        location: '',
        linkedin: '',
        github: '',
        twitter: '',
        website: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    React.useEffect(() => {
        const fetchProfileData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const response = await fetch('http://localhost:8000/candidat/profile', {
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setProfile(prev => ({
                            ...prev,
                            firstName: data.firstName || '',
                            lastName: data.lastName || '',
                            title: data.title || '',
                            about: data.about || '',
                            experiences: data.experiences || [],
                            educations: data.educations || [],
                            certificates: data.certificates || [],
                            languages: data.languages || [],
                            skills: data.skills || [],
                            hobbies: data.hobbies || [],
                            profileImage: data.profileImage || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXSpxBmQzQ0YnS6_conRCkEzhsBb5r_vxL63WxF_uRooiw_mn75eExDTFMqYaAfOC4AS5_J9Xpc1iXPdYIzpaKa-UB7zb4HtdgA4iAjRSr61IjqPc06aaOEeeOcxj8eQG1p6JNYoLsfykGXk0a0O1CngEgduCHljMNU6qtV4900W4CkQ3-W5wEfU29O4fm2WgHIlJfLs3McYfml-3E3yYZsnpT0ojSNnlY6VxzOWj8vuabNj1eYp2qnFawgs7T38VQsi_dKgz6oOo',
                            coverImage: data.coverImage || null,
                            location: data.address || data.location || '',
                            phone: data.phone || '',
                            linkedin: data.linkedinUrl || data.linkedin || '',
                            github: data.github || data.githubUrl || '',
                            twitter: data.twitter || data.twitterUrl || '',
                            website: data.website || data.websiteUrl || ''
                        }));
                    }
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileData();
    }, []);

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

    const formatMonthYear = (year, month) => {
        if (!year) return '';
        if (!month) return `${year}`;
        return `${month}/${year}`;
    };

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

            // Handle simple types (about, personal, contact)
            if (type === 'about') {
                return { ...prev, about: item.about };
            }
            if (type === 'personal') {
                return { ...prev, ...item }; // Merge name and title
            }
            if (type === 'contact') {
                return { ...prev, ...item }; // Merge contact fields
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
    const handleGlobalSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const response = await fetch('http://localhost:8000/candidat/profile', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(profile)
                });

                if (response.ok) {
                    setIsDirty(false);
                    alert("Profile updated successfully!");
                } else {
                    alert("Failed to update profile.");
                }
            }
        } catch (error) {
            console.error("Error saving profile:", error);
            alert("An error occurred while saving the profile.");
        } finally {
            setIsSaving(false);
        }
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

    // Image Upload Helper
    const uploadImage = async (file) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return null;

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('http://localhost:8000/candidat/profile/upload-image', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                return data.url;
            }
        } catch (error) {
            console.error("Error uploading image:", error);
        }
        return null;
    };

    // Handle Image Uploads
    const handleProfileImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = await uploadImage(file);
            if (url) {
                setProfile(prev => ({ ...prev, profileImage: url }));
                setIsDirty(true);
            } else {
                alert("Failed to upload profile image");
            }
        }
    };

    const handleCoverImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = await uploadImage(file);
            if (url) {
                setProfile(prev => ({ ...prev, coverImage: url }));
                setIsDirty(true);
            } else {
                alert("Failed to upload cover image");
            }
        }
    };

    if (isLoading) {
        return (
            <div className="profile-container candidat-profile-layout">
                {/* --- Left Column Skeleton --- */}
                <aside className="profile-sidebar">
                    {/* Hero Card Skeleton */}
                    <div className="card-premium hero-card pp-skeleton" style={{ background: 'var(--bg-card)', paddingBottom: '1.75rem', height: '420px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--pp-r-xl)', position: 'relative', overflow: 'hidden' }}>
                        <div className="pp-skeleton-cover pp-skeleton" style={{ background: 'var(--pp-bg-hover)' }}></div>
                        <div className="hero-avatar-wrapper" style={{ marginTop: '-3.25rem', marginBottom: '0.65rem' }}>
                            <div className="hero-avatar pp-skeleton pp-skeleton-avatar"></div>
                        </div>
                        <div className="hero-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="pp-skeleton pp-skeleton-title"></div>
                            <div className="pp-skeleton pp-skeleton-text pp-skeleton-text-short"></div>
                        </div>
                        <div className="hero-stats" style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', padding: '0.875rem 0', margin: '1.1rem 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div className="pp-skeleton" style={{ width: '40px', height: '30px', borderRadius: '4px' }}></div>
                            <div className="pp-skeleton" style={{ width: '40px', height: '30px', borderRadius: '4px' }}></div>
                            <div className="pp-skeleton" style={{ width: '40px', height: '30px', borderRadius: '4px' }}></div>
                        </div>
                        <div className="hero-actions" style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
                            <div className="pp-skeleton pp-skeleton-btn"></div>
                            <div className="pp-skeleton pp-skeleton-btn" style={{ width: '3rem' }}></div>
                        </div>
                    </div>

                    {/* Tags Card Skeleton */}
                    <div className="card-premium pp-skeleton" style={{ height: '140px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--pp-r-xl)' }}></div>
                    <div className="card-premium pp-skeleton" style={{ height: '140px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--pp-r-xl)' }}></div>
                </aside>

                {/* --- Right Column Skeleton --- */}
                <main className="profile-content">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <div className="pp-skeleton pp-skeleton-btn" style={{ width: '140px' }}></div>
                    </div>

                    {/* Sections */}
                    <div className="card-premium pp-skeleton" style={{ height: '220px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--pp-r-xl)' }}></div>
                    <div className="card-premium pp-skeleton" style={{ height: '320px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--pp-r-xl)' }}></div>
                    <div className="card-premium pp-skeleton" style={{ height: '280px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--pp-r-xl)' }}></div>
                </main>
            </div>
        );
    }

    return (
        <div className="profile-container candidat-profile-layout">

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
                        <h1>{`${profile.firstName} ${profile.lastName}`.trim() || 'No Name'}</h1>
                        <p>{profile.title}</p>
                    </div>

                    <div className="hero-stats">
                        <div className="stat-item">
                            <span className="stat-value">{(() => {
                                const exps = profile.experiences || [];
                                if (exps.length === 0) return '—';
                                const today = new Date();
                                let totalMonths = 0;
                                exps.forEach(exp => {
                                    const startYear = parseInt(exp.startYear, 10);
                                    if (!startYear) return;
                                    const startMonth = parseInt(exp.startMonth, 10) || 1;
                                    const startDate = new Date(startYear, startMonth - 1, 1);
                                    const endYear = exp.ongoing ? today.getFullYear() : parseInt(exp.endYear, 10);
                                    if (!endYear) return;
                                    const endMonthVal = exp.ongoing ? today.getMonth() + 1 : (parseInt(exp.endMonth, 10) || 12);
                                    const endDate = new Date(endYear, endMonthVal - 1, 1);
                                    const diff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
                                    totalMonths += Math.max(0, diff);
                                });
                                if (totalMonths <= 0) return '—';
                                if (totalMonths < 12) return `${totalMonths}mo`;
                                const yrs = Math.round((totalMonths / 12) * 10) / 10;
                                return `${yrs}yrs`;
                            })()}</span>
                            <span className="stat-label">Experience</span>
                        </div>
                    </div>

                    <div className="hero-actions">
                        <button
                            className="btn-primary"
                            onClick={() => openModal('contact', {
                                phone: profile.phone,
                                location: profile.location,
                                linkedin: profile.linkedin,
                                github: profile.github,
                                twitter: profile.twitter,
                                website: profile.website,
                            })}
                        >
                            <span className="material-symbols-outlined">contacts</span>
                            Contact
                        </button>
                        <button className="btn-soft" onClick={() => openModal('personal', { firstName: profile.firstName, lastName: profile.lastName, title: profile.title })}>
                            <span className="material-symbols-outlined">edit</span>
                        </button>
                    </div>

                    {/* Details List */}
                    <div className="details-list" style={{ marginTop: '2rem' }}>
                        {(profile.location) && (
                            <div className="detail-item">
                                <div className="detail-icon">
                                    <span className="material-symbols-outlined">location_on</span>
                                </div>
                                <span>{profile.location}</span>
                            </div>
                        )}
                        {profile.phone && (
                            <div className="detail-item">
                                <div className="detail-icon">
                                    <span className="material-symbols-outlined">phone</span>
                                </div>
                                <span>{profile.phone}</span>
                            </div>
                        )}
                        {profile.linkedin && (
                            <div className="detail-item">
                                <div className="detail-icon">
                                    <span className="material-symbols-outlined">link</span>
                                </div>
                                <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#0077b5', textDecoration: 'none', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>LinkedIn</a>
                            </div>
                        )}
                        {profile.github && (
                            <div className="detail-item">
                                <div className="detail-icon">
                                    <span className="material-symbols-outlined">code</span>
                                </div>
                                <a href={profile.github} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>GitHub</a>
                            </div>
                        )}
                        {profile.twitter && (
                            <div className="detail-item">
                                <div className="detail-icon">
                                    <span className="material-symbols-outlined">tag</span>
                                </div>
                                <a href={profile.twitter} target="_blank" rel="noopener noreferrer" style={{ color: '#1da1f2', textDecoration: 'none', fontSize: '0.9rem' }}>Twitter / X</a>
                            </div>
                        )}
                        {profile.website && (
                            <div className="detail-item">
                                <div className="detail-icon">
                                    <span className="material-symbols-outlined">language</span>
                                </div>
                                <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--dashboard-accent)', textDecoration: 'none', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Website</a>
                            </div>
                        )}
                        {!profile.location && !profile.phone && !profile.linkedin && !profile.github && !profile.twitter && !profile.website && (
                            <div className="detail-item" style={{ opacity: 0.5 }}>
                                <div className="detail-icon">
                                    <span className="material-symbols-outlined">contacts</span>
                                </div>
                                <span style={{ fontSize: '0.875rem' }}>No contact info yet</span>
                            </div>
                        )}
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
                        disabled={!isDirty || isSaving}
                        style={isSaving ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                    >
                        {isSaving ? (
                            <>
                                <span className="material-symbols-outlined spin-icon">progress_activity</span>
                                {t('profile-saving') || 'Saving...'}
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">save</span>
                                {isDirty ? t('profile-save-changes') : t('profile-saved')}
                            </>
                        )}
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
                                        <div className="exp-role">{exp.role || exp.position}</div>
                                        <div className="exp-company">{exp.company}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="exp-date">
                                            {formatMonthYear(exp.startYear, exp.startMonth)} - {exp.ongoing ? 'Present' : formatMonthYear(exp.endYear, exp.endMonth)}
                                        </span>
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
                                        <div className="edu-degree">{edu.degree || edu.socialLink || ''}</div>
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
                                    <span className="cert-file-name">{cert.fileName || cert.documentName || cert.name}</span>
                                    <span className="cert-file-meta">{cert.fileSize || cert.issuingOrganization || 'PDF'} • {cert.year || cert.issueDate || '-'}</span>
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
                {modalConfig.type === 'hobbies' && (
                    <HobbiesForm
                        initialData={profile.hobbies}
                        onSave={(data) => handleSaveItem('hobbies', data)}
                        onCancel={closeModal}
                    />
                )}
                {modalConfig.type === 'languages' && (
                    <LanguagesForm
                        initialData={profile.languages}
                        onSave={(data) => handleSaveItem('languages', data)}
                        onCancel={closeModal}
                    />
                )}
                {modalConfig.type === 'skills' && (
                    <SkillsForm
                        initialData={profile.skills}
                        onSave={(data) => handleSaveItem('skills', data)}
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
                {modalConfig.type === 'experiences' && (
                    <ExperienceForm
                        initialData={modalConfig.data}
                        onSave={(data) => handleSaveItem('experiences', data)}
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
                {modalConfig.type === 'contact' && (
                    <ContactForm
                        initialData={modalConfig.data}
                        onSave={(data) => handleSaveItem('contact', data)}
                        onCancel={closeModal}
                    />
                )}
            </Modal>
        </div>
    );
};

export default ProfilePage;
