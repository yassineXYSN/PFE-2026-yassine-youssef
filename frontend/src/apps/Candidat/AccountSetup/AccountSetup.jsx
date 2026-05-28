import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AccountSetup.css';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { apiFetch } from '../../../core/api';
import { useLanguage } from '../../../core/useLanguage';
import { supabase } from '../../../core/supabaseClient';
import Step1 from './steps/Step1/Step1';
import Step3 from './steps/Step3/Step3';
import Step4 from './steps/Step4/Step4';
import Step5 from './steps/Step5/Step5';
import Step8 from './steps/Step8/Step8';

const STORAGE_KEY = 'candidat-account-setup-data';
const STEP_KEY = 'candidat-account-setup-step';

const isBrowserFile = (value) => typeof File !== 'undefined' && value instanceof File;

const getDocumentName = (value) => {
  if (!value) return '';
  return value.filename || value.name || '';
};

const serialiseDocument = (value) => (value && !isBrowserFile(value) ? value : null);

const initialFormData = {
  cv: null,
  firstName: '',
  lastName: '',
  birthDate: '',
  title: '',
  address: '',
  linkedinUrl: '',
  profilePicture: null,
  hobbies: [],
  skills: [],
  languages: [],
  educations: [],
  experiences: [],
  certificates: [],
  jobPreferences: {
    jobTypes: '',
    workLocation: '',
    salaryExpectation: '',
    availability: '',
    preferredIndustries: '',
    willRelocate: false
  }
};

