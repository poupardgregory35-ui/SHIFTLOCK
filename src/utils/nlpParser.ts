
import { DayShift, DayStatus, Pause, PauseType } from '../types';

interface ParsedShift {
    status: DayStatus;
    start?: string;
    end?: string;
    pauses: Partial<Pause>[];
    isNight: boolean;
    needsLocationSelection: string[]; // IDs of pauses that need location
}

const mealForceKeywords = [
    "pas eu le temps de manger",
    "pas le temps de manger",
    "c'était chargé",
    "c'était la merde",
    "trop de boulot",
    "pas pu manger",
    "pas mangé"
];

function normalizeTime(h: string, m?: string): string {
    const hours = h.padStart(2, '0');
    const minutes = (m || '00').padStart(2, '0');
    return `${hours}:${minutes}`;
}

export function parseVocalShift(text: string): ParsedShift {
    const normalized = text.toLowerCase();
    const result: ParsedShift = {
        status: 'TRAVAIL',
        pauses: [],
        isNight: false,
        needsLocationSelection: []
    };

    // 1. Detect Times (Start/End)
    // Look for "commencé à XhY", "début à XhY", or just "Xh à Yh"
    const startMatch = normalized.match(/(?:commencé|début|embauché|prise de service)(?:\s+à)?\s+(\d{1,2})h(\d{1,2})?/);
    if (startMatch) {
        result.start = normalizeTime(startMatch[1], startMatch[2]);
    }

    const endMatch = normalized.match(/(?:fini|terminé|débauché|fin de service)(?:\s+à)?\s+(\d{1,2})h(\d{1,2})?/);
    if (endMatch) {
        result.end = normalizeTime(endMatch[1], endMatch[2]);
    }

    // If no explicit start/end keywords, look for "de Xh à Yh" as a fallback for the whole day if it's the only time range
    const rangeMatches = Array.from(normalized.matchAll(/(?:de\s+)?(\d{1,2})h(\d{1,2})?\s+(?:à|jusqu'à|et)\s+(\d{1,2})h(\d{1,2})?/g));

    if (!result.start && !result.end && rangeMatches.length === 1) {
        const m = rangeMatches[0];
        result.start = normalizeTime(m[1], m[2]);
        result.end = normalizeTime(m[3], m[4]);
    }

    // 2. Detect Pauses
    // Look for "pause de Xh à Yh", "coupure de Xh à Yh", etc.
    const pauseMatches = Array.from(normalized.matchAll(/(?:pause|coupure|arrêté|mangé)(?:\s+de)?\s+(\d{1,2})h(\d{1,2})?\s+(?:à|jusqu'à|au)\s+(\d{1,2})h(\d{1,2})?/g));

    const isForceMeal = mealForceKeywords.some(k => normalized.includes(k));

    pauseMatches.forEach((m, idx) => {
        const pStart = normalizeTime(m[1], m[2]);
        const pEnd = normalizeTime(m[3], m[4]);

        // Don't add if it's the same as the whole shift range detected above
        if (pStart === result.start && pEnd === result.end) return;

        const id = Math.random().toString(36).slice(2, 9);
        let type: PauseType = 'EXTERIEUR'; // Default
        let locationSet = false;

        const subtext = normalized.substring(Math.max(0, m.index! - 30), Math.min(normalized.length, m.index! + 30 + m[0].length));

        const isMeal = subtext.includes('repas') || subtext.includes('déjeuner') || subtext.includes('dîner') || subtext.includes('midi') || isForceMeal;

        // Detect Location
        if (subtext.includes('bureau') || subtext.includes('entreprise') || subtext.includes('dépôt') || subtext.includes('garage')) {
            type = 'ENTREPRISE';
            locationSet = true;
        } else if (subtext.includes('dehors') || subtext.includes('extérieur') || subtext.includes('resto') || subtext.includes('restaurant')) {
            type = 'EXTERIEUR';
            locationSet = true;
        } else if (subtext.includes('maison') || subtext.includes('chez moi') || subtext.includes('domicile')) {
            type = 'DOMICILE';
            locationSet = true;
        }

        // Timing heuristics for default types if not specified
        if (!locationSet && !isForceMeal) {
            const startMin = parseInt(m[1]) * 60 + (m[2] ? parseInt(m[2]) : 0);
            // Meal window: 11h30 - 14h00
            if (startMin >= 11 * 60 + 30 && startMin <= 14 * 60) {
                // Likely meal, but location unknown
                result.needsLocationSelection.push(id);
            } else {
                // Likely security pause
                type = 'EXTERIEUR';
            }
        } else if (!locationSet && isForceMeal) {
            result.needsLocationSelection.push(id);
        }

        result.pauses.push({
            id,
            start: pStart,
            end: pEnd,
            type,
            isMeal: isMeal || result.needsLocationSelection.includes(id)
        });
    });

    return result;
}
