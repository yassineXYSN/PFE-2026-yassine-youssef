import React, { useState, useEffect } from 'react';
import './AccountSetup.css';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import Step1 from './steps/Step1/Step1';
import Step2 from './steps/Step2/Step2';
import Step3 from './steps/Step3/Step3';
import Step4 from './steps/Step4/Step4';
import Step5 from './steps/Step5/Step5';
import Step6 from './steps/Step6/Step6';
import Step7 from './steps/Step7/Step7';
import Step8 from './steps/Step8/Step8';

const STORAGE_KEY = 'candidat-account-setup-data';

const initialFormData = {
  cv: null,
  firstName: '',
  lastName: '',
  birthDate: '',
  title: '',
  address: '',
  linkedinUrl: '',
  hobbies: [],
  skills: [],
  languages: [],
  educations: [],
  experiences: [],
  certificates: [],
  jobPreferences: {
    jobTypes: [],
    workLocation: [],
    salaryExpectation: '',
    availability: '',
    preferredIndustries: [],
    willRelocate: false
  }
};

const AccountSetup = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialFormData, ...JSON.parse(saved) } : initialFormData;
  });
  const totalSteps = 8;
  const { t } = useLanguage();

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const updateFormData = (stepData) => {
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

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1 formData={formData} onUpdate={updateFormData} />;
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
                onClick={handleNext}
                disabled={currentStep === totalSteps}
                className="account-setup-btn next"
              >
                <span>{currentStep === totalSteps ? t('account-setup-step-8-complete') : t('common-next')}</span>
                <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AccountSetup;