const AccountSetup = () => {
  const [currentStep, setCurrentStep] = useState(() => {
    const savedStep = localStorage.getItem(STEP_KEY);
    return savedStep ? Math.min(Math.max(parseInt(savedStep, 10) || 1, 1), 5) : 1;
  });
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialFormData;
    const parsed = JSON.parse(saved);
    const withIds = (arr) => (arr || []).map((item) => item.id ? item : { ...item, id: crypto.randomUUID() });
    return {
      ...initialFormData,
      ...parsed,
      hobbies: withIds(parsed.hobbies),
      skills: withIds(parsed.skills),
      languages: withIds(parsed.languages),
      educations: withIds(parsed.educations),
      experiences: withIds(parsed.experiences),
      certificates: withIds(parsed.certificates),
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [isAIParsing, setIsAIParsing] = useState(false);
  const totalSteps = 5;
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const meta = session.user?.user_metadata || {};
          const userId = session.user?.id || '';

          // Derive first/last name from provider metadata (Google/LinkedIn use
          // given_name/family_name; GitHub only gives full_name).
          const firstName =
            meta.first_name || meta.given_name ||
            (meta.full_name ? meta.full_name.split(' ')[0] : '') || '';
          const lastName =
            meta.last_name || meta.family_name ||
            (meta.full_name ? meta.full_name.split(' ').slice(1).join(' ') : '') || '';

          // OAuth providers expose avatar_url; email signups fall back to DiceBear.
          const oauthAvatar = meta.avatar_url || meta.picture || '';
          const fallbackAvatar = `https://api.dicebear.com/9.x/avataaars/svg?seed=${userId}`;

          setFormData((prev) => ({
            ...prev,
            firstName: prev.firstName || firstName,
            lastName: prev.lastName || lastName,
            profilePicture: prev.profilePicture || oauthAvatar || fallbackAvatar,
          }));

          const result = await apiFetch('/candidat/account-setup/status');
          if (result.is_setup_completed) {
            navigate('/candidat/dashboard', { replace: true });
            return;
          }
        }
      } catch (error) {
        console.error('Error checking account setup status:', error);
      } finally {
        setIsCheckingStatus(false);
      }
    };
    checkSetupStatus();
  }, [navigate]);

  useEffect(() => {
    const { cv, certificates, experiences, educations, ...rest } = formData;
    const serializable = {
      ...rest,
      cv: serialiseDocument(cv),
      certificates: (certificates || []).map((cert) => ({
        ...cert,
        document: serialiseDocument(cert.document),
        documentName: cert.documentName || getDocumentName(cert.document)
      })),
      experiences: (experiences || []).map((exp) => ({
        ...exp,
        document: serialiseDocument(exp.document),
        documentName: exp.documentName || getDocumentName(exp.document)
      })),
      educations: (educations || []).map((edu) => ({
        ...edu,
        certificate: serialiseDocument(edu.certificate),
        certificateName: edu.certificateName || getDocumentName(edu.certificate)
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(currentStep));
  }, [currentStep]);

  const updateFormData = (stepData) => {
    setFormData((prev) => ({ ...prev, ...stepData }));
  };

  const uploadDocument = async (file) => {
    const payload = new FormData();
    payload.append('file', file, file.name);
    return apiFetch('/candidat/profile/upload-document', {
      method: 'POST',
      body: payload,
    });
  };

  const stepTitles = {
    1: t('account-setup-step-1-title') + ' & ' + t('account-setup-step-2-title'),
    2: t('account-setup-step-3-title'),
    3: t('account-setup-step-4-title'),
    4: t('account-setup-step-5-title'),
    5: t('account-setup-step-8-title')
  };

  const stepIcons = {
    1: 'fas fa-user-tie',
    2: 'fas fa-user-check',
    3: 'fas fa-graduation-cap',
    4: 'fas fa-briefcase',
    5: 'fas fa-check-circle'
  };

  const handleNext = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert(t('error_session_expired'));
        navigate('/candidat/login');
        return;
      }

      const payload = new FormData();
      const { cv, certificates, experiences, educations, ...rest } = formData;

      const certsMeta = (certificates || []).map((cert) => ({
        ...cert,
        document: serialiseDocument(cert.document),
        documentName: cert.documentName || getDocumentName(cert.document)
      }));
      const expsMeta = (experiences || []).map((exp) => ({
        ...exp,
        document: serialiseDocument(exp.document),
        documentName: exp.documentName || getDocumentName(exp.document)
      }));
      const edusMeta = (educations || []).map((edu) => ({
        ...edu,
        certificate: serialiseDocument(edu.certificate),
        certificateName: edu.certificateName || getDocumentName(edu.certificate)
      }));

      payload.append('data', JSON.stringify({
        ...rest,
        cv: serialiseDocument(cv),
        certificates: certsMeta,
        experiences: expsMeta,
        educations: edusMeta
      }));

      if (isBrowserFile(cv)) payload.append('cv', cv, cv.name);

      (certificates || []).forEach((cert) => {
        if (isBrowserFile(cert.document))
          payload.append(`certificate_file_${cert.id}`, cert.document, cert.document.name);
      });
      (experiences || []).forEach((exp) => {
        if (isBrowserFile(exp.document))
          payload.append(`experience_file_${exp.id}`, exp.document, exp.document.name);
      });
      (educations || []).forEach((edu) => {
        if (isBrowserFile(edu.certificate))
          payload.append(`education_file_${edu.id}`, edu.certificate, edu.certificate.name);
      });

      await apiFetch('/candidat/account-setup', { method: 'POST', body: payload });

      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STEP_KEY);
      navigate('/candidat/dashboard');
    } catch (error) {
      console.error('Account setup submission error:', error);
      alert(error.message || t('error_saving_profile'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <Step1 formData={formData} onUpdate={updateFormData} onParsingChange={setIsAIParsing} onUploadDocument={uploadDocument} />;
      case 2: return <Step3 formData={formData} onUpdate={updateFormData} />;
      case 3: return <Step4 formData={formData} onUpdate={updateFormData} onUploadDocument={uploadDocument} />;
      case 4: return <Step5 formData={formData} onUpdate={updateFormData} onUploadDocument={uploadDocument} />;
      case 5: return <Step8 formData={formData} onUpdate={updateFormData} />;
      default: return <Step1 formData={formData} onUpdate={updateFormData} onUploadDocument={uploadDocument} />;
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  if (isCheckingStatus) {
    return (
      <div className="account-setup-page">
        <div className="setup-loading-state">
          <i className="fas fa-spinner fa-spin"></i>
          <span>{t('common-loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="account-setup-page">
      <div className="account-setup-controls">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <main className="account-setup-main">
        <div className="account-setup-container">

          {/* ── SIDEBAR ── */}
          <aside className="setup-sidebar">
            <div className="setup-sidebar-brand">
              <div className="setup-sidebar-logo">
                <i className="fas fa-brain"></i>
              </div>
              <span className="setup-sidebar-brand-name">HumatiQ AI</span>
            </div>

            <p className="setup-sidebar-section-label">Profile Setup</p>

            <nav className="setup-sidebar-nav">
              {Object.keys(stepTitles).map((key) => {
                const step = Number(key);
                const isActive = step === currentStep;
                const isDone = step < currentStep;
                return (
                  <div
                    key={step}
                    className={`setup-sidebar-item${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
                  >
                    <div className="setup-sidebar-item-track">
                      <div className="setup-sidebar-bullet">
                        {isDone
                          ? <i className="fas fa-check"></i>
                          : <span>{step}</span>
                        }
                      </div>
                      {step < totalSteps && <div className="setup-sidebar-line" />}
                    </div>
                    <span className="setup-sidebar-item-label">{stepTitles[step]}</span>
                  </div>
                );
              })}
            </nav>

            <div className="setup-sidebar-bottom">
              <div className="setup-sidebar-progress-track">
                <div
                  className="setup-sidebar-progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="setup-sidebar-progress-label">
                {Math.round(progressPercentage)}% complete
              </span>
            </div>
          </aside>

          {/* ── RIGHT PANEL ── */}
          <div className="setup-right-panel">

            {/* Mobile step bubbles — hidden on desktop */}
            <div className="setup-mobile-steps">
              {Object.keys(stepTitles).map((key, idx, arr) => {
                const step = Number(key);
                const isActive = step === currentStep;
                const isDone = step < currentStep;
                return (
                  <React.Fragment key={step}>
                    <div className={`setup-mobile-bubble${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}>
                      {isDone ? <i className="fas fa-check"></i> : step}
                    </div>
                    {idx < arr.length - 1 && (
                      <div className={`setup-mobile-connector${isDone ? ' done' : ''}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Header */}
            <div className="account-setup-header">
              <div className="setup-header-icon-box">
                <i className={stepIcons[currentStep]}></i>
              </div>
              <div className="setup-header-text">
                <span className="setup-step-counter">Step {currentStep} of {totalSteps}</span>
                <h1 className="account-setup-title">{stepTitles[currentStep]}</h1>
              </div>
            </div>

            {/* Step content */}
            <div className="account-setup-content">
              {renderStep()}
            </div>

            {/* Footer */}
            <div className="account-setup-footer">
              {/* Mobile-only progress bar */}
              <div className="setup-mobile-progress">
                <div
                  className="setup-mobile-progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              <div className="account-setup-navigation">
                <button
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className="account-setup-btn back"
                >
                  <i className="fas fa-arrow-left"></i>
                  <span>{t('common-previous')}</span>
                </button>

                <div className="setup-footer-dots">
                  {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                    <div
                      key={step}
                      className={`setup-footer-dot${step === currentStep ? ' active' : step < currentStep ? ' done' : ''}`}
                    />
                  ))}
                </div>

                <button
                  onClick={currentStep === totalSteps ? handleSubmit : handleNext}
                  disabled={submitting || isAIParsing}
                  className="account-setup-btn next"
                  title={isAIParsing ? t('wait_ai_parsing') : ''}
                >
                  <span>
                    {submitting
                      ? t('common-saving')
                      : currentStep === totalSteps
                      ? t('account-setup-step-8-complete')
                      : t('common-next')}
                  </span>
                  <i className={`fas ${submitting ? 'fa-spinner fa-spin' : 'fa-arrow-right'}`}></i>
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default AccountSetup;
