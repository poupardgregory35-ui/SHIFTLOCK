import { useState, useEffect, useCallback } from 'react';
import type { AppData, DayShift, UserProfile } from '../types';
import { DEFAULT_PROFILE } from '../types';
import { createEmptyShift } from '../utils/calculator';

const STORAGE_KEY = 'shiftlock_v3';

const DEFAULT_DATA: AppData = {
  profile: DEFAULT_PROFILE,
  shifts: {},
};

export function useAppData() {
  const [data, setData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_DATA,
          ...parsed,
          profile: { ...DEFAULT_DATA.profile, ...(parsed.profile || {}) },
          shifts: parsed.shifts || {}
        };
      }
    } catch (e) {
      console.error('Erreur chargement données:', e);
    }
    return DEFAULT_DATA;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Erreur sauvegarde:', e);
    }
  }, [data]);

  const updateProfile = useCallback((profile: Partial<UserProfile>) => {
    setData(prev => ({ ...prev, profile: { ...prev.profile, ...profile } }));
  }, []);

  const updateShift = useCallback((date: string, updates: Partial<DayShift>) => {
    setData(prev => {
      const existing = prev.shifts[date] || createEmptyShift(date);
      return {
        ...prev,
        shifts: { ...prev.shifts, [date]: { ...existing, ...updates } },
      };
    });
  }, []);

  const deleteShift = useCallback((date: string) => {
    setData(prev => {
      const newShifts = { ...prev.shifts };
      delete newShifts[date];
      return { ...prev, shifts: newShifts };
    });
  }, []);

  const importShifts = useCallback((newShifts: Record<string, Partial<DayShift>>) => {
    setData(prev => {
      const merged = { ...prev.shifts };
      for (const [date, shift] of Object.entries(newShifts)) {
        merged[date] = { ...(merged[date] || createEmptyShift(date)), ...shift };
      }
      return { ...prev, shifts: merged };
    });
  }, []);

  const resetAllData = useCallback(() => {
    setData(DEFAULT_DATA);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    data,
    updateProfile,
    updateShift,
    deleteShift,
    importShifts,
    resetAllData,
  };
}
