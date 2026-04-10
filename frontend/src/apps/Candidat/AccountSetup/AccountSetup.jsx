import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AccountSetup.css';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { apiFetch } from '../../../core/api';
import { useLanguage } from '../../../core/useLanguage';
import { supabase } from '../../../core/supabaseClient';
import Step1 from './steps/Step1/Step1';
import Step2 from './steps/Step2/Step2';
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
    return savedStep ? Math.min(Math.max(parseInt(savedStep, 10) || 1, 1), 6) : 1;
  });
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialFormData, ...JSON.parse(saved) } : initialFormData;
  });
  const [submitting, setSubmitting] = useState(false);
  const [isAIParsing, setIsAIParsing] = useState(false);
  const totalSteps = 6;
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const meta = session.user?.user_metadata;
          if (meta) {
            setFormData((prev) => ({
              ...prev,
              firstName: prev.firstName || meta.first_name || '',
              lastName: prev.lastName || meta.last_name || '',
            }));
          }

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
    setFormData((prev) => ({
      ...prev,
      ...stepData
    }));
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
    1: t('account-setup-step-1-title'),
    2: t('account-setup-step-2-title'),
    3: t('account-setup-step-3-title'),
    4: t('account-setup-step-4-title'),
    5: t('account-setup-step-5-title'),
    6: t('account-setup-step-8-title')
  };

  const stepIcons = {
    1: 'fas fa-file-upload',
    2: 'fas fa-user',
    3: 'fas fa-user-check',
    4: 'fas fa-graduation-cap',
    5: 'fas fa-briefcase',
    6: 'fas fa-check-circle'
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Session expired. Please log in again.');
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

      if (isBrowserFile(cv)) {
        payload.append('cv', cv, cv.name);
      }

      (certificates || []).forEach((cert) => {
        const certFile = isBrowserFile(cert.document) ? cert.document : null;
        if (certFile) {
          payload.append(`certificate_file_${cert.id}`, certFile, certFile.name);
        }
      });

      (experiences || []).forEach((exp) => {
        const expFile = isBrowserFile(exp.document) ? exp.document : null;
        if (expFile) {
          payload.append(`experience_file_${exp.id}`, expFile, expFile.name);
        }
      });

      (educations || []).forEach((edu) => {
        const eduFile = isBrowserFile(edu.certificate) ? edu.certificate : null;
        if (eduFile) {
          payload.append(`education_file_${edu.id}`, eduFile, eduFile.name);
        }
      });

      await apiFetch('/candidat/account-setup', {
        method: 'POST',
        body: payload,
      });

      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STEP_KEY);
      navigate('/candidat/dashboard');
    } catch (error) {
      console.error('Account setup submission error:', error);
      alert(error.message || 'An error occurred while saving your profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1 formData={formData} onUpdate={updateFormData} onParsingChange={setIsAIParsing} onUploadDocument={uploadDocument} />;
      case 2:
        return <Step2 formData={formData} onUpdate={updateFormData} />;
      case 3:
        return <Step3 formData={formData} onUpdate={updateFormData} />;
      case 4:
        return <Step4 formData={formData} onUpdate={updateFormData} onUploadDocument={uploadDocument} />;
      case 5:
        return <Step5 formData={formData} onUpdate={updateFormData} onUploadDocument={uploadDocument} />;
      case 6:
        return <Step8 formData={formData} onUpdate={updateFormData} />;
      default:
        return <Step1 formData={formData} onUpdate={updateFormData} onUploadDocument={uploadDocument} />;
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  if (isCheckingStatus) {
    return (
      <div className="account-setup-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>{t('common-loading') || 'Loading...'}</p>
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
          <div className="account-setup-header">
            <i className={`account-setup-header-icon ${stepIcons[currentStep]}`}></i>
            <h1 className="account-setup-title">{stepTitles[currentStep]}</h1>
          </div>

          <div className="account-setup-content">
            {renderStep()}
          </div>

          <div className="account-setup-footer">
            <div className="account-setup-progress">
              <div
                className="account-setup-progress-bar"
                style={{ width: `${progressPercentage}%` }}
              ></div>
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
              <button
                onClick={currentStep === totalSteps ? handleSubmit : handleNext}
                disabled={submitting || isAIParsing}
                className="account-setup-btn next"
                title={isAIParsing ? 'Please wait for AI parsing to complete' : ''}
              >
                <span>{submitting ? t('common-saving') || 'Saving...' : (currentStep === totalSteps ? t('account-setup-step-8-complete') : t('common-next'))}</span>
                <i className={`fas ${submitting ? 'fa-spinner fa-spin' : 'fa-arrow-right'}`}></i>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AccountSetup;
