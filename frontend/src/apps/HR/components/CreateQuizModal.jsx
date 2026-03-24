import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../core/api';
import './CreateQuizModal.css';

const CreateQuizModal = ({ isOpen, onClose, applicationId, jobTitle }) => {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedDoc, setSelectedDoc] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isMultiDoc, setIsMultiDoc] = useState(false);
    const [selectedDocs, setSelectedDocs] = useState([]);
    const [quizTitle, setQuizTitle] = useState(jobTitle ? `Quiz Technique - ${jobTitle}` : '');
    const [nextDocToAdd, setNextDocToAdd] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchDocuments();
            fetchTemplates();
        }
    }, [isOpen]);

    const fetchDocuments = async () => {
        try {
            const data = await apiFetch('/quiz/documents');
            setDocuments(data);
        } catch (err) {
            console.error("Failed to fetch documents", err);
        }
    };

    const fetchTemplates = async () => {
        try {
            const data = await apiFetch('/quiz/templates/list');
            setTemplates(data);
        } catch (err) {
            console.error("Failed to fetch templates", err);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setUploadError(null);

        const formData = new FormData();
        formData.append('file', file);
        if (quizTitle) formData.append('title', quizTitle);

        try {
            const result = await apiFetch('/quiz/upload-document', {
                method: 'POST',
                body: formData
            });

            await fetchDocuments();
            
            // Auto-select or add the new document
            const newDocId = result.document_id;
            if (isMultiDoc) {
                handleAddDocument(newDocId);
            } else {
                setSelectedDoc(newDocId);
            }
        } catch (err) {
            console.error("Upload error:", err);
            setUploadError("Erreur lors de l'envoi du document.");
        } finally {
            setIsUploading(false);
            if (event.target) event.target.value = ''; // Reset input
        }
    };

    const handleAddDocument = (docId) => {
        if (!docId) return;
        const doc = documents.find(d => d.id === docId || d._id === docId);
        const actualId = doc?.id || doc?._id;
        if (!doc || selectedDocs.some(sd => sd.document_id === actualId)) return;

        setSelectedDocs([...selectedDocs, {
            document_id: actualId,
            title: doc.title || doc.filename,
            total_questions: 5,
            difficulty: 'medium'
        }]);
        setNextDocToAdd('');
    };

    const handleRemoveDocument = (docId) => {
        setSelectedDocs(selectedDocs.filter(sd => sd.document_id !== docId));
    };

    const handleUpdateDocConfig = (docId, field, value) => {
        setSelectedDocs(selectedDocs.map(sd => 
            sd.document_id === docId ? { ...sd, [field]: value } : sd
        ));
    };

    const handleGenerate = async () => {
        if (isMultiDoc && selectedDocs.length === 0) {
            setError("Veuillez ajouter au moins un document.");
            return;
        }
        if (!isMultiDoc && !selectedDoc) {
            setError("Veuillez sélectionner un document.");
            return;
        }
        
        setIsGenerating(true);
        setError(null);

        try {
            let result;
            if (isMultiDoc) {
                const payload = {
                    title: quizTitle || "Multi-Document Quiz",
                    application_id: applicationId, // Pass applicationId
                    documents: selectedDocs.map(sd => ({
                        document_id: sd.document_id,
                        total_questions: parseInt(sd.total_questions),
                        difficulty_mix: sd.difficulty === 'easy' ? {easy: 0.8, medium: 0.2, hard: 0} :
                                       sd.difficulty === 'hard' ? {easy: 0, medium: 0.2, hard: 0.8} :
                                       {easy: 0.4, medium: 0.4, hard: 0.2}
                    }))
                };
                result = await apiFetch('/quiz/generate-multi', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            } else {
                // Post with payload instead of query params to include application_id
                const payload = {
                    document_id: selectedDoc,
                    template_id: selectedTemplate || null,
                    title: quizTitle || null,
                    application_id: applicationId // Pass applicationId
                };
                result = await apiFetch('/quiz/generate', { 
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            if (result && result.quiz_id) {
                onClose();
                navigate(`/hr/quizzes/${result.quiz_id}`);
            }
        } catch (err) {
            console.error("Generation error:", err);
            setError(err.message || "Erreur lors de la génération du quiz. Vérifiez que le service Ollama est actif.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="qz-modal-overlay">
            <div className="qz-modal-card">
                <div className="qz-modal-header">
                    <h2 className="qz-modal-title">Générer un Quiz Technique</h2>
                    <button className="qz-modal-close" onClick={onClose} disabled={isGenerating}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="qz-modal-body">
                    {error && <div className="qz-modal-error">{error}</div>}
                    {uploadError && <div className="qz-modal-error">{uploadError}</div>}

                    <div className="qz-row">
                        <div className="qz-modal-field" style={{ flex: 1 }}>
                            <label>Titre du Quiz</label>
                            <input 
                                type="text" 
                                className="qz-modal-input" 
                                placeholder="ex: Évaluation Frontend React"
                                value={quizTitle}
                                onChange={(e) => setQuizTitle(e.target.value)}
                            />
                        </div>

                        <div className="qz-modal-field qz-upload-field">
                            <label>Ajouter un document</label>
                            <label className={`qz-upload-btn ${isUploading ? 'loading' : ''}`}>
                                <span className="material-symbols-outlined">
                                    {isUploading ? 'sync' : 'upload_file'}
                                </span>
                                {isUploading ? 'Envoi...' : 'Importer'}
                                <input 
                                    type="file" 
                                    onChange={handleFileUpload} 
                                    className="qz-hidden-input" 
                                    disabled={isUploading}
                                    accept=".pdf,.docx,.doc,.txt"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="qz-modal-tabs">
                        <button 
                            className={`qz-modal-tab ${!isMultiDoc ? 'active' : ''}`}
                            onClick={() => setIsMultiDoc(false)}
                        >
                            Document Unique
                        </button>
                        <button 
                            className={`qz-modal-tab ${isMultiDoc ? 'active' : ''}`}
                            onClick={() => setIsMultiDoc(true)}
                        >
                            Multi-Documents
                        </button>
                    </div>

                    {!isMultiDoc ? (
                        <>
                            <div className="qz-modal-field">
                                <label>Document source</label>
                                <select 
                                    className="qz-modal-select" 
                                    value={selectedDoc} 
                                    onChange={(e) => setSelectedDoc(e.target.value)}
                                >
                                    <option value="">-- Choisir un document --</option>
                                    {documents.map(doc => (
                                        <option key={doc.id || doc._id} value={doc.id || doc._id}>
                                            {doc.title || doc.filename}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="qz-modal-field">
                                <label>Modèle (Template)</label>
                                <select 
                                    className="qz-modal-select" 
                                    value={selectedTemplate} 
                                    onChange={(e) => setSelectedTemplate(e.target.value)}
                                >
                                    <option value="">-- Par défaut --</option>
                                    {templates.map(t => (
                                        <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    ) : (
                        <div className="qz-modal-multi-container">
                            <div className="qz-modal-doc-list">
                                {selectedDocs.length === 0 && (
                                    <p className="qz-modal-empty">Aucun document ajouté.</p>
                                )}
                                {selectedDocs.map(sd => (
                                    <div key={sd.document_id} className="qz-modal-doc-item">
                                        <div className="qz-modal-doc-header">
                                            <span className="qz-modal-doc-name">{sd.title}</span>
                                            <button 
                                                className="qz-modal-doc-remove" 
                                                onClick={() => handleRemoveDocument(sd.document_id)}
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </div>
                                        <div className="qz-modal-doc-settings">
                                            <div className="qz-modal-subfield">
                                                <label>Questions</label>
                                                <input 
                                                    type="number" 
                                                    value={sd.total_questions}
                                                    onChange={(e) => handleUpdateDocConfig(sd.document_id, 'total_questions', e.target.value)}
                                                    min="1" max="20"
                                                />
                                            </div>
                                            <div className="qz-modal-subfield">
                                                <label>Difficulté</label>
                                                <select 
                                                    value={sd.difficulty}
                                                    onChange={(e) => handleUpdateDocConfig(sd.document_id, 'difficulty', e.target.value)}
                                                >
                                                    <option value="easy">Facile</option>
                                                    <option value="medium">Équilibré</option>
                                                    <option value="hard">Difficile</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="qz-modal-field" style={{ marginTop: '1rem' }}>
                                <select 
                                    className="qz-modal-select" 
                                    value={nextDocToAdd} 
                                    onChange={(e) => handleAddDocument(e.target.value)}
                                >
                                    <option value="">+ Ajouter un document</option>
                                    {documents
                                        .filter(d => !selectedDocs.some(sd => sd.document_id === (d.id || d._id)))
                                        .map(doc => (
                                            <option key={doc.id || doc._id} value={doc.id || doc._id}>
                                                {doc.title || doc.filename}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                <div className="qz-modal-footer">
                    <button 
                        className="qz-modal-btn-secondary" 
                        onClick={onClose} 
                        disabled={isGenerating}
                    >
                        Annuler
                    </button>
                    <button 
                        className="qz-modal-btn-primary" 
                        onClick={handleGenerate} 
                        disabled={isGenerating || (isMultiDoc ? selectedDocs.length === 0 : !selectedDoc)}
                    >
                        {isGenerating ? (
                            <>
                                <div className="qz-modal-spinner"></div>
                                Génération...
                            </>
                        ) : 'Générer le Quiz'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateQuizModal;
