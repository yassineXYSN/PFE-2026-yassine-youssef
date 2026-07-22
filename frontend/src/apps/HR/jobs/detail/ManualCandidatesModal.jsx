import React, { useRef, useState } from 'react';
import mammoth from 'mammoth';
import { useLanguage } from '../../../../core/useLanguage';
import { useManualCandidates } from '../../context/ManualCandidatesContext';
import './ManualCandidatesModal.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TextField = ({ label, value, onChange, type = 'text', required = false, error = null }) => (
    <label className="mcm-field">
        <span className="mcm-field-label">{label}{required ? ' *' : ''}</span>
        <input
            type={type}
            className={`mcm-field-input${error ? ' mcm-field-input--error' : ''}`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        />
        {error && <span className="mcm-field-error">{error}</span>}
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
    const [docxHtml, setDocxHtml] = useState(null);
    const [docxLoading, setDocxLoading] = useState(false);
    const name = (file?.name || '').toLowerCase();
    const isPdf = name.endsWith('.pdf');
    const isDocx = name.endsWith('.docx');

    React.useEffect(() => {
        if (!file) {
            setPreviewUrl(null);
            return undefined;
        }
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    React.useEffect(() => {
        setDocxHtml(null);
        if (!file || !isDocx) return undefined;

        let cancelled = false;
        setDocxLoading(true);
        file.arrayBuffer()
            .then((buffer) => mammoth.convertToHtml({ arrayBuffer: buffer }))
            .then((result) => { if (!cancelled) setDocxHtml(result.value); })
            .catch(() => { if (!cancelled) setDocxHtml(null); })
            .finally(() => { if (!cancelled) setDocxLoading(false); });

        return () => { cancelled = true; };
    }, [file, isDocx]);

    if (isPdf && previewUrl) {
        return <iframe src={`${previewUrl}#toolbar=0`} className="mcm-cv-iframe" title={file.name} />;
    }

    if (isDocx && docxLoading) {
        return (
            <div className="mcm-cv-loading">
                <span className="material-symbols-outlined mcm-spin">progress_activity</span>
            </div>
        );
    }

    if (isDocx && docxHtml) {
        return <div className="mcm-docx-preview" dangerouslySetInnerHTML={{ __html: docxHtml }} />;
    }

    return (
        <div className="mcm-cv-fallback">
            <span className="material-symbols-outlined">description</span>
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
    const emailValid = EMAIL_RE.test((profile.email || '').trim());

    return (
        <div className="mcm-review-panel">
            <p className="mcm-review-counter">
                {t('hr-manual-modal-review-title').replace('{current}', index + 1).replace('{total}', total)}
            </p>
            <div className="mcm-review-grid">
                <div className="mcm-review-form">
                    <div className="mcm-review-section">
                        <p className="mcm-review-section-title">{t('hr-manual-modal-section-personal-info')}</p>
                        <div className="mcm-field-row">
                            <TextField label={t('hr-manual-modal-field-first-name')} value={profile.firstName} onChange={(v) => setField('firstName', v)} />
                            <TextField label={t('hr-manual-modal-field-last-name')} value={profile.lastName} onChange={(v) => setField('lastName', v)} />
                        </div>
                        <div className="mcm-field-row">
                            <TextField
                                label={t('hr-manual-modal-field-email')}
                                value={profile.email}
                                onChange={(v) => setField('email', v)}
                                type="email"
                                required
                                error={!emailValid ? t('hr-manual-modal-field-email-required') : null}
                            />
                            <TextField label={t('hr-manual-modal-field-phone')} value={profile.phone} onChange={(v) => setField('phone', v)} />
                        </div>
                        <TextField label={t('hr-manual-modal-field-title')} value={profile.title} onChange={(v) => setField('title', v)} />
                        <div className="mcm-field-row">
                            <TextField label={t('hr-manual-modal-field-birth-date')} value={profile.birthDate} onChange={(v) => setField('birthDate', v)} type="date" />
                            <TextField label={t('hr-manual-modal-field-linkedin')} value={profile.linkedinUrl} onChange={(v) => setField('linkedinUrl', v)} />
                        </div>
                        <TextField label={t('hr-manual-modal-field-address')} value={profile.address} onChange={(v) => setField('address', v)} />
                    </div>

                    <div className="mcm-review-section">
                        <SkillLikeListEditor label={t('hr-manual-modal-section-skills')} items={profile.skills} onChange={(v) => setField('skills', v)} />
                        <SkillLikeListEditor label={t('hr-manual-modal-section-languages')} items={profile.languages} onChange={(v) => setField('languages', v)} />
                    </div>

                    <div className="mcm-review-section">
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
                    </div>
                    <div className="mcm-review-section">
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
                    </div>
                    <div className="mcm-review-section">
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
                </div>
                <div className="mcm-review-cv">
                    <div className="mcm-review-cv-header">
                        <span className="mcm-field-label">{t('hr-manual-modal-review-cv-label')}</span>
                        <span className="mcm-cv-filename" title={item.file?.name}>{item.file?.name}</span>
                    </div>
                    <div className="mcm-cv-preview-area">
                        <CvPreview file={item.file} t={t} />
                    </div>
                </div>
            </div>

            <div className="mcm-actions">
                <button type="button" className="mcm-btn mcm-btn--danger" onClick={onDiscard}>
                    {t('hr-manual-modal-discard')}
                </button>
                <button type="button" className="mcm-btn mcm-btn--primary" onClick={onConfirm} disabled={!emailValid}>
                    {t('hr-manual-modal-confirm-next')}
                </button>
            </div>
        </div>
    );
};

// Presentational shell for whichever batch is currently focused. All batch
// state (queue, phase, parsing/submit progress) lives in
// ManualCandidatesContext, keyed by jobId, so it survives this component
// being hidden (minimized) or the user navigating to a different page -
// only cancelBatch ever discards it. This component itself is mounted once
// globally (see App.jsx), not per job-detail page.
const ManualCandidatesModal = () => {
    const { t } = useLanguage();
    const {
        batches, focusedJobId, minimizeFocused, cancelBatch, patchBatch, patchQueueItem,
        handleFilesSelected, removeQueuedFile, startParsing, runParsingQueue,
        discardReviewItem, confirmReviewItem, submitConfirmed, retryFailedSubmissions,
    } = useManualCandidates();
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const jobId = focusedJobId;
    const batch = jobId ? batches[jobId] : null;

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (jobId) handleFilesSelected(jobId, e.dataTransfer.files);
    };

    if (!jobId || !batch) return null;

    const { phase, queue, isParsingActive, connectionIssue, reviewIndex, submitResult, isSubmitting } = batch;

    return (
        <div className="mcm-overlay" onClick={minimizeFocused}>
            <div className="mcm-card" onClick={(e) => e.stopPropagation()}>
                <header className="mcm-header">
                    <h2>{t('hr-manual-modal-title')}</h2>
                    <button type="button" className="mcm-close" onClick={minimizeFocused}>
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
                                    onChange={(e) => handleFilesSelected(jobId, e.target.files)}
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
                                                onClick={() => removeQueuedFile(jobId, q.localId)}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mcm-actions">
                                <button type="button" className="mcm-btn mcm-btn--secondary" onClick={() => cancelBatch(jobId)}>
                                    {t('hr-manual-modal-cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="mcm-btn mcm-btn--primary"
                                    disabled={queue.length === 0}
                                    onClick={() => startParsing(jobId)}
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
                                            onClick={() => runParsingQueue(jobId, queue)}
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
                                                    onClick={() => runParsingQueue(jobId, [q])}
                                                >
                                                    <span className="material-symbols-outlined">refresh</span>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="mcm-actions">
                                    <button type="button" className="mcm-btn mcm-btn--secondary" onClick={() => cancelBatch(jobId)}>
                                        {t('hr-manual-modal-cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        className="mcm-btn mcm-btn--primary"
                                        disabled={isParsingActive || parsedCount === 0}
                                        onClick={() => patchBatch(jobId, { phase: 'review' })}
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
                                        <button type="button" className="mcm-btn mcm-btn--secondary" onClick={() => cancelBatch(jobId)}>
                                            {t('hr-manual-modal-cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            className="mcm-btn mcm-btn--primary"
                                            disabled={confirmedCount === 0}
                                            onClick={() => submitConfirmed(jobId)}
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
                                onChange={(profile) => patchQueueItem(jobId, current.localId, { profile })}
                                onDiscard={() => discardReviewItem(jobId, current)}
                                onConfirm={() => confirmReviewItem(jobId, current)}
                            />
                        );
                    })()}

                    {phase === 'submit' && (() => {
                        // Purely presentational: the actual POST is fired by
                        // submitConfirmed at the point the review phase's
                        // Submit button transitions here, not by this block.
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
                                {submitResult.invited.length > 0 && (
                                    <p className="mcm-result-created">
                                        <span className="material-symbols-outlined">mail</span>
                                        {t('hr-manual-modal-result-invited').replace('{count}', submitResult.invited.length)}
                                    </p>
                                )}
                                {submitResult.linked.length > 0 && (
                                    <p className="mcm-result-linked">
                                        <span className="material-symbols-outlined">link</span>
                                        {t('hr-manual-modal-result-linked').replace('{count}', submitResult.linked.length)}
                                    </p>
                                )}
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
                                            onClick={() => retryFailedSubmissions(jobId)}
                                        >
                                            {t('hr-manual-modal-retry')}
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="mcm-actions">
                                <button type="button" className="mcm-btn mcm-btn--primary" onClick={() => cancelBatch(jobId)}>
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
