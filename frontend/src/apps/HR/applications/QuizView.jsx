import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../../../core/useLanguage';
import HRSidebar from '../components/HRSidebar';
import { apiFetch } from '../../../core/api';
import './QuizView.css';

const QuizView = () => {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();
    const { t, language } = useLanguage();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [generatingQuestion, setGeneratingQuestion] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    // Custom form state
    const [customQ, setCustomQ] = useState({ question: '', opt1: '', opt2: '', opt3: '', opt4: '', explanation: '' });

    const handleDeleteQuestion = async (idx) => {
        if (!window.confirm(t('quiz.view.delete_confirm'))) return;
        const newQuestions = [...quiz.questions];
        newQuestions.splice(idx, 1);

        try {
            await apiFetch(`/quiz/${quizId}/questions`, {
                method: 'PATCH',
                body: JSON.stringify({ questions: newQuestions })
            });
            setQuiz({ ...quiz, questions: newQuestions });
        } catch (err) {
            console.error(err);
            alert(t('quiz.view.delete_error'));
        }
    };

    const handleGenerateQuestion = async () => {
        try {
            setGeneratingQuestion(true);
            const data = await apiFetch(`/quiz/${quizId}/generate-question`, {
                method: 'POST',
                body: JSON.stringify({ document_id: quiz.document_id, difficulty: "medium", type: "mcq" })
            });
            const newQuestions = [...quiz.questions, data.question];
            setQuiz({ ...quiz, questions: newQuestions });
        } catch (err) {
            console.error(err);
            alert(t('quiz.view.generate_error'));
        } finally {
            setGeneratingQuestion(false);
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
            setQuiz({ ...quiz, questions: newQuestions });
            setShowAddForm(false);
            setCustomQ({ question: '', opt1: '', opt2: '', opt3: '', opt4: '', explanation: '' });
        } catch (err) {
            console.error(err);
            alert(t('quiz.view.save_error'));
        }
    };


    const handleSendToCandidate = async () => {
        if (!window.confirm(t('quiz.view.send_confirm'))) return;

        try {
            await apiFetch(`/quiz/${quizId}/status?status=published`, {
                method: 'PATCH'
            });
            setQuiz({ ...quiz, status: 'published' });
            alert(t('quiz.view.send_success'));
        } catch (err) {
            console.error("Failed to send quiz", err);
            alert(t('quiz.view.send_error'));
        }
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
                                <div key={idx} className="qz-question-card">
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
                        {quiz.status === 'draft' && (
                            <div className="qz-add-question-actions" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        className="qz-action-btn"
                                        onClick={handleGenerateQuestion}
                                        disabled={generatingQuestion}
                                        style={{ flex: 1, justifyContent: 'center', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    >
                                        {generatingQuestion ? (
                                            <div className="qz-spinner" style={{ width: '20px', height: '20px' }}></div>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined">auto_awesome</span>
                                                {t('quiz.view.generate_ai')}
                                            </>
                                        )}
                                    </button>

                                    <button
                                        className="qz-action-btn"
                                        onClick={() => setShowAddForm(!showAddForm)}
                                        style={{ flex: 1, justifyContent: 'center', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    >
                                        <span className="material-symbols-outlined">{showAddForm ? 'close' : 'add'}</span>
                                        {showAddForm ? t('quiz.view.cancel') : t('quiz.view.add_manual')}
                                    </button>
                                </div>

                                {showAddForm && (
                                    <div className="qz-question-card" style={{ border: '2px solid var(--primary-color)' }}>
                                        <h3 style={{ marginBottom: '1rem' }}>{t('quiz.view.add_qcm_title')}</h3>
                                        <input
                                            placeholder={t('quiz.view.placeholder_question')}
                                            className="qz-input"
                                            value={customQ.question}
                                            onChange={e => setCustomQ({ ...customQ, question: e.target.value })}
                                            style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                            <input placeholder={t('quiz.view.placeholder_opt1')} value={customQ.opt1} onChange={e => setCustomQ({ ...customQ, opt1: e.target.value })} style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #4caf50', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                                            <input placeholder={t('quiz.view.placeholder_opt2')} value={customQ.opt2} onChange={e => setCustomQ({ ...customQ, opt2: e.target.value })} style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                                            <input placeholder={t('quiz.view.placeholder_opt3')} value={customQ.opt3} onChange={e => setCustomQ({ ...customQ, opt3: e.target.value })} style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                                            <input placeholder={t('quiz.view.placeholder_opt4')} value={customQ.opt4} onChange={e => setCustomQ({ ...customQ, opt4: e.target.value })} style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                                        </div>
                                        <input
                                            placeholder={t('quiz.view.placeholder_explanation')}
                                            value={customQ.explanation}
                                            onChange={e => setCustomQ({ ...customQ, explanation: e.target.value })}
                                            style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                        />
                                        <button
                                            className="qz-action-btn"
                                            onClick={handleSaveCustomQuestion}
                                            style={{ width: '100%', justifyContent: 'center', background: 'var(--primary-color)', color: 'white' }}
                                        >
                                            <span className="material-symbols-outlined">save</span>
                                            {t('quiz.view.save_q_btn')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <aside className="qz-view-sidebar">
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

                        <div className="qz-sidebar-card">
                            <h3 className="qz-sidebar-title">{t('quiz.view.actions')}</h3>
                            <div className="qz-action-buttons">
                                <button
                                    className={`qz-action-btn qz-send-btn ${isQuizLocked ? 'is-sent' : ''}`}
                                    onClick={handleSendToCandidate}
                                    disabled={isQuizLocked}
                                >
                                    <span className="material-symbols-outlined">{isQuizLocked ? 'check_circle' : 'send'}</span>
                                    {isQuizLocked ? t('quiz.view.sent_status') : t('quiz.view.send_btn')}
                                </button>
                                <button className="qz-action-btn qz-print-btn" onClick={() => window.print()}>
                                    <span className="material-symbols-outlined">print</span>
                                    {t('quiz.view.print_btn')}
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
};

export default QuizView;
