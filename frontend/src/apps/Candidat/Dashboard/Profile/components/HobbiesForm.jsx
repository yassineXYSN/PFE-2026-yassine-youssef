import React, { useState } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const HobbiesForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [hobbies, setHobbies] = useState(() => {
        if (initialData && Array.isArray(initialData)) {
            return initialData.map(h => ({ ...h }));
        }
        return [];
    });
    const [newItem, setNewItem] = useState('');

    const handleAddItem = () => {
        if (!newItem.trim()) return;
        const item = {
            id: Date.now(),
            name: newItem.trim()
        };
        setHobbies([...hobbies, item]);
        setNewItem('');
    };

    const handleRemoveItem = (id) => {
        setHobbies(hobbies.filter(item => item.id !== id));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(hobbies);
    };

    return (
        <div className="profile-form-container">
            <div className="v-form-header">
                <h3 className="v-form-title">{t('profile-edit-hobbies-title') || 'Interests & Hobbies'}</h3>
                <p className="v-form-subtitle">{t('profile-edit-hobbies-desc') || 'Share what moves you outside of work to show your personality.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="v-form-grid">
                <div style={{
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(139, 92, 246, 0.05))',
                    padding: '1.5rem',
                    borderRadius: 'var(--vf-radius-card)',
                    border: '1.5px solid var(--vf-secondary)',
                    boxShadow: '0 8px 20px -5px rgba(236, 72, 153, 0.2)'
                }}>
                    <label className="v-label">{t('profile-add-hobby') || 'Add a Hobby'}</label>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem' }}>
                        <input
                            type="text"
                            value={newItem}
                            onChange={(e) => setNewItem(e.target.value)}
                            className="v-input"
                            placeholder="e.g., Photography, Skydiving, Chess"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                            style={{ flex: 1 }}
                        />
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="v-btn v-btn-primary"
                            style={{ background: 'var(--vf-secondary)' }}
                            disabled={!newItem.trim()}
                        >
                            <span className="material-symbols-outlined">add</span>
                            {t('profile-add-btn') || 'Add'}
                        </button>
                    </div>
                </div>

                {hobbies.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
                        {hobbies.map((item) => (
                            <div key={item.id} style={{
                                background: 'var(--vf-bg-glass)',
                                padding: '0.6rem 1.2rem',
                                borderRadius: '99px',
                                border: '1.5px solid var(--vf-border-glass)',
                                color: 'var(--vf-text-main)',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}>
                                <span>{item.name}</span>
                                <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: '1.1rem', cursor: 'pointer', color: 'var(--vf-text-muted)' }}
                                    onClick={() => handleRemoveItem(item.id)}
                                    onMouseOver={(e) => e.target.style.color = 'var(--vf-secondary)'}
                                    onMouseOut={(e) => e.target.style.color = 'var(--vf-text-muted)'}
                                >
                                    close
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <style>{`
                    @keyframes popIn {
                        from { transform: scale(0.8); opacity: 0; }
                        to { transform: scale(1); opacity: 1; }
                    }
                `}</style>

                <div className="v-btn-actions">
                    <button type="button" onClick={onCancel} className="v-btn v-btn-secondary">
                        {t('common-cancel') || 'Cancel'}
                    </button>
                    <button type="submit" className="v-btn v-btn-primary" disabled={hobbies.length === 0 && !newItem.trim()}>
                        {t('profile-save-changes') || 'Update Interests'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default HobbiesForm;
