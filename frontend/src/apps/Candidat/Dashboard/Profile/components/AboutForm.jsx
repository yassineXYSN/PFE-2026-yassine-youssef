import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const AboutForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [about, setAbout] = useState('');
    const maxChars = 1400;
    const minWords = 20;

    useEffect(() => {
        if (initialData) {
            setAbout(initialData.about || '');
        }
    }, [initialData]);

    const normalizedText = about.trim();
    const characterCount = normalizedText.length;
    const wordCount = normalizedText ? normalizedText.split(/\s+/).length : 0;
    const isLowLength = characterCount > 0 && characterCount < 120;
    const isReadyToSave = characterCount > 0 && wordCount >= minWords;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ about: about.trim() });
    };

    return (
        <div className="profile-form-container">
            <div className="v-form-header">
                <h3 className="v-form-title">{t('about-me') || 'About Me'}</h3>
                <p className="v-form-subtitle">
                    {t('profile-about-helper') || 'Write a clear summary of your experience, strongest skills, and the kind of work you want next.'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="v-form-grid">
                <div className="v-form-group">
                    <label className="v-label required">
                        {t('profile-about-label') || 'Professional Summary'}
                    </label>

                    <div className="v-input-wrapper">
                        <textarea
                            required
                            maxLength={maxChars}
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                            className="v-textarea"
                            rows="10"
                            placeholder="Describe your journey, passion, and expertise..."
                        />
                    </div>

                    <div className="v-about-meta">
                        <div className={`v-form-hint ${isLowLength ? 'warning' : ''}`} style={{ flex: 1 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', verticalAlign: 'middle', marginRight: '0.4rem' }}>
                                {isLowLength ? 'priority_high' : 'info'}
                            </span>
                            {isLowLength
                                ? (t('profile-about-hint-short') || 'Add a bit more detail for better impact.')
                                : (t('profile-about-tip') || 'Include concrete impact and specific tools.')}
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div className={`v-counter-pill ${wordCount < minWords ? 'warning' : ''}`}>
                                {wordCount} {t('profile-about-words') || 'words'}
                            </div>
                            <div className={`v-counter-pill ${characterCount > maxChars * 0.9 ? 'warning' : ''}`}>
                                {characterCount} / {maxChars}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="v-btn-actions">
                    <button type="button" onClick={onCancel} className="v-btn v-btn-secondary">
                        {t('common-cancel') || 'Cancel'}
                    </button>
                    <button type="submit" className="v-btn v-btn-primary" disabled={!isReadyToSave}>
                        <span className="material-symbols-outlined">check</span>
                        {t('profile-apply-changes') || 'Apply'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AboutForm;
