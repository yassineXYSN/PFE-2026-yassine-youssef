import './HRPageLoader.css'

function HRPageLoader({ variant = 'table', title = 'Chargement des donnees...' }) {
    return (
        <div className={`hr-page-loader hr-page-loader--${variant}`}>
            <div className="hr-page-loader__header">
                <div className="hr-page-loader__eyebrow shimmer-block"></div>
                <div className="hr-page-loader__title shimmer-block"></div>
                <p className="hr-page-loader__text">{title}</p>
            </div>

            {variant === 'dashboard' && (
                <>
                    <div className="hr-page-loader__stats">
                        <div className="hr-page-loader__card shimmer-surface"></div>
                        <div className="hr-page-loader__card shimmer-surface"></div>
                        <div className="hr-page-loader__card shimmer-surface"></div>
                    </div>
                    <div className="hr-page-loader__grid">
                        <div className="hr-page-loader__panel shimmer-surface"></div>
                        <div className="hr-page-loader__panel shimmer-surface"></div>
                    </div>
                    <div className="hr-page-loader__table shimmer-surface"></div>
                </>
            )}

            {variant === 'table' && (
                <>
                    <div className="hr-page-loader__toolbar">
                        <div className="hr-page-loader__search shimmer-block"></div>
                        <div className="hr-page-loader__button shimmer-block"></div>
                        <div className="hr-page-loader__button shimmer-block"></div>
                    </div>
                    <div className="hr-page-loader__table shimmer-surface"></div>
                </>
            )}

            {variant === 'detail' && (
                <>
                    <div className="hr-page-loader__hero shimmer-surface"></div>
                    <div className="hr-page-loader__stats">
                        <div className="hr-page-loader__card shimmer-surface"></div>
                        <div className="hr-page-loader__card shimmer-surface"></div>
                        <div className="hr-page-loader__card shimmer-surface"></div>
                    </div>
                    <div className="hr-page-loader__detail-grid">
                        <div className="hr-page-loader__panel shimmer-surface"></div>
                        <div className="hr-page-loader__panel shimmer-surface"></div>
                    </div>
                </>
            )}

            {variant === 'profile' && (
                <>
                    <div className="hr-page-loader__profile-top shimmer-surface"></div>
                    <div className="hr-page-loader__detail-grid">
                        <div className="hr-page-loader__panel shimmer-surface"></div>
                        <div className="hr-page-loader__panel shimmer-surface"></div>
                    </div>
                </>
            )}
        </div>
    )
}

export default HRPageLoader
