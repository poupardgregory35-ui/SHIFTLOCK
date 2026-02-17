
import React from 'react';
import { Moon, Coffee } from 'lucide-react';
import type { DayShift, DayResult } from '../types';
import { formatDuration } from '../utils/calculator';
import { ALLOWANCES } from '../types';

interface ShiftCardProps {
    shift: DayShift;
    result: DayResult;
    onClick: () => void;
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const STATUS_CONFIG: Record<string, { accent: string; bg: string; border: string }> = {
    TRAVAIL: { accent: '#22d3ee', bg: 'rgba(34,211,238,0.06)', border: 'rgba(34,211,238,0.2)' },
    REPOS: { accent: '#334155', bg: 'rgba(15,23,42,0.4)', border: 'rgba(51,65,85,0.4)' },
    CP: { accent: '#a78bfa', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.2)' },
    MALADIE: { accent: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.2)' },
    FORMATION: { accent: '#34d399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.2)' },
    FERIE: { accent: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.2)' },
    VIDE: { accent: '#1e293b', bg: 'transparent', border: 'rgba(30,41,59,0.8)' },
};

const STATUS_LABEL: Record<string, string> = {
    REPOS: 'Repos', CP: 'Congé payé', MALADIE: 'Arrêt maladie',
    FORMATION: 'Formation', FERIE: 'Jour férié',
};

const ShiftCard: React.FC<ShiftCardProps> = ({ shift, result, onClick }) => {
    const d = new Date(shift.date + 'T12:00:00');
    const dayName = DAYS[d.getDay()];
    const dayNum = d.getDate();
    const isToday = shift.date === new Date().toISOString().split('T')[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const cfg = STATUS_CONFIG[shift.status] || STATUS_CONFIG.VIDE;
    const isTravail = shift.status === 'TRAVAIL'; // Removed !!shift.start check to show empty slots as work if marked but no hours
    const hasHours = isTravail && !!shift.start;
    const isEmpty = shift.status === 'VIDE';

    // Helper to format allowances
    const hasIR = result.ir > 0;
    const hasIRU = result.iru > 0;
    const hasIS = result.isSpecial > 0;

    return (
        <button
            onClick={onClick}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'stretch', // Stretch to ensure border coverage
                gap: '0',
                minHeight: '72px', // Slightly taller for touch
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderLeft: `4px solid ${hasHours ? cfg.accent : (isTravail ? cfg.border : cfg.border)}`, // Valid Work gets accent
                borderRadius: '16px',
                marginBottom: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                padding: '0',
                overflow: 'hidden',
                position: 'relative',
                opacity: isEmpty ? 0.6 : 1, // Better visibility for empty
                transition: 'transform 0.1s, background 0.2s',
            }}
        >
            {/* ─── DATE BLOC ─── */}
            <div style={{
                width: '64px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: isToday ? 'rgba(34,211,238,0.1)' : 'rgba(0,0,0,0.2)',
                borderRight: `1px solid ${cfg.border}`,
            }}>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: isWeekend ? '#64748b' : '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '2px'
                }}>
                    {dayName}
                </span>
                <span style={{
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: isToday ? '#22d3ee' : '#f8fafc',
                    lineHeight: 1,
                }}>
                    {dayNum}
                </span>
            </div>

            {/* ─── CONTENU ─── */}
            <div style={{
                flex: 1,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minWidth: 0,
            }}>
                {hasHours ? (
                    <>
                        {/* Heures & Détails */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

                            {/* Ligne Heures */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                                        {shift.start}
                                    </span>
                                    <span style={{ margin: '0 4px', color: '#64748b' }}>-</span>
                                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                                        {shift.end}
                                    </span>
                                </div>
                                {result.isNightWork && (
                                    <div style={{ padding: '4px', borderRadius: '50%', background: 'rgba(129,140,248,0.15)' }}>
                                        <Moon size={12} color="#818cf8" />
                                    </div>
                                )}
                            </div>

                            {/* Ligne Badges (Pauses, IR, Panier) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {shift.pauses.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem', color: '#94a3b8' }}>
                                        <Coffee size={10} />
                                        <span>{shift.pauses.length}</span>
                                    </div>
                                )}

                                {/* Badges Indemnités */}
                                {(hasIR || hasIRU || hasIS) && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {hasIR && <Badge color="#34d399">IR</Badge>}
                                        {hasIRU && <Badge color="#a78bfa">IRU</Badge>}
                                        {hasIS && <Badge color="#fbbf24">IS</Badge>}
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* TTE à droite */}
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                            background: 'rgba(34,211,238,0.08)',
                            padding: '6px 10px', borderRadius: '10px',
                            border: '1px solid rgba(34,211,238,0.15)'
                        }}>
                            <span style={{ fontSize: '0.6rem', color: '#22d3ee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>TTE</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                                {formatDuration(result.tte).replace('h', 'h')}
                            </span>
                        </div>
                    </>
                ) : isEmpty ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.7 }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Saisir une vacation...</span>
                    </div>
                ) : (
                    // Statut non travaillé (Repos, CP...)
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.accent, boxShadow: `0 0 8px ${cfg.accent}` }} />
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
                            {STATUS_LABEL[shift.status] || shift.status}
                        </span>
                    </div>
                )}
            </div>
        </button>
    );
};

const Badge = ({ color, children }: { color: string, children: React.ReactNode }) => (
    <span style={{
        fontSize: '0.55rem', fontWeight: 800, color: color,
        border: `1px solid ${color}`, padding: '1px 4px', borderRadius: '4px',
        backgroundColor: `${color}10` // 10% opacity hex
    }}>
        {children}
    </span>
);

export default ShiftCard;
