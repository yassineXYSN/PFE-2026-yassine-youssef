import React from 'react';
import './Skeleton.css';

/**
 * A flexible Skeleton component for premium loading states.
 * 
 * @param {string} variant - 'text', 'circle', 'rectangle'
 * @param {string} width - CSS width (e.g. '100%', '200px')
 * @param {string} height - CSS height (e.g. '1rem', '4rem')
 * @param {string} borderRadius - CSS border-radius
 * @param {string} className - Additional CSS classes
 * @param {object} style - Inline styles
 */
const Skeleton = ({
    variant = 'text',
    width,
    height,
    borderRadius,
    className = '',
    style = {}
}) => {
    const styles = {
        width,
        height,
        borderRadius,
        ...style
    };

    return (
        <div
            className={`skeleton-base skeleton--${variant} ${className}`}
            style={styles}
        />
    );
};

export default Skeleton;
