import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';
import SetupModal from '../../components/SetupModal';
import './Step3.css';

const EMPTY_SKILL = { name: '', level: 70 };
const EMPTY_LANGUAGE = { name: '', level: 70 };

const Step3 = ({ formData = {}, onUpdate = () => {} }) => {
  const { t } = useLanguage();
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
    if (!(currentSkill.name || '').trim()) return;
    const nextSkill = {
      id: activeEditor?.type === 'skill' && activeEditor?.id ? activeEditor.id : Date.now(),
      name: currentSkill.name.trim(),
      level: Number(currentSkill.level) || 0,
    };
    const updatedSkills = activeEditor?.id
      ? skills.map((skill) => (skill.id === activeEditor.id ? nextSkill : skill))
      : [...skills, nextSkill];
    onUpdate({ skills: updatedSkills });
    closeEditor();
  };

  const handleSaveLanguage = () => {
    if (!(currentLanguage.name || '').trim()) return;
    const nextLanguage = {
      id: activeEditor?.type === 'language' && activeEditor?.id ? activeEditor.id : Date.now(),
      name: currentLanguage.name.trim(),
      level: Number(currentLanguage.level) || 0,
    };
    const updatedLanguages = activeEditor?.id
      ? languages.map((entry) => (entry.id === activeEditor.id ? nextLanguage : entry))
      : [...languages, nextLanguage];
    onUpdate({ languages: updatedLanguages });
    closeEditor();
  };

  const handleRemoveSkill = (id) => onUpdate({ skills: skills.filter((skill) => skill.id !== id) });
  const handleRemoveLanguage = (id) => onUpdate({ languages: languages.filter((entry) => entry.id !== id) });

  const isSkillEditor = activeEditor?.type === 'skill';
  const modalTitle = isSkillEditor
    ? (activeEditor?.id ? `${t('common-edit')} ${t('account-setup-step-3-skill-name')}` : t('account-setup-step-3-add-skill'))
    : (activeEditor?.id ? `${t('common-edit')} ${t('account-setup-step-3-languages')}` : t('account-setup-step-3-add-language'));

  return (
    <div className="step3-wrapper skills-lab-step">
      <div className="lab-layout">
        {/* SKILLS PANEL */}
        <section className="lab-panel crystal-panel skill-panel">
          <div className="lab-panel-header">
            <div className="header-core">
              <div className="header-orb"><i className="fas fa-laptop-code" /></div>
              <div className="header-text">
                <h3>{t('account-setup-step-3-skills-expertise')}</h3>
                <div className="header-meta">
                  <span className="meta-pill count">{skills.length}</span>
                  <span className="meta-pill strong">{t('strongest_label')}: <strong>{getTopItem(skills)}</strong></span>
                </div>
              </div>
            </div>
            <button className="lab-add-btn" onClick={() => openSkillEditor()}>
              <i className="fas fa-plus" />
            </button>
          </div>

          <div className="lab-scroller">
            {skills.length === 0 ? (
              <div className="lab-empty">
                <i className="fas fa-microchip" />
                <p>{t('account-setup-step-3-no-skills')}</p>
              </div>
            ) : (
              <div className="lab-items">
                {skills.map((skill) => (
                  <div key={skill.id} className="lab-card skill">
                    <div className="card-info">
                      <div className="card-titles">
                        <strong>{skill.name}</strong>
                        <span>{getLevelLabel(skill.level, 'skill')}</span>
                      </div>
                      <div className="card-progress">
                        <div className="progress-fill" style={{ width: `${skill.level}%` }} />
                      </div>
                    </div>
                    <div className="card-actions">
                      <span className="card-percent">{skill.level}%</span>
                      <div className="btn-group">
                        <button onClick={() => openSkillEditor(skill)}><i className="fas fa-pen" /></button>
                        <button onClick={() => handleRemoveSkill(skill.id)}><i className="fas fa-trash-alt" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* LANGUAGES PANEL */}
        <section className="lab-panel crystal-panel language-panel">
          <div className="lab-panel-header">
            <div className="header-core">
              <div className="header-orb alt"><i className="fas fa-language" /></div>
              <div className="header-text">
                <h3>{t('account-setup-step-3-languages')}</h3>
                <div className="header-meta">
                  <span className="meta-pill count">{languages.length}</span>
                  <span className="meta-pill strong">{t('strongest_label')}: <strong>{getTopItem(languages)}</strong></span>
                </div>
              </div>
            </div>
            <button className="lab-add-btn alt" onClick={() => openLanguageEditor()}>
              <i className="fas fa-plus" />
            </button>
          </div>

          <div className="lab-scroller">
            {languages.length === 0 ? (
              <div className="lab-empty">
                <i className="fas fa-globe" />
                <p>{t('account-setup-step-3-no-languages')}</p>
              </div>
            ) : (
              <div className="lab-items">
                {languages.map((entry) => (
                  <div key={entry.id} className="lab-card language">
                    <div className="card-info">
                      <div className="card-titles">
                        <strong>{entry.name}</strong>
                        <span>{getLevelLabel(entry.level, 'language')}</span>
                      </div>
                      <div className="card-progress">
                        <div className="progress-fill" style={{ width: `${entry.level}%` }} />
                      </div>
                    </div>
                    <div className="card-actions">
                      <span className="card-percent">{entry.level}%</span>
                      <div className="btn-group">
                        <button onClick={() => openLanguageEditor(entry)}><i className="fas fa-pen" /></button>
                        <button onClick={() => handleRemoveLanguage(entry.id)}><i className="fas fa-trash-alt" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <SetupModal
        isOpen={Boolean(activeEditor)}
        onClose={closeEditor}
        icon={isSkillEditor ? 'fas fa-laptop-code' : 'fas fa-language'}
        title={modalTitle}
        closeLabel={t('common-cancel')}
      >
        <div className="lab-modal-content">
          <div className="lab-modal-field">
            <label className="field-premium-label">{isSkillEditor ? t('account-setup-step-3-skill-name') : t('account-setup-step-3-languages')}</label>
            <div className="input-glass-wrap">
              <i className={`fas ${isSkillEditor ? 'fa-terminal' : 'fa-font'} input-glass-icon`} />
              <input
                type="text"
                value={isSkillEditor ? currentSkill.name : currentLanguage.name}
                onChange={(e) => isSkillEditor ? setCurrentSkill({ ...currentSkill, name: e.target.value }) : setCurrentLanguage({ ...currentLanguage, name: e.target.value })}
                placeholder={isSkillEditor ? t('skill_placeholder') : t('language_placeholder')}
                className="input-glass-field"
              />
            </div>
          </div>

          <div className="lab-modal-field">
            <div className="label-row">
              <label className="field-premium-label">{t('account-setup-step-3-proficiency')}</label>
              <span className="prof-value">{(isSkillEditor ? currentSkill.level : currentLanguage.level)}%</span>
            </div>
            <div className="premium-range-wrap">
              <input
                type="range"
                min="0"
                max="100"
                value={isSkillEditor ? currentSkill.level : currentLanguage.level}
                onChange={(e) => isSkillEditor ? setCurrentSkill({ ...currentSkill, level: parseInt(e.target.value) }) : setCurrentLanguage({ ...currentLanguage, level: parseInt(e.target.value) })}
                className="premium-range"
              />
              <div className="range-milestones">
                <span>{isSkillEditor ? t('account-setup-step-3-beginner') : t('account-setup-step-3-basic')}</span>
                <span>{isSkillEditor ? t('account-setup-step-3-intermediate') : t('account-setup-step-3-conversational')}</span>
                <span>{isSkillEditor ? t('account-setup-step-3-expert') : t('account-setup-step-3-fluent')}</span>
              </div>
            </div>
          </div>

          <div className="lab-modal-actions">
            <button className="lab-btn secondary" onClick={closeEditor}>{t('common-cancel')}</button>
            <button className={`lab-btn primary ${!isSkillEditor ? 'alt' : ''}`} onClick={isSkillEditor ? handleSaveSkill : handleSaveLanguage}>
              {activeEditor?.id ? t('common-edit') : t('common-add')}
            </button>
          </div>
        </div>
      </SetupModal>
    </div>
  );
};

export default Step3;
