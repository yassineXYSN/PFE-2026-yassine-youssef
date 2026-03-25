import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../core/api';
import './CVViewerModal.css';

const CVViewerModal = ({ isOpen, onClose, applicationId, candidateName }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    useEffect(() => {
        let objectUrl = null;

        const fetchCV = async () => {
            if (!isOpen || !applicationId) return;
            
            setLoading(true);
            setError(false);
            
            try {
                // Fetch as blob to include Auth headers
                const response = await apiFetch(`/applications/${applicationId}/cv`, {
                    headers: { 'Accept': 'application/pdf' }
                }, true); // The third param rawResponse=true to get the blob/response

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'No error detail');
                    console.error(`CV Fetch Failed: Status ${response.status}`, errorText);
                    throw new Error(`Failed to fetch CV: ${response.status}`);
                }
                
                const blob = await response.blob();
                objectUrl = URL.createObjectURL(blob);
                setPdfUrl(objectUrl);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching CV:", err);
                setError(true);
                setLoading(false);
            }
        };

        fetchCV();

        // Cleanup the object URL when modal closes or ID changes
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [isOpen, applicationId]);

    if (!isOpen) return null;

    return (
        <div className="cv-viewer-overlay" onClick={onClose}>
            <div className="cv-viewer-card" onClick={(e) => e.stopPropagation()}>
                
                <header className="cv-viewer-header">
                    <div className="cv-viewer-info">
                        <span className="cv-viewer-subtitle">Curriculum Vitæ</span>
                        <h2 className="cv-viewer-title">{candidateName || 'Candidate CV'}</h2>
                    </div>
                    
                    <div className="cv-viewer-actions">
                        <button className="cv-viewer-close" onClick={onClose} title="Close">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </header>

                <div className="cv-viewer-content">
                    {loading && (
                        <div className="cv-viewer-loader">
                            <div className="cv-spinner"></div>
                            <p className="tf-meta-subtitle">Chargement du document...</p>
                        </div>
                    )}
                    
                    {error ? (
                        <div className="cv-viewer-loader">
                            <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '3rem', marginBottom: '1rem' }}>error</span>
                            <p className="tf-meta-title">Document non disponible</p>
                            <p className="tf-meta-subtitle">Le CV n'est pas disponible pour cette candidature.</p>
                            <button className="tf-btn tf-btn-secondary" onClick={onClose} style={{ marginTop: '1.5rem' }}>Fermer</button>
                        </div>
                    ) : (
                        pdfUrl && (
                            <iframe 
                                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                                className="cv-iframe"
                                title="CV Viewer"
                            />
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default CVViewerModal;
