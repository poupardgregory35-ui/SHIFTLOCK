
import React from 'react';
import { formatDuration } from '../utils/calculator';

interface Props {
    current: number;
    total: number;
}

const FortnightGauge: React.FC<Props> = ({ current, total }) => {
    const percentage = Math.min(100, (current / total) * 100);
    const overtime = Math.max(0, current - total);
    const isOvertime = current > total;

    return (
        <div className="card fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                    <h2 style={{ marginBottom: '4px' }}>Période (28 jours)</h2>
                    <span className="value-large" style={{ color: isOvertime ? 'var(--warning)' : 'white' }}>
                        {formatDuration(current)}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                        / {total}h
                    </span>
                </div>
                {isOvertime && (
                    <div style={{ textAlign: 'right' }}>
                        <div className="badge badge-orange">+ {formatDuration(overtime)} HS</div>
                    </div>
                )}
            </div>
            <div className="gauge-container">
                <div
                    className="gauge-bar"
                    style={{
                        width: `${percentage}%`,
                        background: isOvertime ? 'var(--orange)' : 'var(--accent-gradient)'
                    }}
                />
            </div>
            <div className="value-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Objectif Paie</span>
                <span>{isOvertime ? 'Seuil HS franchi 🚀' : `À faire: ${formatDuration(total - current)}`}</span>
            </div>
        </div>
    );
};

export default FortnightGauge;
