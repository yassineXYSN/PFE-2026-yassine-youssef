import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../../../core/useLanguage';
import HRSidebar from '../../components/HRSidebar';
import { apiFetch, SERVER_URL } from '../../../../core/api';
import { normalizeApplicationStatus } from '../../../../core/applicationPipeline';
import JobDetailCompanyMap from './JobDetailCompanyMap';
import { useManualCandidates } from '../../context/ManualCandidatesContext';
import './JobDetail.css';

const STAGE_CONFIG = {
    new: { labelKey: 'hr-job-detail-stage-new' },
    in_review: { labelKey: 'hr-job-detail-stage-in-review' },
    technical_test: { labelKey: 'hr-job-detail-stage-quiz' },
    interview: { labelKey: 'hr-job-detail-stage-interview' },
    accepted: { labelKey: 'hr-job-detail-stage-hired' },
    rejected: { labelKey: 'hr-job-detail-stage-rejected' },
};

const getStageConfig = (stage) => STAGE_CONFIG[stage] || STAGE_CONFIG.new;

const tabToPipelineStage = (tab) => {
    if (tab === 'all') return null;
    if (tab === 'hired') return 'accepted';
    return tab;
};

const calcAge = (birthDate) => {
    if (!birthDate) return null;
    const date = new Date(birthDate);
    if (Number.isNaN(date.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - date.getFullYear();
    const m = now.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age -= 1;
    return age;
};

const formatAppliedAt = (app) => {
    const raw = app.applied_at ?? app.created_at ?? app.createdAt;
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getAppliedTimestamp = (app) => {
    const raw = app.applied_at ?? app.created_at ?? app.createdAt;
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
};

const STAGE_SORT_ORDER = {
    new: 0,
    in_review: 1,
    technical_test: 2,
    interview: 3,
    accepted: 4,
    rejected: 5,
};

const CANDIDATE_SORT_OPTIONS = [
    { id: 'applied_desc', labelKey: 'hr-job-detail-sort-date-desc' },
    { id: 'applied_asc', labelKey: 'hr-job-detail-sort-date-asc' },
    { id: 'name_asc', labelKey: 'hr-job-detail-sort-name-asc' },
    { id: 'name_desc', labelKey: 'hr-job-detail-sort-name-desc' },
    { id: 'score_desc', labelKey: 'hr-job-detail-sort-score-desc' },
    { id: 'score_asc', labelKey: 'hr-job-detail-sort-score-asc' },
    { id: 'stage', labelKey: 'hr-job-detail-sort-stage' },
];

const truncateEmail = (email, max = 34) => {
    if (!email) return '—';
    if (email.length <= max) return email;
    return `${email.slice(0, max)}…`;
};

/** Adresse siège enregistrée (profil entreprise) pour affichage sur la fiche offre. */
const formatRegisteredCompanyLocation = (c) => {
    if (!c || typeof c !== 'object') return '';
    const zip = c.zip_code ?? c.zipCode;
    const cityLine = [zip, c.city].filter(Boolean).join(' ').trim();
    const parts = [c.address, cityLine || null, c.country].filter(Boolean);
    return parts.join(' · ');
};

const TABLE_PAGE_SIZE = 4;

const AutomationReport = ({
    job, summary, deadlineProcessed, quizStageProcessed,
    quizStageEnabled, funnelSteps, deadlineDisplay,
}) => {
    const { t } = useLanguage();
    const fmtDate = (val) => {
        if (!val) return null;
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return null;
        return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const overallStatus = !deadlineProcessed
        ? 'pending'
        : quizStageEnabled && !quizStageProcessed
            ? 'quiz'
            : 'done';

    const STATUS_LABELS = {
        pending: t('hr-job-detail-air-status-pending'),
        quiz: t('hr-job-detail-air-status-quiz'),
        done: t('hr-job-detail-air-status-done'),
    };
    const STATUS_ICONS = { pending: 'hourglass_top', quiz: 'pending', done: 'task_alt' };

    const promotedCount = summary.promoted_to_interview?.length ?? 0;

    return (
        <div className="air-panel">
            {/* ── Header ── */}
            <div className="air-header">
                <div className="air-header-glow" aria-hidden />
                <div className="air-header-content">
                    <div className="air-header-left">
                        <div className="air-header-icon-wrap">
                            <span className="material-symbols-outlined">auto_awesome</span>
                        </div>
                        <div>
                            <h3 className="air-header-title">{t('hr-job-detail-air-title')}</h3>
                            <p className="air-header-sub">
                                {deadlineProcessed
                                    ? t('hr-job-detail-air-executed', { date: fmtDate(job?.deadline_processed_at) || '—' })
                                    : t('hr-job-detail-air-trigger', { deadline: deadlineDisplay })}
                            </p>
                        </div>
                    </div>
                    <span className={`air-status-pill air-status-pill--${overallStatus}`}>
                        <span className="material-symbols-outlined">{STATUS_ICONS[overallStatus]}</span>
                        {STATUS_LABELS[overallStatus]}
                    </span>
                </div>
            </div>

            {/* ── KPI row ── */}
            <div className="air-kpi-row">
                {funnelSteps.map((step) => (
                    <div key={step.key} className={`air-kpi ${step.done ? 'air-kpi--done' : step.active ? 'air-kpi--active' : 'air-kpi--pending'}`}>
                        <span className="material-symbols-outlined air-kpi-icon">{step.icon}</span>
                        <span className="air-kpi-count">
                            {step.count !== null && step.count !== undefined ? step.count : '—'}
                        </span>
                        <span className="air-kpi-label">{step.label}</span>
                        {step.config && <code className="air-kpi-cfg">{step.config}</code>}
                    </div>
                ))}
            </div>

            {/* ── Funnel bar ── */}
            {deadlineProcessed && funnelSteps.length > 0 && (() => {
                const maxCount = funnelSteps[0]?.count || 1;
                return (
                    <div className="air-funnel-bar">
                        <p className="air-funnel-bar-label">{t('hr-job-detail-air-funnel-label')}</p>
                        <div className="air-funnel-bars">
                            {funnelSteps.filter(s => s.count !== null && s.count !== undefined).map((step) => {
                                const pct = maxCount > 0 ? Math.round((step.count / maxCount) * 100) : 0;
                                return (
                                    <div key={step.key} className="air-funnel-bar-item">
                                        <div className="air-funnel-bar-track">
                                            <div
                                                className={`air-funnel-bar-fill air-funnel-bar-fill--${step.key}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <div className="air-funnel-bar-meta">
                                            <span>{step.label}</span>
                                            <strong>{step.count}</strong>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* ── Phase timeline (quiz stage only) ── */}
            {quizStageEnabled && (
                <div className="air-phases">
                    <p className="air-phases-label">{t('hr-job-detail-air-phases-label')}</p>
                    <div className={`air-phase ${deadlineProcessed ? 'air-phase--done' : 'air-phase--pending'}`}>
                        <div className="air-phase-dot-wrap">
                            <div className="air-phase-dot" />
                            <div className="air-phase-connector" />
                        </div>
                        <div className="air-phase-body">
                            <strong>{t('hr-job-detail-air-phase1')}</strong>
                            <span>{fmtDate(job?.deadline_processed_at) || '—'}</span>
                        </div>
                    </div>
                    <div className={`air-phase ${quizStageProcessed ? 'air-phase--done' : deadlineProcessed ? 'air-phase--active' : 'air-phase--pending'}`}>
                        <div className="air-phase-dot-wrap">
                            <div className="air-phase-dot" />
                        </div>
                        <div className="air-phase-body">
                            <strong>{t('hr-job-detail-air-phase2')}</strong>
                            <span>{fmtDate(job?.quiz_stage_processed_at) || (deadlineProcessed ? t('hr-job-detail-air-quiz-waiting') : '—')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Footer: promoted / waiting ── */}
            {deadlineProcessed && promotedCount > 0 && (
                <div className="air-footer air-footer--success">
                    <span className="material-symbols-outlined">how_to_reg</span>
                    <p>{t('hr-job-detail-air-promoted', { count: promotedCount })}</p>
                </div>
            )}
            {deadlineProcessed && promotedCount === 0 && !quizStageEnabled && (
                <div className="air-footer air-footer--info">
                    <span className="material-symbols-outlined">info</span>
                    <p>{t('hr-job-detail-air-no-promoted')}</p>
                </div>
            )}
            {!deadlineProcessed && (
                <div className="air-footer air-footer--waiting">
                    <span className="material-symbols-outlined">schedule</span>
                    <p>{t('hr-job-detail-air-waiting')}</p>
                </div>
            )}
        </div>
    );
};

const JobDetail = () => {
    const { effectiveTheme } = useTheme();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { id } = useParams();

    const [job, setJob] = useState(null);
    const [department, setDepartment] = useState(null);
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [applications, setApplications] = useState([]);
    const [appLoading, setAppLoading] = useState(false);
    const [aiApplicantLoading, setAiApplicantLoading] = useState(false);

    const [suggestions, setSuggestions] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);

    const [activeTab, setActiveTab] = useState('all');
    const [search, setSearch] = useState('');

    const [leftSlideIdx, setLeftSlideIdx] = useState(0);
    const [candidatesPage, setCandidatesPage] = useState(1);
    const [embedPage, setEmbedPage] = useState(1);
    const [candidateSort, setCandidateSort] = useState('applied_desc');
    const [sortMenuOpen, setSortMenuOpen] = useState(false);
    const sortWrapRef = useRef(null);
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const statusWrapRef = useRef(null);
    const { batches: manualCandidateBatches, openBatch: openManualCandidatesBatch } = useManualCandidates();

    const goLeftSlide = useCallback((index) => {
        setLeftSlideIdx(index);
    }, []);

    useEffect(() => {
        const fetchJobData = async () => {
            if (!id) return;
            try {
                const jobData = await apiFetch(`/jobs/${id}`);
                setJob(jobData);
                if (jobData.department_id) {
                    const deptData = await apiFetch(`/departments/${jobData.department_id}`);
                    setDepartment(deptData);
                } else {
                    setDepartment(null);
                }
                if (jobData.company_id) {
                    try {
                        const companyData = await apiFetch(`/companies/${jobData.company_id}`);
                        setCompany(companyData);
                    } catch (e) {
                        console.error('Error fetching company for job detail:', e);
                        setCompany(null);
                    }
                } else {
                    setCompany(null);
                }
            } catch (err) {
                console.error('Error fetching job details:', err);
                setError("Offre d'emploi introuvable.");
            } finally {
                setLoading(false);
            }
        };
        fetchJobData();
    }, [id]);

    const loadApplications = useCallback(async () => {
        if (!id) return;
        setAppLoading(true);
        try {
            const data = await apiFetch(`/applications/job/${id}`);
            setApplications(data || []);
        } catch (e) {
            console.error('Applications load error:', e);
        } finally {
            setAppLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadApplications();
    }, [loadApplications]);

    // The manual-candidates batch for this job can keep running/finish in
    // the background while the user is elsewhere (see
    // ManualCandidatesContext) - if the user is on (or returns to) this
    // page while it creates candidates, refresh the list. Guarded by a
    // ref (not just re-running on mount) so this only fires on an actual
    // increase, not on every render.
    const manualCandidatesCreatedRef = useRef(manualCandidateBatches[id]?.createdCount ?? 0);
    useEffect(() => {
        const count = manualCandidateBatches[id]?.createdCount ?? 0;
        if (count > manualCandidatesCreatedRef.current) {
            manualCandidatesCreatedRef.current = count;
            loadApplications();
        }
    }, [manualCandidateBatches, id, loadApplications]);

    useEffect(() => {
        if (!id || !job) return;
        const loadSuggestions = async () => {
            setAiLoading(true);
            try {
                const data = await apiFetch(`/ai-matching/suggestions/${id}?limit=100`);
                setSuggestions(data || []);
            } catch (e) {
                console.error('Suggestions error:', e);
            } finally {
                setAiLoading(false);
            }
        };
        loadSuggestions();
    }, [id, job]);

    const loadApplicantScores = async () => {
        if (!id) return;
        setAiApplicantLoading(true);
        try {
            const data = await apiFetch(`/ai-matching/applicant-scores/${id}?limit=10`);
            if (data && data.length > 0) {
                setApplications((prevApps) => {
                    const newApps = [...prevApps];
                    data.forEach((scoredApp) => {
                        const idx = newApps.findIndex((a) => a._id === scoredApp.application_id);
                        if (idx !== -1) {
                            newApps[idx] = {
                                ...newApps[idx],
                                ai_score: scoredApp.ai_score,
                                ai_justification: scoredApp.ai_justification,
                            };
                        }
                    });
                    newApps.sort((a, b) => (b.ai_score ?? -1) - (a.ai_score ?? -1));
                    return newApps;
                });
            }
        } catch (e) {
            console.error('Applicant scores error:', e);
        } finally {
            setAiApplicantLoading(false);
        }
    };

    const tabCounts = useMemo(() => {
        const counts = {
            all: applications.length,
            new: 0,
            in_review: 0,
            technical_test: 0,
            interview: 0,
            hired: 0,
        };
        applications.forEach((a) => {
            const stage = normalizeApplicationStatus(a.status);
            if (stage === 'new') counts.new += 1;
            else if (stage === 'in_review') counts.in_review += 1;
            else if (stage === 'technical_test') counts.technical_test += 1;
            else if (stage === 'interview') counts.interview += 1;
            else if (stage === 'accepted') counts.hired += 1;
        });
        return counts;
    }, [applications]);

    const displayedApplications = useMemo(() => {
        const targetStage = tabToPipelineStage(activeTab);
        const filtered = applications.filter((app) => {
            const fullName = `${app.firstName || ''} ${app.lastName || ''}`.toLowerCase();
            const title = (app.headline || '').toLowerCase();
            const email = (app.email || '').toLowerCase();
            const q = search.toLowerCase().trim();
            const matchesSearch = !q || fullName.includes(q) || title.includes(q) || email.includes(q);
            const stage = normalizeApplicationStatus(app.status);
            const matchesTab = !targetStage || stage === targetStage;
            return matchesSearch && matchesTab;
        });

        const fullNameKey = (app) => `${app.firstName || ''} ${app.lastName || ''}`.trim().toLowerCase();
        const scoreVal = (app) => (app.ai_score == null ? null : Number(app.ai_score));

        const sorted = [...filtered];
        switch (candidateSort) {
            case 'applied_asc':
                sorted.sort((a, b) => getAppliedTimestamp(a) - getAppliedTimestamp(b));
                break;
            case 'applied_desc':
                sorted.sort((a, b) => getAppliedTimestamp(b) - getAppliedTimestamp(a));
                break;
            case 'name_asc':
                sorted.sort((a, b) => fullNameKey(a).localeCompare(fullNameKey(b), 'fr'));
                break;
            case 'name_desc':
                sorted.sort((a, b) => fullNameKey(b).localeCompare(fullNameKey(a), 'fr'));
                break;
            case 'score_desc':
                sorted.sort((a, b) => {
                    const sa = scoreVal(a);
                    const sb = scoreVal(b);
                    if (sa == null && sb == null) return 0;
                    if (sa == null) return 1;
                    if (sb == null) return -1;
                    return sb - sa;
                });
                break;
            case 'score_asc':
                sorted.sort((a, b) => {
                    const sa = scoreVal(a);
                    const sb = scoreVal(b);
                    if (sa == null && sb == null) return 0;
                    if (sa == null) return 1;
                    if (sb == null) return -1;
                    return sa - sb;
                });
                break;
            case 'stage':
                sorted.sort((a, b) => {
                    const sa = normalizeApplicationStatus(a.status);
                    const sb = normalizeApplicationStatus(b.status);
                    const oa = STAGE_SORT_ORDER[sa] ?? 99;
                    const ob = STAGE_SORT_ORDER[sb] ?? 99;
                    if (oa !== ob) return oa - ob;
                    return getAppliedTimestamp(b) - getAppliedTimestamp(a);
                });
                break;
            default:
                break;
        }
        return sorted;
    }, [applications, activeTab, search, candidateSort]);

    useEffect(() => {
        if (!sortMenuOpen) return undefined;
        const onPointerDown = (e) => {
            if (sortWrapRef.current && !sortWrapRef.current.contains(e.target)) {
                setSortMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [sortMenuOpen]);

    useEffect(() => {
        if (!statusMenuOpen) return undefined;
        const onPointerDown = (e) => {
            if (statusWrapRef.current && !statusWrapRef.current.contains(e.target)) {
                setStatusMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [statusMenuOpen]);

    const updateJobStatus = async (nextStatus) => {
        if (!id) return;
        try {
            const updated = await apiFetch(`/jobs/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: nextStatus }),
            });
            setJob((prev) => (prev ? { ...prev, ...updated, status: updated?.status || nextStatus } : prev));
        } catch (e) {
            console.error('Error updating job status:', e);
        } finally {
            setStatusMenuOpen(false);
        }
    };

    useEffect(() => {
        setCandidatesPage(1);
    }, [activeTab, search, candidateSort]);

    useEffect(() => {
        const n = displayedApplications.length;
        if (n === 0) return;
        const total = Math.ceil(n / TABLE_PAGE_SIZE);
        setCandidatesPage((p) => Math.min(p, total));
    }, [displayedApplications.length]);

    useEffect(() => {
        setEmbedPage(1);
    }, [id]);

    useEffect(() => {
        const n = suggestions.length;
        if (n === 0) return;
        const total = Math.ceil(n / TABLE_PAGE_SIZE);
        setEmbedPage((p) => Math.min(p, total));
    }, [suggestions.length]);

    const candidatesTotalPages = displayedApplications.length === 0 ? 0 : Math.ceil(displayedApplications.length / TABLE_PAGE_SIZE);
    const candidatesPageSafe = candidatesTotalPages === 0 ? 1 : Math.min(Math.max(1, candidatesPage), candidatesTotalPages);
    const paginatedApplications = useMemo(
        () => displayedApplications.slice((candidatesPageSafe - 1) * TABLE_PAGE_SIZE, candidatesPageSafe * TABLE_PAGE_SIZE),
        [displayedApplications, candidatesPageSafe],
    );

    const embedTotalPages = suggestions.length === 0 ? 0 : Math.ceil(suggestions.length / TABLE_PAGE_SIZE);
    const embedPageSafe = embedTotalPages === 0 ? 1 : Math.min(Math.max(1, embedPage), embedTotalPages);
    const paginatedSuggestions = useMemo(
        () => suggestions.slice((embedPageSafe - 1) * TABLE_PAGE_SIZE, embedPageSafe * TABLE_PAGE_SIZE),
        [suggestions, embedPageSafe],
    );

    const requirementList = useMemo(() => job?.requirements || [], [job]);

    const registeredCompanyLocation = useMemo(
        () => (company ? formatRegisteredCompanyLocation(company) : ''),
        [company],
    );

    const companyLogoSrc = useMemo(() => {
        const raw = company?.logo_url;
        if (!raw || typeof raw !== 'string') return null;
        if (raw.startsWith('blob:') || raw.startsWith('http')) return raw;
        return `${SERVER_URL}${raw}`;
    }, [company]);

    const companySubtitle = useMemo(() => {
        if (!job) return '';
        const name = company?.name || department?.name || 'Entreprise';
        const ref = job.reference || (id ? `RTR-${String(id).slice(-3)}` : '—');
        return `${name} - ${ref}`;
    }, [company, department, job, id]);

    const deadlineDisplay = useMemo(() => {
        if (!job?.deadline) return '—';
        const d = new Date(job.deadline);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }, [job]);

    // ── Automation report helpers ─────────────────────────────────────────────
    const automationEnabled = !!job?.ai_automation?.enabled;
    const summary = job?.ai_automation_summary || {};
    const deadlineProcessed = !!job?.deadline_processed;
    const quizStageProcessed = !!job?.quiz_stage_processed;
    const quizStageEnabled = !!job?.ai_automation?.quiz_stage?.enabled;

    const fmtDate = (val) => {
        if (!val) return null;
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return null;
        return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const automationFunnelSteps = useMemo(() => {
        if (!automationEnabled) return [];
        const cfg = job?.ai_automation || {};
        const topX = cfg.vector_filter?.top_x_candidates;
        const topY = cfg.ai_score_filter?.top_y_candidates;
        const topZ = cfg.quiz_stage?.approve_top_z_to_interview;
        const total = summary.applications_considered ?? null;
        const afterVector = summary.vector_shortlist_count ?? null;
        const afterAI = summary.ai_shortlist_count ?? null;
        const quizSent = summary.quizzes_published ?? null;
        const promoted = summary.promoted_to_interview?.length ?? null;

        return [
            {
                key: 'reception',
                icon: 'inbox',
                label: t('hr-job-detail-funnel-received'),
                sublabel: null,
                count: total,
                done: deadlineProcessed,
                active: !deadlineProcessed,
                config: null,
            },
            {
                key: 'vector',
                icon: 'travel_explore',
                label: t('hr-job-detail-funnel-vector'),
                sublabel: topX ? `Top ${topX}` : null,
                count: afterVector,
                done: deadlineProcessed,
                active: !deadlineProcessed,
                config: topX ? `top_x = ${topX}` : null,
            },
            {
                key: 'ai',
                icon: 'psychology',
                label: t('hr-job-detail-funnel-ai'),
                sublabel: topY ? `Top ${topY}` : null,
                count: afterAI,
                done: deadlineProcessed,
                active: !deadlineProcessed,
                config: topY ? `top_y = ${topY}` : null,
            },
            ...(quizStageEnabled ? [{
                key: 'quiz',
                icon: 'quiz',
                label: t('hr-job-detail-funnel-quiz'),
                sublabel: topZ ? `Top ${topZ}` : null,
                count: quizSent,
                done: quizStageProcessed,
                active: deadlineProcessed && !quizStageProcessed,
                config: topZ ? `top_z = ${topZ}` : null,
            }] : []),
            {
                key: 'interview',
                icon: 'handshake',
                label: t('hr-job-detail-funnel-interview'),
                sublabel: t('hr-job-detail-funnel-interview-sub'),
                count: promoted,
                done: quizStageEnabled ? quizStageProcessed : deadlineProcessed,
                active: false,
                config: null,
            },
        ];
    }, [job, summary, deadlineProcessed, quizStageProcessed, quizStageEnabled, automationEnabled]);

    if (loading) {
        return (
            <div className={`hjd-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="hjd-main hjd-center-state">
                    <div className="hjd-loader" />
                    <p>{t('hr-job-detail-loading')}</p>
                </main>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className={`hjd-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
                <HRSidebar />
                <main className="hjd-main hjd-center-state">
                    <p>{error || t('hr-job-detail-error-default')}</p>
                </main>
            </div>
        );
    }

    return (
        <div className={`hjd-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRSidebar />

            <main className="hjd-main">
                <div className="hjd-shell">
                    <header className="hjd-topbar">
                        <button type="button" className="hjd-back" onClick={() => navigate('/hr/offres')}>
                            <span className="material-symbols-outlined">arrow_back</span>
                            {t('hr-job-detail-back')}
                        </button>
                        <div className="hjd-topbar-right">
                            <span>{t('hr-job-detail-last-updated', { date: new Date(job.updatedAt || job.createdAt || Date.now()).toLocaleString() })}</span>
                            <div className="hjd-status-wrap" ref={statusWrapRef}>
                                <button
                                    type="button"
                                    className={`hjd-status-btn${statusMenuOpen ? ' is-open' : ''}`}
                                    onClick={() => setStatusMenuOpen((p) => !p)}
                                >
                                    <span className="material-symbols-outlined">published_with_changes</span>
                                    {job.status === 'published' ? t('hr-job-detail-status-published') : job.status === 'internal' ? t('hr-job-detail-status-internal') : t('hr-job-detail-status-draft')}
                                </button>
                                {statusMenuOpen && (
                                    <div className="hjd-status-menu" role="menu">
                                        <button type="button" className="hjd-status-item" onClick={() => updateJobStatus('published')}>
                                            {t('hr-job-detail-status-publish')}
                                        </button>
                                        <button type="button" className="hjd-status-item" onClick={() => updateJobStatus('draft')}>
                                            {t('hr-job-detail-status-set-draft')}
                                        </button>
                                        <button type="button" className="hjd-status-item" onClick={() => updateJobStatus('internal')}>
                                            {t('hr-job-detail-status-set-internal')}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button type="button" className="hjd-edit-btn" onClick={() => navigate(`/hr/offres/${id}/edit`)}>
                                <span className="material-symbols-outlined">edit</span>
                                {t('hr-job-detail-edit')}
                            </button>
                        </div>
                    </header>

                    <section className="hjd-layout">
                        <article className="hjd-left">
                            <header className="hjd-hero">
                                <div className="hjd-hero-logo-wrap">
                                    {companyLogoSrc ? (
                                        <img src={companyLogoSrc} alt="" className="hjd-hero-logo" loading="lazy" />
                                    ) : (
                                        <div className="hjd-hero-logo hjd-hero-logo--fallback" aria-hidden>
                                            <span className="material-symbols-outlined">apartment</span>
                                        </div>
                                    )}
                                </div>
                                <p className="hjd-hero-kicker">{companySubtitle}</p>
                                <h1 className="hjd-hero-title" id="hjd-offer-title">
                                    {job.title}
                                </h1>
                                <div className="hjd-hero-tags">
                                    <span className="hjd-hero-tag">
                                        <span className="material-symbols-outlined" aria-hidden>
                                            location_on
                                        </span>
                                        {job.location || '—'}
                                    </span>
                                    <span className="hjd-hero-tag">
                                        <span className="material-symbols-outlined" aria-hidden>
                                            bed
                                        </span>
                                        {department?.name || '—'}
                                    </span>
                                </div>
                            </header>

                            <div className="hjd-map-stack">
                                <div className="hjd-map">
                                    <div className="hjd-map-scrim" aria-hidden />
                                    <div className={`hjd-map-body${company ? ' hjd-map-body--filled' : ''}`}>
                                        {company ? (
                                            <JobDetailCompanyMap
                                                company={company}
                                                addressText={registeredCompanyLocation}
                                            />
                                        ) : null}
                                    </div>
                                    {company && registeredCompanyLocation ? (
                                        <div className="hjd-map-foot">
                                            <span className="material-symbols-outlined" aria-hidden>
                                                place
                                            </span>
                                            <span>{registeredCompanyLocation}</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="hjd-rate-card">
                                <div className="hjd-rate-card-col">
                                    <span className="material-symbols-outlined" aria-hidden>
                                        receipt_long
                                    </span>
                                    <div>
                                        <p className="hjd-rate-card-label">{t('hr-job-detail-rate-salary')}</p>
                                        <strong>{job.salary_range || '—'}</strong>
                                    </div>
                                </div>
                                <div className="hjd-rate-card-col">
                                    <span className="material-symbols-outlined" aria-hidden>
                                        calendar_month
                                    </span>
                                    <div>
                                        <p className="hjd-rate-card-label">{t('hr-job-detail-rate-deadline')}</p>
                                        <strong>{deadlineDisplay}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="hjd-left-content">
                                <div className="hjd-left-slider">
                                    <div className="hjd-left-slider-nav" role="tablist" aria-label="Sections fiche poste">
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={leftSlideIdx === 0}
                                            id="hjd-tab-offer"
                                            aria-controls="hjd-panel-offer"
                                            className={leftSlideIdx === 0 ? 'active' : ''}
                                            onClick={() => goLeftSlide(0)}
                                        >
                                            {t('hr-job-detail-tab-offer')}
                                        </button>
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={leftSlideIdx === 1}
                                            id="hjd-tab-skills"
                                            aria-controls="hjd-panel-skills"
                                            className={leftSlideIdx === 1 ? 'active' : ''}
                                            onClick={() => goLeftSlide(1)}
                                        >
                                            {t('hr-job-detail-tab-skills')}
                                        </button>
                                    </div>
                                    <div className="hjd-left-panels">
                                        {leftSlideIdx === 0 ? (
                                            <section
                                                key="offer"
                                                className="hjd-panel hjd-panel--primary hjd-panel--switch"
                                                id="hjd-panel-offer"
                                                role="tabpanel"
                                                aria-labelledby="hjd-tab-offer"
                                            >
                                                <div className="hjd-info-grid">
                                                    <div><p>{t('hr-job-detail-info-created')}</p><strong>{new Date(job.createdAt || Date.now()).toLocaleDateString()}</strong></div>
                                                    <div><p>{t('hr-job-detail-info-status')}</p><strong className="hjd-hiring">{job.status === 'published' ? t('hr-job-detail-info-status-open') : t('hr-job-detail-info-status-draft')}</strong></div>
                                                    <div><p>{t('hr-job-detail-info-period')}</p><strong>{job.start_date && job.end_date ? `${new Date(job.start_date).toLocaleDateString()} - ${new Date(job.end_date).toLocaleDateString()}` : '—'}</strong></div>
                                                    <div><p>{t('hr-job-detail-info-positions')}</p><strong>{job.open_positions || '—'}</strong></div>
                                                    <div><p>{t('hr-job-detail-info-type')}</p><strong>{job.type || '—'}</strong></div>
                                                    <div><p>{t('hr-job-detail-info-experience')}</p><strong>{job.experience_level || '—'}</strong></div>
                                                </div>

                                                <div className="hjd-block">
                                                    <h3>{t('hr-job-detail-description')}</h3>
                                                    <p className="hjd-prose">{job.description || ''}</p>
                                                </div>
                                            </section>
                                        ) : (
                                            <section
                                                key="skills"
                                                className="hjd-panel hjd-panel--secondary hjd-panel--switch"
                                                id="hjd-panel-skills"
                                                role="tabpanel"
                                                aria-labelledby="hjd-tab-skills"
                                            >
                                                <div className="hjd-section-head">
                                                    <span className="material-symbols-outlined hjd-section-head-icon">task_alt</span>
                                                    <div>
                                                        <h3 id="hjd-skills-title" className="hjd-section-head-title">{t('hr-job-detail-skills-title')}</h3>
                                                        <p className="hjd-section-head-desc">{t('hr-job-detail-skills-desc')}</p>
                                                    </div>
                                                </div>

                                                <div className="hjd-secondary-stack">
                                                    <div className="hjd-secondary-block">
                                                        <h4 className="hjd-secondary-title">{t('hr-job-detail-skills-qualif')}</h4>
                                                        <div className="hjd-chip-list" role="list">
                                                            {(requirementList.length ? requirementList : ['Attention au detail', 'Gestion du temps', 'Bonne condition physique']).map((item, i) => (
                                                                <span className="hjd-chip" key={`req-${i}`} role="listitem">{item}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="hjd-secondary-block">
                                                        <h4 className="hjd-secondary-title">{t('hr-job-detail-notes-title')}</h4>
                                                        <div className="hjd-chip-list hjd-chip-list--soft" role="list">
                                                            {(job.benefits?.length ? job.benefits : ['Uniformes fournis', 'Remises employe sur les services hoteliers']).map((item, i) => (
                                                                <span className="hjd-chip hjd-chip--note" key={`bnf-${i}`} role="listitem">{item}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </section>
                                        )}
                                    </div>

                                    <div className="hjd-left-slider-dots">
                                        <button
                                            type="button"
                                            className={leftSlideIdx === 0 ? 'active' : ''}
                                            onClick={() => goLeftSlide(0)}
                                            aria-label="Afficher l offre"
                                        />
                                        <button
                                            type="button"
                                            className={leftSlideIdx === 1 ? 'active' : ''}
                                            onClick={() => goLeftSlide(1)}
                                            aria-label="Afficher competences et notes"
                                        />
                                    </div>
                                </div>
                            </div>
                        </article>

                        <article className="hjd-right">
                            <div className="hjd-right-stack">
                                <div className="hjd-right-candidates">
                                    <div className="hjd-right-head">
                                        <h2>{t('hr-job-detail-candidates-title')}</h2>
                                        {job?.allow_hr === false ? (
                                            <p style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', maxWidth: '350px', textAlign: 'right', margin: 0 }}>
                                                {t('hr-job-detail-auto-msg')}
                                            </p>
                                         ) : (
                                            <div className="hjd-right-head-actions">
                                                <button
                                                    type="button"
                                                    className="hjd-manual-add-btn"
                                                    onClick={() => openManualCandidatesBatch(id, job.title)}
                                                >
                                                    <span className="material-symbols-outlined">upload_file</span>
                                                    {t('hr-job-detail-manual-add-btn')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="hjd-analyze-btn"
                                                    onClick={loadApplicantScores}
                                                    disabled={aiApplicantLoading || applications.length === 0}
                                                >
                                                    <span className="material-symbols-outlined">
                                                        {aiApplicantLoading ? 'hourglass_empty' : 'auto_awesome'}
                                                    </span>
                                                    {aiApplicantLoading ? t('hr-job-detail-analyzing') : t('hr-job-detail-analyze-btn')}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="hjd-tabs">
                                        {[
                                            ['all', t('hr-job-detail-tab-all')],
                                            ['new', t('hr-job-detail-tab-new')],
                                            ['in_review', t('hr-job-detail-tab-in-review')],
                                            ['technical_test', t('hr-job-detail-tab-quiz')],
                                            ['interview', t('hr-job-detail-tab-interview')],
                                            ['hired', t('hr-job-detail-tab-hired')],
                                        ].map(([key, label]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                className={activeTab === key ? 'active' : ''}
                                                onClick={() => setActiveTab(key)}
                                            >
                                                {label}
                                                <span>{tabCounts[key]}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="hjd-filters">
                                        <div className="hjd-search">
                                            <span className="material-symbols-outlined">search</span>
                                            <input
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder={t('hr-job-detail-search-placeholder')}
                                            />
                                        </div>
                                        <div className="hjd-sort-wrap" ref={sortWrapRef}>
                                            <button
                                                type="button"
                                                className={`hjd-sort-trigger${sortMenuOpen ? ' hjd-sort-trigger--open' : ''}`}
                                                aria-expanded={sortMenuOpen}
                                                aria-haspopup="listbox"
                                                onClick={() => setSortMenuOpen((o) => !o)}
                                            >
                                                <span className="material-symbols-outlined">swap_vert</span>
                                                {t('hr-job-detail-sort-btn')}
                                            </button>
                                            {sortMenuOpen && (
                                                <ul className="hjd-sort-menu" role="listbox" aria-label={t('hr-job-detail-sort-label')}>
                                                    {CANDIDATE_SORT_OPTIONS.map((opt) => (
                                                        <li key={opt.id} role="none">
                                                            <button
                                                                type="button"
                                                                role="option"
                                                                className={`hjd-sort-option${candidateSort === opt.id ? ' active' : ''}`}
                                                                aria-selected={candidateSort === opt.id}
                                                                onClick={() => {
                                                                    setCandidateSort(opt.id);
                                                                    setSortMenuOpen(false);
                                                                }}
                                                            >
                                                                {t(opt.labelKey)}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>

                                    <div className="hjd-table-scroll">
                                        <div className="hjd-table">
                                            <div className="hjd-table-head" style={{ gridTemplateColumns: '2fr 1.5fr 1.2fr 1fr 1.2fr' }}>
                                                <span>{t('hr-job-detail-col-candidate')}</span>
                                                <span>{t('hr-job-detail-col-email')}</span>
                                                <span>{t('hr-job-detail-col-date')}</span>
                                                <span>{t('hr-job-detail-col-score')}</span>
                                                <span>{t('hr-job-detail-col-stage')}</span>
                                            </div>

                                            {appLoading ? (
                                                <div className="hjd-empty">{t('hr-job-detail-loading-apps')}</div>
                                            ) : displayedApplications.length === 0 ? (
                                                <div className="hjd-empty">{t('hr-job-detail-no-apps')}</div>
                                            ) : (
                                                paginatedApplications.map((app) => {
                                                    const age = calcAge(app.birthDate);
                                                    const stage = normalizeApplicationStatus(app.status);
                                                    const sc = getStageConfig(stage);
                                                    const stageVariant = STAGE_CONFIG[stage] ? stage : 'new';
                                                    const stageLabel = t(sc.labelKey);
                                                    return (
                                                        <div
                                                            key={app._id}
                                                            className="hjd-table-row"
                                                            style={{ cursor: 'pointer', gridTemplateColumns: '2fr 1.5fr 1.2fr 1fr 1.2fr' }}
                                                            onClick={() => navigate(`/hr/applications/${app._id}`)}
                                                        >
                                                            <span className="hjd-name-col">
                                                                <span className="hjd-avatar">{`${app.firstName?.[0] || ''}${app.lastName?.[0] || ''}` || '?'}</span>
                                                                <span>
                                                                    <strong>{`${app.firstName || ''} ${app.lastName || ''}`.trim() || t('hr-job-detail-candidate-fallback')}</strong>
                                                                    <em>{`${app.gender || ''}${age ? ` - ${age} ans` : ''}`.trim() || app.headline || t('hr-job-detail-profile-fallback')}</em>
                                                                </span>
                                                            </span>
                                                            <span
                                                                className="hjd-cell-email"
                                                                title={app.email || undefined}
                                                            >
                                                                {truncateEmail(app.email)}
                                                            </span>
                                                            <span className="hjd-applied-date">{formatAppliedAt(app)}</span>
                                                            <span className="hjd-rating">
                                                                <span className="material-symbols-outlined">stars</span>
                                                                {app.ai_score != null ? `${app.ai_score}%` : '--'}
                                                            </span>
                                                            <span
                                                                className={`hjd-stage hjd-stage--${stageVariant}`}
                                                                title={stageLabel}
                                                            >
                                                                <span className="hjd-stage__dot" aria-hidden />
                                                                <span className="hjd-stage__label">{stageLabel}</span>
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                    {!appLoading && candidatesTotalPages > 1 && (
                                        <nav className="hjd-pagination" aria-label="Pagination candidatures">
                                            <button
                                                type="button"
                                                className="hjd-pagination-btn"
                                                disabled={candidatesPageSafe <= 1}
                                                onClick={() => setCandidatesPage((p) => Math.max(1, p - 1))}
                                            >
                                                <span className="material-symbols-outlined" aria-hidden>
                                                    chevron_left
                                                </span>
                                                {t('hr-job-detail-pagination-prev')}
                                            </button>
                                            <span className="hjd-pagination-meta">
                                                {(candidatesPageSafe - 1) * TABLE_PAGE_SIZE + 1}
                                                –
                                                {Math.min(candidatesPageSafe * TABLE_PAGE_SIZE, displayedApplications.length)} {t('hr-job-detail-pagination-of')}{' '}
                                                {displayedApplications.length}
                                                <span className="hjd-pagination-pages">
                                                    ({t('hr-job-detail-pagination-page', { current: candidatesPageSafe, total: candidatesTotalPages })})
                                                </span>
                                            </span>
                                            <button
                                                type="button"
                                                className="hjd-pagination-btn"
                                                disabled={candidatesPageSafe >= candidatesTotalPages}
                                                onClick={() => setCandidatesPage((p) => Math.min(candidatesTotalPages, p + 1))}
                                            >
                                                {t('hr-job-detail-pagination-next')}
                                                <span className="material-symbols-outlined" aria-hidden>
                                                    chevron_right
                                                </span>
                                            </button>
                                        </nav>
                                    )}
                                </div>

                                {automationEnabled ? (
                                    <AutomationReport
                                        job={job}
                                        summary={summary}
                                        deadlineProcessed={deadlineProcessed}
                                        quizStageProcessed={quizStageProcessed}
                                        quizStageEnabled={quizStageEnabled}
                                        funnelSteps={automationFunnelSteps}
                                        deadlineDisplay={deadlineDisplay}
                                    />
                                ) : (
                                    <div className="hjd-embed-below hjd-panel hjd-panel--embed-right">
                                        <div className="hjd-section-head">
                                            <span className="material-symbols-outlined hjd-section-head-icon">psychology</span>
                                            <div>
                                                <h3 className="hjd-section-head-title">{t('hr-job-detail-embed-title')}</h3>
                                                <p className="hjd-section-head-desc">{t('hr-job-detail-embed-desc')}</p>
                                            </div>
                                        </div>
                                        {aiLoading ? (
                                            <p className="hjd-muted-p">{t('hr-job-detail-embed-loading')}</p>
                                        ) : suggestions.length === 0 ? (
                                            <p className="hjd-muted-p">{t('hr-job-detail-embed-empty')}</p>
                                        ) : (
                                            <>
                                                <div className="hjd-embed-table-wrap">
                                                    <div className="hjd-embed-table-head">
                                                        <span>{t('hr-job-detail-embed-col-candidate')}</span>
                                                        <span>{t('hr-job-detail-embed-col-score')}</span>
                                                    </div>
                                                    <ul className="hjd-embed-table-body">
                                                        {paginatedSuggestions.map((s, i) => {
                                                            const name = `${s.firstName || s.prenom || ''} ${s.lastName || s.nom || ''}`.trim() || 'Inconnu';
                                                            const score = s.score != null ? `${Math.round(s.score * 100)}%` : '--';
                                                            return (
                                                                <li key={s._id || `${embedPageSafe}-${i}`}>
                                                                    <span className="hjd-suggestion-name">{name}</span>
                                                                    <span className="hjd-suggestion-score">{score}</span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                                {embedTotalPages > 1 && (
                                                    <nav className="hjd-pagination hjd-pagination--embed" aria-label="Pagination suggestions">
                                                        <button
                                                            type="button"
                                                            className="hjd-pagination-btn"
                                                            disabled={embedPageSafe <= 1}
                                                            onClick={() => setEmbedPage((p) => Math.max(1, p - 1))}
                                                        >
                                                            <span className="material-symbols-outlined" aria-hidden>
                                                                chevron_left
                                                            </span>
                                                            {t('hr-job-detail-pagination-prev')}
                                                        </button>
                                                        <span className="hjd-pagination-meta">
                                                            {(embedPageSafe - 1) * TABLE_PAGE_SIZE + 1}
                                                            –
                                                            {Math.min(embedPageSafe * TABLE_PAGE_SIZE, suggestions.length)} {t('hr-job-detail-pagination-of')} {suggestions.length}
                                                            <span className="hjd-pagination-pages">
                                                                ({t('hr-job-detail-pagination-page', { current: embedPageSafe, total: embedTotalPages })})
                                                            </span>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="hjd-pagination-btn"
                                                            disabled={embedPageSafe >= embedTotalPages}
                                                            onClick={() => setEmbedPage((p) => Math.min(embedTotalPages, p + 1))}
                                                        >
                                                            {t('hr-job-detail-pagination-next')}
                                                            <span className="material-symbols-outlined" aria-hidden>
                                                                chevron_right
                                                            </span>
                                                        </button>
                                                    </nav>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </article>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default JobDetail;
