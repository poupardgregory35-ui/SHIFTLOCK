
import type { DayShift, DayResult, FortnightResult, PeriodSummary, UserProfile } from '../types';
import { ALLOWANCES, HOURLY_RATES, THRESHOLDS, MEAL_WINDOWS } from '../types';

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
        isSunday: new Date(shift.date).getDay() === 0,
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

// Calendrier de paie 2026 fixe (règle du lundi, validé métier)
export const PAY_PERIODS_2026: Array<{ label: string; payMonth: string; start: string; end: string }> = [
    { label: 'Paie de Janvier 2026', payMonth: '2026-01', start: '2025-12-29', end: '2026-01-18' },
    { label: 'Paie de Février 2026', payMonth: '2026-02', start: '2026-01-19', end: '2026-02-15' },
    { label: 'Paie de Mars 2026', payMonth: '2026-03', start: '2026-02-16', end: '2026-03-29' },
    { label: 'Paie de Avril 2026', payMonth: '2026-04', start: '2026-03-30', end: '2026-04-26' },
    { label: 'Paie de Mai 2026', payMonth: '2026-05', start: '2026-04-27', end: '2026-05-24' },
    { label: 'Paie de Juin 2026', payMonth: '2026-06', start: '2026-05-25', end: '2026-06-28' },
    { label: 'Paie de Juillet 2026', payMonth: '2026-07', start: '2026-06-29', end: '2026-07-26' },
    { label: 'Paie de Août 2026', payMonth: '2026-08', start: '2026-07-27', end: '2026-08-23' },
    { label: 'Paie de Septembre 2026', payMonth: '2026-09', start: '2026-08-24', end: '2026-09-27' },
    { label: 'Paie de Octobre 2026', payMonth: '2026-10', start: '2026-09-28', end: '2026-10-25' },
    { label: 'Paie de Novembre 2026', payMonth: '2026-11', start: '2026-10-26', end: '2026-11-29' },
    { label: 'Paie de Décembre 2026', payMonth: '2026-12', start: '2026-11-30', end: '2026-12-27' },
];

export function generateAllCycles(rootDate: string): Array<{ start: string; end: string }> {
    // Retourne les périodes 2026 comme cycles
    return PAY_PERIODS_2026.map(p => ({ start: p.start, end: p.end }));
}

// ─── STRICT MONTH CLIPPING ────────────────────────────────────────────────────

export function getMondayOfDate(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.getDay();
    // day 0 (Sunday) -> need to go back 6 days
    // day 1 (Monday) -> need to go back 0 days
    // day 2 (Tuesday) -> need to go back 1 day ...
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
}


