import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../core/api';
import { useLanguage } from '../../../core/useLanguage';
import './QuizTakingPage.css';

const QuizTakingPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
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
          setErrorMsg(t('quiz.time_expired'));
        } else {
          setTimeLeft(remaining);
          // Fetch quiz details
          const quizData = await apiFetch(`/quiz/${quizId}`);
          setQuiz(quizData);
          setStatus('taking');
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message || t('quiz.load_error'));
      }
    };
    initQuiz();
  }, [quizId, t]);

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
      setErrorMsg(err.message || t('quiz.submit_error'));
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (status === 'loading') return <div className="quiz-taking-container"><div className="loader">{t('quiz.loading')}</div></div>;
  if (status === 'completed') return (
    <div className="quiz-taking-container success">
      <h2>{t('quiz.completed')}</h2>
      <p>{t('quiz.success_msg')}</p>
      <button onClick={() => navigate('/candidat/dashboard')}>{t('quiz.back_dashboard')}</button>
    </div>
  );

  if (status === 'error') return (
    <div className="quiz-taking-container error">
      <h2>{t('quiz.error_title')}</h2>
      <p>{errorMsg}</p>
      <button onClick={() => navigate('/candidat/dashboard')}>{t('quiz.back')}</button>
    </div>
  );

  return (
    <div className="quiz-taking-container">
      <div className="quiz-header">
        <h2>{quiz?.title || t('quiz.title_fallback')}</h2>
        <div className={`quiz-timer ${timeLeft < 60 ? 'danger' : ''}`}>
          {t('quiz.time_remaining')}: {formatTime(timeLeft)}
        </div>
      </div>
      
      <div className="quiz-questions">
        {quiz?.questions?.map((q, idx) => (
          <div key={q.id} className="quiz-question-card">
            <h3>{t('quiz.question_number', { number: idx + 1 })}</h3>
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

              {q.type === 'tf' && [t('quiz.option_true'), t('quiz.option_false')].map((opt, oIdx) => {
                const val = oIdx === 0; // Vrai (index 0), Faux (index 1)
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
                  placeholder={t('quiz.placeholder_textarea')}
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
          {status === 'submitting' ? t('quiz.submitting') : t('quiz.submit_btn')}
        </button>
      </div>
    </div>
  );
};

export default QuizTakingPage;
