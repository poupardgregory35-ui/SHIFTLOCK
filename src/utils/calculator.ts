import type { DayShift, DayResult, FortnightResult, UserProfile } from '../types';
import { ALLOWANCES, THRESHOLDS, MEAL_WINDOWS } from '../types';

// ─── CALENDRIER PAIE 2026 ─────────────────────────────────────────────────────

export const PAY_PERIODS_2026: Array<{ label: string; payMonth: string; start: string; end: string }> = [
  { label: 'Janvier 2026',   payMonth: '2026-01', start: '2025-12-29', end: '2026-01-18' },
  { label: 'Février 2026',   payMonth: '2026-02', start: '2026-01-19', end: '2026-02-15' },
  { label: 'Mars 2026',      payMonth: '2026-03', start: '2026-02-16', end: '2026-03-29' },
  { label: 'Avril 2026',     payMonth: '2026-04', start: '2026-03-30', end: '2026-04-26' },
  { label: 'Mai 2026',       payMonth: '2026-05', start: '2026-04-27', end: '2026-05-24' },
  { label: 'Juin 2026',      payMonth: '2026-06', start: '2026-05-25', end: '2026-06-28' },
  { label: 'Juillet 2026',   payMonth: '2026-07', start: '2026-06-29', end: '2026-07-26' },
  { label: 'Août 2026',      payMonth: '2026-08', start: '2026-07-27', end: '2026-08-23' },
  { label: 'Septembre 2026', payMonth: '2026-09', start: '2026-08-24', end: '2026-09-27' },
  { label: 'Octobre 2026',   payMonth: '2026-10', start: '2026-09-28', end: '2026-10-25' },
  { label: 'Novembre 2026',  payMonth: '2026-11', start: '2026-10-26', end: '2026-11-29' },
  { label: 'Décembre 2026',  payMonth: '2026-12', start: '2026-11-30', end: '2026-12-27' },
];

// ─── UTILS TEMPS ──────────────────────────────────────────────────────────────

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

export function parseQuickTime(input: string): string {
  const clean = input.replace(/[^0-9]/g, '');
  if (!clean) return '';
  if (clean.length === 1) return `0${clean}:00`;
  if (clean.length === 2) return `${clean}:00`;
  if (clean.length === 3) return `0${clean[0]}:${clean.slice(1)}`;
  if (clean.length >= 4) return `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
  return '';
}

export function getMondayOfDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export function createEmptyShift(date: string): DayShift {
  return { date, status: 'VIDE', pauses: [], isNight: false };
}

// ─── CALCUL JOURNÉE ───────────────────────────────────────────────────────────

function overlapWithMealWindows(ps: number, pe: number): number {
  let total = 0;
  for (const w of MEAL_WINDOWS) {
    const s = Math.max(ps, w.start);
    const e = Math.min(pe, w.end);
    if (e > s) total += e - s;
  }
  return total;
}

function calcAllowances(shift: DayShift, tte: number) {
  const zero = { ir: 0, iru: 0, isSpecial: 0 };
  if (!shift.start || !shift.end || tte === 0) return zero;

  const startMin = timeToMinutes(shift.start);
  let endMin = timeToMinutes(shift.end);
  if (endMin <= startMin) endMin += 24 * 60;

  if (endMin >= 21 * 60 + 30) return { ir: ALLOWANCES.IR, iru: 0, isSpecial: 0 };

  const extInWindow = shift.pauses.some(p =>
    p.type === 'EXTERIEUR' &&
    overlapWithMealWindows(timeToMinutes(p.start), timeToMinutes(p.end)) > 0
  );
  if (extInWindow) return { ir: ALLOWANCES.IR, iru: 0, isSpecial: 0 };

  const epPauses = shift.pauses.filter(p => p.type === 'ENTREPRISE');
  if (epPauses.length === 0) return { ir: ALLOWANCES.IR, iru: 0, isSpecial: 0 };

  let totalDur = 0, totalOverlap = 0;
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

export function calculateDay(shift: DayShift): DayResult {
  const base: DayResult = { tte: 0, amplitude: 0, ir: 0, iru: 0, isSpecial: 0 };
  if (shift.status !== 'TRAVAIL' || !shift.start || !shift.end) return base;

  const startMin = timeToMinutes(shift.start);
  let endMin = timeToMinutes(shift.end);
  if (endMin <= startMin) endMin += 24 * 60;

  const amplitude = endMin - startMin;
  const totalPauses = shift.pauses.reduce((acc, p) => {
    if (!p.start || !p.end) return acc;
    return acc + Math.max(0, timeToMinutes(p.end) - timeToMinutes(p.start));
  }, 0);
  const tte = Math.max(0, amplitude - totalPauses);

  return { ...base, amplitude, tte, ...calcAllowances(shift, tte) };
}

// ─── CALCUL QUATORZAINE ───────────────────────────────────────────────────────

export function calculateFortnight(
  shifts: Record<string, DayShift>,
  startDate: string,
  endDate: string
): FortnightResult {
  let totalTTE = 0;
  let c = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (c <= end) {
    const d = c.toISOString().split('T')[0];
    if (shifts[d]) totalTTE += calculateDay(shifts[d]).tte;
    c = new Date(c.getTime() + 86400000);
  }
  const hs25 = Math.max(0, Math.min(totalTTE, 86 * 60) - 70 * 60);
  const hs50 = Math.max(0, totalTTE - 86 * 60);
  return { totalTTE, hs25, hs50 };
}

export function generateAllCycles(rootDate: string): Array<{ start: string; end: string }> {
  return PAY_PERIODS_2026.map(p => ({ start: p.start, end: p.end }));
}
