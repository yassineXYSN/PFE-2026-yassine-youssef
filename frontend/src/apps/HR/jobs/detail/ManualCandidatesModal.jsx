import React, { useCallback, useRef, useState } from 'react';
import { useLanguage } from '../../../../core/useLanguage';
// eslint-disable-next-line no-unused-vars -- consumed by the parsing/submit phases added in Tasks 8-10
import { apiFetch } from '../../../../core/api';
import './ManualCandidatesModal.css';

const ACCEPTED_EXTS = ['.pdf', '.doc', '.docx'];

const isAcceptedFile = (file) => {
    const name = (file?.name || '').toLowerCase();
    return ACCEPTED_EXTS.some((ext) => name.endsWith(ext));
};

// eslint-disable-next-line no-unused-vars -- jobId/onCandidatesAdded consumed by the parsing/submit phases added in Tasks 8-10
const ManualCandidatesModal = ({ isOpen, onClose, jobId, onCandidatesAdded }) => {
    const { t } = useLanguage();
    const [phase, setPhase] = useState('drop'); // 'drop' | 'parsing' | 'review' | 'submitting' | 'result'
    const [queue, setQueue] = useState([]);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const resetAndClose = useCallback(() => {
        setPhase('drop');
        setQueue([]);
        onClose();
    }, [onClose]);

    const handleFilesSelected = useCallback((fileList) => {
        const files = Array.from(fileList || []).filter(isAcceptedFile);
        if (files.length === 0) return;
        setQueue((prev) => [
            ...prev,
            ...files.map((file) => ({
                localId: crypto.randomUUID(),
                file,
                status: 'queued',
                error: null,
                stagedId: null,
                profile: null,
                decision: 'pending',
            })),
        ]);
    }, []);

    const removeQueuedFile = useCallback((localId) => {
        setQueue((prev) => prev.filter((q) => q.localId !== localId));
    }, []);

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFilesSelected(e.dataTransfer.files);
    };

    if (!isOpen) return null;

    return (
        <div className="mcm-overlay" onClick={resetAndClose}>
            <div className="mcm-card" onClick={(e) => e.stopPropagation()}>
                <header className="mcm-header">
                    <h2>{t('hr-manual-modal-title')}</h2>
                    <button type="button" className="mcm-close" onClick={resetAndClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                <div className="mcm-body">
                    {phase === 'drop' && (
                        <>
                            <div
                                className={`mcm-dropzone${dragOver ? ' mcm-dropzone--over' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={onDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <span className="material-symbols-outlined mcm-dropzone-icon">cloud_upload</span>
                                <strong>{t('hr-manual-modal-drop-title')}</strong>
                                <span className="mcm-dropzone-hint">{t('hr-manual-modal-drop-hint')}</span>
                                <span className="mcm-dropzone-browse">{t('hr-manual-modal-browse')}</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx"
                                    className="mcm-hidden-input"
                                    onChange={(e) => handleFilesSelected(e.target.files)}
                                />
                            </div>

                            {queue.length > 0 && (
                                <div className="mcm-queued-list">
                                    <p className="mcm-queued-count">
                                        {t('hr-manual-modal-queued-count').replace('{count}', queue.length)}
                                    </p>
                                    {queue.map((q) => (
                                        <div key={q.localId} className="mcm-queued-row">
                                            <span className="material-symbols-outlined">description</span>
                                            <span className="mcm-queued-name">{q.file.name}</span>
                                            <button
                                                type="button"
                                                className="mcm-queued-remove"
                                                onClick={() => removeQueuedFile(q.localId)}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mcm-actions">
                                <button type="button" className="mcm-btn mcm-btn--secondary" onClick={resetAndClose}>
                                    {t('hr-manual-modal-cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="mcm-btn mcm-btn--primary"
                                    disabled={queue.length === 0}
                                    onClick={() => setPhase('parsing')}
                                >
                                    {t('hr-manual-modal-start-parsing')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManualCandidatesModal;
