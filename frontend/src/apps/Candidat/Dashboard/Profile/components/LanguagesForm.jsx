import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const LanguagesForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [languages, setLanguages] = useState([]);
    const [newLang, setNewLang] = useState({ name: '', level: 50 }); // Level as percentage

    useEffect(() => {
        if (initialData && Array.isArray(initialData)) {
            // If data comes in with string levels, we might need to map them to numbers or handle both.
            // For now assuming we start fresh or data matches. 
            // If existing data has string levels, we'll need a mapper.
            // Let's simple-map existing strings to % for the slider if needed.
            const mappedData = initialData.map(l => ({
                ...l,
                level: typeof l.level === 'number' ? l.level : (l.level === 'Native' ? 100 : l.level === 'Fluent' ? 75 : l.level === 'Intermediate' ? 50 : 25)
            }));
            setLanguages(mappedData);
        }
    }, [initialData]);

    const handleAdd = () => {
        if (newLang.name.trim()) {
            setLanguages([...languages, { id: `lang-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...newLang }]);
            setNewLang({ name: '', level: 50 });
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    const handleRemove = (id) => {
        setLanguages(languages.filter(l => l.id !== id));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Convert back to string if needed by backend, or keep as number. 
        // For consistency with ProfilePage display (which expects strings currently), let's map back OR update ProfilePage.
        // User asked for "like Step 3" which uses numbers. I'll save as numbers.
        onSave(languages);
    };

    return (
        <form onSubmit={handleSubmit} className="profile-form">

            {/* Input Section */}
            <div className="skill-input-group">
                <div className="input-with-label">
                    <label className="input-label">Language Name</label>
                    <input
                        type="text"
                        value={newLang.name}
                        onChange={(e) => setNewLang({ ...newLang, name: e.target.value })}
                        onKeyPress={handleKeyPress}
                        className="skill-input"
                        placeholder="e.g., French"
                    />
                </div>

                <div className="input-with-label">
                    <label className="input-label">Proficiency: {newLang.level}%</label>
                    <div className="level-slider-container">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={newLang.level}
                            onChange={(e) => setNewLang({ ...newLang, level: parseInt(e.target.value) })}
                            className="skill-slider"
                        />
                        <div className="slider-labels">
                            <span>Beginner</span>
                            <span>Conversational</span>
                            <span>Fluent</span>
                            <span>Native</span>
                        </div>
                    </div>
                </div>

                <button type="button" onClick={handleAdd} className="add-button">
                    <span className="material-symbols-outlined">add</span>
                    <span>Add Language</span>
                </button>
            </div>

            {/* List Section */}
            <div className="form-group">
                <label className="input-label">Added Languages</label>
                <div className="items-grid">
                    {languages.length === 0 ? (
                        <div className="items-empty-state">
                            <span className="material-symbols-outlined">translate</span>
                            <p>No languages added yet</p>
                        </div>
                    ) : (
                        languages.map(lang => (
                            <div key={lang.id} className="language-card">
                                <div className="card-header">
                                    <span className="card-name">{lang.name}</span>
                                    <button type="button" onClick={() => handleRemove(lang.id)} className="card-remove">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                <div className="card-progress">
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${lang.level}%` }}></div>
                                    </div>
                                    <span className="progress-label">{lang.level}%</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">Save Languages</button>
            </div>
        </form>
    );
};

export default LanguagesForm;
