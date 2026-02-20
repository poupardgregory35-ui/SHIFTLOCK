export type SalaryLevel = 1 | 2 | 3;
export type BreakType = 'entreprise' | 'exterieur' | 'domicile';
export type TabType = 'stream' | 'import' | 'profil';

export interface Break {
  id: string;
  start: string;
  end: string;
  type: BreakType;
}

export interface DayEntry {
  date: string;
  start?: string;
  end?: string;
  breaks: Break[];
  isNight: boolean;
  isFerie: boolean;
  note?: string;
}

export interface DayResult {
  date: string;
  amplitude: number;
  tte: number;
  breakTotal: number;
  ir: number;
  irType: 'complet' | 'reduit' | 'is' | 'diner' | 'iru_nuit' | 'none';
  isNightWork: boolean;
}

export interface QuatorzaineResult {
  index: number;
  startDate: string;
  endDate: string;
  tte: number;
  hs25: number;
  hs50: number;
}

export interface Profile {
  firstName: string;
  rootDate: string;
  level: SalaryLevel;
  moneyMode: boolean;
  showOnboarding: boolean;
}

export interface AppState {
  profile: Profile;
  days: Record<string, DayEntry>;
}

// ─── UserProfile (ShiftLock V3) ──────────────────────────────────────────────

export interface UserProfile {
  role: string;
  level: string;
  rootDate: string;
  prenom?: string;
  nomInitiale?: string;
  dateEmbauche?: string;
  heuresContrat?: number;
}

// ─── DayShift / FortnightResult (ShiftLock V3) ───────────────────────────────

export type ShiftStatus = 'TRAVAIL' | 'REPOS' | 'CP' | 'MALADIE' | 'FORMATION' | 'FERIE' | 'VIDE';
export type PauseType = 'ENTREPRISE' | 'EXTERIEUR' | 'DOMICILE';

export interface Pause {
  id: string;
  start: string;
  end: string;
  type: PauseType;
}

export interface DayShift {
  date: string;
  status: ShiftStatus;
  start?: string;
  end?: string;
  pauses: Pause[];
  isNight: boolean;
}

export interface FortnightResult {
  totalTTE: number;
  hs25: number;
  hs50: number;
}

// ─── CONSTANTES (requises par calculator.ts) ─────────────────────────────────

export const ALLOWANCES = {
  IR:        15.54,
  IR_REDUIT:  9.59,
  IS:         4.34,
} as const;

export const THRESHOLDS = {
  HS25_START: 70 * 60,   // 70h en minutes
  HS50_START: 86 * 60,   // 86h en minutes
} as const;

export const MEAL_WINDOWS: Array<{ start: number; end: number }> = [
  { start: 11 * 60 + 0,  end: 14 * 60 + 30 },  // 11h00 - 14h30
  { start: 18 * 60 + 30, end: 22 * 60 + 0  },  // 18h30 - 22h00
];