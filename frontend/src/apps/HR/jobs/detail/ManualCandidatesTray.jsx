import React, { useState } from 'react';
import { useLanguage } from '../../../../core/useLanguage';
import { useManualCandidates } from '../../context/ManualCandidatesContext';
import './ManualCandidatesTray.css';

// Derives what the pill should show from the batch's actual data rather
// than raw phase name alone: the 'parsing' phase in particular can sit
// fully settled (every file parsed or failed) for a long time once the
// user has minimized the modal and walked away, since advancing to
// 'review' is a deliberate button click inside the modal, not automatic.
// Without this the pill would keep showing a spinning "Analyzing…" state
// forever even though there's nothing left in flight.
const getBatchDisplay = (batch, t) => {
    switch (batch.phase) {
        case 'drop':
            return {
                icon: 'cloud_upload',
                spin: false,
                label: t('hr-manual-tray-status-drop', { count: batch.queue.length }),
            };
        case 'parsing': {
            const total = batch.queue.length;
            const settled = batch.queue.filter((q) => q.status === 'parsed' || q.status === 'failed').length;
            if (!batch.isParsingActive && total > 0 && settled >= total) {
                const parsedCount = batch.queue.filter((q) => q.status === 'parsed').length;
                return {
                    icon: 'rate_review',
                    spin: false,
                    label: t('hr-manual-tray-status-ready-review', { count: parsedCount }),
                };
            }
            if (!batch.isParsingActive && batch.connectionIssue) {
                return {
                    icon: 'wifi_off',
                    spin: false,
                    label: t('hr-manual-tray-status-connection-issue'),
                };
            }
            return {
                icon: 'progress_activity',
                spin: true,
                label: t('hr-manual-tray-status-parsing', { done: settled, total }),
            };
        }
        case 'review': {
            const confirmed = batch.queue.filter((q) => q.decision === 'confirmed').length;
            return {
                icon: 'rate_review',
                spin: false,
                label: t('hr-manual-tray-status-review', { count: confirmed }),
            };
        }
        case 'submit':
            return {
                icon: 'progress_activity',
                spin: true,
                label: t('hr-manual-tray-status-submit'),
            };
        case 'result': {
            const failed = batch.submitResult?.failed?.length || 0;
            return {
                icon: failed > 0 ? 'error' : 'check_circle',
                spin: false,
                label: t('hr-manual-tray-status-result', {
                    created: (batch.submitResult?.invited?.length || 0) + (batch.submitResult?.linked?.length || 0),
                    failed,
                }),
            };
        }
        default:
            return { icon: 'upload_file', spin: false, label: '' };
    }
};

// Floating widget listing every batch currently running/paused in
// ManualCandidatesContext, so a batch minimized on one job's page stays
// reachable while the user browses anywhere else in the app.
const ManualCandidatesTray = () => {
    const { t } = useLanguage();
    const { batches, focusedJobId, focusBatch, cancelBatch } = useManualCandidates();
    const entries = Object.entries(batches);
    // Cancelling a batch discards its progress and any staged CVs, so the
    // pill's X only stages a request here - the actual cancelBatch call
    // only fires once the user confirms in the dialog below.
    const [confirmJobId, setConfirmJobId] = useState(null);

    if (entries.length === 0) return null;

    const confirmBatch = confirmJobId ? batches[confirmJobId] : null;

    return (
        <>
            <div className="mct-tray">
                {entries.map(([jobId, batch]) => {
                    const display = getBatchDisplay(batch, t);
                    return (
                    <div
                        key={jobId}
                        role="button"
                        tabIndex={0}
                        className={`mct-pill${jobId === focusedJobId ? ' mct-pill--focused' : ''}`}
                        onClick={() => focusBatch(jobId)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusBatch(jobId); } }}
                    >
                        <span className={`material-symbols-outlined mct-pill-icon${display.spin ? ' mct-spin' : ''}`}>
                            {display.icon}
                        </span>
                        <span className="mct-pill-body">
                            <strong className="mct-pill-title">{batch.jobTitle}</strong>
                            <span className="mct-pill-status">{display.label}</span>
                        </span>
                        <button
                            type="button"
                            className="mct-pill-close"
                            aria-label={t('hr-manual-modal-cancel')}
                            onClick={(e) => { e.stopPropagation(); setConfirmJobId(jobId); }}
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    );
                })}
            </div>

            {confirmBatch && (
                <div className="mct-confirm-overlay" onClick={() => setConfirmJobId(null)}>
                    <div className="mct-confirm-card" onClick={(e) => e.stopPropagation()}>
                        <h3>{t('hr-manual-tray-confirm-title')}</h3>
                        <p>{t('hr-manual-tray-confirm-body', { job: confirmBatch.jobTitle })}</p>
                        <div className="mct-confirm-actions">
                            <button type="button" className="mct-confirm-btn mct-confirm-btn--secondary" onClick={() => setConfirmJobId(null)}>
                                {t('hr-manual-tray-confirm-keep')}
                            </button>
                            <button
                                type="button"
                                className="mct-confirm-btn mct-confirm-btn--danger"
                                onClick={() => { cancelBatch(confirmJobId); setConfirmJobId(null); }}
                            >
                                {t('hr-manual-tray-confirm-cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ManualCandidatesTray;
