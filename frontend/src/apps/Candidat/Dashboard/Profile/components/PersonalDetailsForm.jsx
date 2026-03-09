import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const PersonalDetailsForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        title: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                firstName: initialData.firstName || '',
                lastName: initialData.lastName || '',
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
                        <label className="v-label required">{t('signup-first-name') || 'First Name'}</label>
                        <div className="v-input-wrapper">
                            <input
                                type="text"
                                required
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                className="v-input"
                                placeholder="e.g., Alex"
                            />
                        </div>
                    </div>

                    <div className="v-form-group">
                        <label className="v-label required">{t('signup-last-name') || 'Last Name'}</label>
                        <div className="v-input-wrapper">
                            <input
                                type="text"
                                required
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                className="v-input"
                                placeholder="e.g., Sterling"
                            />
                        </div>
                    </div>
                </div>

                <div className="v-form-row">
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
