
export const RATES = {
    DEA: 12.79, // Legacy/Fallback
    AUXILIAIRE: 12.02, // Legacy/Fallback
};

export const SALARY_GRID_2026 = {
    LEVEL_1: 12.04, // Niveau 1
    LEVEL_2: 12.16, // Niveau 2
    LEVEL_3: 12.79, // Niveau 3
};

export const MEAL_ALLOWANCES_2026 = {
    REPAS_UNIQUE: 9.59,  // Cas standard
    REPAS_DECALE: 15.54, // "Casse-croûte" / Indemnité de repas
};

export const BONUSES = {
    SUNDAY_HOLIDAY: 23.90, // Dimanche/Férié (Forfait ?) A vérifier si IDCC 16 change ça. On garde l'existant pour l'instant.
    MEAL_ALLOWANCE: 15.00, // Legacy
    IRU: 9.00, // Legacy
};

export const THRESHOLDS = {
    WEEKLY_HS: 35,
    FORTNIGHT_HS: 70,
    CYCLE_3Q_HS: 210, // 35h * 6 semaines
    FORTNIGHT_HS_50: 86,
    DAILY_REST_MIN: 11,
    MAX_AMPLITUDE: 12,
    BREAK_REPAS_MIN: 30,
    BREAK_SECURITAIRE_MIN: 20,
};

export const NET_RATIO = 0.78;
