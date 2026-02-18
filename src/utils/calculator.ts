
import type { DayShift, DayResult, FortnightResult, PeriodSummary, UserProfile } from '../types';
import { ALLOWANCES, HOURLY_RATES, THRESHOLDS, MEAL_WINDOWS } from '../types';

// ─── CALENDRIER DE PAIE 2026 (règle du lundi, validé métier) ─────────────────

export const PAY_PERIODS_2026: Array<{ label: string; payMonth: string; start: string; end: string }> = [
    { label: 'Janvier 2026', payMonth: '2026-01', start: '2025-12-29', end: '2026-01-18' },
    { label: 'Février 2026', payMonth: '2026-02', start: '2026-01-19', end: '2026-02-15' },
    { label: 'Mars 2026', payMonth: '2026-03', start: '2026-02-16', end: '2026-03-29' },
    { label: 'Avril 2026', payMonth: '2026-04', start: '2026-03-30', end: '2026-04-26' },
    { label: 'Mai 2026', payMonth: '2026-05', start: '2026-04-27', end: '2026-05-24' },
    { label: 'Juin 2026', payMonth: '2026-06', start: '2026-05-25', end: '2026-06-28' },
    { label: 'Juillet 2026', payMonth: '2026-07', start: '2026-06-29', end: '2026-07-26' },
    { label: 'Août 2026', payMonth: '2026-08', start: '2026-07-27', end: '2026-08-23' },
    { label: 'Septembre 2026', payMonth: '2026-09', start: '2026-08-24', end: '2026-09-27' },
    { label: 'Octobre 2026', payMonth: '2026-10', start: '2026-09-28', end: '2026-10-25' },
    { label: 'Novembre 2026', payMonth: '2026-11', start: '2026-10-26', end: '2026-11-29' },
    { label: 'Décembre 2026', payMonth: '2026-12', start: '2026-11-30', end: '2026-12-27' },
];

// ─── UTILS TEMPS ─────────────────────────────────────────────────────────────

export function timeToMinutes(time: string): number {
    if (!time || !time.includes(':')) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

export function formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return '0h00';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${String(m).padStart(2, '0')}`;
}

// Saisie rapide : "730"→"07:30", "1545"→"15:45", "8"→"08:00"
export function parseQuickTime(input: string): string {
    const clean = input.replace(/[^0-9]/g, '');
    if (!clean) return '';
    if (clean.length === 1) return `0${clean}:00`;
    if (clean.length === 2) return `${clean}:00`;
    if (clean.length === 3) return `0${clean[0]}:${clean.slice(1)}`;
    if (clean.length >= 4) return `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
    return '';
}

// ─── OVERLAP PLAGES REPAS ─────────────────────────────────────────────────────

function overlapWithMealWindows(psMin: number, peMin: number): number {
    let total = 0;
    for (const w of MEAL_WINDOWS) {
        const s = Math.max(psMin, w.start);
        const e = Math.min(peMin, w.end);
        if (e > s) total += e - s;
    }
    return total;
}

// ─── LOGIQUE IR/IRU ───────────────────────────────────────────────────────────

