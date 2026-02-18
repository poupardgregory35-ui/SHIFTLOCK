import { useState } from 'react';
import type { DayShift } from '../types';
import { parseSmartTime } from '../utils/calculator';
// On va importer dynamiquement le parser pour ne pas charger PDF.js tout de suite
// import { extractTextFromPDF, parseShiftsFromText } from '../features/HoursControl/utils/documentParser';

export interface Conflict {
    date: string;
    existing: DayShift;
    imported: Partial<DayShift>;
}

interface UseMagicImportProps {
    shifts: Record<string, DayShift>;
    updateShift: (date: string, updates: Partial<DayShift>) => void;
}

export function useMagicImport({ shifts, updateShift }: UseMagicImportProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [showConflictSolver, setShowConflictSolver] = useState(false);

    const processFile = async (file: File) => {
        setIsProcessing(true);
        setConflicts([]);

        try {
            // Dynamic import
            const { extractTextFromPDF, parseShiftsFromText } = await import('../features/HoursControl/utils/documentParser');

            const text = await extractTextFromPDF(file);
            const rawShifts = parseShiftsFromText(text);

            if (rawShifts.length === 0) {
                alert("Aucun planning détecté. Vérifiez que c'est bien un PDF lisible.");
                setIsProcessing(false);
                return;
            }

            const newConflicts: Conflict[] = [];
            const safeUpdates: Partial<DayShift>[] = [];

            rawShifts.forEach(raw => {
                const date = raw.date;
                const importedStart = raw.startTime;
                const importedEnd = raw.endTime;

                // Check existing
                const existing = shifts[date];
                const hasExistingData = existing && (existing.start || existing.end);

                // Si données existantes ET différentes
                if (hasExistingData) {
                    // Normalisation pour comparaison simple
                    const normExStart = parseSmartTime(existing.start);
                    const normExEnd = parseSmartTime(existing.end);
                    const normImpStart = parseSmartTime(importedStart);
                    const normImpEnd = parseSmartTime(importedEnd);

                    if (normExStart !== normImpStart || normExEnd !== normImpEnd) {
                        newConflicts.push({
                            date,
                            existing,
                            imported: {
                                date,
                                start: importedStart,
                                end: importedEnd,
                                breakRepas: 45, // Defaults
                                breakSecuritaire: 20
                            }
                        });
                    } else {
                        // Identique, on ignore ou on update pour être sûr (pas de conflit)
                    }
                } else {
                    // Pas de données, updates safe
                    safeUpdates.push({
                        date,
                        start: importedStart,
                        end: importedEnd,
                        breakRepas: 45,
                        breakSecuritaire: 20
                    });
                }
            });

            // 1. Appliquer les SAFE updates immédiatement
            safeUpdates.forEach(u => {
                if (u.date) updateShift(u.date, u);
            });

            // 2. Si conflits -> Ouvrir le Solver
            if (newConflicts.length > 0) {
                setConflicts(newConflicts);
                setShowConflictSolver(true);
            } else {
                alert(`${safeUpdates.length} jours importés sans aucun conflit ! 🚀`);
            }

        } catch (error) {
            console.error("Magic Import Error:", error);
            alert("Erreur critique lors de l'analyse du PDF.");
        } finally {
            setIsProcessing(false);
        }
    };

    const resolveConflict = (date: string, choice: 'keep' | 'overwrite') => {
        const conflict = conflicts.find(c => c.date === date);
        if (!conflict) return;

        if (choice === 'overwrite') {
            updateShift(date, conflict.imported);
        }

        // Retirer de la liste
        const remaining = conflicts.filter(c => c.date !== date);
        setConflicts(remaining);

        if (remaining.length === 0) {
            setShowConflictSolver(false);
            alert("Tous les conflits sont résolus !");
        }
    };

    const resolveAll = (choice: 'keep' | 'overwrite') => {
        if (choice === 'overwrite') {
            conflicts.forEach(c => updateShift(c.date, c.imported));
        }
        setConflicts([]);
        setShowConflictSolver(false);
        alert(choice === 'overwrite' ? "Tout écrasé avec le PDF." : "Anciennes données conservées.");
    };

    return {
        isProcessing,
        showConflictSolver,
        conflicts,
        processFile,
        resolveConflict,
        resolveAll,
        closeSolver: () => setShowConflictSolver(false)
    };
}
