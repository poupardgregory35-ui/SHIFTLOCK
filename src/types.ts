// ─── IDS & ENUMS ─────────────────────────────────────────────────────────────

export type TabId = 'stream' | 'import' | 'profil';
export type DayStatus = 'TRAVAIL' | 'REPOS' | 'CP' | 'MALADIE' | 'FORMATION' | 'FERIE' | 'VIDE';
export type PauseType = 'ENTREPRISE' | 'EXTERIEUR' | 'DOMICILE';

// ─── PAUSE ───────────────────────────────────────────────────────────────────

export interface Pause {
  id: string;
  start: string;
  end: string;
  type: PauseType;
}

// ─── DAY SHIFT ───────────────────────────────────────────────────────────────

export interface DayShift {
  date: string;
  status: DayStatus;
  start?: string;
  end?: string;
  pauses: Pause[];
  isNight?: boolean;
  note?: string;
}

// ─── RESULTS ─────────────────────────────────────────────────────────────────

export interface DayResult {
  tte: number;
  amplitude: number;
  ir: number;
  iru: number;
  isSpecial: number;
}

export interface FortnightResult {
  totalTTE: number;
  hs25: number;
  hs50: number;
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

export interface UserProfile {
  role: string;
  level: string;
  rootDate: string;
  modeCalcul: string;
  contractHours: number;
  baseRate: number;
}

export interface AppData {
  profile: UserProfile;
  shifts: Record<string, DayShift>;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

export const ALLOWANCES = {
  IR: 15.54,
  IR_REDUIT: 9.59,
  IS: 4.34,
};

export const HOURLY_RATES = {
  N1: 12.04,
  N2: 12.16,
  N3: 12.79,
};

export const THRESHOLDS = {
  WEEKLY_NORMAL: 35 * 60,
  WEEKLY_HS_25: 43 * 60,
  FORTNIGHT_NORMAL: 70 * 60,
  FORTNIGHT_HS_25: 86 * 60,
  NET_RATIO: 0.78,
};

export const MEAL_WINDOWS = [
  { start: 11 * 60 + 30, end: 14 * 60 },
  { start: 18 * 60 + 30, end: 22 * 60 },
];
