import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../../core/api';
import { useLanguage } from '../../../core/useLanguage';
import './QuizTakingPage.css';

/** ═══════════════════════════════════════════════════════════════════
    QuizTakingPage — Zen Purple Edition
    A completely rewritten focused quiz experience.
    ═══════════════════════════════════════════════════════════════════ */

const DEFAULT_QUIZ_DURATION_MINUTES = 10;
const SECONDS_PER_MINUTE = 60;

const isAnswered = (value) => {
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }

    return value !== null;
};

const normalizeServerUtcTimestamp = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const hasExplicitTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
    return hasExplicitTimezone ? value : `${value}Z`;
};

const resolveQuizDurationMinutes = (value) => {
    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed) || parsed < 1) {
        return DEFAULT_QUIZ_DURATION_MINUTES;
    }

    return parsed;
};

const getRemainingTime = (startedAt, durationSeconds) => {
    if (!startedAt) {
        return durationSeconds;
    }

    const parsedStart = Date.parse(normalizeServerUtcTimestamp(startedAt));
    if (Number.isNaN(parsedStart)) {
        return durationSeconds;
    }

    const elapsedSeconds = Math.floor((Date.now() - parsedStart) / 1000);
    return Math.max(0, durationSeconds - elapsedSeconds);
};

const getQuestionLabel = (type) => {
    if (type === 'mcq') {
        return 'Multiple Choice';
    }

    if (type === 'tf') {
        return 'True or False';
    }

    return 'Written Response';
};

