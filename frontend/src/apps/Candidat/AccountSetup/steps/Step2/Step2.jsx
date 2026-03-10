import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step2.css';

const Step2 = ({ formData = {}, onUpdate = () => {} }) => {
  const { t } = useLanguage();
  const [currentHobby, setCurrentHobby] = useState('');
  const [focusedField, setFocusedField] = useState(null);

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
    if (currentHobby.trim() && hobbies.length < 3) {
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

  const filledCount = [stepData.firstName, stepData.lastName, stepData.birthDate, stepData.title].filter(Boolean).length;

  return (
    <div className="s2-wrapper">
      {/* Left: Identity Card Preview */}
      <div className="s2-preview-card">
        <div className="s2-preview-avatar">
          <span className="s2-preview-initials">
            {(stepData.firstName?.[0] || '').toUpperCase()}{(stepData.lastName?.[0] || '').toUpperCase() || ''}
          </span>
          <div className="s2-preview-avatar-ring"></div>
        </div>
        <div className="s2-preview-name">
          {stepData.firstName || stepData.lastName
            ? `${stepData.firstName} ${stepData.lastName}`.trim()
            : t('account-setup-step-2-first-name')}
        </div>
        <div className="s2-preview-title">
          {stepData.title || t('account-setup-step-2-professional-title')}
        </div>
        <div className="s2-preview-divider"></div>
        <div className="s2-preview-details">
          {stepData.birthDate && (
            <div className="s2-preview-detail">
              <i className="fas fa-calendar-alt"></i>
              <span>{stepData.birthDate}</span>
            </div>
          )}
          {stepData.address && (
            <div className="s2-preview-detail">
              <i className="fas fa-map-marker-alt"></i>
              <span>{stepData.address}</span>
            </div>
          )}
          {stepData.linkedinUrl && (
            <div className="s2-preview-detail">
              <i className="fab fa-linkedin"></i>
              <span>LinkedIn</span>
            </div>
          )}
        </div>
        {hobbies.length > 0 && (
          <div className="s2-preview-hobbies">
            {hobbies.map((h) => (
              <span key={h.id} className="s2-preview-hobby-chip">{h.name}</span>
            ))}
          </div>
        )}
        {/* Completion indicator */}
        <div className="s2-preview-completion">
          <div className="s2-preview-completion-bar">
            <div className="s2-preview-completion-fill" style={{ width: `${(filledCount / 4) * 100}%` }}></div>
          </div>
          <span className="s2-preview-completion-text">{filledCount}/4 {t('common-required') || 'required'}</span>
        </div>
      </div>

      {/* Right: Form Fields */}
      <form className="s2-form">
        {/* Row 1: Names */}
        <div className="s2-row">
          <div className={`s2-field ${focusedField === 'firstName' || stepData.firstName ? 'has-value' : ''} ${focusedField === 'firstName' ? 'focused' : ''}`}>
            <div className="s2-field-icon"><i className="fas fa-user"></i></div>
            <div className="s2-field-body">
              <label htmlFor="firstName" className="s2-label">{t('account-setup-step-2-first-name')} *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={stepData.firstName}
                onChange={handleChange}
                onFocus={() => setFocusedField('firstName')}
                onBlur={() => setFocusedField(null)}
                placeholder="John"
                className="s2-input"
                required
              />
            </div>
          </div>
          <div className={`s2-field ${focusedField === 'lastName' || stepData.lastName ? 'has-value' : ''} ${focusedField === 'lastName' ? 'focused' : ''}`}>
            <div className="s2-field-icon"><i className="fas fa-user"></i></div>
            <div className="s2-field-body">
              <label htmlFor="lastName" className="s2-label">{t('account-setup-step-2-last-name')} *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={stepData.lastName}
                onChange={handleChange}
                onFocus={() => setFocusedField('lastName')}
                onBlur={() => setFocusedField(null)}
                placeholder="Doe"
                className="s2-input"
                required
              />
            </div>
          </div>
        </div>

        {/* Row 2: Birth & Title */}
        <div className="s2-row">
          <div className={`s2-field ${focusedField === 'birthDate' || stepData.birthDate ? 'has-value' : ''} ${focusedField === 'birthDate' ? 'focused' : ''}`}>
            <div className="s2-field-icon"><i className="fas fa-calendar-alt"></i></div>
            <div className="s2-field-body">
              <label htmlFor="birthDate" className="s2-label">{t('account-setup-step-2-birth-date')} *</label>
              <input
                type="date"
                id="birthDate"
                name="birthDate"
                value={stepData.birthDate}
                onChange={handleChange}
                onFocus={() => setFocusedField('birthDate')}
                onBlur={() => setFocusedField(null)}
                className="s2-input"
                required
              />
            </div>
          </div>
          <div className={`s2-field ${focusedField === 'title' || stepData.title ? 'has-value' : ''} ${focusedField === 'title' ? 'focused' : ''}`}>
            <div className="s2-field-icon"><i className="fas fa-briefcase"></i></div>
            <div className="s2-field-body">
              <label htmlFor="title" className="s2-label">{t('account-setup-step-2-professional-title')} *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={stepData.title}
                onChange={handleChange}
                onFocus={() => setFocusedField('title')}
                onBlur={() => setFocusedField(null)}
                placeholder="e.g., Software Engineer"
                className="s2-input"
                required
              />
            </div>
          </div>
        </div>

        {/* Row 3: Address & LinkedIn */}
        <div className="s2-row">
          <div className={`s2-field ${focusedField === 'address' || stepData.address ? 'has-value' : ''} ${focusedField === 'address' ? 'focused' : ''}`}>
            <div className="s2-field-icon"><i className="fas fa-map-marker-alt"></i></div>
            <div className="s2-field-body">
              <label htmlFor="address" className="s2-label">{t('account-setup-step-2-address')}</label>
              <input
                type="text"
                id="address"
                name="address"
                value={stepData.address}
                onChange={handleChange}
                onFocus={() => setFocusedField('address')}
                onBlur={() => setFocusedField(null)}
                placeholder="123 Main St, City, Country"
                className="s2-input"
              />
            </div>
          </div>
          <div className={`s2-field ${focusedField === 'linkedinUrl' || stepData.linkedinUrl ? 'has-value' : ''} ${focusedField === 'linkedinUrl' ? 'focused' : ''}`}>
            <div className="s2-field-icon"><i className="fab fa-linkedin"></i></div>
            <div className="s2-field-body">
              <label htmlFor="linkedinUrl" className="s2-label">{t('account-setup-step-2-linkedin-url')}</label>
              <input
                type="url"
                id="linkedinUrl"
                name="linkedinUrl"
                value={stepData.linkedinUrl}
                onChange={handleChange}
                onFocus={() => setFocusedField('linkedinUrl')}
                onBlur={() => setFocusedField(null)}
                placeholder="https://linkedin.com/in/yourprofile"
                className="s2-input"
              />
            </div>
          </div>
        </div>

        {/* Hobbies */}
        <div className="s2-hobbies-section">
          <div className="s2-hobbies-header">
            <div className="s2-hobbies-title-row">
              <i className="fas fa-heart"></i>
              <span>{t('account-setup-step-2-hobbies')}</span>
            </div>
            <div className="s2-hobbies-counter">
              {[0, 1, 2].map(i => (
                <span key={i} className={`s2-hobbies-dot ${i < hobbies.length ? 'filled' : ''}`}></span>
              ))}
            </div>
          </div>

          <div className="s2-hobbies-input-row">
            <input
              type="text"
              value={currentHobby}
              onChange={(e) => setCurrentHobby(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('account-setup-step-2-add-hobby')}
              className="s2-input s2-hobby-input"
              disabled={hobbies.length >= 3}
            />
            <button
              type="button"
              onClick={handleAddHobby}
              className="s2-hobby-add-btn"
              disabled={hobbies.length >= 3 || !currentHobby.trim()}
              title={hobbies.length >= 3 ? t('account-setup-step-2-max-hobbies') : t('account-setup-step-2-add-hobby')}
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>

          {hobbies.length > 0 && (
            <div className="s2-hobbies-list">
              {hobbies.map((hobby) => (
                <div key={hobby.id} className="s2-hobby-chip">
                  <i className="fas fa-gamepad"></i>
                  <span>{hobby.name}</span>
                  <button type="button" onClick={() => handleRemoveHobby(hobby.id)} className="s2-hobby-remove">
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
