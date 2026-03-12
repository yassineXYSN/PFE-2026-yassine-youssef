import React from 'react';
import './ConfirmationModal.css';

const ConfirmationModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title = "Confirmation", 
    message = "Êtes-vous sûr de vouloir effectuer cette action ?", 
    confirmText = "Confirmer", 
    cancelText = "Annuler",
    type = "danger" // 'danger' or 'primary'
}) => {
    if (!isOpen) return null;

    return (
        <div className="confirmation-modal-overlay" onClick={onClose}>
            <div className="confirmation-modal-content" onClick={e => e.stopPropagation()}>
                <div className="confirmation-modal-header">
                    <span className={`material-symbols-outlined icon-${type}`}>
                        {type === 'danger' ? 'warning' : 'info'}
                    </span>
                    <h3>{title}</h3>
                </div>
                <div className="confirmation-modal-body">
                    <p>{message}</p>
                </div>
                <div className="confirmation-modal-footer">
                    <button className="btn-cancel" onClick={onClose}>
                        {cancelText}
                    </button>
                    <button className={`btn-confirm btn-${type}`} onClick={onConfirm}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
