
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Share2, Check } from 'lucide-react';
import type { DayShift, UserProfile } from '../types';
import { PAY_PERIODS_2026, calculateDay, calculateFortnight, formatDuration, createEmptyShift, getMondayOfDate } from '../utils/calculator';
import { exportPlanning } from '../utils/exportPlanning';
import ShiftCard from './ShiftCard';
import BottomSheet from './BottomSheet';

interface StreamViewProps {
    shifts: Record<string, DayShift>;
    profile: UserProfile;
    cycles: Array<{ start: string; end: string }>;
    onUpdateShift: (date: string, updates: Partial<DayShift>) => void;
}

const today = new Date().toISOString().split('T')[0];

function getCurrentPayMonth(): string {
    const period = PAY_PERIODS_2026.find(p => today >= p.start && today <= p.end);
    return period?.payMonth || '2026-02';
}

export const StreamView: React.FC<StreamViewProps> = ({ shifts, profile, onUpdateShift }) => {
    const [activeMonth, setActiveMonth] = useState(getCurrentPayMonth);
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    const periodIdx = PAY_PERIODS_2026.findIndex(p => p.payMonth === activeMonth);
    const period = PAY_PERIODS_2026[periodIdx];
    const canPrev = periodIdx > 0;
    const canNext = periodIdx < PAY_PERIODS_2026.length - 1;

    // Toutes les dates de la période
    const periodDates = useMemo(() => {
        if (!period) return [];
        const dates: string[] = [];
        let c = new Date(period.start + 'T12:00:00');
        const end = new Date(period.end + 'T12:00:00');
        while (c <= end) {
            dates.push(c.toISOString().split('T')[0]);
            c = new Date(c.getTime() + 86400000);
        }
        return dates;
    }, [period]);

    // Grouper par semaine
    const weekGroups = useMemo(() => {
        const groups: Array<{ monday: string; dates: string[] }> = [];
        for (const date of periodDates) {
            const monday = getMondayOfDate(date);
            const existing = groups.find(g => g.monday === monday);
            if (existing) existing.dates.push(date);
            else groups.push({ monday, dates: [date] });
        }
        return groups;
    }, [periodDates]);

    // Stats période complète
    const stats = useMemo(() => {
        if (!period) return { tte: 0, hs25: 0, hs50: 0 };
        let tte = 0, hs25 = 0, hs50 = 0;

        // Calculer par quatorzaines dans la période
        let cursor = new Date(period.start + 'T12:00:00');
        const endDate = new Date(period.end + 'T12:00:00');

        while (cursor <= endDate) {
            const blockStart = cursor.toISOString().split('T')[0];
            const blockEndDate = new Date(cursor.getTime() + 13 * 86400000);
            const blockEnd = blockEndDate > endDate
                ? period.end
                : blockEndDate.toISOString().split('T')[0];

            const res = calculateFortnight(shifts, blockStart, blockEnd);
            tte += res.totalTTE;
            hs25 += res.hs25;
            hs50 += res.hs50;

            cursor = new Date(cursor.getTime() + 14 * 86400000);
        }

        return { tte, hs25, hs50 };
    }, [period, shifts]);

    const editingShift = editingDate
        ? (shifts[editingDate] || createEmptyShift(editingDate))
        : null;

    if (!period) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334155' }}>
            Aucune période disponible
        </div>
    );

    const startLabel = period.start.split('-').reverse().slice(0, 2).join('/');
    const endLabel = period.end.split('-').reverse().slice(0, 2).join('/');
    const nbWeeks = weekGroups.length;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxWidth: '430px',
            margin: '0 auto',
            width: '100%',
        }}>

            {/* ─── HEADER PÉRIODE ─────────────────────────────────── */}
            <div style={{
                flexShrink: 0,
                padding: '10px 16px 0',
                background: '#070d1a',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                zIndex: 10,
            }}>
                {/* Navigation */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                }}>
                    <button
                        onClick={() => canPrev && setActiveMonth(PAY_PERIODS_2026[periodIdx - 1].payMonth)}
                        style={{
                            background: 'none', border: 'none',
                            opacity: canPrev ? 1 : 0.15,
                            cursor: canPrev ? 'pointer' : 'default',
                            padding: '8px',
                            color: '#64748b',
                        }}
                    >
                        <ChevronLeft size={22} />
                    </button>

                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '1rem',
                            fontWeight: 900,
                            color: '#f1f5f9',
                            letterSpacing: '-0.01em',
                        }}>
                            {period.label}
                        </div>
                        <div style={{
                            fontSize: '0.65rem',
                            color: '#475569',
                            marginTop: '1px',
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {startLabel} → {endLabel} · {nbWeeks} sem.
                        </div>
                    </div>

                    <button
                        onClick={() => canNext && setActiveMonth(PAY_PERIODS_2026[periodIdx + 1].payMonth)}
                        style={{
                            background: 'none', border: 'none',
                            opacity: canNext ? 1 : 0.15,
                            cursor: canNext ? 'pointer' : 'default',
                            padding: '8px',
                            color: '#64748b',
                        }}
                    >
                        <ChevronRight size={22} />
                    </button>
                </div>

                {/* Bouton export */}
                <div style={{ paddingBottom: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={async () => {
                            setExporting(true);
                            await exportPlanning(activeMonth, shifts, 'csv');
                            setTimeout(() => setExporting(false), 1500);
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '20px',
                            background: exporting ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${exporting ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.08)'}`,
                            color: exporting ? '#22d3ee' : '#475569',
                            fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {exporting
                            ? <><Check size={12} /> Exporté !</>
                            : <><Share2 size={12} /> Exporter {period.label}</>
                        }
                    </button>
                </div>

                {/* Compteurs */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '6px',
                    paddingBottom: '10px',
                }}>
                    <Counter label="TTE" value={formatDuration(stats.tte)} color="#22d3ee" active />
                    <Counter label="HS 25%" value={formatDuration(stats.hs25)} color="#f59e0b" active={stats.hs25 > 0} />
                    <Counter label="HS 50%" value={formatDuration(stats.hs50)} color="#ef4444" active={stats.hs50 > 0} />
                </div>
            </div>

            {/* ─── LISTE JOURS ────────────────────────────────────── */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px 12px 90px',
                WebkitOverflowScrolling: 'touch' as any,
            }}>
                {weekGroups.map((week, wIdx) => {
                    const weekTTE = week.dates.reduce((acc, d) => {
                        const s = shifts[d] || createEmptyShift(d);
                        return acc + calculateDay(s).tte;
                    }, 0);

                    const wNum = wIdx + 1;

                    return (
                        <div key={week.monday} style={{ marginBottom: '16px' }}>
                            {/* Label semaine */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0 4px',
                                marginBottom: '6px',
                            }}>
                                <span style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    color: '#334155',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                }}>
                                    Semaine {wNum}
                                </span>
                                {weekTTE > 0 ? (
                                    <span style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        color: weekTTE >= 43 * 60 ? '#f59e0b' : '#22d3ee',
                                        background: weekTTE >= 43 * 60 ? 'rgba(245,158,11,0.1)' : 'rgba(34,211,238,0.08)',
                                        border: `1px solid ${weekTTE >= 43 * 60 ? 'rgba(245,158,11,0.2)' : 'rgba(34,211,238,0.15)'}`,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}>
                                        {formatDuration(weekTTE)}
                                    </span>
                                ) : (
                                    <span style={{ fontSize: '0.62rem', color: '#1e293b' }}>0h00</span>
                                )}
                            </div>

                            {/* Cards */}
                            {week.dates.map(date => {
                                const shift = shifts[date] || createEmptyShift(date);
                                const result = calculateDay(shift);
                                return (
                                    <ShiftCard
                                        key={date}
                                        shift={shift}
                                        result={result}
                                        onClick={() => setEditingDate(date)}
                                    />
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* ─── BOTTOM SHEET ───────────────────────────────────── */}
            {editingDate && editingShift && (
                <BottomSheet
                    date={editingDate}
                    shift={editingShift}
                    onSave={(updates) => onUpdateShift(editingDate, updates)}
                    onClose={() => setEditingDate(null)}
                />
            )}
        </div>
    );
};

const Counter = ({ label, value, color, active }: { label: string; value: string; color: string; active: boolean }) => (
    <div style={{
        background: active ? `${color}10` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${active ? `${color}25` : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '12px',
        padding: '8px 4px',
        textAlign: 'center',
        opacity: active ? 1 : 0.4,
    }}>
        <div style={{ fontSize: '0.55rem', fontWeight: 800, color: active ? color : '#475569', marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '1rem', fontWeight: 900, color: active ? '#f1f5f9' : '#334155', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
);

export default StreamView;
