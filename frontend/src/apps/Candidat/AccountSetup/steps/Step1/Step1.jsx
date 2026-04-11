import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import { apiFetch } from '../../../../../core/api';
import './Step1.css';

const PARSE_STAGES = (t) => [
  { icon: 'fa-file-search', label: t('cv_parsing_stage_1') },
  { icon: 'fa-broom', label: t('cv_parsing_stage_2') },
  { icon: 'fa-brain', label: t('cv_parsing_stage_3') },
  { icon: 'fa-cogs', label: t('cv_parsing_stage_4') },
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

  useEffect(() => {
    if (!isParsing) {
      setStageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev < PARSE_STAGES(t).length - 1 ? prev + 1 : prev));
    }, 3500);
    return () => clearInterval(interval);
  }, [isParsing]);

  useEffect(() => {
    if (!isBrowserFile(selectedFile)) {
      setSelectedFile(formData.cv || null);
    }
  }, [formData.cv, selectedFile]);

  const handleParseCV = async (e) => {
    e.preventDefault();
    if (!selectedFile || !isBrowserFile(selectedFile)) return;
    if (selectedFile.type !== 'application/pdf') {
      setParseError(t('cv_parsing_pdf_only'));
      return;
    }
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
        hobbies: parsedData.hobbies || formData.hobbies || [],
        skills: parsedData.skills || formData.skills || [],
        languages: parsedData.languages || formData.languages || [],
        educations: parsedData.educations || formData.educations || [],
        experiences: parsedData.experiences || formData.experiences || [],
        certificates: parsedData.certificates || formData.certificates || [],
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

  const handleFileChange = (e) => handleFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleRemoveFile = (e) => {
    e.preventDefault();
    setSelectedFile(null);
    onUpdate({ cv: null });
    setParseSuccess(false);
    setParseError(null);
    const fileInput = document.getElementById('cv-upload');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="step1-wrapper">
      {isParsing && (
        <div className="parsing-overlay">
          <div className="parsing-modal">
            <div className="parsing-brain-anim">
              <div className="parsing-rings">
                <div className="parsing-ring ring-1" />
                <div className="parsing-ring ring-2" />
                <div className="parsing-ring ring-3" />
              </div>
              <i className="fas fa-brain parsing-brain-icon" />
            </div>

            <h3 className="parsing-title">{t('cv_parsing_title')}</h3>
            <p className="parsing-subtitle">{t('cv_parsing_subtitle')}</p>

            <div className="parsing-stages">
              {PARSE_STAGES(t).map((stage, idx) => (
                <div
                  key={idx}
                  className={`parsing-stage ${idx < stageIndex ? 'done' : idx === stageIndex ? 'active' : 'pending'}`}
                >
                  <div className="parsing-stage-icon">
                    {idx < stageIndex
                      ? <i className="fas fa-check" />
                      : idx === stageIndex
                        ? <i className={`fas ${stage.icon} fa-pulse`} />
                        : <i className={`fas ${stage.icon}`} />
                    }
                  </div>
                  <span className="parsing-stage-label">{stage.label}</span>
                  {idx === stageIndex && <div className="parsing-stage-bar"><div className="parsing-stage-fill" /></div>}
                </div>
              ))}
            </div>

            <p className="parsing-note">
              <i className="fas fa-lock" /> {t('cv_secure_note')}
            </p>
          </div>
        </div>
      )}

      <section className="step1-upload-section">
        <div className="step1-upload-header">
          <div className="step1-upload-copy">
            <h3>{t('account-setup-step-1-upload')}</h3>
            <p>{t('account-setup-step-1-info')}</p>
          </div>
        </div>

        <div
          className={`step1-dropzone ${isDragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {!selectedFile ? (
            <label htmlFor="cv-upload" className="step1-dropzone-inner">
              <div className="step1-drop-icon">
                <i className="fas fa-cloud-upload-alt" />
              </div>
              <p className="step1-drop-primary">{t('account-setup-step-1-choose-drag')}</p>
              <p className="step1-drop-secondary">{t('account-setup-step-1-formats')}</p>
              <div className="step1-browse-btn">
                <i className="fas fa-folder-open" /> {t('account-setup-step-1-browse')}
              </div>
            </label>
          ) : (
            <div className="step1-file-card">
              <div className="step1-file-icon-wrap">
                <i className="fas fa-file-pdf" />
              </div>
              <div className="step1-file-meta">
                <span className="step1-file-name">{selectedFile?.name || selectedFile?.filename}</span>
                <span className="step1-file-size">
                  {selectedFile?.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
                </span>
              </div>
              {parseSuccess && (
                <div className="step1-file-badge success">
                  <i className="fas fa-check-circle" /> {t('cv_parsed_status')}
                </div>
              )}
              <button type="button" onClick={handleRemoveFile} className="step1-file-remove" title="Remove file">
                <i className="fas fa-times" />
              </button>
            </div>
          )}
          <input type="file" id="cv-upload" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="cv-upload-input" />
        </div>

        {selectedFile && isBrowserFile(selectedFile) && !isParsing && (
          <div className="step1-ai-section">
            {!parseSuccess ? (
              <button
                type="button"
                className="step1-ai-btn"
                onClick={handleParseCV}
                disabled={isParsing}
              >
                <i className="fas fa-robot" />
                <span>{t('cv_autofill_btn')}</span>
                <div className="step1-ai-btn-shine" />
              </button>
            ) : (
              <div className="step1-success-banner">
                <div className="step1-success-icon"><i className="fas fa-check-circle" /></div>
                <div className="step1-success-text">
                  <strong>{t('cv_parsing_complete_title')}</strong>
                  <span>{t('cv_parsing_complete_desc')}</span>
                </div>
                <button type="button" className="step1-reparse-btn" onClick={handleParseCV}>
                  <i className="fas fa-redo" />
                </button>
              </div>
            )}

            {parseError && (
              <div className="step1-error-banner">
                <i className="fas fa-exclamation-triangle" />
                <span>{parseError}</span>
              </div>
            )}

            {!parseSuccess && (
              <p className="step1-ai-hint">
                <i className="fas fa-info-circle" /> {t('cv_parsing_skip_hint')}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default Step1;
