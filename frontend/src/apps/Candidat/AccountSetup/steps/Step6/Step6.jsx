import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step6.css';

const Step6 = ({ formData = {}, onUpdate = () => {}, compactFormOnly = false }) => {
  const { t } = useLanguage();
  const certificates = formData.certificates || [];
  const [editingId, setEditingId] = useState(null);
  const [currentCertificate, setCurrentCertificate] = useState({
    name: '',
    issuingOrganization: '',
    issueDate: '',
    description: '',
    document: null,
    documentName: ''
  });

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const handleAddCertificate = () => {
    if (currentCertificate.name.trim() && currentCertificate.issuingOrganization.trim() && currentCertificate.document) {
      let newCertificates;
      if (editingId) {
        newCertificates = certificates.map(cert => 
          cert.id === editingId ? { ...currentCertificate, id: editingId } : cert
        );
        setEditingId(null);
      } else {
        newCertificates = [...certificates, { ...currentCertificate, id: Date.now() }];
      }
      onUpdate({ certificates: newCertificates });
      setCurrentCertificate({
        name: '',
        issuingOrganization: '',
        issueDate: '',
        description: '',
        document: null,
        documentName: ''
      });
    }
  };

  const handleEditCertificate = (cert) => {
    setCurrentCertificate(cert);
    setEditingId(cert.id);
  };

  const handleDeleteCertificate = (id) => {
    const updated = certificates.filter(cert => cert.id !== id);
    onUpdate({ certificates: updated });
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
      setCurrentCertificate({ 
        ...currentCertificate, 
        document: file,
        documentName: file.name 
      });
    }
  };

  const handleRemoveFile = () => {
    setCurrentCertificate({ 
      ...currentCertificate, 
      document: null,
      documentName: '' 
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCertificate();
    }
  };

  return (
    <div className={`setup-step-form step6-wrapper ${compactFormOnly ? 'form-only' : ''}`}>
      <div className="setup-step-form-header">
        <i className="setup-step-icon fas fa-certificate"></i>
      </div>

      <div className="setup-step-form-content">
        {/* Input Section */}
        <div className="certificate-input-section">
          <div className="certificate-form-grid">
            {/* Certificate Name */}
            <div className="certificate-form-group full-width">
              <label className="certificate-form-label">{t('account-setup-step-6-name')}</label>
              <input
                type="text"
                value={currentCertificate.name}
                onChange={(e) => setCurrentCertificate({ ...currentCertificate, name: e.target.value })}
                onKeyPress={handleKeyPress}
                placeholder="e.g., AWS Certified Solutions Architect"
                className="certificate-form-input"
              />
            </div>

            {/* Issuing Organization */}
            <div className="certificate-form-group full-width">
              <label className="certificate-form-label">{t('account-setup-step-6-organization')}</label>
              <input
                type="text"
                value={currentCertificate.issuingOrganization}
                onChange={(e) => setCurrentCertificate({ ...currentCertificate, issuingOrganization: e.target.value })}
                placeholder="e.g., Amazon Web Services"
                className="certificate-form-input"
                onKeyPress={handleKeyPress}
              />
            </div>

            {/* Issue Date */}
            <div className="certificate-form-group">
              <label className="certificate-form-label">{t('account-setup-step-6-issued-date')}</label>
              <input
                type="month"
                value={currentCertificate.issueDate}
                onChange={(e) => setCurrentCertificate({ ...currentCertificate, issueDate: e.target.value })}
                max={`${currentYear}-${currentMonth.toString().padStart(2, '0')}`}
                className="certificate-form-input"
              />
            </div>

            {/* File Upload */}
            <div className="certificate-form-group">
              <label className="certificate-form-label">{t('account-setup-step-6-document')} <span className="required">*</span></label>
              <div className="certificate-file-upload">
                {!currentCertificate.documentName ? (
                  <>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="certificate-file-input"
                      id="cert-file"
                    />
                    <label htmlFor="cert-file" className="certificate-file-label">
                      <i className="fas fa-upload"></i>
                      <span>{t('common-add')}</span>
                    </label>
                  </>
                ) : (
                  <div className="certificate-file-preview">
                    <i className="fas fa-file-pdf"></i>
                    <span>{currentCertificate.documentName}</span>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="certificate-file-remove"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="certificate-form-group full-width">
              <label className="certificate-form-label">{t('account-setup-step-6-description')} (Optional)</label>
              <textarea
                value={currentCertificate.description}
                onChange={(e) => setCurrentCertificate({ ...currentCertificate, description: e.target.value })}
                placeholder={t('account-setup-step-6-description')}
                className="certificate-form-textarea"
                rows="2"
              />
            </div>
          </div>

          {/* Mobile Action Buttons */}
          <div className="certificate-form-actions-mobile">
            <button
              type="button"
              onClick={handleAddCertificate}
              disabled={!currentCertificate.name.trim() || !currentCertificate.issuingOrganization.trim() || !currentCertificate.document}
              className="certificate-add-btn"
            >
              <i className={editingId ? "fas fa-save" : "fas fa-plus"}></i>
              <span>{editingId ? t('common-edit') : t('common-add')} {t('account-setup-step-6-certificates')}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setCurrentCertificate({
                    name: '',
                    issuingOrganization: '',
                    issueDate: '',
                    description: '',
                    document: null,
                    documentName: ''
                  });
                }}
                className="certificate-cancel-btn"
              >
                <span>{t('common-cancel')}</span>
              </button>
            )}
          </div>

          {compactFormOnly && (
            <div className="certificate-form-actions">
              <button
                type="button"
                onClick={handleAddCertificate}
                disabled={!currentCertificate.name.trim() || !currentCertificate.issuingOrganization.trim() || !currentCertificate.document}
                className="certificate-add-btn"
              >
                <i className={editingId ? "fas fa-save" : "fas fa-plus"}></i>
                <span>{editingId ? t('common-edit') : t('common-add')} {t('account-setup-step-6-certificates')}</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setCurrentCertificate({
                      name: '',
                      issuingOrganization: '',
                      issueDate: '',
                      description: '',
                      document: null,
                      documentName: ''
                    });
                  }}
                  className="certificate-cancel-btn"
                >
                  <span>{t('common-cancel')}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {!compactFormOnly && (
          <div className="certificate-list-section">
            <div className="certificate-list-header">
              <div className="certificate-list-header-content">
                <i className="fas fa-certificate"></i>
                <span>{t('account-setup-step-6-certificates')} ({certificates.length})</span>
              </div>
              <button
                type="button"
                onClick={handleAddCertificate}
                disabled={!currentCertificate.name.trim() || !currentCertificate.issuingOrganization.trim() || !currentCertificate.document}
                className="certificate-header-add-btn"
                title={t('common-add')}
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>

            <div className="certificate-list-content">
              {certificates.length === 0 ? (
                <div className="certificate-empty-state">
                  <i className="fas fa-award"></i>
                  <p>{t('account-setup-step-6-no-certificates')}</p>
                </div>
              ) : (
                <div className="certificate-items">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="certificate-card">
                      <div className="certificate-card-header">
                        <h4>{cert.name}</h4>
                        <div className="certificate-card-actions">
                          <button
                            type="button"
                            onClick={() => handleEditCertificate(cert)}
                            className="certificate-edit-btn"
                            title={t('common-edit')}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCertificate(cert.id)}
                            className="certificate-delete-btn"
                            title={t('common-delete')}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                      <div className="certificate-card-body">
                        <p className="certificate-org">{cert.issuingOrganization}</p>
                        {cert.description && (
                          <p className="certificate-desc">{cert.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Step6;
