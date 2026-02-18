import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step1.css';

const Step1 = ({ formData = {}, onUpdate = () => {} }) => {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState(formData.cv || null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'application/pdf' || file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      setSelectedFile(file);
      onUpdate({ cv: file });
    } else {
      alert(t('account-setup-step-1-error'));
      e.target.value = '';
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    onUpdate({ cv: null });
    const fileInput = document.getElementById('cv-upload');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="setup-step-form">
      <div className="setup-step-form-header">
        <div className="setup-step-icon">
          <i className="fas fa-file-upload"></i>
        </div>
      </div>

      <div className="setup-step-form-content">
        <div className="cv-upload-info">
          <h3 className="cv-upload-title">{t('account-setup-step-1-upload')}</h3>
          <p className="cv-upload-description">
            <i className="fas fa-robot"></i> {t('account-setup-step-1-info')}
          </p>
        </div>

        <div className="cv-upload-container">
          <label htmlFor="cv-upload" className="cv-upload-label">
            {!selectedFile ? (
              <>
                <i className="fas fa-cloud-upload-alt"></i>
                <span className="cv-upload-text">{t('account-setup-step-1-choose-drag')}</span>
                <span className="cv-upload-formats">{t('account-setup-step-1-formats')}</span>
              </>
            ) : (
              <div className="cv-file-selected">
                <i className="fas fa-file-pdf"></i>
                <div className="cv-file-info">
                  <span className="cv-file-name">{selectedFile.name}</span>
                  <span className="cv-file-size">{(selectedFile.size / 1024).toFixed(2)} KB</span>
                </div>
                <button type="button" onClick={handleRemoveFile} className="cv-remove-btn">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
          </label>
          <input
            type="file"
            id="cv-upload"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
            className="cv-upload-input"
          />
        </div>
      </div>
    </div>
  );
};

export default Step1;
