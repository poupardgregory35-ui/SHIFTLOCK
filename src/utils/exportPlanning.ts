import type { DayShift } from '../types';
import { calculateDay, formatDuration, PAY_PERIODS_2026 } from './calculator';
import { jsPDF } from 'jspdf';

// ─── UTILS ───────────────────────────────────────────────────────────────────

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function formatDate(iso: string): string {
    const d = new Date(iso + 'T12:00:00');
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function getDayName(iso: string): string {
    return DAYS_FR[new Date(iso + 'T12:00:00').getDay()];
}

function getPeriodDates(payMonth: string): string[] {
    const period = PAY_PERIODS_2026.find(p => p.payMonth === payMonth);
    if (!period) return [];
    const dates: string[] = [];
    let c = new Date(period.start + 'T12:00:00');
    const end = new Date(period.end + 'T12:00:00');
    while (c <= end) {
        dates.push(c.toISOString().split('T')[0]);
        c = new Date(c.getTime() + 86400000);
    }
    return dates;
}

// ─── EXPORT PDF ───────────────────────────────────────────────────────────────

export async function exportPlanning(
    payMonth: string,
    shifts: Record<string, DayShift>,
    format: 'pdf' | 'csv' = 'pdf'
): Promise<{ success: boolean; error?: string }> {
    const period = PAY_PERIODS_2026.find(p => p.payMonth === payMonth);
    if (!period) return { success: false, error: 'Période introuvable' };

    const [year, month] = payMonth.split('-').map(Number);
    const label = `${MONTHS_FR[month - 1]} ${year}`;
    const dates = getPeriodDates(payMonth);

    if (format === 'csv') {
        const header = ['Date', 'Jour', 'Statut', 'Debut', 'Fin', 'Pauses', 'TTE', 'Indemnites', 'Note'];
        const rows = dates.map(date => {
            const shift = shifts[date];
            if (!shift || shift.status === 'VIDE') return [date, getDayName(date), 'VIDE', '', '', '', '', '', ''];
            const res = calculateDay(shift);
            const pauseStr = shift.pauses.map(p => `${p.start}-${p.end}`).join(' | ');
            const irStr = res.ir > 0 ? `IR:${res.ir}€` : res.iru > 0 ? `IRU:${res.iru}€` : '';
            return [
                date, getDayName(date), shift.status,
                shift.start || '', shift.end || '', pauseStr,
                formatDuration(res.tte), irStr, shift.note || ''
            ];
        });
        const csvContent = [header, ...rows].map(row => row.join(';')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ShiftLock_${label.replace(' ', '_')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true };
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // ── Couleurs ──
    const CYAN: [number, number, number] = [34, 211, 238];
    const DARK: [number, number, number] = [7, 13, 26];
    const SLATE: [number, number, number] = [71, 85, 105];
    const WHITE: [number, number, number] = [241, 245, 249];
    const GREEN: [number, number, number] = [34, 197, 94];
    const AMBER: [number, number, number] = [245, 158, 11];
    const RED: [number, number, number] = [239, 68, 68];

    const W = 210; // largeur A4
    const MARGIN = 12;
    const COL_W = W - MARGIN * 2;

    // ── Fond ──
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, 297, 'F');

    // ── Header ──
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(MARGIN, 10, COL_W, 22, 3, 3, 'F');
    doc.setTextColor(...CYAN);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SHIFTLOCK', MARGIN + 4, 22);
    doc.setTextColor(...SLATE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Relevé de temps', MARGIN + 4, 27);

    // Période
    doc.setTextColor(...WHITE);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(label, W - MARGIN - 4, 20, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE);
    doc.text(
        `${period.start.split('-').reverse().join('/')} → ${period.end.split('-').reverse().join('/')}`,
        W - MARGIN - 4, 26, { align: 'right' }
    );

    // ── Totaux ──
    let totalTTE = 0;
    let totalIR = 0;
    let totalIRU = 0;

    const rows: Array<{
        date: string; day: string; statut: string;
        debut: string; fin: string; pauses: string;
        tte: string; ir: string; note: string;
        isEmpty: boolean; isWeekend: boolean;
    }> = [];

    for (const date of dates) {
        const shift = shifts[date];
        const d = new Date(date + 'T12:00:00');
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        if (!shift || shift.status === 'VIDE') {
            rows.push({ date: formatDate(date), day: getDayName(date), statut: '', debut: '', fin: '', pauses: '', tte: '', ir: '', note: '', isEmpty: true, isWeekend });
            continue;
        }

        const result = calculateDay(shift);
        if (shift.status === 'TRAVAIL') {
            totalTTE += result.tte;
            totalIR += result.ir;
            totalIRU += result.iru;
        }

        const pauseStr = shift.pauses
            .filter(p => p.start && p.end)
            .map(p => `${p.start}-${p.end}`)
            .join(' | ');

        const irStr = result.ir > 0 ? `IR ${result.ir.toFixed(2)}€`
            : result.iru > 0 ? `IRU ${result.iru.toFixed(2)}€`
                : '';

        rows.push({
            date: formatDate(date),
            day: getDayName(date),
            statut: shift.status,
            debut: shift.start || '',
            fin: shift.end || '',
            pauses: pauseStr,
            tte: result.tte ? formatDuration(result.tte) : '',
            ir: irStr,
            note: shift.note || '',
            isEmpty: false,
            isWeekend,
        });
    }

    // ── Tableau ──
    let y = 38;
    const ROW_H = 7;
    const COLS = {
        day: { x: MARGIN, w: 10 },
        date: { x: MARGIN + 10, w: 18 },
        statut: { x: MARGIN + 28, w: 18 },
        debut: { x: MARGIN + 46, w: 14 },
        fin: { x: MARGIN + 60, w: 14 },
        pauses: { x: MARGIN + 74, w: 42 },
        tte: { x: MARGIN + 116, w: 18 },
        ir: { x: MARGIN + 134, w: 24 },
        note: { x: MARGIN + 158, w: COL_W - 158 },
    };

    // En-têtes colonnes
    doc.setFillColor(15, 23, 42);
    doc.rect(MARGIN, y, COL_W, ROW_H, 'F');
    doc.setTextColor(...CYAN);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    const headers: Array<[string, keyof typeof COLS]> = [
        ['Jour', 'day'], ['Date', 'date'], ['Statut', 'statut'],
        ['Début', 'debut'], ['Fin', 'fin'], ['Pauses', 'pauses'],
        ['TTE', 'tte'], ['Indemnité', 'ir'], ['Note', 'note'],
    ];
    for (const [text, col] of headers) {
        doc.text(text, COLS[col].x + 1, y + 4.5);
    }
    y += ROW_H;

    // Lignes données
    for (const row of rows) {
        // Saut de page
        if (y > 275) {
            doc.addPage();
            doc.setFillColor(...DARK);
            doc.rect(0, 0, W, 297, 'F');
            y = 15;
        }

        // Fond ligne
        if (row.isEmpty) {
            doc.setFillColor(10, 17, 33);
        } else if (row.isWeekend) {
            doc.setFillColor(20, 30, 50);
        } else if (row.statut === 'TRAVAIL') {
            doc.setFillColor(15, 23, 42);
        } else {
            doc.setFillColor(12, 20, 38);
        }
        doc.rect(MARGIN, y, COL_W, ROW_H, 'F');

        // Séparateur
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.2);
        doc.line(MARGIN, y + ROW_H, MARGIN + COL_W, y + ROW_H);

        if (!row.isEmpty) {
            doc.setFontSize(6.5);

            // Jour
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...(row.isWeekend ? SLATE : WHITE));
            doc.text(row.day, COLS.day.x + 1, y + 4.5);

            // Date
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...SLATE);
            doc.text(row.date, COLS.date.x + 1, y + 4.5);

            // Statut
            if (row.statut === 'TRAVAIL') doc.setTextColor(...CYAN);
            else if (row.statut === 'CP') doc.setTextColor(167, 139, 250);
            else if (row.statut === 'MALADIE') doc.setTextColor(...RED);
            else doc.setTextColor(...SLATE);
            doc.text(row.statut, COLS.statut.x + 1, y + 4.5);

            if (row.statut === 'TRAVAIL') {
                // Début / Fin
                doc.setTextColor(...WHITE);
                doc.setFont('helvetica', 'bold');
                doc.text(row.debut, COLS.debut.x + 1, y + 4.5);
                doc.text(row.fin, COLS.fin.x + 1, y + 4.5);

                // Pauses
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...SLATE);
                const pauseTxt = doc.splitTextToSize(row.pauses, COLS.pauses.w - 2);
                doc.text(pauseTxt[0] || '', COLS.pauses.x + 1, y + 4.5);

                // TTE
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...CYAN);
                doc.text(row.tte, COLS.tte.x + 1, y + 4.5);

                // IR
                doc.setTextColor(...GREEN);
                doc.setFont('helvetica', 'normal');
                doc.text(row.ir, COLS.ir.x + 1, y + 4.5);

                // Note
                doc.setTextColor(...SLATE);
                const noteTxt = doc.splitTextToSize(row.note, COLS.note.w - 2);
                doc.text(noteTxt[0] || '', COLS.note.x + 1, y + 4.5);
            }
        }

        y += ROW_H;
    }

    // ── Récap totaux ──
    y += 6;
    if (y > 260) { doc.addPage(); doc.setFillColor(...DARK); doc.rect(0, 0, W, 297, 'F'); y = 15; }

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(MARGIN, y, COL_W, 26, 3, 3, 'F');
    doc.setDrawColor(...CYAN);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, MARGIN + COL_W, y);

    const cols3 = COL_W / 3;
    const summaryItems = [
        { label: 'TTE Total', value: formatDuration(totalTTE), color: CYAN },
        { label: 'IR perçus', value: `${totalIR.toFixed(2)}€`, color: GREEN },
        { label: 'IRU perçus', value: `${totalIRU.toFixed(2)}€`, color: AMBER },
    ];

    summaryItems.forEach((item, i) => {
        const cx = MARGIN + cols3 * i + cols3 / 2;
        doc.setTextColor(...SLATE);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, cx, y + 8, { align: 'center' });
        doc.setTextColor(...item.color);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value, cx, y + 20, { align: 'center' });
    });

    // ── Footer ──
    doc.setTextColor(...SLATE);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(
        `Généré le ${new Date().toLocaleDateString('fr-FR')} par ShiftLock V3 — Document non contractuel`,
        W / 2, 290, { align: 'center' }
    );

    // ── Nom fichier ──
    const fileName = `ShiftLock_${MONTHS_FR[month - 1]}_${year}.pdf`;
    const pdfBlob = doc.output('blob');

    // Web Share API (mobile)
    if (navigator.share && navigator.canShare) {
        try {
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ title: `ShiftLock — ${label}`, files: [file] });
                return { success: true };
            }
        } catch (e: any) {
            if (e.name === 'AbortError') return { success: false, error: 'Partage annulé' };
        }
    }

    // Fallback téléchargement
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { success: true };
}
