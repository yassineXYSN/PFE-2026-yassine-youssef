import React, { useState, useRef } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step2.css';

const Step2 = ({ formData = {}, onUpdate = () => {} }) => {
  const { t } = useLanguage();
  const [currentHobby, setCurrentHobby] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const fileInputRef = useRef(null);

  const stepData = {
    firstName: formData.firstName || '',
    lastName: formData.lastName || '',
    birthDate: formData.birthDate || '',
    title: formData.title || '',
    address: formData.address || '',
    linkedinUrl: formData.linkedinUrl || ''
  };

  const profilePicture = formData.profilePicture || null;
  const hobbies = formData.hobbies || [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    onUpdate({
      [name]: value
    });
  };

  const handleProfilePicture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB limit
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpdate({ profilePicture: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    onUpdate({ profilePicture: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      {/* Left column: Preview */}
      <div className="s2-left-col">
        <div className="s2-preview-card">
          {/* Avatar with photo upload */}
          <div className="s2-preview-avatar" onClick={() => fileInputRef.current?.click()}>
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" className="s2-preview-photo" />
            ) : (
              <span className="s2-preview-initials">
                {(stepData.firstName?.[0] || '').toUpperCase()}{(stepData.lastName?.[0] || '').toUpperCase() || ''}
              </span>
            )}
            <div className="s2-preview-avatar-ring"></div>
            <div className="s2-avatar-overlay">
              <i className="fas fa-camera"></i>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePicture}
              className="s2-avatar-file-input"
            />
          </div>
          {profilePicture && (
            <button type="button" className="s2-remove-photo" onClick={handleRemovePhoto}>
              <i className="fas fa-trash-alt"></i> {t('common-remove')}
            </button>
          )}
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
            <span className="s2-preview-completion-text">{filledCount}/4 {t('common-required')}</span>
          </div>
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
                placeholder={t('placeholder_first_name')}
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
                placeholder={t('placeholder_last_name')}
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
                placeholder={t('placeholder_job_title')}
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
                placeholder={t('placeholder_address')}
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
                placeholder={t('placeholder_linkedin')}
                className="s2-input"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Hobbies – full width bottom row */}
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

        <div className="s2-hobbies-body">
          <div className="s2-hobbies-input-row">
            <div className="s2-hobby-field">
              <i className="fas fa-gamepad s2-hobby-field-icon"></i>
              <input
                type="text"
                value={currentHobby}
                onChange={(e) => setCurrentHobby(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={hobbies.length >= 3 ? t('account-setup-step-2-max-hobbies') : t('account-setup-step-2-add-hobby_placeholder')}
                className="s2-hobby-input"
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
                <span>{t('common-add')}</span>
              </button>
            </div>
          </div>

          {hobbies.length > 0 && (
            <div className="s2-hobbies-list">
              {hobbies.map((hobby) => (
                <div key={hobby.id} className="s2-hobby-chip">
                  <span className="s2-hobby-chip-icon"><i className="fas fa-star"></i></span>
                  <span className="s2-hobby-chip-name">{hobby.name}</span>
                  <button type="button" onClick={() => handleRemoveHobby(hobby.id)} className="s2-hobby-remove" title={t('common-remove')}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step2;
