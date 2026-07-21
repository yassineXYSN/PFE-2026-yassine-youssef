import React, { useCallback, useRef, useState } from 'react';
import { useLanguage } from '../../../../core/useLanguage';
import { apiFetch } from '../../../../core/api';
import './ManualCandidatesModal.css';

const ACCEPTED_EXTS = ['.pdf', '.doc', '.docx'];
const PARSE_CONCURRENCY = 3;
const MAX_CONSECUTIVE_FAILURES = 3;

const isAcceptedFile = (file) => {
    const name = (file?.name || '').toLowerCase();
    return ACCEPTED_EXTS.some((ext) => name.endsWith(ext));
};

const parseOneFile = async (item, jobId) => {
    const formData = new FormData();
    formData.append('job_id', jobId);
    formData.append('cv', item.file, item.file.name);
    return apiFetch('/manual-candidates/parse', { method: 'POST', body: formData });
};

// eslint-disable-next-line no-unused-vars -- onCandidatesAdded consumed by the submit phase added in Task 10
const ManualCandidatesModal = ({ isOpen, onClose, jobId, onCandidatesAdded }) => {
    const { t } = useLanguage();
    const [phase, setPhase] = useState('drop'); // 'drop' | 'parsing' | 'review' | 'submitting' | 'result'
    const [queue, setQueue] = useState([]);
    const [dragOver, setDragOver] = useState(false);
    const [isParsingActive, setIsParsingActive] = useState(false);
    const [connectionIssue, setConnectionIssue] = useState(false);
    const fileInputRef = useRef(null);
    const activeRunRef = useRef(false);
    const runGenerationRef = useRef(0);

    const resetAndClose = useCallback(() => {
        setPhase('drop');
        setQueue([]);
        // Invalidate any orphaned in-flight run's token so its eventual
        // `finally` block (see runParsingQueue) recognizes it's no longer
        // the run of record and skips resetting shared state. Without this,
        // an orphaned run from a cancelled batch could resolve after a new
        // batch has already started and clobber that new batch's
        // isParsingActive/activeRunRef state out from under it.
        runGenerationRef.current += 1;
        // Release the re-entrancy guard so a fresh batch started after this
        // cancel isn't blocked by an orphaned in-flight run. Any workers from
        // that orphaned run still resolve in the background, but their
        // patchQueueItem calls map over the now-emptied queue and become
        // no-ops, so they can't corrupt the new batch's state.
        activeRunRef.current = false;
        setIsParsingActive(false);
        onClose();
    }, [onClose]);

    const handleFilesSelected = useCallback((fileList) => {
        const files = Array.from(fileList || []).filter(isAcceptedFile);
        if (files.length === 0) return;
        setQueue((prev) => [
            ...prev,
            ...files.map((file) => ({
                localId: crypto.randomUUID(),
                file,
                status: 'queued',
                error: null,
                stagedId: null,
                profile: null,
                decision: 'pending',
            })),
        ]);
    }, []);

    const removeQueuedFile = useCallback((localId) => {
        setQueue((prev) => prev.filter((q) => q.localId !== localId));
    }, []);

    const patchQueueItem = useCallback((localId, patch) => {
        setQueue((prev) => prev.map((q) => (q.localId === localId ? { ...q, ...patch } : q)));
    }, []);

    const runParsingQueue = useCallback(async (items) => {
        // Backstop against overlapping invocations (e.g. a per-row retry or
        // "Reprendre" click firing while another run is still in flight).
        // The UI disables those triggers while isParsingActive is true, but
        // this ref guards against any remaining race regardless.
        if (activeRunRef.current) return;
        activeRunRef.current = true;
        // Capture this run's generation token. Only the run whose token
        // still matches runGenerationRef.current when it completes is
        // allowed to reset the shared activeRunRef/isParsingActive state in
        // the `finally` block below — this stops an orphaned run (e.g. one
        // left running in the background after Cancel) from clobbering a
        // newer, still-active run's state when it eventually resolves.
        const myRun = ++runGenerationRef.current;

        const pending = items.filter((q) => q.status === 'queued' || q.status === 'failed');
        if (pending.length === 0) {
            activeRunRef.current = false;
            return;
        }

        setIsParsingActive(true);
        setConnectionIssue(false);
        const failureState = { consecutive: 0, stopped: false };
        let nextIdx = 0;

        const worker = async () => {
            for (;;) {
                if (failureState.stopped) return;
                const idx = nextIdx;
                nextIdx += 1;
                if (idx >= pending.length) return;
                const item = pending[idx];

                patchQueueItem(item.localId, { status: 'parsing', error: null });
                try {
                    const res = await parseOneFile(item, jobId);
                    failureState.consecutive = 0;
                    patchQueueItem(item.localId, { status: 'parsed', stagedId: res.staged_id, profile: res.parsed });
                } catch (err) {
                    failureState.consecutive += 1;
                    patchQueueItem(item.localId, { status: 'failed', error: err.message || 'Parsing failed' });
                    if (failureState.consecutive >= MAX_CONSECUTIVE_FAILURES) {
                        failureState.stopped = true;
                        setConnectionIssue(true);
                    }
                }
            }
        };

        try {
            await Promise.all(Array.from({ length: Math.min(PARSE_CONCURRENCY, pending.length) }, worker));
        } catch (err) {
            // Each worker already swallows its own errors into per-item
            // `failed` status, so Promise.all should never actually reject.
            // This is defensive against a future refactor: without it, a
            // rejection would propagate uncaught to callers (startParsing/
            // retryFailed/the per-row retry onClick), none of which await
            // or catch this promise, producing an unhandled rejection.
            console.error('Unexpected parsing queue error:', err);
        } finally {
            // Only the run of record may reset shared state. If this run
            // was orphaned by a Cancel (resetAndClose bumps
            // runGenerationRef) and a newer run has since started, its
            // token no longer matches and this reset is skipped so it
            // can't clobber the newer run's isParsingActive/activeRunRef.
            if (runGenerationRef.current === myRun) {
                activeRunRef.current = false;
                setIsParsingActive(false);
            }
        }
    }, [jobId, patchQueueItem]);

    const startParsing = useCallback(() => {
        setPhase('parsing');
        runParsingQueue(queue);
    }, [queue, runParsingQueue]);

    const retryFailed = useCallback(() => {
        runParsingQueue(queue);
    }, [queue, runParsingQueue]);

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFilesSelected(e.dataTransfer.files);
    };

    if (!isOpen) return null;

    return (
        <div className="mcm-overlay" onClick={resetAndClose}>
            <div className="mcm-card" onClick={(e) => e.stopPropagation()}>
                <header className="mcm-header">
                    <h2>{t('hr-manual-modal-title')}</h2>
                    <button type="button" className="mcm-close" onClick={resetAndClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                <div className="mcm-body">
                    {phase === 'drop' && (
                        <>
                            <div
                                className={`mcm-dropzone${dragOver ? ' mcm-dropzone--over' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={onDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <span className="material-symbols-outlined mcm-dropzone-icon">cloud_upload</span>
                                <strong>{t('hr-manual-modal-drop-title')}</strong>
                                <span className="mcm-dropzone-hint">{t('hr-manual-modal-drop-hint')}</span>
                                <span className="mcm-dropzone-browse">{t('hr-manual-modal-browse')}</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx"
                                    className="mcm-hidden-input"
                                    onChange={(e) => handleFilesSelected(e.target.files)}
                                />
                            </div>

                            {queue.length > 0 && (
                                <div className="mcm-queued-list">
                                    <p className="mcm-queued-count">
                                        {t('hr-manual-modal-queued-count').replace('{count}', queue.length)}
                                    </p>
                                    {queue.map((q) => (
                                        <div key={q.localId} className="mcm-queued-row">
                                            <span className="material-symbols-outlined">description</span>
                                            <span className="mcm-queued-name">{q.file.name}</span>
                                            <button
                                                type="button"
                                                className="mcm-queued-remove"
                                                onClick={() => removeQueuedFile(q.localId)}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mcm-actions">
                                <button type="button" className="mcm-btn mcm-btn--secondary" onClick={resetAndClose}>
                                    {t('hr-manual-modal-cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="mcm-btn mcm-btn--primary"
                                    disabled={queue.length === 0}
                                    onClick={startParsing}
                                >
                                    {t('hr-manual-modal-start-parsing')}
                                </button>
                            </div>
                        </>
                    )}

                    {phase === 'parsing' && (() => {
                        const total = queue.length;
                        const settled = queue.filter((q) => q.status === 'parsed' || q.status === 'failed').length;
                        const parsedCount = queue.filter((q) => q.status === 'parsed').length;
                        const percent = total === 0 ? 0 : Math.round((settled / total) * 100);
                        const STATUS_LABEL_KEY = {
                            queued: 'hr-manual-modal-status-queued',
                            parsing: 'hr-manual-modal-status-parsing',
                            parsed: 'hr-manual-modal-status-parsed',
                            failed: 'hr-manual-modal-status-failed',
                        };
                        return (
                            <>
                                <div className="mcm-progress-wrap">
                                    <div className="mcm-progress-track">
                                        <div className="mcm-progress-fill" style={{ width: `${percent}%` }} />
                                    </div>
                                    <span className="mcm-progress-label">
                                        {t('hr-manual-modal-parsing-progress')
                                            .replace('{done}', settled)
                                            .replace('{total}', total)
                                            .replace('{percent}', percent)}
                                    </span>
                                </div>

                                {connectionIssue && (
                                    <div className="mcm-connection-banner">
                                        <span className="material-symbols-outlined">wifi_off</span>
                                        <span>{t('hr-manual-modal-connection-issue')}</span>
                                        <button
                                            type="button"
                                            className="mcm-btn mcm-btn--secondary"
                                            disabled={isParsingActive}
                                            onClick={retryFailed}
                                        >
                                            {t('hr-manual-modal-resume')}
                                        </button>
                                    </div>
                                )}

                                <div className="mcm-queued-list">
                                    {queue.map((q) => (
                                        <div key={q.localId} className={`mcm-queued-row mcm-queued-row--${q.status}`}>
                                            <span className="material-symbols-outlined">description</span>
                                            <span className="mcm-queued-name">{q.file.name}</span>
                                            <span className="mcm-queued-status">{t(STATUS_LABEL_KEY[q.status])}</span>
                                            {q.status === 'failed' && (
                                                <button
                                                    type="button"
                                                    className="mcm-queued-remove"
                                                    title={q.error || ''}
                                                    disabled={isParsingActive}
                                                    onClick={() => runParsingQueue([q])}
                                                >
                                                    <span className="material-symbols-outlined">refresh</span>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="mcm-actions">
                                    <button type="button" className="mcm-btn mcm-btn--secondary" onClick={resetAndClose}>
                                        {t('hr-manual-modal-cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        className="mcm-btn mcm-btn--primary"
                                        disabled={isParsingActive || parsedCount === 0}
                                        onClick={() => setPhase('review')}
                                    >
                                        {t('hr-manual-modal-continue-review').replace('{count}', parsedCount)}
                                    </button>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default ManualCandidatesModal;
