import React, { useState, useEffect } from 'react';
import './QuizDashboard.css';

/**
 * Styled Minimal React prototype for the HR Quiz Generation Dashboard.
 */

const QuizDashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isMultiDoc, setIsMultiDoc] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [nextDocToAdd, setNextDocToAdd] = useState('');

  useEffect(() => {
    fetchDocuments();
    fetchTemplates();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/quiz/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to fetch documents", err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/quiz/templates/list');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error("Failed to fetch templates", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus('Uploading Document...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);

    try {
      const res = await fetch('http://localhost:8000/api/quiz/upload-document', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setUploadStatus('Upload complete! ✅');
        fetchDocuments();
      } else {
        let errorMsg = `HTTP Error ${res.status}`;
        try {
          // Attempt to parse JSON response (e.g. FastAPI HTTPException)
          const errorJson = await res.clone().json();
          errorMsg = errorJson.detail || errorMsg;
        } catch {
          // Fall back to plain text (e.g. Vite proxy timeout HTML)
          const errorText = await res.text();
          errorMsg = errorText.length < 100 ? errorText : `HTTP Error ${res.status} (Check terminal logs)`;
        }
        setUploadStatus(`Upload failed ❌: ${errorMsg}`);
      }
    } catch (err) {
      setUploadStatus(`Error ❌: ${err.message}`);
    }
  };

  const handleAddDocument = (docId) => {
    if (!docId) return;
    const doc = documents.find(d => d._id === docId);
    if (!doc || selectedDocs.some(sd => sd.document_id === docId)) return;

    setSelectedDocs([...selectedDocs, {
      document_id: docId,
      title: doc.title || doc.filename,
      total_questions: 5,
      difficulty: 'medium'
    }]);
    setNextDocToAdd('');
  };

  const handleRemoveDocument = (docId) => {
    setSelectedDocs(selectedDocs.filter(sd => sd.document_id !== docId));
  };

  const handleUpdateDocConfig = (docId, field, value) => {
    setSelectedDocs(selectedDocs.map(sd => 
      sd.document_id === docId ? { ...sd, [field]: value } : sd
    ));
  };

  const handleGenerateQuiz = async () => {
    if (isMultiDoc && selectedDocs.length === 0) return;
    if (!isMultiDoc && !selectedDoc) return;
    
    setIsGenerating(true);
    setGeneratedQuiz(null);

    try {
      let res;
      if (isMultiDoc) {
        // Multi-document request
        const payload = {
          title: quizTitle || "Multi-Document Quiz",
          documents: selectedDocs.map(sd => ({
            document_id: sd.document_id,
            total_questions: parseInt(sd.total_questions),
            difficulty_mix: sd.difficulty === 'easy' ? {easy: 0.8, medium: 0.2, hard: 0} :
                           sd.difficulty === 'hard' ? {easy: 0, medium: 0.2, hard: 0.8} :
                           {easy: 0.4, medium: 0.4, hard: 0.2}
          }))
        };
        res = await fetch('http://localhost:8000/api/quiz/generate-multi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Single document request
        const url = `http://localhost:8000/api/quiz/generate?document_id=${selectedDoc}${selectedTemplate ? `&template_id=${selectedTemplate}` : ''}`;
        res = await fetch(url, { method: 'POST' });
      }

      if (res.ok) {
        const data = await res.json();
        setGeneratedQuiz(data.quiz);
      } else {
        const error = await res.json();
        alert(`Generation failed: ${error.detail}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="qz-container">
      <div className="qz-header">
        <h1>Quiz Generator</h1>
        <p>Generate AI-powered quizzes locally using Qwen2.5</p>
      </div>

      <div className="qz-grid">
        <div className="qz-sidebar">
          
          {/* Upload Card */}
          <div className="qz-card">
            <h2>1. Upload Context</h2>
            <div className="qz-upload">
              <input 
                type="file" 
                id="file-upload" 
                style={{ display: 'none' }}
                accept=".pdf,.docx,.pptx"
                onChange={handleFileUpload}
              />
              <label htmlFor="file-upload">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{margin: '0 auto 8px auto'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Click to browse files
              </label>
              <p>PDF, DOCX, PPTX (Max 50MB)</p>
            </div>
            {uploadStatus && (
              <p style={{ marginTop: '12px', fontSize: '0.9rem', color: uploadStatus.includes('❌') ? '#ef4444' : '#10b981', fontWeight: 500 }}>
                {uploadStatus}
              </p>
            )}
          </div>

          {/* Generate Card */}
          <div className="qz-card">
            <h2>2. Configure Quiz</h2>
            
            <div className="qz-mode-toggle">
              <button 
                className={`qz-mode-btn ${!isMultiDoc ? 'active' : ''}`}
                onClick={() => setIsMultiDoc(false)}
              >
                Single Document
              </button>
              <button 
                className={`qz-mode-btn ${isMultiDoc ? 'active' : ''}`}
                onClick={() => setIsMultiDoc(true)}
              >
                Multi-Document
              </button>
            </div>

            {isMultiDoc ? (
              <>
                <div className="qz-form-group">
                  <label>Quiz Title</label>
                  <input 
                    type="text" 
                    className="qz-input-title" 
                    placeholder="E.g. Full Onboarding Assessment" 
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                  />
                </div>

                <div className="qz-doc-list">
                  {selectedDocs.map(sd => (
                    <div key={sd.document_id} className="qz-doc-item">
                      <div className="qz-doc-header">
                        <span className="qz-doc-title" title={sd.title}>{sd.title}</span>
                        <button className="qz-remove-doc" onClick={() => handleRemoveDocument(sd.document_id)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="qz-doc-controls">
                        <div>
                          <label className="qz-mini-label">Questions</label>
                          <input 
                            type="number" 
                            className="qz-mini-input"
                            value={sd.total_questions}
                            onChange={(e) => handleUpdateDocConfig(sd.document_id, 'total_questions', e.target.value)}
                            min="1" max="20"
                          />
                        </div>
                        <div>
                          <label className="qz-mini-label">Difficulty</label>
                          <select 
                            className="qz-mini-input"
                            value={sd.difficulty}
                            onChange={(e) => handleUpdateDocConfig(sd.document_id, 'difficulty', e.target.value)}
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Balanced</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="qz-add-doc-section">
                  <select 
                    className="qz-select" 
                    value={nextDocToAdd} 
                    onChange={(e) => handleAddDocument(e.target.value)}
                    style={{ marginBottom: '1rem' }}
                  >
                    <option value="">+ Add another document</option>
                    {documents
                      .filter(d => !selectedDocs.some(sd => sd.document_id === d._id))
                      .map(doc => (
                        <option key={doc._id} value={doc._id}>{doc.title || doc.filename}</option>
                      ))
                    }
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="qz-form-group">
                  <label>Select source document</label>
                  <select className="qz-select" value={selectedDoc} onChange={(e) => setSelectedDoc(e.target.value)}>
                    <option value="">-- Choose a document --</option>
                    {documents.map(doc => (
                      <option key={doc._id} value={doc._id}>{doc.title || doc.filename}</option>
                    ))}
                  </select>
                </div>

                <div className="qz-form-group">
                  <label>Select Template</label>
                  <select className="qz-select" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
                    <option value="">-- Built-in Default --</option>
                    {templates.map(t => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <button 
              className="qz-btn" 
              onClick={handleGenerateQuiz} 
              disabled={isGenerating || (isMultiDoc ? selectedDocs.length === 0 : !selectedDoc)}
              style={{ marginTop: '1rem' }}
            >
              {isGenerating ? 'Generating Quiz...' : 'Generate Quiz'}
            </button>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="qz-card qz-preview-area">
          {isGenerating ? (
            <div className="qz-loading">
              <div className="qz-spinner"></div>
              <h3>Analyzing document context...</h3>
              <p>This may take a moment depending on the model size.</p>
            </div>
          ) : generatedQuiz ? (
            <div className="qz-quiz-result">
              <h2 className="qz-title">{generatedQuiz.title}</h2>
              <div style={{ marginBottom: '2rem' }}>
                <span className="qz-badge">{generatedQuiz.questions.length} Questions</span>
                <span className="qz-badge">AI Generated</span>
              </div>

              {generatedQuiz.questions.map((q, idx) => (
                <div key={idx} className="qz-question">
                  <div className="qz-q-header">
                    <h3 className="qz-q-title">
                      <span className="qz-q-num">{idx + 1}.</span> 
                      {q.question}
                    </h3>
                    <span className={`qz-diff ${q.difficulty}`}>
                      {q.difficulty}
                    </span>
                  </div>
                  {q.source_document && (
                    <div className="qz-source-label">Source: {q.source_document}</div>
                  )}

                  {q.type === 'mcq' && (
                    <div className="qz-options">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className={`qz-option ${optIdx === q.correct_index ? 'correct' : ''}`}>
                          <div className="qz-radio"></div>
                          {opt}
                          {optIdx === q.correct_index && <span className="qz-correct-label">✓ Correct</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'tf' && (
                    <div className="qz-options">
                      {['True', 'False'].map((opt, optIdx) => {
                        const isCorrect = (q.correct_answer && opt === 'True') || (!q.correct_answer && opt === 'False');
                        return (
                          <div key={optIdx} className={`qz-option ${isCorrect ? 'correct' : ''}`}>
                            <div className="qz-radio"></div>
                            {opt}
                            {isCorrect && <span className="qz-correct-label">✓ Correct</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="qz-explanation">
                    <span className="qz-exp-label">Explanation:</span> {q.explanation}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="qz-loading" style={{ opacity: 0.5 }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{marginBottom: '1rem'}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p>Configure and generate to preview the quiz here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizDashboard;
