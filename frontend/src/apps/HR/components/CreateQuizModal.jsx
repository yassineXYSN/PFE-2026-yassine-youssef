import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../core/api';
import './CreateQuizModal.css';

const DIFFICULTY_OPTIONS = [
    { value: 'easy', label: 'Facile', icon: 'sentiment_satisfied' },
    { value: 'medium', label: 'Équilibré', icon: 'tune' },
    { value: 'hard', label: 'Difficile', icon: 'local_fire_department' },
];

const CreateQuizModal = ({ isOpen, onClose, applicationId, jobTitle, quizId }) => {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [selectedDoc, setSelectedDoc] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isMultiDoc, setIsMultiDoc] = useState(false);
    const [selectedDocs, setSelectedDocs] = useState([]);
    const [quizTitle, setQuizTitle] = useState(jobTitle ? `Quiz Technique - ${jobTitle}` : '');
    const [nextDocToAdd, setNextDocToAdd] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [error, setError] = useState(null);

    // Single-doc config
    const [questionCount, setQuestionCount] = useState(10);
    const [difficulty, setDifficulty] = useState('medium');

    useEffect(() => {
        if (isOpen) {
            fetchDocuments();
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
            if (event.target) event.target.value = '';
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

    const getDifficultyMix = (diff) => {
        if (diff === 'easy') return { easy: 0.8, medium: 0.2, hard: 0 };
        if (diff === 'hard') return { easy: 0, medium: 0.2, hard: 0.8 };
        return { easy: 0.4, medium: 0.4, hard: 0.2 };
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
                    application_id: applicationId,
                    documents: selectedDocs.map(sd => ({
                        document_id: sd.document_id,
                        total_questions: parseInt(sd.total_questions),
                        difficulty_mix: getDifficultyMix(sd.difficulty)
                    }))
                };
                result = await apiFetch('/quiz/generate-multi', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            } else {
                const payload = {
                    document_id: selectedDoc,
                    title: quizTitle || null,
                    application_id: applicationId,
                    total_questions: parseInt(questionCount),
                    difficulty_mix: getDifficultyMix(difficulty)
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
            console.error("Quiz Generation Failure:", err);
            setError(err.message || "Erreur lors de la génération du quiz. Vérifiez que le service Ollama est actif.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    const totalMultiQuestions = selectedDocs.reduce((sum, sd) => sum + parseInt(sd.total_questions || 0), 0);

    return (
        <div className="qz-modal-overlay">
            <div className="qz-modal-card">

                {/* ── Header ── */}
                <div className="qz-modal-header">
                    <h2 className="qz-modal-title">{quizId ? 'Mettre à jour le Quiz' : 'Générateur de Quiz IA'}</h2>
                    <button className="qz-modal-close" onClick={onClose} disabled={isGenerating}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="qz-modal-body">

                    {/* Error Banners */}
                    {error && (
                        <div className="qz-modal-error">
                            <span className="material-symbols-outlined">error</span>
                            <p className="qz-modal-error-text">{error}</p>
                        </div>
                    )}
                    {uploadError && (
                        <div className="qz-modal-error">
                            <span className="material-symbols-outlined">error</span>
                            <p className="qz-modal-error-text">{uploadError}</p>
                        </div>
                    )}

                    {/* Step 1: Quiz Title */}
                    <div>
                        <label className="qz-label">Nom du Quiz</label>
                        <input
                            type="text"
                            className="qz-input"
                            placeholder="ex: Évaluation Frontend React"
                            value={quizTitle}
                            onChange={(e) => setQuizTitle(e.target.value)}
                        />
                    </div>

                    {/* Step 2: Upload Document */}
                    <div>
                        <div className="qz-upload-header">
                            <label className="qz-label" style={{ marginBottom: 0 }}>Document de Référence</label>
                            <span className="qz-upload-hint">PDF, DOCX, PPTX, IMG</span>
                        </div>
                        <label className={`qz-upload-zone ${isUploading ? 'uploading' : ''}`}>
                            <span className={`material-symbols-outlined ${isUploading ? 'qz-upload-spinner' : ''}`}>
                                {isUploading ? 'sync' : 'upload_file'}
                            </span>
                            <span className="qz-upload-zone-text">
                                {isUploading ? 'Envoi en cours...' : 'Importer un document'}
                            </span>
                            <input
                                type="file"
                                onChange={handleFileUpload}
                                className="qz-hidden-input"
                                disabled={isUploading}
                                accept=".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg"
                            />
                        </label>
                    </div>

                    {/* Step 3: Generation Mode */}
                    <div>
                        <label className="qz-label">Mode de Génération</label>

                        {/* Tab Switcher */}
                        <div className="qz-tabs">
                            <button
                                className={`qz-tab ${!isMultiDoc ? 'active' : ''}`}
                                onClick={() => setIsMultiDoc(false)}
                            >
                                Document Unique
                            </button>
                            <button
                                className={`qz-tab ${isMultiDoc ? 'active' : ''}`}
                                onClick={() => setIsMultiDoc(true)}
                            >
                                Multi-Documents
                            </button>
                        </div>

                        {/* ══ Mode A: Single Document ══ */}
                        {!isMultiDoc && (
                            <div className="qz-single-mode">
                                {/* Document Selector */}
                                <div>
                                    <label className="qz-label-sub">Document Source</label>
                                    <div className="qz-select-wrapper">
                                        <select
                                            className="qz-select"
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
                                        <span className="material-symbols-outlined qz-select-arrow">expand_more</span>
                                    </div>
                                </div>

                                {/* Question Count & Difficulty */}
                                <div className="qz-config-row">
                                    <div className="qz-config-questions">
                                        <label className="qz-label-sub">Nombre de Questions</label>
                                        <div className="qz-stepper">
                                            <button
                                                className="qz-stepper-btn"
                                                onClick={() => setQuestionCount(Math.max(1, questionCount - 1))}
                                                disabled={questionCount <= 1}
                                            >
                                                <span className="material-symbols-outlined">remove</span>
                                            </button>
                                            <input
                                                type="number"
                                                className="qz-stepper-input"
                                                value={questionCount}
                                                onChange={(e) => {
                                                    const v = parseInt(e.target.value);
                                                    if (v >= 1 && v <= 50) setQuestionCount(v);
                                                }}
                                                min="1"
                                                max="50"
                                            />
                                            <button
                                                className="qz-stepper-btn"
                                                onClick={() => setQuestionCount(Math.min(50, questionCount + 1))}
                                                disabled={questionCount >= 50}
                                            >
                                                <span className="material-symbols-outlined">add</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="qz-config-difficulty">
                                        <label className="qz-label-sub">Difficulté</label>
                                        <div className="qz-difficulty-chips">
                                            {DIFFICULTY_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    className={`qz-chip ${difficulty === opt.value ? 'active' : ''}`}
                                                    onClick={() => setDifficulty(opt.value)}
                                                >
                                                    <span className="material-symbols-outlined">{opt.icon}</span>
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ══ Mode B: Multi-Document ══ */}
                        {isMultiDoc && (
                            <div className="qz-multi-container">
                                {/* Document Cards */}
                                {selectedDocs.length === 0 ? (
                                    <div className="qz-multi-empty-state">
                                        <span className="material-symbols-outlined">folder_open</span>
                                        <p>Aucun document ajouté</p>
                                        <span className="qz-multi-empty-hint">Sélectionnez des documents ci-dessous pour construire votre quiz</span>
                                    </div>
                                ) : (
                                    <div className="qz-multi-doc-list">
                                        {selectedDocs.map((sd, idx) => (
                                            <div key={sd.document_id} className="qz-multi-doc">
                                                <div className="qz-multi-doc-top">
                                                    <div className="qz-multi-doc-info">
                                                        <span className="qz-multi-doc-badge">{idx + 1}</span>
                                                        <span className="qz-multi-doc-name">{sd.title}</span>
                                                    </div>
                                                    <button
                                                        className="qz-multi-doc-remove"
                                                        onClick={() => handleRemoveDocument(sd.document_id)}
                                                        title="Supprimer"
                                                    >
                                                        <span className="material-symbols-outlined">close</span>
                                                    </button>
                                                </div>
                                                <div className="qz-multi-doc-controls">
                                                    <div className="qz-multi-control">
                                                        <label>Questions</label>
                                                        <div className="qz-stepper qz-stepper-sm">
                                                            <button
                                                                className="qz-stepper-btn"
                                                                onClick={() => handleUpdateDocConfig(sd.document_id, 'total_questions', Math.max(1, parseInt(sd.total_questions) - 1))}
                                                                disabled={parseInt(sd.total_questions) <= 1}
                                                            >
                                                                <span className="material-symbols-outlined">remove</span>
                                                            </button>
                                                            <input
                                                                type="number"
                                                                className="qz-stepper-input"
                                                                value={sd.total_questions}
                                                                onChange={(e) => handleUpdateDocConfig(sd.document_id, 'total_questions', e.target.value)}
                                                                min="1"
                                                                max="20"
                                                            />
                                                            <button
                                                                className="qz-stepper-btn"
                                                                onClick={() => handleUpdateDocConfig(sd.document_id, 'total_questions', Math.min(20, parseInt(sd.total_questions) + 1))}
                                                                disabled={parseInt(sd.total_questions) >= 20}
                                                            >
                                                                <span className="material-symbols-outlined">add</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="qz-multi-control">
                                                        <label>Difficulté</label>
                                                        <div className="qz-difficulty-chips">
                                                            {DIFFICULTY_OPTIONS.map(opt => (
                                                                <button
                                                                    key={opt.value}
                                                                    className={`qz-chip ${sd.difficulty === opt.value ? 'active' : ''}`}
                                                                    onClick={() => handleUpdateDocConfig(sd.document_id, 'difficulty', opt.value)}
                                                                >
                                                                    <span className="material-symbols-outlined">{opt.icon}</span>
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add Document Selector */}
                                <div className="qz-multi-add">
                                    <div className="qz-select-wrapper" style={{ flex: 1 }}>
                                        <select
                                            className="qz-select"
                                            value={nextDocToAdd}
                                            onChange={(e) => {
                                                setNextDocToAdd(e.target.value);
                                                handleAddDocument(e.target.value);
                                            }}
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
                                        <span className="material-symbols-outlined qz-select-arrow">expand_more</span>
                                    </div>
                                </div>

                                {/* Summary Bar */}
                                {selectedDocs.length > 0 && (
                                    <div className="qz-multi-summary">
                                        <span className="material-symbols-outlined">summarize</span>
                                        <span>{selectedDocs.length} document{selectedDocs.length > 1 ? 's' : ''}</span>
                                        <span className="qz-multi-summary-sep">·</span>
                                        <span>{totalMultiQuestions} question{totalMultiQuestions > 1 ? 's' : ''} au total</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="qz-modal-footer">
                    <button
                        className="qz-btn-cancel"
                        onClick={onClose}
                        disabled={isGenerating}
                    >
                        Annuler
                    </button>
                    <button
                        className="qz-btn-generate"
                        onClick={handleGenerate}
                        disabled={isGenerating || (isMultiDoc ? selectedDocs.length === 0 : !selectedDoc)}
                    >
                        {isGenerating ? (
                            <>
                                <div className="qz-spinner"></div>
                                Génération...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {quizId ? 'refresh' : 'auto_awesome'}
                                </span>
                                {quizId ? 'Regénérer le Quiz' : 'Générer le Quiz'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateQuizModal;
