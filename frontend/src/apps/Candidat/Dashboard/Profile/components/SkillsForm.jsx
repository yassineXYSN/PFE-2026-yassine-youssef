import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const SkillsForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [skills, setSkills] = useState(() => {
        if (initialData && Array.isArray(initialData)) {
            return initialData.map(s => ({ ...s }));
        }
        return [];
    });
    const [newItem, setNewItem] = useState({ name: '', level: 50 });

    const handleAddItem = () => {
        if (!newItem.name.trim()) return;
        const item = {
            id: Date.now(),
            name: newItem.name.trim(),
            level: newItem.level
        };
        setSkills([...skills, item]);
        setNewItem({ name: '', level: 50 });
    };

    const handleRemoveItem = (id) => {
        setSkills(skills.filter(item => item.id !== id));
    };

    const getLevelLabel = (level) => {
        if (level >= 80) return t('skill-expert') || 'Expert';
        if (level >= 50) return t('skill-intermediate') || 'Intermediate';
        return t('skill-beginner') || 'Beginner';
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(skills);
    };

    return (
        <div className="profile-form-container">
            <div className="v-form-header">
                <h3 className="v-form-title">{t('profile-edit-skills-title') || 'Expertise & Skills'}</h3>
                <p className="v-form-subtitle">{t('profile-edit-skills-desc') || 'Showcase the technologies and methodologies you master.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="v-form-grid">
                {/* Add Skill Area */}
                <div style={{
                    background: 'linear-gradient(135deg, var(--vf-primary-glow), rgba(79, 70, 229, 0.05))',
                    padding: '1.5rem',
                    borderRadius: 'var(--vf-radius-card)',
                    border: '1.5px solid var(--vf-primary)',
                    boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.2)'
                }}>
                    <div className="v-form-row">
                        <div className="v-form-group">
                            <label className="v-label">{t('profile-skill-name') || 'Skill Name'}</label>
                            <input
                                type="text"
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                className="v-input"
                                placeholder="e.g., React, AI Engineering"
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                            />
                        </div>
                        <div className="v-form-group">
                            <label className="v-label">
                                {t('profile-mastery') || 'Mastery'}: <span style={{ color: 'var(--vf-primary)', fontWeight: 700, marginLeft: '0.5rem' }}>{getLevelLabel(newItem.level)}</span>
                            </label>
                            <div style={{ padding: '0.5rem 0' }}>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="10"
                                    value={newItem.level}
                                    onChange={(e) => setNewItem({ ...newItem, level: parseInt(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        accentColor: 'var(--vf-primary)',
                                        height: '6px',
                                        borderRadius: '99px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="v-btn v-btn-primary"
                        style={{ width: '100%', marginTop: '1.25rem', justifyContent: 'center' }}
                        disabled={!newItem.name.trim()}
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        {t('profile-add-skill') || 'Add Skill'}
                    </button>
                </div>

                {/* Skills Grid */}
                {skills.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                        {skills.map((item) => (
                            <div key={item.id} style={{
                                background: 'var(--vf-bg-glass)',
                                padding: '1.25rem',
                                borderRadius: 'var(--vf-radius-input)',
                                border: '1.5px solid var(--vf-border-glass)',
                                backdropFilter: 'blur(10px)',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                transition: 'all 0.3s ease'
                            }} className="v-skill-card">
                                <div style={{ fontWeight: 700, color: 'var(--vf-text-main)', fontSize: '1rem' }}>{item.name}</div>
                                <div style={{ width: '100%', height: '5px', background: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                                    <div style={{ width: `${item.level}%`, height: '100%', background: 'linear-gradient(90deg, var(--vf-primary), var(--vf-secondary))' }}></div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--vf-text-muted)' }}>{getLevelLabel(item.level)}</span>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--vf-secondary)', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => handleRemoveItem(item.id)}>delete</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="v-btn-actions">
                    <button type="button" onClick={onCancel} className="v-btn v-btn-secondary">
                        {t('common-cancel') || 'Cancel'}
                    </button>
                    <button type="submit" className="v-btn v-btn-primary" disabled={skills.length === 0 && !newItem.name.trim()}>
                        <span className="material-symbols-outlined">check</span>
                        {t('profile-apply-changes') || 'Apply'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SkillsForm;
