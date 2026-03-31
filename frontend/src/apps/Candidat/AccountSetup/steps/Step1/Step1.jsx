import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import { apiFetch } from '../../../../../core/api';
import './Step1.css';

const PARSE_STAGES = [
  { icon: 'fa-file-search', label: 'Extracting text from PDF...' },
  { icon: 'fa-broom', label: 'Cleaning and normalising text...' },
  { icon: 'fa-brain', label: 'Sending to AI model...' },
  { icon: 'fa-cogs', label: 'Extracting structured data...' },
  { icon: 'fa-check-double', label: 'Validating extracted data...' },
];

const Step1 = ({ formData = {}, onUpdate = () => { }, onParsingChange = () => { } }) => {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState(formData.cv || null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Cycle through fake stages while parsing
  useEffect(() => {
    if (!isParsing) {
      setStageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStageIndex(prev => (prev < PARSE_STAGES.length - 1 ? prev + 1 : prev));
    }, 3500);
    return () => clearInterval(interval);
  }, [isParsing]);

  const handleParseCV = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    if (selectedFile.type !== 'application/pdf') {
      setParseError('AI parsing currently supports PDF files only.');
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
      setParseError(err.message || 'An error occurred during parsing.');
    } finally {
      setIsParsing(false);
      onParsingChange(false);
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      alert(t('account-setup-step-1-error') || 'Please upload a PDF or Word document.');
      return;
    }
    setSelectedFile(file);
    onUpdate({ cv: file });
    setParseSuccess(false);
    setParseError(null);
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
      {/* AI Parsing Full-Screen Loading Overlay */}
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

            <h3 className="parsing-title">Analysing Your CV</h3>
            <p className="parsing-subtitle">Our AI is reading your resume. This may take 15–60 seconds.</p>

            <div className="parsing-stages">
              {PARSE_STAGES.map((stage, idx) => (
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
              <i className="fas fa-lock" /> Your CV data never leaves our secure server.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="step1-hero">
        <div className="step1-hero-icon">
          <i className="fas fa-file-upload" />
        </div>
        <div className="step1-hero-text">
          <h2 className="step1-hero-title">{t('account-setup-step-1-upload') || 'Upload Your CV'}</h2>
          <p className="step1-hero-desc">
            <i className="fas fa-robot" /> {t('account-setup-step-1-info') || 'Our AI will read your resume and auto-fill your profile in seconds.'}
          </p>
        </div>
      </div>

      {/* Features Row */}
      <div className="step1-features">
        <div className="step1-feature">
          <i className="fas fa-bolt" />
          <span>Instant extraction</span>
        </div>
        <div className="step1-feature">
          <i className="fas fa-shield-alt" />
          <span>Secure & private</span>
        </div>
        <div className="step1-feature">
          <i className="fas fa-edit" />
          <span>Fully editable</span>
        </div>
      </div>

      {/* Drop Zone */}
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
            <p className="step1-drop-primary">{t('account-setup-step-1-choose-drag') || 'Drop your CV here or click to browse'}</p>
            <p className="step1-drop-secondary">{t('account-setup-step-1-formats') || 'Supported upload: PDF, DOC, DOCX - AI auto-fill: PDF only'}</p>
            <div className="step1-browse-btn">
              <i className="fas fa-folder-open" /> Browse Files
            </div>
          </label>
        ) : (
          <div className="step1-file-card">
            <div className="step1-file-icon-wrap">
              <i className="fas fa-file-pdf" />
            </div>
            <div className="step1-file-meta">
              <span className="step1-file-name">{selectedFile.name}</span>
              <span className="step1-file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
            </div>
            {parseSuccess && (
              <div className="step1-file-badge success">
                <i className="fas fa-check-circle" /> Parsed
              </div>
            )}
            <button type="button" onClick={handleRemoveFile} className="step1-file-remove" title="Remove file">
              <i className="fas fa-times" />
            </button>
          </div>
        )}
        <input type="file" id="cv-upload" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="cv-upload-input" />
      </div>

      {/* AI Parse Button + Feedback */}
      {selectedFile && !isParsing && (
        <div className="step1-ai-section">
          {!parseSuccess ? (
            <button
              type="button"
              className="step1-ai-btn"
              onClick={handleParseCV}
              disabled={isParsing}
            >
              <i className="fas fa-robot" />
              <span>Auto-fill with AI</span>
              <div className="step1-ai-btn-shine" />
            </button>
          ) : (
            <div className="step1-success-banner">
              <div className="step1-success-icon"><i className="fas fa-check-circle" /></div>
              <div className="step1-success-text">
                <strong>AI parsing complete!</strong>
                <span>Your profile has been pre-filled. Review and adjust in the next steps.</span>
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
              <i className="fas fa-info-circle" /> You can also skip this and fill in your details manually.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Step1;
