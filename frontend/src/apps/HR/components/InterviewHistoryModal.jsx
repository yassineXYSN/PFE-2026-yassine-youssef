import React from 'react';
import './InterviewHistoryModal.css';

const formatDate = (value, language) => {
    if (!value) return language === 'fr' ? 'Date non disponible' : 'Date unavailable';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return language === 'fr' ? 'Date invalide' : 'Invalid date';
    return d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};

const getScoreValue = (analysis) => {
    const raw = analysis?.score;
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

const InterviewHistoryModal = ({ isOpen, onClose, pastInterviews, language, theme = 'light' }) => {
    if (!isOpen) return null;

    const total = pastInterviews.length;
    const withAnalysis = pastInterviews.filter((p) => !!p.ai_analysis).length;
    const avgScore = (() => {
        const list = pastInterviews
            .map((p) => getScoreValue(p.ai_analysis))
            .filter((s) => s != null);
        if (!list.length) return null;
        return Math.round(list.reduce((a, b) => a + b, 0) / list.length);
    })();

    return (
        <div className="ihm-modal-overlay" onClick={onClose}>
            <section
                className={`ihm-modal-card ${theme === 'dark' ? 'dark' : 'light'}`}
                onClick={(e) => e.stopPropagation()}
                aria-label={language === 'fr' ? 'Historique des Bilans IA' : 'AI Analysis History'}
            >
                <header className="ihm-modal-header">
                    <div className="ihm-title-wrap">
                        <p className="ihm-kicker">{language === 'fr' ? 'Archive IA' : 'AI archive'}</p>
                        <h2 className="ihm-modal-title">
                            {language === 'fr' ? 'Historique des Bilans IA' : 'AI Analysis History'}
                        </h2>
                    </div>
                    <button className="ihm-modal-close" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                <div className="ihm-stats-row">
                    <div className="ihm-stat-chip">
                        <p>{language === 'fr' ? 'Entretiens' : 'Interviews'}</p>
                        <strong>{total}</strong>
                    </div>
                    <div className="ihm-stat-chip">
                        <p>{language === 'fr' ? 'Bilans IA' : 'AI analyses'}</p>
                        <strong>{withAnalysis}</strong>
                    </div>
                    <div className="ihm-stat-chip">
                        <p>{language === 'fr' ? 'Score moyen' : 'Average score'}</p>
                        <strong>{avgScore == null ? 'N/A' : `${avgScore}/100`}</strong>
                    </div>
                </div>

                <div className="ihm-modal-body">
                    {pastInterviews.length === 0 ? (
                        <div className="ihm-empty-state">
                            <span className="material-symbols-outlined">folder_off</span>
                            <p>{language === 'fr' ? "Aucun entretien passé trouvé." : "No past interviews found."}</p>
                        </div>
                    ) : (
                        <div className="ihm-listing">
                            {pastInterviews.map((past, idx) => {
                                const score = getScoreValue(past.ai_analysis);
                                const strengths = past.ai_analysis?.strengths || [];
                                const weaknesses = past.ai_analysis?.weaknesses || [];

                                return (
                                    <article key={past._id || idx} className="ihm-history-row">
                                        <aside className="ihm-left-rail">
                                            <div className={`ihm-score-badge ${getScoreTone(score)}`}>
                                                <span className="ihm-score-value">{score ?? 'N/A'}</span>
                                            </div>
                                            <span className="ihm-score-caption">
                                                {language === 'fr' ? 'Score IA' : 'AI score'}
                                            </span>
                                        </aside>

                                        <div className="ihm-row-main">
                                            <div className="ihm-row-top">
                                                <span className="ihm-date-row">
                                                    <span className="material-symbols-outlined">calendar_today</span>
                                                    {formatDate(past.start_time, language)}
                                                </span>
                                                <h4 className="ihm-interview-summary">
                                                    {past.ai_analysis?.summary
                                                        || (language === 'fr' ? 'Entretien terminé' : 'Completed Interview')}
                                                </h4>
                                            </div>

                                            {!!past.ai_analysis && (
                                                <div className="ihm-columns">
                                                    <section className="ihm-column ihm-strengths">
                                                        <p className="ihm-block-title">
                                                            {language === 'fr' ? 'Points forts' : 'Strengths'}
                                                        </p>
                                                        {strengths.length ? (
                                                            <ul className="ihm-list">
                                                                {strengths.map((s, i) => (
                                                                    <li key={i}>{s}</li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <p className="ihm-muted-line">
                                                                {language === 'fr' ? 'Aucun point fort détecté.' : 'No strengths detected.'}
                                                            </p>
                                                        )}
                                                    </section>

                                                    <section className="ihm-column ihm-weaknesses">
                                                        <p className="ihm-block-title">
                                                            {language === 'fr' ? "Axes d'amélioration" : 'Improvements'}
                                                        </p>
                                                        {weaknesses.length ? (
                                                            <ul className="ihm-list">
                                                                {weaknesses.map((w, i) => (
                                                                    <li key={i}>{w}</li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <p className="ihm-muted-line">
                                                                {language === 'fr' ? 'Aucun axe identifié.' : 'No improvements identified.'}
                                                            </p>
                                                        )}
                                                    </section>
                                                </div>
                                            )}
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
