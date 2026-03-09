import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step7.css';

const Step7 = ({ formData = {}, onUpdate = () => { } }) => {
  const { t } = useLanguage();
  const preferences = formData.jobPreferences || {};

  // Safe extraction with fallbacks to avoid uncontrolled component warnings
  const jobType = preferences.jobType || (preferences.jobTypes && preferences.jobTypes[0]) || '';
  const workLoc = preferences.workLocation || '';
  const salary = preferences.salaryExpectation || '';
  const avail = preferences.availability || '';
  const industry = preferences.preferredIndustries || '';
  // Handle both willRelocate and willingToRelocate for compatibility
  const willingToRelocate = preferences.willingToRelocate !== undefined ? preferences.willingToRelocate : (preferences.willRelocate || false);

  const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];
  const workLocations = ['On-site', 'Remote', 'Hybrid'];
  const industries = ['Technology', 'Finance', 'Healthcare', 'Education', 'Marketing', 'Sales', 'Engineering', 'Design', 'Other'];
  const salaryRanges = [
    '$30,000 - $50,000',
    '$50,000 - $70,000',
    '$70,000 - $100,000',
    '$100,000 - $150,000',
    '$150,000+'
  ];

  const handleInputChange = (field, value) => {
    const newPreferences = { ...preferences, [field]: value };
    onUpdate({ jobPreferences: newPreferences });
  };

  return (
    <div className="setup-step-form step7-wrapper">
      <div className="setup-step-form-content">
        <div className="preferences-input-section">
          <div className="preferences-form-grid">
            {/* Job Type */}
            <div className="preferences-form-group full-width">
              <label className="preferences-form-label">{t('account-setup-step-7-job-types')}</label>
              <select
                value={jobType}
                onChange={(e) => handleInputChange('jobType', e.target.value)}
                className="preferences-form-select"
              >
                <option value="">{t('account-setup-step-7-job-types')}</option>
                <option value="fullTime">{t('account-setup-step-7-full-time')}</option>
                <option value="partTime">{t('account-setup-step-7-part-time')}</option>
                <option value="contract">{t('account-setup-step-7-contract')}</option>
                <option value="freelance">{t('account-setup-step-7-freelance')}</option>
                <option value="internship">{t('account-setup-step-7-internship')}</option>
              </select>
            </div>

            {/* Work Location */}
            <div className="preferences-form-group full-width">
              <label className="preferences-form-label">{t('account-setup-step-7-location-flexibility')}</label>
              <select
                value={workLoc}
                onChange={(e) => handleInputChange('workLocation', e.target.value)}
                className="preferences-form-select"
              >
                <option value="">{t('account-setup-step-7-location-flexibility')}</option>
                <option value="onSite">{t('account-setup-step-7-on-site')}</option>
                <option value="remote">{t('account-setup-step-7-remote')}</option>
                <option value="hybrid">{t('account-setup-step-7-hybrid')}</option>
              </select>
            </div>

            {/* Salary Expectation */}
            <div className="preferences-form-group full-width">
              <label className="preferences-form-label">{t('account-setup-step-7-salary-expectation')}</label>
              <select
                value={salary}
                onChange={(e) => handleInputChange('salaryExpectation', e.target.value)}
                className="preferences-form-select"
              >
                <option value="">{t('account-setup-step-7-salary-expectation')}</option>
                <option value="$30,000 - $50,000">$30,000 - $50,000</option>
                <option value="$50,000 - $70,000">$50,000 - $70,000</option>
                <option value="$70,000 - $100,000">$70,000 - $100,000</option>
                <option value="$100,000 - $150,000">$100,000 - $150,000</option>
                <option value="$150,000+">$150,000+</option>
              </select>
            </div>

            {/* Availability */}
            <div className="preferences-form-group full-width">
              <label className="preferences-form-label">{t('account-setup-step-7-availability')}</label>
              <select
                value={avail}
                onChange={(e) => handleInputChange('availability', e.target.value)}
                className="preferences-form-select"
              >
                <option value="">{t('account-setup-step-7-availability')}</option>
                <option value="immediate">{t('account-setup-step-7-immediately')}</option>
                <option value="2weeks">{t('account-setup-step-7-2-weeks')}</option>
                <option value="1month">{t('account-setup-step-7-1-month')}</option>
                <option value="2months">{t('account-setup-step-7-2-months')}</option>
                <option value="3months">{t('account-setup-step-7-3-months-plus')}</option>
              </select>
            </div>

            {/* Preferred Industries */}
            <div className="preferences-form-group full-width">
              <label className="preferences-form-label">{t('account-setup-step-7-preferred-industries')}</label>
              <select
                value={industry}
                onChange={(e) => handleInputChange('preferredIndustries', e.target.value)}
                className="preferences-form-select"
              >
                <option value="">{t('account-setup-step-7-select-industry')}</option>
                {industries.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            {/* Willing to Relocate */}
            <div className="preferences-form-group full-width">
              <label className="preferences-checkbox-label">
                <input
                  type="checkbox"
                  checked={willingToRelocate}
                  onChange={(e) => handleInputChange('willingToRelocate', e.target.checked)}
                  className="preferences-checkbox"
                />
                <span>{t('account-setup-step-7-willing-to-relocate')}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step7;
