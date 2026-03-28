import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { getTranslation as t } from '../../../core/translations';
import './QuizTakingPage.css';

/** ═══════════════════════════════════════════════════════════════════
    QuizTakingPage — Zen Purple Edition
    A completely rewritten focused quiz experience.
    ═══════════════════════════════════════════════════════════════════ */

const API_BASE_URL = 'http://localhost:8000';

const QuizTakingPage = () => {
    const { quizId } = useParams();
    const navigate = useNavigate();

    // ── State ──
    const [quiz, setQuiz] = useState(null);
    const [answers, setAnswers] = useState({});
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [finished, setFinished] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState(null);

    // ── Load Quiz ──
    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/quizzes/${quizId}`);
                setQuiz(response.data);
                
                // Initialize answers if needed
                const initialAnswers = {};
                response.data.questions.forEach(q => { initialAnswers[q.id] = null; });
                setAnswers(initialAnswers);
                
                setLoading(false);
            } catch (err) {
                console.error("Error fetching quiz:", err);
                setError(t('quiz.load_error'));
                setLoading(false);
            }
        };
        fetchQuiz();
    }, [quizId]);

    // ── Timer Logic ──
    useEffect(() => {
        if (loading || finished || error) return;
        if (timeLeft <= 0) {
            handleAutoSubmit();
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, loading, finished, error]);

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
        if (!finished) handleSubmit();
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const formattedAnswers = Object.entries(answers).map(([id, val]) => ({
                id: parseInt(id),
                answer: val
            }));
            
            await axios.post(`${API_BASE_URL}/quizzes/${quizId}/submit`, {
                answers: formattedAnswers
            });
            
            setFinished(true);
            setShowConfirm(false);
        } catch (err) {
            console.error("Error submitting quiz:", err);
            setError(t('quiz.submit_error'));
        } finally {
            setSubmitting(false);
        }
    };

    // ── Computed ──
    const progress = quiz ? ((Object.values(answers).filter(v => v !== null).length) / quiz.questions.length) * 100 : 0;
    const currentQuestion = quiz?.questions[currentIdx];
    const answeredCount = Object.values(answers).filter(v => v !== null).length;

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
                                className={`zen-timeline-item ${idx === currentIdx ? 'active' : ''} ${answers[q.id] !== null ? 'done' : ''}`}
                                onClick={() => setCurrentIdx(idx)}
                            >
                                <div className="zen-timeline-pip">
                                    {answers[q.id] !== null ? <span className="material-symbols-outlined">check</span> : (idx + 1)}
                                </div>
                                <span className="zen-timeline-label">Q{idx + 1}</span>
                            </div>
                        ))}
                    </div>
                    <div className="zen-journey-footer">
                        {answeredCount} / {quiz.questions.length} {t('quiz.answered')}
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
                                    <span className="zen-q-type">{currentQuestion.type === 'mcq' ? 'Multiple Choice' : 'Concept Check'}</span>
                                    <span className="zen-q-id">#{currentIdx + 1}</span>
                                </div>

                                <h2 className="zen-q-text">{currentQuestion.question_text}</h2>

                                <div className="zen-options-grid">
                                    {currentQuestion.type === 'mcq' && currentQuestion.options.map((opt, oIdx) => (
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
                                            {[true, false].map((val, vIdx) => (
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

                                    {currentQuestion.type === 'open' && (
                                        <textarea 
                                            className="zen-textarea"
                                            placeholder={t('quiz.placeholder_textarea')}
                                            value={answers[currentQuestion.id] || ''}
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
                            Step <strong>{currentIdx + 1}</strong> of {quiz.questions.length}
                        </div>

                        <button 
                            className="zen-btn-nav primary" 
                            onClick={handleNext}
                        >
                            {currentIdx === quiz.questions.length - 1 ? t('quiz.submit_btn') : t('quiz.next')}
                            <span className="material-symbols-outlined">
                                {currentIdx === quiz.questions.length - 1 ? 'send' : 'arrow_forward'}
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
                                    total: quiz.questions.length
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