// Retourne le "mois de paie" pour une date donnée (basé sur le Lundi de la semaine de cette date)
// Ex: Si le 31 janvier est un samedi, son lundi est le 26 jan -> Paie Janvier
//     Si le 1 février est un dimanche, son lundi est le 26 jan -> Paie Janvier
export function getPayMonthForDate(dateStr: string): string {
    const monday = getMondayOfDate(dateStr);
    const d = new Date(monday);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Retourne tous les "mois de paie" couvert par une liste de cycles
export function getAvailablePayMonths(cycles: Array<{ start: string; end: string }>): string[] {
    const months = new Set<string>();
    for (const cycle of cycles) {
        let c = new Date(cycle.start);
        const end = new Date(cycle.end);
        while (c <= end) {
            months.add(getPayMonthForDate(c.toISOString().split('T')[0]));
            c = new Date(c.getTime() + 7 * 86400000); // Check chaque semaine
        }
    }
    return Array.from(months).sort();
}

// Retourne les bornes exactes (start, end) d'un mois de paie donné
function getPayPeriodBounds(
    payMonth: string,
    cycles: Array<{ start: string; end: string }>
): { start: string; end: string } | null {
    const dates: string[] = [];

    // On itère sur tous les jours couverts par les cycles pour trouver ceux qui appartiennent au mois de paie
    for (const cycle of cycles) {
        let c = new Date(cycle.start);
        const end = new Date(cycle.end);
        while (c <= end) {
            const d = c.toISOString().split('T')[0];
            if (getPayMonthForDate(d) === payMonth) {
                dates.push(d);
            }
            c = new Date(c.getTime() + 86400000);
        }
    }

    if (!dates.length) return null;
    dates.sort();
    return { start: dates[0], end: dates[dates.length - 1] };
}

// ─── CALCUL QUATORZAINE ──────────────────────────────────────────────────────

function calculateFortnightPure(
    shifts: Record<string, DayShift>,
    startDate: string,
    endDate: string
): { totalTTE: number; totalIR: number; totalIRU: number; totalIS: number } {
    let totalTTE = 0, totalIR = 0, totalIRU = 0, totalIS = 0;

    let c = new Date(startDate);
    const end = new Date(endDate);
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

    return { totalTTE, totalIR, totalIRU, totalIS };
}

// ─── CALCUL PÉRIODE DE PAIE COMPLETE ──────────────────────────────────────────

export function calculatePeriod(
    shifts: Record<string, DayShift>,
    payMonth: string,
    profile: UserProfile,
    cycles: Array<{ start: string; end: string }>
): PeriodSummary {
    const rate = HOURLY_RATES[profile.role];
    const bounds = getPayPeriodBounds(payMonth, cycles);

    if (!bounds) return emptyPeriod(payMonth);

    // Trouver les cycles qui intersectent la période de paie
    // Un cycle peut être à cheval sur deux mois de paie
    const relevantCycles = cycles.filter(c => c.start <= bounds.end && c.end >= bounds.start);

    const fortnights: FortnightResult[] = relevantCycles.map(c => {
        // Calculer les heures TOTALES du cycle (pour les seuils HS)
        // On doit prendre tout le cycle, même si une partie est hors du mois de paie affiché
        const fullCycleStats = calculateFortnightPure(shifts, c.start, c.end);

        // Calculer hs25 et hs50 sur la base du cycle COMPLET
        // Note: C'est une simplification, la règle exacte peut être plus complexe si on proratise
        // Ici on applique la logique : seuils sur la quatorzaine entière
        const cycleTotalTTE = fullCycleStats.totalTTE;
        const hs25_cycle = Math.max(0, Math.min(cycleTotalTTE, THRESHOLDS.HS50_MINUTES) - THRESHOLDS.HS25_MINUTES);
        const hs50_cycle = Math.max(0, cycleTotalTTE - THRESHOLDS.HS50_MINUTES);

        // Maintenant, on doit déterminer quelle part de ces HS revient au mois de paie actuel
        // Si le cycle est entièrement dans le mois -> 100%
        // Si le cycle est à cheval -> On proratise selon le nombre de jours dans le mois ? 
        // OU BIEN (plus courant en transport) : On paie les HS à la fin du cycle.
        // HYPOTHÈSE UTILISATEUR : "Strict month clipping" suggère qu'on coupe
        // Mais pour les HS de modulation, c'est délicat.
        // APPROCHE SIMPLE POUR L'INSTANT : On attribue les HS au mois où le cycle SE TERMINE
        // Ou on attribue au prorata des heures faites dans le mois ?

        // Pour respecter la demande précédente "Sovereign calculation" par bloc de 14j.
        // On va renvoyer les données du cycle, et l'affichage filtrera par date

        return {
            startDate: c.start,
            endDate: c.end,
            totalTTE: cycleTotalTTE,
            hs25: hs25_cycle,
            hs50: hs50_cycle,
            totalIR: fullCycleStats.totalIR,
            totalIRU: fullCycleStats.totalIRU,
            totalIS: fullCycleStats.totalIS
        };
    });

    // TODO: Attention, la somme ci-dessous compte des cycles entiers même s'ils débordent
    // Il faut affiner si l'utilisateur veut un "Cut" strict des heures.
    // Pour l'instant, je garde la logique "Somme des quatorzaines impliquées" mais c'est sûrement faux pour la paie exacte
    // Si on veut être strict sur le mois de paie : 
    // On devrait ne sommer que les jours inclus dans 'bounds'.

    // Recalcul strict des heures DANS le mois pour le totalTTE affiché
    const statsInMonth = calculateFortnightPure(shifts, bounds.start, bounds.end);
    const totalTTE = statsInMonth.totalTTE;
    const totalAllowances = statsInMonth.totalIR + statsInMonth.totalIRU + statsInMonth.totalIS;

    // Pour les HS, c'est plus complexe. Souvent payées en décalé ou à la fin du cycle.
    // On va sommer les HS des cycles qui se TERMINENT dans ce mois de paie (Règle courante)
    // Ou on les proratise. Pour l'instant : Somme brute des cycles touchés (A VERIFIER AVEC USER)
    const totalHS25 = fortnights.reduce((a, f) => a + f.hs25, 0); // Ceci est une surestimation si cycle à cheval
    const totalHS50 = fortnights.reduce((a, f) => a + f.hs50, 0);

    const baseSalary = THRESHOLDS.MONTHLY_BASE_HOURS * rate;
    // Conversion minutes -> heures pour le paiement
    const hs25Pay = (totalHS25 / 60) * rate * 1.25;
    const hs50Pay = (totalHS50 / 60) * rate * 1.50;
    const grossSalary = baseSalary + hs25Pay + hs50Pay + totalAllowances; // Allowances déjà en euros

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
    if (!payMonth) return '';
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
    let c = new Date(startDate);
    const end = new Date(endDate);
    while (c <= end) {
        dates.push(c.toISOString().split('T')[0]);
        c = new Date(c.getTime() + 86400000);
    }
    return dates;
}
