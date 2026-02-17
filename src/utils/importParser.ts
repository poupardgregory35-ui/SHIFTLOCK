
import type { DayShift } from '../types';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ParseResult {
    shifts: Record<string, Partial<DayShift>>; // Changed to Partial<DayShift> for flexibility
    matched: number;
    total: number;
    errors: string[];
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function normalizeTime(raw: string): string {
    // Supprime "h", espace, etc.
    // Transforme "8h45" en "08:45"
    const clean = raw.replace(/h/i, ':').replace(/\s/g, '').trim();
    const match = clean.match(/^(\d{1,2}):(\d{2})$/);

    if (!match) return '';

    const h = String(parseInt(match[1])).padStart(2, '0');
    const m = String(parseInt(match[2])).padStart(2, '0');

    if (parseInt(h) > 23 || parseInt(m) > 59) return '';

    return `${h}:${m}`;
}

function parseFrDate(dateStr: string): string | null {
    // DD/MM/YYYY -> YYYY-MM-DD
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return null;
    const d = String(match[1]).padStart(2, '0');
    const m = String(match[2]).padStart(2, '0');
    return `${match[3]}-${m}-${d}`;
}

// ─── PDF.JS LOADER ────────────────────────────────────────────────────────────

// Extend Window interface for Typescript
declare global { interface Window { pdfjsLib: any } }

export async function loadPDFjs(): Promise<boolean> {
    if (window.pdfjsLib) return true;

    return new Promise((resolve) => {
        const script = document.createElement('script');
        // Using a reliable CDN for PDF.js
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(true);
            } else {
                console.error("PDF.js loaded but window.pdfjsLib is missing");
                resolve(false);
            }
        };
        script.onerror = () => {
            console.error("Failed to load PDF.js script");
            resolve(false);
        }
        document.head.appendChild(script);
    });
}

// ─── EXTRACTION TEXTE ────────────────────────────────────────────────────────

async function extractTextFromPDF(file: File): Promise<string[]> {
    if (!window.pdfjsLib) throw new Error('PDF.js non chargé');

    try {
        const buffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        const lines: string[] = [];

        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const textContent = await page.getTextContent();

            // Grouper les items par position Y pour reconstruire les lignes
            // car PDF.js retourne des items individuels
            const itemsByY: Record<number, string[]> = {};

            for (const item of textContent.items) {
                // item has 'str' and 'transform' (matrix), transform[5] is Y position
                if (!('str' in item) || !(item as any).str.trim()) continue;

                // Round Y to group items on same line (approx)
                const y = Math.round((item as any).transform[5]);

                if (!itemsByY[y]) itemsByY[y] = [];
                itemsByY[y].push((item as any).str);
            }

            // Trier par Y décroissant (haut en bas)
            const sortedYs = Object.keys(itemsByY).map(Number).sort((a, b) => b - a);

            for (const y of sortedYs) {
                // Join parts with space
                const line = itemsByY[y].join(' ').trim();
                if (line) lines.push(line);
            }
        }
        return lines;

    } catch (err) {
        console.error("Error reading PDF:", err);
        throw err;
    }
}

// ─── PARSER DÉCOMPTE AMBULANCIER (Logique Spécifique) ────────────────────────
// Ce parser tente de lire des lignes type tableau horaire.
// Format typique espéré : DATE  |  JOUR  |  SERVICE  |  DEBUT  |  FIN  |  ...

// Mots clés à ignorer si la ligne ne contient pas de données utiles
const SKIP_PATTERNS = [
    'DÉCOMPTE', 'Heures', 'Total', 'Semaine', 'Période', 'Salarié',
    'Cumul', 'Page', 'Date', 'Libellé', 'Pause', 'Amplitude',
    'Coef', 'T.T.E', 'Panier', 'Repas', 'Nuit', 'Dim'
];

export async function parsePDFDecompte(file: File): Promise<ParseResult> {
    const result: Record<string, Partial<DayShift>> = {};
    const errors: string[] = [];
    let lines: string[] = [];
    let totalDateLines = 0;

    try {
        // 1. Charger la lib si besoin
        const loaded = await loadPDFjs();
        if (!loaded) throw new Error("Impossible de charger le moteur PDF");

        // 2. Extraire le texte brut ligne par ligne
        lines = await extractTextFromPDF(file);

    } catch (e: any) {
        return { shifts: {}, matched: 0, total: 0, errors: [e.message || "Erreur lecture PDF"] };
    }

    // 3. Analyser chaque ligne
    for (const line of lines) {

        // Filtre simple : Doit contenir une date DD/MM
        const dateMatchResult = line.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (!dateMatchResult) continue;

        // Si on trouve une date, c'est potentiellement une ligne de données

        // Reconstruire la date ISO
        const day = dateMatchResult[1].padStart(2, '0');
        const month = dateMatchResult[2].padStart(2, '0');
        const yearStr = dateMatchResult[3];
        const year = yearStr.length === 2 ? `20${yearStr}` : yearStr; // Assume 20xx
        const dateStr = `${year}-${month}-${day}`;

        // Ignorer si la date est invalide
        if (isNaN(new Date(dateStr).getTime())) continue;

        totalDateLines++;

        // Détection de statut
        let status = 'TRAVAIL'; // Default
        if (line.match(/repos/i) || line.match(/rh/i)) status = 'REPOS';
        else if (line.match(/conges| congés | cp /i)) status = 'CP';
        else if (line.match(/maladie|arret/i)) status = 'MALADIE';
        else if (line.match(/formation/i)) status = 'FORMATION';
        else if (line.match(/ferie|férié/i)) status = 'FERIE';

        // Extraction des horaires (HH:MM ou HHHMM ou HHhMM)
        // On cherche toutes les séquences qui ressemblent à une heure
        const timeMatches = line.match(/\b(?:\d{1,2}[:h]\d{2}|\d{4})\b/g) || [];

        // Nettoyer et normaliser les horaires trouvés
        const times = timeMatches
            .map(t => normalizeTime(t.replace(':', ':'))) // normalizeTime handle h -> :
            .filter(t => t.length === 5); // Keep only valid HH:MM

        // Logique d'attribution (Heuristique simple)
        // Si on a [Start, End], c'est simple.
        // Si on a [Start, PauseStart, PauseEnd, End], on gère une pause.

        let start = '';
        let end = '';
        const pauses = [];
        let isNight = false;

        if (status === 'TRAVAIL' && times.length >= 2) {
            start = times[0];

            // Si 4 temps -> Start, P_Start, P_End, End
            if (times.length >= 4) {
                pauses.push({
                    id: `import_${dateStr}_1`,
                    start: times[1],
                    end: times[2],
                    type: 'ENTREPRISE' as const
                });
                end = times[times.length - 1]; // Take the last one as end
            } else {
                // Sinon juste Start/End (le reste est ignoré ou c'est [Start, End])
                end = times[times.length - 1];
            }

            // Night shift detection?
            // Simple check: if End < Start, likely night.
            // BUT be careful with parsing order. 
            const sm = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
            const em = parseInt(end.split(':')[0]) * 60 + parseInt(end.split(':')[1]);

            if (em < sm) isNight = true;

        } else if (status === 'TRAVAIL' && times.length < 2) {
            // Pas assez d'horaires pour du travail -> peut-être une erreur de parsing ou jour vide
            // On garde le status mais sans horaires
        }

        // Ajout au résultat
        result[dateStr] = {
            date: dateStr,
            status: status as any,
            start,
            end,
            pauses,
            isNight
        };
    }

    return {
        shifts: result,
        matched: Object.keys(result).length,
        total: totalDateLines,
        errors,
    };
}
