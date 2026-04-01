import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const isBrowserFile = (value) => typeof File !== 'undefined' && value instanceof File;

const getDocumentName = (document, fallback = '') =>
    fallback || document?.filename || document?.name || '';

const EMPTY_FORM = {
    id: null,
    institution: '',
    degree: '',
    startYear: '',
    endYear: '',
    ongoing: false,
    socialLink: '',
    certificate: null,
    certificateName: ''
};

const EducationForm = ({ initialData, onSave, onCancel, onUploadDocument = null }) => {
    const { t } = useLanguage();
    const [isUploading, setIsUploading] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });

    useEffect(() => {
        if (initialData) {
            setFormData({
                id: initialData.id || Date.now(),
                institution: initialData.institution || '',
                degree: initialData.degree || '',
                startYear: initialData.startYear || '',
                endYear: initialData.endYear || '',
                ongoing: initialData.ongoing || false,
                socialLink: initialData.socialLink || '',
                certificate: initialData.certificate || null,
                certificateName: getDocumentName(initialData.certificate, initialData.certificateName)
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
        setFormData((prev) => ({
            ...prev,
            certificate: file,
            certificateName: file.name
        }));
    };

    const handleRemoveFile = () => {
        setFormData((prev) => ({
            ...prev,
            certificate: null,
            certificateName: ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isUploading) return;

        let nextData = { ...formData };
        if (isBrowserFile(nextData.certificate) && typeof onUploadDocument === 'function') {
            setIsUploading(true);
            try {
                const storedDocument = await onUploadDocument(nextData.certificate);
                if (!storedDocument) {
                    alert(t('profile-upload-fail') || 'Failed to upload document');
                    return;
                }
                nextData = {
                    ...nextData,
                    certificate: storedDocument,
                    certificateName: storedDocument.filename || nextData.certificateName
                };
            } catch (error) {
                console.error('Education document upload failed:', error);
                alert(t('profile-upload-fail') || 'Failed to upload document');
                return;
            } finally {
                setIsUploading(false);
            }
        }

        await Promise.resolve(onSave(nextData));
    };

    return (
        <div className="profile-form-container">
            <div className="v-form-header">
                <h3 className="v-form-title">{t('profile-edit-education-title') || 'Education'}</h3>
                <p className="v-form-subtitle">{t('profile-edit-education-desc') || 'Add details about your academic background.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="v-form-grid">
                <div className="v-form-group">
                    <label className="v-label required">{t('account-setup-step-4-school') || 'Institution'}</label>
                    <div className="v-input-wrapper">
                        <input
                            type="text"
                            required
                            value={formData.institution}
                            onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                            className="v-input"
                            placeholder="e.g., Stanford University"
                        />
                    </div>
                </div>

                <div className="v-form-group">
                    <label className="v-label required">{t('account-setup-step-4-degree') || 'Degree'}</label>
                    <div className="v-input-wrapper">
                        <input
                            type="text"
                            required
                            value={formData.degree}
                            onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                            className="v-input"
                            placeholder="e.g., Master of Science in HCI"
                        />
                    </div>
                </div>

                <div className="v-form-row">
                    <div className="v-form-group">
                        <label className="v-label">{t('account-setup-step-4-start-year') || 'Start Year'}</label>
                        <input
                            type="number"
                            value={formData.startYear}
                            onChange={(e) => setFormData({ ...formData, startYear: e.target.value })}
                            className="v-input"
                            placeholder="YYYY"
                        />
                    </div>
                    <div className="v-form-group">
                        <label className="v-label">{t('account-setup-step-4-end-year') || 'End Year'}</label>
                        <input
                            type="number"
                            value={formData.endYear}
                            onChange={(e) => setFormData({ ...formData, endYear: e.target.value })}
                            disabled={formData.ongoing}
                            className="v-input"
                            placeholder="YYYY"
                        />
                    </div>
                </div>

                <div className="v-checkbox-group" onClick={() => setFormData({ ...formData, ongoing: !formData.ongoing, endYear: !formData.ongoing ? '' : formData.endYear })}>
                    <input
                        type="checkbox"
                        checked={formData.ongoing}
                        onChange={() => { }}
                        className="v-checkbox"
                        id="ongoing-education"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <span className="v-checkbox-label">
                        {t('account-setup-step-4-currently-studying') || 'I am currently studying here'}
                    </span>
                </div>

                <div className="v-form-group">
                    <label className="v-label">{t('account-setup-step-4-certificate-diploma') || 'Certificate/Diploma'}</label>
                    {!formData.certificate && !formData.certificateName ? (
                        <label className="v-drop-zone">
                            <input
                                type="file"
                                className="v-input-hidden"
                                onChange={handleFileChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                                style={{ display: 'none' }}
                            />
                            <span className="material-symbols-outlined v-drop-zone-icon">upload_file</span>
                            <span className="v-drop-zone-text">{t('profile-upload-click') || 'Click to upload or drag & drop'}</span>
                            <span className="v-drop-zone-hint">{t('profile-upload-hint') || 'PDF, JPG, PNG (Max 5MB)'}</span>
                        </label>
                    ) : (
                        <div className="v-file-preview">
                            <span className="material-symbols-outlined">description</span>
                            <div className="v-file-info">
                                <span className="v-file-name">{getDocumentName(formData.certificate, formData.certificateName) || (t('profile-uploaded-doc') || 'Uploaded Document')}</span>
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
                        {isUploading
                            ? (t('common-saving') || 'Saving...')
                            : initialData?.id
                                ? (t('profile-save-changes') || 'Save Changes')
                                : (t('add-education') || 'Add Education')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EducationForm;
