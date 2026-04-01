import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const isBrowserFile = (value) => typeof File !== 'undefined' && value instanceof File;

const getDocumentName = (document, fallback = '') =>
    fallback || document?.filename || document?.name || '';

const EMPTY_FORM = {
    id: null,
    company: '',
    type: '',
    position: '',
    startYear: '',
    startMonth: '',
    endYear: '',
    endMonth: '',
    ongoing: false,
    description: '',
    document: null,
    documentName: ''
};

const ExperienceForm = ({ initialData, onSave, onCancel, onUploadDocument = null }) => {
    const { t } = useLanguage();
    const currentYear = new Date().getFullYear();
    const currentMonthValue = String(new Date().getMonth() + 1).padStart(2, '0');
    const [isUploading, setIsUploading] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });

    useEffect(() => {
        if (initialData) {
            setFormData({
                id: initialData.id || Date.now(),
                company: initialData.company || '',
                type: initialData.type || '',
                position: initialData.position || initialData.role || '',
                startYear: initialData.startYear || '',
                startMonth: initialData.startMonth || '',
                endYear: initialData.endYear || '',
                endMonth: initialData.endMonth || '',
                ongoing: initialData.ongoing || false,
                description: initialData.description || '',
                document: initialData.document || null,
                documentName: getDocumentName(initialData.document, initialData.documentName)
            });
            return;
        }
        setFormData({ ...EMPTY_FORM, id: Date.now() });
    }, [initialData]);

    const buildMonthValue = (year, month) => {
        if (!year || !month) return '';
        return `${year}-${String(month).padStart(2, '0')}`;
    };

    const handleStartDateChange = (e) => {
        const value = e.target.value;
        if (!value) {
            setFormData({ ...formData, startYear: '', startMonth: '' });
            return;
        }
        const [year, month] = value.split('-');
        setFormData({ ...formData, startYear: year, startMonth: month });
    };

    const handleEndDateChange = (e) => {
        if (formData.ongoing) return;
        const value = e.target.value;
        if (!value) {
            setFormData({ ...formData, endYear: '', endMonth: '' });
            return;
        }
        const [year, month] = value.split('-');
        setFormData({ ...formData, endYear: year, endMonth: month });
    };

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
                console.error('Experience document upload failed:', error);
                alert(t('profile-upload-fail') || 'Failed to upload document');
                return;
            } finally {
                setIsUploading(false);
            }
        }

        await Promise.resolve(onSave({ ...nextData, role: nextData.position }));
    };

    return (
        <div className="profile-form-container">
            <div className="v-form-header">
                <h3 className="v-form-title">{t('profile-edit-experience-title') || 'Work Experience'}</h3>
                <p className="v-form-subtitle">{t('profile-edit-experience-desc') || 'Describe your role and impact for each position.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="v-form-grid">
                <div className="v-form-row">
                    <div className="v-form-group">
                        <label className="v-label required">{t('account-setup-step-5-company') || 'Company'}</label>
                        <div className="v-input-wrapper">
                            <input
                                type="text"
                                required
                                value={formData.company}
                                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                className="v-input"
                                placeholder="e.g., Apple Inc."
                            />
                        </div>
                    </div>
                    <div className="v-form-group">
                        <label className="v-label">{t('account-setup-step-5-type') || 'Type'}</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="v-select"
                        >
                            <option value="">{t('exp-type-select') || 'Select type'}</option>
                            <option value="work">{t('exp-type-fulltime') || 'Full-time'}</option>
                            <option value="internship">{t('exp-type-internship') || 'Internship'}</option>
                            <option value="contract">{t('exp-type-contract') || 'Contract'}</option>
                            <option value="freelance">{t('exp-type-freelance') || 'Freelance'}</option>
                        </select>
                    </div>
                </div>

                <div className="v-form-group">
                    <label className="v-label required">{t('account-setup-step-5-job-title') || 'Job Title'}</label>
                    <div className="v-input-wrapper">
                        <input
                            type="text"
                            required
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            className="v-input"
                            placeholder="e.g., Senior Product Designer"
                        />
                    </div>
                </div>

                <div className="v-form-row">
                    <div className="v-form-group">
                        <label className="v-label">{t('account-setup-step-5-start-date') || 'Start Date'}</label>
                        <input
                            type="month"
                            value={buildMonthValue(formData.startYear, formData.startMonth)}
                            onChange={handleStartDateChange}
                            max={`${currentYear}-${currentMonthValue}`}
                            className="v-input"
                        />
                    </div>
                    <div className="v-form-group">
                        <label className="v-label">{t('account-setup-step-5-end-date') || 'End Date'}</label>
                        <input
                            type="month"
                            value={buildMonthValue(formData.endYear, formData.endMonth)}
                            onChange={handleEndDateChange}
                            disabled={formData.ongoing}
                            max={`${currentYear}-${currentMonthValue}`}
                            className="v-input"
                        />
                    </div>
                </div>

                <div className="v-checkbox-group" onClick={() => setFormData({ ...formData, ongoing: !formData.ongoing, endYear: !formData.ongoing ? '' : formData.endYear, endMonth: !formData.ongoing ? '' : formData.endMonth })}>
                    <input
                        type="checkbox"
                        checked={formData.ongoing}
                        onChange={() => { }}
                        className="v-checkbox"
                        id="ongoing-experience"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <span className="v-checkbox-label">
                        {t('account-setup-step-5-currently-working') || 'I currently work here'}
                    </span>
                </div>

                <div className="v-form-group">
                    <label className="v-label">{t('account-setup-step-5-description') || 'Key Achievements'}</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="v-textarea"
                        rows="4"
                        placeholder="What were your main responsibilities and what impact did you have?"
                    />
                </div>

                <div className="v-form-group">
                    <label className="v-label">{t('account-setup-step-5-attachment') || 'Attachment'} (Certification/Contract)</label>
                    {!formData.document && !formData.documentName ? (
                        <label className="v-drop-zone">
                            <input
                                type="file"
                                className="v-input-hidden"
                                onChange={handleFileChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                                style={{ display: 'none' }}
                            />
                            <span className="material-symbols-outlined v-drop-zone-icon">cloud_upload</span>
                            <span className="v-drop-zone-text">{t('profile-upload-docs') || 'Upload relevant documents'}</span>
                            <span className="v-drop-zone-hint">{t('profile-upload-hint') || 'PDF, JPG, PNG (Max 5MB)'}</span>
                        </label>
                    ) : (
                        <div className="v-file-preview">
                            <span className="material-symbols-outlined">description</span>
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
                        {isUploading
                            ? (t('common-saving') || 'Saving...')
                            : initialData?.id
                                ? (t('profile-save-changes') || 'Save Changes')
                                : (t('add-experience') || 'Add Experience')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ExperienceForm;
