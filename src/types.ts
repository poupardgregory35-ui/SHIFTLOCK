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

// ─── MEAL_WINDOWS (requis par calculator.ts) ─────────────────────────────────

export const MEAL_WINDOWS = [
  { start: '11:00', end: '14:30', label: 'déjeuner' },
  { start: '18:30', end: '22:00', label: 'dîner' },
] as const;