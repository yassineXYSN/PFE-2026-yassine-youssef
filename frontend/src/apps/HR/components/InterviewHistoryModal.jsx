import React from 'react';
import './InterviewHistoryModal.css';

const InterviewHistoryModal = ({ isOpen, onClose, pastInterviews, language }) => {
    if (!isOpen) return null;

    return (
        <div className="ihm-modal-overlay" onClick={onClose}>
            <div className="ihm-modal-card" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="ihm-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="ihm-header-icon">
                            <span className="material-symbols-outlined">history_edu</span>
                        </div>
                        <h2 className="ihm-modal-title">
                            {language === 'fr' ? 'Historique des Bilans IA' : 'AI Analysis History'}
                        </h2>
                    </div>
                    <button className="ihm-modal-close" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="ihm-modal-body">
                    {pastInterviews.length === 0 ? (
                        <div className="ihm-empty-state">
                            <span className="material-symbols-outlined">folder_off</span>
                            <p>{language === 'fr' ? "Aucun entretien passé trouvé." : "No past interviews found."}</p>
                        </div>
                    ) : (
                        <div className="ihm-grid">
                            {pastInterviews.map((past, idx) => (
                                <div key={past._id || idx} className="ihm-history-card">
                                    {/* Score Badge */}
                                    <div className="ihm-score-badge">
                                        <span className="ihm-score-value">{past.ai_analysis?.score || 'N/A'}</span>
                                        <span className="ihm-score-label">Score</span>
                                    </div>

                                    <div className="ihm-card-content">
                                        <div className="ihm-card-header">
                                            <div className="ihm-date-row">
                                                <span className="material-symbols-outlined">calendar_today</span>
                                                <span>
                                                    {new Date(past.start_time).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <h4 className="ihm-interview-summary">
                                                {past.ai_analysis?.summary || (language === 'fr' ? 'Entretien terminé' : 'Completed Interview')}
                                            </h4>
                                        </div>

                                        {past.ai_analysis && (
                                            <div className="ihm-analysis-details">
                                                <div className="ihm-analysis-block ihm-strengths">
                                                    <p className="ihm-block-title">
                                                        <span className="material-symbols-outlined">verified</span>
                                                        {language === 'fr' ? 'Points Forts' : 'Strengths'}
                                                    </p>
                                                    <ul className="ihm-list">
                                                        {past.ai_analysis.strengths?.map((s, i) => (
                                                            <li key={i}><span className="ihm-bullet">•</span> {s}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="ihm-analysis-block ihm-weaknesses">
                                                    <p className="ihm-block-title">
                                                        <span className="material-symbols-outlined">trending_up</span>
                                                        {language === 'fr' ? "Axes d'amélioration" : 'Improvements'}
                                                    </p>
                                                    <ul className="ihm-list">
                                                        {past.ai_analysis.weaknesses?.map((w, i) => (
                                                            <li key={i}><span className="ihm-bullet">•</span> {w}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InterviewHistoryModal;
