import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { apiFetch } from '../../../core/api';

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

const emptyBatch = (jobTitle) => ({
    jobTitle,
    phase: 'drop', // 'drop' | 'parsing' | 'review' | 'submit' | 'result'
    queue: [],
    isParsingActive: false,
    connectionIssue: false,
    reviewIndex: 0,
    submitResult: null,
    isSubmitting: false,
    // Bumped every time a create actually lands, so a page that cares about
    // one particular jobId's batch (JobDetail) can tell "results changed"
    // apart from any other batch state churn.
    createdCount: 0,
});

const ManualCandidatesContext = createContext(null);

export const useManualCandidates = () => {
    const ctx = useContext(ManualCandidatesContext);
    if (!ctx) throw new Error('useManualCandidates must be used within a ManualCandidatesProvider');
    return ctx;
};

export const ManualCandidatesProvider = ({ children }) => {
    const [batches, setBatches] = useState({});
    const [focusedJobId, setFocusedJobId] = useState(null);
    // Mirrors `batches` synchronously so action callbacks (startParsing,
    // cancelBatch, submitConfirmed...) can read the just-applied state
    // without waiting for React's async setState to flush - see
    // applyBatches below.
    const batchesRef = useRef({});
    // One entry per jobId that currently has (or very recently had) a
    // batch. Tracks in-flight async work independently of React state so
    // overlapping batches, or a batch canceled mid-flight, can never
    // clobber each other's writes - same rationale as the generation-token
    // refs this replaces, just keyed per job instead of per component
    // instance.
    const guardsRef = useRef(new Map());

    const getGuards = (jobId) => {
        if (!guardsRef.current.has(jobId)) {
            guardsRef.current.set(jobId, {
                activeRun: false,
                runGeneration: 0,
                submitGeneration: 0,
                inFlightStagedIds: new Set(),
            });
        }
        return guardsRef.current.get(jobId);
    };

    const applyBatches = useCallback((updater) => {
        const next = typeof updater === 'function' ? updater(batchesRef.current) : updater;
        batchesRef.current = next;
        setBatches(next);
    }, []);

    const patchBatch = useCallback((jobId, patch) => {
        applyBatches((current) => {
            const batch = current[jobId];
            if (!batch) return current;
            const patchObj = typeof patch === 'function' ? patch(batch) : patch;
            return { ...current, [jobId]: { ...batch, ...patchObj } };
        });
    }, [applyBatches]);

    const patchQueueItem = useCallback((jobId, localId, patch) => {
        applyBatches((current) => {
            const batch = current[jobId];
            if (!batch) return current;
            return {
                ...current,
                [jobId]: { ...batch, queue: batch.queue.map((q) => (q.localId === localId ? { ...q, ...patch } : q)) },
            };
        });
    }, [applyBatches]);

    const discardStaged = useCallback(async (stagedId) => {
        if (!stagedId) return;
        try {
            await apiFetch(`/manual-candidates/staged/${stagedId}`, { method: 'DELETE' });
        } catch (err) {
            console.error('Failed to discard staged CV:', err);
        }
    }, []);

    // Creates a batch for jobId if one doesn't already exist, and focuses
    // it either way - so clicking "Add candidates" again on a job that
    // already has a running/paused batch just resumes it instead of
    // clobbering it.
    const openBatch = useCallback((jobId, jobTitle) => {
        applyBatches((current) => (current[jobId] ? current : { ...current, [jobId]: emptyBatch(jobTitle) }));
        setFocusedJobId(jobId);
    }, [applyBatches]);

    const focusBatch = useCallback((jobId) => setFocusedJobId(jobId), []);

    // X / overlay click: hides the modal without touching batch state, in
    // every phase - the batch (and any in-flight parse/submit work) keeps
    // running and stays resumable from the tray.
    const minimizeFocused = useCallback(() => setFocusedJobId(null), []);

    // Fully discards a batch: same abandoned-staged-CV cleanup the old
    // single-instance resetAndClose did (see git history for the
    // decision-by-decision rationale), just scoped to one jobId's
    // queue/guards instead of a whole component instance. Used by the
    // explicit "Cancel" button (drop/parsing/review phases) and the
    // result screen's "Close" button - X/overlay click never reaches this.
    const cancelBatch = useCallback((jobId) => {
        const batch = batchesRef.current[jobId];
        if (!batch) return;
        const guards = getGuards(jobId);
        const confirmedStagedIds = new Set([
            ...(batch.submitResult?.invited || []),
            ...(batch.submitResult?.linked || []),
        ].map((c) => c.staged_id));
        batch.queue.forEach((q) => {
            if (!q.stagedId) return;
            if (confirmedStagedIds.has(q.stagedId)) return;
            if (q.decision === 'confirmed' && guards.inFlightStagedIds.has(q.stagedId)) return;
            discardStaged(q.stagedId); // fire-and-forget, matches discardStaged's own error handling
        });
        // Invalidate any parse/submit work still in flight for this batch.
        // Orphaned calls keep their own reference to this exact guards
        // object (captured before this delete), so their generation checks
        // still compare correctly even after guardsRef stops tracking
        // jobId - see runParsingQueue/submitConfirmed below.
        guards.submitGeneration += 1;
        guards.runGeneration += 1;
        guards.activeRun = false;
        guardsRef.current.delete(jobId);

        applyBatches((current) => {
            const next = { ...current };
            delete next[jobId];
            return next;
        });
        setFocusedJobId((prev) => (prev === jobId ? null : prev));
    }, [applyBatches, discardStaged]);

    const handleFilesSelected = useCallback((jobId, fileList) => {
        const files = Array.from(fileList || []).filter(isAcceptedFile);
        if (files.length === 0) return;
        patchBatch(jobId, (b) => ({
            queue: [
                ...b.queue,
                ...files.map((file) => ({
                    localId: crypto.randomUUID(),
                    file,
                    status: 'queued',
                    error: null,
                    stagedId: null,
                    profile: null,
                    decision: 'pending',
                })),
            ],
        }));
    }, [patchBatch]);

    const removeQueuedFile = useCallback((jobId, localId) => {
        patchBatch(jobId, (b) => ({ queue: b.queue.filter((q) => q.localId !== localId) }));
    }, [patchBatch]);

    const runParsingQueue = useCallback(async (jobId, items) => {
        const guards = getGuards(jobId);
        // Backstop against overlapping invocations for the same job (e.g. a
        // per-row retry firing while another run is still in flight for it).
        if (guards.activeRun) return;
        guards.activeRun = true;

        const pending = items.filter((q) => q.status === 'queued' || q.status === 'failed');
        if (pending.length === 0) {
            guards.activeRun = false;
            return;
        }

        // Only the run whose token still matches guards.runGeneration when
        // it completes may reset the shared isParsingActive state - stops
        // an orphaned run (job canceled, or superseded by a newer run)
        // from clobbering a newer run's state when it eventually resolves.
        const myRun = ++guards.runGeneration;

        patchBatch(jobId, { isParsingActive: true, connectionIssue: false });
        const failureState = { consecutive: 0, stopped: false };
        let nextIdx = 0;

        const worker = async () => {
            for (;;) {
                if (failureState.stopped) return;
                const idx = nextIdx;
                nextIdx += 1;
                if (idx >= pending.length) return;
                const item = pending[idx];

                patchQueueItem(jobId, item.localId, { status: 'parsing', error: null });
                try {
                    const res = await parseOneFile(item, jobId);
                    failureState.consecutive = 0;
                    patchQueueItem(jobId, item.localId, { status: 'parsed', stagedId: res.staged_id, profile: res.parsed });
                } catch (err) {
                    failureState.consecutive += 1;
                    patchQueueItem(jobId, item.localId, { status: 'failed', error: err.message || 'Parsing failed' });
                    if (failureState.consecutive >= MAX_CONSECUTIVE_FAILURES) {
                        failureState.stopped = true;
                        patchBatch(jobId, { connectionIssue: true });
                    }
                }
            }
        };

        try {
            await Promise.all(Array.from({ length: Math.min(PARSE_CONCURRENCY, pending.length) }, worker));
        } catch (err) {
            // Each worker already swallows its own errors into per-item
            // `failed` status, so Promise.all should never actually reject.
            // Defensive against a future refactor - see the single-instance
            // version this was ported from.
            console.error('Unexpected parsing queue error:', err);
        } finally {
            if (guards.runGeneration === myRun) {
                guards.activeRun = false;
                patchBatch(jobId, { isParsingActive: false });
            }
        }
    }, [patchBatch, patchQueueItem]);

    const startParsing = useCallback((jobId) => {
        patchBatch(jobId, { phase: 'parsing' });
        const batch = batchesRef.current[jobId];
        if (batch) runParsingQueue(jobId, batch.queue);
    }, [patchBatch, runParsingQueue]);

    const setReviewIndex = useCallback((jobId, idx) => {
        patchBatch(jobId, { reviewIndex: idx });
    }, [patchBatch]);

    const discardReviewItem = useCallback((jobId, item) => {
        discardStaged(item.stagedId);
        patchQueueItem(jobId, item.localId, { decision: 'discarded' });
        patchBatch(jobId, { reviewIndex: 0 });
    }, [discardStaged, patchQueueItem, patchBatch]);

    const confirmReviewItem = useCallback((jobId, item) => {
        patchQueueItem(jobId, item.localId, { decision: 'confirmed' });
        patchBatch(jobId, { reviewIndex: 0 });
    }, [patchQueueItem, patchBatch]);

    const submitConfirmed = useCallback(async (jobId) => {
        const batch = batchesRef.current[jobId];
        if (!batch) return;
        const confirmedItems = batch.queue.filter((q) => q.decision === 'confirmed');
        if (confirmedItems.length === 0) return;

        const guards = getGuards(jobId);
        // If cancelBatch (or a later retry) bumps submitGeneration before
        // this resolves, the checks below see a mismatch and skip writing
        // stale state into what may now be a different/removed batch.
        const mySubmitGen = ++guards.submitGeneration;
        const stagedIds = confirmedItems.map((q) => q.stagedId);
        stagedIds.forEach((id) => guards.inFlightStagedIds.add(id));

        patchBatch(jobId, { phase: 'submit', isSubmitting: true });
        try {
            const res = await apiFetch('/manual-candidates/confirm', {
                method: 'POST',
                body: JSON.stringify({
                    job_id: jobId,
                    candidates: confirmedItems.map((q) => ({ staged_id: q.stagedId, profile: q.profile })),
                }),
            });
            if (guards.submitGeneration !== mySubmitGen) return;
            const succeededCount = (res.invited?.length || 0) + (res.linked?.length || 0);
            patchBatch(jobId, (b) => ({ submitResult: res, createdCount: (b.createdCount || 0) + succeededCount }));
        } catch (err) {
            if (guards.submitGeneration !== mySubmitGen) return;
            patchBatch(jobId, {
                submitResult: {
                    invited: [], linked: [],
                    failed: confirmedItems.map((q) => ({ staged_id: q.stagedId, error: err.message || 'Request failed' })),
                },
            });
        } finally {
            stagedIds.forEach((id) => guards.inFlightStagedIds.delete(id));
            if (guards.submitGeneration === mySubmitGen) {
                patchBatch(jobId, { isSubmitting: false, phase: 'result' });
            }
        }
    }, [patchBatch]);

    const retryFailedSubmissions = useCallback(async (jobId) => {
        const batch = batchesRef.current[jobId];
        if (!batch || !batch.submitResult || batch.submitResult.failed.length === 0) return;
        const failedIds = new Set(batch.submitResult.failed.map((f) => f.staged_id));
        const itemsToRetry = batch.queue.filter((q) => failedIds.has(q.stagedId));
        if (itemsToRetry.length === 0) return;

        const guards = getGuards(jobId);
        const mySubmitGen = ++guards.submitGeneration;
        const stagedIds = itemsToRetry.map((q) => q.stagedId);
        stagedIds.forEach((id) => guards.inFlightStagedIds.add(id));

        patchBatch(jobId, { isSubmitting: true });
        try {
            const res = await apiFetch('/manual-candidates/confirm', {
                method: 'POST',
                body: JSON.stringify({
                    job_id: jobId,
                    candidates: itemsToRetry.map((q) => ({ staged_id: q.stagedId, profile: q.profile })),
                }),
            });
            if (guards.submitGeneration !== mySubmitGen) return;
            patchBatch(jobId, (b) => ({
                submitResult: {
                    invited: [...(b.submitResult.invited || []), ...(res.invited || [])],
                    linked: [...(b.submitResult.linked || []), ...(res.linked || [])],
                    failed: res.failed,
                },
                createdCount: (b.createdCount || 0) + (res.invited?.length || 0) + (res.linked?.length || 0),
            }));
        } catch (err) {
            console.error('Retry submission failed:', err);
        } finally {
            stagedIds.forEach((id) => guards.inFlightStagedIds.delete(id));
            if (guards.submitGeneration === mySubmitGen) {
                patchBatch(jobId, { isSubmitting: false });
            }
        }
    }, [patchBatch]);

    const value = {
        batches,
        focusedJobId,
        openBatch,
        focusBatch,
        minimizeFocused,
        cancelBatch,
        patchBatch,
        patchQueueItem,
        handleFilesSelected,
        removeQueuedFile,
        startParsing,
        runParsingQueue,
        setReviewIndex,
        discardReviewItem,
        confirmReviewItem,
        submitConfirmed,
        retryFailedSubmissions,
    };

    return (
        <ManualCandidatesContext.Provider value={value}>
            {children}
        </ManualCandidatesContext.Provider>
    );
};
