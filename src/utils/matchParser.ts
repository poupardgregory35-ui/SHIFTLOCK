import type { DayShift } from '../types';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface EmployerDay {
    date: string;        // YYYY-MM-DD
    status: 'AR' | 'RH' | 'OTHER';
    start?: string;      // HH:MM
    end?: string;        // HH:MM
    pauses: Array<{ start: string; end: string }>;
    tte?: string;        // raw string ex "09:45"
}

export interface MatchEcart {
    date: string;
    label: string;       // "Lun 20/01"
    ecarts: Array<{
        type: 'debut' | 'fin' | 'pause_manquante' | 'pause_employee' | 'statut' | 'tte';
        message: string;
        moi: string;
        employeur: string;
        severity: 'warn' | 'error';
    }>;
}

export interface MatchResult {
    ecarts: MatchEcart[];
    concordants: number;
    total: number;
    employerDays: EmployerDay[];
}

// ─── PDF.JS LOADER ───────────────────────────────────────────────────────────

declare global { interface Window { pdfjsLib: any } }

export async function loadPDFjs(): Promise<boolean> {
    if (window.pdfjsLib) return true;
    return new Promise(resolve => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(true);
            } else resolve(false);
        };
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

// ─── EXTRACTION TEXTE PDF ────────────────────────────────────────────────────

async function extractLines(file: File): Promise<string[]> {
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const lines: string[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const byY: Record<number, string[]> = {};
        for (const item of content.items) {
            if (!('str' in item) || !(item as any).str.trim()) continue;
            const y = Math.round((item as any).transform[5]);
            if (!byY[y]) byY[y] = [];
            byY[y].push((item as any).str.trim());
        }
        Object.keys(byY).map(Number).sort((a, b) => b - a)
            .forEach(y => {
                const line = byY[y].join(' ').trim();
                if (line) lines.push(line);
            });
    }
    return lines;
}

// ─── PARSER DÉCOMPTE EMPLOYEUR ───────────────────────────────────────────────
// Format: "20/01/2026 mar AR T3 07:15 11:25 12:25 18:00 10:45 100 09:45 ..."

