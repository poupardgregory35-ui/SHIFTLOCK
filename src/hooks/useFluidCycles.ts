import { useState, useEffect, useMemo } from 'react';
import type { AppState, DayShift, Role } from '../types';
import { PeriodService } from '../utils/PeriodService';

const STORAGE_KEY = 'shiftlock_fluid_v1';

const DEFAULT_STATE: AppState = {
    role: 'DEA',
    level: 'LEVEL_2', // Default to standard level
    baseRate: 12.79,
    rootDate: '2026-01-19', // Lundi racine par défaut
    modeCalcul: 14,
    contractHours: 152, // Standard mensuel par défaut
    shifts: {}
};

export function useFluidCycles() {
    const [state, setState] = useState<AppState>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Migration douce pour les anciens états
            return { ...DEFAULT_STATE, ...parsed };
        }
        return DEFAULT_STATE;
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);

    // Génération dynamique des périodes pour l'année
    const allPeriods = useMemo(() => {
        return PeriodService.generateYear(state.rootDate, state.modeCalcul);
    }, [state.rootDate, state.modeCalcul]);

    // Liste des mois disponibles (pour la navigation)
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        allPeriods.forEach(p => months.add(p.monthLabel));
        return Array.from(months);
    }, [allPeriods]);

    const updateShift = (date: string, updates: Partial<DayShift>) => {
        setState(prev => ({
            ...prev,
            shifts: {
                ...prev.shifts,
                [date]: {
                    ...(prev.shifts[date] || {
                        date,
                        start: '',
                        end: '',
                        breakRepas: 0,
                        breakSecuritaire: 0,
                        hasSundayBonus: false,
                        hasMealAllowance: false,
                        hasIRU: false,
                        isHoliday: false
                    }),
                    ...updates
                }
            }
        }));
    };

    const setRootDate = (date: string) => {
        setState(prev => ({ ...prev, rootDate: date }));
    };

    const setModeCalcul = (mode: 7 | 14 | 42) => {
        setState(prev => ({ ...prev, modeCalcul: mode }));
    };

    const setRole = (role: Role) => {
        setState(prev => ({ ...prev, role }));
    };

    const setLevel = (level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3') => {
        setState(prev => ({ ...prev, level }));
    };

    const setContractHours = (hours: number) => {
        setState(prev => ({ ...prev, contractHours: hours }));
    };

    const resetSettings = () => {
        if (window.confirm("Réinitialiser tous les réglages par défaut ?")) {
            setState(prev => ({
                ...DEFAULT_STATE,
                shifts: prev.shifts // On garde les shifts quand même !
            }));
        }
    };

    return {
        state,
        allPeriods,
        availableMonths,
        updateShift,
        setRootDate,
        setModeCalcul,
        setRole,
        setLevel,
        setContractHours,
        resetSettings
    };
}
