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
        <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
                <label>{t('full-name') || 'Full Name'} *</label>
                <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    placeholder="e.g., Alex Sterling"
                />
            </div>

            <div className="form-group">
                <label>{t('job-title') || 'Job Title'} *</label>
                <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="form-input"
                    placeholder="e.g., Senior Product Designer"
                />
            </div>

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">Save Details</button>
            </div>
        </form>
    );
};

export default PersonalDetailsForm;
