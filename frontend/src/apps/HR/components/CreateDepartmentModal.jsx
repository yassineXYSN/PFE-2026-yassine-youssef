import React, { useState } from 'react';
import { apiFetch } from '../../../core/api';
import './CreateDepartmentModal.css';

const CreateDepartmentModal = ({ isOpen, onClose, companyId, onSuccess }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Le nom du département est requis.");
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
            setError(err.message || "Erreur lors de la création du département.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dept-modal-overlay">
            <div className="dept-modal-card">
                <h2 className="dept-modal-title">Nouveau Département</h2>
                <p className="dept-modal-subtitle">Ajoutez un département sans quitter la création de l'offre.</p>
                
                <form className="dept-modal-form" onSubmit={handleSubmit}>
                    {error && <div className="dept-modal-error">{error}</div>}
                    
                    <div className="dept-modal-field">
                        <label>Nom du département</label>
                        <input 
                            type="text" 
                            className="dept-modal-input" 
                            placeholder="ex: Ressources Humaines"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="dept-modal-field">
                        <label>Description (optionnelle)</label>
                        <textarea 
                            className="dept-modal-textarea" 
                            placeholder="Missions du département..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    
                    <div className="dept-modal-actions">
                        <button type="button" className="dept-modal-btn-secondary" onClick={onClose} disabled={loading}>
                            Annuler
                        </button>
                        <button type="submit" className="dept-modal-btn-primary" disabled={loading}>
                            {loading ? 'Création...' : 'Créer le département'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateDepartmentModal;
