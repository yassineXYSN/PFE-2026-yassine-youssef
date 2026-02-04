import React from 'react';
import './Step1.css';

const Step1 = () => {
  return (
    <div className="setup-step">
      <div className="setup-step-icon">
        <i className="fas fa-user-circle"></i>
      </div>
      <h2 className="setup-step-title">Step 1</h2>
      <p className="setup-step-description">
        This is the first step of the account setup process.
      </p>
    </div>
  );
};

export default Step1;
