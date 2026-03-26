import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../core/api';
import './QuizTakingPage.css';

const QuizTakingPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null); // in seconds
  const [status, setStatus] = useState('loading'); // loading, taking, submitting, completed, error
  const [errorMsg, setErrorMsg] = useState('');

  // 10 minutes in seconds
  const MAX_TIME = 10 * 60;

  useEffect(() => {
    const initQuiz = async () => {
      try {
        // Start or resume quiz
        const startRes = await apiFetch(`/quiz/${quizId}/start`, { method: 'POST' });
        
        // Use started_at to calculate elapsed time. Ensure it is treated as UTC.
        let startedAtStr = startRes.started_at;
        if (!startedAtStr.endsWith('Z') && !startedAtStr.includes('+')) {
            startedAtStr += 'Z';
        }
        const startedAt = new Date(startedAtStr);
        const now = new Date();
        const elapsedSecs = Math.floor((now - startedAt) / 1000);
        let remaining = MAX_TIME - elapsedSecs;
        
        if (remaining <= 0) {
          remaining = 0;
          setStatus('error');
          setErrorMsg('Le temps alloué (10 minutes) est écoulé.');
        } else {
          setTimeLeft(remaining);
          // Fetch quiz details
          const quizData = await apiFetch(`/quiz/${quizId}`);
          setQuiz(quizData);
          setStatus('taking');
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message || 'Erreur lors du chargement du quiz.');
      }
    };
    initQuiz();
  }, [quizId]);

  useEffect(() => {
    let timer;
    if (status === 'taking' && timeLeft !== null && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmit(); // Auto-submit when time is up
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, timeLeft]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setStatus('submitting');
    try {
      // Format answers
      const submission = {
        answers: Object.entries(answers).map(([qId, ans]) => ({
          question_id: qId,
          answer: ans
        }))
      };

      await apiFetch(`/quiz/${quizId}/submit`, {
        method: 'POST',
        body: JSON.stringify(submission)
      });

      setStatus('completed');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Erreur lors de la soumission du quiz. Assurez-vous de soumettre avant la limite de temps.');
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (status === 'loading') return <div className="quiz-taking-container"><div className="loader">Chargement...</div></div>;
  if (status === 'completed') return (
    <div className="quiz-taking-container success">
      <h2>Quiz Terminé</h2>
      <p>Vos réponses ont été enregistrées avec succès.</p>
      <button onClick={() => navigate('/candidat/dashboard')}>Retour au tableau de bord</button>
    </div>
  );

  if (status === 'error') return (
    <div className="quiz-taking-container error">
      <h2>Erreur/Terminé</h2>
      <p>{errorMsg}</p>
      <button onClick={() => navigate('/candidat/dashboard')}>Retour</button>
    </div>
  );

  return (
    <div className="quiz-taking-container">
      <div className="quiz-header">
        <h2>{quiz?.title || 'Quiz'}</h2>
        <div className={`quiz-timer ${timeLeft < 60 ? 'danger' : ''}`}>
          Temps restant: {formatTime(timeLeft)}
        </div>
      </div>
      
      <div className="quiz-questions">
        {quiz?.questions?.map((q, idx) => (
          <div key={q.id} className="quiz-question-card">
            <h3>Question {idx + 1}</h3>
            <p className="question-text">{q.question}</p>
            
            <div className="question-options">
              {q.type === 'mcq' && q.options?.map((opt, oIdx) => (
                <label key={oIdx} className="quiz-option">
                  <input 
                    type="radio" 
                    name={`q-${q.id}`} 
                    value={oIdx} 
                    checked={answers[q.id] === oIdx}
                    onChange={() => handleAnswerChange(q.id, oIdx)}
                  />
                  <span>{opt}</span>
                </label>
              ))}

              {q.type === 'tf' && ['Vrai', 'Faux'].map((opt, oIdx) => {
                const val = opt === 'Vrai';
                return (
                  <label key={oIdx} className="quiz-option">
                    <input 
                      type="radio" 
                      name={`q-${q.id}`} 
                      value={val} 
                      checked={answers[q.id] === val}
                      onChange={() => handleAnswerChange(q.id, val)}
                    />
                    <span>{opt}</span>
                  </label>
                )
              })}

              {q.type !== 'mcq' && q.type !== 'tf' && (
                <textarea 
                  className="quiz-textarea"
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  placeholder="Votre réponse..."
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="quiz-footer">
        <button 
          className="submit-btn" 
          onClick={handleSubmit}
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? 'Soumission...' : 'Soumettre le Quiz'}
        </button>
      </div>
    </div>
  );
};

export default QuizTakingPage;
