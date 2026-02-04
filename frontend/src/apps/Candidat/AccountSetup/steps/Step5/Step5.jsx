import React from 'react';
import '../Step1/Step1.css';

const Step5 = () => {
  return (
    <div className="setup-step">
      <div className="setup-step-icon">
        <i className="fas fa-check-circle"></i>
      </div>
      <h2 className="setup-step-title">Step 5</h2>
      <p className="setup-step-description">
        This is the final step of the account setup process.
      </p>
    </div>
  );
};

export default Step5;
