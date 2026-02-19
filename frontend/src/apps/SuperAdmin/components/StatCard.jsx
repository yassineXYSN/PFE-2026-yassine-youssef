import React from 'react';
import './StatCard.css';

const StatCard = ({ icon, label, value, trend, trendType, color = 'blue' }) => {
    return (
        <div className={`sa-stat-card sa-stat-card-${color}`}>
            <div className="sa-stat-card-header">
                <div className={`sa-stat-icon-wrapper sa-stat-icon-${color}`}>
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
                {trend && (
                    <div className={`sa-stat-trend sa-stat-trend-${trendType}`}>
                        <span className="material-symbols-outlined">
                            {trendType === 'success' ? 'trending_up' : 'trending_down'}
                        </span>
                        {trend}
                    </div>
                )}
            </div>
            <div className="sa-stat-content">
                <h3 className="sa-stat-value">{value}</h3>
                <p className="sa-stat-label">{label}</p>
            </div>
        </div>
    );
};

export default StatCard;
