
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Moon, ChevronDown, Clock, MessageSquare, Coffee } from 'lucide-react';
import type { DayShift, DayStatus, Pause, PauseType } from '../types';
import { parseQuickTime, formatDuration, timeToMinutes } from '../utils/calculator';
import { VoiceDictation } from './VoiceDictation';
import { Mic } from 'lucide-react';
import { ALLOWANCES, MEAL_WINDOWS } from '../types';

interface BottomSheetProps {
    date: string;
    shift: DayShift;
    onSave: (updates: Partial<DayShift>) => void;
    onClose: () => void;
}

const DAY_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const STATUS_OPTIONS: { value: DayStatus; label: string; color: string }[] = [
    { value: 'TRAVAIL', label: '🚑 Travail', color: '#22d3ee' },
    { value: 'REPOS', label: '💤 Repos', color: '#94a3b8' },
    { value: 'CP', label: '🏖️ Congé', color: '#a78bfa' },
    { value: 'MALADIE', label: '🤒 Maladie', color: '#f87171' },
    { value: 'FORMATION', label: '📚 Formation', color: '#34d399' },
    { value: 'FERIE', label: '🎉 Férié', color: '#fbbf24' },
];

const PAUSE_TYPES: { value: PauseType; label: string; icon: string }[] = [
    { value: 'ENTREPRISE', label: 'Entreprise', icon: '🏢' },
    { value: 'EXTERIEUR', label: 'Extérieur', icon: '🌳' },
    { value: 'DOMICILE', label: 'Domicile', icon: '🏠' },
];

function genId() {
    return Math.random().toString(36).slice(2, 9);
}

