import React, { useRef, useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import SetupModal from '../../components/SetupModal';
import './Step5.css';
import '../Step7/Step7.css';

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
  documentName: '',
};

const isBrowserFile = (value) => typeof File !== 'undefined' && value instanceof File;

const getDocumentName = (document, documentName) =>
  documentName || document?.filename || document?.name || '';

const Step5 = ({ formData = {}, onUpdate = () => {}, compactFormOnly = false, onUploadDocument = null }) => {
  const { t, language } = useLanguage();
  const experiences = formData.experiences || [];
  const preferences = formData.jobPreferences || {};
  const [editingId, setEditingId] = useState(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentExperience, setCurrentExperience] = useState({ ...EMPTY_EXPERIENCE });
  const fileInputRef = useRef(null);

  const uiCopy = language === 'fr'
    ? {
        overviewDescription: 'Gardez vos experiences visibles et ouvrez un formulaire seulement lorsque vous ajoutez une nouvelle mission.',
        modalDescription: 'Ajoutez votre entreprise, votre role, vos dates et un justificatif si vous en avez un.',
        emptyHint: 'Ajoutez vos experiences pour aider les recruteurs a comprendre votre parcours professionnel.',
      }
    : {
        overviewDescription: 'Keep your experience visible here and open a form only when you need to add a new role.',
        modalDescription: 'Add your company, role, dates, and an optional supporting document.',
        emptyHint: 'Add your experience so recruiters can quickly understand your professional journey.',
      };

  const preferencesCopy = language === 'fr'
    ? {
        title: 'Preferences de travail',
        jobTypesLabel: 'Type de poste',
        locationLabel: 'Flexibilite du lieu',
        salaryLabel: 'Attentes salariales',
        availabilityLabel: 'Disponibilite',
      }
    : {
        title: 'Work Preferences',
        jobTypesLabel: 'Job Type',
        locationLabel: 'Work Location',
        salaryLabel: 'Salary Expectation',
        availabilityLabel: 'Availability',
      };

  const jobType = Array.isArray(preferences.jobTypes) ? (preferences.jobTypes[0] || '') : (preferences.jobTypes || '');
  const workLoc = Array.isArray(preferences.workLocation) ? (preferences.workLocation[0] || '') : (preferences.workLocation || '');
  const salary = preferences.salaryExpectation || '';
  const avail = preferences.availability || '';

  const handlePreferencesChange = (field, value) => {
    const newPreferences = { ...preferences, [field]: value };
    onUpdate({ jobPreferences: newPreferences });
  };

  const currentYear = new Date().getFullYear();
  const currentMonthValue = String(new Date().getMonth() + 1).padStart(2, '0');

  const buildMonthValue = (year, month) => {
    if (!year || !month) return '';
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  const parseDateParts = (year, month, fallbackMonth) => ({
    year: year ? parseInt(year, 10) : null,
    month: month ? parseInt(month, 10) : fallbackMonth,
  });

  const parseMonthInput = (value) => {
    if (!value) return { year: '', month: '' };
    const [yearPart, monthPart] = value.split('-');
    return {
      year: yearPart || '',
      month: monthPart || '',
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
    const monthIndex = parseInt(value, 10);
    if (!monthIndex || monthIndex < 1 || monthIndex > 12) return value;
    return new Date(2000, monthIndex - 1).toLocaleString(locale, { month: 'short' });
  };

  const formatDate = (year, month) => {
    if (!year) return '';
    const monthLabel = month ? `${formatMonthLabel(month)} ` : '';
    return `${monthLabel}${year}`.trim();
  };

  const formatDateRange = (experience) => {
    const start = formatDate(experience.startYear, experience.startMonth);
    const end = experience.ongoing ? t('account-setup-step-5-present') : formatDate(experience.endYear, experience.endMonth);
    if (start && end) return `${start} - ${end}`;
    return start || end || '-';
  };

  const resetExperienceForm = () => {
    setCurrentExperience({ ...EMPTY_EXPERIENCE });
    setEditingId(null);
    setIsDragOver(false);
  };

  const openCreateModal = () => {
    resetExperienceForm();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isUploadingDocument) {
      return;
    }
    resetExperienceForm();
    setIsModalOpen(false);
  };

  const handleStartDateChange = (value) => {
    setCurrentExperience((previous) => {
      const { year, month } = parseMonthInput(value);
      if (!year || !month) {
        return { ...previous, startYear: '', startMonth: '', ongoing: false };
      }

      const startDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const todayMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      if (startDate > todayMonth) {
        return previous;
      }

      const updated = { ...previous, startYear: year, startMonth: month };
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
    setCurrentExperience((previous) => {
      if (previous.ongoing) return previous;
      if (!previous.startYear || !previous.startMonth) return previous;

      const { year, month } = parseMonthInput(value);
      if (!year || !month) {
        return { ...previous, endYear: '', endMonth: '', ongoing: false };
      }

      const selectedDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const todayMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      if (selectedDate > todayMonth) {
        return previous;
      }

      const start = parseDateParts(previous.startYear, previous.startMonth, 1);
      const tentative = { ...previous, endYear: year, endMonth: month, ongoing: false };
      const end = parseDateParts(tentative.endYear, tentative.endMonth, 12);

      if (isStartAfterEnd(start, end)) {
        return previous;
      }

      return tentative;
    });
  };

  const handleOngoingChange = (checked) => {
    setCurrentExperience((previous) => ({
      ...previous,
      ongoing: checked,
      endYear: checked ? '' : previous.endYear,
      endMonth: checked ? '' : previous.endMonth,
    }));
  };

  const applySelectedFile = (file) => {
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only PDF, JPG, JPEG, and PNG files are allowed');
      return;
    }

    setCurrentExperience((previous) => ({
      ...previous,
      document: file,
      documentName: file.name,
    }));
  };

  const handleSaveExperience = async () => {
    if (
      !(currentExperience.company || '').trim()
      || !(currentExperience.position || '').trim()
      || !currentExperience.startYear
      || !currentExperience.startMonth
      || isUploadingDocument
    ) {
      return;
    }

    let experienceToSave = {
      ...currentExperience,
      company: currentExperience.company.trim(),
      position: currentExperience.position.trim(),
    };

    if (isBrowserFile(experienceToSave.document) && typeof onUploadDocument === 'function') {
      setIsUploadingDocument(true);
      try {
        const storedDocument = await onUploadDocument(experienceToSave.document);
        if (!storedDocument) {
          alert('Failed to upload the experience document.');
          return;
        }

        experienceToSave = {
          ...experienceToSave,
          document: storedDocument,
          documentName: storedDocument.filename || experienceToSave.documentName,
        };
      } catch (error) {
        console.error('Experience document upload failed:', error);
        alert('Failed to upload the experience document.');
        return;
      } finally {
        setIsUploadingDocument(false);
      }
    }

    const updatedExperiences = editingId
      ? experiences.map((experience) => (
          experience.id === editingId ? { ...experienceToSave, id: editingId } : experience
        ))
      : [...experiences, { ...experienceToSave, id: Date.now() }];

    onUpdate({ experiences: updatedExperiences });

    if (compactFormOnly) {
      resetExperienceForm();
      return;
    }

    closeModal();
  };

  const handleEditExperience = (experience) => {
    setCurrentExperience({
      ...EMPTY_EXPERIENCE,
      ...experience,
      startMonth: experience.startMonth || '',
      endMonth: experience.endMonth || '',
      documentName: getDocumentName(experience.document, experience.documentName),
      type: experience.type || '',
    });
    setEditingId(experience.id);

    if (!compactFormOnly) {
      setIsModalOpen(true);
    }
  };

  const handleRemoveExperience = (id) => {
    onUpdate({ experiences: experiences.filter((experience) => experience.id !== id) });

    if (editingId === id) {
      if (compactFormOnly) {
        resetExperienceForm();
      } else {
        closeModal();
      }
    }
  };

  const handleFileChange = (event) => {
    applySelectedFile(event.target.files?.[0]);
  };

  const handleRemoveFile = () => {
    setCurrentExperience((previous) => ({
      ...previous,
      document: null,
      documentName: '',
    }));
  };

  const handleSubmitShortcut = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveExperience();
    }
  };

  const renderExperienceForm = () => (
    <div
      className={`experience-input-section ${compactFormOnly ? '' : 'experience-modal-panel'} ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        applySelectedFile(event.dataTransfer.files?.[0]);
      }}
    >
      <div className="experience-form-grid">
        <div className="experience-form-group full-width">
          <div className="experience-company-type-row">
            <div className="experience-form-group nested-group">
              <label className="experience-form-label">{t('account-setup-step-5-company')} *</label>
              <input
                type="text"
                value={currentExperience.company}
                onChange={(event) => setCurrentExperience((previous) => ({ ...previous, company: event.target.value }))}
                onKeyDown={handleSubmitShortcut}
                placeholder={t('account-setup-step-5-company')}
                className="experience-form-input"
              />
            </div>

            <div className="experience-form-group nested-group">
              <label className="experience-form-label">{t('account-setup-step-5-type')}</label>
              <select
                value={currentExperience.type}
                onChange={(event) => setCurrentExperience((previous) => ({ ...previous, type: event.target.value }))}
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
            onChange={(event) => setCurrentExperience((previous) => ({ ...previous, position: event.target.value }))}
            placeholder="e.g., Product Designer"
            className="experience-form-input"
            onKeyDown={handleSubmitShortcut}
          />
        </div>

        <div className="experience-form-group">
          <label className="experience-form-label">{t('account-setup-step-5-start-date')} *</label>
          <input
            type="month"
            value={buildMonthValue(currentExperience.startYear, currentExperience.startMonth)}
            onChange={(event) => handleStartDateChange(event.target.value)}
            max={`${currentYear}-${currentMonthValue}`}
            className="experience-form-input"
          />
        </div>

        <div className="experience-form-group">
          <label className="experience-form-label">{t('account-setup-step-5-end-date')}</label>
          <input
            type="month"
            value={buildMonthValue(currentExperience.endYear, currentExperience.endMonth)}
            onChange={(event) => handleEndDateChange(event.target.value)}
            disabled={currentExperience.ongoing || !currentExperience.startYear || !currentExperience.startMonth}
            max={`${currentYear}-${currentMonthValue}`}
            className="experience-form-input"
          />
        </div>

        <div className="experience-form-group full-width">
          <label className="experience-checkbox-label">
            <input
              type="checkbox"
              checked={currentExperience.ongoing}
              onChange={(event) => handleOngoingChange(event.target.checked)}
              className="experience-checkbox"
            />
            <span>{t('account-setup-step-5-currently-working')}</span>
          </label>
        </div>

        <div className="experience-form-group full-width">
          <label className="experience-form-label">{t('account-setup-step-5-description')}</label>
          <textarea
            value={currentExperience.description}
            onChange={(event) => setCurrentExperience((previous) => ({ ...previous, description: event.target.value }))}
            placeholder={t('account-setup-step-5-description')}
            className="experience-form-textarea"
            rows="4"
          />
        </div>

        <div className="experience-form-group full-width">
          <label className="experience-form-label">{t('account-setup-step-5-attachment')}</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="experience-upload-button"
            title={t('account-setup-step-5-attachment')}
          >
            <i className="fas fa-cloud-upload-alt"></i>
            <span>{t('account-setup-step-5-attachment')}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.jpg,.jpeg,.png"
            className="experience-file-input"
            style={{ display: 'none' }}
          />
          {currentExperience.documentName ? (
            <div className="experience-file-display">
              <span>{currentExperience.documentName}</span>
              <button type="button" onClick={handleRemoveFile} className="experience-remove-file">
                <i className="fas fa-times"></i>
              </button>
            </div>
          ) : (
            <div className="experience-drop-hint">
              <i className="fas fa-arrow-down"></i>
              <span>PDF, JPG, JPEG, PNG - max 5MB</span>
            </div>
          )}
        </div>
      </div>

      <div className="experience-form-actions">
        <button type="button" onClick={compactFormOnly ? resetExperienceForm : closeModal} className="experience-button experience-button-secondary">
          {t('common-cancel')}
        </button>
        <button type="button" onClick={handleSaveExperience} className="experience-button experience-button-primary" disabled={isUploadingDocument}>
          <i className={isUploadingDocument ? 'fas fa-spinner fa-spin' : editingId ? 'fas fa-save' : 'fas fa-plus'}></i>
          <span>{isUploadingDocument ? (t('common-saving') || 'Saving...') : (editingId ? t('common-edit') : t('account-setup-step-5-add'))}</span>
        </button>
      </div>
    </div>
  );

  if (compactFormOnly) {
    return (
      <div className="setup-step-form step5-wrapper form-only">
        <div className="setup-step-form-content">
          {renderExperienceForm()}
        </div>
      </div>
    );
  }

  return (
    <div className="setup-step-form step5-wrapper">
      <div className="setup-step-form-content">
        <section className="experience-overview">
          <div className="experience-overview-header">
            <div className="experience-overview-copy">
              <h3>{t('account-setup-step-5-title')}</h3>
              <p>{uiCopy.overviewDescription}</p>
              <div className="experience-overview-stats">
                <span className="experience-stat-chip">{experiences.length} {t('account-setup-step-5-title')}</span>
                <span className="experience-stat-chip">{experiences.filter((experience) => experience.ongoing).length} {t('account-setup-step-5-present')}</span>
              </div>
            </div>

            <button type="button" className="experience-open-modal" onClick={openCreateModal}>
              <i className="fas fa-plus"></i>
              <span>{t('account-setup-step-5-add')}</span>
            </button>
          </div>

          {experiences.length === 0 ? (
            <div className="experience-empty-state">
              <i className="fas fa-briefcase"></i>
              <h4>{t('account-setup-step-5-no-experience')}</h4>
              <p>{uiCopy.emptyHint}</p>
            </div>
          ) : (
            <div className="experience-preview-list">
              {experiences.map((experience) => (
                <article key={experience.id} className="experience-preview-card">
                  <div className="experience-preview-main">
                    <div className="experience-preview-top">
                      <div className="experience-preview-title">
                        <div className="experience-company-row">
                          <h4>{experience.company}</h4>
                          {experience.type ? (
                            <span className="experience-type-badge">{t(`account-setup-step-5-type-${experience.type}`) || experience.type}</span>
                          ) : null}
                        </div>
                        <p>{experience.position}</p>
                      </div>

                      <div className="experience-preview-actions">
                        <button type="button" onClick={() => handleEditExperience(experience)} title={t('common-edit')}>
                          <i className="fas fa-pen"></i>
                        </button>
                        <button type="button" onClick={() => handleRemoveExperience(experience.id)} title={t('common-delete')}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>

                    <div className="experience-preview-meta">
                      <span className="experience-date-pill">
                        <i className="fas fa-calendar"></i>
                        {formatDateRange(experience)}
                      </span>
                      {experience.document || experience.documentName ? (
                        <span className="experience-doc-pill">
                          <i className="fas fa-paperclip"></i>
                          {getDocumentName(experience.document, experience.documentName) || t('account-setup-step-5-attachment')}
                        </span>
                      ) : null}
                    </div>

                    {experience.description ? (
                      <p className="experience-preview-description">{experience.description}</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <SetupModal
        isOpen={isModalOpen}
        onClose={closeModal}
        icon="fas fa-briefcase"
        title={editingId ? `${t('common-edit')} ${t('account-setup-step-5-title')}` : t('account-setup-step-5-add')}
        description={uiCopy.modalDescription}
        closeLabel={t('common-cancel')}
        wide
      >
        {renderExperienceForm()}
      </SetupModal>

      <section className="preferences-overview">
        <div className="preferences-overview-header">
          <div className="preferences-overview-copy">
            <h3>{preferencesCopy.title}</h3>
            <p>{language === 'fr' ? 'Definissez vos preferences pour trouver les meilleurs postes.' : 'Set your preferences to find the best job matches.'}</p>
          </div>
        </div>

        <div className="preferences-form-grid">
          <div className="preferences-form-group">
            <label className="preferences-form-label">{preferencesCopy.jobTypesLabel}</label>
            <select
              value={jobType}
              onChange={(e) => handlePreferencesChange('jobTypes', e.target.value)}
              className="preferences-form-select"
            >
              <option value="">{preferencesCopy.jobTypesLabel}</option>
              <option value="fullTime">{t('account-setup-step-7-full-time')}</option>
              <option value="partTime">{t('account-setup-step-7-part-time')}</option>
              <option value="contract">{t('account-setup-step-7-contract')}</option>
              <option value="freelance">{t('account-setup-step-7-freelance')}</option>
              <option value="internship">{t('account-setup-step-7-internship')}</option>
            </select>
          </div>

          <div className="preferences-form-group">
            <label className="preferences-form-label">{preferencesCopy.locationLabel}</label>
            <select
              value={workLoc}
              onChange={(e) => handlePreferencesChange('workLocation', e.target.value)}
              className="preferences-form-select"
            >
              <option value="">{preferencesCopy.locationLabel}</option>
              <option value="onSite">{t('account-setup-step-7-on-site')}</option>
              <option value="remote">{t('account-setup-step-7-remote')}</option>
              <option value="hybrid">{t('account-setup-step-7-hybrid')}</option>
            </select>
          </div>

          <div className="preferences-form-group">
            <label className="preferences-form-label">{preferencesCopy.salaryLabel}</label>
            <select
              value={salary}
              onChange={(e) => handlePreferencesChange('salaryExpectation', e.target.value)}
              className="preferences-form-select"
            >
              <option value="">{preferencesCopy.salaryLabel}</option>
              <option value="$30,000 - $50,000">$30,000 - $50,000</option>
              <option value="$50,000 - $70,000">$50,000 - $70,000</option>
              <option value="$70,000 - $100,000">$70,000 - $100,000</option>
              <option value="$100,000 - $150,000">$100,000 - $150,000</option>
              <option value="$150,000+">$150,000+</option>
            </select>
          </div>

          <div className="preferences-form-group">
            <label className="preferences-form-label">{preferencesCopy.availabilityLabel}</label>
            <select
              value={avail}
              onChange={(e) => handlePreferencesChange('availability', e.target.value)}
              className="preferences-form-select"
            >
              <option value="">{preferencesCopy.availabilityLabel}</option>
              <option value="immediately">{language === 'fr' ? ' immediatement' : 'Immediately'}</option>
              <option value="1month">{language === 'fr' ? '1 mois' : '1 month'}</option>
              <option value="2months">{language === 'fr' ? '2 mois' : '2 months'}</option>
              <option value="3months">{language === 'fr' ? '3 mois' : '3 months'}</option>
              <option value="notice">{language === 'fr' ? 'Preavis' : 'Notice period'}</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Step5;
