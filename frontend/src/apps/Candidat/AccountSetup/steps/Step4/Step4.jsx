import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step4.css';

const Step4 = ({ formData = {}, onUpdate = () => {} }) => {
  const { t } = useLanguage();
  const educations = formData.educations || [];
  const [editingId, setEditingId] = useState(null);
  const [currentEducation, setCurrentEducation] = useState({
    institution: '',
    startYear: '',
    endYear: '',
    ongoing: false,
    socialLink: '',
    certificate: null
  });

  const currentYear = new Date().getFullYear();

  const handleStartYearChange = (value) => {
    // Allow empty values
    if (!value) {
      setCurrentEducation({ ...currentEducation, startYear: value });
      return;
    }
    const year = parseInt(value);
    
    // Only validate if we have a complete 4-digit year
    if (value.length === 4) {
      // Prevent entering a year after current year
      if (year > currentYear) {
        setCurrentEducation({ ...currentEducation, startYear: currentYear.toString() });
        return;
      }
      // Prevent start year from being more than end year (only if end year is set and complete)
      if (currentEducation.endYear && currentEducation.endYear.length === 4 && year > parseInt(currentEducation.endYear)) {
        return;
      }
    }
    
    setCurrentEducation({ ...currentEducation, startYear: value });
  };

  const handleEndYearChange = (value) => {
    // Allow empty values
    if (!value) {
      setCurrentEducation({ ...currentEducation, endYear: value });
      return;
    }
    const year = parseInt(value);
    
    // Only validate if we have a complete 4-digit year
    if (value.length === 4) {
      // Prevent end year from being less than start year (only if start year is set and complete)
      if (currentEducation.startYear && currentEducation.startYear.length === 4 && year < parseInt(currentEducation.startYear)) {
        return;
      }
      // If end year is after current year, automatically check ongoing
      if (year > currentYear) {
        setCurrentEducation({ 
          ...currentEducation, 
          endYear: value,
          ongoing: true 
        });
        return;
      }
    }
    
    setCurrentEducation({ ...currentEducation, endYear: value });
  };

  const handleOngoingChange = (checked) => {
    // Can't check ongoing if end year is before current year
    if (!checked || !currentEducation.endYear || parseInt(currentEducation.endYear) > currentYear) {
      setCurrentEducation({ 
        ...currentEducation, 
        ongoing: checked,
        endYear: checked ? '' : currentEducation.endYear
      });
    }
  };

  const handleAddEducation = () => {
    if (currentEducation.institution.trim()) {
      let newEducations;
      if (editingId) {
        // Update existing education
        newEducations = educations.map(edu => 
          edu.id === editingId ? { ...currentEducation, id: editingId } : edu
        );
        setEditingId(null);
      } else {
        // Add new education
        newEducations = [...educations, { ...currentEducation, id: Date.now() }];
      }
      onUpdate({ educations: newEducations });
      setCurrentEducation({
        institution: '',
        startYear: '',
        endYear: '',
        ongoing: false,
        socialLink: '',
        certificate: null
      });
    }
  };

  const handleEditEducation = (education) => {
    setCurrentEducation({
      institution: education.institution,
      startYear: education.startYear,
      endYear: education.endYear,
      ongoing: education.ongoing,
      socialLink: education.socialLink,
      certificate: education.certificate
    });
    setEditingId(education.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setCurrentEducation({
      institution: '',
      startYear: '',
      endYear: '',
      ongoing: false,
      socialLink: '',
      certificate: null
    });
  };

  const handleRemoveEducation = (id) => {
    const newEducations = educations.filter(edu => edu.id !== id);
    onUpdate({ educations: newEducations });
    if (editingId === id) {
      handleCancelEdit();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCurrentEducation({ ...currentEducation, certificate: file });
    }
  };

  const handleRemoveFile = () => {
    setCurrentEducation({ ...currentEducation, certificate: null });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEducation();
    }
  };

  return (
    <div className="setup-step-form step4-wrapper">
      <div className="setup-step-form-header">
        <i className="setup-step-icon fas fa-graduation-cap"></i>
      </div>

      <div className="setup-step-form-content">
        {/* Input Section */}
        <div className="education-input-section">
          <div className="education-form-grid">
            {/* Institution Name */}
            <div className="education-form-group full-width">
              <label className="education-form-label">{t('account-setup-step-4-institution')} *</label>
              <input
                type="text"
                value={currentEducation.institution}
                onChange={(e) => setCurrentEducation({ ...currentEducation, institution: e.target.value })}
                onKeyPress={handleKeyPress}
                placeholder={t('account-setup-step-4-institution')}
                className="education-form-input"
              />
            </div>

            {/* Start Year */}
            <div className="education-form-group">
              <label className="education-form-label">{t('account-setup-step-4-start-year')}</label>
              <input
                type="number"
                value={currentEducation.startYear}
                onChange={(e) => handleStartYearChange(e.target.value)}
                placeholder="2020"
                min="1940"
                max="9999"
                className="education-form-input"
              />
            </div>

            {/* End Year */}
            <div className="education-form-group">
              <label className="education-form-label">{t('account-setup-step-4-end-year')}</label>
              <input
                type="number"
                value={currentEducation.endYear}
                onChange={(e) => handleEndYearChange(e.target.value)}
                placeholder="2024"
                min="1940"
                max="9999"
                className="education-form-input"
              />
            </div>

            {/* Ongoing Checkbox */}
            <div className="education-form-group full-width">
              <label className="education-checkbox-label">
                <input
                  type="checkbox"
                  checked={currentEducation.ongoing}
                  onChange={(e) => handleOngoingChange(e.target.checked)}
                  disabled={currentEducation.endYear && parseInt(currentEducation.endYear) <= currentYear}
                  className="education-checkbox"
                />
                <span>{t('account-setup-step-4-ongoing')}</span>
              </label>
            </div>

            {/* Social Link */}
            <div className="education-form-group full-width">
              <label className="education-form-label">{t('account-setup-step-4-social-link')} (Optional)</label>
              <input
                type="url"
                value={currentEducation.socialLink}
                onChange={(e) => setCurrentEducation({ ...currentEducation, socialLink: e.target.value })}
                placeholder="https://..."
                className="education-form-input"
              />
            </div>

            {/* Certificate Upload */}
            <div className="education-form-group full-width">
              <label className="education-form-label">{t('account-setup-step-4-certificate-diploma')} (Optional)</label>
              <div className="certificate-upload-area">
                {!currentEducation.certificate ? (
                  <label className="certificate-upload-label">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="certificate-upload-input"
                    />
                    <i className="fas fa-cloud-upload-alt"></i>
                    <span>{t('account-setup-step-4-document')}</span>
                  </label>
                ) : (
                  <div className="certificate-selected">
                    <i className="fas fa-file-alt"></i>
                    <span className="certificate-name">{currentEducation.certificate.name}</span>
                    <button type="button" onClick={handleRemoveFile} className="certificate-remove">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="education-button-group">
            <button type="button" onClick={handleAddEducation} className="education-add-btn">
              <i className={editingId ? "fas fa-check" : "fas fa-plus"}></i>
              <span>{editingId ? t('common-edit') : t('account-setup-step-4-add')}</span>
            </button>
            {editingId && (
              <button type="button" onClick={handleCancelEdit} className="education-cancel-btn">
                <i className="fas fa-times"></i>
                <span>{t('common-cancel')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Education List */}
        <div className="education-list-section">
          {educations.length === 0 ? (
            <div className="education-empty">
              <i className="fas fa-graduation-cap"></i>
              <p>{t('account-setup-step-4-no-education')}</p>
            </div>
          ) : (
            <div className="education-list">
              {educations.map((edu) => (
                <div key={edu.id} className={`education-item ${editingId === edu.id ? 'editing' : ''}`}>
                  <div className="education-item-header">
                    <h4 className="education-institution">{edu.institution}</h4>
                    <div className="education-item-actions">
                      <button type="button" onClick={() => handleEditEducation(edu)} className="education-edit">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button type="button" onClick={() => handleRemoveEducation(edu.id)} className="education-delete">
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                  <div className="education-item-details">
                    <div className="education-detail">
                      <i className="fas fa-calendar"></i>
                      <span>{edu.startYear} - {edu.ongoing ? t('account-setup-step-4-ongoing') : edu.endYear}</span>
                    </div>
                    {edu.socialLink && (
                      <div className="education-detail">
                        <i className="fas fa-link"></i>
                        <a href={edu.socialLink} target="_blank" rel="noopener noreferrer">{t('account-setup-step-4-institution')}</a>
                      </div>
                    )}
                    {edu.certificate && (
                      <div className="education-detail">
                        <i className="fas fa-certificate"></i>
                        <span>{edu.certificate.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step4;
