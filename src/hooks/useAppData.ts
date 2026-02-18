import { useState, useEffect, useCallback } from 'react';
import type { DayShift, UserProfile } from '../types';

const STORAGE_KEY = 'shiftlock_v3';

interface AppData {
  profile: UserProfile;
  shifts: Record<string, DayShift>;
}

const DEFAULT_PROFILE: UserProfile = {
  role: 'DEA',
  level: 'LEVEL_1',
  rootDate: '2026-01-19',
  modeCalcul: 'quatorzaine',
  contractHours: 35,
  baseRate: 12.04,
};

const DEFAULT_DATA: AppData = {
  profile: DEFAULT_PROFILE,
  shifts: {},
};

function emptyShift(date: string): DayShift {
  return {
    date, start: '', end: '',
    breakRepas: 0, breakSecuritaire: 0,
    hasSundayBonus: false, hasMealAllowance: false, hasIRU: false,
    status: 'VIDE', pauses: [],
  };
}

export function useAppData() {
  const [data, setData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_DATA, ...parsed,
          profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
          shifts: parsed.shifts || {},
        };
      }
    } catch (e) { console.error('Erreur chargement:', e); }
    return DEFAULT_DATA;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) { console.error('Erreur sauvegarde:', e); }
  }, [data]);

  const updateProfile = useCallback((profile: Partial<UserProfile>) => {
    setData(prev => ({ ...prev, profile: { ...prev.profile, ...profile } }));
  }, []);

  const updateShift = useCallback((date: string, updates: Partial<DayShift>) => {
    setData(prev => ({
      ...prev,
      shifts: { ...prev.shifts, [date]: { ...(prev.shifts[date] || emptyShift(date)), ...updates } },
    }));
  }, []);

  const importShifts = useCallback((newShifts: Record<string, Partial<DayShift>>) => {
    setData(prev => {
      const merged = { ...prev.shifts };
      for (const [date, shift] of Object.entries(newShifts)) {
        merged[date] = { ...(merged[date] || emptyShift(date)), ...shift };
      }
      return { ...prev, shifts: merged };
    });
  }, []);

  const resetAllData = useCallback(() => {
    setData(DEFAULT_DATA);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { data, updateProfile, updateShift, importShifts, resetAllData };
}
