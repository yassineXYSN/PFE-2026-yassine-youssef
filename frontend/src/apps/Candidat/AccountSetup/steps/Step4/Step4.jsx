import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import SetupModal from '../../components/SetupModal';
import './Step4.css';

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

const Step4 = ({ formData = {}, onUpdate = () => {}, onUploadDocument = null }) => {
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

  const currentYear = new Date().getFullYear();

  const resetEducationForm = () => {
    setEditingId(null);
    setCurrentEducation({ ...EMPTY_EDUCATION });
  };

  const closeModal = () => {
    if (isUploadingCertificate) return;
    resetEducationForm();
    setIsModalOpen(false);
  };

  const handleSaveEducation = async () => {
    if (!(currentEducation.institution || '').trim() || isUploadingCertificate) return;
    let educationToSave = { ...currentEducation, institution: currentEducation.institution.trim() };

    if (isBrowserFile(educationToSave.certificate) && typeof onUploadDocument === 'function') {
      setIsUploadingCertificate(true);
      try {
        const storedCertificate = await onUploadDocument(educationToSave.certificate);
        if (storedCertificate) {
          educationToSave = {
            ...educationToSave,
            certificate: storedCertificate,
            certificateName: storedCertificate.filename || educationToSave.certificateName,
          };
        }
      } catch (e) { console.error(e); } finally { setIsUploadingCertificate(false); }
    }

    const updatedEducations = editingId
      ? educations.map((edu) => (edu.id === editingId ? { ...educationToSave, id: editingId } : edu))
      : [...educations, { ...educationToSave, id: Date.now() }];

    onUpdate({ educations: updatedEducations });
    closeModal();
  };

  const handleEditEducation = (edu) => {
    setCurrentEducation({ ...edu, certificateName: getCertificateName(edu.certificate, edu.certificateName) });
    setEditingId(edu.id);
    setIsModalOpen(true);
  };

  const handleSaveCertificate = async () => {
    const certName = (currentCertificate.name || '').trim();
    const orgName = (currentCertificate.issuingOrganization || currentCertificate.issuer || '').trim();
    if (!certName || !orgName || isUploadingDocument) return;

    let certToSave = {
      ...currentCertificate,
      name: certName,
      issuingOrganization: orgName,
      issuer: orgName,
      year: currentCertificate.issueDate ? currentCertificate.issueDate.split('-')[0] : (currentCertificate.year || ''),
    };

    if (isBrowserFile(certToSave.document) && typeof onUploadDocument === 'function') {
      setIsUploadingDocument(true);
      try {
        const storedDoc = await onUploadDocument(certToSave.document);
        if (storedDoc) {
          certToSave = { ...certToSave, document: storedDoc, documentName: storedDoc.filename || certToSave.documentName };
        }
      } catch (e) { console.error(e); } finally { setIsUploadingDocument(false); }
    }

    const updatedCerts = editingCertificateId
      ? certificates.map((c) => (c.id === editingCertificateId ? { ...certToSave, id: editingCertificateId } : c))
      : [...certificates, { ...certToSave, id: Date.now() }];

    onUpdate({ certificates: updatedCerts });
    setIsCertificateModalOpen(false);
    resetCertificateForm();
  };

  const resetCertificateForm = () => {
    setEditingCertificateId(null);
    setCurrentCertificate({ ...EMPTY_CERTIFICATE });
  };

  const handleEditCertificate = (cert) => {
    setCurrentCertificate({ ...cert, documentName: getDocumentName(cert.document, cert.documentName) });
    setEditingCertificateId(cert.id);
    setIsCertificateModalOpen(true);
  };

  const formatIssueDate = (value) => {
    if (!value || !value.includes('-')) return value || '-';
    const [y, m] = value.split('-');
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="step4-wrapper credentials-hub-step">
      <div className="lab-layout">
        {/* EDUCATION HUB */}
        <section className="lab-panel crystal-panel education-panel">
          <div className="lab-panel-header">
            <div className="header-core">
              <div className="header-orb"><i className="fas fa-graduation-cap" /></div>
              <div className="header-text">
                <h3>{t('account-setup-step-4-education')}</h3>
                <div className="header-meta">
                  <span className="meta-pill count">{educations.length}</span>
                </div>
              </div>
            </div>
            <button className="lab-add-btn" onClick={() => { resetEducationForm(); setIsModalOpen(true); }}>
              <i className="fas fa-plus" />
            </button>
          </div>

          <div className="lab-scroller">
            {educations.length === 0 ? (
              <div className="lab-empty">
                <i className="fas fa-user-graduate" />
                <p>{t('account-setup-step-4-no-education')}</p>
              </div>
            ) : (
              <div className="lab-items">
                {educations.map((edu) => (
                  <div key={edu.id} className="lab-card credential">
                    <div className="card-info">
                      <div className="card-titles">
                        <strong>{edu.institution}</strong>
                        <span>{edu.startYear} - {edu.ongoing ? t('account-setup-step-4-ongoing') : edu.endYear}</span>
                      </div>
                      {edu.certificateName && (
                        <div className="card-attachment">
                          <i className="fas fa-file-invoice" />
                          <span>{edu.certificateName}</span>
                        </div>
                      )}
                    </div>
                    <div className="btn-group">
                      <button onClick={() => handleEditEducation(edu)}><i className="fas fa-pen" /></button>
                      <button onClick={() => onUpdate({ educations: educations.filter(e => e.id !== edu.id) })}><i className="fas fa-trash-alt" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CERTIFICATES HUB */}
        <section className="lab-panel crystal-panel certificate-panel">
          <div className="lab-panel-header">
            <div className="header-core">
              <div className="header-orb alt"><i className="fas fa-award" /></div>
              <div className="header-text">
                <h3>{t('account-setup-step-6-certificates')}</h3>
                <div className="header-meta">
                  <span className="meta-pill count">{certificates.length}</span>
                </div>
              </div>
            </div>
            <button className="lab-add-btn alt" onClick={() => { resetCertificateForm(); setIsCertificateModalOpen(true); }}>
              <i className="fas fa-plus" />
            </button>
          </div>

          <div className="lab-scroller">
            {certificates.length === 0 ? (
              <div className="lab-empty">
                <i className="fas fa-stamp" />
                <p>{t('account-setup-step-6-no-certificates')}</p>
              </div>
            ) : (
              <div className="lab-items">
                {certificates.map((cert) => (
                  <div key={cert.id} className="lab-card credential cert">
                    <div className="card-info">
                      <div className="card-titles">
                        <strong>{cert.name}</strong>
                        <span>{formatIssueDate(cert.issueDate || cert.year)}</span>
                      </div>
                      <div className="card-sub-titles">
                        <span>{cert.issuingOrganization || cert.issuer}</span>
                      </div>
                    </div>
                    <div className="btn-group">
                      <button onClick={() => handleEditCertificate(cert)}><i className="fas fa-pen" /></button>
                      <button onClick={() => onUpdate({ certificates: certificates.filter(c => c.id !== cert.id) })}><i className="fas fa-trash-alt" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* EDUCATION MODAL */}
      <SetupModal
        isOpen={isModalOpen}
        onClose={closeModal}
        icon="fas fa-university"
        title={editingId ? t('common-edit') : t('account-setup-step-4-add')}
        closeLabel={t('common-cancel')}
      >
        <div className="lab-modal-content">
          <div className="lab-modal-field">
            <label className="field-premium-label">{t('account-setup-step-4-institution')}</label>
            <div className="input-glass-wrap">
              <i className="fas fa-school input-glass-icon" />
              <input
                type="text"
                value={currentEducation.institution}
                onChange={(e) => setCurrentEducation({ ...currentEducation, institution: e.target.value })}
                className="input-glass-field"
                placeholder="e.g. Harvard University"
              />
            </div>
          </div>

          <div className="lab-modal-row">
            <div className="lab-modal-field">
              <label className="field-premium-label">{t('account-setup-step-4-start-year')}</label>
              <div className="input-glass-wrap">
                <i className="fas fa-calendar-alt input-glass-icon" />
                <input
                  type="number"
                  value={currentEducation.startYear}
                  onChange={(e) => setCurrentEducation({ ...currentEducation, startYear: e.target.value })}
                  className="input-glass-field"
                />
              </div>
            </div>
            <div className="lab-modal-field">
              <label className="field-premium-label">{t('account-setup-step-4-end-year')}</label>
              <div className="input-glass-wrap">
                <i className="fas fa-calendar-check input-glass-icon" />
                <input
                  type="number"
                  value={currentEducation.endYear}
                  onChange={(e) => setCurrentEducation({ ...currentEducation, endYear: e.target.value })}
                  disabled={currentEducation.ongoing}
                  className="input-glass-field"
                />
              </div>
            </div>
          </div>

          <div className="lab-modal-field">
            <label className="education-checkbox-label">
              <input
                type="checkbox"
                checked={currentEducation.ongoing}
                onChange={(e) => setCurrentEducation({ ...currentEducation, ongoing: e.target.checked })}
              />
              <span>{t('account-setup-step-4-ongoing')}</span>
            </label>
          </div>

          <div className="lab-modal-field">
            <label className="field-premium-label">{t('account-setup-step-4-certificate-diploma')}</label>
            <div className="premium-file-row">
              <input type="file" id="edu-file" style={{ display: 'none' }} onChange={(e) => setCurrentEducation({ ...currentEducation, certificate: e.target.files[0], certificateName: e.target.files[0].name })} />
              <label htmlFor="edu-file" className="premium-file-btn">
                <i className="fas fa-cloud-upload-alt" />
                <span>{currentEducation.certificateName ? t('common-change') : t('common-add')}</span>
              </label>
              {currentEducation.certificateName && (
                <div className="premium-file-preview">
                  <span>{currentEducation.certificateName}</span>
                  <button onClick={() => setCurrentEducation({ ...currentEducation, certificate: null, certificateName: '' })}><i className="fas fa-times" /></button>
                </div>
              )}
            </div>
          </div>

          <div className="lab-modal-actions">
            <button className="lab-btn secondary" onClick={closeModal}>{t('common-cancel')}</button>
            <button className="lab-btn primary" onClick={handleSaveEducation}>{editingId ? t('common-edit') : t('common-add')}</button>
          </div>
        </div>
      </SetupModal>

      {/* CERTIFICATE MODAL */}
      <SetupModal
        isOpen={isCertificateModalOpen}
        onClose={() => setIsCertificateModalOpen(false)}
        icon="fas fa-award"
        title={editingCertificateId ? t('common-edit') : t('account-setup-step-6-add')}
        closeLabel={t('common-cancel')}
      >
        <div className="lab-modal-content">
          <div className="lab-modal-field">
            <label className="field-premium-label">{t('account-setup-step-6-name')}</label>
            <div className="input-glass-wrap">
              <i className="fas fa-file-signature input-glass-icon" />
              <input
                type="text"
                value={currentCertificate.name}
                onChange={(e) => setCurrentCertificate({ ...currentCertificate, name: e.target.value })}
                className="input-glass-field"
              />
            </div>
          </div>

          <div className="lab-modal-field">
            <label className="field-premium-label">{t('account-setup-step-6-organization')}</label>
            <div className="input-glass-wrap">
              <i className="fas fa-building input-glass-icon" />
              <input
                type="text"
                value={currentCertificate.issuingOrganization || currentCertificate.issuer}
                onChange={(e) => setCurrentCertificate({ ...currentCertificate, issuingOrganization: e.target.value, issuer: e.target.value })}
                className="input-glass-field"
              />
            </div>
          </div>

          <div className="lab-modal-row">
            <div className="lab-modal-field">
              <label className="field-premium-label">{t('account-setup-step-6-issued-date')}</label>
              <div className="input-glass-wrap">
                <i className="fas fa-calendar-day input-glass-icon" />
                <input
                  type="month"
                  value={currentCertificate.issueDate || currentCertificate.year}
                  onChange={(e) => setCurrentCertificate({ ...currentCertificate, issueDate: e.target.value, year: e.target.value.split('-')[0] })}
                  className="input-glass-field"
                />
              </div>
            </div>
          </div>

          <div className="lab-modal-field">
            <label className="field-premium-label">{t('account-setup-step-6-document')}</label>
            <div className="premium-file-row">
              <input type="file" id="cert-file" style={{ display: 'none' }} onChange={(e) => setCurrentCertificate({ ...currentCertificate, document: e.target.files[0], documentName: e.target.files[0].name })} />
              <label htmlFor="cert-file" className="premium-file-btn alt">
                <i className="fas fa-cloud-upload-alt" />
                <span>{currentCertificate.documentName ? t('common-change') : t('common-add')}</span>
              </label>
              {currentCertificate.documentName && (
                <div className="premium-file-preview">
                  <span>{currentCertificate.documentName}</span>
                  <button onClick={() => setCurrentCertificate({ ...currentCertificate, document: null, documentName: '' })}><i className="fas fa-times" /></button>
                </div>
              )}
            </div>
          </div>

          <div className="lab-modal-actions">
            <button className="lab-btn secondary" onClick={() => setIsCertificateModalOpen(false)}>{t('common-cancel')}</button>
            <button className="lab-btn primary alt" onClick={handleSaveCertificate}>{editingCertificateId ? t('common-edit') : t('common-add')}</button>
          </div>
        </div>
      </SetupModal>
    </div>
  );
};

export default Step4;
