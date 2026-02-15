import React from 'react'
import './StatCard.css'

const StatCard = ({ icon, label, value, trend, trendType = 'success', colorTheme }) => {
    return (
        <div className={`stat-card ${colorTheme ? `stat-card--${colorTheme}` : ''}`}>
            <div className="stat-header">
                <div className="stat-icon">
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
                {trend && (
                    <span className={`stat-badge stat-badge--${trendType}`}>
                        {trend}
                    </span>
                )}
            </div>
            <div className="stat-content">
                <p className="stat-label">{label}</p>
                <p className="stat-value">{value}</p>
            </div>
        </div>
    )
}

export default StatCard
