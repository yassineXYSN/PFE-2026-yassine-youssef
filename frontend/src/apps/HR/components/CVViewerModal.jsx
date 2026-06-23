import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../core/api';
import { useLanguage } from '../../../core/useLanguage';
import './CVViewerModal.css';

const CVViewerModal = ({
    isOpen,
    onClose,
    applicationId,
    candidateName,
    documentEndpoint,
    documentTitle,
    documentSubtitle,
    emptyMessage
}) => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [documentUrl, setDocumentUrl] = useState(null);
    const [documentType, setDocumentType] = useState('');

    useEffect(() => {
        let objectUrl = null;
        const resolvedEndpoint = documentEndpoint || (applicationId ? `/applications/${applicationId}/cv` : null);

        const fetchDocument = async () => {
            if (!isOpen || !resolvedEndpoint) return;

            setLoading(true);
            setError(false);
            setDocumentUrl(null);
            setDocumentType('');

            try {
                const response = await apiFetch(resolvedEndpoint, {}, true);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'No error detail');
                    console.error(`Document fetch failed: Status ${response.status}`, errorText);
                    throw new Error(`Failed to fetch document: ${response.status}`);
                }

                const blob = await response.blob();
                objectUrl = URL.createObjectURL(blob);
                setDocumentUrl(objectUrl);
                setDocumentType(blob.type || response.headers.get('content-type') || '');
                setLoading(false);
            } catch (err) {
                console.error('Error fetching document:', err);
                setError(true);
                setLoading(false);
            }
        };

        fetchDocument();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [applicationId, documentEndpoint, isOpen]);

    if (!isOpen) return null;

    const isImage = documentType.startsWith('image/');
    const viewerTitle = documentTitle || candidateName || 'Document';
    const viewerSubtitle = documentSubtitle || t('hr-modal-cv-subtitle');
    const viewerEmptyMessage = emptyMessage || t('hr-modal-cv-error-default');

    return (
        <div className="cv-viewer-overlay" onClick={onClose}>
            <div className="cv-viewer-card" onClick={(e) => e.stopPropagation()}>
                <header className="cv-viewer-header">
                    <div className="cv-viewer-info">
                        <span className="cv-viewer-subtitle">{viewerSubtitle}</span>
                        <h2 className="cv-viewer-title">{viewerTitle}</h2>
                    </div>

                    <div className="cv-viewer-actions">
                        <button className="cv-viewer-close" onClick={onClose} title={t('hr-modal-cv-close')}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </header>

                <div className="cv-viewer-content">
                    {loading && (
                        <div className="cv-viewer-loader">
                            <div className="fine-linear-loader" style={{ maxWidth: '240px', marginBottom: '1.25rem' }}></div>
                            <p style={{ 
                                fontSize: '0.7rem', 
                                fontWeight: 800, 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.1em',
                                opacity: 0.5
                            }}>
                                {t('hr-modal-cv-loading')}
                            </p>
                        </div>
                    )}

                    {error ? (
                        <div className="cv-viewer-loader">
                            <span
                                className="material-symbols-outlined"
                                style={{ color: '#ef4444', fontSize: '3rem', marginBottom: '1rem' }}
                            >
                                error
                            </span>
                            <p className="tf-meta-title">{t('hr-modal-cv-error-title')}</p>
                            <p className="tf-meta-subtitle">{viewerEmptyMessage}</p>
                            <button className="tf-btn tf-btn-secondary" onClick={onClose} style={{ marginTop: '1.5rem' }}>
                                {t('hr-modal-cv-close')}
                            </button>
                        </div>
                    ) : (
                        documentUrl && (
                            isImage ? (
                                <div className="cv-viewer-media">
                                    <img
                                        src={documentUrl}
                                        alt={viewerTitle}
                                        className="cv-image-preview"
                                    />
                                </div>
                            ) : (
                                <iframe
                                    src={`${documentUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                                    className="cv-iframe"
                                    title={viewerTitle}
                                />
                            )
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default CVViewerModal;