function normalizeTime(raw: string): string {
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return '';
    return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function parseFrDate(raw: string): string | null {
    const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const DAY_NAMES_FR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
function getDayLabel(iso: string): string {
    const d = new Date(iso + 'T12:00:00');
    const day = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()];
    return `${day} ${iso.split('-').reverse().slice(0, 2).join('/')}`;
}

const SKIP = ['DECOMPTE', 'Salarié', 'Semaine', 'Prévu', 'Total', 'AR :', 'RH :', 'Signatures', 'Employeur', 'permis', 'atteste', 'Edité'];

export async function parseEmployerPDF(file: File): Promise<{ days: EmployerDay[]; error?: string }> {
    const lines = await extractLines(file);
    const days: EmployerDay[] = [];

    for (const line of lines) {
        if (SKIP.some(s => line.includes(s))) continue;

        const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (!dateMatch) continue;

        const iso = parseFrDate(dateMatch[1]);
        if (!iso) continue;

        // RH = Repos Hebdo
        if (/ RH /.test(line)) {
            days.push({ date: iso, status: 'RH', pauses: [] });
            continue;
        }

        // AR = Activité Réelle
        if (/ AR /.test(line)) {
            const times = (line.match(/\d{1,2}:\d{2}/g) || []).map(normalizeTime).filter(Boolean);
            if (times.length < 2) continue;

            // Structure: Heu.D  [Rep.D  Rep.F]  Heu.F  Ampl  100  TTE  ...
            // Dernière colonne = pauses au format "11:25 - 12:25 / 09:55 - 10:15"
            const start = times[0];

            // TTE est souvent l'avant-dernière heure significative avant les pauses
            // Heu.F = généralement times[3] si 4 heures avant pauses
            let end = '';
            let tte = '';

            if (times.length >= 4) {
                end = times[3];
            } else if (times.length === 3) {
                end = times[2];
            } else {
                end = times[1];
            }

            // Extraire TTE depuis le texte (pattern "09:45" après "100")
            const tteMatch = line.match(/100\s+(\d{1,2}:\d{2})/);
            if (tteMatch) tte = normalizeTime(tteMatch[1]);

            // Extraire les pauses depuis la partie droite de la ligne
            // Format: "11:25 - 12:25 / 09:55 - 10:15"
            const pauses: Array<{ start: string; end: string }> = [];
            const pauseSection = line.split(' 100 ').slice(1).join(' 100 ');
            const pauseRegex = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g;
            let pm;
            while ((pm = pauseRegex.exec(pauseSection)) !== null) {
                const ps = normalizeTime(pm[1]);
                const pe = normalizeTime(pm[2]);
                if (ps && pe) pauses.push({ start: ps, end: pe });
            }

            days.push({ date: iso, status: 'AR', start, end, pauses, tte });
            continue;
        }
    }

    return { days };
}

// ─── COMPARATEUR ─────────────────────────────────────────────────────────────

function timeToMin(t?: string): number {
    if (!t) return -1;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

const TOLERANCE = 5; // minutes de tolérance sur début/fin

export function matchShifts(
    myShifts: Record<string, DayShift>,
    employerDays: EmployerDay[]
): MatchResult {
    const ecarts: MatchEcart[] = [];
    let concordants = 0;
    let total = 0;

    for (const emp of employerDays) {
        // Ignorer jours vides (sam/dim sans données)
        if (emp.status === 'OTHER') continue;
        total++;

        const my = myShifts[emp.date];
        const dayEcarts: MatchEcart['ecarts'] = [];

        // ── Repos ──
        if (emp.status === 'RH') {
            if (my && my.status === 'TRAVAIL') {
                dayEcarts.push({
                    type: 'statut',
                    message: 'Jour déclaré REPOS par employeur, mais TRAVAIL dans ShiftLock',
                    moi: 'TRAVAIL',
                    employeur: 'REPOS',
                    severity: 'error',
                });
            }
            if (!dayEcarts.length) concordants++;
            else ecarts.push({ date: emp.date, label: getDayLabel(emp.date), ecarts: dayEcarts });
            continue;
        }

        // ── Activité Réelle ──
        if (!my || my.status === 'VIDE' || my.status === 'REPOS') {
            dayEcarts.push({
                type: 'statut',
                message: 'Journée travaillée chez employeur, non saisie dans ShiftLock',
                moi: my?.status || 'NON SAISI',
                employeur: 'TRAVAIL',
                severity: 'error',
            });
        } else {
            // Heure début
            const myStart = timeToMin(my.start);
            const empStart = timeToMin(emp.start);
            if (empStart >= 0 && myStart >= 0 && Math.abs(myStart - empStart) > TOLERANCE) {
                dayEcarts.push({
                    type: 'debut',
                    message: `Heure de début différente (±${Math.abs(myStart - empStart)} min)`,
                    moi: my.start || '—',
                    employeur: emp.start || '—',
                    severity: Math.abs(myStart - empStart) > 15 ? 'error' : 'warn',
                });
            }

            // Heure fin
            const myEnd = timeToMin(my.end);
            const empEnd = timeToMin(emp.end);
            if (empEnd >= 0 && myEnd >= 0 && Math.abs(myEnd - empEnd) > TOLERANCE) {
                dayEcarts.push({
                    type: 'fin',
                    message: `Heure de fin différente (±${Math.abs(myEnd - empEnd)} min)`,
                    moi: my.end || '—',
                    employeur: emp.end || '—',
                    severity: Math.abs(myEnd - empEnd) > 15 ? 'error' : 'warn',
                });
            }

            // Pauses employeur non dans ShiftLock
            for (const empPause of emp.pauses) {
                const found = my.pauses.some(mp => {
                    const dStart = Math.abs(timeToMin(mp.start) - timeToMin(empPause.start));
                    const dEnd = Math.abs(timeToMin(mp.end) - timeToMin(empPause.end));
                    return dStart <= TOLERANCE && dEnd <= TOLERANCE;
                });
                if (!found) {
                    dayEcarts.push({
                        type: 'pause_manquante',
                        message: `Pause employeur non saisie dans ShiftLock`,
                        moi: '—',
                        employeur: `${empPause.start}–${empPause.end}`,
                        severity: 'warn',
                    });
                }
            }

            // Pauses ShiftLock non chez l'employeur
            for (const myPause of my.pauses) {
                if (!myPause.start || !myPause.end) continue;
                const found = emp.pauses.some(ep => {
                    const dStart = Math.abs(timeToMin(ep.start) - timeToMin(myPause.start));
                    const dEnd = Math.abs(timeToMin(ep.end) - timeToMin(myPause.end));
                    return dStart <= TOLERANCE && dEnd <= TOLERANCE;
                });
                if (!found) {
                    dayEcarts.push({
                        type: 'pause_employee',
                        message: `Pause ShiftLock absente du relevé employeur`,
                        moi: `${myPause.start}–${myPause.end}`,
                        employeur: '—',
                        severity: 'warn',
                    });
                }
            }
        }

        if (!dayEcarts.length) {
            concordants++;
        } else {
            ecarts.push({ date: emp.date, label: getDayLabel(emp.date), ecarts: dayEcarts });
        }
    }

    return { ecarts, concordants, total, employerDays: employerDays };
}
