import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import SetupModal from '../../components/SetupModal';
import './Step3.css';

const EMPTY_SKILL = { name: '', level: 70 };
const EMPTY_LANGUAGE = { name: '', level: 70 };

const Step3 = ({ formData = {}, onUpdate = () => {} }) => {
  const { t, language } = useLanguage();
  const skills = formData.skills || [];
  const languages = formData.languages || [];
  const [activeEditor, setActiveEditor] = useState(null);
  const [currentSkill, setCurrentSkill] = useState({ ...EMPTY_SKILL });
  const [currentLanguage, setCurrentLanguage] = useState({ ...EMPTY_LANGUAGE });


  const getLevelLabel = (value, type) => {
    if (type === 'skill') {
      if (value >= 80) return t('account-setup-step-3-expert');
      if (value >= 55) return t('account-setup-step-3-intermediate');
      return t('account-setup-step-3-beginner');
    }

    if (value >= 80) return t('account-setup-step-3-fluent');
    if (value >= 55) return t('account-setup-step-3-conversational');
    return t('account-setup-step-3-basic');
  };

  const getTopItem = (items = []) => {
    if (!items.length) return t('no_top_item');
    return [...items].sort((left, right) => (right.level || 0) - (left.level || 0))[0]?.name || t('no_top_item');
  };

  const closeEditor = () => {
    setActiveEditor(null);
    setCurrentSkill({ ...EMPTY_SKILL });
    setCurrentLanguage({ ...EMPTY_LANGUAGE });
  };

  const openSkillEditor = (skill = null) => {
    setCurrentSkill(skill ? {
      name: skill.name || '',
      level: typeof skill.level === 'number' ? skill.level : 70,
    } : { ...EMPTY_SKILL });
    setActiveEditor({ type: 'skill', id: skill?.id || null });
  };

  const openLanguageEditor = (entry = null) => {
    setCurrentLanguage(entry ? {
      name: entry.name || '',
      level: typeof entry.level === 'number' ? entry.level : 70,
    } : { ...EMPTY_LANGUAGE });
    setActiveEditor({ type: 'language', id: entry?.id || null });
  };

  const handleSaveSkill = () => {
    if (!(currentSkill.name || '').trim()) {
      return;
    }

    const nextSkill = {
      id: activeEditor?.type === 'skill' && activeEditor?.id ? activeEditor.id : Date.now(),
      name: currentSkill.name.trim(),
      level: Number(currentSkill.level) || 0,
    };

    const updatedSkills = activeEditor?.type === 'skill' && activeEditor?.id
      ? skills.map((skill) => (skill.id === activeEditor.id ? nextSkill : skill))
      : [...skills, nextSkill];

    onUpdate({ skills: updatedSkills });
    closeEditor();
  };

  const handleSaveLanguage = () => {
    if (!(currentLanguage.name || '').trim()) {
      return;
    }

    const nextLanguage = {
      id: activeEditor?.type === 'language' && activeEditor?.id ? activeEditor.id : Date.now(),
      name: currentLanguage.name.trim(),
      level: Number(currentLanguage.level) || 0,
    };

    const updatedLanguages = activeEditor?.type === 'language' && activeEditor?.id
      ? languages.map((entry) => (entry.id === activeEditor.id ? nextLanguage : entry))
      : [...languages, nextLanguage];

    onUpdate({ languages: updatedLanguages });
    closeEditor();
  };

  const handleRemoveSkill = (id) => {
    onUpdate({ skills: skills.filter((skill) => skill.id !== id) });
  };

  const handleRemoveLanguage = (id) => {
    onUpdate({ languages: languages.filter((entry) => entry.id !== id) });
  };

  const handleSubmitShortcut = (event, saveAction) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveAction();
    }
  };

  const isSkillEditor = activeEditor?.type === 'skill';
  const modalTitle = isSkillEditor
    ? (activeEditor?.id ? `${t('common-edit')} ${t('account-setup-step-3-skill-name')}` : t('account-setup-step-3-add-skill'))
    : (activeEditor?.id ? `${t('common-edit')} ${t('account-setup-step-3-languages')}` : t('account-setup-step-3-add-language'));

  const modalDescription = isSkillEditor
    ? t('skill_modal_description')
    : t('language_modal_description');

  return (
    <div className="setup-step-form step3-wrapper">
      <div className="setup-step-form-content">
        <div className="skills-languages-wrapper">
          <section className="s3-panel skill-panel">
            <div className="s3-panel-header">
              <div>
                <div className="s3-panel-heading">
                  <span className="s3-panel-icon">
                    <i className="fas fa-laptop-code"></i>
                  </span>
                  <div>
                    <h3>{t('account-setup-step-3-skills-expertise')}</h3>
                    <p>{t('skills_summary')}</p>
                  </div>
                </div>
                <div className="s3-panel-meta">
                  <span className="s3-count-pill">{skills.length}</span>
                  <span className="s3-top-pill">
                    {t('strongest_label')}: <strong>{getTopItem(skills)}</strong>
                  </span>
                </div>
              </div>

              <button type="button" className="s3-add-action" onClick={() => openSkillEditor()}>
                <i className="fas fa-plus"></i>
                <span>{t('account-setup-step-3-add-skill')}</span>
              </button>
            </div>

            {skills.length === 0 ? (
              <div className="s3-empty-state">
                <i className="fas fa-laptop-code"></i>
                <p>{t('account-setup-step-3-no-skills')}</p>
              </div>
            ) : (
              <div className="s3-item-list">
                {skills.map((skill) => (
                  <article key={skill.id} className="s3-item-card skill">
                    <div className="s3-item-main">
                      <div className="s3-item-topline">
                        <strong>{skill.name}</strong>
                        <span>{getLevelLabel(skill.level || 0, 'skill')}</span>
                      </div>
                      <div className="s3-item-progress">
                        <div className="s3-item-progress-fill" style={{ width: `${skill.level || 0}%` }}></div>
                      </div>
                    </div>

                    <div className="s3-item-side">
                      <span className="s3-item-percent">{skill.level || 0}%</span>
                      <div className="s3-item-actions">
                        <button type="button" onClick={() => openSkillEditor(skill)} title={t('common-edit')}>
                          <i className="fas fa-pen"></i>
                        </button>
                        <button type="button" onClick={() => handleRemoveSkill(skill.id)} title={t('common-delete')}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="s3-panel language-panel">
            <div className="s3-panel-header">
              <div>
                <div className="s3-panel-heading">
                  <span className="s3-panel-icon">
                    <i className="fas fa-language"></i>
                  </span>
                  <div>
                    <h3>{t('account-setup-step-3-languages')}</h3>
                    <p>{t('languages_summary')}</p>
                  </div>
                </div>
                <div className="s3-panel-meta">
                  <span className="s3-count-pill">{languages.length}</span>
                  <span className="s3-top-pill">
                    {t('strongest_label')}: <strong>{getTopItem(languages)}</strong>
                  </span>
                </div>
              </div>

              <button type="button" className="s3-add-action alt" onClick={() => openLanguageEditor()}>
                <i className="fas fa-plus"></i>
                <span>{t('account-setup-step-3-add-language')}</span>
              </button>
            </div>

            {languages.length === 0 ? (
              <div className="s3-empty-state">
                <i className="fas fa-language"></i>
                <p>{t('account-setup-step-3-no-languages')}</p>
              </div>
            ) : (
              <div className="s3-item-list">
                {languages.map((entry) => (
                  <article key={entry.id} className="s3-item-card language">
                    <div className="s3-item-main">
                      <div className="s3-item-topline">
                        <strong>{entry.name}</strong>
                        <span>{getLevelLabel(entry.level || 0, 'language')}</span>
                      </div>
                      <div className="s3-item-progress">
                        <div className="s3-item-progress-fill" style={{ width: `${entry.level || 0}%` }}></div>
                      </div>
                    </div>

                    <div className="s3-item-side">
                      <span className="s3-item-percent">{entry.level || 0}%</span>
                      <div className="s3-item-actions">
                        <button type="button" onClick={() => openLanguageEditor(entry)} title={t('common-edit')}>
                          <i className="fas fa-pen"></i>
                        </button>
                        <button type="button" onClick={() => handleRemoveLanguage(entry.id)} title={t('common-delete')}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <SetupModal
        isOpen={Boolean(activeEditor)}
        onClose={closeEditor}
        icon={isSkillEditor ? 'fas fa-laptop-code' : 'fas fa-language'}
        title={modalTitle}
        description={modalDescription}
        closeLabel={t('common-cancel')}
      >
        {isSkillEditor ? (
          <div className="s3-modal-form">
            <div className="s3-modal-field">
              <label>{t('account-setup-step-3-skill-name')}</label>
              <input
                type="text"
                value={currentSkill.name}
                onChange={(event) => setCurrentSkill({ ...currentSkill, name: event.target.value })}
                onKeyDown={(event) => handleSubmitShortcut(event, handleSaveSkill)}
                placeholder={t('skill_placeholder')}
                className="skill-input"
              />
            </div>

            <div className="s3-modal-field">
              <label>{t('account-setup-step-3-proficiency')}: {currentSkill.level}%</label>
              <div className="level-slider-container">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={currentSkill.level}
                  onChange={(event) => setCurrentSkill({ ...currentSkill, level: parseInt(event.target.value, 10) })}
                  className="skill-slider"
                />
                <div className="slider-labels">
                  <span>{t('account-setup-step-3-beginner')}</span>
                  <span>{t('account-setup-step-3-intermediate')}</span>
                  <span>{t('account-setup-step-3-expert')}</span>
                </div>
              </div>
            </div>

            <div className="s3-modal-actions">
              <button type="button" className="s3-modal-secondary" onClick={closeEditor}>
                {t('common-cancel')}
              </button>
              <button type="button" className="s3-modal-primary" onClick={handleSaveSkill}>
                {activeEditor?.id ? t('common-edit') : t('account-setup-step-3-add-skill')}
              </button>
            </div>
          </div>
        ) : (
          <div className="s3-modal-form">
            <div className="s3-modal-field">
              <label>{t('account-setup-step-3-languages')}</label>
              <input
                type="text"
                value={currentLanguage.name}
                onChange={(event) => setCurrentLanguage({ ...currentLanguage, name: event.target.value })}
                onKeyDown={(event) => handleSubmitShortcut(event, handleSaveLanguage)}
                placeholder={t('language_placeholder')}
                className="skill-input"
              />
            </div>

            <div className="s3-modal-field">
              <label>{t('account-setup-step-3-proficiency')}: {currentLanguage.level}%</label>
              <div className="level-slider-container">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={currentLanguage.level}
                  onChange={(event) => setCurrentLanguage({ ...currentLanguage, level: parseInt(event.target.value, 10) })}
                  className="skill-slider"
                />
                <div className="slider-labels">
                  <span>{t('account-setup-step-3-basic')}</span>
                  <span>{t('account-setup-step-3-conversational')}</span>
                  <span>{t('account-setup-step-3-fluent')}</span>
                </div>
              </div>
            </div>

            <div className="s3-modal-actions">
              <button type="button" className="s3-modal-secondary" onClick={closeEditor}>
                {t('common-cancel')}
              </button>
              <button type="button" className="s3-modal-primary alt" onClick={handleSaveLanguage}>
                {activeEditor?.id ? t('common-edit') : t('account-setup-step-3-add-language')}
              </button>
            </div>
          </div>
        )}
      </SetupModal>
    </div>
  );
};

export default Step3;
