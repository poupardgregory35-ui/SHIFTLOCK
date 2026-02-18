

export type TabId = 'stream' | 'import' | 'profil';
export type Role = 'DEA' | 'Auxiliaire'; // Legacy
export type SalaryLevel = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';

export interface DayShift {
    date: string;
    start: string; // HH:mm
    end: string; // HH:mm
    breakRepas: number;
    breakSecuritaire: number;
    hasSundayBonus: boolean;
    hasMealAllowance: boolean; // Legacy
    hasIRU: boolean; // Legacy
    isHoliday?: boolean; // Congé
    status?: 'TRAVAIL' | 'REPOS' | 'VIDE' | 'OTHER';
    pauses?: { start: string; end: string }[];
    isMealDecale?: boolean; // Nouveau : Repas décalé/Casse-croûte (15.54€)
    employerVersion?: Partial<DayShift>; // Pour le mode "VS" (Comparaison PDF)
}

export interface Period {
    id: string;
    startDate: string;
    endDate: string;
    name: string;
    monthLabel: string;
    days: string[];
    type: 7 | 14 | 42;
}

export interface AppState {
    role: Role; // Keeping for legacy compatibility if needed
    level: SalaryLevel; // Nouveau : Niveau 2026
    baseRate: number; // Derived actually
    rootDate: string;
    modeCalcul: 7 | 14 | 42;
    contractHours: number;
    shifts: Record<string, DayShift>;
}

export interface DailyResult {
    tte: number;
    amplitude: number;
    grossGain: number; // Total brut estimé (Legacy)
    salary: number; // Base salaire (Brut)
    indemnities: number; // Indemnités (Net/Non-imposable)
    alerts: {
        type: 'rose' | 'orange';
        message: string;
    }[];
    cumulativeHS?: number;
}

export interface PeriodResult {
    period: Period;
    totalTTE: number;
    overtime: number;
    totalSalary: number; // Nouveau
    totalIndemnities: number; // Nouveau
    dailyResults: Record<string, DailyResult>;
}
