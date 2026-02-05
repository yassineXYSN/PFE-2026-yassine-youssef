import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step5.css';

const Step5 = ({ formData = {}, onUpdate = () => {} }) => {
  const { t } = useLanguage();
  const experiences = formData.experiences || [];
  const [editingId, setEditingId] = useState(null);
  const [currentExperience, setCurrentExperience] = useState({
    company: '',
    position: '',
    startYear: '',
    endYear: '',
    ongoing: false,
    description: '',
    document: null,
    documentName: ''
  });

  const currentYear = new Date().getFullYear();

  const handleStartYearChange = (value) => {
    // Allow empty values
    if (!value) {
      setCurrentExperience({ ...currentExperience, startYear: value });
      return;
    }
    const year = parseInt(value);
    
    // Only validate if we have a complete 4-digit year
    if (value.length === 4) {
      // Prevent entering a year after current year
      if (year > currentYear) {
        setCurrentExperience({ ...currentExperience, startYear: currentYear.toString() });
        return;
      }
      // Prevent start year from being more than end year (only if end year is set and complete)
      if (currentExperience.endYear && currentExperience.endYear.length === 4 && year > parseInt(currentExperience.endYear)) {
        return;
      }
    }
    
    setCurrentExperience({ ...currentExperience, startYear: value });
  };

  const handleEndYearChange = (value) => {
    // Allow empty values
    if (!value) {
      setCurrentExperience({ ...currentExperience, endYear: value });
      return;
    }
    const year = parseInt(value);
    
    // Only validate if we have a complete 4-digit year
    if (value.length === 4) {
      // Prevent end year from being less than start year (only if start year is set and complete)
      if (currentExperience.startYear && currentExperience.startYear.length === 4 && year < parseInt(currentExperience.startYear)) {
        return;
      }
      // If end year is after current year, automatically check ongoing
      if (year > currentYear) {
        setCurrentExperience({ 
          ...currentExperience, 
          endYear: value,
          ongoing: true 
        });
        return;
      }
    }
    
    setCurrentExperience({ ...currentExperience, endYear: value });
  };

  const handleOngoingChange = (checked) => {
    // Can't check ongoing if end year is before current year
    if (!checked || !currentExperience.endYear || parseInt(currentExperience.endYear) > currentYear) {
      setCurrentExperience({ 
        ...currentExperience, 
        ongoing: checked,
        endYear: checked ? '' : currentExperience.endYear
      });
    }
  };

  const handleAddExperience = () => {
    if (currentExperience.company.trim() && currentExperience.position.trim() && currentExperience.startYear) {
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
      setCurrentExperience({
        company: '',
        position: '',
        startYear: '',
        endYear: '',
        ongoing: false,
        description: '',
        document: null,
        documentName: ''
      });
    }
  };

  const handleEditExperience = (experience) => {
    setCurrentExperience(experience);
    setEditingId(experience.id);
  };

  const handleCancelEdit = () => {
    setCurrentExperience({
      company: '',
      position: '',
      startYear: '',
      endYear: '',
      ongoing: false,
      description: '',
      document: null,
      documentName: ''
    });
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

  return (
    <div className="setup-step-form step5-wrapper">
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
            {/* company Name */}
            <div className="experience-form-group full-width">
              <label className="experience-form-label">{t('account-setup-step-5-company')}</label>
              <input
                type="text"
                value={currentExperience.company}
              onChange={(e) => setCurrentExperience({ ...currentExperience, company: e.target.value })}
              onKeyPress={handleKeyPress}
              placeholder={t('account-setup-step-5-company')}
              className="experience-form-input"
            />
          </div>

          <div className="experience-form-group full-width">
            <label className="experience-form-label">{t('account-setup-step-5-job-title')}</label>
            <input
              type="text"
              value={currentExperience.position}
              onChange={(e) => setCurrentExperience({ ...currentExperience, position: e.target.value })}
              placeholder="e.g., Senior Developer"
              className="experience-form-input"
              onKeyPress={handleKeyPress}
            />
          </div>

            {/* Start Year */}
            <div className="experience-form-group">
              <label className="experience-form-label">{t('account-setup-step-5-start-date')}</label>
              <input
                type="number"
                value={currentExperience.startYear}
                onChange={(e) => handleStartYearChange(e.target.value)}
                placeholder="2020"
                min="1940"
                max="9999"
                className="experience-form-input"
              />
            </div>

            {/* End Year */}
            <div className="experience-form-group">
              <label className="experience-form-label">{t('account-setup-step-5-end-date')}</label>
              <input
                type="number"
                value={currentExperience.endYear}
                onChange={(e) => handleEndYearChange(e.target.value)}
                placeholder="2024"
                min="1940"
                max="9999"
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
                  disabled={currentExperience.endYear && parseInt(currentExperience.endYear) <= currentYear}
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
          </div>
        </div>

        {/* Experience List */}
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
                      <div className="experience-company">{exp.company}</div>
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
                    <span>{exp.startYear} - {exp.ongoing ? t('account-setup-step-5-present') : exp.endYear}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
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
      </div>
    </div>
  );
};

export default Step5;