function TimeInput({ value, onChange, placeholder, label }: {
    value: string; onChange: (v: string) => void; placeholder?: string; label?: string;
}) {
    const [raw, setRaw] = useState(value || '');
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => { setRaw(value || ''); }, [value]);

    const handleBlur = () => {
        const parsed = parseQuickTime(raw);
        if (parsed) {
            setRaw(parsed);
            onChange(parsed);
        } else if (!raw) {
            onChange('');
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            {label && <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>}
            <input
                ref={ref}
                type="text"
                inputMode="numeric"
                value={raw}
                placeholder={placeholder || '--:--'}
                onChange={e => setRaw(e.target.value)}
                onBlur={handleBlur}
                onFocus={() => ref.current?.select()}
                style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#f1f5f9',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.05em',
                    outline: 'none',
                    caretColor: '#22d3ee',
                    transition: 'all 0.2s',
                }}
                onKeyDown={e => { if (e.key === 'Enter') ref.current?.blur(); }}
            />
        </div>
    );
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ date, shift, onSave, onClose }) => {
    const [local, setLocal] = useState<DayShift>({ ...shift, pauses: [...(shift.pauses || [])] });
    const [visible, setVisible] = useState(false);
    const [showVoice, setShowVoice] = useState(false);

    // Convert empty string status or undefined to VIDE for safety, though shift.status should be typed
    if (!local.status) local.status = 'VIDE';

    const d = new Date(date); // Assuming date is ISO YYYY-MM-DD
    const label = `${DAY_FULL[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 280);
    };

    const handleSave = () => {
        onSave(local);
        setVisible(false);
        setTimeout(onClose, 280);
    };

    const addPause = () => {
        setLocal(prev => ({
            ...prev,
            pauses: [...prev.pauses, { id: genId(), start: '', end: '', type: 'ENTREPRISE' }],
        }));
    };

    const updatePause = (id: string, updates: Partial<Pause>) => {
        setLocal(prev => ({
            ...prev,
            pauses: prev.pauses.map(p => p.id === id ? { ...p, ...updates } : p),
        }));
    };

    const removePause = (id: string) => {
        setLocal(prev => ({ ...prev, pauses: prev.pauses.filter(p => p.id !== id) }));
    };

    // Calcul TTE temps réel pour feedback visuel
    const startMin = timeToMinutes(local.start || '');
    let endMin = timeToMinutes(local.end || '');
    if (local.start && local.end && endMin <= startMin) endMin += 24 * 60; // Handle night shift crossing midnight

    const amplitude = (startMin && local.end) ? Math.max(0, endMin - startMin) : 0;

    const pauseTotal = local.pauses.reduce((acc, p) => {
        if (!p.start || !p.end) return acc;
        const ps = timeToMinutes(p.start);
        let pe = timeToMinutes(p.end);
        if (pe <= ps) pe += 24 * 60;
        return acc + Math.max(0, pe - ps);
    }, 0);

    const tte = Math.max(0, amplitude - pauseTotal);

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={handleClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9998,
                    opacity: visible ? 1 : 0,
                    transition: 'opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            />

            {/* Sheet Container */}
            <div style={{
                position: 'fixed',
                left: 0, right: 0, bottom: 0,
                zIndex: 9999,
                background: '#0f172a',
                borderRadius: '24px 24px 0 0',
                padding: '0 0 32px',
                maxHeight: '92vh',
                display: 'flex', flexDirection: 'column',
                transform: visible ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
            }}>

                {/* Scrollable Content */}
                <div style={{ overflowY: 'auto', padding: '0 20px', flex: 1 }}>

                    {/* Handle & Header */}
                    <div style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 10, paddingBottom: '16px', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Édition du shift</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f1f5f9', marginTop: '2px' }}>{label}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setShowVoice(!showVoice)}
                                    style={{
                                        background: showVoice ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                                        border: showVoice ? '1px solid rgba(99, 102, 241, 0.4)' : 'none',
                                        borderRadius: '50%', width: '36px', height: '36px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    <Mic size={20} color={showVoice ? '#818cf8' : '#cbd5e1'} />
                                </button>
                                <button onClick={handleClose} style={{
                                    background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s'
                                }}>
                                    <X size={20} color="#cbd5e1" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {showVoice && (
                        <VoiceDictation
                            onApply={(updates) => {
                                setLocal(prev => ({
                                    ...prev,
                                    ...updates,
                                    // Merge pauses carefully or replace them if dictation is primary
                                    pauses: updates.pauses ? (updates.pauses as Pause[]) : prev.pauses
                                }));
                                setShowVoice(false);
                            }}
                            onClose={() => setShowVoice(false)}
                        />
                    )}

                    {/* Status Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '24px' }}>
                        {STATUS_OPTIONS.map(opt => {
                            const isActive = local.status === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => setLocal(prev => ({ ...prev, status: opt.value }))}
                                    style={{
                                        padding: '12px 8px',
                                        borderRadius: '12px',
                                        border: `1px solid ${isActive ? opt.color : 'rgba(255,255,255,0.05)'}`,
                                        background: isActive ? `${opt.color}15` : 'rgba(255,255,255,0.02)',
                                        color: isActive ? opt.color : '#94a3b8',
                                        fontSize: '0.75rem',
                                        fontWeight: isActive ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                    }}
                                >
                                    <span style={{ fontSize: '1.1rem' }}>{opt.label.split(' ')[0]}</span>
                                    <span>{opt.label.split(' ')[1]}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* WORK FORM */}
                    {local.status === 'TRAVAIL' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* Time Inputs */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Clock size={16} color="#64748b" />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horaires de service</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                    <TimeInput label="Début" value={local.start || ''} onChange={v => setLocal(p => ({ ...p, start: v }))} placeholder="08:00" />
                                    <TimeInput label="Fin" value={local.end || ''} onChange={v => setLocal(p => ({ ...p, end: v }))} placeholder="18:00" />
                                </div>

                                {/* Night Shift Toggle */}
                                <div
                                    onClick={() => setLocal(p => ({ ...p, isNight: !p.isNight }))}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 14px',
                                        background: local.isNight ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                                        borderRadius: '10px', cursor: 'pointer',
                                        border: `1px solid ${local.isNight ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ background: local.isNight ? '#4f46e5' : '#1e293b', padding: '6px', borderRadius: '8px', transition: 'background 0.2s' }}>
                                            <Moon size={16} color={local.isNight ? 'white' : '#64748b'} />
                                        </div>
                                        <span style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 500 }}>Shift de nuit</span>
                                    </div>

                                    <div style={{
                                        width: '44px', height: '24px',
                                        background: local.isNight ? '#6366f1' : '#334155',
                                        borderRadius: '12px', position: 'relative',
                                        transition: 'background 0.2s',
                                    }}>
                                        <div style={{
                                            position: 'absolute', top: '2px',
                                            left: local.isNight ? '22px' : '2px',
                                            width: '20px', height: '20px',
                                            background: 'white', borderRadius: '50%',
                                            transition: 'left 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }} />
                                    </div>
                                </div>
                            </div>

                            {/* Summary Card */}
                            {tte > 0 && (
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                    background: 'linear-gradient(135deg, rgba(34,211,238,0.05) 0%, rgba(99,102,241,0.05) 100%)',
                                    border: '1px solid rgba(34,211,238,0.2)',
                                    borderRadius: '16px', padding: '16px 0',
                                    position: 'relative', overflow: 'hidden'
                                }}>
                                    <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amplitude</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#cbd5e1', marginTop: '4px' }}>{formatDuration(amplitude)}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pauses</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f87171', marginTop: '4px' }}>-{formatDuration(pauseTotal)}</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>TTE Final</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#22d3ee', lineHeight: 1, marginTop: '2px' }}>{formatDuration(tte)}</div>
                                    </div>
                                </div>
                            )}

                            {/* Pauses Section */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Coffee size={16} color="#64748b" />
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pauses & Coupures</span>
                                    </div>

                                    <button onClick={addPause} style={{
                                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                                        borderRadius: '8px', padding: '6px 10px',
                                        color: '#818cf8', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}>
                                        <Plus size={14} /> Ajouter
                                    </button>
                                </div>

                                {local.pauses.length === 0 ? (
                                    <div style={{
                                        padding: '20px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px',
                                        color: '#64748b', fontSize: '0.85rem'
                                    }}>
                                        Aucune pause enregistrée
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {local.pauses.map((pause, idx) => (
                                            <div key={pause.id} style={{
                                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                                borderRadius: '12px', padding: '12px', position: 'relative'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '8px' }}>
                                                        {(() => {
                                                            const startMin = timeToMinutes(pause.start);
                                                            const isMealTime = MEAL_WINDOWS.some(w => startMin >= w.start && startMin <= w.end);
                                                            const isMeal = pause.isMeal ?? isMealTime;

                                                            if (isMeal) {
                                                                // Special Meal UI: IR or IRU (represented by Exterieur vs Entreprise)
                                                                return (
                                                                    <>
                                                                        <button
                                                                            onClick={() => updatePause(pause.id, { type: 'EXTERIEUR' })}
                                                                            style={{
                                                                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                                                                background: pause.type === 'EXTERIEUR' ? '#22c55e' : 'transparent',
                                                                                color: pause.type === 'EXTERIEUR' ? '#0f172a' : '#64748b',
                                                                                fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                                                                            }}
                                                                        >
                                                                            🍽️ IR {ALLOWANCES.IR}€
                                                                        </button>
                                                                        <button
                                                                            onClick={() => updatePause(pause.id, { type: 'ENTREPRISE' })}
                                                                            style={{
                                                                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                                                                background: pause.type === 'ENTREPRISE' ? '#818cf8' : 'transparent',
                                                                                color: pause.type === 'ENTREPRISE' ? '#f1f5f9' : '#64748b',
                                                                                fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                                                                            }}
                                                                        >
                                                                            🏢 IRU {ALLOWANCES.IR_REDUIT}€
                                                                        </button>
                                                                        <button
                                                                            onClick={() => updatePause(pause.id, { type: 'DOMICILE' })}
                                                                            style={{
                                                                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                                                                background: pause.type === 'DOMICILE' ? '#334155' : 'transparent',
                                                                                color: pause.type === 'DOMICILE' ? '#f1f5f9' : '#64748b',
                                                                                fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                                                                            }}
                                                                        >
                                                                            🏠 Domicile
                                                                        </button>
                                                                    </>
                                                                );
                                                            }

                                                            // Default Security/Other UI
                                                            return PAUSE_TYPES.map(pt => (
                                                                <button
                                                                    key={pt.value}
                                                                    onClick={() => updatePause(pause.id, { type: pt.value })}
                                                                    style={{
                                                                        padding: '4px 8px', borderRadius: '6px', border: 'none',
                                                                        background: pause.type === pt.value ? '#334155' : 'transparent',
                                                                        color: pause.type === pt.value ? '#f1f5f9' : '#64748b',
                                                                        fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                                                                        transition: 'all 0.15s'
                                                                    }}
                                                                >
                                                                    {pt.icon} {pt.label}
                                                                </button>
                                                            ));
                                                        })()}
                                                    </div>
                                                    <button onClick={() => removePause(pause.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                                        <Trash2 size={16} color="#ef4444" style={{ opacity: 0.7 }} />
                                                    </button>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                    <TimeInput value={pause.start} onChange={v => updatePause(pause.id, { start: v })} placeholder="Début" />
                                                    <TimeInput value={pause.end} onChange={v => updatePause(pause.id, { end: v })} placeholder="Fin" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Note Field */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <MessageSquare size={16} color="#64748b" />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Note / Commentaire</span>
                                </div>
                                <textarea
                                    value={local.note || ''}
                                    onChange={e => setLocal(p => ({ ...p, note: e.target.value }))}
                                    placeholder="Ajouter une note..."
                                    rows={2}
                                    style={{
                                        width: '100%', padding: '12px',
                                        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: '12px', color: '#cbd5e1',
                                        fontSize: '0.9rem', resize: 'none', outline: 'none',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                        </div>
                    )}

                    {/* Blank Spacer for scrolling */}
                    <div style={{ height: '80px' }} />

                </div>

                {/* Floating Footer Actions */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '16px 20px 24px',
                    background: 'linear-gradient(to top, #0f172a 85%, transparent 100%)',
                    display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px',
                    borderTop: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <button
                        onClick={handleClose}
                        style={{
                            padding: '16px', borderRadius: '16px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#94a3b8', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: '16px', borderRadius: '16px',
                            background: '#22d3ee',
                            color: '#0f172a',
                            fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(34,211,238,0.25)',
                            border: 'none'
                        }}
                    >
                        Enregistrer
                    </button>
                </div>
            </div>
        </>
    );
};

export default BottomSheet;
