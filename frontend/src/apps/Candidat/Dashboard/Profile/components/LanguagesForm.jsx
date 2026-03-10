import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const LanguagesForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [languages, setLanguages] = useState(() => {
        if (initialData && Array.isArray(initialData)) {
            return initialData.map(l => ({
                ...l,
                level: typeof l.level === 'number' ? l.level : (l.level === 'Native' ? 100 : l.level === 'Fluent' ? 75 : l.level === 'Intermediate' ? 50 : 25)
            }));
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
        setLanguages([...languages, item]);
        setNewItem({ name: '', level: 50 });
    };

    const handleRemoveItem = (id) => {
        setLanguages(languages.filter(item => item.id !== id));
    };

    const getLevelLabel = (level) => {
        if (level >= 90) return t('lang-native') || 'Native';
        if (level >= 70) return t('lang-fluent') || 'Fluent';
        if (level >= 40) return t('lang-conversational') || 'Conversational';
        return t('lang-beginner') || 'Beginner';
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(languages);
    };

    return (
        <div className="profile-form-container">
            <div className="v-form-header">
                <h3 className="v-form-title">{t('profile-edit-languages-title') || 'Languages Proficiency'}</h3>
                <p className="v-form-subtitle">{t('profile-edit-languages-desc') || 'Define your linguistic capabilities for global opportunities.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="v-form-grid">
                <div style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.05))',
                    padding: '1.5rem',
                    borderRadius: 'var(--vf-radius-card)',
                    border: '1.5px solid var(--vf-accent)',
                    boxShadow: '0 8px 20px -5px rgba(59, 130, 246, 0.2)'
                }}>
                    <div className="v-form-row">
                        <div className="v-form-group">
                            <label className="v-label">{t('profile-language-label') || 'Language'}</label>
                            <input
                                type="text"
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                className="v-input"
                                placeholder="e.g., English, Spanish"
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                            />
                        </div>
                        <div className="v-form-group">
                            <label className="v-label">
                                {t('profile-proficiency') || 'Proficiency'}: <span style={{ color: 'var(--vf-accent)', fontWeight: 700, marginLeft: '0.5rem' }}>{getLevelLabel(newItem.level)}</span>
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
                                        accentColor: 'var(--vf-accent)',
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
                        style={{ width: '100%', marginTop: '1.25rem', justifyContent: 'center', background: 'linear-gradient(135deg, var(--vf-accent), var(--vf-primary))' }}
                        disabled={!newItem.name.trim()}
                    >
                        <span className="material-symbols-outlined">translate</span>
                        {t('profile-register-language') || 'Register Language'}
                    </button>
                </div>

                {languages.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                        {languages.map((item) => (
                            <div key={item.id} style={{
                                background: 'var(--vf-bg-glass)',
                                padding: '1.25rem',
                                borderRadius: 'var(--vf-radius-input)',
                                border: '1.5px solid var(--vf-border-glass)',
                                backdropFilter: 'blur(10px)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                transition: 'all 0.3s ease'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: 'var(--vf-accent)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '0.8rem'
                                }}>
                                    {item.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, color: 'var(--vf-text-main)', fontSize: '0.95rem' }}>{item.name}</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--vf-accent)' }}>{getLevelLabel(item.level)}</div>
                                </div>
                                <span className="material-symbols-outlined" style={{ color: 'var(--vf-secondary)', cursor: 'pointer', fontSize: '1.1rem' }} onClick={() => handleRemoveItem(item.id)}>delete</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="v-btn-actions">
                    <button type="button" onClick={onCancel} className="v-btn v-btn-secondary">
                        {t('common-cancel') || 'Cancel'}
                    </button>
                    <button type="submit" className="v-btn v-btn-primary" disabled={languages.length === 0 && !newItem.name.trim()}>
                        {t('profile-save-changes') || 'Finalize Languages'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LanguagesForm;
