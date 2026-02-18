
import {
  addDays,
  isMonday,
  format,
  parseISO,
  addWeeks,
  startOfWeek
} from 'date-fns';
import { fr } from 'date-fns/locale';

export interface Period {
  id: string;
  startDate: string; // ISO
  endDate: string; // ISO
  name: string; // ex: "Du 19/01 au 15/02"
  monthLabel: string; // Mois de rattachement (ex: "Janvier 2026")
  days: string[]; // Liste des dates ISO
  type: 7 | 14 | 42;
}

/**
 * Service pour gérer la règle "Fluid Cycles" :
 * 1. Indivisibilité : Un bloc appartient à un seul mois.
 * 2. Règle du Lundi : Le bloc est rattaché au mois calendaire de son 1er lundi.
 */
export const PeriodService = {

  /**
   * Trouve le mois de rattachement pour un bloc donné
   * @param startDate Date de début du bloc
   */
  getAttachmentMonth(startDate: string): string {
    const date = parseISO(startDate);
    // Le premier lundi définit le mois de rattachement
    const firstMonday = date;

    const monthStr = format(firstMonday, 'MMMM yyyy', { locale: fr });
    // Capitalize first letter
    return monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
  },

  /**
   * Génère une séquence de périodes pour une année à partir d'une date racine
   */
  generateYear(rootDate: string, mode: 7 | 14 | 42): Period[] {
    const periods: Period[] = [];
    let currentStart = parseISO(rootDate);

    if (!isMonday(currentStart)) {
      currentStart = startOfWeek(currentStart, { weekStartsOn: 1 });
    }

    const numWeeks = 54;
    let stepWeeks = 1;
    if (mode === 14) stepWeeks = 2;
    if (mode === 42) stepWeeks = 6;

    for (let i = 0; i < numWeeks; i += stepWeeks) {
      const periodStart = addWeeks(currentStart, i);
      const periodEnd = addDays(addWeeks(periodStart, stepWeeks), -1);

      const startISO = format(periodStart, 'yyyy-MM-dd');
      const endISO = format(periodEnd, 'yyyy-MM-dd');

      const days: string[] = [];
      const daysCount = mode;

      for (let d = 0; d < daysCount; d++) {
        days.push(format(addDays(periodStart, d), 'yyyy-MM-dd'));
      }

      periods.push({
        id: `${mode}-${startISO}`,
        startDate: startISO,
        endDate: endISO,
        name: `Du ${format(periodStart, 'dd/MM')} au ${format(periodEnd, 'dd/MM')}`,
        monthLabel: this.getAttachmentMonth(startISO),
        days,
        type: mode
      });
    }

    return periods;
  },

  /**
   * Filtre les périodes appartenant à un mois spécifique
   */
  getPeriodsForMonth(periods: Period[], monthLabel: string): Period[] {
    return periods.filter(p => p.monthLabel === monthLabel);
  }
};
