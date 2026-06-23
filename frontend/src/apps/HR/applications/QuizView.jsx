import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../../../core/useLanguage';
import HRSidebar from '../components/HRSidebar';
import { apiFetch } from '../../../core/api';
import ConfirmationModal from '../../../core/components/ConfirmationModal';
import './QuizView.css';

const QuizView = () => {
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();
    const { t, language } = useLanguage();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [generatingQuestion, setGeneratingQuestion] = useState(false);
    const [generateProgress, setGenerateProgress] = useState(null);
    const [generateCount, setGenerateCount] = useState(1);
    const [showAddForm, setShowAddForm] = useState(false);

    // Custom form state
    const [customQ, setCustomQ] = useState({ question: '', opt1: '', opt2: '', opt3: '', opt4: '', explanation: '' });

    const handleDeleteQuestion = async (idx) => {
        if (!window.confirm(t('quiz.view.delete_confirm'))) return;
        const newQuestions = quiz.questions.filter((_, i) => i !== idx);

        try {
            await apiFetch(`/quiz/${quizId}/questions`, {
                method: 'PATCH',
                body: JSON.stringify({ questions: newQuestions })
            });
            setQuiz(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }));
            setToast({ message: language === 'fr' ? 'Question supprimée' : 'Question deleted', type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: t('quiz.view.delete_error'), type: 'error' });
        }
        setTimeout(() => setToast(null), 3000);
    };

    const handleGenerateQuestion = async () => {
        // Support both single-doc (document_id) and multi-doc (document_ids) quizzes
        const docId = quiz.document_id || (quiz.document_ids && quiz.document_ids[0]);
        if (!docId) {
            setToast({ message: language === 'fr' ? 'Aucun document associé à ce quiz' : 'No document linked to this quiz', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        const count = Math.max(1, Math.min(10, generateCount));
        setGeneratingQuestion(true);
        setGenerateProgress({ current: 0, total: count });

        try {
            for (let i = 0; i < count; i++) {
                setGenerateProgress({ current: i + 1, total: count });
                const data = await apiFetch(`/quiz/${quizId}/generate-question`, {
                    method: 'POST',
                    body: JSON.stringify({ document_id: docId, difficulty: "medium", type: "mcq" })
                });
                setQuiz(prev => ({ ...prev, questions: [...prev.questions, data.question] }));
            }
            const msg = count === 1
                ? (language === 'fr' ? 'Question générée !' : 'Question generated!')
                : (language === 'fr' ? `${count} questions générées !` : `${count} questions generated!`);
            setToast({ message: msg, type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: t('quiz.view.generate_error'), type: 'error' });
        } finally {
            setGeneratingQuestion(false);
            setGenerateProgress(null);
            setTimeout(() => setToast(null), 3000);
        }
    };

    const handleSaveCustomQuestion = async () => {
        if (!customQ.question || !customQ.opt1 || !customQ.opt2) {
            alert(t('quiz.view.fill_required'));
            return;
        }

        const options = [customQ.opt1, customQ.opt2, customQ.opt3, customQ.opt4].filter(Boolean);
        const newQuestion = {
            id: `q_manual_${Date.now()}`,
            type: "mcq",
            difficulty: "medium",
            question: customQ.question,
            options: options,
            correct_index: 0,
            explanation: customQ.explanation || (language === 'fr' ? 'Ajoutee manuellement' : 'Added manually'),
            source_chunks: []
        };

        const newQuestions = [...quiz.questions, newQuestion];
        try {
            await apiFetch(`/quiz/${quizId}/questions`, {
                method: 'PATCH',
                body: JSON.stringify({ questions: newQuestions })
            });
            setQuiz(prev => ({ ...prev, questions: [...prev.questions, newQuestion] }));
            setShowAddForm(false);
            setCustomQ({ question: '', opt1: '', opt2: '', opt3: '', opt4: '', explanation: '' });
            setToast({ message: language === 'fr' ? 'Question enregistrée' : 'Question saved', type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: t('quiz.view.save_error'), type: 'error' });
        }
        setTimeout(() => setToast(null), 3000);
    };


    const handleConfirmSend = async () => {
        setIsSendModalOpen(false);
        try {
            await apiFetch(`/quiz/${quizId}/status?status=published`, {
                method: 'PATCH'
            });
            setQuiz(prev => ({ ...prev, status: 'published' }));
            setToast({ message: t('quiz.view.send_success'), type: 'success' });
        } catch (err) {
            console.error("Failed to send quiz", err);
            setToast({ message: t('quiz.view.send_error'), type: 'error' });
        }
        setTimeout(() => setToast(null), 4000);
    };

    const handleDeleteQuiz = async () => {
        if (!window.confirm(language === 'fr' ? 'Êtes-vous sûr de vouloir supprimer ce quiz?' : 'Are you sure you want to delete this quiz?')) {
            return;
        }
        try {
            await apiFetch(`/quiz/${quizId}`, { method: 'DELETE' });
            setToast({ message: language === 'fr' ? 'Quiz supprimé!' : 'Quiz deleted!', type: 'success' });
            setTimeout(() => {
                navigate('/hr/applications');
            }, 1000);
        } catch (err) {
            console.error("Failed to delete quiz", err);
            setToast({ message: err.message || (language === 'fr' ? 'Erreur lors de la suppression' : 'Delete failed'), type: 'error' });
        }
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const data = await apiFetch(`/quiz/${quizId}`);
                setQuiz(data);
            } catch (err) {
                console.error("Failed to fetch quiz", err);
                setError(t('quiz.view.error_title'));
            } finally {
                setLoading(false);
            }
        };
        fetchQuiz();
    }, [quizId]);

    const isQuizLocked = quiz?.status === 'published' || quiz?.status === 'completed';

    if (loading) {
        return (
            <div className={`qz-view-page ${effectiveTheme === 'dark' ? 'dark' : 'light'}`}>
                <HRSidebar />
                <main className="qz-view-main qz-center">
                    <div className="qz-spinner"></div>
                    <p className="qz-loading-text">{t('quiz.view.loading')}</p>
                </main>
            </div>
        );
    }

    if (error || !quiz) {
        return (
            <div className={`qz-view-page ${effectiveTheme === 'dark' ? 'dark' : 'light'}`}>
                <HRSidebar />
                <main className="qz-view-main qz-center">
                    <span className="material-symbols-outlined qz-error-icon">error</span>
                    <h2 className="qz-error-title">{error || t('quiz.view.error_title')}</h2>
                    <button className="qz-back-btn" onClick={() => navigate(-1)}>
                        <span className="material-symbols-outlined">arrow_back</span>
                        {t('quiz.view.back_profile')}
                    </button>
                </main>
            </div>
        );
    }

    return (
        <div className={`qz-view-page ${effectiveTheme === 'dark' ? 'dark' : 'light'}`}>
            <HRSidebar />
            <main className="qz-view-main">
                <header className="qz-view-header">
                    <div className="qz-view-meta">
                        <button className="qz-header-back" onClick={() => navigate(-1)}>
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <span className="qz-tag">{t('quiz.view.assessment_tag')}</span>
                            <h1 className="qz-view-title">{quiz.title}</h1>
                        </div>
                    </div>
                    <div className="qz-view-badges">
                        <span className="qz-stats-badge">
                            <span className="material-symbols-outlined">help</span>
                            {t('quiz.view.questions_count', { count: quiz.questions?.length || 0 })}
                        </span>
                        <span className="qz-stats-badge">
                            <span className="material-symbols-outlined">timer</span>
                            {quiz.duration_minutes || 10} min
                        </span>
                        <span className="qz-stats-badge">
                            <span className="material-symbols-outlined">event</span>
                            {quiz.generated_at ? new Date(quiz.generated_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : t('quiz.view.date_unknown')}
                        </span>
                    </div>
                </header>

                <div className="qz-view-content">
                    <div className="qz-questions-list">
                        {quiz.questions?.map((q, idx) => {
                            const candidateResponse = quiz.candidate_answers?.find(r => r.question_id === q.id);
                            const candAns = candidateResponse?.answer;

                            return (
                                <div key={q.id || idx} className="qz-question-card">
                                    <div className="qz-q-top">
                                        <span className="qz-q-number">{t('quiz.view.question_number', { number: idx + 1 })}</span>
                                        <span className={`qz-difficulty-tag ${q.difficulty}`}>
                                            {q.difficulty}
                                        </span>
                                        {quiz.status === 'draft' && (
                                            <button
                                                className="qz-delete-q-btn"
                                                onClick={() => handleDeleteQuestion(idx)}
                                                style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                                            </button>
                                        )}
                                    </div>
                                    <h3 className="qz-q-text">{q.question}</h3>

                                    {q.source_document && (
                                        <div className="qz-q-source">
                                            <span className="material-symbols-outlined">description</span>
                                            {t('quiz.view.source')}: {q.source_document}
                                        </div>
                                    )}

                                    {q.type === 'mcq' && (
                                        <div className="qz-q-options">
                                            {q.options.map((opt, optIdx) => {
                                                const isCorrect = optIdx === q.correct_index;
                                                const isCandidate = candAns === optIdx;
                                                return (
                                                    <div key={optIdx} className={`qz-q-option ${isCorrect ? 'is-correct' : ''} ${isCandidate ? 'is-candidate' : ''}`}>
                                                        <div className="qz-opt-indicator">
                                                            {isCorrect && <span className="material-symbols-outlined">check</span>}
                                                            {!isCorrect && isCandidate && <span className="material-symbols-outlined">close</span>}
                                                        </div>
                                                        <span className="qz-opt-text">{opt}</span>
                                                        {isCorrect && <span className="qz-correct-label">{t('quiz.view.correct_label')}</span>}
                                                        {isCandidate && <span className="qz-candidate-label">{t('quiz.view.candidate_label')}</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {q.type === 'tf' && (
                                        <div className="qz-q-options">
                                            {['True', 'False'].map((opt, optIdx) => {
                                                const isCorrect = (q.correct_answer && opt === 'True') || (!q.correct_answer && opt === 'False');
                                                const isCandidate = (candAns === true && opt === 'True') || (candAns === false && opt === 'False');
                                                return (
                                                    <div key={optIdx} className={`qz-q-option ${isCorrect ? 'is-correct' : ''} ${isCandidate ? 'is-candidate' : ''}`}>
                                                        <div className="qz-opt-indicator">
                                                            {isCorrect && <span className="material-symbols-outlined">check</span>}
                                                            {!isCorrect && isCandidate && <span className="material-symbols-outlined">close</span>}
                                                        </div>
                                                        <span className="qz-opt-text">{opt === 'True' ? (language === 'fr' ? 'Vrai' : 'True') : (language === 'fr' ? 'Faux' : 'False')}</span>
                                                        {isCorrect && <span className="qz-correct-label">{t('quiz.view.correct_label')}</span>}
                                                        {isCandidate && <span className="qz-candidate-label">{t('quiz.view.candidate_label')}</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="qz-q-explanation">
                                        <strong>{t('quiz.view.explanation')}</strong> {q.explanation}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <aside className="qz-view-sidebar">

                        {/* ── Add Questions card (draft only) ── */}
                        {quiz.status === 'draft' && (
                            <div className="qz-sidebar-card">
                                <h3 className="qz-sidebar-title">
                                    {language === 'fr' ? 'Ajouter des questions' : 'Add Questions'}
                                </h3>

                                <div className="qz-sb-section">
                                    <div className="qz-sb-stepper-row">
                                        <span className="qz-sb-stepper-label">
                                            {language === 'fr' ? 'Quantité' : 'Count'}
                                        </span>
                                        <div className="qz-count-stepper">
                                            <button
                                                className="qz-stepper-btn"
                                                onClick={() => setGenerateCount(c => Math.max(1, c - 1))}
                                                disabled={generatingQuestion || generateCount <= 1}
                                            >−</button>
                                            <span className="qz-stepper-val">{generateCount}</span>
                                            <button
                                                className="qz-stepper-btn"
                                                onClick={() => setGenerateCount(c => Math.min(10, c + 1))}
                                                disabled={generatingQuestion || generateCount >= 10}
                                            >+</button>
                                        </div>
                                    </div>
                                    <button
                                        className="qz-action-btn qz-generate-btn"
                                        onClick={handleGenerateQuestion}
                                        disabled={generatingQuestion}
                                    >
                                        {generatingQuestion ? (
                                            <>
                                                <span className="material-symbols-outlined qz-spin">autorenew</span>
                                                {generateProgress && generateProgress.total > 1
                                                    ? <><span className="qz-progress-current">{generateProgress.current}</span><span className="qz-progress-sep">/</span><span>{generateProgress.total}</span></>
                                                    : (language === 'fr' ? 'Génération…' : 'Generating…')}
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined">auto_awesome</span>
                                                {language === 'fr' ? "Générer avec l'IA" : 'Generate with AI'}
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="qz-sb-divider" />

                                <button
                                    className={`qz-action-btn qz-manual-toggle${showAddForm ? ' is-active' : ''}`}
                                    onClick={() => setShowAddForm(!showAddForm)}
                                >
                                    <span className="material-symbols-outlined">{showAddForm ? 'close' : 'add'}</span>
                                    {showAddForm
                                        ? (language === 'fr' ? 'Annuler' : 'Cancel')
                                        : (language === 'fr' ? 'Ajouter manuellement' : 'Add Manually')}
                                </button>

                                {showAddForm && (
                                    <div className="qz-sb-manual-form">
                                        <input
                                            className="qz-manual-form-input"
                                            placeholder={t('quiz.view.placeholder_question')}
                                            value={customQ.question}
                                            onChange={e => setCustomQ({ ...customQ, question: e.target.value })}
                                        />
                                        <input className="qz-manual-form-input is-correct" placeholder={t('quiz.view.placeholder_opt1')} value={customQ.opt1} onChange={e => setCustomQ({ ...customQ, opt1: e.target.value })} />
                                        <input className="qz-manual-form-input" placeholder={t('quiz.view.placeholder_opt2')} value={customQ.opt2} onChange={e => setCustomQ({ ...customQ, opt2: e.target.value })} />
                                        <input className="qz-manual-form-input" placeholder={t('quiz.view.placeholder_opt3')} value={customQ.opt3} onChange={e => setCustomQ({ ...customQ, opt3: e.target.value })} />
                                        <input className="qz-manual-form-input" placeholder={t('quiz.view.placeholder_opt4')} value={customQ.opt4} onChange={e => setCustomQ({ ...customQ, opt4: e.target.value })} />
                                        <input
                                            className="qz-manual-form-input"
                                            placeholder={t('quiz.view.placeholder_explanation')}
                                            value={customQ.explanation}
                                            onChange={e => setCustomQ({ ...customQ, explanation: e.target.value })}
                                        />
                                        <button className="qz-manual-form-save" onClick={handleSaveCustomQuestion}>
                                            <span className="material-symbols-outlined">save</span>
                                            {t('quiz.view.save_q_btn')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Distribution card ── */}
                        <div className="qz-sidebar-card">
                            <h3 className="qz-sidebar-title">{t('quiz.view.distribution')}</h3>
                            <div className="qz-dist-grid">
                                {Object.entries(quiz.difficulty_distribution || {}).map(([diff, count]) => (
                                    <div key={diff} className="qz-dist-item">
                                        <span className="qz-dist-label">{diff}</span>
                                        <span className="qz-dist-value">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Actions card ── */}
                        <div className="qz-sidebar-card">
                            <h3 className="qz-sidebar-title">{t('quiz.view.actions')}</h3>
                            <div className="qz-action-buttons">
                                <button
                                    className={`qz-action-btn qz-send-btn ${isQuizLocked ? 'is-sent' : ''}`}
                                    onClick={() => setIsSendModalOpen(true)}
                                    disabled={isQuizLocked}
                                >
                                    <span className="material-symbols-outlined">{isQuizLocked ? 'check_circle' : 'send'}</span>
                                    {isQuizLocked ? t('quiz.view.sent_status') : t('quiz.view.send_btn')}
                                </button>
                                <button className="qz-action-btn qz-print-btn" onClick={() => window.print()}>
                                    <span className="material-symbols-outlined">print</span>
                                    {t('quiz.view.print_btn')}
                                </button>
                                {!isQuizLocked && (
                                    <button
                                        className="qz-action-btn qz-delete-btn"
                                        onClick={handleDeleteQuiz}
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                        {language === 'fr' ? 'Supprimer' : 'Delete'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </main>

            <ConfirmationModal
                isOpen={isSendModalOpen}
                onClose={() => setIsSendModalOpen(false)}
                onConfirm={handleConfirmSend}
                title={language === 'fr' ? 'Envoyer le quiz' : 'Send Quiz'}
                message={t('quiz.view.send_confirm')}
                confirmText={language === 'fr' ? 'Envoyer' : 'Send'}
                cancelText={language === 'fr' ? 'Annuler' : 'Cancel'}
                type="primary"
            />

            {/* Professional Toast Notification */}
            {toast && (
                <div className={`qz-toast-container ${toast.type}`}>
                    <span className="material-symbols-outlined">
                        {toast.type === 'error' ? 'error' : 'check_circle'}
                    </span>
                    <span className="qz-toast-message">{toast.message}</span>
                    <button className="qz-toast-close" onClick={() => setToast(null)}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default QuizView;
