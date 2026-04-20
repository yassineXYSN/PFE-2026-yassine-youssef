import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import { apiFetch } from '../../../../../core/api';
import './Step1.css';

const PARSE_STAGES = (t) => [
  { icon: 'fa-microscope', label: t('cv_parsing_stage_1') },
  { icon: 'fa-atom', label: t('cv_parsing_stage_2') },
  { icon: 'fa-brain-circuit', label: t('cv_parsing_stage_3') },
  { icon: 'fa-dna', label: t('cv_parsing_stage_4') },
  { icon: 'fa-check-double', label: t('cv_parsing_stage_5') },
];

const isBrowserFile = (value) => typeof File !== 'undefined' && value instanceof File;

const Step1 = ({ formData = {}, onUpdate = () => { }, onParsingChange = () => { }, onUploadDocument = null }) => {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState(formData.cv || null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const [currentHobby, setCurrentHobby] = useState('');
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const stepData = {
    firstName: formData.firstName || '',
    lastName: formData.lastName || '',
    birthDate: formData.birthDate || '',
    title: formData.title || '',
    address: formData.address || '',
    linkedinUrl: formData.linkedinUrl || ''
  };

  const profilePicture = formData.profilePicture || null;
  const hobbies = formData.hobbies || [];

  useEffect(() => {
    if (!isParsing) {
      setStageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev < PARSE_STAGES(t).length - 1 ? prev + 1 : prev));
    }, 2800);
    return () => clearInterval(interval);
  }, [isParsing]);

  useEffect(() => {
    if (!isBrowserFile(selectedFile)) {
      setSelectedFile(formData.cv || null);
    }
  }, [formData.cv, selectedFile]);

  const handleParseCV = async (e) => {
    if (e) e.preventDefault();
    if (!selectedFile || !isBrowserFile(selectedFile)) return;
    
    setIsParsing(true);
    setParseError(null);
    setParseSuccess(false);
    setStageIndex(0);
    onParsingChange(true);

    try {
      const payload = new FormData();
      payload.append('cv', selectedFile, selectedFile.name);

      const parsedData = await apiFetch('/candidat/account-setup/parse-cv', {
        method: 'POST',
        body: payload,
      });

      onUpdate({
        title: parsedData.title || formData.title || '',
        firstName: parsedData.firstName || formData.firstName || '',
        lastName: parsedData.lastName || formData.lastName || '',
        hobbies: parsedData.hobbies || formData.hobbies || [],
        skills: parsedData.skills || formData.skills || [],
        languages: parsedData.languages || formData.languages || [],
        educations: parsedData.educations || formData.educations || [],
        experiences: parsedData.experiences || formData.experiences || [],
        certificates: parsedData.certificates || formData.certificates || [],
        birthDate: parsedData.birthDate || formData.birthDate || '',
        address: parsedData.address || formData.address || '',
        linkedinUrl: parsedData.linkedinUrl || formData.linkedinUrl || '',
        jobPreferences: { ...(formData.jobPreferences || {}), ...(parsedData.jobPreferences || {}) }
      });

      setParseSuccess(true);
    } catch (err) {
      console.error('CV Parsing Error:', err);
      setParseError(err.message || t('cv_parsing_error'));
    } finally {
      setIsParsing(false);
      onParsingChange(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      alert(t('cv_upload_invalid'));
      return;
    }
    setSelectedFile(file);
    onUpdate({ cv: file });
    setParseSuccess(false);
    setParseError(null);

    if (typeof onUploadDocument === 'function') {
      try {
        const storedFile = await onUploadDocument(file);
        if (storedFile) {
          onUpdate({ cv: storedFile });
        }
      } catch (error) {
        console.error('CV upload failed:', error);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onUpdate({ [name]: value });
  };

  const handleProfilePicture = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => onUpdate({ profilePicture: ev.target.result });
    reader.readAsDataURL(file);
  };

  const handleAddHobby = () => {
    if (currentHobby.trim() && hobbies.length < 3) {
      onUpdate({ hobbies: [...hobbies, { name: currentHobby, id: Date.now() }] });
      setCurrentHobby('');
    }
  };

  const renderInputField = (name, label, icon, type = 'text', placeholder = '', fullWidth = false) => (
    <div className={`field-group ${fullWidth ? 'full-width' : ''}`}>
      <label className="field-premium-label">{label}</label>
      <div className="input-glass-wrap">
        <i className={`${icon.includes(' ') ? '' : 'fas '}${icon} input-glass-icon`} />
        <input
          type={type}
          name={name}
          value={stepData[name]}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="input-glass-field"
        />
      </div>
    </div>
  );

  return (
    <div className="step1-wrapper combined-step">
      {/* Immersive Parsing Status (Modal-less Overlay) */}
      {isParsing && (
        <div className="intelligence-overlay">
          <div className="scan-chamber">
            <div className="scan-beam" />
            <div className="atomic-loader">
              <div className="atom-core"><i className="fas fa-microchip" /></div>
              <div className="atom-orbit" />
              <div className="atom-orbit" />
              <div className="atom-orbit" />
            </div>
            <div className="scan-status-hub">
              <h3>{PARSE_STAGES(t)[stageIndex].label}</h3>
              <div className="parsing-track">
                <div className="parsing-fill" style={{ width: `${(stageIndex + 1) * 20}%` }} />
              </div>
              <div className="scan-stages-pill">
                {PARSE_STAGES(t).map((s, i) => (
                  <i key={i} className={`fas ${s.icon} ${i <= stageIndex ? 'active' : ''}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="combined-layout">
        {/* LEFT: IDENTITY COLUMN */}
        <div className="combined-left">
          <div className="identity-plate">
            <div className="avatar-portal">
              <div className="avatar-frame" onClick={() => avatarInputRef.current?.click()}>
                {profilePicture ? (
                  <img src={profilePicture} alt="User Profile" className="avatar-image" />
                ) : (
                  <div className="avatar-initials">
                    {(stepData.firstName?.[0] || 'U')}{(stepData.lastName?.[0] || 'P')}
                  </div>
                )}
                <div className="avatar-upload-overlay">
                  <i className="fas fa-plus-circle" />
                  <span>{profilePicture ? t('common-edit') : t('common-add')}</span>
                </div>
              </div>
              {profilePicture && (
                <button className="photo-delete-trigger" onClick={(e) => { e.stopPropagation(); onUpdate({ profilePicture: null }); }}>
                  <i className="fas fa-trash-alt" />
                </button>
              )}
              <input ref={avatarInputRef} type="file" hidden accept="image/*" onChange={handleProfilePicture} />
            </div>

            <div className="identity-core">
              <h2>{stepData.firstName && stepData.lastName ? `${stepData.firstName} ${stepData.lastName}` : t('account-setup-step-1-welcome-title')}</h2>
              <p>{stepData.title || t('placeholder_job_title')}</p>
            </div>
          </div>

          <div className="identity-grid">
            {renderInputField('firstName', t('account-setup-step-2-first-name'), 'fa-user-circle', 'text', t('placeholder_first_name'))}
            {renderInputField('lastName', t('account-setup-step-2-last-name'), 'fa-user-circle', 'text', t('placeholder_last_name'))}
            {renderInputField('birthDate', t('account-setup-step-2-birth-date'), 'fa-calendar-alt', 'date')}
            {renderInputField('title', t('account-setup-step-2-professional-title'), 'fa-id-card', 'text', t('placeholder_job_title'))}
            {renderInputField('linkedinUrl', 'LinkedIn URL', 'fa-brands fa-linkedin-in', 'text', 'https://linkedin.com/in/username')}
            {renderInputField('address', t('account-setup-step-2-address'), 'fa-location-dot', 'text', t('placeholder_address'))}
          </div>

          <div className="identity-tags-lab">
            <label className="field-premium-label">
              <i className="fas fa-heart" /> {t('account-setup-step-2-hobbies')}
            </label>
            <div className="tag-input-v2">
              <input
                type="text"
                placeholder={t('account-setup-step-2-add-hobby_placeholder')}
                value={currentHobby}
                onChange={(e) => setCurrentHobby(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddHobby(); } }}
              />
              <button type="button" onClick={handleAddHobby} disabled={hobbies.length >= 3}>
                <i className="fas fa-plus" />
              </button>
            </div>
            {hobbies.length > 0 && (
              <div className="tag-cloud">
                {hobbies.map((h) => (
                  <span key={h.id} className="id-tag">
                    {h.name}
                    <i
                      className="fas fa-times"
                      onClick={() => onUpdate({ hobbies: hobbies.filter((x) => x.id !== h.id) })}
                    />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: CV UPLOAD & AI SCAN */}
        <div className="combined-right">
          <div className="digital-scan-lab">
            <div className="scan-lab-header">
              <div className="lab-orb">
                <i className="fas fa-robot" />
              </div>
              <div className="lab-info">
                <h4>{t('cv_parsing_title')}</h4>
                <p>{t('cv_parsing_subtitle')}</p>
              </div>
            </div>

            {/* Drag-and-drop / file zone */}
            <div
              className={`scan-subject-zone${isDragOver ? ' drag-active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => { if (!selectedFile) fileInputRef.current?.click(); }}
            >
              {!selectedFile ? (
                <div className="scan-init-call">
                  <div className="pulse-circle">
                    <i className="fas fa-upload" />
                  </div>
                  <strong>{t('account-setup-step-1-choose-drag')}</strong>
                  <span>{t('cv_parsing_pdf_only')}</span>
                </div>
              ) : (
                <div className="scan-file-preview" onClick={(e) => e.stopPropagation()}>
                  <div className="preview-type-icon">
                    <i className="fas fa-file-pdf" />
                  </div>
                  <div className="preview-details">
                    <span className="file-name-truncate">
                      {isBrowserFile(selectedFile) ? selectedFile.name : (selectedFile?.name || 'CV.pdf')}
                    </span>
                    {parseSuccess && (
                      <span className="file-success-badge">
                        <i className="fas fa-check-circle" /> {t('cv_parsed_status')}
                      </span>
                    )}
                  </div>
                  <button
                    className="preview-discard"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      onUpdate({ cv: null });
                      setParseSuccess(false);
                      setParseError(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              )}
            </div>

            {/* AI Fill button — shown only when file ready and not yet parsed */}
            {selectedFile && !parseSuccess && !isParsing && (
              <button
                className="initiate-scan-btn"
                type="button"
                onClick={handleParseCV}
              >
                <i className="fas fa-robot" />
                <span>{t('cv_autofill_btn')}</span>
              </button>
            )}

            {/* Success ribbon after parsing */}
            {parseSuccess && (
              <div className="scan-complete-ribbon">
                <i className="fas fa-check-circle" />
                <span>{t('cv_parsing_complete_title')}</span>
                <button
                  type="button"
                  style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.75 }}
                  onClick={() => { setParseSuccess(false); setParseError(null); }}
                >
                  <i className="fas fa-redo" />
                </button>
              </div>
            )}

            {/* Error message */}
            {parseError && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', marginTop: '0.5rem', fontWeight: 600 }}>
                <i className="fas fa-exclamation-circle" style={{ marginRight: '0.4rem' }} />
                {parseError}
              </p>
            )}

            {/* Security notice */}
            <p style={{ fontSize: '0.75rem', color: 'var(--dashboard-muted)', textAlign: 'center', marginTop: 'auto', paddingTop: '0.75rem' }}>
              <i className="fas fa-lock" style={{ marginRight: '0.35rem' }} />
              {t('cv_secure_note')}
            </p>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden-file-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step1;