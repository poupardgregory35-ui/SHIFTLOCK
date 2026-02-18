
import React from 'react';
import type { DayShift, DailyResult } from '../types';
import { Sun, Coffee, Utensils, Zap } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseSmartTime, formatDuration } from '../utils/calculator';

interface Props {
    shift: DayShift;
    result: DailyResult;
    onChange: (updates: Partial<DayShift>) => void;
}

const DayInput: React.FC<Props> = ({ shift, result, onChange }) => {
    const dateObj = parseISO(shift.date);
    const dayName = format(dateObj, 'EEEE d MMM', { locale: fr });

    const handleTimeChange = (field: 'start' | 'end', value: string) => {
        onChange({ [field]: value });
    };

    const handleTimeBlur = (field: 'start' | 'end', value: string) => {
        onChange({ [field]: parseSmartTime(value) });
    };

    const isRest = !shift.start && !shift.end && !shift.isHoliday;
    const isHoliday = shift.isHoliday;
    const isWork = !!(shift.start || shift.end);

    return (
        <div className={`glass-card fade-in ${isRest ? 'shift-rest' : ''} ${isHoliday ? 'shift-holiday' : ''} ${isWork ? 'shift-work' : ''}`} style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                    {dayName}
                    {isHoliday && <span style={{ marginLeft: '0.5rem', color: 'var(--success)', fontSize: '0.6rem' }}>[CONGÉ]</span>}
                    {isRest && <span style={{ marginLeft: '0.5rem', color: 'var(--text-dim)', fontSize: '0.6rem' }}>[REPOS]</span>}
                </h3>
                {isWork && (
                    <div style={{ fontWeight: 800, color: 'var(--neon-orange)', fontSize: '0.9rem' }}>
                        {formatDuration(result.tte)}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>DÉBUT</label>
                    <input
                        type="text"
                        placeholder="--"
                        value={shift.start}
                        onChange={(e) => handleTimeChange('start', e.target.value)}
                        onBlur={(e) => handleTimeBlur('start', e.target.value)}
                        style={{ background: 'var(--bg-accent)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.5rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>FIN</label>
                    <input
                        type="text"
                        placeholder="--"
                        value={shift.end}
                        onChange={(e) => handleTimeChange('end', e.target.value)}
                        onBlur={(e) => handleTimeBlur('end', e.target.value)}
                        style={{ background: 'var(--bg-accent)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.5rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                    className={`neon-button secondary ${shift.isHoliday ? 'active' : ''}`}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.65rem', background: shift.isHoliday ? 'var(--success)' : '' }}
                    onClick={() => onChange({ isHoliday: !shift.isHoliday, start: '', end: '' })}
                >
                    CONGÉ
                </button>
                <button
                    className={`neon-button secondary ${shift.hasSundayBonus ? 'active' : ''}`}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.65rem', background: shift.hasSundayBonus ? 'var(--neon-orange)' : '' }}
                    onClick={() => onChange({ hasSundayBonus: !shift.hasSundayBonus })}
                >
                    <Sun size={12} /> DIM/JF
                </button>
                <button
                    className={`neon-button secondary ${shift.hasMealAllowance ? 'active' : ''}`}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.65rem', background: shift.hasMealAllowance ? 'var(--neon-orange)' : '' }}
                    onClick={() => onChange({ hasMealAllowance: !shift.hasMealAllowance })}
                >
                    <Coffee size={12} /> IR
                </button>
                <button
                    className={`neon-button secondary ${shift.hasIRU ? 'active' : ''}`}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.65rem', background: shift.hasIRU ? 'var(--neon-orange)' : '' }}
                    onClick={() => onChange({ hasIRU: !shift.hasIRU })}
                >
                    <Utensils size={12} /> IRU
                </button>
            </div>

            {result.alerts.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {result.alerts.map((alert, i) => (
                        <span key={i} style={{
                            fontSize: '0.6rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: alert.type === 'rose' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                            color: alert.type === 'rose' ? '#ef4444' : '#f97316',
                            border: `1px solid ${alert.type === 'rose' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(249, 115, 22, 0.3)'}`
                        }}>
                            {alert.message}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DayInput;
