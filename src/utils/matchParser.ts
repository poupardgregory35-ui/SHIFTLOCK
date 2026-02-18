import type { DayShift } from '../types';

export interface EmployerDay {
  date: string;
  status: 'AR' | 'RH' | 'OTHER';
  start?: string;
  end?: string;
  pauses: Array<{ start: string; end: string }>;
  tte?: string;
}

export interface MatchEcart {
  date: string;
  label: string;
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

function normalizeTime(raw: string): string {
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  return `${m[1].padStart(2,'0')}:${m[2]}`;
}

function parseFrDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}

function getDayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const day = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d.getDay()];
  return `${day} ${iso.split('-').reverse().slice(0,2).join('/')}`;
}

function extractPauses(text: string): Array<{ start: string; end: string }> {
  const pauses: Array<{ start: string; end: string }> = [];
  const pauseRegex = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g;
  let pm;
  while ((pm = pauseRegex.exec(text)) !== null) {
    const ps = normalizeTime(pm[1]);
    const pe = normalizeTime(pm[2]);
    if (ps && pe) pauses.push({ start: ps, end: pe });
  }
  return pauses;
}

const SKIP = ['DECOMPTE', 'Salari', 'Semaine', 'Prévu', 'Total', 'AR :', 'RH :', 'Signatures', 'Employeur', 'permis', 'atteste', 'Edité', 'NonC', 'Amplitude', 'RAC '];

export async function parseEmployerPDF(file: File): Promise<{ days: EmployerDay[]; error?: string }> {
  const lines = await extractLines(file);
  const days: EmployerDay[] = [];

  // Merge continuation lines (pauses débordant sur ligne suivante)
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0 && (line.startsWith('- ') || line.startsWith('/ ')) && !line.match(/\d{2}\/\d{2}\/\d{4}/)) {
      merged[merged.length - 1] += ' ' + line;
    } else {
      merged.push(line);
    }
  }

  for (const line of merged) {
    if (SKIP.some(s => line.includes(s))) continue;
    const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (!dateMatch) continue;
    const iso = parseFrDate(dateMatch[1]);
    if (!iso) continue;

    if (/ RH /.test(line)) {
      days.push({ date: iso, status: 'RH', pauses: [] });
      continue;
    }

    if (/ AR /.test(line)) {
      const tteMatch = line.match(/100\s+(\d{1,2}:\d{2})/);
      const tte = tteMatch ? normalizeTime(tteMatch[1]) : '';
      const after100 = line.split(/100\s+\d{1,2}:\d{2}/)[1] || '';
      const pauses = extractPauses(after100);
      const before100 = line.split('100')[0];
      const timesBefore = (before100.match(/\d{1,2}:\d{2}/g) || []).map(normalizeTime).filter(Boolean);
      const start = timesBefore[0] || '';
      const end = timesBefore.length >= 2 ? timesBefore[timesBefore.length - 2] : '';
      if (start) days.push({ date: iso, status: 'AR', start, end, pauses, tte });
      continue;
    }
  }

  return { days };
}

function timeToMin(t?: string): number {
  if (!t) return -1;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

const TOLERANCE = 5;

export function matchShifts(myShifts: Record<string, DayShift>, employerDays: EmployerDay[]): MatchResult {
  const ecarts: MatchEcart[] = [];
  let concordants = 0;
  let total = 0;

  for (const emp of employerDays) {
    if (emp.status === 'OTHER') continue;
    total++;
    const my = myShifts[emp.date];
    const dayEcarts: MatchEcart['ecarts'] = [];

    if (emp.status === 'RH') {
      if (my && my.status === 'TRAVAIL') {
        dayEcarts.push({ type: 'statut', message: 'Jour REPOS chez employeur, TRAVAIL dans ShiftLock', moi: 'TRAVAIL', employeur: 'REPOS', severity: 'error' });
      }
      if (!dayEcarts.length) concordants++;
      else ecarts.push({ date: emp.date, label: getDayLabel(emp.date), ecarts: dayEcarts });
      continue;
    }

    if (!my || my.status === 'VIDE' || my.status === 'REPOS') {
      dayEcarts.push({ type: 'statut', message: 'Journée travaillée non saisie dans ShiftLock', moi: my?.status || 'NON SAISI', employeur: 'TRAVAIL', severity: 'error' });
    } else {
      const dStart = Math.abs(timeToMin(my.start) - timeToMin(emp.start));
      if (timeToMin(emp.start) >= 0 && timeToMin(my.start) >= 0 && dStart > TOLERANCE) {
        dayEcarts.push({ type: 'debut', message: `Début différent (±${dStart} min)`, moi: my.start || '—', employeur: emp.start || '—', severity: dStart > 15 ? 'error' : 'warn' });
      }
      const dEnd = Math.abs(timeToMin(my.end) - timeToMin(emp.end));
      if (timeToMin(emp.end) >= 0 && timeToMin(my.end) >= 0 && dEnd > TOLERANCE) {
        dayEcarts.push({ type: 'fin', message: `Fin différente (±${dEnd} min)`, moi: my.end || '—', employeur: emp.end || '—', severity: dEnd > 15 ? 'error' : 'warn' });
      }
      for (const ep of emp.pauses) {
        const found = (my.pauses || []).some(mp => Math.abs(timeToMin(mp.start) - timeToMin(ep.start)) <= TOLERANCE && Math.abs(timeToMin(mp.end) - timeToMin(ep.end)) <= TOLERANCE);
        if (!found) dayEcarts.push({ type: 'pause_manquante', message: 'Pause employeur absente de ShiftLock', moi: '—', employeur: `${ep.start}–${ep.end}`, severity: 'warn' });
      }
      for (const mp of (my.pauses || [])) {
        if (!mp.start || !mp.end) continue;
        const found = emp.pauses.some(ep => Math.abs(timeToMin(ep.start) - timeToMin(mp.start)) <= TOLERANCE && Math.abs(timeToMin(ep.end) - timeToMin(mp.end)) <= TOLERANCE);
        if (!found) dayEcarts.push({ type: 'pause_employee', message: 'Pause ShiftLock absente du relevé employeur', moi: `${mp.start}–${mp.end}`, employeur: '—', severity: 'warn' });
      }
    }

    if (!dayEcarts.length) concordants++;
    else ecarts.push({ date: emp.date, label: getDayLabel(emp.date), ecarts: dayEcarts });
  }

  return { ecarts, concordants, total, employerDays };
}