const QuizTakingPage = () => {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();

    // ── State ──
    const [quiz, setQuiz] = useState(null);
    const [answers, setAnswers] = useState({});
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(DEFAULT_QUIZ_DURATION_MINUTES * SECONDS_PER_MINUTE);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [finished, setFinished] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState(null);

    // ── Load Quiz ──
    useEffect(() => {
        let isMounted = true;

        const fetchQuiz = async () => {
            setLoading(true);
            setError(null);

            try {
                const quizData = await apiFetch(`/quiz/${quizId}`);
                const startData = quizData.status === 'completed'
                    ? { started_at: quizData.started_at }
                    : await apiFetch(`/quiz/${quizId}/start`, { method: 'POST' });
                const durationMinutes = resolveQuizDurationMinutes(startData?.duration_minutes ?? quizData.duration_minutes);

                if (!isMounted) {
                    return;
                }

                const questions = quizData.questions ?? [];
                const initialAnswers = Object.fromEntries(
                    questions.map((question) => [question.id, null])
                );

                for (const submission of quizData.candidate_answers ?? []) {
                    if (submission.question_id in initialAnswers) {
                        initialAnswers[submission.question_id] = submission.answer;
                    }
                }

                setQuiz({
                    ...quizData,
                    duration_minutes: durationMinutes
                });
                setAnswers(initialAnswers);
                setCurrentIdx(0);
                setFinished(quizData.status === 'completed');
                setTimeLeft(getRemainingTime(
                    startData?.started_at ?? quizData.started_at,
                    durationMinutes * SECONDS_PER_MINUTE
                ));
            } catch (err) {
                console.error('Error fetching quiz:', err);

                if (isMounted) {
                    setError(err.message || t('quiz.load_error'));
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchQuiz();

        return () => {
            isMounted = false;
        };
    }, [quizId]);

    // ── Timer Logic ──
    useEffect(() => {
        if (loading || finished || error || submitting) return;
        if (timeLeft <= 0) {
            handleAutoSubmit();
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, loading, finished, error, submitting]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // ── Handlers ──
    const handleAnswerChange = (qId, value) => {
        setAnswers(prev => ({ ...prev, [qId]: value }));
    };

    const handleNext = () => {
        if (currentIdx < quiz.questions.length - 1) {
            setCurrentIdx(prev => prev + 1);
        } else {
            setShowConfirm(true);
        }
    };

    const handlePrev = () => {
        if (currentIdx > 0) setCurrentIdx(prev => prev - 1);
    };

    const handleAutoSubmit = () => {
        if (!finished && !submitting) handleSubmit();
    };

    const handleSubmit = async () => {
        if (!quiz || submitting) {
            return;
        }

        setSubmitting(true);
        try {
            const formattedAnswers = Object.entries(answers)
                .filter(([, val]) => isAnswered(val))
                .map(([questionId, val]) => ({
                    question_id: questionId,
                    answer: val
                }));

            await apiFetch(`/quiz/${quizId}/submit`, {
                method: 'POST',
                body: JSON.stringify({
                    answers: formattedAnswers
                })
            });

            setFinished(true);
            setShowConfirm(false);
        } catch (err) {
            console.error('Error submitting quiz:', err);
            if (err.message === 'Time limit exceeded') {
                setError(t('quiz.time_expired', {
                    minutes: resolveQuizDurationMinutes(quiz?.duration_minutes)
                }));
            } else {
                setError(err.message || t('quiz.submit_error'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ── Computed ──
    const totalQuestions = quiz?.questions?.length ?? 0;
    const answeredCount = Object.values(answers).filter(isAnswered).length;
    const progress = totalQuestions ? (answeredCount / totalQuestions) * 100 : 0;
    const currentQuestion = totalQuestions ? quiz.questions[currentIdx] : null;
    const questionText = currentQuestion?.question || currentQuestion?.question_text || '';
    const isTextResponse = currentQuestion && !['mcq', 'tf'].includes(currentQuestion.type);

    // ── Render States ──
    if (loading) return (
        <div className="zen-page loading">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="zen-loader"
            >
                <div className="zen-spinner"></div>
                <p>{t('quiz.preparing') || 'Preparing your journey...'}</p>
            </motion.div>
        </div>
    );

    if (finished) return (
        <div className="zen-page success">
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="zen-result-card"
            >
                <div className="zen-result-icon"> <span className="material-symbols-outlined">auto_awesome</span> </div>
                <h2>{t('quiz.completed') || 'Congratulations!'}</h2>
                <p>{t('quiz.success_msg') || 'Your answers have been stored in our quantum vaults.'}</p>
                <button className="zen-btn-primary" onClick={() => navigate('/candidat/dashboard')}>
                    {t('quiz.back_dashboard')}
                </button>
            </motion.div>
        </div>
    );

    if (error) return (
        <div className="zen-page error">
            <div className="zen-result-card error">
                <div className="zen-result-icon danger"> <span className="material-symbols-outlined">error</span> </div>
                <h2>{t('quiz.error_title')}</h2>
                <p>{error}</p>
                <button className="zen-btn-secondary" onClick={() => navigate('/candidat/dashboard')}>{t('quiz.back')}</button>
            </div>
        </div>
    );

    if (!quiz || !currentQuestion) return (
        <div className="zen-page error">
            <div className="zen-result-card error">
                <div className="zen-result-icon danger"> <span className="material-symbols-outlined">error</span> </div>
                <h2>{t('quiz.error_title')}</h2>
                <p>{t('quiz.load_error')}</p>
                <button className="zen-btn-secondary" onClick={() => navigate('/candidat/dashboard')}>{t('quiz.back')}</button>
            </div>
        </div>
    );

    return (
        <div className="zen-page">
            {/* ── Background Mesh ── */}
            <div className="zen-bg">
                <div className="zen-bg-glow zen-glow-1"></div>
                <div className="zen-bg-glow zen-glow-2"></div>
            </div>

            {/* ── Top Bar ── */}
            <header className="zen-header">
                <div className="zen-header-left">
                    <span className="zen-logo-pill">TalentFlow</span>
                    <h1>{quiz?.title || t('quiz.title_fallback')}</h1>
                </div>
                
                <div className="zen-header-center">
                    <div className="zen-timer-wrap">
                        <span className="material-symbols-outlined">timer</span>
                        <span className={`zen-timer-text ${timeLeft < 60 ? 'danger' : ''}`}>
                            {formatTime(timeLeft)}
                        </span>
                    </div>
                </div>

                <div className="zen-header-right">
                    <button className="zen-btn-submit" onClick={() => setShowConfirm(true)}>
                         {t('quiz.submit_btn')}
                    </button>
                </div>
            </header>

            <main className="zen-layout">
                {/* ── Left Sidebar (Journey Timeline) ── */}
                <aside className="zen-sidebar">
                    <div className="zen-journey-title">{t('quiz.summary')}</div>
                    <div className="zen-timeline">
                        {quiz.questions.map((q, idx) => (
                            <div 
                                key={q.id} 
                                className={`zen-timeline-item ${idx === currentIdx ? 'active' : ''} ${isAnswered(answers[q.id]) ? 'done' : ''}`}
                                onClick={() => setCurrentIdx(idx)}
                            >
                                <div className="zen-timeline-pip">
                                    {isAnswered(answers[q.id]) ? <span className="material-symbols-outlined">check</span> : (idx + 1)}
                                </div>
                                <span className="zen-timeline-label">Q{idx + 1}</span>
                            </div>
                        ))}
                    </div>
                    <div className="zen-journey-footer">
                        {answeredCount} / {totalQuestions} {t('quiz.answered')}
                    </div>
                </aside>

                {/* ── Center Stage (Question) ── */}
                <section className="zen-center-stage">
                    <div className="zen-stage-header">
                        <div className="zen-progress-bar">
                            <motion.div 
                                className="zen-progress-fill" 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <div className="zen-question-container">
                        <AnimatePresence mode='wait'>
                            <motion.div
                                key={currentIdx}
                                initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                className="zen-question-card"
                            >
                                <div className="zen-q-meta">
                                    <span className="zen-q-type">{getQuestionLabel(currentQuestion.type)}</span>
                                    <span className="zen-q-id">#{currentIdx + 1}</span>
                                </div>

                                <h2 className="zen-q-text">{questionText}</h2>

                                <div className="zen-options-grid">
                                    {currentQuestion.type === 'mcq' && (currentQuestion.options ?? []).map((opt, oIdx) => (
                                        <motion.div 
                                            key={oIdx}
                                            whileHover={{ scale: 1.01, backgroundColor: 'rgba(139, 92, 246, 0.08)' }}
                                            whileTap={{ scale: 0.99 }}
                                            className={`zen-option-tile ${answers[currentQuestion.id] === oIdx ? 'selected' : ''}`}
                                            onClick={() => handleAnswerChange(currentQuestion.id, oIdx)}
                                        >
                                            <div className="zen-option-letter">{String.fromCharCode(65 + oIdx)}</div>
                                            <div className="zen-option-content">{opt}</div>
                                            <div className="zen-option-indicator">
                                                <div className="zen-radio-inner"></div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {currentQuestion.type === 'tf' && (
                                        <div className="zen-tf-row">
                                            {[true, false].map((val) => (
                                                <motion.div 
                                                    key={String(val)}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    className={`zen-option-tile tf ${answers[currentQuestion.id] === val ? 'selected' : ''}`}
                                                    onClick={() => handleAnswerChange(currentQuestion.id, val)}
                                                >
                                                    <span className="zen-option-content">{val ? t('quiz.option_true') : t('quiz.option_false')}</span>
                                                    <div className="zen-option-indicator"><div className="zen-radio-inner"></div></div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}

                                    {isTextResponse && (
                                        <textarea 
                                            className="zen-textarea"
                                            placeholder={t('quiz.placeholder_textarea')}
                                            value={typeof answers[currentQuestion.id] === 'string' ? answers[currentQuestion.id] : ''}
                                            onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                                        />
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="zen-actions">
                        <button 
                            className="zen-btn-nav" 
                            disabled={currentIdx === 0}
                            onClick={handlePrev}
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            {t('quiz.prev')}
                        </button>

                        <div className="zen-step-count">
                            Step <strong>{currentIdx + 1}</strong> of {totalQuestions}
                        </div>

                        <button 
                            className="zen-btn-nav primary" 
                            onClick={handleNext}
                        >
                            {currentIdx === totalQuestions - 1 ? t('quiz.submit_btn') : t('quiz.next')}
                            <span className="material-symbols-outlined">
                                {currentIdx === totalQuestions - 1 ? 'send' : 'arrow_forward'}
                            </span>
                        </button>
                    </div>
                </section>
            </main>

            {/* ── Confirm Modal ── */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="zen-modal-overlay"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="zen-modal-card"
                        >
                            <div className="zen-modal-icon"> <span className="material-symbols-outlined">help_outline</span> </div>
                            <h3>{t('quiz.confirm_submit_title')}</h3>
                            <p>
                                {t('quiz.confirm_submit_text', { 
                                    answered: answeredCount,
                                    total: totalQuestions
                                })}
                            </p>
                            <div className="zen-modal-btns">
                                <button className="zen-btn-text" onClick={() => setShowConfirm(false)}>
                                    {t('quiz.cancel')}
                                </button>
                                <button className="zen-btn-confirm" disabled={submitting} onClick={handleSubmit}>
                                    {submitting ? t('quiz.submitting') : t('quiz.confirm_submit')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default QuizTakingPage;
