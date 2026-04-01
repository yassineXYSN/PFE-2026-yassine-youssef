import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step4.css';

const isBrowserFile = (value) => typeof File !== 'undefined' && value instanceof File;

const getCertificateName = (certificate, certificateName) =>
  certificateName || certificate?.filename || certificate?.name || '';

const EMPTY_EDUCATION = {
  institution: '',
  startYear: '',
  endYear: '',
  ongoing: false,
  socialLink: '',
  certificate: null,
  certificateName: ''
};

const Step4 = ({ formData = {}, onUpdate = () => { }, compactFormOnly = false, onUploadDocument = null }) => {
  const { t } = useLanguage();
  const educations = formData.educations || [];
  const [editingId, setEditingId] = useState(null);
  const [isUploadingCertificate, setIsUploadingCertificate] = useState(false);
  const [currentEducation, setCurrentEducation] = useState({ ...EMPTY_EDUCATION });

  const currentYear = new Date().getFullYear();

  const handleStartYearChange = (value) => {
    if (!value) {
      setCurrentEducation({ ...currentEducation, startYear: value });
      return;
    }
    const year = parseInt(value, 10);

    if (value.length === 4) {
      if (year > currentYear) {
        setCurrentEducation({ ...currentEducation, startYear: currentYear.toString() });
        return;
      }
      if (currentEducation.endYear && currentEducation.endYear.length === 4 && year > parseInt(currentEducation.endYear, 10)) {
        return;
      }
    }

    setCurrentEducation({ ...currentEducation, startYear: value });
  };

  const handleEndYearChange = (value) => {
    if (!value) {
      setCurrentEducation({ ...currentEducation, endYear: value });
      return;
    }
    const year = parseInt(value, 10);

    if (value.length === 4) {
      if (currentEducation.startYear && currentEducation.startYear.length === 4 && year < parseInt(currentEducation.startYear, 10)) {
        return;
      }
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
    if (!checked || !currentEducation.endYear || parseInt(currentEducation.endYear, 10) > currentYear) {
      setCurrentEducation({
        ...currentEducation,
        ongoing: checked,
        endYear: checked ? '' : currentEducation.endYear
      });
    }
  };

  const handleAddEducation = async () => {
    if (!(currentEducation.institution || '').trim() || isUploadingCertificate) {
      return;
    }

    let educationToSave = { ...currentEducation };
    if (isBrowserFile(educationToSave.certificate) && typeof onUploadDocument === 'function') {
      setIsUploadingCertificate(true);
      try {
        const storedCertificate = await onUploadDocument(educationToSave.certificate);
        if (!storedCertificate) {
          alert('Failed to upload the education document.');
          return;
        }
        educationToSave = {
          ...educationToSave,
          certificate: storedCertificate,
          certificateName: storedCertificate.filename || educationToSave.certificateName
        };
      } catch (error) {
        console.error('Education document upload failed:', error);
        alert('Failed to upload the education document.');
        return;
      } finally {
        setIsUploadingCertificate(false);
      }
    }

    let newEducations;
    if (editingId) {
      newEducations = educations.map((edu) =>
        edu.id === editingId ? { ...educationToSave, id: editingId } : edu
      );
      setEditingId(null);
    } else {
      newEducations = [...educations, { ...educationToSave, id: Date.now() }];
    }

    onUpdate({ educations: newEducations });
    setCurrentEducation({ ...EMPTY_EDUCATION });
  };

  const handleEditEducation = (education) => {
    setCurrentEducation({
      institution: education.institution,
      startYear: education.startYear,
      endYear: education.endYear,
      ongoing: education.ongoing,
      socialLink: education.socialLink,
      certificate: education.certificate,
      certificateName: getCertificateName(education.certificate, education.certificateName)
    });
    setEditingId(education.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setCurrentEducation({ ...EMPTY_EDUCATION });
  };

  const handleRemoveEducation = (id) => {
    const newEducations = educations.filter((edu) => edu.id !== id);
    onUpdate({ educations: newEducations });
    if (editingId === id) {
      handleCancelEdit();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCurrentEducation({ ...currentEducation, certificate: file, certificateName: file.name });
    }
  };

  const handleRemoveFile = () => {
    setCurrentEducation({ ...currentEducation, certificate: null, certificateName: '' });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEducation();
    }
  };

  return (
    <div className={`setup-step-form step4-wrapper ${compactFormOnly ? 'form-only' : ''}`}>
      <div className="setup-step-form-header">
        <i className="setup-step-icon fas fa-graduation-cap"></i>
      </div>

      <div className="setup-step-form-content">
        <div className="education-input-section">
          <div className="education-form-grid">
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

            <div className="education-form-group full-width">
              <label className="education-checkbox-label">
                <input
                  type="checkbox"
                  checked={currentEducation.ongoing}
                  onChange={(e) => handleOngoingChange(e.target.checked)}
                  disabled={currentEducation.endYear && parseInt(currentEducation.endYear, 10) <= currentYear}
                  className="education-checkbox"
                />
                <span>{t('account-setup-step-4-ongoing')}</span>
              </label>
            </div>

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

            <div className="education-form-group full-width">
              <label className="education-form-label">{t('account-setup-step-4-certificate-diploma')} (Optional)</label>
              <div className="certificate-upload-area">
                {!currentEducation.certificate && !currentEducation.certificateName ? (
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
                    <span className="certificate-name">{getCertificateName(currentEducation.certificate, currentEducation.certificateName) || 'File'}</span>
                    <button type="button" onClick={handleRemoveFile} className="certificate-remove">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="education-button-group">
            <button type="button" onClick={handleAddEducation} className="education-add-btn" disabled={isUploadingCertificate}>
              <i className={isUploadingCertificate ? 'fas fa-spinner fa-spin' : editingId ? 'fas fa-check' : 'fas fa-plus'}></i>
              <span>{isUploadingCertificate ? (t('common-saving') || 'Saving...') : (editingId ? t('common-edit') : t('account-setup-step-4-add'))}</span>
            </button>
            {editingId && (
              <button type="button" onClick={handleCancelEdit} className="education-cancel-btn" disabled={isUploadingCertificate}>
                <i className="fas fa-times"></i>
                <span>{t('common-cancel')}</span>
              </button>
            )}
          </div>
        </div>

        {!compactFormOnly && (
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
                      {(edu.certificate || edu.certificateName) && (
                        <div className="education-detail">
                          <i className="fas fa-certificate"></i>
                          <span>{getCertificateName(edu.certificate, edu.certificateName) || 'File'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Step4;
