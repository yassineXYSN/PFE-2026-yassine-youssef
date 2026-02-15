import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../../../core/useLanguage';

const AboutForm = ({ initialData, onSave, onCancel }) => {
    const { t } = useLanguage();
    const [about, setAbout] = useState('');

    useEffect(() => {
        if (initialData) {
            setAbout(initialData.about || '');
        }
    }, [initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ about });
    };

    return (
        <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
                <label>{t('about-me') || 'About Me'}</label>
                <textarea
                    required
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    className="form-textarea"
                    rows="8"
                    placeholder="Tell us about yourself, your passions, and what drives you..."
                />
            </div>

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
            </div>
        </form>
    );
};

export default AboutForm;
