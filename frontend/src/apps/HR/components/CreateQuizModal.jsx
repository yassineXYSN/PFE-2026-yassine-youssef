import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../core/api';
import './CreateQuizModal.css';

const DIFFICULTY_OPTIONS = [
    { value: 'easy', label: 'Facile', icon: 'sentiment_satisfied' },
    { value: 'medium', label: 'Équilibré', icon: 'tune' },
    { value: 'hard', label: 'Difficile', icon: 'local_fire_department' },
];

const DEFAULT_QUIZ_DURATION_MINUTES = 10;
const MIN_QUIZ_DURATION_MINUTES = 1;
const MAX_QUIZ_DURATION_MINUTES = 180;

const getDefaultDeadline = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
};

const getDefaultDeadlineTime = () => {
    return '23:59';
};

const CreateQuizModal = ({ isOpen, onClose, applicationId, jobTitle, quizId, quizStatus, documentTitle }) => {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [selectedDoc, setSelectedDoc] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [quizTitle, setQuizTitle] = useState(() => {
        if (jobTitle && documentTitle) {
            return `Quiz Technique - ${jobTitle} (${documentTitle})`;
        }
        if (jobTitle) {
            return `Quiz Technique - ${jobTitle}`;
        }
        if (documentTitle) {
            return `Quiz Technique - ${documentTitle}`;
        }
        return '';
    });
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [error, setError] = useState(null);
    const [generationStep, setGenerationStep] = useState(0);
    const [quizDurationMinutes, setQuizDurationMinutes] = useState(DEFAULT_QUIZ_DURATION_MINUTES);
    const [deadlineDate, setDeadlineDate] = useState(getDefaultDeadline());
    const [deadlineTime, setDeadlineTime] = useState(getDefaultDeadlineTime());

    const GENERATION_STEPS = [
        { label: "Analyse des documents source...", icon: "analytics" },
        { label: "Extraction des concepts clés...", icon: "account_tree" },
        { label: "Construction du graphe de connaissances...", icon: "hub" },
        { label: "Génération automatique des questions...", icon: "auto_awesome" },
        { label: "Optimisation de la structure du quiz...", icon: "architecture" },
        { label: "Vérification de la cohérence...", icon: "fact_check" }
    ];

    // Single-doc config
    const [questionCount, setQuestionCount] = useState(10);
    const [difficulty, setDifficulty] = useState('medium');

    useEffect(() => {
        if (isOpen) {
            fetchDocuments();
            setSelectedDoc('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!selectedDoc || documents.length === 0) return;
        
        const doc = documents.find(d => (d.id || d._id) === selectedDoc);
        if (!doc) return;
        
        const docTitle = doc.title || doc.filename || '';
        if (!docTitle) return;
        
        let newTitle = docTitle;
        if (jobTitle) {
            newTitle = `Quiz Technique - ${jobTitle} (${docTitle})`;
        } else {
            newTitle = `Quiz Technique - ${docTitle}`;
        }
        
        if (quizTitle !== newTitle) {
            setQuizTitle(newTitle);
        }
    }, [selectedDoc, documents, jobTitle]);

    useEffect(() => {
        let interval;
        if (isGenerating) {
            setGenerationStep(0);
            interval = setInterval(() => {
                setGenerationStep(prev => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
            }, 3000);
        } else {
            setGenerationStep(0);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

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
        formData.append('title', 'quiz');

        try {
            const result = await apiFetch('/quiz/upload-document', {
                method: 'POST',
                body: formData
            });

            await fetchDocuments();

            const newDocId = result.document_id;
            setSelectedDoc(newDocId);
        } catch (err) {
            console.error("Upload error:", err);
            setUploadError("Erreur lors de l'envoi du document.");
        } finally {
            setIsUploading(false);
            if (event.target) event.target.value = '';
        }
    };

    const getDifficultyMix = (diff) => {
        if (diff === 'easy') return { easy: 0.8, medium: 0.2, hard: 0 };
        if (diff === 'hard') return { easy: 0, medium: 0.2, hard: 0.8 };
        return { easy: 0.4, medium: 0.4, hard: 0.2 };
    };

    const updateQuizDuration = (value) => {
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed)) return;

        setQuizDurationMinutes(Math.min(MAX_QUIZ_DURATION_MINUTES, Math.max(MIN_QUIZ_DURATION_MINUTES, parsed)));
    };

    const handleGenerate = async () => {
        if (quizStatus === 'sent' || quizStatus === 'completed') {
            setError("Impossible de modifier ou regénérer un quiz déjà envoyé ou complété.");
            return;
        }
        if (!selectedDoc) {
            setError("Veuillez sélectionner un document.");
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const deadlineRaw = deadlineDate && deadlineTime 
                ? `${deadlineDate}T${deadlineTime}:00`
                : (deadlineDate ? `${deadlineDate}T23:59:00` : null);
            
            if (deadlineRaw) {
                const deadlineDt = new Date(deadlineRaw);
                const now = new Date();
                if (deadlineDt <= now) {
                    setError("La date limite doit être dans le futur.");
                    return;
                }
            }
            
            const payload = {
                document_id: selectedDoc,
                title: quizTitle || null,
                application_id: applicationId,
                total_questions: parseInt(questionCount),
                duration_minutes: quizDurationMinutes,
                difficulty_mix: getDifficultyMix(difficulty),
                ...(deadlineRaw && { deadline: deadlineRaw })
            };
            const result = await apiFetch('/quiz/generate', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

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

<div>
                        <label className="qz-label">Temps Limite (Durée)</label>
                        <div className="qz-duration-row">
                            <div className="qz-stepper qz-duration-stepper">
                                <button
                                    className="qz-stepper-btn"
                                    onClick={() => updateQuizDuration(quizDurationMinutes - 1)}
                                    disabled={quizDurationMinutes <= MIN_QUIZ_DURATION_MINUTES}
                                >
                                    <span className="material-symbols-outlined">remove</span>
                                </button>
                                <input
                                    type="number"
                                    className="qz-stepper-input"
                                    value={quizDurationMinutes}
                                    onChange={(e) => updateQuizDuration(e.target.value)}
                                    min={MIN_QUIZ_DURATION_MINUTES}
                                    max={MAX_QUIZ_DURATION_MINUTES}
                                />
                                <button
                                    className="qz-stepper-btn"
                                    onClick={() => updateQuizDuration(quizDurationMinutes + 1)}
                                    disabled={quizDurationMinutes >= MAX_QUIZ_DURATION_MINUTES}
                                >
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>
<span className="qz-duration-unit">minutes</span>
                        </div>
                        <p className="qz-duration-hint">
                            Le candidat doit terminer le quiz avant cette limite.
                        </p>
                    </div>

                    <div>
                        <label className="qz-label">Date Limite (Deadline)</label>
                        <div className="qz-deadline-row">
                            <input
                                type="date"
                                className="qz-input"
                                value={deadlineDate}
                                onChange={(e) => setDeadlineDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                            <input
                                type="time"
                                className="qz-input"
                                value={deadlineTime}
                                onChange={(e) => setDeadlineTime(e.target.value)}
                            />
                        </div>
                        <p className="qz-duration-hint">
                            Deadline pour soumettre le quiz. Laissez vide pour aucune limite.
                        </p>
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
                        disabled={isGenerating || !selectedDoc}
                    >
                        {isGenerating ? (
                            <>
                                <span className="qz-btn-spinner" aria-hidden="true"></span>
                                <span className="qz-btn-label">{GENERATION_STEPS[generationStep].label}</span>
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
