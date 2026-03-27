import React, { useState, useEffect, useRef } from 'react';
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
import Step6 from './steps/Step6/Step6';
import Step7 from './steps/Step7/Step7';
import Step8 from './steps/Step8/Step8';

const STORAGE_KEY = 'candidat-account-setup-data';
const STEP_KEY = 'candidat-account-setup-step';

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
    return savedStep ? Math.min(Math.max(parseInt(savedStep, 10) || 1, 1), 8) : 1;
  });
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialFormData, ...JSON.parse(saved) } : initialFormData;
  });
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef({ cv: null, certFiles: {}, expFiles: {}, eduFiles: {} });
  const [isAIParsing, setIsAIParsing] = useState(false);
  const totalSteps = 8;
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Check if profile is already set up
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Pre-fill first/last name from signup metadata if not already set
          const meta = session.user?.user_metadata;
          if (meta) {
            setFormData(prev => ({
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

  // Save form data to localStorage whenever it changes (strip File objects)
  useEffect(() => {
    const { cv, certificates, experiences, educations, ...rest } = formData;
    const serializable = {
      ...rest,
      cv: null,
      certificates: (certificates || []).map(({ document, ...c }) => ({ ...c, document: null })),
      experiences: (experiences || []).map(({ document, ...e }) => ({ ...e, document: null })),
      educations: (educations || []).map(({ certificate, ...ed }) => ({ ...ed, certificate: null })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }, [formData]);

  // Save current step to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(currentStep));
  }, [currentStep]);

  if (isCheckingStatus) {
    return (
      <div className="account-setup-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>{t('common-loading') || 'Loading...'}</p>
      </div>
    );
  }

  const updateFormData = (stepData) => {
    // Capture File objects in a ref so they survive localStorage round-trips
    if (stepData.cv instanceof File) {
      fileRef.current.cv = stepData.cv;
    }
    if (stepData.certificates) {
      stepData.certificates.forEach(cert => {
        if (cert.document instanceof File) {
          fileRef.current.certFiles[cert.id] = cert.document;
        }
      });
    }
    if (stepData.experiences) {
      stepData.experiences.forEach(exp => {
        if (exp.document instanceof File) {
          fileRef.current.expFiles[exp.id] = exp.document;
        }
      });
    }
    if (stepData.educations) {
      stepData.educations.forEach(edu => {
        if (edu.certificate instanceof File) {
          fileRef.current.eduFiles[edu.id] = edu.certificate;
        }
      });
    }
    setFormData(prev => ({
      ...prev,
      ...stepData
    }));
  };

  const stepTitles = {
    1: t('account-setup-step-1-title'),
    2: t('account-setup-step-2-title'),
    3: t('account-setup-step-3-title'),
    4: t('account-setup-step-4-title'),
    5: t('account-setup-step-5-title'),
    6: t('account-setup-step-6-title'),
    7: t('account-setup-step-7-title'),
    8: t('account-setup-step-8-title')
  };

  const stepIcons = {
    1: 'fas fa-file-upload',
    2: 'fas fa-user',
    3: 'fas fa-user-check',
    4: 'fas fa-graduation-cap',
    5: 'fas fa-briefcase',
    6: 'fas fa-certificate',
    7: 'fas fa-sliders-h',
    8: 'fas fa-check-circle'
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
      // Get the current Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Session expired. Please log in again.');
        navigate('/candidat/login');
        return;
      }

      // Build FormData with JSON payload + optional CV file + certificate/experience docs
      const payload = new FormData();

      // Separate the cv from the rest of the form data
      const { cv, certificates, experiences, educations, ...rest } = formData;

      // Strip File objects out of certificates — keep only serialisable fields
      const certsMeta = (certificates || []).map(cert => {
        const { document, documentName, ...certRest } = cert;
        return certRest;
      });

      // Strip File objects out of experiences — keep only serialisable fields
      const expsMeta = (experiences || []).map(exp => {
        const { document, documentName, ...expRest } = exp;
        return expRest;
      });

      // Strip File objects out of educations — keep only serialisable fields
      const edusMeta = (educations || []).map(edu => {
        const { certificate, ...eduRest } = edu;
        return eduRest;
      });

      payload.append('data', JSON.stringify({ ...rest, certificates: certsMeta, experiences: expsMeta, educations: edusMeta }));

      // Use fileRef as primary source (survives localStorage round-trips)
      const cvFile = fileRef.current.cv || (cv instanceof File ? cv : null);
      if (cvFile) {
        payload.append('cv', cvFile);
      }

      // Append certificate document files individually
      (certificates || []).forEach(cert => {
        const certFile = fileRef.current.certFiles[cert.id] || (cert.document instanceof File ? cert.document : null);
        if (certFile) {
          payload.append(`certificate_file_${cert.id}`, certFile, certFile.name);
        }
      });

      // Append experience document files individually
      (experiences || []).forEach(exp => {
        const expFile = fileRef.current.expFiles[exp.id] || (exp.document instanceof File ? exp.document : null);
        if (expFile) {
          payload.append(`experience_file_${exp.id}`, expFile, expFile.name);
        }
      });

      // Append education certificate files individually
      (educations || []).forEach(edu => {
        const eduFile = fileRef.current.eduFiles[edu.id] || (edu.certificate instanceof File ? edu.certificate : null);
        if (eduFile) {
          payload.append(`education_file_${edu.id}`, eduFile, eduFile.name);
        }
      });

      await apiFetch('/candidat/account-setup', {
        method: 'POST',
        body: payload,
      });

      // Clear saved form data on success
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STEP_KEY);

      // Navigate to the candidate dashboard
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
        return <Step1 formData={formData} onUpdate={updateFormData} onParsingChange={setIsAIParsing} />;
      case 2:
        return <Step2 formData={formData} onUpdate={updateFormData} />;
      case 3:
        return <Step3 formData={formData} onUpdate={updateFormData} />;
      case 4:
        return <Step4 formData={formData} onUpdate={updateFormData} />;
      case 5:
        return <Step5 formData={formData} onUpdate={updateFormData} />;
      case 6:
        return <Step6 formData={formData} onUpdate={updateFormData} />;
      case 7:
        return <Step7 formData={formData} onUpdate={updateFormData} />;
      case 8:
        return <Step8 formData={formData} onUpdate={updateFormData} />;
      default:
        return <Step1 formData={formData} onUpdate={updateFormData} />;
    }
  };
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="account-setup-page">
      <div className="account-setup-controls">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <main className="account-setup-main">
        <div className="account-setup-container">
          {/* Header */}
          <div className="account-setup-header">
            <i className={`account-setup-header-icon ${stepIcons[currentStep]}`}></i>
            <h1 className="account-setup-title">{stepTitles[currentStep]}</h1>
          </div>

          {/* Content Area */}
          <div className="account-setup-content">
            {renderStep()}
          </div>

          {/* Footer with Progress Bar and Navigation */}
          <div className="account-setup-footer">
            {/* Progress Bar */}
            <div className="account-setup-progress">
              <div
                className="account-setup-progress-bar"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>

            {/* Navigation Buttons */}
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
