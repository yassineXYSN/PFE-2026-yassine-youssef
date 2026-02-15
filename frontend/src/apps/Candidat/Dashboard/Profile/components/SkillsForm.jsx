import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const SkillsForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [skills, setSkills] = useState([]);
    const [newSkill, setNewSkill] = useState({ name: '', level: 50 });

    useEffect(() => {
        if (initialData && Array.isArray(initialData)) {
            // Check if data has levels, if not default to 50
            const mappedData = initialData.map(s => ({
                ...s,
                level: typeof s.level === 'number' ? s.level : 50
            }));
            setSkills(mappedData);
        }
    }, [initialData]);

    const handleAdd = () => {
        if (newSkill.name.trim()) {
            setSkills([...skills, { id: `skill-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...newSkill }]);
            setNewSkill({ name: '', level: 50 });
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    const handleRemove = (id) => {
        setSkills(skills.filter(s => s.id !== id));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(skills);
    };

    return (
        <form onSubmit={handleSubmit} className="profile-form">

            {/* Input Section */}
            <div className="skill-input-group">
                <div className="input-with-label">
                    <label className="input-label">Skill Name</label>
                    <input
                        type="text"
                        value={newSkill.name}
                        onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                        onKeyPress={handleKeyPress}
                        className="skill-input"
                        placeholder="e.g., React, Figma"
                    />
                </div>

                <div className="input-with-label">
                    <label className="input-label">Expertise: {newSkill.level}%</label>
                    <div className="level-slider-container">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={newSkill.level}
                            onChange={(e) => setNewSkill({ ...newSkill, level: parseInt(e.target.value) })}
                            className="skill-slider"
                        />
                        <div className="slider-labels">
                            <span>Beginner</span>
                            <span>Intermediate</span>
                            <span>Expert</span>
                        </div>
                    </div>
                </div>

                <button type="button" onClick={handleAdd} className="add-button">
                    <span className="material-symbols-outlined">add</span>
                    <span>Add Skill</span>
                </button>
            </div>

            {/* List Section */}
            <div className="form-group">
                <label className="input-label">Added Skills</label>
                <div className="items-grid">
                    {skills.length === 0 ? (
                        <div className="items-empty-state">
                            <span className="material-symbols-outlined">stars</span>
                            <p>No skills added yet</p>
                        </div>
                    ) : (
                        skills.map(skill => (
                            <div key={skill.id} className="skill-card">
                                <div className="card-header">
                                    <span className="card-name">{skill.name}</span>
                                    <button type="button" onClick={() => handleRemove(skill.id)} className="card-remove">
                                        <span className="material-symbols-outlined">close</span>
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

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">Save Skills</button>
            </div>
        </form>
    );
};

export default SkillsForm;
