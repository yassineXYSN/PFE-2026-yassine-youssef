import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import SetupModal from '../../components/SetupModal';
import './Step4.css';
import '../Step6/Step6.css';

const isBrowserFile = (value) => typeof File !== 'undefined' && value instanceof File;

const getCertificateName = (certificate, certificateName) =>
  certificateName || certificate?.filename || certificate?.name || '';

const getDocumentName = (document, documentName) =>
  documentName || document?.filename || document?.name || '';

const EMPTY_EDUCATION = {
  institution: '',
  startYear: '',
  endYear: '',
  ongoing: false,
  socialLink: '',
  certificate: null,
  certificateName: '',
};

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

const Step4 = ({ formData = {}, onUpdate = () => {}, compactFormOnly = false, onUploadDocument = null }) => {
  const { t, language } = useLanguage();
  const educations = formData.educations || [];
  const certificates = formData.certificates || [];
  const [editingId, setEditingId] = useState(null);
  const [isUploadingCertificate, setIsUploadingCertificate] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEducation, setCurrentEducation] = useState({ ...EMPTY_EDUCATION });
  const [editingCertificateId, setEditingCertificateId] = useState(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [currentCertificate, setCurrentCertificate] = useState({ ...EMPTY_CERTIFICATE });

  const uiCopy = language === 'fr'
    ? {
        overviewDescription: 'Vos formations restent visibles ici. Ouvrez le formulaire seulement pour ajouter ou modifier une ligne.',
        modalDescription: 'Ajoutez votre etablissement, vos dates et un document optionnel pour renforcer cette formation.',
        openLink: 'Ouvrir le lien',
        ongoingCount: 'En cours',
        completedCount: 'Terminees',
        emptyHint: 'Ajoutez au moins une formation pour mettre en valeur votre parcours academique.',
      }
    : {
        overviewDescription: 'Your education entries stay visible here. Open the form only when you need to add or update one.',
        modalDescription: 'Add your institution, dates, and an optional document to strengthen this education entry.',
        openLink: 'Open link',
        ongoingCount: 'Ongoing',
        completedCount: 'Completed',
        emptyHint: 'Add at least one education entry to showcase your academic background.',
      };

  const currentYear = new Date().getFullYear();
  const ongoingCount = educations.filter((education) => education.ongoing).length;

  const resetEducationForm = () => {
    setEditingId(null);
    setCurrentEducation({ ...EMPTY_EDUCATION });
  };

  const openCreateModal = () => {
    resetEducationForm();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isUploadingCertificate) {
      return;
    }
    resetEducationForm();
    setIsModalOpen(false);
  };

  const handleStartYearChange = (value) => {
    if (!value) {
      setCurrentEducation((previous) => ({ ...previous, startYear: value }));
      return;
    }

    const year = parseInt(value, 10);
    if (value.length === 4) {
      if (year > currentYear) {
        setCurrentEducation((previous) => ({ ...previous, startYear: String(currentYear) }));
        return;
      }

      if (currentEducation.endYear && currentEducation.endYear.length === 4 && year > parseInt(currentEducation.endYear, 10)) {
        return;
      }
    }

    setCurrentEducation((previous) => ({ ...previous, startYear: value }));
  };

  const handleEndYearChange = (value) => {
    if (!value) {
      setCurrentEducation((previous) => ({ ...previous, endYear: value }));
      return;
    }

    const year = parseInt(value, 10);
    if (value.length === 4) {
      if (currentEducation.startYear && currentEducation.startYear.length === 4 && year < parseInt(currentEducation.startYear, 10)) {
        return;
      }

      if (year > currentYear) {
        setCurrentEducation((previous) => ({
          ...previous,
          endYear: value,
          ongoing: true,
        }));
        return;
      }
    }

    setCurrentEducation((previous) => ({ ...previous, endYear: value }));
  };

  const handleOngoingChange = (checked) => {
    if (!checked || !currentEducation.endYear || parseInt(currentEducation.endYear, 10) > currentYear) {
      setCurrentEducation((previous) => ({
        ...previous,
        ongoing: checked,
        endYear: checked ? '' : previous.endYear,
      }));
    }
  };

  const handleSaveEducation = async () => {
    if (!(currentEducation.institution || '').trim() || isUploadingCertificate) {
      return;
    }

    let educationToSave = {
      ...currentEducation,
      institution: currentEducation.institution.trim(),
    };

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
          certificateName: storedCertificate.filename || educationToSave.certificateName,
        };
      } catch (error) {
        console.error('Education document upload failed:', error);
        alert('Failed to upload the education document.');
        return;
      } finally {
        setIsUploadingCertificate(false);
      }
    }

    const updatedEducations = editingId
      ? educations.map((education) => (
          education.id === editingId ? { ...educationToSave, id: editingId } : education
        ))
      : [...educations, { ...educationToSave, id: Date.now() }];

    onUpdate({ educations: updatedEducations });

    if (compactFormOnly) {
      resetEducationForm();
      return;
    }

    closeModal();
  };

  const handleEditEducation = (education) => {
    setCurrentEducation({
      institution: education.institution || '',
      startYear: education.startYear || '',
      endYear: education.endYear || '',
      ongoing: Boolean(education.ongoing),
      socialLink: education.socialLink || '',
      certificate: education.certificate || null,
      certificateName: getCertificateName(education.certificate, education.certificateName),
    });
    setEditingId(education.id);

    if (!compactFormOnly) {
      setIsModalOpen(true);
    }
  };

  const handleRemoveEducation = (id) => {
    onUpdate({ educations: educations.filter((education) => education.id !== id) });

    if (editingId === id) {
      if (compactFormOnly) {
        resetEducationForm();
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

    setCurrentEducation((previous) => ({
      ...previous,
      certificate: file,
      certificateName: file.name,
    }));
  };

  const handleRemoveFile = () => {
    setCurrentEducation((previous) => ({
      ...previous,
      certificate: null,
      certificateName: '',
    }));
  };

  const handleSubmitShortcut = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveEducation();
    }
  };

  const certificateUiCopy = language === 'fr'
    ? {
        overviewDescription: 'Affichez vos certificats ici et ouvrez le formulaire uniquement quand vous ajoutez une nouvelle preuve.',
        modalDescription: 'Ajoutez le nom, l\'organisation, la date et le document associe a votre certificat.',
        emptyHint: 'Ajoutez vos certificats pour rendre votre profil plus credible et plus complet.',
      }
    : {
        overviewDescription: 'Keep your certificates visible here and open the form only when you need to add a new credential.',
        modalDescription: 'Add the name, organization, date, and supporting file for your certificate.',
        emptyHint: 'Add your certificates to make your profile more credible and complete.',
      };

  const currentMonth = new Date().getMonth() + 1;

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

  const resetCertificateForm = () => {
    setEditingCertificateId(null);
    setCurrentCertificate({ ...EMPTY_CERTIFICATE });
  };

  const openCertificateModal = () => {
    resetCertificateForm();
    setIsCertificateModalOpen(true);
  };

  const closeCertificateModal = () => {
    if (isUploadingDocument) {
      return;
    }
    resetCertificateForm();
    setIsCertificateModalOpen(false);
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
          alert('Failed to upload the certificate document.');
          return;
        }

        certificateToSave = {
          ...certificateToSave,
          document: storedDocument,
          documentName: storedDocument.filename || certificateToSave.documentName,
        };
      } catch (error) {
        console.error('Certificate document upload failed:', error);
        alert('Failed to upload the certificate document.');
        return;
      } finally {
        setIsUploadingDocument(false);
      }
    }

    const updatedCertificates = editingCertificateId
      ? certificates.map((certificate) => (
          certificate.id === editingCertificateId ? { ...certificateToSave, id: editingCertificateId } : certificate
        ))
      : [...certificates, { ...certificateToSave, id: Date.now() }];

    onUpdate({ certificates: updatedCertificates });

    if (compactFormOnly) {
      resetCertificateForm();
      return;
    }

    closeCertificateModal();
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
    setEditingCertificateId(certificate.id);

    if (!compactFormOnly) {
      setIsCertificateModalOpen(true);
    }
  };

  const handleDeleteCertificate = (id) => {
    onUpdate({ certificates: certificates.filter((certificate) => certificate.id !== id) });

    if (editingCertificateId === id) {
      if (compactFormOnly) {
        resetCertificateForm();
      } else {
        closeCertificateModal();
      }
    }
  };

  const handleCertificateFileChange = (event) => {
    const file = event.target.files?.[0];
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

    setCurrentCertificate((previous) => ({
      ...previous,
      document: file,
      documentName: file.name,
    }));
  };

  const handleCertificateRemoveFile = () => {
    setCurrentCertificate((previous) => ({
      ...previous,
      document: null,
      documentName: '',
    }));
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
            placeholder="e.g., AWS Certified Solutions Architect"
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
            placeholder="e.g., Amazon Web Services"
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
                  onChange={handleCertificateFileChange}
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
                <button type="button" onClick={handleCertificateRemoveFile} className="certificate-file-remove">
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
        <button type="button" onClick={compactFormOnly ? resetCertificateForm : closeCertificateModal} className="certificate-cancel-btn">
          <span>{t('common-cancel')}</span>
        </button>
        <button
          type="button"
          onClick={handleSaveCertificate}
          disabled={isUploadingDocument || !(currentCertificate.name || '').trim() || !(currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim() || !currentCertificate.document}
          className="certificate-add-btn"
        >
          <i className={isUploadingDocument ? 'fas fa-spinner fa-spin' : editingCertificateId ? 'fas fa-save' : 'fas fa-plus'}></i>
          <span>{isUploadingDocument ? (t('common-saving') || 'Saving...') : (editingCertificateId ? t('common-edit') : t('account-setup-step-6-add'))}</span>
        </button>
      </div>
    </div>
  );

  const renderEducationForm = () => (
    <div className={`education-input-section ${compactFormOnly ? '' : 'education-modal-panel'}`}>
      <div className="education-form-grid">
        <div className="education-form-group full-width">
          <label className="education-form-label">{t('account-setup-step-4-institution')} *</label>
          <input
            type="text"
            value={currentEducation.institution}
            onChange={(event) => setCurrentEducation((previous) => ({ ...previous, institution: event.target.value }))}
            onKeyDown={handleSubmitShortcut}
            placeholder={t('account-setup-step-4-institution')}
            className="education-form-input"
          />
        </div>

        <div className="education-form-group">
          <label className="education-form-label">{t('account-setup-step-4-start-year')}</label>
          <input
            type="number"
            value={currentEducation.startYear}
            onChange={(event) => handleStartYearChange(event.target.value)}
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
            onChange={(event) => handleEndYearChange(event.target.value)}
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
              onChange={(event) => handleOngoingChange(event.target.checked)}
              disabled={currentEducation.endYear && parseInt(currentEducation.endYear, 10) <= currentYear}
              className="education-checkbox"
            />
            <span>{t('account-setup-step-4-ongoing')}</span>
          </label>
        </div>

        <div className="education-form-group full-width">
          <label className="education-form-label">{t('account-setup-step-4-social-link')}</label>
          <input
            type="url"
            value={currentEducation.socialLink}
            onChange={(event) => setCurrentEducation((previous) => ({ ...previous, socialLink: event.target.value }))}
            placeholder="https://..."
            className="education-form-input"
          />
        </div>

        <div className="education-form-group full-width">
          <label className="education-form-label">{t('account-setup-step-4-certificate-diploma')}</label>
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
                <span className="certificate-name">
                  {getCertificateName(currentEducation.certificate, currentEducation.certificateName) || 'File'}
                </span>
                <button type="button" onClick={handleRemoveFile} className="certificate-remove">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="education-button-group">
        <button type="button" onClick={handleSaveEducation} className="education-add-btn" disabled={isUploadingCertificate}>
          <i className={isUploadingCertificate ? 'fas fa-spinner fa-spin' : editingId ? 'fas fa-save' : 'fas fa-plus'}></i>
          <span>{isUploadingCertificate ? (t('common-saving') || 'Saving...') : (editingId ? t('common-edit') : t('account-setup-step-4-add'))}</span>
        </button>
        {(editingId || !compactFormOnly) ? (
          <button type="button" onClick={compactFormOnly ? resetEducationForm : closeModal} className="education-cancel-btn" disabled={isUploadingCertificate}>
            <i className="fas fa-times"></i>
            <span>{t('common-cancel')}</span>
          </button>
        ) : null}
      </div>
    </div>
  );

  if (compactFormOnly) {
    return (
      <div className="setup-step-form step4-wrapper form-only">
        <div className="setup-step-form-content">
          {renderEducationForm()}
        </div>
      </div>
    );
  }

  return (
    <div className="setup-step-form step4-wrapper">
      <div className="setup-step-form-content">
        <section className="education-overview">
          <div className="education-overview-header">
            <div className="education-overview-copy">
              <h3>{t('account-setup-step-4-title')}</h3>
              <p>{uiCopy.overviewDescription}</p>
              <div className="education-overview-stats">
                <span className="education-stat-chip">{educations.length} {t('account-setup-step-4-education')}</span>
                <span className="education-stat-chip">{ongoingCount} {uiCopy.ongoingCount}</span>
                <span className="education-stat-chip">{Math.max(educations.length - ongoingCount, 0)} {uiCopy.completedCount}</span>
              </div>
            </div>

            <button type="button" className="education-open-modal" onClick={openCreateModal}>
              <i className="fas fa-plus"></i>
              <span>{t('account-setup-step-4-add')}</span>
            </button>
          </div>

          {educations.length === 0 ? (
            <div className="education-empty-state">
              <i className="fas fa-graduation-cap"></i>
              <h4>{t('account-setup-step-4-no-education')}</h4>
              <p>{uiCopy.emptyHint}</p>
            </div>
          ) : (
            <div className="education-preview-grid">
              {educations.map((education) => (
                <article key={education.id} className="education-preview-card">
                  <div className="education-preview-top">
                    <div>
                      <h4>{education.institution}</h4>
                      <p>
                        {(education.startYear || '----')} - {education.ongoing ? t('account-setup-step-4-ongoing') : (education.endYear || '----')}
                      </p>
                    </div>

                    <div className="education-preview-actions">
                      <button type="button" onClick={() => handleEditEducation(education)} title={t('common-edit')}>
                        <i className="fas fa-pen"></i>
                      </button>
                      <button type="button" onClick={() => handleRemoveEducation(education.id)} title={t('common-delete')}>
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  <div className="education-preview-meta">
                    {education.socialLink ? (
                      <a href={education.socialLink} target="_blank" rel="noreferrer" className="education-preview-link">
                        <i className="fas fa-link"></i>
                        <span>{uiCopy.openLink}</span>
                      </a>
                    ) : null}

                    {education.certificate || education.certificateName ? (
                      <div className="education-preview-file">
                        <i className="fas fa-file-alt"></i>
                        <span>{getCertificateName(education.certificate, education.certificateName) || 'File'}</span>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="certificate-overview">
          <div className="certificate-overview-header">
            <div className="certificate-overview-copy">
              <h3>{t('account-setup-step-6-title')}</h3>
              <p>{certificateUiCopy.overviewDescription}</p>
              <div className="certificate-overview-stats">
                <span className="certificate-stat-chip">{certificates.length} {t('account-setup-step-6-certificates')}</span>
              </div>
            </div>

            <button type="button" className="certificate-open-modal" onClick={openCertificateModal}>
              <i className="fas fa-plus"></i>
              <span>{t('account-setup-step-6-add')}</span>
            </button>
          </div>

          {certificates.length === 0 ? (
            <div className="certificate-empty-state">
              <i className="fas fa-certificate"></i>
              <h4>{t('account-setup-step-6-no-certificates')}</h4>
              <p>{certificateUiCopy.emptyHint}</p>
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
        icon="fas fa-graduation-cap"
        title={editingId ? `${t('common-edit')} ${t('account-setup-step-4-title')}` : t('account-setup-step-4-add')}
        description={uiCopy.modalDescription}
        closeLabel={t('common-cancel')}
        wide
      >
        {renderEducationForm()}
      </SetupModal>

      <SetupModal
        isOpen={isCertificateModalOpen}
        onClose={closeCertificateModal}
        icon="fas fa-certificate"
        title={editingCertificateId ? `${t('common-edit')} ${t('account-setup-step-6-title')}` : t('account-setup-step-6-add')}
        description={certificateUiCopy.modalDescription}
        closeLabel={t('common-cancel')}
        wide
      >
        {renderCertificateForm()}
      </SetupModal>
    </div>
  );
};

export default Step4;
