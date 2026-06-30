import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './SetupModal.css';

const SetupModal = ({
  isOpen,
  onClose,
  icon = 'fas fa-plus',
  title,
  description,
  children,
  closeLabel = 'Close',
  wide = false,
}) => {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div className="setup-modal-overlay" onClick={onClose}>
      <div
        className={`setup-modal-card ${wide ? 'wide' : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          type="button"
          className="setup-modal-close"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <i className="fas fa-times"></i>
        </button>

        <div className="setup-modal-header">
          <div className="setup-modal-icon">
            <i className={icon}></i>
          </div>
          <div className="setup-modal-copy">
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
        </div>

        <div className="setup-modal-body">
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};

export default SetupModal;
