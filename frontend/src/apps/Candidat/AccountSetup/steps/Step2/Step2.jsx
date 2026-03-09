import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step2.css';

const Step2 = ({ formData = {}, onUpdate = () => { } }) => {
  const { t } = useLanguage();
  const [currentHobby, setCurrentHobby] = useState('');

  const stepData = {
    firstName: formData.firstName || '',
    lastName: formData.lastName || '',
    birthDate: formData.birthDate || '',
    title: formData.title || '',
    address: formData.address || '',
    linkedinUrl: formData.linkedinUrl || ''
  };

  const hobbies = formData.hobbies || [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    onUpdate({
      [name]: value
    });
  };

  const handleAddHobby = () => {
    if ((currentHobby || '').trim() && hobbies.length < 3) {
      const newHobbies = [...hobbies, { name: currentHobby, id: Date.now() }];
      onUpdate({ hobbies: newHobbies });
      setCurrentHobby('');
    }
  };

  const handleRemoveHobby = (id) => {
    const newHobbies = hobbies.filter(hobby => hobby.id !== id);
    onUpdate({ hobbies: newHobbies });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddHobby();
    }
  };

  return (
    <div className="setup-step-form">
      <div className="setup-step-form-header">
        <div className="setup-step-icon">
          <i className="fas fa-briefcase"></i>
        </div>
      </div>

      <form className="setup-step-form-content">
        <div className="setup-form-row">
          <div className="setup-form-group">
            <label htmlFor="firstName" className="setup-form-label">{t('account-setup-step-2-first-name')} *</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={stepData.firstName}
              onChange={handleChange}
              placeholder="John"
              className="setup-form-input"
              required
            />
          </div>
          <div className="setup-form-group">
            <label htmlFor="lastName" className="setup-form-label">{t('account-setup-step-2-last-name')} *</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={stepData.lastName}
              onChange={handleChange}
              placeholder="Doe"
              className="setup-form-input"
              required
            />
          </div>
        </div>

        <div className="setup-form-row">
          <div className="setup-form-group">
            <label htmlFor="birthDate" className="setup-form-label">{t('account-setup-step-2-birth-date')} *</label>
            <input
              type="date"
              id="birthDate"
              name="birthDate"
              value={stepData.birthDate}
              onChange={handleChange}
              className="setup-form-input"
              required
            />
          </div>
          <div className="setup-form-group">
            <label htmlFor="title" className="setup-form-label">{t('account-setup-step-2-professional-title')} *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={stepData.title}
              onChange={handleChange}
              placeholder="e.g., Software Engineer"
              className="setup-form-input"
              required
            />
          </div>
        </div>

        <div className="setup-form-row">
          <div className="setup-form-group">
            <label htmlFor="address" className="setup-form-label">{t('account-setup-step-2-address')}</label>
            <input
              type="text"
              id="address"
              name="address"
              value={stepData.address}
              onChange={handleChange}
              placeholder="123 Main St, City, Country"
              className="setup-form-input"
            />
          </div>
          <div className="setup-form-group">
            <label htmlFor="linkedinUrl" className="setup-form-label">{t('account-setup-step-2-linkedin-url')}</label>
            <input
              type="url"
              id="linkedinUrl"
              name="linkedinUrl"
              value={stepData.linkedinUrl}
              onChange={handleChange}
              placeholder="https://linkedin.com/in/yourprofile"
              className="setup-form-input"
            />
          </div>
        </div>

        {/* Hobbies Section */}
        <div className="setup-form-section">
          <div className="section-header">
            <h3 className="section-title">
              <i className="fas fa-heart"></i> {t('account-setup-step-2-hobbies')}
            </h3>
            {hobbies.length > 0 && <span className="section-badge">{hobbies.length}</span>}
          </div>

          <div className="hobby-input-container">
            <input
              type="text"
              value={currentHobby}
              onChange={(e) => setCurrentHobby(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('account-setup-step-2-add-hobby')}
              className="setup-form-input"
              disabled={hobbies.length >= 3}
            />
            <button
              type="button"
              onClick={handleAddHobby}
              className="hobby-add-btn"
              disabled={hobbies.length >= 3}
              title={hobbies.length >= 3 ? t('account-setup-step-2-max-hobbies') : t('account-setup-step-2-add-hobby')}
            >
              <i className="fas fa-plus"></i>
              <span>{t('common-add')}</span>
            </button>
          </div>

          {hobbies.length > 0 && (
            <div className="hobbies-list">
              {hobbies.map((hobby) => (
                <div key={hobby.id} className="hobby-tag">
                  <span className="hobby-name">{hobby.name}</span>
                  <button type="button" onClick={() => handleRemoveHobby(hobby.id)} className="hobby-remove">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default Step2;
