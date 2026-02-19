import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const HobbiesForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [hobbies, setHobbies] = useState([]);
    const [newHobby, setNewHobby] = useState('');

    useEffect(() => {
        if (initialData && Array.isArray(initialData)) {
            setHobbies(initialData);
        }
    }, [initialData]);

    const handleAdd = () => {
        if (newHobby.trim()) {
            setHobbies([...hobbies, { id: `hobby-${Date.now()}-${Math.floor(Math.random() * 1000)}`, name: newHobby.trim() }]);
            setNewHobby('');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    const handleRemove = (id) => {
        setHobbies(hobbies.filter(h => h.id !== id));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(hobbies);
    };

    return (
        <form onSubmit={handleSubmit} className="profile-form">

            {/* Input Section */}
            <div className="skill-input-group">
                <div className="input-with-label">
                    <label className="input-label">Hobby / Interest</label>
                    <input
                        type="text"
                        value={newHobby}
                        onChange={(e) => setNewHobby(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="skill-input"
                        placeholder="e.g., Photography, Hiking"
                    />
                </div>

                <button type="button" onClick={handleAdd} className="add-button">
                    <span className="material-symbols-outlined">add</span>
                    <span>Add Hobby</span>
                </button>
            </div>

            {/* List Section */}
            <div className="form-group">
                <label className="input-label">Added Hobbies</label>
                <div className="items-grid">
                    {hobbies.length === 0 ? (
                        <div className="items-empty-state">
                            <span className="material-symbols-outlined">interests</span>
                            <p>No hobbies added yet</p>
                        </div>
                    ) : (
                        hobbies.map(hobby => (
                            <div key={hobby.id} className="hobby-card">
                                <div className="card-header">
                                    <span className="card-name">{hobby.name}</span>
                                    <button type="button" onClick={() => handleRemove(hobby.id)} className="card-remove">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">Save Hobbies</button>
            </div>
        </form>
    );
};

export default HobbiesForm;
