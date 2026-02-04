import React, { useState } from 'react';
import './AccountSetup.css';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import Step1 from './steps/Step1/Step1';
import Step2 from './steps/Step2/Step2';
import Step3 from './steps/Step3/Step3';
import Step4 from './steps/Step4/Step4';
import Step5 from './steps/Step5/Step5';

const AccountSetup = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const stepTitles = {
    1: 'Personal Information',
    2: 'Work Experience',
    3: 'Education',
    4: 'Resume Upload',
    5: 'Review & Complete'
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
        return <Step1 />;
      case 2:
        return <Step2 />;
      case 3:
        return <Step3 />;
      case 4:
        return <Step4 />;
      case 5:
        return <Step5 />;
      default:
        return <Step1 />;
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="account-setup-page">
      <div className="account-setup-theme-toggle">
        <ThemeToggle />
      </div>

      <main className="account-setup-main">
        <div className="account-setup-container">
          {/* Header */}
          <div className="account-setup-header">
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
                <span>Back</span>
              </button>
              <button
                onClick={handleNext}
                disabled={currentStep === totalSteps}
                className="account-setup-btn next"
              >
                <span>{currentStep === totalSteps ? 'Finish' : 'Next'}</span>
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
