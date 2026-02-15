
import type { DayShift, FortnightData, DailyResult, FortnightResult, PayrollEstimation } from '../types';
import { RATES, BONUSES, THRESHOLDS, NET_RATIO } from '../constants';
import { differenceInMinutes, parse, format, addDays, isSunday, parseISO } from 'date-fns';

export function formatDuration(decimalHours: number): string {
    if (isNaN(decimalHours)) return '0h00';
    const totalMinutes = Math.round(decimalHours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
}

export function parseSmartTime(input: string): string {
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
}

export function calculateDaily(shift: DayShift, role: 'DEA' | 'Auxiliaire', previousShift?: DayShift): DailyResult {
    if (!shift.start || !shift.end) {
        return { tte: 0, amplitude: 0, grossGain: 0, alerts: [] };
    }

    const startStr = parseSmartTime(shift.start);
    const endStr = parseSmartTime(shift.end);

    const start = parse(startStr, 'HH:mm', new Date());
    const end = parse(endStr, 'HH:mm', new Date());

    let diffMin = differenceInMinutes(end, start);
    if (diffMin < 0) diffMin += 24 * 60; // Handle overnight shift

    const amplitude = diffMin / 60;
    const pauseRepas = Number(shift.breakRepas) || 0;
    const pauseSecu = Number(shift.breakSecuritaire) || 0;
    const totalBreak = pauseRepas + pauseSecu;
    const tte = Math.max(0, (diffMin - totalBreak) / 60);

    let grossGain = tte * (role === 'DEA' ? RATES.DEA : RATES.AUXILIAIRE);

    if (shift.hasSundayBonus) grossGain += BONUSES.SUNDAY_HOLIDAY;
    if (shift.hasMealAllowance) grossGain += BONUSES.MEAL_ALLOWANCE;
    if (shift.hasIRU) grossGain += BONUSES.IRU;

    const alerts: DailyResult['alerts'] = [];

    if (amplitude > THRESHOLDS.MAX_AMPLITUDE) {
        alerts.push({ type: 'rose', message: `Amplitude : ${amplitude.toFixed(1)}h` });
    }

    if (previousShift && previousShift.end && shift.start) {
        const prevEnd = parse(parseSmartTime(previousShift.end), 'HH:mm', new Date());
        const currStart = parse(parseSmartTime(shift.start), 'HH:mm', new Date());
        let restMin = differenceInMinutes(currStart, prevEnd);
        if (restMin < 0) restMin += 24 * 60; // Handle overnight rest

        const restHrs = restMin / 60;
        if (restHrs < THRESHOLDS.DAILY_REST_MIN) {
            alerts.push({ type: 'rose', message: `Repos : ${restHrs.toFixed(1)}h` });
        }
    }

    // Break validation
    if (tte > 6) {
        if (shift.breakRepas < THRESHOLDS.BREAK_REPAS_MIN) {
            alerts.push({ type: 'orange', message: `Pause Repas < ${THRESHOLDS.BREAK_REPAS_MIN}m` });
        }
        if (shift.breakSecuritaire < THRESHOLDS.BREAK_SECURITAIRE_MIN) {
            alerts.push({ type: 'orange', message: `Pause Sécu < ${THRESHOLDS.BREAK_SECURITAIRE_MIN}m` });
        }
    }

    return { tte, amplitude, grossGain, alerts };
}

export function generateEmptyPeriod(startDate: string, numDays: number = 28): DayShift[] {
    const start = parseISO(startDate);
    return Array.from({ length: numDays }, (_, i) => {
        const date = addDays(start, i);
        return {
            date: format(date, 'yyyy-MM-dd'),
            start: '',
            end: '',
            breakRepas: 0,
            breakSecuritaire: 0,
            hasSundayBonus: isSunday(date),
            hasMealAllowance: false,
            hasIRU: false
        };
    });
}

export function calculatePeriod(data: FortnightData): FortnightResult {
    const dailyResults = data.days.map((day, i) => {
        const previous = i > 0 ? data.days[i - 1] : undefined;
        return calculateDaily(day, data.role, previous);
    });

    // Calculate each 14-day block independently for HS
    let totalTTE = 0;
    let totalOvertime = 0;
    let totalGrossBase = 0;

    for (let i = 0; i < dailyResults.length; i += 14) {
        const block = dailyResults.slice(i, i + 14);
        let runningTTE = 0;

        block.forEach(res => {
            runningTTE += (res.tte || 0);
            res.cumulativeHS = Math.max(0, runningTTE - THRESHOLDS.FORTNIGHT_HS);
        });

        const blockTTE = block.reduce((sum, res) => sum + (res.tte || 0), 0);
        const blockOvertime = Math.max(0, blockTTE - THRESHOLDS.FORTNIGHT_HS);

        totalTTE += blockTTE;
        totalOvertime += blockOvertime;
        totalGrossBase += block.reduce((sum, res) => sum + (res.grossGain || 0), 0);
    }

    const overtimeBonus = totalOvertime * (data.role === 'DEA' ? RATES.DEA : RATES.AUXILIAIRE) * 0.25;
    const totalGross = totalGrossBase + (overtimeBonus || 0);
    const estimatedNet = totalGross * NET_RATIO;

    return {
        totalTTE,
        overtime: totalOvertime,
        totalGross,
        estimatedNet,
        dailyResults
    };
}
export function calculateMonthlyEstimation(
    data: FortnightData,
    startDate: string,
    endDate: string
): PayrollEstimation {
    const rate = data.role === 'DEA' ? RATES.DEA : RATES.AUXILIAIRE;
    const baseSalary = 151.67 * rate;

    // Filter days within the user-defined period
    const periodDays = data.days.filter(d => d.date >= startDate && d.date <= endDate);

    // DYNAMIC SEGMENTATION: Split the period into 14-day blocks (fortnights)
    // This works for ANY period length: 14 days, 28 days, 35 days, etc.
    // Each block is calculated independently for overtime thresholds
    let totalTTE = 0;
    let totalOvertimeHours25 = 0;
    let totalOvertimeHours50 = 0;
    let totalAllowances = 0;
    const cycles: PayrollEstimation['cycles'] = [];

    // Process each 14-day block independently
    for (let i = 0; i < periodDays.length; i += 14) {
        const block = periodDays.slice(i, Math.min(i + 14, periodDays.length));
        const blockResults = block.map(day => calculateDaily(day, data.role));
        const blockTTE = blockResults.reduce((sum, r) => sum + (r.tte || 0), 0);

        totalTTE += blockTTE;

        let hs25 = 0;
        let hs50 = 0;

        // Apply thresholds ONLY within this 14-day block (sovereign calculation)
        // 70h threshold triggers 25% overtime
        // 86h threshold triggers 50% overtime
        if (blockTTE > THRESHOLDS.FORTNIGHT_HS_50) {
            hs50 = blockTTE - THRESHOLDS.FORTNIGHT_HS_50;
            hs25 = THRESHOLDS.FORTNIGHT_HS_50 - THRESHOLDS.FORTNIGHT_HS;
        } else if (blockTTE > THRESHOLDS.FORTNIGHT_HS) {
            hs25 = blockTTE - THRESHOLDS.FORTNIGHT_HS;
        }

        totalOvertimeHours25 += hs25;
        totalOvertimeHours50 += hs50;

        // Store cycle details for UI display
        cycles.push({ tte: blockTTE, hs25, hs50 });

        // Accumulate allowances across the entire period
        totalAllowances += block.reduce((sum, d) => {
            let acc = 0;
            if (d.hasSundayBonus) acc += BONUSES.SUNDAY_HOLIDAY;
            if (d.hasMealAllowance) acc += BONUSES.MEAL_ALLOWANCE;
            if (d.hasIRU) acc += BONUSES.IRU;
            return sum + acc;
        }, 0);
    }

    // Final aggregation: sum all overtime from all blocks
    const overtimePay = (totalOvertimeHours25 * rate * 1.25) + (totalOvertimeHours50 * rate * 1.50);
    const totalGross = baseSalary + overtimePay + totalAllowances;
    const estimatedNet = totalGross * NET_RATIO;

    return {
        totalTTE,
        baseSalary,
        overtimeHours25: totalOvertimeHours25,
        overtimeHours50: totalOvertimeHours50,
        overtimePay,
        totalAllowances,
        totalGross,
        estimatedNet,
        cycles
    };
}
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
