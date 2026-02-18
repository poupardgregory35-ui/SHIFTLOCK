
// --- CONFIGURATION UTILISATEUR ---
// Date de départ absolue (Le début de ta première quatorzaine de l'année)
// const ANCHOR_DATE = new Date('2026-01-19'); // Lundi 19 Janvier 2026

// --- UTILITAIRES DE DATE ---
const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const getMonthName = (date: Date): string => {
    return date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
};

export interface CycleDef {
    start: Date;
    end: Date;
    number: number;
}

export interface PayPeriodDef {
    id: string;
    title: string; // "PAIE FÉVRIER 2026"
    monthLabel: string; // "FÉVRIER 2026" (pour filtrage)
    totalWeeks: number;
    startDate: Date;
    endDate: Date;
    cycles: CycleDef[];
}

// --- LE CŒUR DU REACTEUR : GÉNÉRATEUR DE PERIODES DE PAIE ---
export const generatePayPeriods = (startDateStr: string, numberOfPeriods = 12): PayPeriodDef[] => {
    let periods: PayPeriodDef[] = [];
    let currentCycleStart = new Date(startDateStr);

    // On boucle pour générer mois par mois
    for (let i = 0; i < numberOfPeriods; i++) {
        let cyclesInThisPeriod: CycleDef[] = [];
        let targetMonth = -1;

        // On va accumuler des quatorzaines
        // Boucle interne pour constituer UNE période de paie
        while (true) {
            // Fin du cycle actuel (Dimanche, donc start + 13 jours)
            let cycleEnd = addDays(currentCycleStart, 13);

            let cycleEndMonth = cycleEnd.getMonth();

            // Initialisation du mois cible pour cette période si c'est le premier cycle qu'on examine
            if (cyclesInThisPeriod.length === 0) {
                targetMonth = cycleEndMonth;
            }

            // Si le cycle se termine dans le mois cible
            // OU si on est dans le cas particulier où le mois change mais la logique de paie l'inclut encore ?
            // La règle utilisateur : "Si le cycle finit <= 15 du mois M, il est pour la Paie M."
            // "Si le cycle finit le 01/02 -> Février".
            // "Si le cycle finit le 15/02 -> Février".
            // "Si le cycle finit le 01/03 -> Mars".

            // Dans le code fourni par l'utilisateur :
            // if (cycleEndMonth === targetMonth) { ... } else { break; }

            // Analysons le "bug" potentiel du code utilisateur si le mois suivant commence.
            // Exemple 19 Jan -> 01 Fév. Fin = 01 (Fév = mois 1 in JS). targetMonth (si basé sur fin) = 1.
            // Cycle suivant : 02 Fév -> 15 Fév. Fin = 15 (Fév). Month = 1. Match.
            // Cycle suivant : 16 Fév -> 01 Mars. Fin = 01 (Mars). Month = 2. No Match -> Break.

            // Cela semble fonctionner pour grouper par "Mois de Fin".
            // SAUF si une paie commence en fin de mois M et finit en M ??? 
            // Non, l'unité est la quatorzaine.

            if (cycleEndMonth === targetMonth) {
                cyclesInThisPeriod.push({
                    start: new Date(currentCycleStart),
                    end: cycleEnd,
                    number: cyclesInThisPeriod.length // index 0-based ou 1-based ? User code uses length+1 initially but cycle.number usage implies logic.
                });
                currentCycleStart = addDays(currentCycleStart, 14); // On avance de 2 semaines
            } else {
                // Le cycle appartient au mois suivant (ou à une autre période), on arrête pour cette période de paie.
                // On ne consomme PAS ce cycle, il sera traité à la prochaine itération de la boucle FOR (i)
                // car currentCycleStart n'a pas été incrémenté pour ce cycle sortant.
                break;
            }
        }

        // Nommage de la période (Ex: PAIE FÉVRIER)
        if (cyclesInThisPeriod.length > 0) {
            let lastCycleEnd = cyclesInThisPeriod[cyclesInThisPeriod.length - 1].end;
            const periodMonthName = getMonthName(lastCycleEnd);

            periods.push({
                id: `PERIODE_${i}`,
                title: `PAIE ${periodMonthName}`, // ex: PAIE FÉVRIER 2026
                monthLabel: periodMonthName,
                totalWeeks: cyclesInThisPeriod.length * 2, // 4 ou 6 semaines
                startDate: cyclesInThisPeriod[0].start,
                endDate: cyclesInThisPeriod[cyclesInThisPeriod.length - 1].end,
                cycles: cyclesInThisPeriod.map(c => ({ ...c, number: c.number + 1 })) // 1-based index for display
            });
        }
    }

    return periods;
};
