import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step6.css';

const isBrowserFile = (value) => typeof File !== 'undefined' && value instanceof File;

const getDocumentName = (document, documentName) =>
  documentName || document?.filename || document?.name || '';

const EMPTY_CERTIFICATE = {
  name: '',
  issuingOrganization: '',
  issueDate: '',
  description: '',
  document: null,
  documentName: ''
};

const Step6 = ({ formData = {}, onUpdate = () => { }, compactFormOnly = false, onUploadDocument = null }) => {
  const { t } = useLanguage();
  const certificates = formData.certificates || [];
  const [editingId, setEditingId] = useState(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [currentCertificate, setCurrentCertificate] = useState({ ...EMPTY_CERTIFICATE });

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const handleAddCertificate = async () => {
    const certName = currentCertificate.name || '';
    const orgName = currentCertificate.issuingOrganization || currentCertificate.issuer || '';
    if (!certName.trim() || !orgName.trim() || !currentCertificate.document || isUploadingDocument) {
      return;
    }

    let certificateToSave = { ...currentCertificate };
    if (isBrowserFile(certificateToSave.document) && typeof onUploadDocument === 'function') {
      setIsUploadingDocument(true);
      try {
        const storedDocument = await onUploadDocument(certificateToSave.document);
        if (!storedDocument) {
          alert('Failed to upload the certificate document.');
          return;
        }
        certificateToSave = {
          ...certificateToSave,
          document: storedDocument,
          documentName: storedDocument.filename || certificateToSave.documentName
        };
      } catch (error) {
        console.error('Certificate document upload failed:', error);
        alert('Failed to upload the certificate document.');
        return;
      } finally {
        setIsUploadingDocument(false);
      }
    }

    let newCertificates;
    if (editingId) {
      newCertificates = certificates.map((cert) =>
        cert.id === editingId ? { ...certificateToSave, id: editingId } : cert
      );
      setEditingId(null);
    } else {
      newCertificates = [...certificates, { ...certificateToSave, id: Date.now() }];
    }
    onUpdate({ certificates: newCertificates });
    setCurrentCertificate({ ...EMPTY_CERTIFICATE });
  };

  const handleEditCertificate = (cert) => {
    setCurrentCertificate({
      ...EMPTY_CERTIFICATE,
      ...cert,
      documentName: getDocumentName(cert.document, cert.documentName)
    });
    setEditingId(cert.id);
  };

  const handleDeleteCertificate = (id) => {
    const updated = certificates.filter((cert) => cert.id !== id);
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

  const resetCurrentCertificate = () => {
    setEditingId(null);
    setCurrentCertificate({ ...EMPTY_CERTIFICATE });
  };

  return (
    <div className={`setup-step-form step6-wrapper ${compactFormOnly ? 'form-only' : ''}`}>
      <div className="setup-step-form-header">
        <i className="setup-step-icon fas fa-certificate"></i>
      </div>

      <div className="setup-step-form-content">
        <div className="certificate-input-section">
          <div className="certificate-form-grid">
            <div className="certificate-form-group full-width">
              <label className="certificate-form-label">{t('account-setup-step-6-name')}</label>
              <input
                type="text"
                value={currentCertificate.name || ''}
                onChange={(e) => setCurrentCertificate({ ...currentCertificate, name: e.target.value })}
                onKeyPress={handleKeyPress}
                placeholder="e.g., AWS Certified Solutions Architect"
                className={`certificate-form-input ${(!(currentCertificate.name || '').trim() && (currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() && currentCertificate.document) ? 'input-error' : ''}`}
              />
            </div>

            <div className="certificate-form-group full-width">
              <label className="certificate-form-label">{t('account-setup-step-6-organization')}</label>
              <input
                type="text"
                value={currentCertificate.issuingOrganization || currentCertificate.issuer || ''}
                onChange={(e) => setCurrentCertificate({ ...currentCertificate, issuingOrganization: e.target.value, issuer: e.target.value })}
                placeholder="e.g., Amazon Web Services"
                className={`certificate-form-input ${((currentCertificate.name || '').trim() && !(currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() && currentCertificate.document) ? 'input-error' : ''}`}
                onKeyPress={handleKeyPress}
              />
            </div>

            <div className="certificate-form-group">
              <label className="certificate-form-label">{t('account-setup-step-6-issued-date')}</label>
              <input
                type="month"
                value={currentCertificate.issueDate || currentCertificate.year || ''}
                onChange={(e) => setCurrentCertificate({ ...currentCertificate, issueDate: e.target.value, year: e.target.value })}
                max={`${currentYear}-${currentMonth.toString().padStart(2, '0')}`}
                className="certificate-form-input"
              />
            </div>

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
                    <label htmlFor="cert-file" className={`certificate-file-label ${((currentCertificate.name || '').trim() && (currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() && !currentCertificate.document) ? 'input-error' : ''}`}>
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

            <div className="certificate-form-group full-width">
              <label className="certificate-form-label">{t('account-setup-step-6-description')} (Optional)</label>
              <textarea
                value={currentCertificate.description || ''}
                onChange={(e) => setCurrentCertificate({ ...currentCertificate, description: e.target.value })}
                placeholder={t('account-setup-step-6-description')}
                className="certificate-form-textarea"
                rows="2"
              />
            </div>
          </div>

          <div className="certificate-form-actions-mobile">
            <button
              type="button"
              onClick={handleAddCertificate}
              disabled={isUploadingDocument || !(currentCertificate.name || '').trim() || !(currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() || !currentCertificate.document}
              className="certificate-add-btn"
            >
              <i className={isUploadingDocument ? 'fas fa-spinner fa-spin' : editingId ? 'fas fa-save' : 'fas fa-plus'}></i>
              <span>{isUploadingDocument ? (t('common-saving') || 'Saving...') : `${editingId ? t('common-edit') : t('common-add')} ${t('account-setup-step-6-certificates')}`}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetCurrentCertificate}
                disabled={isUploadingDocument}
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
                disabled={isUploadingDocument || !(currentCertificate.name || '').trim() || !(currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() || !currentCertificate.document}
                className="certificate-add-btn"
              >
                <i className={isUploadingDocument ? 'fas fa-spinner fa-spin' : editingId ? 'fas fa-save' : 'fas fa-plus'}></i>
                <span>{isUploadingDocument ? (t('common-saving') || 'Saving...') : `${editingId ? t('common-edit') : t('common-add')} ${t('account-setup-step-6-certificates')}`}</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetCurrentCertificate}
                  disabled={isUploadingDocument}
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
                disabled={isUploadingDocument || !(currentCertificate.name || '').trim() || !(currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() || !currentCertificate.document}
                className="certificate-header-add-btn"
                title={editingId ? t('common-edit') : t('common-add')}
              >
                <i className={isUploadingDocument ? 'fas fa-spinner fa-spin' : editingId ? 'fas fa-save' : 'fas fa-plus'}></i>
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
                  {certificates.map((cert) => {
                    const hasError = !(cert.name || '').trim() || !(cert.issuingOrganization || cert.issuer || '').trim() || !cert.document;
                    return (
                      <div key={cert.id} className={`certificate-card ${hasError ? 'card-error' : ''}`}>
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
                          <p className="certificate-org">{cert.issuingOrganization || cert.issuer}</p>
                          {cert.description && (
                            <p className="certificate-desc">{cert.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