function calcAllowances(shift: DayShift, tte: number) {
    const zero = { ir: 0, iru: 0, isSpecial: 0 };
    if (!shift.start || !shift.end || tte === 0) return zero;

    const startMin = timeToMinutes(shift.start);
    let endMin = timeToMinutes(shift.end);
    if (endMin <= startMin) endMin += 24 * 60;

    // Règle 1 : Fin ≥ 21h30 → IR dîner
    if (endMin >= 21 * 60 + 30) return { ir: ALLOWANCES.IR, iru: 0, isSpecial: 0 };

    // Règle 2 : Nuit — ≥ 4h TTE entre 22h-7h → IRU nuit
    if (shift.isNight) {
        const nightOverlap = Math.max(0,
            Math.min(endMin, 7 * 60 + 24 * 60) - Math.max(startMin, 22 * 60)
        );
        if (nightOverlap >= 4 * 60) return { ir: 0, iru: ALLOWANCES.IR_REDUIT, isSpecial: 0 };
    }

    // Règle 3 : Pause EXTÉRIEUR dans plage → IR complet
    const extInWindow = shift.pauses.some(p => {
        if (p.type !== 'EXTERIEUR') return false;
        return overlapWithMealWindows(timeToMinutes(p.start), timeToMinutes(p.end)) > 0;
    });
    if (extInWindow) return { ir: ALLOWANCES.IR, iru: 0, isSpecial: 0 };

    // Règle 4 : Aucune pause ENTREPRISE → IR complet
    const epPauses = shift.pauses.filter(p => p.type === 'ENTREPRISE');
    if (epPauses.length === 0) return { ir: ALLOWANCES.IR, iru: 0, isSpecial: 0 };

    // Règle 5 : Calcul durée/overlap pause entreprise
    let totalDur = 0;
    let totalOverlap = 0;
    for (const p of epPauses) {
        const ps = timeToMinutes(p.start);
        const pe = timeToMinutes(p.end);
        totalDur += pe - ps;
        totalOverlap += overlapWithMealWindows(ps, pe);
    }

    if (totalDur < 60) return { ir: 0, iru: ALLOWANCES.IR_REDUIT, isSpecial: 0 };
    if (totalOverlap < 30) return { ir: 0, iru: ALLOWANCES.IR_REDUIT, isSpecial: 0 };
    if (totalOverlap < 60) return { ir: 0, iru: 0, isSpecial: ALLOWANCES.IS };
    return zero;
}

// ─── CALCUL JOURNÉE ──────────────────────────────────────────────────────────

export function calculateDay(shift: DayShift): DayResult {
    const base: DayResult = {
        date: shift.date,
        amplitude: 0, tte: 0, ir: 0, iru: 0, isSpecial: 0,
        isFerie: shift.status === 'FERIE',
        isSunday: new Date(shift.date + 'T12:00:00').getDay() === 0,
        isNightWork: shift.isNight,
    };
    if (shift.status !== 'TRAVAIL' || !shift.start || !shift.end) return base;

    const startMin = timeToMinutes(shift.start);
    let endMin = timeToMinutes(shift.end);
    if (endMin <= startMin) endMin += 24 * 60;

    const amplitude = endMin - startMin;
    const totalPauses = shift.pauses.reduce((acc, p) => {
        return acc + Math.max(0, timeToMinutes(p.end) - timeToMinutes(p.start));
    }, 0);
    const tte = Math.max(0, amplitude - totalPauses);

    return { ...base, amplitude, tte, ...calcAllowances(shift, tte) };
}

// ─── GÉNÉRATION CYCLES ────────────────────────────────────────────────────────

export function generateAllCycles(rootDate: string): Array<{ start: string; end: string }> {
    const cycles: Array<{ start: string; end: string }> = [];
    let cursor = new Date(rootDate);

    // Reculer au bon point de départ (avant jan 2026)
    const limitBack = new Date('2025-12-15');
    while (cursor > limitBack) cursor = new Date(cursor.getTime() - 14 * 86400000);
    while (cursor < limitBack) cursor = new Date(cursor.getTime() + 14 * 86400000);

    const limitFwd = new Date('2027-01-31');
    while (cursor < limitFwd) {
        const start = cursor.toISOString().split('T')[0];
        const endD = new Date(cursor.getTime() + 13 * 86400000);
        cycles.push({ start, end: endD.toISOString().split('T')[0] });
        cursor = new Date(cursor.getTime() + 14 * 86400000);
    }
    return cycles;
}

// ─── STRICT MONTH CLIPPING ────────────────────────────────────────────────────

export function getMondayOfDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
}

