import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import HRSidebar from '../components/HRSidebar';
import { apiFetch } from '../../../core/api';
import './QuizView.css';

const QuizView = () => {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { effectiveTheme } = useTheme();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const data = await apiFetch(`/quiz/${quizId}`);
                setQuiz(data);
            } catch (err) {
                console.error("Failed to fetch quiz", err);
                setError("Oups ! Impossible de charger ce quiz. Il se peut qu'il n'existe pas ou que le serveur soit injoignable.");
            } finally {
                setLoading(false);
            }
        };
        fetchQuiz();
    }, [quizId]);

    if (loading) {
        return (
            <div className={`qz-view-page ${effectiveTheme === 'dark' ? 'dark' : 'light'}`}>
                <HRSidebar />
                <main className="qz-view-main qz-center">
                    <div className="qz-spinner"></div>
                    <p className="qz-loading-text">Chargement du quiz technique...</p>
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
                    <h2 className="qz-error-title">{error || "Quiz non trouvé"}</h2>
                    <button className="qz-back-btn" onClick={() => navigate(-1)}>
                        <span className="material-symbols-outlined">arrow_back</span>
                        Retourner au profil
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
                            <span className="qz-tag">Assessment Technique</span>
                            <h1 className="qz-view-title">{quiz.title}</h1>
                        </div>
                    </div>
                    <div className="qz-view-badges">
                        <span className="qz-stats-badge">
                            <span className="material-symbols-outlined">help</span>
                            {quiz.questions?.length || 0} Questions
                        </span>
                        <span className="qz-stats-badge">
                            <span className="material-symbols-outlined">event</span>
                            {quiz.generated_at ? new Date(quiz.generated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date inconnue'}
                        </span>
                    </div>
                </header>

                <div className="qz-view-content">
                    <div className="qz-questions-list">
                        {quiz.questions?.map((q, idx) => (
                            <div key={idx} className="qz-question-card">
                                <div className="qz-q-top">
                                    <span className="qz-q-number">Question #{idx + 1}</span>
                                    <span className={`qz-difficulty-tag ${q.difficulty}`}>
                                        {q.difficulty}
                                    </span>
                                </div>
                                <h3 className="qz-q-text">{q.question}</h3>
                                
                                {q.source_document && (
                                    <div className="qz-q-source">
                                        <span className="material-symbols-outlined">description</span>
                                        Source: {q.source_document}
                                    </div>
                                )}

                                {q.type === 'mcq' && (
                                    <div className="qz-q-options">
                                        {q.options.map((opt, optIdx) => (
                                            <div key={optIdx} className={`qz-q-option ${optIdx === q.correct_index ? 'is-correct' : ''}`}>
                                                <div className="qz-opt-indicator">
                                                    {optIdx === q.correct_index && <span className="material-symbols-outlined">check</span>}
                                                </div>
                                                <span className="qz-opt-text">{opt}</span>
                                                {optIdx === q.correct_index && (
                                                    <span className="qz-correct-label">Réponse Correcte</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {q.type === 'tf' && (
                                    <div className="qz-q-options">
                                        {['True', 'False'].map((opt, optIdx) => {
                                            const isCorrect = (q.correct_answer && opt === 'True') || (!q.correct_answer && opt === 'False');
                                            return (
                                                <div key={optIdx} className={`qz-q-option ${isCorrect ? 'is-correct' : ''}`}>
                                                    <div className="qz-opt-indicator">
                                                        {isCorrect && <span className="material-symbols-outlined">check</span>}
                                                    </div>
                                                    <span className="qz-opt-text">{opt === 'True' ? 'Vrai' : 'Faux'}</span>
                                                    {isCorrect && <span className="qz-correct-label">Correct</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="qz-q-explanation">
                                    <strong>Explication :</strong> {q.explanation}
                                </div>
                            </div>
                        ))}
                    </div>

                    <aside className="qz-view-sidebar">
                        <div className="qz-sidebar-card">
                            <h3 className="qz-sidebar-title">Distribution</h3>
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
                            <h3 className="qz-sidebar-title">Actions</h3>
                            <div className="qz-action-buttons">
                                <button className="qz-action-btn qz-print-btn" onClick={() => window.print()}>
                                    <span className="material-symbols-outlined">print</span>
                                    Imprimer
                                </button>
                                <button className="qz-action-btn qz-copy-btn" onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    alert("Lien copié !");
                                }}>
                                    <span className="material-symbols-outlined">link</span>
                                    Copier le lien
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
