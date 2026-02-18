import { formatDuration } from '../utils/calculator';
import type { StreamGroup } from '../hooks/useCycleStream';

interface CycleHeaderProps {
    group: StreamGroup;
    monthLabel: string;
}

export default function CycleHeader({ group, monthLabel }: CycleHeaderProps) {
    const { stats, period } = group;
    const progress = Math.min(100, (stats.totalTTE / stats.goal) * 100);
    const isOvertime = stats.overtime > 0;

    return (
        <div className="glass-card" style={{
            padding: '0.8rem 1rem',
            borderRadius: 0,
            borderBottom: '1px solid var(--glass-border)',
            background: 'rgba(15, 15, 20, 0.95)', // Plus opaque pour le sticky
            backdropFilter: 'blur(20px)',
            zIndex: 10
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {monthLabel}
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                        {period.name}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: isOvertime ? 'var(--neon-orange)' : 'white' }}>
                        {formatDuration(stats.totalTTE)} <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>/ {stats.goal}h</span>
                    </div>
                    {isOvertime && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--neon-orange)', fontWeight: 800 }}>
                            +{formatDuration(stats.overtime)} SUP
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: isOvertime ? 'var(--neon-orange)' : 'var(--electric-indigo)',
                    transition: 'width 0.3s ease'
                }} />
            </div>
        </div>
    );
}
