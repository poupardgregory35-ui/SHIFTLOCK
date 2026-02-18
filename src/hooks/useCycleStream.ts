import { useMemo } from 'react';
import type { AppState, Period, DailyResult, DayShift, Role } from '../types';
import { calculateDaily, calculatePeriod } from '../utils/calculator';
import { PeriodService } from '../utils/PeriodService';

export interface StreamItem {
    date: string;
    shift: DayShift;
    result: DailyResult;
    periodId: string;
}

export interface StreamGroup {
    period: Period;
    stats: {
        totalTTE: number;
        overtime: number;
        goal: number;
        remaining: number;
    };
}

export function useCycleStream(state: AppState) {
    // 1. Générer toutes les périodes pour l'année (ou plus)
    // On utilise generateYear du service actuel
    const periods = useMemo(() => {
        return PeriodService.generateYear(state.rootDate, state.modeCalcul);
    }, [state.rootDate, state.modeCalcul]);

    // 2. Préparer les données pour GroupedVirtuoso
    const { flatItems, groupCounts, groups } = useMemo(() => {
        const flatItems: StreamItem[] = [];
        const groupCounts: number[] = [];
        const groups: StreamGroup[] = [];

        periods.forEach(period => {
            // Calculer les stats de la période
            const periodRes = calculatePeriod(period, state.shifts, state.role);

            // Objectif de cycle (35h, 70h ou 210h/contrat)
            // Note: Pour l'affichage "Cycle", on reste sur la logique 35/70/210 par défaut pour l'instant
            let cycleGoal = 35;
            if (state.modeCalcul === 14) cycleGoal = 70;
            if (state.modeCalcul === 42) cycleGoal = 210;

            groups.push({
                period,
                stats: {
                    totalTTE: periodRes.totalTTE,
                    overtime: periodRes.overtime,
                    goal: cycleGoal,
                    remaining: Math.max(0, cycleGoal - periodRes.totalTTE)
                }
            });

            // Ajouter les jours
            period.days.forEach(date => {
                const shift = state.shifts[date] || {
                    date,
                    start: '',
                    end: '',
                    breakRepas: 0,
                    breakSecuritaire: 0,
                    hasSundayBonus: false,
                    hasMealAllowance: false,
                    hasIRU: false,
                    isHoliday: false
                };

                // On recalcule le daily result ici ou on le récupère de periodRes
                // periodRes.dailyResults contient déjà tout
                const result = periodRes.dailyResults[date];

                flatItems.push({
                    date,
                    shift,
                    result,
                    periodId: period.id
                });
            });

            groupCounts.push(period.days.length);
        });

        return { flatItems, groupCounts, groups };
    }, [periods, state.shifts, state.role, state.modeCalcul]);

    return {
        flatItems,
        groupCounts,
        groups,
        // Helper pour retrouver l'index d'aujourd'hui (pour le "Jump to Today")
        todayIndex: flatItems.findIndex(item => item.date === new Date().toISOString().split('T')[0])
    };
}
