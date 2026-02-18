
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatDuration } from '../utils/calculator';
import type { DayShift, DailyResult } from '../types';
import { CheckCircle, AlertCircle, ChevronRight, Euro } from 'lucide-react';

interface DayRowProps {
    date: string;
    shift: DayShift;
    result: DailyResult;
    onClick: () => void;
    isToday?: boolean;
    employerShift?: Partial<DayShift>;
}

export default function DayRow({ date, shift, result, onClick, isToday, employerShift }: DayRowProps) {
    const dateObj = parseISO(date);
    const dayNumber = format(dateObj, 'dd');
    const dayName = format(dateObj, 'EEE', { locale: fr });
    const isWeekend = dayName === 'sam.' || dayName === 'dim.';

    const isWork = !!(shift.start && shift.end);
    const isHoliday = shift.isHoliday;

    // --- LOGIQUE "VS" ---
    let hasConflict = false;
    let delta = 0;
    let employerDuration = 0;

    if (employerShift && employerShift.start && employerShift.end) {
        const [sh, sm] = employerShift.start.split(':').map(Number);
        const [eh, em] = employerShift.end.split(':').map(Number);
        let endTotal = eh + em / 60;
        const startTotal = sh + sm / 60;
        if (endTotal < startTotal) endTotal += 24;
        employerDuration = endTotal - startTotal - ((employerShift.breakRepas || 0) / 60);

        const userTPP = result.tte;
        if (Math.abs(userTPP - employerDuration) > 0.05) {
            hasConflict = true;
            delta = employerDuration - userTPP;
        }
    }

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            role="button"
            className={`
          group relative flex items-center p-4 rounded-xl border transition-all cursor-pointer select-none z-10
          shadow-lg backdrop-blur-sm mb-3
          hover:scale-[1.02] active:scale-95 duration-200
          ${isToday ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#050505]' : ''}
          ${isWork
                    ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-800 hover:border-blue-500/50 hover:shadow-blue-900/20'
                    : isHoliday
                        ? 'bg-emerald-900/20 border-emerald-800/50 opacity-90'
                        : 'bg-slate-900/40 border-slate-800/50 opacity-60 hover:opacity-100 hover:bg-slate-800/60'}
        `}
        >
            {/* Barre Latérale Indicateur (Bleu si Travail, Vert si Congé, Rouge si Conflit) */}
            <div className={`
             absolute left-0 top-3 bottom-3 w-1 rounded-r-full transition-colors 
             ${hasConflict ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                    isWork ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' :
                        isHoliday ? 'bg-emerald-500' : 'bg-transparent'}
         `}></div>

            {/* Bloc Date (Gauche) - DESIGN FIGMA V3 */}
            <div className="flex flex-col items-center justify-center w-14 border-r border-white/10 mr-4 pr-2 pointer-events-none">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isWeekend ? 'text-orange-500' : 'text-slate-500'}`}>
                    {dayName}
                </span>
                <span className={`text-2xl font-black ${isWork || isHoliday ? 'text-white' : 'text-slate-600 group-hover:text-slate-400'}`}>
                    {dayNumber}
                </span>
            </div>

            {/* Bloc Info (Centre) */}
            <div className="flex-1 pointer-events-none">
                {isWork ? (
                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-white tracking-tight">{shift.start}</span>
                            <span className="text-slate-500 text-sm">➔</span>
                            <span className="text-xl font-bold text-white tracking-tight">{shift.end}</span>

                            {/* Badges de Réconciliation (VS) */}
                            {employerShift && (
                                hasConflict ? (
                                    <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                        ⚠️ {delta > 0 ? '+' : ''}{delta.toFixed(1)}H PDF
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                        MATCH PDF
                                    </span>
                                )
                            )}
                        </div>

                        {/* Badges (Heures / Argent) */}
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                                {formatDuration(result.tte)}
                            </span>
                            {result.indemnities > 0 && (
                                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                                    <Euro size={10} /> ~{result.indemnities.toFixed(2)}€
                                </span>
                            )}
                        </div>

                        {/* Détails VS discret si conflit */}
                        {hasConflict && (
                            <div className="mt-2 text-[10px] text-red-400 font-bold bg-red-500/5 p-1 rounded border border-red-500/10">
                                Saisie: {formatDuration(result.tte)} | Patron: {formatDuration(employerDuration)}
                            </div>
                        )}
                    </div>
                ) : isHoliday ? (
                    <div className="flex items-center h-full">
                        <span className="text-sm font-black text-emerald-400 uppercase tracking-[0.2em]">
                            Congé Payé
                        </span>
                    </div>
                ) : (
                    // État Repos
                    <div className="flex items-center h-full">
                        <span className="text-sm font-bold text-slate-600 tracking-[0.2em] uppercase group-hover:text-slate-400 transition-colors">
                            Repos
                        </span>
                    </div>
                )}
            </div>

            {/* Indicateur d'Action */}
            <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 text-slate-500">
                <ChevronRight size={18} />
            </div>
        </div>
    );
}
