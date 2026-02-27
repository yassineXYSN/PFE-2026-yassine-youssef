import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const PersonalDetailsForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        name: '',
        title: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                title: initialData.title || ''
            });
        }
    }, [initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="profile-form-container">
            <div className="v-form-header">
                <h3 className="v-form-title">{t('profile-edit-personal-title') || 'Personal Details'}</h3>
                <p className="v-form-subtitle">{t('profile-edit-personal-desc') || 'Update how your name and role appear across your profile.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="v-form-grid">
                <div className="v-form-row">
                    <div className="v-form-group">
                        <label className="v-label required">{t('full-name') || 'Full Name'}</label>
                        <div className="v-input-wrapper">
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="v-input"
                                placeholder="e.g., Alex Sterling"
                            />
                        </div>
                    </div>

                    <div className="v-form-group">
                        <label className="v-label required">{t('job-title') || 'Job Title'}</label>
                        <div className="v-input-wrapper">
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="v-input"
                                placeholder="e.g., Senior Product Designer"
                            />
                        </div>
                    </div>
                </div>

                <div className="v-btn-actions">
                    <button type="button" onClick={onCancel} className="v-btn v-btn-secondary">
                        {t('common-cancel') || 'Cancel'}
                    </button>
                    <button type="submit" className="v-btn v-btn-primary">
                        {t('profile-save-changes') || 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PersonalDetailsForm;
