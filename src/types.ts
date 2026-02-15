
export type Role = 'DEA' | 'Auxiliaire';

export interface DayShift {
    date: string;
    start: string; // HH:mm
    end: string; // HH:mm
    breakRepas: number;
    breakSecuritaire: number;
    hasSundayBonus: boolean;
    hasMealAllowance: boolean; // Indemnité Repas
    hasIRU: boolean; // IRU
}

export interface FortnightData {
    role: Role;
    baseRate: number;
    cycleStartDate: string;
    days: DayShift[];
}

export interface DailyResult {
    tte: number; // Decimal hours
    amplitude: number; // Decimal hours
    grossGain: number;
    alerts: {
        type: 'rose' | 'orange';
        message: string;
    }[];
    cumulativeHS?: number;
}

export interface FortnightResult {
    totalTTE: number;
    overtime: number;
    totalGross: number;
    estimatedNet: number;
    dailyResults: DailyResult[];
}

export interface PayrollEstimation {
    totalTTE: number;
    baseSalary: number;
    overtimeHours25: number;
    overtimeHours50: number;
    overtimePay: number;
    totalAllowances: number;
    totalGross: number;
    estimatedNet: number;
    cycles: {
        tte: number;
        hs25: number;
        hs50: number;
    }[];
}
