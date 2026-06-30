import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const SOCIAL_FIELDS = [
    {
        key: 'linkedin',
        label: 'LinkedIn',
        placeholder: 'https://linkedin.com/in/yourname',
        icon: 'link',
        iconColor: '#0077b5',
    },
    {
        key: 'github',
        label: 'GitHub',
        placeholder: 'https://github.com/yourhandle',
        icon: 'code',
        iconColor: '#24292f',
    },
    {
        key: 'twitter',
        label: 'X / Twitter',
        placeholder: 'https://x.com/yourhandle',
        icon: 'tag',
        iconColor: '#1da1f2',
    },
    {
        key: 'website',
        label: 'Personal Website',
        placeholder: 'https://yoursite.com',
        icon: 'language',
        iconColor: 'var(--dashboard-accent)',
        labelKey: 'profile-personal-website',
    },
];

const ContactForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        phone: '',
        location: '',
        linkedin: '',
        github: '',
        twitter: '',
        website: '',
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                phone: initialData.phone || '',
                location: initialData.location || '',
                linkedin: initialData.linkedin || '',
                github: initialData.github || '',
                twitter: initialData.twitter || '',
                website: initialData.website || '',
            });
        }
    }, [initialData]);

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="profile-form-container">
            <div className="v-form-header">
                <h3 className="v-form-title">{t('profile-contact-title') || 'Contact Information'}</h3>
                <p className="v-form-subtitle">
                    {t('profile-contact-desc') || 'Update your phone number, location, and social links so recruiters can reach you.'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="v-form-grid">

                {/* Phone & Location */}
                <div className="v-form-row">
                    <div className="v-form-group">
                        <label className="v-label">
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle', color: '#10b981' }}>phone</span>
                            {t('profile-phone') || 'Phone Number'}
                        </label>
                        <div className="v-input-wrapper">
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                className="v-input"
                                placeholder="e.g., +1 234 567 8900"
                            />
                        </div>
                    </div>

                    <div className="v-form-group">
                        <label className="v-label">
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle', color: '#f59e0b' }}>location_on</span>
                            {t('profile-location') || 'Location'}
                        </label>
                        <div className="v-input-wrapper">
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => handleChange('location', e.target.value)}
                                className="v-input"
                                placeholder="e.g., Paris, France"
                            />
                        </div>
                    </div>
                </div>

                {/* Social Links */}
                <div style={{ borderTop: '1px solid var(--dashboard-border)', paddingTop: '1.5rem' }}>
                    <p className="v-label" style={{ marginBottom: '1rem', color: 'var(--dashboard-muted)', fontWeight: 600 }}>
                        {t('profile-social-presence') || 'Social & Online Presence'}
                    </p>
                    <div className="v-form-grid">
                        {SOCIAL_FIELDS.map(({ key, label, placeholder, icon, iconColor }) => (
                            <div className="v-form-group" key={key}>
                                <label className="v-label">
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle', color: iconColor }}>{icon}</span>
                                    {key === 'website' ? (t('profile-personal-website') || label) : label}
                                </label>
                                <div className="v-input-wrapper">
                                    <input
                                        type="url"
                                        value={formData[key]}
                                        onChange={(e) => handleChange(key, e.target.value)}
                                        className="v-input"
                                        placeholder={placeholder}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="v-btn-actions">
                    <button type="button" onClick={onCancel} className="v-btn v-btn-secondary">
                        {t('common-cancel') || 'Cancel'}
                    </button>
                    <button type="submit" className="v-btn v-btn-primary">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check</span>
                        {t('profile-apply-changes') || 'Apply'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ContactForm;
