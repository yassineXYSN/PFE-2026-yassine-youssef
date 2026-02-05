import React from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step8.css';

const Step8 = ({ formData = {} }) => {
  const { t } = useLanguage();

  // Calculate age from birth date
  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Calculate total years of experience
  const calculateExperienceYears = (experiences) => {
    if (!experiences || experiences.length === 0) return 0;
    let totalYears = 0;
    const currentYear = new Date().getFullYear();
    experiences.forEach(exp => {
      const startYear = parseInt(exp.startYear) || 0;
      const endYear = exp.ongoing ? currentYear : (parseInt(exp.endYear) || 0);
      totalYears += Math.max(0, endYear - startYear);
    });
    return totalYears;
  };

  const age = calculateAge(formData.birthDate);
  const totalExperienceYears = calculateExperienceYears(formData.experiences);
  const experiences = formData.experiences || [];
  const skills = formData.skills || [];
  const educations = formData.educations || [];
  const certificates = formData.certificates || [];

  return (
    <div className="setup-step-form step8-wrapper">
      <div className="setup-step-form-header">
        <i className="setup-step-icon fas fa-check-circle"></i>
      </div>

      <div className="setup-step-form-content">
        <div className="review-container">
          <div className="review-grid parent">
            <div className="review-info-item div1">
              <div className="review-info-icon"><i className="fas fa-id-badge"></i></div>
              <div className="review-info-content">
                <div className="review-info-label">{t('account-setup-step-2-first-name')}</div>
                <div className="review-info-value">{formData.firstName || '—'}</div>
              </div>
            </div>
            <div className="review-info-item div2">
              <div className="review-info-icon"><i className="fas fa-id-badge"></i></div>
              <div className="review-info-content">
                <div className="review-info-label">{t('account-setup-step-2-last-name')}</div>
                <div className="review-info-value">{formData.lastName || '—'}</div>
              </div>
            </div>
            <div className="review-info-item div3">
              <div className="review-info-icon"><i className="fas fa-user-tie"></i></div>
              <div className="review-info-content">
                <div className="review-info-label">{t('account-setup-step-2-professional-title')}</div>
                <div className="review-info-value">{formData.title || '—'}</div>
              </div>
            </div>
            <div className="review-info-item div4">
              <div className="review-info-icon"><i className="fas fa-birthday-cake"></i></div>
              <div className="review-info-content">
                <div className="review-info-label">{t('account-setup-step-8-date-of-birth')}</div>
                <div className="review-info-value">{age === null ? '—' : age}</div>
              </div>
            </div>
            <div className="review-info-item div5">
              <div className="review-info-icon"><i className="fas fa-briefcase"></i></div>
              <div className="review-info-content">
                <div className="review-info-label">{t('account-setup-step-8-total-experience-years')}</div>
                <div className="review-info-value">{totalExperienceYears}</div>
              </div>
            </div>
            <div className="review-info-item div6">
              <div className="review-info-icon"><i className="fas fa-suitcase"></i></div>
              <div className="review-info-content">
                <div className="review-info-label">{t('account-setup-step-8-experiences')}</div>
                <div className="review-info-value">{experiences.length}</div>
              </div>
            </div>
            <div className="review-info-item div7">
              <div className="review-info-icon"><i className="fas fa-star"></i></div>
              <div className="review-info-content">
                <div className="review-info-label">{t('account-setup-step-4-skills')}</div>
                <div className="review-info-value">{skills.length}</div>
              </div>
            </div>
            <div className="review-info-item div8">
              <div className="review-info-icon"><i className="fas fa-graduation-cap"></i></div>
              <div className="review-info-content">
                <div className="review-info-label">{t('account-setup-step-4-education')}</div>
                <div className="review-info-value">{educations.length}</div>
              </div>
            </div>
            <div className="review-info-item div9">
              <div className="review-info-icon"><i className="fas fa-certificate"></i></div>
              <div className="review-info-content">
                <div className="review-info-label">{t('account-setup-step-6-certificates')}</div>
                <div className="review-info-value">{certificates.length}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Step8;
