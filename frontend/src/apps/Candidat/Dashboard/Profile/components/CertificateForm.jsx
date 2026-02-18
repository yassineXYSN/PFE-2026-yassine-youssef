import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const CertificateForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

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
        } else {
            setFormData({
                id: Date.now(),
                name: '',
                issuingOrganization: '',
                issueDate: '',
                description: '',
                document: null,
                documentName: ''
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
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                alert('Only PDF, JPG, JPEG, and PNG files are allowed');
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
        // Keep 'fileName' and 'year' for backward compat
        onSave({
            ...formData,
            fileName: formData.documentName,
            year: formData.issueDate ? formData.issueDate.split('-')[0] : ''
        });
    };

    return (
        <form onSubmit={handleSubmit} className="profile-form">
            {/* Certificate Name */}
            <div className="form-group">
                <label>{t('account-setup-step-6-name') || 'Certificate Name'} *</label>
                <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    placeholder="e.g., AWS Certified Solutions Architect"
                />
            </div>

            {/* Issuing Organization */}
            <div className="form-group">
                <label>{t('account-setup-step-6-organization') || 'Issuing Organization'} *</label>
                <input
                    type="text"
                    required
                    value={formData.issuingOrganization}
                    onChange={(e) => setFormData({ ...formData, issuingOrganization: e.target.value })}
                    className="form-input"
                    placeholder="e.g., Amazon Web Services"
                />
            </div>

            {/* Issue Date + Document Upload */}
            <div className="form-row">
                <div className="form-group">
                    <label>{t('account-setup-step-6-issued-date') || 'Issue Date'}</label>
                    <input
                        type="month"
                        value={formData.issueDate}
                        onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                        max={`${currentYear}-${currentMonth.toString().padStart(2, '0')}`}
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>{t('account-setup-step-6-document') || 'Document'} *</label>
                    {!formData.documentName ? (
                        <label className="file-upload-mock" style={{ padding: '1rem' }}>
                            <input
                                type="file"
                                onChange={handleFileChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                                style={{ display: 'none' }}
                            />
                            <span className="material-symbols-outlined">upload_file</span>
                            <p>Upload</p>
                        </label>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-lg)', fontSize: '0.85rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.25rem' }}>description</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formData.documentName}</span>
                            <button type="button" onClick={handleRemoveFile} className="btn-ghost" style={{ padding: '0.2rem', color: 'var(--secondary-color)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Description */}
            <div className="form-group">
                <label>{t('account-setup-step-6-description') || 'Description'} (Optional)</label>
                <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="form-textarea"
                    rows="3"
                    placeholder="Briefly describe what this certification covers..."
                />
            </div>

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">
                    {initialData?.id ? 'Save Changes' : 'Add Certificate'}
                </button>
            </div>
        </form>
    );
};

export default CertificateForm;
