import React, { useState, useEffect } from 'react';
import { X, Clock, Coffee, Wallet, Check } from 'lucide-react';

/* --- 1. LES CONSTANTES OFFICIELLES FÉVRIER 2026 --- */
// Note : Idéalement importer de constants.ts, mais on garde local pour respecter la demande "bloc autonome".
const RATES_2026: Record<number, number> = {
    1: 12.04,
    2: 12.16,
    3: 12.79
};

const MEALS_2026 = {
    UNIQUE: 9.59,
    SPECIAL: 15.54
};

interface ShiftEditorProps {
    isOpen: boolean;
    onClose: () => void;
    date: string;
    userLevel?: number; // 1, 2, 3
    initialShift?: any; // On typ any pour flexibilité ici, ou DayShift
    onSave: (data: any) => void;
}

const ShiftEditor = ({ isOpen, onClose, date, userLevel = 2, initialShift, onSave }: ShiftEditorProps) => {
    // États du formulaire
    // On initialise avec les valeurs existantes si présentes
    const [start, setStart] = useState(initialShift?.start || '');
    const [end, setEnd] = useState(initialShift?.end || '');

    // Gestion de la pause (défaut 30 si pas défini)
    const [breakDuration, setBreakDuration] = useState(initialShift?.breakRepas || 30);

    // Gestion des repas
    // Si isMealDecale est vrai -> Special = 1, Unique = 0
    // Sinon si hasMealAllowance -> Unique = 1
    const [mealUnique, setMealUnique] = useState(initialShift?.isMealDecale ? 0 : (initialShift?.hasMealAllowance ? 1 : 0));
    const [mealSpecial, setMealSpecial] = useState(initialShift?.isMealDecale ? 1 : 0);

    // États calculés
    const [totalHours, setTotalHours] = useState('0.00');
    const [estimatedEarnings, setEstimatedEarnings] = useState(0);

    // --- 2. LE MOTEUR DE CALCUL TEMPS RÉEL ---
    useEffect(() => {
        if (!start || !end) {
            setTotalHours('0.00');
            setEstimatedEarnings(0);
            return;
        }

        // A. Calcul du temps de travail effectif (TTE)
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);

        // Gestion fin lendemain (si fin < début)
        let endTotal = endH + endM / 60;
        const startTotal = startH + startM / 60;

        if (endTotal < startTotal) {
            endTotal += 24;
        }

        let duration = endTotal - startTotal;
        duration -= (breakDuration / 60); // Retrait de la pause

        if (duration < 0) duration = 0; // Sécurité
        setTotalHours(duration.toFixed(2));

        // B. Calcul Financier (Grille 2026)
        const hourlyRate = RATES_2026[userLevel] || RATES_2026[2];
        const salary = duration * hourlyRate;

        const indemnities = (mealUnique * MEALS_2026.UNIQUE) + (mealSpecial * MEALS_2026.SPECIAL);

        setEstimatedEarnings(salary + indemnities);

    }, [start, end, breakDuration, mealUnique, mealSpecial, userLevel]);

    const handleSave = () => {
        // Construction de l'objet update
        const updates = {
            start,
            end,
            breakRepas: breakDuration,
            hasMealAllowance: mealUnique === 1,
            isMealDecale: mealSpecial === 1,
            // Si on met un Repas Spécial, on active aussi techniquement l'indicateur de repas
            // mais notre logique métier donnera la priorité à isMealDecale
        };

        onSave(updates);
        onClose();
    };

    if (!isOpen) return null;

    return (
        // Overlay sombre fond
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex justify-center items-end md:items-center animate-in fade-in duration-300">

            {/* --- LE TIROIR (DRAWER) --- */}
            <div className="w-full max-w-md bg-slate-900 border-t border-slate-700 rounded-t-3xl md:rounded-3xl md:border p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">

                {/* Header du Tiroir */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1 capitalize">{date}</h2>
                        <div className="flex items-center gap-2 text-emerald-400 font-mono">
                            <Wallet size={16} />
                            <span className="font-bold text-lg">
                                ~{estimatedEarnings.toFixed(2)} €
                            </span>
                            <span className="text-xs text-slate-500 ml-1">(Brut + Indem.)</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* --- FORMULAIRE --- */}
                <div className="space-y-6">

                    {/* 1. HORAIRES (Start / End) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 focus-within:border-blue-500 transition-colors">
                            <label className="text-xs text-slate-400 uppercase font-bold block mb-2">Prise de service</label>
                            <input
                                type="time"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                                className="bg-transparent text-2xl font-bold text-white w-full focus:outline-none"
                            />
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 focus-within:border-blue-500 transition-colors">
                            <label className="text-xs text-slate-400 uppercase font-bold block mb-2">Fin de service</label>
                            <input
                                type="time"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                className="bg-transparent text-2xl font-bold text-white w-full focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* 2. PAUSE (Slider ou Boutons) */}
                    <div className="bg-slate-800/30 p-4 rounded-xl">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <Clock size={16} /> Pause (déduite)
                            </label>
                            <span className="text-white font-bold">{breakDuration} min</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="90" step="15"
                            value={breakDuration}
                            onChange={(e) => setBreakDuration(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-2">
                            <span>0</span>
                            <span>30 min</span>
                            <span>1h30</span>
                        </div>
                    </div>

                    {/* 3. INDEMNITÉS REPAS (Toggle) */}
                    <div>
                        <label className="text-xs text-slate-400 uppercase font-bold block mb-3">Indemnités Repas (IDCC 16)</label>
                        <div className="flex gap-3">
                            {/* Bouton Repas Unique */}
                            <button
                                onClick={() => {
                                    // Toggle Unique (désactive Special si activé)
                                    const newState = mealUnique ? 0 : 1;
                                    setMealUnique(newState);
                                    if (newState) setMealSpecial(0);
                                }}
                                className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${mealUnique
                                    ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
                                    }`}
                            >
                                <Coffee size={20} />
                                <span className="text-xs font-bold">Unique</span>
                                <span className="text-[10px] opacity-70">{MEALS_2026.UNIQUE}€</span>
                            </button>

                            {/* Bouton Repas Spécial */}
                            <button
                                onClick={() => {
                                    // Toggle Special (désactive Unique si activé)
                                    const newState = mealSpecial ? 0 : 1;
                                    setMealSpecial(newState);
                                    if (newState) setMealUnique(0);
                                }}
                                className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${mealSpecial
                                    ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
                                    }`}
                            >
                                <Wallet size={20} />
                                <span className="text-xs font-bold">Spécial</span>
                                <span className="text-[10px] opacity-70">{MEALS_2026.SPECIAL}€</span>
                            </button>
                        </div>
                    </div>

                    {/* BOUTON SAUVEGARDER */}
                    <button
                        onClick={handleSave}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-blue-900/20 flex justify-center items-center gap-2 mt-4 transition-all active:scale-[0.98]"
                    >
                        <Check size={20} />
                        Valider la journée ({totalHours}h)
                    </button>

                </div>
            </div>
        </div>
    );
};

export default ShiftEditor;
