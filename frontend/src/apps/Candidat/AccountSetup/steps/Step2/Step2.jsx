import React from 'react';
import '../Step1/Step1.css';

const Step2 = () => {
  return (
    <div className="setup-step">
      <div className="setup-step-icon">
        <i className="fas fa-briefcase"></i>
      </div>
      <h2 className="setup-step-title">Step 2</h2>
      <p className="setup-step-description">
        This is the second step of the account setup process.
      </p>
    </div>
  );
};

export default Step2;
