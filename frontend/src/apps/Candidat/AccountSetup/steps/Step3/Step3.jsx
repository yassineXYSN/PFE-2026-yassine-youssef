import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import './Step3.css';

const Step3 = ({ formData = {}, onUpdate = () => { } }) => {
  const { t } = useLanguage();
  const skills = formData.skills || [];
  const languages = formData.languages || [];

  const [currentSkill, setCurrentSkill] = useState({ name: '', level: 50 });
  const [currentLanguage, setCurrentLanguage] = useState({ name: '', level: 50 });

  const handleAddSkill = () => {
    if ((currentSkill.name || '').trim()) {
      const newSkills = [...skills, { ...currentSkill, id: Date.now() }];
      onUpdate({ skills: newSkills });
      setCurrentSkill({ name: '', level: 50 });
    }
  };

  const handleRemoveSkill = (id) => {
    const newSkills = skills.filter(skill => skill.id !== id);
    onUpdate({ skills: newSkills });
  };

  const handleAddLanguage = () => {
    if ((currentLanguage.name || '').trim()) {
      const newLanguages = [...languages, { ...currentLanguage, id: Date.now() }];
      onUpdate({ languages: newLanguages });
      setCurrentLanguage({ name: '', level: 50 });
    }
  };

  const handleRemoveLanguage = (id) => {
    const newLanguages = languages.filter(language => language.id !== id);
    onUpdate({ languages: newLanguages });
  };

  const handleKeyPress = (e, addFunction) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFunction();
    }
  };

  return (
    <div className="setup-step-form">
      <div className="setup-step-form-header">
        <div className="setup-step-icon">
          <i className="fas fa-star"></i>
        </div>
      </div>

      <div className="setup-step-form-content">
        <div className="skills-languages-wrapper">
          {/* Skills Section */}
          <div className="skill-section">
            <div className="section-header">
              <h3 className="section-title">
                <i className="fas fa-laptop-code"></i> {t('account-setup-step-3-skills-expertise')}
              </h3>
              {skills.length > 0 && <span className="section-badge skills-badge">{skills.length}</span>}
            </div>

            <div className="skill-input-group">
              <div className="input-with-label">
                <label className="input-label">{t('account-setup-step-3-skill-name')}</label>
                <input
                  type="text"
                  value={currentSkill.name}
                  onChange={(e) => setCurrentSkill({ ...currentSkill, name: e.target.value })}
                  onKeyPress={(e) => handleKeyPress(e, handleAddSkill)}
                  placeholder="e.g., JavaScript, Project Management, Design"
                  className="skill-input"
                />
              </div>

              <div className="input-with-label">
                <label className="input-label">{t('account-setup-step-3-proficiency')}: {currentSkill.level}%</label>
                <div className="level-slider-container">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentSkill.level}
                    onChange={(e) => setCurrentSkill({ ...currentSkill, level: parseInt(e.target.value) })}
                    className="skill-slider"
                  />
                  <div className="slider-labels">
                    <span>{t('account-setup-step-3-beginner')}</span>
                    <span>{t('account-setup-step-3-intermediate')}</span>
                    <span>{t('account-setup-step-3-expert')}</span>
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleAddSkill} className="add-button">
                <i className="fas fa-plus"></i>
                <span>{t('account-setup-step-3-add-skill')}</span>
              </button>
            </div>

            <div className="items-grid">
              {skills.length === 0 ? (
                <div className="items-empty-state">
                  <i className="fas fa-laptop-code"></i>
                  <p>{t('account-setup-step-3-no-skills')}</p>
                </div>
              ) : (
                skills.map((skill) => (
                  <div key={skill.id} className="skill-card">
                    <div className="card-header">
                      <span className="card-name">{skill.name}</span>
                      <button type="button" onClick={() => handleRemoveSkill(skill.id)} className="card-remove">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <div className="card-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${skill.level}%` }}></div>
                      </div>
                      <span className="progress-label">{skill.level}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Languages Section */}
          <div className="skill-section">
            <div className="section-header">
              <h3 className="section-title">
                <i className="fas fa-language"></i> {t('account-setup-step-3-languages')}
              </h3>
              {languages.length > 0 && <span className="section-badge languages-badge">{languages.length}</span>}
            </div>

            <div className="skill-input-group">
              <div className="input-with-label">
                <label className="input-label">{t('account-setup-step-3-languages')}</label>
                <input
                  type="text"
                  value={currentLanguage.name}
                  onChange={(e) => setCurrentLanguage({ ...currentLanguage, name: e.target.value })}
                  onKeyPress={(e) => handleKeyPress(e, handleAddLanguage)}
                  placeholder="e.g., English, French, Spanish"
                  className="skill-input"
                />
              </div>

              <div className="input-with-label">
                <label className="input-label">{t('account-setup-step-3-proficiency')}: {currentLanguage.level}%</label>
                <div className="level-slider-container">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentLanguage.level}
                    onChange={(e) => setCurrentLanguage({ ...currentLanguage, level: parseInt(e.target.value) })}
                    className="skill-slider"
                  />
                  <div className="slider-labels">
                    <span>{t('account-setup-step-3-basic')}</span>
                    <span>{t('account-setup-step-3-conversational')}</span>
                    <span>{t('account-setup-step-3-fluent')}</span>
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleAddLanguage} className="add-button">
                <i className="fas fa-plus"></i>
                <span>{t('account-setup-step-3-add-language')}</span>
              </button>
            </div>

            <div className="items-grid">
              {languages.length === 0 ? (
                <div className="items-empty-state">
                  <i className="fas fa-language"></i>
                  <p>{t('account-setup-step-3-no-languages')}</p>
                </div>
              ) : (
                languages.map((language) => (
                  <div key={language.id} className="language-card">
                    <div className="card-header">
                      <span className="card-name">{language.name}</span>
                      <button type="button" onClick={() => handleRemoveLanguage(language.id)} className="card-remove">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <div className="card-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${language.level}%` }}></div>
                      </div>
                      <span className="progress-label">{language.level}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3;
