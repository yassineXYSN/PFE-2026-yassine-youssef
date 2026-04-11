import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import SetupModal from '../../components/SetupModal';
import './Step6.css';

const isBrowserFile = (value) => typeof File !== 'undefined' && value instanceof File;

const getDocumentName = (document, documentName) =>
  documentName || document?.filename || document?.name || '';

const EMPTY_CERTIFICATE = {
  name: '',
  issuingOrganization: '',
  issuer: '',
  issueDate: '',
  year: '',
  description: '',
  document: null,
  documentName: '',
};

const Step6 = ({ formData = {}, onUpdate = () => {}, compactFormOnly = false, onUploadDocument = null }) => {
  const { t, language } = useLanguage();
  const certificates = formData.certificates || [];
  const [editingId, setEditingId] = useState(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCertificate, setCurrentCertificate] = useState({ ...EMPTY_CERTIFICATE });


  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const resetCertificateForm = () => {
    setEditingId(null);
    setCurrentCertificate({ ...EMPTY_CERTIFICATE });
  };

  const openCreateModal = () => {
    resetCertificateForm();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isUploadingDocument) {
      return;
    }
    resetCertificateForm();
    setIsModalOpen(false);
  };

  const formatIssueDate = (value) => {
    if (!value) return '-';
    if (!value.includes('-')) return value;
    const [year, month] = value.split('-');
    if (!year || !month) return value;
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1).toLocaleString(locale, {
      month: 'short',
      year: 'numeric',
    });
  };

  const handleSaveCertificate = async () => {
    const certificateName = (currentCertificate.name || '').trim();
    const organizationName = (currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim();
    if (!certificateName || !organizationName || !currentCertificate.document || isUploadingDocument) {
      return;
    }

    let certificateToSave = {
      ...currentCertificate,
      name: certificateName,
      issuingOrganization: organizationName,
      issuer: organizationName,
      year: currentCertificate.issueDate ? currentCertificate.issueDate.split('-')[0] : (currentCertificate.year || ''),
    };

    if (isBrowserFile(certificateToSave.document) && typeof onUploadDocument === 'function') {
      setIsUploadingDocument(true);
      try {
        const storedDocument = await onUploadDocument(certificateToSave.document);
        if (!storedDocument) {
          alert(t('error_upload_cert'));
          return;
        }

        certificateToSave = {
          ...certificateToSave,
          document: storedDocument,
          documentName: storedDocument.filename || certificateToSave.documentName,
        };
      } catch (error) {
        console.error('Certificate document upload failed:', error);
        alert(t('error_upload_cert'));
        return;
      } finally {
        setIsUploadingDocument(false);
      }
    }

    const updatedCertificates = editingId
      ? certificates.map((certificate) => (
          certificate.id === editingId ? { ...certificateToSave, id: editingId } : certificate
        ))
      : [...certificates, { ...certificateToSave, id: Date.now() }];

    onUpdate({ certificates: updatedCertificates });

    if (compactFormOnly) {
      resetCertificateForm();
      return;
    }

    closeModal();
  };

  const handleEditCertificate = (certificate) => {
    setCurrentCertificate({
      ...EMPTY_CERTIFICATE,
      ...certificate,
      issuingOrganization: certificate.issuingOrganization || certificate.issuer || '',
      issuer: certificate.issuer || certificate.issuingOrganization || '',
      issueDate: certificate.issueDate || certificate.year || '',
      documentName: getDocumentName(certificate.document, certificate.documentName),
    });
    setEditingId(certificate.id);

    if (!compactFormOnly) {
      setIsModalOpen(true);
    }
  };

  const handleDeleteCertificate = (id) => {
    onUpdate({ certificates: certificates.filter((certificate) => certificate.id !== id) });

    if (editingId === id) {
      if (compactFormOnly) {
        resetCertificateForm();
      } else {
        closeModal();
      }
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t('error_file_too_large'));
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      alert(t('error_invalid_file_type'));
      return;
    }

    setCurrentCertificate((previous) => ({
      ...previous,
      document: file,
      documentName: file.name,
    }));
  };

  const handleRemoveFile = () => {
    setCurrentCertificate((previous) => ({
      ...previous,
      document: null,
      documentName: '',
    }));
  };

  const handleSubmitShortcut = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveCertificate();
    }
  };

  const renderCertificateForm = () => (
    <div className={`certificate-input-section ${compactFormOnly ? '' : 'certificate-modal-panel'}`}>
      <div className="certificate-form-grid">
        <div className="certificate-form-group full-width">
          <label className="certificate-form-label">{t('account-setup-step-6-name')}</label>
          <input
            type="text"
            value={currentCertificate.name || ''}
            onChange={(event) => setCurrentCertificate((previous) => ({ ...previous, name: event.target.value }))}
            onKeyDown={handleSubmitShortcut}
            placeholder={t('placeholder_cert_name') || 'e.g., AWS Certified Solutions Architect'}
            className={`certificate-form-input ${(!(currentCertificate.name || '').trim() && (currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() && currentCertificate.document) ? 'input-error' : ''}`}
          />
        </div>

        <div className="certificate-form-group full-width">
          <label className="certificate-form-label">{t('account-setup-step-6-organization')}</label>
          <input
            type="text"
            value={currentCertificate.issuingOrganization || currentCertificate.issuer || ''}
            onChange={(event) => setCurrentCertificate((previous) => ({
              ...previous,
              issuingOrganization: event.target.value,
              issuer: event.target.value,
            }))}
            placeholder={t('placeholder_cert_org') || 'e.g., Amazon Web Services'}
            className={`certificate-form-input ${((currentCertificate.name || '').trim() && !(currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() && currentCertificate.document) ? 'input-error' : ''}`}
            onKeyDown={handleSubmitShortcut}
          />
        </div>

        <div className="certificate-form-group">
          <label className="certificate-form-label">{t('account-setup-step-6-issued-date')}</label>
          <input
            type="month"
            value={currentCertificate.issueDate || currentCertificate.year || ''}
            onChange={(event) => setCurrentCertificate((previous) => ({
              ...previous,
              issueDate: event.target.value,
              year: event.target.value ? event.target.value.split('-')[0] : '',
            }))}
            max={`${currentYear}-${String(currentMonth).padStart(2, '0')}`}
            className="certificate-form-input"
          />
        </div>

        <div className="certificate-form-group">
          <label className="certificate-form-label">{t('account-setup-step-6-document')} *</label>
          <div className="certificate-file-upload">
            {!currentCertificate.documentName ? (
              <>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="certificate-file-input"
                  id="account-setup-cert-file"
                />
                <label
                  htmlFor="account-setup-cert-file"
                  className={`certificate-file-label ${((currentCertificate.name || '').trim() && (currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() && !currentCertificate.document) ? 'input-error' : ''}`}
                >
                  <i className="fas fa-upload"></i>
                  <span>{t('common-add')}</span>
                </label>
              </>
            ) : (
              <div className="certificate-file-preview">
                <i className="fas fa-file-alt"></i>
                <span>{currentCertificate.documentName}</span>
                <button type="button" onClick={handleRemoveFile} className="certificate-file-remove">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="certificate-form-group full-width">
          <label className="certificate-form-label">{t('account-setup-step-6-description')}</label>
          <textarea
            value={currentCertificate.description || ''}
            onChange={(event) => setCurrentCertificate((previous) => ({ ...previous, description: event.target.value }))}
            placeholder={t('account-setup-step-6-description')}
            className="certificate-form-textarea"
            rows="4"
          />
        </div>
      </div>

      <div className="certificate-form-actions">
        <button type="button" onClick={compactFormOnly ? resetCertificateForm : closeModal} className="certificate-cancel-btn">
          <span>{t('common-cancel')}</span>
        </button>
        <button
          type="button"
          onClick={handleSaveCertificate}
          disabled={isUploadingDocument || !(currentCertificate.name || '').trim() || !(currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() || !currentCertificate.document}
          className="certificate-add-btn"
        >
          <i className={isUploadingDocument ? 'fas fa-spinner fa-spin' : editingId ? 'fas fa-save' : 'fas fa-plus'}></i>
          <span>{isUploadingDocument ? t('common-saving') : (editingId ? t('common-edit') : t('account-setup-step-6-add'))}</span>
        </button>
      </div>
    </div>
  );

  if (compactFormOnly) {
    return (
      <div className="setup-step-form step6-wrapper form-only">
        <div className="setup-step-form-content">
          {renderCertificateForm()}
        </div>
      </div>
    );
  }

  return (
    <div className="setup-step-form step6-wrapper">
      <div className="setup-step-form-content">
        <section className="certificate-overview">
          <div className="certificate-overview-header">
            <div className="certificate-overview-copy">
              <h3>{t('account-setup-step-6-title')}</h3>
              <p>{t('cert_overview_desc')}</p>
              <div className="certificate-overview-stats">
                <span className="certificate-stat-chip">{certificates.length} {t('account-setup-step-6-certificates')}</span>
              </div>
            </div>

            <button type="button" className="certificate-open-modal" onClick={openCreateModal}>
              <i className="fas fa-plus"></i>
              <span>{t('account-setup-step-6-add')}</span>
            </button>
          </div>

          {certificates.length === 0 ? (
            <div className="certificate-empty-state">
              <i className="fas fa-certificate"></i>
              <h4>{t('account-setup-step-6-no-certificates')}</h4>
              <p>{t('cert_empty_hint')}</p>
            </div>
          ) : (
            <div className="certificate-preview-grid">
              {certificates.map((certificate) => (
                <article key={certificate.id} className="certificate-preview-card">
                  <div className="certificate-preview-top">
                    <div>
                      <h4>{certificate.name}</h4>
                      <p>{certificate.issuingOrganization || certificate.issuer || '-'}</p>
                    </div>

                    <div className="certificate-preview-actions">
                      <button type="button" onClick={() => handleEditCertificate(certificate)} title={t('common-edit')}>
                        <i className="fas fa-pen"></i>
                      </button>
                      <button type="button" onClick={() => handleDeleteCertificate(certificate.id)} title={t('common-delete')}>
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  <div className="certificate-preview-meta">
                    <span className="certificate-date-pill">
                      <i className="fas fa-calendar"></i>
                      {formatIssueDate(certificate.issueDate || certificate.year || '')}
                    </span>
                    {(certificate.document || certificate.documentName) ? (
                      <span className="certificate-file-pill">
                        <i className="fas fa-paperclip"></i>
                        {getDocumentName(certificate.document, certificate.documentName) || t('account-setup-step-6-document')}
                      </span>
                    ) : null}
                  </div>

                  {certificate.description ? (
                    <p className="certificate-preview-description">{certificate.description}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <SetupModal
        isOpen={isModalOpen}
        onClose={closeModal}
        icon="fas fa-certificate"
        title={editingId ? `${t('common-edit')} ${t('account-setup-step-6-title')}` : t('account-setup-step-6-add')}
        description={t('cert_modal_desc')}
        closeLabel={t('common-cancel')}
        wide
      >
        {renderCertificateForm()}
      </SetupModal>
    </div>
  );
};

export default Step6;
