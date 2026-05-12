import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import SetupModal from '../../components/SetupModal';
import './Step5.css';

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

const Step5 = ({ formData = {}, onUpdate = () => {}, onUploadDocument = null }) => {
  const { t, language } = useLanguage();
  const experiences = formData.experiences || [];
  const preferences = formData.jobPreferences || {};
  const [editingId, setEditingId] = useState(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentExperience, setCurrentExperience] = useState({ ...EMPTY_EXPERIENCE });

  const handlePreferencesChange = (field, value) => {
    onUpdate({ jobPreferences: { ...preferences, [field]: value } });
  };

  const formatDateLabel = (y, m) => {
    if (!y || !m) return '';
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: 'numeric' });
  };

  const resetExperienceForm = () => {
    setEditingId(null);
    setCurrentExperience({ ...EMPTY_EXPERIENCE });
  };

  const handleSaveExperience = async () => {
    if (!(currentExperience.company || '').trim() || !(currentExperience.position || '').trim() || isUploadingDocument) return;
    let expToSave = { ...currentExperience, company: currentExperience.company.trim(), position: currentExperience.position.trim() };

    if (isBrowserFile(expToSave.document) && typeof onUploadDocument === 'function') {
      setIsUploadingDocument(true);
      try {
        const storedDoc = await onUploadDocument(expToSave.document);
        if (storedDoc) expToSave = { ...expToSave, document: storedDoc, documentName: storedDoc.filename || expToSave.documentName };
      } catch (e) { console.error(e); } finally { setIsUploadingDocument(false); }
    }

    const updatedExps = editingId
      ? experiences.map((exp) => (exp.id === editingId ? { ...expToSave, id: editingId } : exp))
      : [...experiences, { ...expToSave, id: crypto.randomUUID() }];

    onUpdate({ experiences: updatedExps });
    setIsModalOpen(false);
    resetExperienceForm();
  };

  return (
    <div className="step5-wrapper career-laboratory-step">
      <div className="lab-layout">
        {/* LEFT: PROFESSIONAL CHRONICLES */}
        <section className="lab-panel crystal-panel">
          <div className="lab-panel-header">
            <div className="header-core">
              <div className="header-orb"><i className="fas fa-briefcase" /></div>
              <div className="header-text">
                <h3>{t('account-setup-step-5-title')}</h3>
                <div className="header-meta">
                  <span className="meta-pill count">{experiences.length}</span>
                </div>
              </div>
            </div>
            <button className="lab-add-btn" onClick={() => { resetExperienceForm(); setIsModalOpen(true); }}>
              <i className="fas fa-plus" />
            </button>
          </div>

          <div className="lab-scroller">
            {experiences.length === 0 ? (
              <div className="lab-empty">
                <i className="fas fa-user-tie" />
                <p>{t('account-setup-step-5-no-experience')}</p>
              </div>
            ) : (
              <div className="lab-items">
                {experiences.map((exp) => (
                  <div key={exp.id} className="lab-card credential pro">
                    <div className="card-info">
                      <div className="card-titles">
                        <strong>{exp.position}</strong>
                        <span>{formatDateLabel(exp.startYear, exp.startMonth)} - {exp.ongoing ? t('account-setup-step-5-present') : formatDateLabel(exp.endYear, exp.endMonth)}</span>
                      </div>
                      <div className="card-sub-titles">
                        <span>{exp.company}</span>
                        {exp.type && <span className="meta-pill">{t(`account-setup-step-5-type-${exp.type}`) || exp.type}</span>}
                      </div>
                    </div>
                    <div className="btn-group">
                      <button onClick={() => { setEditingId(exp.id); setCurrentExperience({ ...exp }); setIsModalOpen(true); }}><i className="fas fa-pen" /></button>
                      <button onClick={() => onUpdate({ experiences: experiences.filter(e => e.id !== exp.id) })}><i className="fas fa-trash-alt" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: CAREER COMPASS */}
        <section className="lab-panel crystal-panel">
          <div className="lab-panel-header">
            <div className="header-core">
              <div className="header-orb alt"><i className="fas fa-compass" /></div>
              <div className="header-text">
                <h3>{t('account-setup-step-7-title') || 'Career compass'}</h3>
                <div className="header-meta">
                  <span className="meta-pill">{t('pref_setup_label') || 'Targeting'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="preferences-lab-grid">
            <div className="pref-lab-item">
              <label><i className="fas fa-briefcase" /> {t('account-setup-step-7-job-types')}</label>
              <div className="input-glass-wrap">
                <select value={preferences.jobTypes || ''} onChange={(e) => handlePreferencesChange('jobTypes', e.target.value)} className="input-glass-field">
                  <option value="">{t('account-setup-step-7-job-types')}</option>
                  <option value="fullTime">{t('account-setup-step-7-full-time')}</option>
                  <option value="partTime">{t('account-setup-step-7-part-time')}</option>
                  <option value="contract">{t('account-setup-step-7-contract')}</option>
                  <option value="freelance">{t('account-setup-step-7-freelance')}</option>
                  <option value="internship">{t('account-setup-step-7-internship')}</option>
                </select>
              </div>
            </div>

            <div className="pref-lab-item">
              <label><i className="fas fa-map-marker-alt" /> {t('account-setup-step-7-location-flexibility')}</label>
              <div className="input-glass-wrap">
                <select value={preferences.workLocation || ''} onChange={(e) => handlePreferencesChange('workLocation', e.target.value)} className="input-glass-field">
                  <option value="">{t('account-setup-step-7-location-flexibility')}</option>
                  <option value="onSite">{t('account-setup-step-7-on-site')}</option>
                  <option value="remote">{t('account-setup-step-7-remote')}</option>
                  <option value="hybrid">{t('account-setup-step-7-hybrid')}</option>
                </select>
              </div>
            </div>

            <div className="pref-lab-item">
              <label><i className="fas fa-coins" /> {t('account-setup-step-7-salary-expectation')}</label>
              <div className="input-glass-wrap">
                <select value={preferences.salaryExpectation || ''} onChange={(e) => handlePreferencesChange('salaryExpectation', e.target.value)} className="input-glass-field">
                  <option value="">{t('account-setup-step-7-salary-expectation')}</option>
                  <option value="$30,000 - $50,000">$30,000 - $50,000</option>
                  <option value="$50,000 - $70,000">$50,000 - $70,000</option>
                  <option value="$70,000 - $100,000">$70,000 - $100,000</option>
                  <option value="$100,000 - $150,000">$100,000 - $150,000</option>
                  <option value="$150,000+">$150,000+</option>
                </select>
              </div>
            </div>

            <div className="pref-lab-item">
              <label><i className="fas fa-hourglass-half" /> {t('account-setup-step-7-availability')}</label>
              <div className="input-glass-wrap">
                <select value={preferences.availability || ''} onChange={(e) => handlePreferencesChange('availability', e.target.value)} className="input-glass-field">
                  <option value="">{t('account-setup-step-7-availability')}</option>
                  <option value="immediately">{t('account-setup-step-7-immediately')}</option>
                  <option value="1month">{t('account-setup-step-7-1-month')}</option>
                  <option value="2months">{t('account-setup-step-7-2-months')}</option>
                  <option value="3months">{t('account-setup-step-7-3-months-plus')}</option>
                  <option value="notice">{t('pref_availability_notice')}</option>
                </select>
              </div>
            </div>
          </div>
        </section>
      </div>

      <SetupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        icon="fas fa-briefcase"
        title={editingId ? t('common-edit') : t('account-setup-step-5-add')}
        closeLabel={t('common-cancel')}
      >
        <div className="lab-modal-content">
          <div className="lab-modal-row">
            <div className="input-glass-wrap">
              <i className="fas fa-building input-glass-icon" />
              <input type="text" placeholder={t('account-setup-step-5-company')} value={currentExperience.company} onChange={(e) => setCurrentExperience({ ...currentExperience, company: e.target.value })} className="input-glass-field" />
            </div>
            <div className="input-glass-wrap">
              <i className="fas fa-user-tag input-glass-icon" />
              <input type="text" placeholder={t('account-setup-step-5-job-title')} value={currentExperience.position} onChange={(e) => setCurrentExperience({ ...currentExperience, position: e.target.value })} className="input-glass-field" />
            </div>
          </div>

          <div className="lab-modal-row">
            <div className="input-glass-wrap">
              <i className="fas fa-calendar-day input-glass-icon" />
              <input type="month" value={currentExperience.startYear ? `${currentExperience.startYear}-${String(currentExperience.startMonth).padStart(2, '0')}` : ''} onChange={(e) => { const [y, m] = e.target.value.split('-'); setCurrentExperience({ ...currentExperience, startYear: y, startMonth: m }); }} className="input-glass-field" />
            </div>
            <div className="input-glass-wrap">
              <i className="fas fa-calendar-check input-glass-icon" />
              <input type="month" value={currentExperience.endYear ? `${currentExperience.endYear}-${String(currentExperience.endMonth).padStart(2, '0')}` : ''} disabled={currentExperience.ongoing} onChange={(e) => { const [y, m] = e.target.value.split('-'); setCurrentExperience({ ...currentExperience, endYear: y, endMonth: m }); }} className="input-glass-field" />
            </div>
          </div>

          <label className="education-checkbox-label">
            <input type="checkbox" checked={currentExperience.ongoing} onChange={(e) => setCurrentExperience({ ...currentExperience, ongoing: e.target.checked, endYear: '', endMonth: '' })} />
            <span>{t('account-setup-step-5-currently-working')}</span>
          </label>

          <div className="input-glass-wrap">
            <textarea placeholder={t('account-setup-step-5-description')} value={currentExperience.description} onChange={(e) => setCurrentExperience({ ...currentExperience, description: e.target.value })} className="input-glass-field textarea" rows="3" />
          </div>

          <div className="lab-modal-actions">
            <button className="lab-btn secondary" onClick={() => setIsModalOpen(false)}>{t('common-cancel')}</button>
            <button className="lab-btn primary" onClick={handleSaveExperience}>{editingId ? t('common-edit') : t('common-add')}</button>
          </div>
        </div>
      </SetupModal>
    </div>
  );
};

export default Step5;
