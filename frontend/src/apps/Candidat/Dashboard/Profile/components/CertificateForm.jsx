import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const CertificateForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();

    const [formData, setFormData] = useState({
        id: null,
        name: '',
        issuingOrganization: '',
        issueDate: '',
        description: '',
        document: null,
        documentName: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                id: initialData.id || Date.now(),
                name: initialData.name || '',
                issuingOrganization: initialData.issuingOrganization || '',
                issueDate: initialData.issueDate || initialData.year || '',
                description: initialData.description || '',
                document: initialData.document || null,
                documentName: initialData.documentName || initialData.fileName || ''
            });
        }
    }, [initialData]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                return;
            }
            setFormData({ ...formData, document: file, documentName: file.name });
        }
    };

    const handleRemoveFile = () => {
        setFormData({ ...formData, document: null, documentName: '' });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...formData,
            fileName: formData.documentName,
            year: formData.issueDate ? formData.issueDate.split('-')[0] : ''
        });
    };

    return (
        <div className="profile-form-container">
            <div className="v-form-header">
                <h3 className="v-form-title">{t('profile-edit-certificate-title') || 'Certificates'}</h3>
                <p className="v-form-subtitle">{t('profile-edit-certificate-desc') || 'Attach certifications that validate your high-value skills.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="v-form-grid">
                <div className="v-form-group">
                    <label className="v-label required">{t('account-setup-step-6-name') || 'Certificate Name'}</label>
                    <div className="v-input-wrapper">
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="v-input"
                            placeholder="e.g., AWS Certified Solutions Architect"
                        />
                    </div>
                </div>

                <div className="v-form-row">
                    <div className="v-form-group">
                        <label className="v-label required">{t('account-setup-step-6-organization') || 'Issuing Organization'}</label>
                        <div className="v-input-wrapper">
                            <input
                                type="text"
                                required
                                value={formData.issuingOrganization}
                                onChange={(e) => setFormData({ ...formData, issuingOrganization: e.target.value })}
                                className="v-input"
                                placeholder="e.g., Amazon Web Services"
                            />
                        </div>
                    </div>

                    <div className="v-form-group">
                        <label className="v-label">{t('account-setup-step-6-issue-date') || 'Issue Date'}</label>
                        <div className="v-input-wrapper">
                            <input
                                type="month"
                                value={formData.issueDate}
                                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                                className="v-input"
                            />
                        </div>
                    </div>
                </div>

                <div className="v-form-group">
                    <label className="v-label">{t('account-setup-step-6-description') || 'Description'}</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="v-textarea"
                        rows="4"
                        placeholder="Briefly describe what this certificate covers..."
                    />
                </div>

                <div className="v-form-group">
                    <label className="v-label">{t('account-setup-step-6-attachment') || 'Attachment'} (Optional)</label>
                    {!formData.documentName ? (
                        <label className="v-drop-zone">
                            <input
                                type="file"
                                className="v-input-hidden"
                                onChange={handleFileChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                                style={{ display: 'none' }}
                            />
                            <span className="material-symbols-outlined v-drop-zone-icon">verified_user</span>
                            <span className="v-drop-zone-text">Click to upload certificate</span>
                            <span className="v-drop-zone-hint">PDF, JPG, PNG (Max 5MB)</span>
                        </label>
                    ) : (
                        <div className="v-file-preview">
                            <span className="material-symbols-outlined">badge</span>
                            <div className="v-file-info">
                                <span className="v-file-name">{formData.documentName}</span>
                            </div>
                            <span className="material-symbols-outlined v-file-remove" onClick={handleRemoveFile}>close</span>
                        </div>
                    )}
                </div>

                <div className="v-btn-actions">
                    <button type="button" onClick={onCancel} className="v-btn v-btn-secondary">
                        {t('common-cancel') || 'Cancel'}
                    </button>
                    <button type="submit" className="v-btn v-btn-primary">
                        <span className="material-symbols-outlined">workspace_premium</span>
                        {initialData?.id ? 'Save Changes' : 'Add Certificate'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CertificateForm;
