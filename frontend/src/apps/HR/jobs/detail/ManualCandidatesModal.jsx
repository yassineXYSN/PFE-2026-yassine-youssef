import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const TextField = ({ label, value, onChange, type = 'text' }) => (
    <label className="mcm-field">
        <span className="mcm-field-label">{label}</span>
        <input
            type={type}
            className="mcm-field-input"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        />
    </label>
);

const SkillLikeListEditor = ({ label, items, onChange }) => {
    const [draftName, setDraftName] = useState('');
    const list = Array.isArray(items) ? items : [];

    const addItem = () => {
        const name = draftName.trim();
        if (!name) return;
        onChange([...list, { id: crypto.randomUUID(), name, level: 50 }]);
        setDraftName('');
    };

    const removeItem = (id) => onChange(list.filter((it) => it.id !== id));

    return (
        <div className="mcm-list-editor">
            <span className="mcm-field-label">{label}</span>
            <div className="mcm-tag-list">
                {list.map((it) => (
                    <span key={it.id} className="mcm-tag">
                        {it.name}
                        <button type="button" onClick={() => removeItem(it.id)}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </span>
                ))}
            </div>
            <div className="mcm-tag-input-row">
                <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                />
                <button type="button" className="mcm-btn mcm-btn--secondary" onClick={addItem}>
                    <span className="material-symbols-outlined">add</span>
                </button>
            </div>
        </div>
    );
};

const GroupListEditor = ({ label, items, onChange, fields, emptyItem }) => {
    const list = Array.isArray(items) ? items : [];

    const updateAt = (idx, key, value) => {
        const next = list.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
        onChange(next);
    };

    const addGroup = () => onChange([...list, { id: crypto.randomUUID(), ...emptyItem }]);
    const removeGroup = (idx) => onChange(list.filter((_, i) => i !== idx));

    return (
        <div className="mcm-list-editor">
            <span className="mcm-field-label">{label}</span>
            {list.map((it, idx) => (
                <div key={it.id ?? idx} className="mcm-group-row">
                    {fields.map((f) => (
                        <input
                            key={f.key}
                            type="text"
                            placeholder={f.placeholder}
                            className="mcm-group-input"
                            value={it[f.key] || ''}
                            onChange={(e) => updateAt(idx, f.key, e.target.value)}
                        />
                    ))}
                    <button type="button" className="mcm-queued-remove" onClick={() => removeGroup(idx)}>
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                </div>
            ))}
            <button type="button" className="mcm-btn mcm-btn--secondary" onClick={addGroup}>
                <span className="material-symbols-outlined">add</span>
            </button>
        </div>
    );
};

