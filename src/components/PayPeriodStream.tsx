
import React, { useState } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PayPeriodDef } from '../utils/cycleEngine';
import type { AppState, DayShift, DailyResult } from '../types';
import DayRow from './DayRow';
import ShiftEditor from './ShiftEditor';
import { AnimatePresence } from 'framer-motion';
import { calculateDaily } from '../utils/calculator';

interface PayPeriodStreamProps {
    period: PayPeriodDef;
    state: AppState;
    updateShift: (date: string, updates: Partial<DayShift>) => void;
    onNext?: () => void;
}

export default function PayPeriodStream({ period, state, updateShift, onNext }: PayPeriodStreamProps) {
    const [editingItem, setEditingItem] = useState<{ date: string; shift: DayShift; result: DailyResult } | null>(null);

    const getDaysInCycle = (start: Date, end: Date) => {
        const days: string[] = [];
        let current = new Date(start);
        while (current <= end) {
            days.push(current.toISOString().split('T')[0]);
            current = addDays(current, 1);
        }
        return days;
    };

    const totalPeriodTTE = React.useMemo(() => {
        let total = 0;
        period.cycles.forEach(cycle => {
            getDaysInCycle(cycle.start, cycle.end).forEach(dateIso => {
                const shift = state.shifts[dateIso];
                if (shift) {
                    const res = calculateDaily(shift, state.level);
                    total += res.tte;
                }
            });
        });
        return total;
    }, [period, state.shifts, state.level]);

    return (
        <div className="flex flex-col gap-6 pb-20 fade-in px-4">

            {/* HEADER PÉRIODE PREMIUM */}
            <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/10 border-l-4 border-blue-500 p-4 rounded-r-2xl mb-2 flex justify-between items-center">
                <div>
                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">Résumé de la Période</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{totalPeriodTTE.toFixed(1)}</span>
                        <span className="text-sm font-bold text-slate-500 uppercase">Heures Est.</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Objectif</span>
                    <span className="text-lg font-black text-white">{period.cycles.length * (state.modeCalcul === 14 ? 70 : 35)}h</span>
                </div>
            </div>

            {/* CYCLES */}
            <div className="space-y-10">
                {period.cycles.map((cycle, idx) => (
                    <div key={`${period.id}_c${cycle.number}`} className="relative">

                        {/* Barre de timeline continue */}
                        <div className="absolute left-[2.4rem] top-12 bottom-0 w-0.5 bg-slate-800 z-0"></div>

                        {/* Titre Quatorzaine discret & pro */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center z-10">
                                <span className="text-xs font-black text-white">{cycle.number}</span>
                            </div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Quatorzaine</h4>
                            <div className="flex-1 h-px bg-slate-800"></div>
                        </div>

                        <div className="flex flex-col gap-1">
                            {getDaysInCycle(cycle.start, cycle.end).map(dateIso => {
                                const shift = state.shifts[dateIso] || {
                                    date: dateIso, start: '', end: '', breakRepas: 0, breakSecuritaire: 0,
                                    hasSundayBonus: false, hasMealAllowance: false, hasIRU: false, isHoliday: false
                                };
                                const result = calculateDaily(shift, state.level);
                                const isToday = dateIso === new Date().toISOString().split('T')[0];

                                return (
                                    <DayRow
                                        key={dateIso}
                                        date={dateIso}
                                        shift={shift}
                                        result={result}
                                        isToday={isToday}
                                        employerShift={shift.employerVersion}
                                        onClick={() => setEditingItem({ date: dateIso, shift, result })}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* FOOTER PÉRIODE */}
            {onNext && (
                <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col items-center">
                    <button
                        onClick={onNext}
                        className="neon-button secondary w-full max-w-sm"
                    >
                        Période Suivante ➔
                    </button>
                </div>
            )}

            <AnimatePresence>
                {editingItem && (
                    <ShiftEditor
                        isOpen={true}
                        onClose={() => setEditingItem(null)}
                        date={format(parseISO(editingItem.date), 'EEEE d MMMM', { locale: fr })}
                        userLevel={state.level === 'LEVEL_1' ? 1 : state.level === 'LEVEL_2' ? 2 : 3}
                        initialShift={editingItem.shift}
                        onSave={(updates) => {
                            updateShift(editingItem.date, updates);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
