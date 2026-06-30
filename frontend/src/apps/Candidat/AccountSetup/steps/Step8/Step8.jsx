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

  // Calculate total experience in months, then format
  const calculateExperienceMonths = (experiences) => {
    if (!experiences || experiences.length === 0) return 0;

    const today = new Date();
    let totalMonths = 0;

    experiences.forEach((exp) => {
      const startYear = parseInt(exp.startYear, 10);
      if (!startYear) return;

      const startMonth = parseInt(exp.startMonth, 10) || 1;
      const startDate = new Date(startYear, startMonth - 1, 1);

      const endYear = exp.ongoing ? today.getFullYear() : parseInt(exp.endYear, 10);
      if (!endYear) return;

      const endMonthValue = exp.ongoing ? today.getMonth() + 1 : (parseInt(exp.endMonth, 10) || 12);
      const endDate = new Date(endYear, endMonthValue - 1, 1);

      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
      totalMonths += Math.max(0, monthsDiff);
    });

    return Math.max(0, totalMonths);
  };

  const formatExperience = (totalMonths) => {
    if (totalMonths < 12) {
      return `${totalMonths} ${t('account-setup-step-8-months')}`;
    }
    const years = (totalMonths / 12);
    const roundedYears = Math.round(years * 10) / 10;
    const displayYears = Number.isInteger(roundedYears) ? roundedYears.toString() : roundedYears.toString();
    return `${displayYears} ${t('account-setup-step-8-years')}`;
  };

  const age = calculateAge(formData.birthDate);
  const totalExperienceMonths = calculateExperienceMonths(formData.experiences);
  const totalExperienceDisplay = formatExperience(totalExperienceMonths);
  const experiences = formData.experiences || [];
  const skills = formData.skills || [];
  const educations = formData.educations || [];
  const certificates = formData.certificates || [];

  return (
    <div className="step8-wrapper">
      <div className="review-container">
        <div className="review-grid">
          <div className="review-info-item div1">
            <div className="review-info-icon"><i className="fas fa-id-badge" /></div>
            <div className="review-info-content">
              <div className="review-info-label">{t('account-setup-step-2-first-name')}</div>
              <div className="review-info-value">{formData.firstName || '—'}</div>
            </div>
          </div>

          <div className="review-info-item div2">
            <div className="review-info-icon"><i className="fas fa-id-badge" /></div>
            <div className="review-info-content">
              <div className="review-info-label">{t('account-setup-step-2-last-name')}</div>
              <div className="review-info-value">{formData.lastName || '—'}</div>
            </div>
          </div>

          <div className="review-info-item div3">
            <div className="review-info-icon"><i className="fas fa-user-tie" /></div>
            <div className="review-info-content">
              <div className="review-info-label">{t('account-setup-step-2-professional-title')}</div>
              <div className="review-info-value">{formData.title || '—'}</div>
            </div>
          </div>

          <div className="review-info-item div4">
            <div className="review-info-icon"><i className="fas fa-birthday-cake" /></div>
            <div className="review-info-content">
              <div className="review-info-label">{t('account-setup-step-8-date-of-birth')}</div>
              <div className="review-info-value">{age === null ? '—' : age}</div>
            </div>
          </div>

          <div className="review-info-item div5">
            <div className="review-info-icon"><i className="fas fa-briefcase" /></div>
            <div className="review-info-content">
              <div className="review-info-label">{t('account-setup-step-8-total-experience-years')}</div>
              <div className="review-info-value">{totalExperienceDisplay}</div>
            </div>
          </div>

          <div className="review-info-item div6">
            <div className="review-info-icon"><i className="fas fa-suitcase" /></div>
            <div className="review-info-content">
              <div className="review-info-label">{t('account-setup-step-8-experiences')}</div>
              <div className="review-info-value">{experiences.length}</div>
            </div>
          </div>

          <div className="review-info-item div7">
            <div className="review-info-icon"><i className="fas fa-star" /></div>
            <div className="review-info-content">
              <div className="review-info-label">{t('account-setup-step-4-skills')}</div>
              <div className="review-info-value">{skills.length}</div>
            </div>
          </div>

          <div className="review-info-item div8">
            <div className="review-info-icon"><i className="fas fa-graduation-cap" /></div>
            <div className="review-info-content">
              <div className="review-info-label">{t('account-setup-step-4-education')}</div>
              <div className="review-info-value">{educations.length}</div>
            </div>
          </div>

          <div className="review-info-item div9">
            <div className="review-info-icon"><i className="fas fa-certificate" /></div>
            <div className="review-info-content">
              <div className="review-info-label">{t('account-setup-step-6-certificates')}</div>
              <div className="review-info-value">{certificates.length}</div>
            </div>
          </div>
        </div>

        <div className="review-ready-pulse">
          <div className="pulse-dot" />
          <p>{t('account-setup-step-8-ready') || 'Everything looks great — ready to complete your profile!'}</p>
        </div>
      </div>
    </div>
  );
};

export default Step8;
