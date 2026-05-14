import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const isBrowserFile = (value) => typeof File !== 'undefined' && value instanceof File;

const getDocumentName = (document, fallback = '') =>
    fallback || document?.filename || document?.name || '';

const EMPTY_FORM = {
    id: null,
    name: '',
    issuingOrganization: '',
    issueDate: '',
    description: '',
    document: null,
    documentName: ''
};

const CertificateForm = ({ initialData, onSave, onCancel, onUploadDocument = null }) => {
    const { t } = useLanguage();
    const [isUploading, setIsUploading] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });

    useEffect(() => {
        if (initialData) {
            setFormData({
                id: initialData.id || Date.now(),
                name: initialData.name || '',
                issuingOrganization: initialData.issuingOrganization || initialData.issuer || '',
                issueDate: initialData.issueDate || initialData.year || '',
                description: initialData.description || '',
                document: initialData.document || null,
                documentName: getDocumentName(initialData.document, initialData.documentName || initialData.fileName)
            });
            return;
        }
        setFormData({ ...EMPTY_FORM, id: Date.now() });
    }, [initialData]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert(t('profile-file-size-error') || 'File size must be less than 5MB');
            return;
        }
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            alert(t('profile-file-type-error') || 'Only PDF, JPG, JPEG, and PNG files are allowed');
            return;
        }
        setFormData({ ...formData, document: file, documentName: file.name });
    };

    const handleRemoveFile = () => {
        setFormData({ ...formData, document: null, documentName: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isUploading) return;

        let nextData = { ...formData };
        if (isBrowserFile(nextData.document) && typeof onUploadDocument === 'function') {
            setIsUploading(true);
            try {
                const storedDocument = await onUploadDocument(nextData.document);
                if (!storedDocument) {
                    alert(t('profile-upload-fail') || 'Failed to upload document');
                    return;
                }
                nextData = {
                    ...nextData,
                    document: storedDocument,
                    documentName: storedDocument.filename || nextData.documentName
                };
            } catch (error) {
                console.error('Certificate document upload failed:', error);
                alert(t('profile-upload-fail') || 'Failed to upload document');
                return;
            } finally {
                setIsUploading(false);
            }
        }

        await Promise.resolve(onSave({
            ...nextData,
            issuer: nextData.issuingOrganization,
            fileName: nextData.documentName,
            year: nextData.issueDate ? nextData.issueDate.split('-')[0] : ''
        }));
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
                        <label className="v-label required">{t('profile-certificate-organization') || 'Issuing Organization'}</label>
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
                    {!formData.document && !formData.documentName ? (
                        <label className="v-drop-zone">
                            <input
                                type="file"
                                className="v-input-hidden"
                                onChange={handleFileChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                                style={{ display: 'none' }}
                            />
                            <span className="material-symbols-outlined v-drop-zone-icon">verified_user</span>
                            <span className="v-drop-zone-text">{t('profile-upload-cert') || 'Click to upload certificate'}</span>
                            <span className="v-drop-zone-hint">{t('profile-upload-hint') || 'PDF, JPG, PNG (Max 5MB)'}</span>
                        </label>
                    ) : (
                        <div className="v-file-preview">
                            <span className="material-symbols-outlined">badge</span>
                            <div className="v-file-info">
                                <span className="v-file-name">{getDocumentName(formData.document, formData.documentName)}</span>
                            </div>
                            <span className="material-symbols-outlined v-file-remove" onClick={handleRemoveFile}>close</span>
                        </div>
                    )}
                </div>

                <div className="v-btn-actions">
                    <button type="button" onClick={onCancel} className="v-btn v-btn-secondary" disabled={isUploading}>
                        {t('common-cancel') || 'Cancel'}
                    </button>
                    <button type="submit" className="v-btn v-btn-primary" disabled={isUploading}>
                        <span className="material-symbols-outlined">{isUploading ? 'progress_activity' : 'workspace_premium'}</span>
                        {isUploading
                            ? (t('common-saving') || 'Saving...')
                            : initialData?.id
                                ? (t('profile-save-changes') || 'Save Changes')
                                : (t('add-certificate') || 'Add Certificate')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CertificateForm;