export function getPayMonthForDate(dateStr: string): string {
    const monday = getMondayOfDate(dateStr);
    const d = new Date(monday + 'T12:00:00');
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getAvailablePayMonths(cycles: Array<{ start: string; end: string }>): string[] {
    const months = new Set<string>();
    for (const cycle of cycles) {
        let c = new Date(cycle.start + 'T12:00:00');
        const end = new Date(cycle.end + 'T12:00:00');
        while (c <= end) {
            months.add(getPayMonthForDate(c.toISOString().split('T')[0]));
            c = new Date(c.getTime() + 7 * 86400000);
        }
    }
    return Array.from(months).sort();
}

function getPayPeriodBounds(
    payMonth: string,
    cycles: Array<{ start: string; end: string }>
): { start: string; end: string } | null {
    const dates: string[] = [];
    for (const cycle of cycles) {
        let c = new Date(cycle.start + 'T12:00:00');
        const end = new Date(cycle.end + 'T12:00:00');
        while (c <= end) {
            const d = c.toISOString().split('T')[0];
            if (getPayMonthForDate(d) === payMonth) dates.push(d);
            c = new Date(c.getTime() + 86400000);
        }
    }
    if (!dates.length) return null;
    dates.sort();
    return { start: dates[0], end: dates[dates.length - 1] };
}

// ─── CALCUL QUATORZAINE ──────────────────────────────────────────────────────

export function calculateFortnight(
    shifts: Record<string, DayShift>,
    startDate: string,
    endDate: string
): FortnightResult {
    let totalTTE = 0, totalIR = 0, totalIRU = 0, totalIS = 0;

    let c = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    while (c <= end) {
        const d = c.toISOString().split('T')[0];
        const shift = shifts[d];
        if (shift) {
            const r = calculateDay(shift);
            totalTTE += r.tte;
            totalIR += r.ir;
            totalIRU += r.iru;
            totalIS += r.isSpecial;
        }
        c = new Date(c.getTime() + 86400000);
    }

    const hs25 = Math.max(0, Math.min(totalTTE, THRESHOLDS.HS50_MINUTES) - THRESHOLDS.HS25_MINUTES);
    const hs50 = Math.max(0, totalTTE - THRESHOLDS.HS50_MINUTES);

    return { startDate, endDate, totalTTE, hs25, hs50, totalIR, totalIRU, totalIS };
}

// ─── CALCUL PÉRIODE DE PAIE ──────────────────────────────────────────────────

export function calculatePeriod(
    shifts: Record<string, DayShift>,
    payMonth: string,
    profile: UserProfile,
    cycles: Array<{ start: string; end: string }>
): PeriodSummary {
    const rate = HOURLY_RATES[profile.role];
    const bounds = getPayPeriodBounds(payMonth, cycles);

    if (!bounds) return emptyPeriod(payMonth);

    const relevantCycles = cycles.filter(c => c.start <= bounds.end && c.end >= bounds.start);
    const fortnights = relevantCycles.map(c =>
        calculateFortnight(shifts, c.start > bounds.start ? c.start : bounds.start,
            c.end < bounds.end ? c.end : bounds.end)
    );

    const totalTTE = fortnights.reduce((a, f) => a + f.totalTTE, 0);
    const totalHS25 = fortnights.reduce((a, f) => a + f.hs25, 0);
    const totalHS50 = fortnights.reduce((a, f) => a + f.hs50, 0);
    const totalAllowances = fortnights.reduce((a, f) => a + f.totalIR + f.totalIRU + f.totalIS, 0);

    const baseSalary = THRESHOLDS.MONTHLY_BASE_HOURS * rate;
    const hs25Pay = (totalHS25 / 60) * rate * 1.25;
    const hs50Pay = (totalHS50 / 60) * rate * 1.50;
    const grossSalary = baseSalary + hs25Pay + hs50Pay + totalAllowances;

    return {
        label: formatPayMonthLabel(payMonth),
        payMonth,
        startDate: bounds.start,
        endDate: bounds.end,
        fortnights,
        totalTTE,
        totalHS25,
        totalHS50,
        totalAllowances,
        grossSalary,
        estimatedNet: grossSalary * THRESHOLDS.NET_RATIO,
    };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export function formatPayMonthLabel(payMonth: string): string {
    const [year, month] = payMonth.split('-').map(Number);
    return `Paie de ${MONTHS_FR[month - 1]} ${year}`;
}

function emptyPeriod(payMonth: string): PeriodSummary {
    return {
        label: formatPayMonthLabel(payMonth), payMonth,
        startDate: '', endDate: '', fortnights: [],
        totalTTE: 0, totalHS25: 0, totalHS50: 0,
        totalAllowances: 0, grossSalary: 0, estimatedNet: 0,
    };
}

export function createEmptyShift(date: string): DayShift {
    return { date, status: 'VIDE', pauses: [], isNight: false };
}

export function getDatesInRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    let c = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    while (c <= end) {
        dates.push(c.toISOString().split('T')[0]);
        c = new Date(c.getTime() + 86400000);
    }
    return dates;
}
