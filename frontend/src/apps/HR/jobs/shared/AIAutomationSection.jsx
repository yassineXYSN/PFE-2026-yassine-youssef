import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../../core/api';
import { useLanguage } from '../../../../core/useLanguage';
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
    sectionTitle = null,
    sectionDescription = null,
    icon = 'auto_awesome'
}) => {
    const { t } = useLanguage();
    const resolvedTitle = sectionTitle ?? t('hr-ai-pipeline-title');
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
                <h2 className="section-title">{resolvedTitle}</h2>
            </div>

            <div className="ai-auto-stack">
                {/* AI disabled globally — show banner */}
                {!aiEnabled ? (
                    <div className="ai-auto-disabled-banner">
                        <span className="material-symbols-outlined">block</span>
                        <div>
                            <strong>{t('hr-ai-disabled-title')}</strong>
                            <p>{t('hr-ai-disabled-desc')}</p>
                        </div>
                    </div>
                ) : (
                    <div className="ai-auto-grid">
                        {/* Read-only filtering pipeline from parametrage */}
                        <div className="ai-auto-subcard ai-auto-subcard--full">
                            <div className="ai-auto-section-head">
                                <div>
                                    <h4>{t('hr-ai-pipeline-title')}</h4>
                                    <p className="ai-auto-mini">
                                        {t('hr-ai-pipeline-desc')}
                                    </p>
                                </div>
                            </div>
                            <div className="ai-auto-pipeline-summary">
                                <div className="ai-auto-pipeline-step ai-auto-pipeline-step--x">
                                    <span className="ai-auto-pipeline-count">{config.vector_filter.top_x_candidates}</span>
                                    <span className="ai-auto-pipeline-label">{t('hr-ai-pipeline-profile-match')}</span>
                                </div>
                                <span className="material-symbols-outlined ai-auto-pipeline-arrow">chevron_right</span>
                                <div className="ai-auto-pipeline-step ai-auto-pipeline-step--y">
                                    <span className="ai-auto-pipeline-count">{config.ai_score_filter.top_y_candidates}</span>
                                    <span className="ai-auto-pipeline-label">{t('hr-ai-pipeline-ai-review')}</span>
                                </div>
                                <span className="material-symbols-outlined ai-auto-pipeline-arrow">chevron_right</span>
                                <div className="ai-auto-pipeline-step ai-auto-pipeline-step--z">
                                    <span className="ai-auto-pipeline-count">{config.quiz_stage.approve_top_z_to_interview}</span>
                                    <span className="ai-auto-pipeline-label">{t('hr-ai-pipeline-interview')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quiz stage — per-job toggle */}
                        <div className="ai-auto-subcard ai-auto-subcard--full">
                            <div className="ai-auto-section-head">
                                <div>
                                    <h4>{t('hr-ai-quiz-stage-title')}</h4>
                                    <p>{t('hr-ai-quiz-stage-desc')}</p>
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
                                    <span>{t('hr-ai-quiz-require')}</span>
                                </label>
                            </div>

                            {config.quiz_stage.enabled ? (
                                <>
                                    <div className="ai-auto-section-head">
                                        <div>
                                            <span className="ai-auto-label">{t('hr-ai-quiz-configured')}</span>
                                            <p className="ai-auto-mini">{t('hr-ai-quiz-configured-desc')}</p>
                                        </div>
                                        <button type="button" className="btn-text" onClick={addQuiz}>
                                            <span className="material-symbols-outlined">add</span>
                                            {t('hr-ai-quiz-add')}
                                        </button>
                                    </div>

                                    {shownErrors.quizzes && <div className="ai-auto-error">{shownErrors.quizzes}</div>}
                                    {shownErrors.quiz_weights && <div className="ai-auto-error">{shownErrors.quiz_weights}</div>}
                                    <div className={`ai-auto-weight-summary ${totalQuizWeight === 100 ? 'is-balanced' : 'is-unbalanced'}`}>
                                        {t('hr-ai-quiz-weight-total', { weight: totalQuizWeight })}
                                    </div>

                                    <div className="ai-auto-quiz-list">
                                        {config.quiz_stage.quizzes.map((quiz, index) => (
                                            <div className="ai-auto-quiz-card" key={quiz.id}>
                                                <div className="ai-auto-section-head">
                                                    <div>
                                                        <h5>{t('hr-ai-quiz-number', { number: index + 1 })}</h5>
                                                        <p className="ai-auto-mini">{t('hr-ai-quiz-each-candidate')}</p>
                                                    </div>
                                                    <button type="button" className="btn-icon-danger" onClick={() => removeQuiz(quiz.id)}>
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </div>

                                                <div className="ai-auto-doc-panel">
                                                    <div className="ai-auto-doc-header">
                                                        <div>
                                                            <span className="ai-auto-label">{t('hr-ai-quiz-doc-title')}</span>
                                                            <p className="ai-auto-mini">{t('hr-ai-quiz-doc-desc')}</p>
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
                                                                <option value="">{documentsLoading ? t('hr-ai-quiz-doc-loading') : t('hr-ai-quiz-doc-choose')}</option>
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
                                                            <strong>{uploadingQuizId === quiz.id ? t('hr-ai-quiz-uploading') : t('hr-ai-quiz-upload-title')}</strong>
                                                            <span>{t('hr-ai-quiz-upload-formats')}</span>
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
                                                        <span className="ai-auto-label">{t('hr-ai-quiz-field-title')}</span>
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
                                                        <span className="ai-auto-label">{t('hr-ai-quiz-field-weight')}</span>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            value={quiz.weight_percentage}
                                                            onChange={(e) => updateQuiz(quiz.id, (currentQuiz) => ({ ...currentQuiz, weight_percentage: e.target.value }))}
                                                            onBlur={() => validateOnBlur([`quiz_${index}_weight`, 'quiz_weights'])}
                                                            onFocus={() => clearLiveError([`quiz_${index}_weight`, 'quiz_weights'])}
                                                        />
                                                        <span className="ai-auto-inline-help">{t('hr-ai-quiz-field-weight-help')}</span>
                                                        {shownErrors[`quiz_${index}_weight`] && <div className="ai-auto-error">{shownErrors[`quiz_${index}_weight`]}</div>}
                                                    </label>

                                                    <label className="form-field">
                                                        <span className="ai-auto-label">{t('hr-ai-quiz-field-questions')}</span>
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
                                                        <span className="ai-auto-label">{t('hr-ai-quiz-field-duration')}</span>
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
                                                        <span className="ai-auto-label">{t('hr-ai-quiz-field-deadline')}</span>
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
                                                    <span className="ai-auto-label">{t('hr-ai-quiz-field-difficulty')}</span>
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
                                <div className="ai-auto-empty">{t('hr-ai-quiz-skipped')}</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIAutomationSection;
