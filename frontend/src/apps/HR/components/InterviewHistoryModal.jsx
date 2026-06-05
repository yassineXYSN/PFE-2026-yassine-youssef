import React from 'react';
import { useLanguage } from '../../../core/useLanguage';
import './InterviewHistoryModal.css';

const getScoreValue = (analysis) => {
    const raw = analysis?.overall_score ?? analysis?.score;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
};

const getScoreTone = (score) => {
    if (score == null) return 'neutral';
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'average';
    return 'low';
};

const TONE_STYLES = {
    excellent: { color: '#16a34a', bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.3)', accent: '#16a34a' },
    good:      { color: '#2563eb', bg: 'rgba(37,99,235,0.1)',  border: 'rgba(37,99,235,0.3)',  accent: '#2563eb' },
    average:   { color: '#ca8a04', bg: 'rgba(202,138,4,0.1)', border: 'rgba(202,138,4,0.3)',  accent: '#ca8a04' },
    low:       { color: '#dc2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.3)',  accent: '#dc2626' },
    neutral:   { color: null,      bg: null,                   border: null,                   accent: null },
};

const InterviewHistoryModal = ({ isOpen, onClose, pastInterviews, language, theme = 'light' }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    const sorted = [...pastInterviews].sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    const total = sorted.length;
    const withAnalysis = sorted.filter((p) => !!p.ai_analysis).length;
    const scores = sorted.map((p) => getScoreValue(p.ai_analysis)).filter((s) => s != null);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    const fmt = (value) => {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const fmtTime = (value) => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const avgTone = getScoreTone(avgScore);
    const avgStyles = TONE_STYLES[avgTone];

    return (
        <div className="ihm-overlay" onClick={onClose}>
            <section className={`ihm-panel ${theme === 'dark' ? 'dark' : 'light'}`} onClick={(e) => e.stopPropagation()}>

                {/* ── Header ── */}
                <header className="ihm-header">
                    <div>
                        <p className="ihm-kicker">{language === 'fr' ? 'Dossier d\'entretien' : 'Interview Record'}</p>
                        <h2 className="ihm-title">{language === 'fr' ? 'Bilans d\'entretien' : 'Interview Assessments'}</h2>
                    </div>
                    <button className="ihm-close" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                {/* ── Stats bar ── */}
                <div className="ihm-stats">
                    <div className="ihm-stat">
                        <span className="ihm-stat-icon material-symbols-outlined">event_note</span>
                        <div className="ihm-stat-body">
                            <strong>{total}</strong>
                            <span>{language === 'fr' ? 'Entretiens' : 'Interviews'}</span>
                        </div>
                    </div>
                    <div className="ihm-stat">
                        <span className="ihm-stat-icon material-symbols-outlined">psychology</span>
                        <div className="ihm-stat-body">
                            <strong>{withAnalysis}</strong>
                            <span>{language === 'fr' ? 'Analysés IA' : 'AI Analysed'}</span>
                        </div>
                    </div>
                    <div className="ihm-stat" style={avgScore != null ? { '--stat-accent': avgStyles.color, '--stat-bg': avgStyles.bg } : {}}>
                        <span className="ihm-stat-icon material-symbols-outlined" style={avgScore != null ? { color: avgStyles.color } : {}}>leaderboard</span>
                        <div className="ihm-stat-body">
                            <strong style={avgScore != null ? { color: avgStyles.color } : {}}>{avgScore != null ? `${avgScore}/100` : '—'}</strong>
                            <span>{language === 'fr' ? 'Score moyen' : 'Avg. Score'}</span>
                        </div>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="ihm-body">
                    {sorted.length === 0 ? (
                        <div className="ihm-empty">
                            <span className="material-symbols-outlined">folder_off</span>
                            <p>{language === 'fr' ? 'Aucun entretien passé' : 'No past interviews'}</p>
                        </div>
                    ) : (
                        <div className="ihm-list">
                            {sorted.map((past, idx) => {
                                const score = getScoreValue(past.ai_analysis);
                                const tone = getScoreTone(score);
                                const ts = TONE_STYLES[tone];
                                const strengths = past.ai_analysis?.strengths || [];
                                const weaknesses = past.ai_analysis?.weaknesses || [];
                                const summary = past.ai_analysis?.summary;
                                const durationMin = past.end_time
                                    ? Math.round((new Date(past.end_time) - new Date(past.start_time)) / 60000)
                                    : null;

                                return (
                                    <article key={past._id || idx} className="ihm-card">
                                        {/* Accent stripe */}
                                        <div className="ihm-card-stripe" style={{ background: ts.accent || 'var(--ihm-line)' }} />

                                        <div className="ihm-card-inner">
                                            {/* Left: score badge */}
                                            <aside className="ihm-score-col">
                                                <div
                                                    className="ihm-score-badge"
                                                    style={ts.color ? {
                                                        color: ts.color,
                                                        background: ts.bg,
                                                        borderColor: ts.border,
                                                    } : {}}
                                                >
                                                    <span className="ihm-score-num">{score != null ? Math.round(score) : '—'}</span>
                                                    {score != null && <span className="ihm-score-denom">/100</span>}
                                                </div>
                                                <span className="ihm-score-lbl">{language === 'fr' ? 'Score IA' : 'AI Score'}</span>
                                                {idx === 0 && (
                                                    <span className="ihm-latest-badge">{language === 'fr' ? 'Dernier' : 'Latest'}</span>
                                                )}
                                            </aside>

                                            {/* Right: content */}
                                            <div className="ihm-content-col">
                                                {/* Meta row */}
                                                <div className="ihm-meta-row">
                                                    <span className="ihm-chip">
                                                        <span className="material-symbols-outlined">calendar_today</span>
                                                        {fmt(past.start_time)}
                                                        {past.start_time && <span className="ihm-chip-sep">·</span>}
                                                        {fmtTime(past.start_time)}
                                                    </span>
                                                    {durationMin && (
                                                        <span className="ihm-chip">
                                                            <span className="material-symbols-outlined">timer</span>
                                                            {durationMin} min
                                                        </span>
                                                    )}
                                                    {past.type && (
                                                        <span className="ihm-chip">
                                                            <span className="material-symbols-outlined">video_call</span>
                                                            {past.type}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Summary */}
                                                {summary ? (
                                                    <p className="ihm-summary">{summary}</p>
                                                ) : !past.ai_analysis ? (
                                                    <p className="ihm-no-analysis">
                                                        {language === 'fr'
                                                            ? 'Analyse IA non disponible pour cet entretien.'
                                                            : 'AI analysis not available for this interview.'}
                                                    </p>
                                                ) : null}

                                                {/* Strengths / Weaknesses */}
                                                {past.ai_analysis && (
                                                    <div className="ihm-sw-grid">
                                                        <div className="ihm-sw-col ihm-sw-strengths">
                                                            <p className="ihm-sw-title">
                                                                <span className="material-symbols-outlined">thumb_up</span>
                                                                {language === 'fr' ? 'Points forts' : 'Strengths'}
                                                            </p>
                                                            {strengths.length ? (
                                                                <ul className="ihm-sw-list">
                                                                    {strengths.map((s, i) => <li key={i}>{s}</li>)}
                                                                </ul>
                                                            ) : (
                                                                <p className="ihm-sw-empty">—</p>
                                                            )}
                                                        </div>
                                                        <div className="ihm-sw-col ihm-sw-weaknesses">
                                                            <p className="ihm-sw-title">
                                                                <span className="material-symbols-outlined">flag</span>
                                                                {language === 'fr' ? 'Axes d\'amélioration' : 'To Improve'}
                                                            </p>
                                                            {weaknesses.length ? (
                                                                <ul className="ihm-sw-list">
                                                                    {weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                                                                </ul>
                                                            ) : (
                                                                <p className="ihm-sw-empty">—</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default InterviewHistoryModal;
