import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const ExperienceForm = ({ initialData, onSave, onCancel }) => {
    const { t, language } = useLanguage();
    const currentYear = new Date().getFullYear();
    const currentMonthValue = String(new Date().getMonth() + 1).padStart(2, '0');

    const [formData, setFormData] = useState({
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
    });

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
                documentName: initialData.documentName || ''
            });
        } else {
            setFormData({
                id: Date.now(),
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
            });
        }
    }, [initialData]);

    const buildMonthValue = (year, month) => {
        if (!year || !month) return '';
        return `${year}-${String(month).padStart(2, '0')}`;
    };

    const parseMonthInput = (value) => {
        if (!value) return { year: '', month: '' };
        const [yearPart, monthPart] = value.split('-');
        return { year: yearPart || '', month: monthPart || '' };
    };

    const handleStartDateChange = (value) => {
        const { year, month } = parseMonthInput(value);
        if (!year || !month) {
            setFormData({ ...formData, startYear: '', startMonth: '', ongoing: false });
            return;
        }
        const startDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        const todayMonth = new Date(currentYear, new Date().getMonth(), 1);
        if (startDate > todayMonth) return; // Block future start

        setFormData({ ...formData, startYear: year, startMonth: month });
    };

    const handleEndDateChange = (value) => {
        if (formData.ongoing) return;
        if (!formData.startYear || !formData.startMonth) return;

        const { year, month } = parseMonthInput(value);
        if (!year || !month) {
            setFormData({ ...formData, endYear: '', endMonth: '', ongoing: false });
            return;
        }
        const selectedDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        const todayMonth = new Date(currentYear, new Date().getMonth(), 1);
        if (selectedDate > todayMonth) return; // Block future end

        // Don't allow end < start
        const startDate = new Date(parseInt(formData.startYear, 10), parseInt(formData.startMonth, 10) - 1, 1);
        if (selectedDate < startDate) return;

        setFormData({ ...formData, endYear: year, endMonth: month, ongoing: false });
    };

    const handleOngoingChange = (checked) => {
        setFormData({
            ...formData,
            ongoing: checked,
            endYear: checked ? '' : formData.endYear,
            endMonth: checked ? '' : formData.endMonth
        });
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
            setFormData({ ...formData, document: file, documentName: file.name });
        }
    };

    const handleRemoveFile = () => {
        setFormData({ ...formData, document: null, documentName: '' });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Keep 'role' for backward compat
        onSave({ ...formData, role: formData.position });
    };

    return (
        <form onSubmit={handleSubmit} className="profile-form">
            {/* Company + Type */}
            <div className="form-row">
                <div className="form-group">
                    <label>{t('account-setup-step-5-company') || 'Company'} *</label>
                    <input
                        type="text"
                        required
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="form-input"
                        placeholder="e.g., TechFlow Inc."
                    />
                </div>
                <div className="form-group">
                    <label>{t('account-setup-step-5-type') || 'Type'}</label>
                    <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="form-input"
                    >
                        <option value="">{t('account-setup-step-5-type-placeholder') || 'Select type'}</option>
                        <option value="work">{t('account-setup-step-5-type-work') || 'Full-time'}</option>
                        <option value="internship">{t('account-setup-step-5-type-internship') || 'Internship'}</option>
                        <option value="contract">{t('account-setup-step-5-type-contract') || 'Contract'}</option>
                        <option value="freelance">{t('account-setup-step-5-type-freelance') || 'Freelance'}</option>
                    </select>
                </div>
            </div>

            {/* Position / Job Title */}
            <div className="form-group">
                <label>{t('account-setup-step-5-job-title') || 'Job Title'} *</label>
                <input
                    type="text"
                    required
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="form-input"
                    placeholder="e.g., Senior Product Designer"
                />
            </div>

            {/* Start / End Date (Month Picker) */}
            <div className="form-row">
                <div className="form-group">
                    <label>{t('account-setup-step-5-start-date') || 'Start Date'}</label>
                    <input
                        type="month"
                        value={buildMonthValue(formData.startYear, formData.startMonth)}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        max={`${currentYear}-${currentMonthValue}`}
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>{t('account-setup-step-5-end-date') || 'End Date'}</label>
                    <input
                        type="month"
                        value={buildMonthValue(formData.endYear, formData.endMonth)}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                        disabled={formData.ongoing || !formData.startYear || !formData.startMonth}
                        max={`${currentYear}-${currentMonthValue}`}
                        className="form-input"
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
                    />
                    <span>{t('account-setup-step-5-currently-working') || 'I currently work here'}</span>
                </label>
            </div>

            {/* Description */}
            <div className="form-group">
                <label>{t('account-setup-step-5-description') || 'Description'}</label>
                <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="form-textarea"
                    rows="4"
                    placeholder="Describe your responsibilities and achievements..."
                />
            </div>

            {/* Document Upload */}
            <div className="form-group">
                <label>{t('account-setup-step-5-attachment') || 'Attachment'} (Optional)</label>
                {!formData.documentName ? (
                    <label className="file-upload-mock">
                        <input
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                        />
                        <span className="material-symbols-outlined">cloud_upload</span>
                        <p>Upload work certificate or contract</p>
                    </label>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-lg)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>description</span>
                        <span style={{ flex: 1, fontSize: '0.9rem' }}>{formData.documentName}</span>
                        <button type="button" onClick={handleRemoveFile} className="btn-ghost" style={{ padding: '0.25rem', color: 'var(--secondary-color)' }}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">
                    {initialData?.id ? 'Save Changes' : 'Add Experience'}
                </button>
            </div>
        </form>
    );
};

export default ExperienceForm;