const CvPreview = ({ file, t }) => {
    const [previewUrl, setPreviewUrl] = useState(null);
    const isPdf = (file?.name || '').toLowerCase().endsWith('.pdf');

    React.useEffect(() => {
        if (!file) {
            setPreviewUrl(null);
            return undefined;
        }
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    if (isPdf && previewUrl) {
        return <iframe src={`${previewUrl}#toolbar=0`} className="mcm-cv-iframe" title={file.name} />;
    }

    return (
        <div className="mcm-cv-fallback">
            <span className="material-symbols-outlined">description</span>
            <p>{file?.name}</p>
            <p className="mcm-cv-fallback-hint">{t('hr-manual-modal-review-cv-unavailable')}</p>
            {previewUrl && (
                <a href={previewUrl} download={file.name} className="mcm-btn mcm-btn--secondary">
                    {t('hr-manual-modal-review-download')}
                </a>
            )}
        </div>
    );
};

const CandidateReviewPanel = ({ item, index, total, onChange, onDiscard, onConfirm, t }) => {
    const profile = item.profile || {};

    const setField = (key, value) => onChange({ ...profile, [key]: value });

    return (
        <div className="mcm-review-panel">
            <p className="mcm-review-counter">
                {t('hr-manual-modal-review-title').replace('{current}', index + 1).replace('{total}', total)}
            </p>
            <div className="mcm-review-grid">
                <div className="mcm-review-form">
                    <div className="mcm-field-row">
                        <TextField label={t('hr-manual-modal-field-first-name')} value={profile.firstName} onChange={(v) => setField('firstName', v)} />
                        <TextField label={t('hr-manual-modal-field-last-name')} value={profile.lastName} onChange={(v) => setField('lastName', v)} />
                    </div>
                    <div className="mcm-field-row">
                        <TextField label={t('hr-manual-modal-field-email')} value={profile.email} onChange={(v) => setField('email', v)} type="email" />
                        <TextField label={t('hr-manual-modal-field-phone')} value={profile.phone} onChange={(v) => setField('phone', v)} />
                    </div>
                    <TextField label={t('hr-manual-modal-field-title')} value={profile.title} onChange={(v) => setField('title', v)} />
                    <div className="mcm-field-row">
                        <TextField label={t('hr-manual-modal-field-birth-date')} value={profile.birthDate} onChange={(v) => setField('birthDate', v)} type="date" />
                        <TextField label={t('hr-manual-modal-field-linkedin')} value={profile.linkedinUrl} onChange={(v) => setField('linkedinUrl', v)} />
                    </div>
                    <TextField label={t('hr-manual-modal-field-address')} value={profile.address} onChange={(v) => setField('address', v)} />

                    <SkillLikeListEditor label={t('hr-manual-modal-section-skills')} items={profile.skills} onChange={(v) => setField('skills', v)} />
                    <SkillLikeListEditor label={t('hr-manual-modal-section-languages')} items={profile.languages} onChange={(v) => setField('languages', v)} />

                    <GroupListEditor
                        label={t('hr-manual-modal-section-experiences')}
                        items={profile.experiences}
                        onChange={(v) => setField('experiences', v)}
                        fields={[
                            { key: 'jobTitle', placeholder: 'Job title' },
                            { key: 'company', placeholder: 'Company' },
                            { key: 'startYear', placeholder: 'Start year' },
                            { key: 'endYear', placeholder: 'End year' },
                        ]}
                        emptyItem={{ jobTitle: '', company: '', startYear: '', endYear: '', ongoing: false, description: '' }}
                    />
                    <GroupListEditor
                        label={t('hr-manual-modal-section-educations')}
                        items={profile.educations}
                        onChange={(v) => setField('educations', v)}
                        fields={[
                            { key: 'degree', placeholder: 'Degree' },
                            { key: 'institution', placeholder: 'Institution' },
                            { key: 'startYear', placeholder: 'Start year' },
                            { key: 'endYear', placeholder: 'End year' },
                        ]}
                        emptyItem={{ degree: '', institution: '', startYear: '', endYear: '', ongoing: false }}
                    />
                    <GroupListEditor
                        label={t('hr-manual-modal-section-certificates')}
                        items={profile.certificates}
                        onChange={(v) => setField('certificates', v)}
                        fields={[
                            { key: 'name', placeholder: 'Certificate name' },
                            { key: 'issuer', placeholder: 'Issuer' },
                            { key: 'year', placeholder: 'Year' },
                        ]}
                        emptyItem={{ name: '', issuer: '', year: '', url: null }}
                    />
                </div>
                <div className="mcm-review-cv">
                    <span className="mcm-field-label">{t('hr-manual-modal-review-cv-label')}</span>
                    <CvPreview file={item.file} t={t} />
                </div>
            </div>

            <div className="mcm-actions">
                <button type="button" className="mcm-btn mcm-btn--danger" onClick={onDiscard}>
                    {t('hr-manual-modal-discard')}
                </button>
                <button type="button" className="mcm-btn mcm-btn--primary" onClick={onConfirm}>
                    {t('hr-manual-modal-confirm-next')}
                </button>
            </div>
        </div>
    );
};

const ManualCandidatesModal = ({ isOpen, onClose, jobId, onCandidatesAdded }) => {
    const { t } = useLanguage();
    const [phase, setPhase] = useState('drop'); // 'drop' | 'parsing' | 'review' | 'submit' | 'result'
    const [queue, setQueue] = useState([]);
    const [dragOver, setDragOver] = useState(false);
    const [isParsingActive, setIsParsingActive] = useState(false);
    const [connectionIssue, setConnectionIssue] = useState(false);
    const [reviewIndex, setReviewIndex] = useState(0);
    const [submitResult, setSubmitResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);
    const activeRunRef = useRef(false);
    const runGenerationRef = useRef(0);
    // Synchronous (non-state) guard so the submit POST can only ever be
    // triggered once per submit phase. State (isSubmitting/submitResult)
    // updates are batched and not yet visible if the effect below somehow
    // ran twice in the same tick (e.g. StrictMode's dev-only double-invoke
    // of effects), so a plain ref is used instead of relying on state alone.
    const submitTriggeredRef = useRef(false);
    // Monotonic token, bumped by every submitConfirmed/retryFailedSubmissions
    // call (each captures its own value before firing its request) AND by
    // resetAndClose. submitConfirmed/retryFailedSubmissions compare the
    // *current* ref value against the token they captured right before each
    // state write after their await; if resetAndClose (or a newer submit/
    // retry call) has since bumped the ref, the token no longer matches and
    // the write is skipped. A single shared boolean can't do this: once
    // reset back to "not abandoned" for a newer call's benefit, it can no
    // longer distinguish "this specific stale request" from "nothing is
    // currently abandoned" (see the same pattern already used for
    // runGenerationRef/myRun in runParsingQueue above).
    const submitGenerationRef = useRef(0);
    // Staged CV ids with a POST /manual-candidates/confirm request currently
    // in flight (added right before the request fires, removed in a
    // finally once it settles - see submitConfirmed/retryFailedSubmissions).
    // resetAndClose's abandoned-CV cleanup consults this to avoid deleting a
    // staged CV out from under a request that's genuinely still in progress,
    // independent of whether that request belongs to the very first submit
    // or a later retry.
    const inFlightStagedIdsRef = useRef(new Set());

    const discardStaged = useCallback(async (stagedId) => {
        if (!stagedId) return;
        try {
            await apiFetch(`/manual-candidates/staged/${stagedId}`, { method: 'DELETE' });
        } catch (err) {
            console.error('Failed to discard staged CV:', err);
        }
    }, []);

    const resetAndClose = useCallback(() => {
        // Abandoned-CV cleanup: delete the staging doc (+ its on-disk CV
        // file) for every successfully-parsed item that never made it into
        // a confirmed candidate, so closing mid-review/mid-batch doesn't
        // leak PII (orphaned Mongo docs + files under static/uploads).
        //
        // decision 'pending' or 'discarded' items with a stagedId are safe
        // to clean up unconditionally: 'pending' was never submitted at
        // all, and 'discarded' already had its staged doc removed by
        // discardStaged at discard time (this call is then a harmless
        // no-op — the DELETE endpoint returns ok/already_removed for a
        // missing doc).
        //
        // decision 'confirmed' only means "queued for the batch submit" —
        // it does NOT mean POST /confirm has actually run for this item.
        // It's only skipped here when deleting could be wrong or racy:
        //   - already present in submitResult.created: the confirm POST
        //     already succeeded server-side, and this staged doc's
        //     file_path is now *the created candidate's* CV file. Deleting
        //     it would corrupt a real candidate record, so it must never be
        //     touched here.
        //   - present in inFlightStagedIdsRef: a confirm POST covering this
        //     staged_id (the initial submitConfirmed call OR a later
        //     retryFailedSubmissions retry — both populate this set
        //     identically) has been fired but hasn't settled yet. We can't
        //     know whether the server has already inserted the candidate/
        //     application and is about to mark this staged doc confirmed,
        //     so deleting now would race that in-flight request. Left
        //     alone — submitGenerationRef stops that request's eventual
        //     resolution from corrupting this component's UI state,
        //     independent of this.
        // Any other 'confirmed' item (e.g. closed while still in the review
        // phase, before the batch submit was ever triggered, or after a
        // retry request has already settled) never made it into (or is no
        // longer covered by) an in-flight/successful POST /confirm and is
        // genuinely abandoned.
        const confirmedStagedIds = new Set((submitResult?.created || []).map((c) => c.staged_id));
        queue.forEach((q) => {
            if (!q.stagedId) return;
            if (confirmedStagedIds.has(q.stagedId)) return;
            if (q.decision === 'confirmed' && inFlightStagedIdsRef.current.has(q.stagedId)) return;
            discardStaged(q.stagedId); // fire-and-forget, matches discardStaged's own error handling
        });

        setPhase('drop');
        setQueue([]);
        setSubmitResult(null);
        setIsSubmitting(false);
        // Allow a future submit phase (this modal instance is reused across
        // opens, not remounted) to fire submitConfirmed again.
        submitTriggeredRef.current = false;
        // Bump the submit generation token so ANY submitConfirmed/
        // retryFailedSubmissions call still in flight from before this
        // close — whether it's the very first submit or a later retry —
        // finds its captured token stale when it eventually resolves and
        // skips writing submitResult/phase state into this persisted
        // component instance. Unlike a shared "abandoned" boolean, this
        // can't be accidentally un-abandoned for one call's benefit while a
        // different, still-orphaned call is also in flight (see
        // submitGenerationRef's declaration above).
        submitGenerationRef.current += 1;
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
    }, [onClose, queue, submitResult, discardStaged]);

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

        const pending = items.filter((q) => q.status === 'queued' || q.status === 'failed');
        if (pending.length === 0) {
            activeRunRef.current = false;
            return;
        }

        // Capture this run's generation token. Only the run whose token
        // still matches runGenerationRef.current when it completes is
        // allowed to reset the shared activeRunRef/isParsingActive state in
        // the `finally` block below — this stops an orphaned run (e.g. one
        // left running in the background after Cancel) from clobbering a
        // newer, still-active run's state when it eventually resolves.
        // Captured after the empty-pending early return (so a no-op call
        // never advances the generation counter) but still before any
        // `await`, so no other invocation can interleave between the
        // activeRunRef guard above and this capture.
        const myRun = ++runGenerationRef.current;

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

    const submitConfirmed = useCallback(async () => {
        const confirmedItems = queue.filter((q) => q.decision === 'confirmed');
        if (confirmedItems.length === 0) return;

        // Capture this call's generation token before firing the request.
        // If resetAndClose (or a later submit/retry call) bumps
        // submitGenerationRef before this resolves, the comparisons below
        // will see a mismatch and skip writing stale state. See
        // submitGenerationRef's declaration above.
        const mySubmitGen = ++submitGenerationRef.current;
        const stagedIds = confirmedItems.map((q) => q.stagedId);
        // Mark these staged CVs as having a confirm request in flight so
        // resetAndClose's abandon-cleanup won't delete them out from under
        // this request while it's still running.
        stagedIds.forEach((id) => inFlightStagedIdsRef.current.add(id));

        setIsSubmitting(true);
        try {
            const res = await apiFetch('/manual-candidates/confirm', {
                method: 'POST',
                body: JSON.stringify({
                    job_id: jobId,
                    candidates: confirmedItems.map((q) => ({ staged_id: q.stagedId, profile: q.profile })),
                }),
            });
            // The modal may have been closed (X/overlay/Cancel -> resetAndClose)
            // while this request was in flight, or a later retry may have
            // already landed its own result. This component instance
            // persists across isOpen toggles, so without this check a stale
            // result from an abandoned/superseded call could clobber a
            // newer legitimate one (or land on a since-reopened modal
            // instead of the drop zone). See resetAndClose/submitGenerationRef.
            if (submitGenerationRef.current !== mySubmitGen) return;
            setSubmitResult(res);
            if (res.created.length > 0) {
                onCandidatesAdded();
            }
        } catch (err) {
            if (submitGenerationRef.current !== mySubmitGen) return;
            setSubmitResult({ created: [], failed: confirmedItems.map((q) => ({ staged_id: q.stagedId, error: err.message || 'Request failed' })) });
        } finally {
            stagedIds.forEach((id) => inFlightStagedIdsRef.current.delete(id));
            setIsSubmitting(false);
            if (submitGenerationRef.current === mySubmitGen) {
                setPhase('result');
            }
        }
    }, [queue, jobId, onCandidatesAdded]);

    // Fire the confirm POST exactly once when we enter the submit phase.
    // This must live in an effect, not the render body: this component
    // renders under <StrictMode>, which double-invokes render bodies in dev
    // specifically to catch impure renders like calling submitConfirmed()
    // directly there. The backend's staged-CV guard isn't atomic either, so
    // a duplicate POST here could create duplicate candidates/applications.
    // submitTriggeredRef (not just the isSubmitting/submitResult state
    // checks) is what actually closes this: React also double-invokes
    // effects in StrictMode dev mode (mount -> cleanup -> remount), and that
    // remount happens before the state update from the first invocation's
    // submitConfirmed() call has necessarily been reflected back into this
    // effect's closure, so state alone can't be trusted to block the second
    // run. The ref is set synchronously before submitConfirmed is called, so
    // the remounted effect sees it immediately and bails out.
    useEffect(() => {
        if (phase !== 'submit') return;
        if (submitTriggeredRef.current) return;
        if (isSubmitting || submitResult) return;
        submitTriggeredRef.current = true;
        submitConfirmed();
    }, [phase, isSubmitting, submitResult, submitConfirmed]);

    const retryFailedSubmissions = useCallback(async () => {
        if (!submitResult || submitResult.failed.length === 0) return;
        const failedIds = new Set(submitResult.failed.map((f) => f.staged_id));
        const itemsToRetry = queue.filter((q) => failedIds.has(q.stagedId));
        if (itemsToRetry.length === 0) return;

        // Same generation-token capture as submitConfirmed: this retry gets
        // its own token, so it can be told apart from both an abandoned
        // close and a subsequent retry/submit started after it.
        const mySubmitGen = ++submitGenerationRef.current;
        const stagedIds = itemsToRetry.map((q) => q.stagedId);
        // Same in-flight marking as submitConfirmed, so resetAndClose's
        // abandon-cleanup protects these staged CVs while this retry's
        // confirm request is running too.
        stagedIds.forEach((id) => inFlightStagedIdsRef.current.add(id));

        setIsSubmitting(true);
        try {
            const res = await apiFetch('/manual-candidates/confirm', {
                method: 'POST',
                body: JSON.stringify({
                    job_id: jobId,
                    candidates: itemsToRetry.map((q) => ({ staged_id: q.stagedId, profile: q.profile })),
                }),
            });
            // Same stale-write guard as submitConfirmed: if the modal was
            // closed while this retry was in flight (or a newer submit/
            // retry has since started), `prev` below could be the null
            // resetAndClose left behind, or this result could be older than
            // one that already landed. Skipping here avoids both the crash
            // and clobbering a newer result. See submitGenerationRef.
            if (submitGenerationRef.current !== mySubmitGen) return;
            setSubmitResult((prev) => ({
                created: [...prev.created, ...res.created],
                failed: res.failed,
            }));
            if (res.created.length > 0) {
                onCandidatesAdded();
            }
        } catch (err) {
            console.error('Retry submission failed:', err);
        } finally {
            stagedIds.forEach((id) => inFlightStagedIdsRef.current.delete(id));
            setIsSubmitting(false);
        }
    }, [submitResult, queue, jobId, onCandidatesAdded]);

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

                    {phase === 'review' && (() => {
                        const reviewable = queue.filter((q) => q.status === 'parsed' && q.decision === 'pending');
                        const confirmedCount = queue.filter((q) => q.decision === 'confirmed').length;
                        if (reviewable.length === 0) {
                            return (
                                <>
                                    <p className="mcm-empty">{t('hr-manual-modal-no-candidates')}</p>
                                    <div className="mcm-actions">
                                        <button type="button" className="mcm-btn mcm-btn--secondary" onClick={resetAndClose}>
                                            {t('hr-manual-modal-cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            className="mcm-btn mcm-btn--primary"
                                            disabled={confirmedCount === 0}
                                            onClick={() => setPhase('submit')}
                                        >
                                            {t('hr-manual-modal-submit').replace('{count}', confirmedCount)}
                                        </button>
                                    </div>
                                </>
                            );
                        }
                        const safeIndex = Math.min(reviewIndex, reviewable.length - 1);
                        const current = reviewable[safeIndex];

                        return (
                            <CandidateReviewPanel
                                item={current}
                                index={safeIndex}
                                total={reviewable.length}
                                t={t}
                                onChange={(profile) => patchQueueItem(current.localId, { profile })}
                                onDiscard={() => {
                                    discardStaged(current.stagedId);
                                    patchQueueItem(current.localId, { decision: 'discarded' });
                                    setReviewIndex(0);
                                }}
                                onConfirm={() => {
                                    patchQueueItem(current.localId, { decision: 'confirmed' });
                                    setReviewIndex(0);
                                }}
                            />
                        );
                    })()}

                    {phase === 'submit' && (() => {
                        // Purely presentational: the actual POST is triggered by the
                        // useEffect above when phase becomes 'submit', not here.
                        const confirmedCount = queue.filter((q) => q.decision === 'confirmed').length;
                        return (
                            <div className="mcm-submitting">
                                <span className="material-symbols-outlined mcm-spin">progress_activity</span>
                                <p>{t('hr-manual-modal-submitting').replace('{count}', confirmedCount)}</p>
                            </div>
                        );
                    })()}

                    {phase === 'result' && submitResult && (
                        <>
                            <div className="mcm-result">
                                <h3>{t('hr-manual-modal-result-title')}</h3>
                                <p className="mcm-result-created">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    {t('hr-manual-modal-result-created').replace('{count}', submitResult.created.length)}
                                </p>
                                {submitResult.failed.length > 0 && (
                                    <>
                                        <p className="mcm-result-failed">
                                            <span className="material-symbols-outlined">error</span>
                                            {t('hr-manual-modal-result-failed').replace('{count}', submitResult.failed.length)}
                                        </p>
                                        <ul className="mcm-result-failed-list">
                                            {submitResult.failed.map((f) => (
                                                <li key={f.staged_id}>{f.error}</li>
                                            ))}
                                        </ul>
                                        <button
                                            type="button"
                                            className="mcm-btn mcm-btn--secondary"
                                            disabled={isSubmitting}
                                            onClick={retryFailedSubmissions}
                                        >
                                            {t('hr-manual-modal-retry')}
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="mcm-actions">
                                <button type="button" className="mcm-btn mcm-btn--primary" onClick={resetAndClose}>
                                    {t('hr-manual-modal-close')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManualCandidatesModal;
