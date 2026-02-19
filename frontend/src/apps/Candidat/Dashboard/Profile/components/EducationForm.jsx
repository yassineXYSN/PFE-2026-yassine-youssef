import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const EducationForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const currentYear = new Date().getFullYear();

    const [formData, setFormData] = useState({
        id: null,
        institution: '',
        startYear: '',
        endYear: '',
        ongoing: false,
        socialLink: '',
        certificate: null
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                id: initialData.id || Date.now(),
                institution: initialData.institution || '',
                startYear: initialData.startYear || '',
                endYear: initialData.endYear || '',
                ongoing: initialData.ongoing || false,
                socialLink: initialData.socialLink || '',
                certificate: initialData.certificate || null
            });
        } else {
            setFormData({
                id: Date.now(),
                institution: '',
                startYear: '',
                endYear: '',
                ongoing: false,
                socialLink: '',
                certificate: null
            });
        }
    }, [initialData]);

    const handleStartYearChange = (value) => {
        if (!value) {
            setFormData({ ...formData, startYear: '' });
            return;
        }
        const year = parseInt(value);
        if (value.length === 4) {
            if (year > currentYear) {
                setFormData({ ...formData, startYear: currentYear.toString() });
                return;
            }
            if (formData.endYear && formData.endYear.length === 4 && year > parseInt(formData.endYear)) {
                return; // Don't allow start > end
            }
        }
        setFormData({ ...formData, startYear: value });
    };

    const handleEndYearChange = (value) => {
        if (!value) {
            setFormData({ ...formData, endYear: '' });
            return;
        }
        const year = parseInt(value);
        if (value.length === 4) {
            if (formData.startYear && formData.startYear.length === 4 && year < parseInt(formData.startYear)) {
                return; // Don't allow end < start
            }
            if (year > currentYear) {
                setFormData({ ...formData, endYear: value, ongoing: true });
                return;
            }
        }
        setFormData({ ...formData, endYear: value });
    };

    const handleOngoingChange = (checked) => {
        if (!checked || !formData.endYear || parseInt(formData.endYear) > currentYear) {
            setFormData({
                ...formData,
                ongoing: checked,
                endYear: checked ? '' : formData.endYear
            });
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                return;
            }
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                alert('Only PDF, JPG, JPEG, and PNG files are allowed');
                return;
            }
            setFormData({ ...formData, certificate: file });
        }
    };

    const handleRemoveFile = () => {
        setFormData({ ...formData, certificate: null });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="profile-form">
            {/* Institution */}
            <div className="form-group">
                <label>{t('account-setup-step-4-institution') || 'Institution'} *</label>
                <input
                    type="text"
                    required
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    className="form-input"
                    placeholder="e.g., Stanford University"
                />
            </div>

            {/* Start / End Year */}
            <div className="form-row">
                <div className="form-group">
                    <label>{t('account-setup-step-4-start-year') || 'Start Year'}</label>
                    <input
                        type="number"
                        value={formData.startYear}
                        onChange={(e) => handleStartYearChange(e.target.value)}
                        className="form-input"
                        placeholder="2020"
                        min="1940"
                        max="9999"
                    />
                </div>
                <div className="form-group">
                    <label>{t('account-setup-step-4-end-year') || 'End Year'}</label>
                    <input
                        type="number"
                        value={formData.endYear}
                        onChange={(e) => handleEndYearChange(e.target.value)}
                        className="form-input"
                        placeholder="2024"
                        min="1940"
                        max="9999"
                        disabled={formData.ongoing}
                    />
                </div>
            </div>

            {/* Ongoing Checkbox */}
            <div className="form-group checkbox-group">
                <label className="switch-label">
                    <input
                        type="checkbox"
                        checked={formData.ongoing}
                        onChange={(e) => handleOngoingChange(e.target.checked)}
                        disabled={formData.endYear && parseInt(formData.endYear) <= currentYear}
                    />
                    <span>{t('account-setup-step-4-ongoing') || 'Currently studying here'}</span>
                </label>
            </div>

            {/* Social Link */}
            <div className="form-group">
                <label>{t('account-setup-step-4-social-link') || 'Institution Link'} (Optional)</label>
                <input
                    type="url"
                    value={formData.socialLink}
                    onChange={(e) => setFormData({ ...formData, socialLink: e.target.value })}
                    className="form-input"
                    placeholder="https://..."
                />
            </div>

            {/* Certificate Upload */}
            <div className="form-group">
                <label>{t('account-setup-step-4-certificate-diploma') || 'Certificate/Diploma'} (Optional)</label>
                {!formData.certificate ? (
                    <label className="file-upload-mock">
                        <input
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                        />
                        <span className="material-symbols-outlined">cloud_upload</span>
                        <p>Click to upload document</p>
                    </label>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-lg)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>description</span>
                        <span style={{ flex: 1, fontSize: '0.9rem' }}>{formData.certificate.name || 'Uploaded file'}</span>
                        <button type="button" onClick={handleRemoveFile} className="btn-ghost" style={{ padding: '0.25rem', color: 'var(--secondary-color)' }}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">
                    {initialData?.id ? 'Save Changes' : 'Add Education'}
                </button>
            </div>
        </form>
    );
};

export default EducationForm;
