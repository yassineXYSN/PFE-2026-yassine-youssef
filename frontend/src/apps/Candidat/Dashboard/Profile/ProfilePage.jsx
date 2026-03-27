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
import { apiFetch } from '../../../../core/api';

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
        website: '',
        // CV
        cv: null
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    React.useEffect(() => {
        const fetchProfileData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    try {
                        const data = await apiFetch('/candidat/profile');
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
                            profileImage: data.profileImage || data.profilePicture || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXSpxBmQzQ0YnS6_conRCkEzhsBb5r_vxL63WxF_uRooiw_mn75eExDTFMqYaAfOC4AS5_J9Xpc1iXPdYIzpaKa-UB7zb4HtdgA4iAjRSr61IjqPc06aaOEeeOcxj8eQG1p6JNYoLsfykGXk0a0O1CngEgduCHljMNU6qtV4900W4CkQ3-W5wEfU29O4fm2WgHIlJfLs3McYfml-3E3yYZsnpT0ojSNnlY6VxzOWj8vuabNj1eYp2qnFawgs7T38VQsi_dKgz6oOo',
                            coverImage: data.coverImage || null,
                            location: data.address || data.location || '',
                            phone: data.phone || '',
                            linkedin: data.linkedinUrl || data.linkedin || '',
                            github: data.github || data.githubUrl || '',
                            twitter: data.twitter || data.twitterUrl || '',
                            website: data.website || data.websiteUrl || '',
                            cv: data.cv || null
                        }));
                    } catch (err) {
                        console.error("Error fetching profile:", err);
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
        if (level >= 95) return t('lang-native') || 'Native';
        if (level >= 75) return t('lang-fluent') || 'Fluent';
        if (level >= 50) return t('lang-conversational') || 'Conversational';
        return t('lang-beginner') || 'Beginner';
    };

    const getSkillLabel = (level) => {
        if (level >= 80) return t('skill-expert') || 'Expert';
        if (level >= 50) return t('skill-intermediate') || 'Intermediate';
        return t('skill-beginner') || 'Beginner';
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

    // Upload Document Helper (saves file to server, returns metadata)
    const uploadDocument = async (file) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return null;

            return await apiFetch('/candidat/profile/upload-document', {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            console.error("Error uploading document:", error);
        }
        return null;
    };

    // Save Profile (Global)
    const handleGlobalSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Deep clone profile to avoid mutating state
            const payload = JSON.parse(JSON.stringify(profile, (key, value) => {
                // File objects become null during stringify — we handle them below
                if (value instanceof File) return '__FILE__';
                return value;
            }));

            // Upload any new File objects from experiences
            for (let i = 0; i < (profile.experiences || []).length; i++) {
                const exp = profile.experiences[i];
                if (exp.document instanceof File) {
                    const meta = await uploadDocument(exp.document);
                    if (meta) {
                        payload.experiences[i].document = meta;
                        payload.experiences[i].documentName = meta.filename;
                    } else {
                        delete payload.experiences[i].document;
                    }
                }
            }

            // Upload any new File objects from educations
            for (let i = 0; i < (profile.educations || []).length; i++) {
                const edu = profile.educations[i];
                if (edu.certificate instanceof File) {
                    const meta = await uploadDocument(edu.certificate);
                    if (meta) {
                        payload.educations[i].certificate = meta;
                        payload.educations[i].certificateName = meta.filename;
                    } else {
                        delete payload.educations[i].certificate;
                    }
                }
            }

            // Upload any new File objects from certificates
            for (let i = 0; i < (profile.certificates || []).length; i++) {
                const cert = profile.certificates[i];
                if (cert.document instanceof File) {
                    const meta = await uploadDocument(cert.document);
                    if (meta) {
                        payload.certificates[i].document = meta;
                        payload.certificates[i].documentName = meta.filename;
                    } else {
                        delete payload.certificates[i].document;
                    }
                }
            }

            // Clean up any remaining __FILE__ markers
            const cleanPayload = JSON.parse(JSON.stringify(payload, (key, value) => {
                if (value === '__FILE__') return undefined;
                return value;
            }));

            await apiFetch('/candidat/profile', {
                method: 'PUT',
                body: JSON.stringify(cleanPayload)
            });

            // Refresh profile to get clean state from backend
            const data = await apiFetch('/candidat/profile');
            setProfile(prev => ({
                ...prev,
                experiences: data.experiences || [],
                educations: data.educations || [],
                certificates: data.certificates || [],
                cv: data.cv || null
            }));
            setIsDirty(false);
            alert(t('profile-updated-success') || 'Profile updated successfully!');
        } catch (error) {
            console.error("Error saving profile:", error);
            alert(t('profile-updated-error') || 'An error occurred while saving the profile.');
        } finally {
            setIsSaving(false);
        }
    };

    // Delete Item
    const handleDeleteItem = (type, id) => {
        if (window.confirm(t('profile-confirm-delete') || 'Are you sure you want to delete this item?')) {
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

            const data = await apiFetch('/candidat/profile/upload-image', {
                method: 'POST',
                body: formData
            });
            return data.url;
        } catch (error) {
            console.error("Error uploading image:", error);
        }
        return null;
    };

    // Download Document Helper
    const handleDownload = async (url, fallbackName) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await apiFetch(`http://localhost:8000${url}`, {
                rawResponse: true
            });

            if (response.ok) {
                const blob = await response.blob();
                const disposition = response.headers.get('Content-Disposition');
                let filename = fallbackName;
                if (disposition) {
                    const match = disposition.match(/filename="?([^"]+)"?/);
                    if (match) filename = match[1];
                }
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                a.click();
                URL.revokeObjectURL(a.href);
            }
        } catch (error) {
            console.error('Error downloading file:', error);
        }
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
                alert(t('profile-image-fail') || 'Failed to upload profile image');
            }
        }
    };

    // Handle CV Upload
    const handleCvUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowed.includes(file.type)) {
            alert(t('profile-cv-type-error') || 'CV must be a PDF, DOC, or DOCX file');
            return;
        }
        const meta = await uploadDocument(file);
        if (meta) {
            setProfile(prev => ({ ...prev, cv: meta }));
            setIsDirty(true);
        } else {
            alert(t('profile-upload-fail') || 'Failed to upload CV');
        }
        e.target.value = '';
    };

    // Open CV in new tab
    const handleOpenCv = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const response = await apiFetch('/candidat/profile/cv/download', {
                rawResponse: true
            });
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error opening CV:', error);
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
                alert(t('profile-cover-fail') || 'Failed to upload cover image');
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
                            <span>{t('profile-change-cover') || 'Change Cover'}</span>
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
                        <h1>{`${profile.firstName} ${profile.lastName}`.trim() || t('profile-no-name') || 'No Name'}</h1>
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
                                if (totalMonths < 12) return `${totalMonths} ${t('profile-exp-months') || 'months'}`;
                                const yrs = Math.round((totalMonths / 12) * 10) / 10;
                                return `${yrs} ${yrs === 1 ? (t('profile-exp-year') || 'year') : (t('profile-exp-years') || 'years')}`;
                            })()}</span>
                            <span className="stat-label">{t('profile-experience-label') || 'Experience'}</span>
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
                            {t('profile-contact-btn') || 'Contact'}
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
                                <span style={{ fontSize: '0.875rem' }}>{t('profile-no-contact') || 'No contact info yet'}</span>
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
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '1rem' }}>
                    {profile.cv && profile.cv.filename ? (
                        <div className="cv-header-actions">
                            <button className="btn-soft" title="Download CV" onClick={() => handleDownload('/candidat/profile/cv/download', profile.cv.filename || 'cv.pdf')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
                                CV
                            </button>
                            <label className="btn-soft" title={t('profile-replace-cv') || 'Replace CV'} style={{ cursor: 'pointer' }}>
                                <input type="file" accept=".pdf,.doc,.docx" onChange={handleCvUpload} style={{ display: 'none' }} />
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>edit</span>
                                {t('profile-replace-cv') || 'Replace CV'}
                            </label>
                        </div>
                    ) : (
                        <label className="btn-soft" style={{ cursor: 'pointer' }}>
                            <input type="file" accept=".pdf,.doc,.docx" onChange={handleCvUpload} style={{ display: 'none' }} />
                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>upload</span>
                            {t('profile-upload-cv') || 'Upload CV'}
                        </label>
                    )}
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
                            {t('profile-edit-btn') || 'Edit'}
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
                                            {formatMonthYear(exp.startYear, exp.startMonth)} - {exp.ongoing ? (t('profile-present') || 'Present') : formatMonthYear(exp.endYear, exp.endMonth)}
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
                                {(exp.document || exp.documentName) && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <button className="cert-file-action" title="Download Document" onClick={() => handleDownload(`/candidat/profile/experiences/${exp.id}/download`, exp.documentName || 'document.pdf')}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>download</span>
                                            <span style={{ fontSize: '0.8rem', marginLeft: '0.25rem' }}>{exp.documentName || t('profile-uploaded-doc') || 'Document'}</span>
                                        </button>
                                    </div>
                                )}
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
                                        {(edu.certificate || edu.certificateName) && (
                                            <button className="cert-file-action" title="Download Certificate" onClick={() => handleDownload(`/candidat/profile/educations/${edu.id}/download`, edu.certificateName || 'certificate.pdf')}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>download</span>
                                            </button>
                                        )}
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
                                    {(cert.document || cert.documentName || cert.fileName) && (
                                        <button className="cert-file-action" title="Download" onClick={() => handleDownload(`/candidat/profile/certificates/${cert.id}/download`, cert.documentName || cert.fileName || 'certificate.pdf')}>
                                            <span className="material-symbols-outlined">download</span>
                                        </button>
                                    )}
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

                {/* CV / Resume Section */}
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
                        <h2 className="section-title" style={{ fontSize: '1.5rem' }}>{t('profile-title-cv') || 'CV / Resume'}</h2>
                    </div>

                    {profile.cv && profile.cv.filename ? (
                        <div className="cert-list">
                            <div className="cert-file-item">
                                <div className="cert-file-icon">
                                    <span className="material-symbols-outlined">article</span>
                                </div>
                                <div className="cert-file-info">
                                    <span className="cert-file-name">{profile.cv.filename}</span>
                                    <span className="cert-file-meta">{profile.cv.content_type || 'PDF'} • {profile.cv.size ? `${(profile.cv.size / 1024).toFixed(0)} KB` : ''}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="cert-file-action" title="Download CV" onClick={() => handleDownload('/candidat/profile/cv/download', profile.cv.filename || 'cv.pdf')}>
                                        <span className="material-symbols-outlined">download</span>
                                    </button>
                                    <button className="cert-file-action" title="Open CV" onClick={handleOpenCv}>
                                        <span className="material-symbols-outlined">open_in_new</span>
                                    </button>
                                    <label className="cert-file-action" title="Replace CV" style={{ cursor: 'pointer' }}>
                                        <input type="file" accept=".pdf,.doc,.docx" onChange={handleCvUpload} style={{ display: 'none' }} />
                                        <span className="material-symbols-outlined">edit</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="cv-upload-empty">
                            <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--text-tertiary)' }}>upload_file</span>
                            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0' }}>{t('profile-no-cv') || 'No CV uploaded yet'}</p>
                            <label className="btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input type="file" accept=".pdf,.doc,.docx" onChange={handleCvUpload} style={{ display: 'none' }} />
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>upload</span>
                                {t('profile-upload-cv') || 'Upload CV'}
                            </label>
                        </div>
                    )}
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
