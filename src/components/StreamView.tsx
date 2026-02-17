
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DayShift, UserProfile } from '../types';
import { PAY_PERIODS_2026, calculateDay, calculatePeriod, formatDuration, createEmptyShift, getMondayOfDate } from '../utils/calculator';
import ShiftCard from './ShiftCard';
import BottomSheet from './BottomSheet';

interface StreamViewProps {
    shifts: Record<string, DayShift>;
    profile: UserProfile;
    onUpdateShift: (date: string, updates: Partial<DayShift>) => void;
}

const today = new Date().toISOString().split('T')[0];

function getCurrentPayMonth(): string {
    // Find current period, default to Feb 2026 if not found (or current date out of range)
    const period = PAY_PERIODS_2026.find(p => today >= p.start && today <= p.end);
    return period ? period.payMonth : '2026-02';
}

const StreamView: React.FC<StreamViewProps> = ({ shifts, profile, onUpdateShift }) => {
    const [activeMonth, setActiveMonth] = useState<string>(() => getCurrentPayMonth());
    const [editingDate, setEditingDate] = useState<string | null>(null);

    const periodIdx = PAY_PERIODS_2026.findIndex(p => p.payMonth === activeMonth);
    const period = PAY_PERIODS_2026[periodIdx];
    const canPrev = periodIdx > 0;
    const canNext = periodIdx < PAY_PERIODS_2026.length - 1;

    // Generate date list for the period
    const periodDates = useMemo(() => {
        if (!period) return [];
        const dates: string[] = [];
        let c = new Date(period.start + 'T12:00:00'); // Noon to avoid DST issues
        const end = new Date(period.end + 'T12:00:00');
        while (c <= end) {
            dates.push(c.toISOString().split('T')[0]);
            c.setDate(c.getDate() + 1);
        }
        return dates;
    }, [period]);

    // Group by week (Monday start)
    const weekGroups = useMemo(() => {
        const groups: { monday: string; dates: string[] }[] = [];
        let currentGroup: { monday: string; dates: string[] } | null = null;

        for (const date of periodDates) {
            const monday = getMondayOfDate(date);
            if (!currentGroup || currentGroup.monday !== monday) {
                currentGroup = { monday, dates: [] };
                groups.push(currentGroup);
            }
            currentGroup.dates.push(date);
        }
        return groups;
    }, [periodDates]);

    // Calculate stats for the viewed period using the full calculation engine
    const stats = useMemo(() => {
        if (!period) return { tte: 0, hs25: 0, hs50: 0 };
        // We pass PAY_PERIODS_2026 formatted as cycles for the calculator
        const cycles = PAY_PERIODS_2026.map(p => ({ start: p.start, end: p.end }));
        const summary = calculatePeriod(shifts, activeMonth, profile, cycles);
        return {
            tte: summary.totalTTE,
            hs25: summary.totalHS25,
            hs50: summary.totalHS50
        };
    }, [period, shifts, activeMonth, profile]);


    const handlePrev = () => {
        if (canPrev) setActiveMonth(PAY_PERIODS_2026[periodIdx - 1].payMonth);
    };

    const handleNext = () => {
        if (canNext) setActiveMonth(PAY_PERIODS_2026[periodIdx + 1].payMonth);
    };

    if (!period) return <div style={{ padding: 20, color: 'white' }}>Période introuvable</div>;

    const startLabel = period.start.split('-').reverse().slice(0, 2).join('/');
    const endLabel = period.end.split('-').reverse().slice(0, 2).join('/');

    const editingShift = editingDate ? (shifts[editingDate] || createEmptyShift(editingDate)) : null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxWidth: '600px', // Slightly wider on tablets
            margin: '0 auto',
            width: '100%',
            background: 'var(--bg-root)'
        }}>

            {/* ─── HEADER PÉRIODE ─────────────────────────────────── */}
            <div style={{
                flexShrink: 0,
                padding: '16px 20px 0',
                background: 'var(--bg-card)', // defined in CSS
                borderBottom: '1px solid var(--border)',
                zIndex: 10,
                position: 'sticky', top: 0
            }}>
                {/* Navigation */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                }}>
                    <NavButton onClick={handlePrev} disabled={!canPrev} icon={<ChevronLeft size={24} />} />

                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.02em',
                            marginBottom: '4px'
                        }}>
                            {period.label}
                        </div>
                        <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 500
                        }}>
                            {startLabel} → {endLabel} · {weekGroups.length} semaines
                        </div>
                    </div>

                    <NavButton onClick={handleNext} disabled={!canNext} icon={<ChevronRight size={24} />} />
                </div>

                {/* Compteurs */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '12px',
                    paddingBottom: '20px',
                }}>
                    <StatCard label="TTE" value={formatDuration(stats.tte)} color="var(--accent-cyan)" active />
                    <StatCard label="HS 25%" value={formatDuration(stats.hs25)} color="var(--warning)" active={stats.hs25 > 0} />
                    <StatCard label="HS 50%" value={formatDuration(stats.hs50)} color="var(--danger)" active={stats.hs50 > 0} />
                </div>
            </div>

            {/* ─── LISTE JOURS ────────────────────────────────────── */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 20px 90px', // Bottom padding for nav bar
                WebkitOverflowScrolling: 'touch' as any,
            }}>
                {weekGroups.map((week, wIdx) => {
                    // Calculate week total TTE for display
                    const weekTotal = week.dates.reduce((acc, date) => {
                        const s = shifts[date];
                        if (!s || s.status !== 'TRAVAIL' || !s.start || !s.end) return acc;
                        return acc + calculateDay(s).tte;
                    }, 0);

                    const startDate = new Date(week.monday);

                    return (
                        <div key={week.monday} style={{ marginBottom: '24px' }}>
                            {/* Entête Semaine */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                marginBottom: '12px',
                                padding: '0 4px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                    <span style={{
                                        fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)',
                                        textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}>
                                        Semaine {wIdx + 1}
                                    </span>
                                    <span style={{ fontSize: '0.65rem', color: '#475569' }}>
                                        (du {startDate.getDate().toString().padStart(2, '0')})
                                    </span>
                                </div>

                                {weekTotal > 0 ? (
                                    <span style={{
                                        fontSize: '0.75rem', fontWeight: 700,
                                        color: weekTotal >= 35 * 60 ? '#f59e0b' : '#94a3b8',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}>
                                        Total: {formatDuration(weekTotal)}
                                    </span>
                                ) : null}
                            </div>

                            {/* Cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                        </div>
                    );
                })}

                {/* Spacer for bottom nav */}
                <div style={{ height: '40px' }} />
            </div>

            {/* ─── BOTTOM SHEET (Editor) ──────────────────────────── */}
            {editingDate && editingShift && (
                <BottomSheet
                    date={editingDate}
                    shift={editingShift}
                    onSave={(updatedShift) => {
                        onUpdateShift(editingDate, updatedShift);
                        // setEditingDate(null); // Keep open or close? Usually close on save if explicit save button
                        // BottomSheet in this app often auto-saves or has explicit close.
                        // Assuming BottomSheet calls onClose when done.
                    }}
                    onClose={() => setEditingDate(null)}
                />
            )}
        </div>
    );
};

// ─── SUBCOMPONENTS ────────────────────────────────────────────────────────────

const NavButton = ({ onClick, disabled, icon }: { onClick: () => void; disabled: boolean; icon: React.ReactNode }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            color: disabled ? '#334155' : '#e2e8f0',
            padding: '8px',
            cursor: disabled ? 'default' : 'pointer',
            transition: 'all 0.2s'
        }}
    >
        {icon}
    </button>
);

const StatCard = ({ label, value, color, active }: { label: string; value: string; color: string; active: boolean }) => (
    <div style={{
        background: active ? `${color}10` : 'rgba(255,255,255,0.02)', // Hex opacity trick
        border: `1px solid ${active ? `${color}30` : 'rgba(255,255,255,0.05)'}`,
        borderRadius: '12px',
        padding: '10px 8px',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: active ? 1 : 0.6
    }}>
        <div style={{
            fontSize: '0.65rem', fontWeight: 700, color: active ? color : '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px'
        }}>
            {label}
        </div>
        <div style={{
            fontSize: '1.1rem', fontWeight: 800, color: active ? '#f1f5f9' : '#475569',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1
        }}>
            {value}
        </div>
    </div>
);

export default StreamView;
