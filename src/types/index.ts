
// ─── ROLES ───────────────────────────────────────────────────────────────────

export type Role = 'N1' | 'N2' | 'N3';
export type PauseType = 'ENTREPRISE' | 'EXTERIEUR' | 'DOMICILE';
export type DayStatus = 'TRAVAIL' | 'REPOS' | 'CP' | 'MALADIE' | 'FORMATION' | 'FERIE' | 'VIDE';
export type TabId = 'stream' | 'import' | 'profil';

// ─── STRUCTURES ──────────────────────────────────────────────────────────────

export interface Pause {
    id: string;
    start: string;   // "HH:MM"
    end: string;     // "HH:MM"
    type: PauseType;
}

export interface DayShift {
    date: string;        // "YYYY-MM-DD"
    status: DayStatus;
    start?: string;      // "HH:MM"
    end?: string;        // "HH:MM"
    pauses: Pause[];
    isNight: boolean;
    note?: string;
}

export interface DayResult {
    date: string;
    amplitude: number;   // minutes
    tte: number;         // minutes
    ir: number;
    iru: number;
    isSpecial: number;
    isFerie: boolean;
    isSunday: boolean;
    isNightWork: boolean;
}

export interface FortnightResult {
    startDate: string;
    endDate: string;
    totalTTE: number;
    hs25: number;        // minutes entre 70h et 86h
    hs50: number;        // minutes au-delà de 86h
    totalIR: number;
    totalIRU: number;
    totalIS: number;
}

export interface PeriodSummary {
    label: string;
    payMonth: string;    // "2026-03"
    startDate: string;
    endDate: string;
    fortnights: FortnightResult[];
    totalTTE: number;
    totalHS25: number;
    totalHS50: number;
    totalAllowances: number;
    grossSalary: number;
    estimatedNet: number;
}

export interface UserProfile {
    firstName: string;
    lastName: string;
    company: string;
    role: Role;
    rootDate: string;
    weeklyBase: number;
    moneyModeEnabled: boolean;
}

export interface AppData {
    profile: UserProfile;
    shifts: Record<string, DayShift>;
}
// ─── CONSTANTES ──────────────────────────────────────────────────────────────

export const HOURLY_RATES: Record<Role, number> = {
    N1: 12.04,
    N2: 12.16,
    N3: 12.79,
};

export const ALLOWANCES = {
    IR: 15.54,
    IR_REDUIT: 9.59,
    IS: 4.34,
};

export const THRESHOLDS = {
    HS25_MINUTES: 70 * 60,
    HS50_MINUTES: 86 * 60,
    NET_RATIO: 0.78,
    MONTHLY_BASE_HOURS: 151.67,
};

export const MEAL_WINDOWS = [
    { start: 11 * 60, end: 14 * 60 + 30 },
    { start: 18 * 60 + 30, end: 22 * 60 },
];

export const DEFAULT_PROFILE: UserProfile = {
    firstName: '',
    lastName: '',
    company: '',
    role: 'N3',
    rootDate: '2026-01-19',
    weeklyBase: 35,
    moneyModeEnabled: false,
};