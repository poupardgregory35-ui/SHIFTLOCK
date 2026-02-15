
import type { DayShift, DailyResult } from '../types';
import { Sun, Coffee, Utensils, Shield, UtensilsCrossed } from 'lucide-react';
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

    return (
        <div className="card fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ margin: 0, color: 'white', fontSize: '0.9rem' }}>{dayName}</h2>
                {shift.start && shift.end && (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div className="value-label" style={{ fontSize: '0.65rem' }}>TTE</div>
                            <div style={{ fontWeight: 800, color: 'var(--accent-color)', fontSize: '0.9rem' }}>{formatDuration(result.tte)}</div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button
                    className="toggle-btn"
                    style={{ fontSize: '0.65rem', padding: '0.3rem 0.5rem' }}
                    onClick={() => onChange({ start: '07:00', end: '19:00', breakRepas: 45, breakSecuritaire: 20 })}
                >
                    7-19
                </button>
                <button
                    className="toggle-btn"
                    style={{ fontSize: '0.65rem', padding: '0.3rem 0.5rem' }}
                    onClick={() => onChange({ start: '19:00', end: '07:00', breakRepas: 45, breakSecuritaire: 20 })}
                >
                    19-7
                </button>
                <button
                    className="toggle-btn"
                    style={{ fontSize: '0.65rem', padding: '0.3rem 0.5rem' }}
                    onClick={() => onChange({ start: '08:00', end: '18:00', breakRepas: 45, breakSecuritaire: 20 })}
                >
                    8-18
                </button>
                <button
                    className="toggle-btn"
                    style={{ fontSize: '0.65rem', padding: '0.3rem 0.5rem' }}
                    onClick={() => onChange({
                        start: '',
                        end: '',
                        breakRepas: 0,
                        breakSecuritaire: 0,
                        hasSundayBonus: false,
                        hasMealAllowance: false,
                        hasIRU: false
                    })}
                >
                    Repos
                </button>
            </div>

            <div className="input-grid">
                <div className="input-group">
                    <label>Début</label>
                    <input
                        type="text"
                        placeholder="Ex: 7"
                        value={shift.start}
                        onChange={(e) => handleTimeChange('start', e.target.value)}
                        onBlur={(e) => handleTimeBlur('start', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTimeBlur('start', (e.target as HTMLInputElement).value)}
                    />
                </div>
                <div className="input-group">
                    <label>Fin</label>
                    <input
                        type="text"
                        placeholder="Ex: 19"
                        value={shift.end}
                        onChange={(e) => handleTimeChange('end', e.target.value)}
                        onBlur={(e) => handleTimeBlur('end', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTimeBlur('end', (e.target as HTMLInputElement).value)}
                    />
                </div>
            </div>

            <div className="input-grid" style={{ marginTop: '1rem' }}>
                <div className="input-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <UtensilsCrossed size={12} /> Pause Repas
                    </label>
                    <input
                        type="number"
                        placeholder="min"
                        value={shift.breakRepas || ''}
                        onChange={(e) => onChange({ breakRepas: parseInt(e.target.value) || 0 })}
                    />
                </div>
                <div className="input-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Shield size={12} /> Pause Sécu
                    </label>
                    <input
                        type="number"
                        placeholder="min"
                        value={shift.breakSecuritaire || ''}
                        onChange={(e) => onChange({ breakSecuritaire: parseInt(e.target.value) || 0 })}
                    />
                </div>
            </div>

            <div className="toggle-group">
                <button
                    className={`toggle-btn ${shift.hasSundayBonus ? 'active' : ''}`}
                    onClick={() => onChange({ hasSundayBonus: !shift.hasSundayBonus })}
                >
                    <Sun size={14} /> DIM/JF
                </button>
                <button
                    className={`toggle-btn ${shift.hasMealAllowance ? 'active' : ''}`}
                    onClick={() => onChange({ hasMealAllowance: !shift.hasMealAllowance })}
                >
                    <Coffee size={14} /> IR (15€)
                </button>
                <button
                    className={`toggle-btn ${shift.hasIRU ? 'active' : ''}`}
                    onClick={() => onChange({ hasIRU: !shift.hasIRU })}
                >
                    <Utensils size={14} /> IRU (9€)
                </button>
            </div>

            {result.alerts.length > 0 && (
                <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {result.alerts.map((alert, i) => (
                        <span key={i} className={`badge badge-${alert.type}`}>
                            {alert.message}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DayInput;
