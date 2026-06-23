import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { apiFetch } from '../../../core/api'
import HRSidebar from '../components/HRSidebar'
import './TestPipeline.css'

const STATUS_LABELS = {
  new: 'New',
  in_review: 'In Review',
  technical_test: 'Technical Test',
  interview: 'Interview',
  rejected: 'Rejected',
  hired: 'Hired',
}

const STATUS_COLOR = {
  new: 'status--new',
  in_review: 'status--review',
  technical_test: 'status--test',
  interview: 'status--interview',
  rejected: 'status--rejected',
  hired: 'status--hired',
}

export default function TestPipeline() {
  const { effectiveTheme } = useTheme()

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState([])
  const [jobSearch, setJobSearch] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobsLoading, setJobsLoading] = useState(true)

  // ── Document upload ───────────────────────────────────────────────────────
  const [documents, setDocuments] = useState([])
  const [selectedDocId, setSelectedDocId] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadedDoc, setUploadedDoc] = useState(null)   // { id, title }
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  // ── Pipeline run ──────────────────────────────────────────────────────────
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [result, setResult] = useState(null)

  // ── Load jobs + documents ─────────────────────────────────────────────────
  useEffect(() => {
    apiFetch('/jobs')
      .then(data => setJobs(Array.isArray(data) ? data : []))
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false))

    apiFetch('/quiz/documents')
      .then(data => setDocuments(Array.isArray(data) ? data : []))
      .catch(() => setDocuments([]))
  }, [])

  // ── Document upload helpers ───────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png', 'image/jpeg']
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx|pptx|png|jpe?g)$/i)) {
      setUploadError('Unsupported file type. Use PDF, DOCX, PPTX, PNG or JPG.')
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', file.name.replace(/\.[^/.]+$/, ''))
      const res = await apiFetch('/quiz/upload-document', { method: 'POST', body: fd })
      const doc = { id: res.document_id, title: res.title || res.filename || file.name }
      setUploadedDoc(doc)
      setSelectedDocId(doc.id)
      setDocuments(prev => [{ _id: doc.id, title: doc.title }, ...prev.filter(d => (d._id || d.id) !== doc.id)])
    } catch (err) {
      setUploadError(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)

  // ── Run pipeline ──────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!selectedJob) return
    setRunning(true)
    setRunError('')
    setResult(null)
    try {
      const data = await apiFetch('/test-pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: selectedJob._id || selectedJob.id,
          document_id: selectedDocId || null,
        }),
      })
      setResult(data)
    } catch (err) {
      setRunError(err?.message || 'Pipeline run failed')
    } finally {
      setRunning(false)
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const handleCleanup = async () => {
    if (!result) return
    try {
      await apiFetch(
        `/test-pipeline/cleanup?candidate_ids=${result.created_candidate_ids.join(',')}&app_ids=${result.created_app_ids.join(',')}&quiz_ids=${result.created_quiz_ids.join(',')}`,
        { method: 'DELETE' },
      )
      setResult(prev => ({ ...prev, cleaned: true }))
    } catch (err) {
      console.error('Cleanup failed:', err)
    }
  }

  // ── Filtered jobs ─────────────────────────────────────────────────────────
  const filteredJobs = jobs.filter(j =>
    !jobSearch || (j.title || '').toLowerCase().includes(jobSearch.toLowerCase())
  )

  return (
    <div className={`test-pipeline-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
      <HRSidebar />

      <main className="test-pipeline-main">
        <div className="test-pipeline-header">
          <div className="test-pipeline-header-icon">
            <span className="material-symbols-outlined">science</span>
          </div>
          <div>
            <h1 className="test-pipeline-title">Pipeline Test Lab</h1>
            <p className="test-pipeline-subtitle">
              Select a job, optionally upload a quiz document, then fire the full AI automation funnel with 5 synthetic candidates.
            </p>
          </div>
        </div>

        <div className="test-pipeline-body">

          {/* ── STEP 1: Job picker ── */}
          <section className="tp-card">
            <div className="tp-card-header">
              <span className="material-symbols-outlined tp-step-icon">work</span>
              <div>
                <h2 className="tp-card-title">Step 1 — Choose a Job</h2>
                <p className="tp-card-desc">The automation funnel will run against this job.</p>
              </div>
            </div>

            <div className="tp-search-wrap">
              <span className="material-symbols-outlined tp-search-icon">search</span>
              <input
                className="tp-search-input"
                placeholder="Filter jobs…"
                value={jobSearch}
                onChange={e => setJobSearch(e.target.value)}
              />
            </div>

            <div className="tp-job-list">
              {jobsLoading && (
                <div className="tp-empty">
                  <span className="material-symbols-outlined tp-spin">progress_activity</span>
                  Loading jobs…
                </div>
              )}
              {!jobsLoading && filteredJobs.length === 0 && (
                <div className="tp-empty">No jobs found.</div>
              )}
              {filteredJobs.map(job => {
                const id = job._id || job.id
                const isSelected = selectedJob && (selectedJob._id || selectedJob.id) === id
                const deadline = (job.deadline || '').slice(0, 10)
                return (
                  <button
                    key={id}
                    className={`tp-job-row ${isSelected ? 'tp-job-row--selected' : ''}`}
                    onClick={() => { setSelectedJob(job); setResult(null) }}
                  >
                    <div className="tp-job-row-left">
                      <span className="tp-job-title">{job.title}</span>
                      <span className="tp-job-company">{job.company_name || job.company_id}</span>
                    </div>
                    <div className="tp-job-row-right">
                      <span className={`tp-badge tp-badge--${job.status}`}>{job.status}</span>
                      {deadline && <span className="tp-job-deadline">{deadline}</span>}
                    </div>
                    {isSelected && <span className="material-symbols-outlined tp-job-check">check_circle</span>}
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── STEP 2: Document ── */}
          <section className="tp-card">
            <div className="tp-card-header">
              <span className="material-symbols-outlined tp-step-icon">description</span>
              <div>
                <h2 className="tp-card-title">Step 2 — Quiz Document <span className="tp-optional">(optional)</span></h2>
                <p className="tp-card-desc">
                  Upload a new document or pick an existing one. If omitted, the job's existing config is used.
                </p>
              </div>
            </div>

            {/* Drag & drop zone */}
            <div
              className={`tp-dropzone ${dragOver ? 'tp-dropzone--over' : ''} ${uploading ? 'tp-dropzone--uploading' : ''} ${uploadedDoc ? 'tp-dropzone--done' : ''}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="tp-hidden-input"
                accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg"
                onChange={e => handleFile(e.target.files?.[0])}
              />
              {uploading ? (
                <>
                  <span className="material-symbols-outlined tp-spin tp-drop-icon">progress_activity</span>
                  <p className="tp-drop-label">Uploading & processing…</p>
                </>
              ) : uploadedDoc ? (
                <>
                  <span className="material-symbols-outlined tp-drop-icon tp-drop-icon--done">check_circle</span>
                  <p className="tp-drop-label">{uploadedDoc.title}</p>
                  <p className="tp-drop-sub">Click to replace</p>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined tp-drop-icon">cloud_upload</span>
                  <p className="tp-drop-label">Drop a file here or <span className="tp-drop-link">browse</span></p>
                  <p className="tp-drop-sub">PDF · DOCX · PPTX · PNG · JPG</p>
                </>
              )}
            </div>

            {uploadError && (
              <p className="tp-upload-error">
                <span className="material-symbols-outlined">error</span> {uploadError}
              </p>
            )}

            {/* Or pick existing */}
            {documents.length > 0 && (
              <div className="tp-doc-select-wrap">
                <span className="tp-doc-select-label">Or use an existing document:</span>
                <select
                  className="tp-doc-select"
                  value={selectedDocId}
                  onChange={e => { setSelectedDocId(e.target.value); setUploadedDoc(null) }}
                >
                  <option value="">— Use job's default —</option>
                  {documents.map(doc => {
                    const id = doc._id || doc.id
                    return (
                      <option key={id} value={id}>
                        {doc.title || doc.filename || id}
                        {doc.status === 'ready' ? ' ✓' : doc.status ? ` (${doc.status})` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
            )}
          </section>

          {/* ── Run button ── */}
          <div className="tp-run-row">
            <button
              className="tp-run-btn"
              disabled={!selectedJob || running}
              onClick={handleRun}
            >
              {running ? (
                <>
                  <span className="material-symbols-outlined tp-spin">progress_activity</span>
                  Running pipeline… (1–3 min)
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">play_circle</span>
                  Run Test Pipeline
                </>
              )}
            </button>
            {!selectedJob && (
              <span className="tp-run-hint">Select a job first</span>
            )}
          </div>

          {runError && (
            <div className="tp-error-banner">
              <span className="material-symbols-outlined">error</span>
              <p>{runError}</p>
            </div>
          )}

          {/* ── Results ── */}
          {result && (
            <section className="tp-card tp-results">
              <div className="tp-card-header">
                <span className="material-symbols-outlined tp-step-icon tp-step-icon--success">check_circle</span>
                <div>
                  <h2 className="tp-card-title">Results — {result.job_title}</h2>
                  <p className="tp-card-desc">Run ID: <code>{result.run_id}</code></p>
                </div>
              </div>

              {/* Summary pills */}
              <div className="tp-summary-row">
                <div className="tp-summary-pill">
                  <span className="tp-summary-num">{result.applications_considered}</span>
                  <span className="tp-summary-lbl">Applied</span>
                </div>
                <span className="material-symbols-outlined tp-arrow">chevron_right</span>
                <div className="tp-summary-pill tp-summary-pill--x">
                  <span className="tp-summary-num">{result.vector_shortlist_count}</span>
                  <span className="tp-summary-lbl">Vector filter</span>
                </div>
                <span className="material-symbols-outlined tp-arrow">chevron_right</span>
                <div className="tp-summary-pill tp-summary-pill--y">
                  <span className="tp-summary-num">{result.ai_shortlist_count}</span>
                  <span className="tp-summary-lbl">AI filter</span>
                </div>
                <span className="material-symbols-outlined tp-arrow">chevron_right</span>
                <div className="tp-summary-pill tp-summary-pill--z">
                  <span className="tp-summary-num">{result.quizzes_published}</span>
                  <span className="tp-summary-lbl">Quizzes sent</span>
                </div>
                <span className="material-symbols-outlined tp-arrow">chevron_right</span>
                <div className="tp-summary-pill tp-summary-pill--int">
                  <span className="tp-summary-num">{result.promoted_to_interview.length}</span>
                  <span className="tp-summary-lbl">Interview</span>
                </div>
              </div>

              {/* Candidate table */}
              <div className="tp-table-wrap">
                <table className="tp-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Status</th>
                      <th>Vector</th>
                      <th>CNN</th>
                      <th>AI Score</th>
                      <th>Quiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.candidates.map((c, i) => (
                      <tr key={i}>
                        <td className="tp-td-name">{c.name}</td>
                        <td>
                          <span className={`tp-status ${STATUS_COLOR[c.status] || ''}`}>
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </td>
                        <td className="tp-td-num">{c.vector_score}%</td>
                        <td className="tp-td-num">{c.cnn_score}</td>
                        <td>
                          <div className="tp-score-bar-wrap">
                            <div
                              className="tp-score-bar"
                              style={{ '--score': `${c.ai_score}%` }}
                            />
                            <span className="tp-score-num">{c.ai_score}</span>
                          </div>
                        </td>
                        <td className="tp-td-quiz">{c.quiz_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cleanup */}
              {!result.cleaned ? (
                <button className="tp-cleanup-btn" onClick={handleCleanup}>
                  <span className="material-symbols-outlined">delete_sweep</span>
                  Clean up test data (candidates, applications, quizzes)
                </button>
              ) : (
                <p className="tp-cleaned-msg">
                  <span className="material-symbols-outlined">check</span>
                  Test data deleted.
                </p>
              )}
            </section>
          )}

        </div>
      </main>
    </div>
  )
}
