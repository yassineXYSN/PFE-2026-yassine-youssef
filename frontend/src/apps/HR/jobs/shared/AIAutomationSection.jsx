import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../../core/api';
import {
    QUIZ_DIFFICULTY_OPTIONS,
    createEmptyQuizConfig,
    validateAIAutomation
} from './aiAutomationConfig';
import './AIAutomationSection.css';

const AIAutomationSection = ({
    config,
    onChange,
    errors = {},
    applicationDeadline,
    parametrage = null,
    aiEnabled = true,
    sectionTitle = 'AI Auto-Filtering by Deadline',
    sectionDescription = 'These settings are saved on the job now. Automation execution will be added later.',
    icon = 'auto_awesome'
}) => {
    const [documents, setDocuments] = useState([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [uploadingQuizId, setUploadingQuizId] = useState(null);
    const [liveErrors, setLiveErrors] = useState({});

    useEffect(() => {
        const fetchDocuments = async () => {
            setDocumentsLoading(true);
            try {
                const data = await apiFetch('/quiz/documents');
                setDocuments(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to load quiz documents:', err);
                setDocuments([]);
            } finally {
                setDocumentsLoading(false);
            }
        };

        fetchDocuments();
    }, []);

    useEffect(() => {
        if (config.quiz_stage?.enabled && applicationDeadline) {
            const validation = validateAIAutomation(config, applicationDeadline);
            setLiveErrors(validation);
        }
    }, [applicationDeadline]);

    const updateConfig = (updater) => {
        const nextValue = typeof updater === 'function' ? updater(config) : updater;
        onChange(nextValue);
    };

    const shownErrors = {
        ...errors,
        ...liveErrors
    };

    const clearLiveError = (keys) => {
        const list = Array.isArray(keys) ? keys : [keys];
        setLiveErrors((current) => {
            const next = { ...current };
            list.forEach((key) => delete next[key]);
            return next;
        });
    };

    const validateOnBlur = (keys) => {
        const list = Array.isArray(keys) ? keys : [keys];
        const validation = validateAIAutomation(config, applicationDeadline);
        setLiveErrors((current) => {
            const next = { ...current };
            list.forEach((key) => {
                if (validation[key]) next[key] = validation[key];
                else delete next[key];
            });
            return next;
        });
    };

    const totalQuizWeight = useMemo(() => {
        return (config.quiz_stage.quizzes || []).reduce((sum, quiz) => {
            const parsed = Number.parseInt(quiz.weight_percentage, 10);
            return sum + (Number.isFinite(parsed) ? parsed : 0);
        }, 0);
    }, [config.quiz_stage.quizzes]);

    const updateQuiz = (quizId, updater) => {
        updateConfig((current) => ({
            ...current,
            quiz_stage: {
                ...current.quiz_stage,
                quizzes: current.quiz_stage.quizzes.map((quiz) =>
                    quiz.id === quizId ? (typeof updater === 'function' ? updater(quiz) : updater) : quiz
                )
            }
        }));
    };

    const addQuiz = () => {
        updateConfig((current) => ({
            ...current,
            quiz_stage: {
                ...current.quiz_stage,
                enabled: true,
                quizzes: [...current.quiz_stage.quizzes, createEmptyQuizConfig(parametrage)]
            }
        }));
    };

    const removeQuiz = (quizId) => {
        updateConfig((current) => ({
            ...current,
            quiz_stage: {
                ...current.quiz_stage,
                quizzes: current.quiz_stage.quizzes.filter((quiz) => quiz.id !== quizId)
            }
        }));
    };

    const handleUpload = async (quizId, file) => {
        if (!file) return;
        setUploadingQuizId(quizId);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
            const result = await apiFetch('/quiz/upload-document', {
                method: 'POST',
                body: formData
            });

            const documentRecord = {
                id: result.document_id,
                _id: result.document_id,
                title: result.title || result.filename || file.name,
                filename: result.filename || file.name
            };

            setDocuments((prev) => [documentRecord, ...prev.filter((doc) => (doc.id || doc._id) !== result.document_id)]);

            updateQuiz(quizId, (quiz) => ({
                ...quiz,
                document_id: result.document_id,
                document_title: result.title || result.filename || file.name
            }));
        } catch (err) {
            console.error('Quiz document upload failed:', err);
        } finally {
            setUploadingQuizId(null);
        }
    };

    return (
        <div className="form-section">
            <div className="section-header">
                <div className="section-icon-wrapper">
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
                <h2 className="section-title">{sectionTitle}</h2>
            </div>

            <div className="ai-auto-stack">
                {/* AI disabled globally — show banner */}
                {!aiEnabled ? (
                    <div className="ai-auto-disabled-banner">
                        <span className="material-symbols-outlined">block</span>
                        <div>
                            <strong>L'analyse IA automatique est désactivée.</strong>
                            <p>Activez-la dans Paramètres &gt; IA &amp; Automatisation pour utiliser le filtrage automatique et les quiz.</p>
                        </div>
                    </div>
                ) : (
                    <div className="ai-auto-grid">
                        {/* Read-only filtering pipeline from parametrage */}
                        <div className="ai-auto-subcard ai-auto-subcard--full">
                            <div className="ai-auto-section-head">
                                <div>
                                    <h4>Filtering pipeline</h4>
                                    <p className="ai-auto-mini">
                                        Valeurs configurées dans Paramètres &gt; IA &amp; Automatisation.
                                    </p>
                                </div>
                            </div>
                            <div className="ai-auto-pipeline-summary">
                                <div className="ai-auto-pipeline-step ai-auto-pipeline-step--x">
                                    <span className="ai-auto-pipeline-count">{config.vector_filter.top_x_candidates}</span>
                                    <span className="ai-auto-pipeline-label">Correspondance profil</span>
                                </div>
                                <span className="material-symbols-outlined ai-auto-pipeline-arrow">chevron_right</span>
                                <div className="ai-auto-pipeline-step ai-auto-pipeline-step--y">
                                    <span className="ai-auto-pipeline-count">{config.ai_score_filter.top_y_candidates}</span>
                                    <span className="ai-auto-pipeline-label">Revue IA</span>
                                </div>
                                <span className="material-symbols-outlined ai-auto-pipeline-arrow">chevron_right</span>
                                <div className="ai-auto-pipeline-step ai-auto-pipeline-step--z">
                                    <span className="ai-auto-pipeline-count">{config.quiz_stage.approve_top_z_to_interview}</span>
                                    <span className="ai-auto-pipeline-label">Entretien</span>
                                </div>
                            </div>
                        </div>

                        {/* Quiz stage — per-job toggle */}
                        <div className="ai-auto-subcard ai-auto-subcard--full">
                            <div className="ai-auto-section-head">
                                <div>
                                    <h4>Quiz stage</h4>
                                    <p>Attach quizzes to the AI-reviewed shortlist and score them with weighted importance.</p>
                                </div>
                                <label className="ai-auto-toggle">
                                    <input
                                        type="checkbox"
                                        checked={config.quiz_stage.enabled}
                                        onChange={(e) => updateConfig((current) => ({
                                            ...current,
                                            quiz_stage: {
                                                ...current.quiz_stage,
                                                enabled: e.target.checked
                                            }
                                        }))}
                                    />
                                    <span>Require quizzes</span>
                                </label>
                            </div>

                            {config.quiz_stage.enabled ? (
                                <>
                                    <div className="ai-auto-section-head">
                                        <div>
                                            <span className="ai-auto-label">Configured quizzes</span>
                                            <p className="ai-auto-mini">Set the weight of each quiz. All quiz weights together must equal 100%.</p>
                                        </div>
                                        <button type="button" className="btn-text" onClick={addQuiz}>
                                            <span className="material-symbols-outlined">add</span>
                                            Add quiz
                                        </button>
                                    </div>

                                    {shownErrors.quizzes && <div className="ai-auto-error">{shownErrors.quizzes}</div>}
                                    {shownErrors.quiz_weights && <div className="ai-auto-error">{shownErrors.quiz_weights}</div>}
                                    <div className={`ai-auto-weight-summary ${totalQuizWeight === 100 ? 'is-balanced' : 'is-unbalanced'}`}>
                                        Total quiz weight: {totalQuizWeight}%
                                    </div>

                                    <div className="ai-auto-quiz-list">
                                        {config.quiz_stage.quizzes.map((quiz, index) => (
                                            <div className="ai-auto-quiz-card" key={quiz.id}>
                                                <div className="ai-auto-section-head">
                                                    <div>
                                                        <h5>Quiz {index + 1}</h5>
                                                        <p className="ai-auto-mini">Each shortlisted candidate will later receive a version of this quiz.</p>
                                                    </div>
                                                    <button type="button" className="btn-icon-danger" onClick={() => removeQuiz(quiz.id)}>
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </div>

                                                <div className="ai-auto-doc-panel">
                                                    <div className="ai-auto-doc-header">
                                                        <div>
                                                            <span className="ai-auto-label">Quiz source document</span>
                                                            <p className="ai-auto-mini">Pick an existing document or upload a fresh one for this quiz.</p>
                                                        </div>
                                                        {quiz.document_title ? (
                                                            <span className="ai-auto-doc-pill">
                                                                <span className="material-symbols-outlined">description</span>
                                                                {quiz.document_title}
                                                            </span>
                                                        ) : null}
                                                    </div>

                                                    <div className="ai-auto-doc-actions">
                                                        <div className="select-wrapper ai-auto-doc-select">
                                                            <select
                                                                className="form-select"
                                                                value={quiz.document_id}
                                                                onChange={(e) => {
                                                                    const selected = documents.find((doc) => (doc.id || doc._id) === e.target.value);
                                                                    updateQuiz(quiz.id, (currentQuiz) => ({
                                                                        ...currentQuiz,
                                                                        document_id: e.target.value,
                                                                        document_title: selected?.title || selected?.filename || ''
                                                                    }));
                                                                }}
                                                            >
                                                                <option value="">{documentsLoading ? 'Loading documents...' : 'Choose an existing document'}</option>
                                                                {documents.map((doc) => (
                                                                    <option key={doc.id || doc._id} value={doc.id || doc._id}>
                                                                        {doc.title || doc.filename}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <label className="ai-auto-upload-card">
                                                            <span className="material-symbols-outlined">
                                                                {uploadingQuizId === quiz.id ? 'sync' : 'upload_file'}
                                                            </span>
                                                            <strong>{uploadingQuizId === quiz.id ? 'Uploading...' : 'Upload new document'}</strong>
                                                            <span>PDF, DOCX, PPTX, image</span>
                                                            <input
                                                                type="file"
                                                                accept=".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg"
                                                                disabled={uploadingQuizId === quiz.id}
                                                                onChange={(e) => {
                                                                    const [file] = e.target.files || [];
                                                                    handleUpload(quiz.id, file);
                                                                    e.target.value = '';
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                    {errors[`quiz_${index}_document`] && <div className="ai-auto-error">{errors[`quiz_${index}_document`]}</div>}
                                                </div>

                                                <div className="ai-auto-number-row ai-auto-number-row--wide">
                                                    <label className="form-field">
                                                        <span className="ai-auto-label">Quiz title</span>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            value={quiz.title}
                                                            onChange={(e) => updateQuiz(quiz.id, (currentQuiz) => ({ ...currentQuiz, title: e.target.value }))}
                                                            placeholder="Frontend React Screening"
                                                        />
                                                        {errors[`quiz_${index}_title`] && <div className="ai-auto-error">{errors[`quiz_${index}_title`]}</div>}
                                                    </label>

                                                    <label className="form-field">
                                                        <span className="ai-auto-label">Weight in final quiz grade (%)</span>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            value={quiz.weight_percentage}
                                                            onChange={(e) => updateQuiz(quiz.id, (currentQuiz) => ({ ...currentQuiz, weight_percentage: e.target.value }))}
                                                            onBlur={() => validateOnBlur([`quiz_${index}_weight`, 'quiz_weights'])}
                                                            onFocus={() => clearLiveError([`quiz_${index}_weight`, 'quiz_weights'])}
                                                        />
                                                        <span className="ai-auto-inline-help">Example: 50 means this quiz contributes 50% of the total quiz grade.</span>
                                                        {shownErrors[`quiz_${index}_weight`] && <div className="ai-auto-error">{shownErrors[`quiz_${index}_weight`]}</div>}
                                                    </label>

                                                    <label className="form-field">
                                                        <span className="ai-auto-label">Questions</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="50"
                                                            className="form-input"
                                                            value={quiz.total_questions}
                                                            onChange={(e) => updateQuiz(quiz.id, (currentQuiz) => ({ ...currentQuiz, total_questions: e.target.value }))}
                                                        />
                                                        {errors[`quiz_${index}_questions`] && <div className="ai-auto-error">{errors[`quiz_${index}_questions`]}</div>}
                                                    </label>

                                                    <label className="form-field">
                                                        <span className="ai-auto-label">Duration (minutes)</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="180"
                                                            className="form-input"
                                                            value={quiz.duration_minutes}
                                                            onChange={(e) => updateQuiz(quiz.id, (currentQuiz) => ({ ...currentQuiz, duration_minutes: e.target.value }))}
                                                        />
                                                        {errors[`quiz_${index}_duration`] && <div className="ai-auto-error">{errors[`quiz_${index}_duration`]}</div>}
                                                    </label>

                                                    <label className="form-field">
                                                        <span className="ai-auto-label">Quiz deadline</span>
                                                        <input
                                                            type="datetime-local"
                                                            className="form-input"
                                                            value={quiz.deadline_at}
                                                            min={applicationDeadline ? applicationDeadline + 'T00:00' : ''}
                                                            max={applicationDeadline ? (() => {
                                                                const date = new Date(applicationDeadline);
                                                                date.setDate(date.getDate() + 5);
                                                                return date.toISOString().slice(0, 16);
                                                            })() : ''}
                                                            onChange={(e) => {
                                                                updateQuiz(quiz.id, (currentQuiz) => ({ ...currentQuiz, deadline_at: e.target.value }));
                                                                if (applicationDeadline) {
                                                                    const validation = validateAIAutomation(config, applicationDeadline);
                                                                    setLiveErrors((prev) => {
                                                                        const next = { ...prev };
                                                                        Object.keys(validation).forEach((key) => {
                                                                            if (key.startsWith(`quiz_${index}_`)) {
                                                                                next[key] = validation[key];
                                                                            }
                                                                        });
                                                                        return next;
                                                                    });
                                                                }
                                                            }}
                                                            onBlur={() => validateOnBlur([`quiz_${index}_deadline_at`])}
                                                            onFocus={() => clearLiveError([`quiz_${index}_deadline_at`])}
                                                        />
                                                        {shownErrors[`quiz_${index}_deadline_at`] && <div className="ai-auto-error">{shownErrors[`quiz_${index}_deadline_at`]}</div>}
                                                    </label>
                                                </div>

                                                <div className="form-field">
                                                    <span className="ai-auto-label">Difficulty</span>
                                                    <div className="ai-auto-chip-row">
                                                        {QUIZ_DIFFICULTY_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                className={`ai-auto-chip ${quiz.difficulty === option.value ? 'is-active' : ''}`}
                                                                onClick={() => updateQuiz(quiz.id, (currentQuiz) => ({ ...currentQuiz, difficulty: option.value }))}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="ai-auto-empty">Quizzes are skipped, so the interview shortlist will only be stored as a future setting.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIAutomationSection;
