
import type { DayShift, DailyResult, Period, PeriodResult, SalaryLevel } from '../types';
import { RATES, BONUSES, THRESHOLDS, SALARY_GRID_2026, MEAL_ALLOWANCES_2026 } from '../constants';
import { differenceInMinutes, parse, format, addDays, isSunday, parseISO } from 'date-fns';
import { PeriodService } from './PeriodService';

export const PAY_PERIODS_2026 = [
    { payMonth: '2026-01', label: 'Janvier', start: '2025-12-29', end: '2026-01-25' },
    { payMonth: '2026-02', label: 'Février', start: '2026-01-26', end: '2026-02-22' },
    { payMonth: '2026-03', label: 'Mars', start: '2026-02-23', end: '2026-03-29' },
    { payMonth: '2026-04', label: 'Avril', start: '2026-03-30', end: '2026-04-26' },
    { payMonth: '2026-05', label: 'Mai', start: '2026-04-27', end: '2026-05-31' },
    { payMonth: '2026-06', label: 'Juin', start: '2026-06-01', end: '2026-06-28' },
    { payMonth: '2026-07', label: 'Juillet', start: '2026-06-29', end: '2026-07-26' },
    { payMonth: '2026-08', label: 'Août', start: '2026-07-27', end: '2026-08-30' },
    { payMonth: '2026-09', label: 'Septembre', start: '2026-08-31', end: '2026-09-27' },
    { payMonth: '2026-10', label: 'Octobre', start: '2026-09-28', end: '2026-10-25' },
    { payMonth: '2026-11', label: 'Novembre', start: '2026-10-26', end: '2026-11-29' },
    { payMonth: '2026-12', label: 'Décembre', start: '2026-11-30', end: '2026-12-27' },
];

export const generateAllCycles = (rootDate: string): Period[] => {
    // Default to 14 days (standard cycle)
    return PeriodService.generateYear(rootDate, 14);
};

export function formatDuration(decimalHours: number): string {
    if (isNaN(decimalHours)) return '0h00';
    const totalMinutes = Math.round(decimalHours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
}

export const parseSmartTime = (input: string): string => {
    if (!input) return '';
    // Handles '7', '14', '7:30', '7h30', '7h', '8.5', '1545' (4 digits)
    let val = input.trim().toLowerCase().replace('h', ':');

    // Handle 4-digit format: 1545 → 15:45
    if (/^\d{4}$/.test(val)) {
        const hours = val.substring(0, 2);
        const minutes = val.substring(2, 4);
        return `${hours}:${minutes}`;
    }

    if (val.includes('.') && !val.includes(':')) {
        const decimal = parseFloat(val);
        return formatDuration(decimal).replace('h', ':');
    }

    if (!val.includes(':')) {
        const num = parseInt(val);
        if (!isNaN(num) && num >= 0 && num <= 24) {
            val = `${num.toString().padStart(2, '0')}:00`;
        }
    } else {
        const [h, m] = val.split(':');
        val = `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
    }

    return val;
};

// Helper pour parser l'heure "HH:mm" -> minutes depuis minuit
const parseTime = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};


export const calculateDaily = (shift: DayShift, level: SalaryLevel = 'LEVEL_1'): DailyResult => {
    // 0. Si c'est un jour vide ou repos
    if (!shift.start || !shift.end) {
        return {
            tte: 0,
            amplitude: 0,
            grossGain: 0,
            salary: 0,
            indemnities: 0,
            alerts: []
        };
    }

    const startMin = parseTime(shift.start);
    const endMin = parseTime(shift.end);

    // Gestion nuit (si fin < début, on ajoute 24h)
    let durationMin = endMin - startMin;
    if (durationMin < 0) durationMin += 24 * 60;

    const amplitude = durationMin / 60;

    // Déduction pauses
    const effectiveWorkMin = durationMin - (shift.breakRepas || 0) - (shift.breakSecuritaire || 0);
    const tte = Math.max(0, effectiveWorkMin / 60);

    // Alertes
    const alerts: { type: 'rose' | 'orange'; message: string }[] = [];
    if (amplitude > THRESHOLDS.MAX_AMPLITUDE) {
        alerts.push({ type: 'orange', message: 'Amplitude > 12h' });
    }

    // --- CALCUL FINANCIER 2026 ---

    // 1. Salaire Base (Brut)
    // On récupère le taux selon le niveau
    const hourlyRate = SALARY_GRID_2026[level] || SALARY_GRID_2026.LEVEL_1;
    const salary = tte * hourlyRate;

    // 2. Indemnités (Net/Non-imposable)
    let indemnities = 0;

    // Si travaillé, on déclenche une indemnité repas
    if (tte > 0 && !shift.isHoliday) {
        if (shift.isMealDecale) {
            indemnities += MEAL_ALLOWANCES_2026.REPAS_DECALE;
        } else {
            indemnities += MEAL_ALLOWANCES_2026.REPAS_UNIQUE;
        }
    }

    return {
        tte,
        amplitude,
        grossGain: salary + indemnities, // Total estimé
        salary,
        indemnities,
        alerts
    };
};

export const calculatePeriod = (
    period: Period,
    shifts: Record<string, DayShift>,
    level: SalaryLevel = 'LEVEL_1'
): PeriodResult => {
    let totalTTE = 0;
    let totalSalary = 0;
    let totalIndemnities = 0;
    const dailyResults: Record<string, DailyResult> = {};

    period.days.forEach(date => {
        const shift = shifts[date] || {
            date, start: '', end: '', breakRepas: 0, breakSecuritaire: 0,
            hasSundayBonus: false, hasMealAllowance: false, hasIRU: false,
            isHoliday: false
        };
        const res = calculateDaily(shift, level);
        dailyResults[date] = res;
        totalTTE += res.tte;
        totalSalary += res.salary;
        totalIndemnities += res.indemnities;
    });

    let threshold = THRESHOLDS.WEEKLY_HS;
    if (period.type === 14) threshold = THRESHOLDS.FORTNIGHT_HS;
    if (period.type === 42) threshold = THRESHOLDS.CYCLE_3Q_HS;

    const overtime = Math.max(0, totalTTE - threshold);

    // Ajout de la majoration HS au salaire (Estimation +25%)
    // Taux majoration standard est souvent 25% pour les premières HS
    const overtimeBonus = overtime * ((SALARY_GRID_2026[level] || SALARY_GRID_2026.LEVEL_1) * 0.25);
    totalSalary += overtimeBonus;

    return {
        period,
        totalTTE,
        overtime,
        totalSalary,
        totalIndemnities,
        dailyResults
    };
};
export function parsePlanningText(text: string): Partial<DayShift>[] {
    const lines = text.split('\n');
    return lines.map(line => {
        const timeMatch = line.match(/(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)/);
        if (timeMatch) {
            return {
                start: parseSmartTime(timeMatch[1]),
                end: parseSmartTime(timeMatch[2]),
                breakRepas: 45, // Default assumption if not specified
                breakSecuritaire: 20
            };
        }
        return {};
    }).filter(p => p.start);
}
