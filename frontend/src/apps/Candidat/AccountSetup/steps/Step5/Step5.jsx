import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step5.css';

const EMPTY_EXPERIENCE = {
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

const Step5 = ({ formData = {}, onUpdate = () => { }, compactFormOnly = false }) => {
  const { t, language } = useLanguage();
  const experiences = formData.experiences || [];
  const [editingId, setEditingId] = useState(null);
  const [currentExperience, setCurrentExperience] = useState(() => ({ ...EMPTY_EXPERIENCE }));

  const currentYear = new Date().getFullYear();
  const currentMonthValue = String(new Date().getMonth() + 1).padStart(2, '0');

  const buildMonthValue = (year, month) => {
    if (!year || !month) return '';
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  const parseDateParts = (year, month, fallbackMonth) => ({
    year: year ? parseInt(year, 10) : null,
    month: month ? parseInt(month, 10) : fallbackMonth
  });

  const parseMonthInput = (value) => {
    if (!value) return { year: '', month: '' };
    const [yearPart, monthPart] = value.split('-');
    return {
      year: yearPart || '',
      month: monthPart || ''
    };
  };

  const isStartAfterEnd = (start, end) => {
    if (!start.year || !end.year) return false;
    if (start.year > end.year) return true;
    if (start.year === end.year) {
      return (start.month || 1) > (end.month || 12);
    }
    return false;
  };

  const formatMonthLabel = (value) => {
    if (!value) return '';
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
    const monthIdx = parseInt(value, 10);
    if (!monthIdx || monthIdx < 1 || monthIdx > 12) return value;
    return new Date(2000, monthIdx - 1).toLocaleString(locale, { month: 'short' });
  };

  const handleStartDateChange = (value) => {
    setCurrentExperience((prev) => {
      const { year, month } = parseMonthInput(value);
      if (!year || !month) {
        return { ...prev, startYear: '', startMonth: '', ongoing: false };
      }

      const startDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const todayMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      if (startDate > todayMonth) {
        return prev; // Block start dates in the future
      }

      const updated = { ...prev, startYear: year, startMonth: month };
      const start = parseDateParts(updated.startYear, updated.startMonth, 1);
      const end = parseDateParts(updated.endYear, updated.endMonth, 12);
      if (isStartAfterEnd(start, end)) {
        updated.endYear = '';
        updated.endMonth = '';
        updated.ongoing = false;
      }
      return updated;
    });
  };

  const handleEndDateChange = (value) => {
    setCurrentExperience((prev) => {
      if (prev.ongoing) return prev;

      if (!prev.startYear || !prev.startMonth) return prev; // Require start before end

      const { year, month } = parseMonthInput(value);
      if (!year || !month) {
        return { ...prev, endYear: '', endMonth: '', ongoing: false };
      }

      const selectedDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const todayMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      if (selectedDate > todayMonth) {
        return prev; // Block future end dates
      }

      const start = parseDateParts(prev.startYear, prev.startMonth, 1);
      const tentative = { ...prev, endYear: year, endMonth: month, ongoing: false };
      const end = parseDateParts(tentative.endYear, tentative.endMonth, 12);

      if (isStartAfterEnd(start, end)) {
        return prev;
      }

      return tentative;
    });
  };

  const handleOngoingChange = (checked) => {
    setCurrentExperience((prev) => ({
      ...prev,
      ongoing: checked,
      endYear: checked ? '' : prev.endYear,
      endMonth: checked ? '' : prev.endMonth
    }));
  };

  const handleAddExperience = () => {
    if ((currentExperience.company || '').trim() && (currentExperience.position || '').trim() && currentExperience.startYear && currentExperience.startMonth) {
      let newExperiences;
      if (editingId) {
        // Update existing experience
        newExperiences = experiences.map(exp =>
          exp.id === editingId ? { ...currentExperience, id: editingId } : exp
        );
        setEditingId(null);
      } else {
        // Add new experience
        newExperiences = [...experiences, { ...currentExperience, id: Date.now() }];
      }
      onUpdate({ experiences: newExperiences });
      setCurrentExperience({ ...EMPTY_EXPERIENCE });
    }
  };

  const handleEditExperience = (experience) => {
    setCurrentExperience({
      ...EMPTY_EXPERIENCE,
      ...experience,
      startMonth: experience.startMonth || '',
      endMonth: experience.endMonth || '',
      type: experience.type || ''
    });
    setEditingId(experience.id);
  };

  const handleCancelEdit = () => {
    setCurrentExperience({ ...EMPTY_EXPERIENCE });
    setEditingId(null);
  };

  const handleRemoveExperience = (id) => {
    const newExperiences = experiences.filter(exp => exp.id !== id);
    onUpdate({ experiences: newExperiences });
    if (editingId === id) {
      handleCancelEdit();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      // Check file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        alert('Only PDF, JPG, JPEG, and PNG files are allowed');
        return;
      }
      setCurrentExperience({
        ...currentExperience,
        document: file,
        documentName: file.name
      });
    }
  };

  const handleRemoveFile = () => {
    setCurrentExperience({
      ...currentExperience,
      document: null,
      documentName: ''
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddExperience();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.querySelector('.experience-input-section')?.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.querySelector('.experience-input-section')?.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.querySelector('.experience-input-section')?.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      // Check file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        alert('Only PDF, JPG, JPEG, and PNG files are allowed');
        return;
      }
      setCurrentExperience({
        ...currentExperience,
        document: file,
        documentName: file.name
      });
    }
  };

  const formatDate = (year, month) => {
    if (!year) return '';
    const monthLabel = month ? `${formatMonthLabel(month)} ` : '';
    return `${monthLabel}${year}`.trim();
  };

  const formatDateRange = (exp) => {
    const start = formatDate(exp.startYear, exp.startMonth);
    const end = exp.ongoing ? t('account-setup-step-5-present') : formatDate(exp.endYear, exp.endMonth);
    if (start && end) return `${start} - ${end}`;
    return start || end || '—';
  };

  return (
    <div className={`setup-step-form step5-wrapper ${compactFormOnly ? 'form-only' : ''}`}>
      <div className="setup-step-form-header">
        <i className="setup-step-icon fas fa-briefcase"></i>
      </div>

      <div className="setup-step-form-content">
        {/* Input Section */}
        <div
          className="experience-input-section"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="experience-form-grid">
            {/* Company + Type */}
            <div className="experience-form-group full-width">
              <div className="experience-company-type-row">
                <div className="experience-form-group nested-group">
                  <label className="experience-form-label">{t('account-setup-step-5-company')} *</label>
                  <input
                    type="text"
                    value={currentExperience.company}
                    onChange={(e) => setCurrentExperience({ ...currentExperience, company: e.target.value })}
                    onKeyPress={handleKeyPress}
                    placeholder={t('account-setup-step-5-company')}
                    className="experience-form-input"
                  />
                </div>
                <div className="experience-form-group nested-group">
                  <label className="experience-form-label">{t('account-setup-step-5-type')}</label>
                  <select
                    value={currentExperience.type}
                    onChange={(e) => setCurrentExperience({ ...currentExperience, type: e.target.value })}
                    className="experience-form-input"
                  >
                    <option value="">{t('account-setup-step-5-type-placeholder')}</option>
                    <option value="work">{t('account-setup-step-5-type-work')}</option>
                    <option value="internship">{t('account-setup-step-5-type-internship')}</option>
                    <option value="contract">{t('account-setup-step-5-type-contract')}</option>
                    <option value="freelance">{t('account-setup-step-5-type-freelance')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="experience-form-group full-width">
              <label className="experience-form-label">{t('account-setup-step-5-job-title')} *</label>
              <input
                type="text"
                value={currentExperience.position}
                onChange={(e) => setCurrentExperience({ ...currentExperience, position: e.target.value })}
                placeholder="e.g., Senior Developer"
                className="experience-form-input"
                onKeyPress={handleKeyPress}
              />
            </div>

            {/* Start Date */}
            <div className="experience-form-group">
              <label className="experience-form-label">{t('account-setup-step-5-start-date')} *</label>
              <input
                type="month"
                value={buildMonthValue(currentExperience.startYear, currentExperience.startMonth)}
                onChange={(e) => handleStartDateChange(e.target.value)}
                max={`${currentYear}-${currentMonthValue}`}
                className="experience-form-input"
              />
            </div>

            {/* End Date */}
            <div className="experience-form-group">
              <label className="experience-form-label">{t('account-setup-step-5-end-date')}</label>
              <input
                type="month"
                value={buildMonthValue(currentExperience.endYear, currentExperience.endMonth)}
                onChange={(e) => handleEndDateChange(e.target.value)}
                disabled={currentExperience.ongoing || !currentExperience.startYear || !currentExperience.startMonth}
                max={`${currentYear}-${currentMonthValue}`}
                className="experience-form-input"
              />
            </div>

            {/* Ongoing Checkbox */}
            <div className="experience-form-group full-width">
              <label className="experience-checkbox-label">
                <input
                  type="checkbox"
                  checked={currentExperience.ongoing}
                  onChange={(e) => handleOngoingChange(e.target.checked)}
                  className="experience-checkbox"
                />
                <span>{t('account-setup-step-5-currently-working')}</span>
              </label>
            </div>

            {/* Description */}
            <div className="experience-form-group full-width">
              <label className="experience-form-label">{t('account-setup-step-5-description')}</label>
              <textarea
                value={currentExperience.description}
                onChange={(e) => setCurrentExperience({ ...currentExperience, description: e.target.value })}
                placeholder={t('account-setup-step-5-description')}
                className="experience-form-textarea"
                rows="3"
              />
            </div>

            {/* Document Upload */}
            <div className="experience-form-group full-width">
              <label className="experience-form-label">{t('account-setup-step-5-attachment')}</label>
              <button
                type="button"
                onClick={() => document.querySelector('.experience-file-input').click()}
                className="experience-upload-button"
                title={t('account-setup-step-5-attachment')}
              >
                <i className="fas fa-cloud-upload-alt"></i>
                <span>{t('account-setup-step-5-attachment')}</span>
              </button>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
                className="experience-file-input"
                style={{ display: 'none' }}
              />
              {currentExperience.documentName && (
                <div className="experience-file-display">
                  <span>{currentExperience.documentName}</span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="experience-remove-file"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile-only Action Buttons */}
            <div className="experience-form-actions-mobile">
              <button type="button" onClick={handleAddExperience} className="experience-button experience-button-primary">
                <i className="fas fa-plus"></i>
                <span>{editingId ? t('common-edit') : t('account-setup-step-5-add')}</span>
              </button>
              {editingId && (
                <button type="button" onClick={handleCancelEdit} className="experience-button experience-button-secondary">
                  {t('common-cancel')}
                </button>
              )}
            </div>

            {compactFormOnly && (
              <div className="experience-form-actions">
                <button type="button" onClick={handleAddExperience} className="experience-button experience-button-primary">
                  <i className="fas fa-plus"></i>
                  <span>{editingId ? t('common-edit') : t('account-setup-step-5-add')}</span>
                </button>
                {editingId && (
                  <button type="button" onClick={handleCancelEdit} className="experience-button experience-button-secondary">
                    {t('common-cancel')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {!compactFormOnly && (
          <div className="experience-list-section">
            {experiences.length === 0 ? (
              <div className="experience-empty">
                <i className="fas fa-briefcase"></i>
                <p>{t('account-setup-step-5-no-experience')}</p>
              </div>
            ) : (
              <div className="experience-list">
                {experiences.map((exp) => (
                  <div key={exp.id} className={`experience-item ${editingId === exp.id ? 'editing' : ''}`}>
                    <div className="experience-item-header">
                      <div className="experience-item-title">
                        <div className="experience-company-row">
                          <div className="experience-company">{exp.company}</div>
                          {exp.type && (
                            <span className="experience-type-badge">{t(`account-setup-step-5-type-${exp.type}`) || exp.type}</span>
                          )}
                        </div>
                        <div className="experience-position">{exp.position}</div>
                      </div>
                      <div className="experience-item-actions">
                        <button type="button" onClick={() => handleEditExperience(exp)} className="experience-edit" title={t('common-edit')}>
                          <i className="fas fa-edit"></i>
                        </button>
                        <button type="button" onClick={() => handleRemoveExperience(exp.id)} className="experience-delete" title={t('common-delete')}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                    <div className="experience-item-meta">
                      <span>{formatDateRange(exp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="experience-form-actions">
              <button type="button" onClick={handleAddExperience} className="experience-button experience-button-primary">
                <i className="fas fa-plus"></i>
                <span>{editingId ? t('edit') : t('account-setup-step-5-add')}</span>
              </button>
              {editingId && (
                <button type="button" onClick={handleCancelEdit} className="experience-button experience-button-secondary">
                  {t('cancel')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Step5;
