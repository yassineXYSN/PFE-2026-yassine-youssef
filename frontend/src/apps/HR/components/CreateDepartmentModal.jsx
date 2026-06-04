import React, { useState } from 'react';
import { apiFetch } from '../../../core/api';
import { useLanguage } from '../../../core/useLanguage';
import './CreateDepartmentModal.css';

const CreateDepartmentModal = ({ isOpen, onClose, companyId, onSuccess }) => {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError(t('hr-modal-dept-error-name-required'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const newDept = await apiFetch('/departments/', {
                method: 'POST',
                body: JSON.stringify({
                    name: name.trim(),
                    company_id: companyId,
                    description: description.trim(),
                    color: 'blue', // Default values
                    icon: 'group'
                })
            });
            
            onSuccess(newDept);
            setName('');
            setDescription('');
            onClose();
        } catch (err) {
            console.error("Error creating department in modal:", err);
            setError(err.message || t('hr-modal-dept-error-create'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dept-modal-overlay">
            <div className="dept-modal-card">
                <h2 className="dept-modal-title">{t('hr-modal-dept-title')}</h2>
                <p className="dept-modal-subtitle">{t('hr-modal-dept-subtitle')}</p>

                <form className="dept-modal-form" onSubmit={handleSubmit}>
                    {error && <div className="dept-modal-error">{error}</div>}

                    <div className="dept-modal-field">
                        <label>{t('hr-modal-dept-name-label')}</label>
                        <input
                            type="text"
                            className="dept-modal-input"
                            placeholder={t('hr-modal-dept-name-placeholder')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="dept-modal-field">
                        <label>{t('hr-modal-dept-desc-label')}</label>
                        <textarea
                            className="dept-modal-textarea"
                            placeholder={t('hr-modal-dept-desc-placeholder')}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="dept-modal-actions">
                        <button type="button" className="dept-modal-btn-secondary" onClick={onClose} disabled={loading}>
                            {t('hr-modal-dept-cancel')}
                        </button>
                        <button type="submit" className="dept-modal-btn-primary" disabled={loading}>
                            {loading ? t('hr-modal-dept-creating') : t('hr-modal-dept-submit')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateDepartmentModal;
