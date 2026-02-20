import React, { useState, useRef, useCallback } from 'react';
import { Camera, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import type { DayShift } from '../types';
import { matchShifts, type MatchResult, type MatchEcart } from '../utils/matchParser';
import { PAY_PERIODS_2026 } from '../utils/calculator';

interface MatchViewProps {
  shifts: Record<string, DayShift>;
  activePayMonth: string;
}

type State = 'idle' | 'scanning' | 'done' | 'error';

const SEVERITY_CONFIG = {
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: '🔴' },
  warn:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: '🟡' },
};

const ECART_LABELS = {
  debut:           'Heure début',
  fin:             'Heure fin',
  pause_manquante: 'Pause manquante',
  pause_employee:  'Pause non reconnue',
  statut:          'Statut journée',
  tte:             'TTE',
};

function EcartCard({ ecart }: { ecart: MatchEcart }) {
  const [open, setOpen] = useState(false);
  const maxSev = ecart.ecarts.some(e => e.severity === 'error') ? 'error' : 'warn';
  const cfg = SEVERITY_CONFIG[maxSev];

  return (
    <div style={{ border: `1px solid ${cfg.border}`, borderRadius: '12px', background: cfg.bg, marginBottom: '8px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.85rem' }}>{cfg.icon}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>{ecart.label}</div>
            <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1px' }}>{ecart.ecarts.length} écart{ecart.ecarts.length > 1 ? 's' : ''}</div>
          </div>
        </div>
        {open ? <ChevronUp size={16} color="#475569" /> : <ChevronDown size={16} color="#475569" />}
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {ecart.ecarts.map((e, i) => (
            <div key={i} style={{ marginTop: '10px', paddingTop: '10px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: SEVERITY_CONFIG[e.severity].color, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {ECART_LABELS[e.type]} — {e.message}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ padding: '7px 10px', borderRadius: '8px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <div style={{ fontSize: '0.55rem', color: '#0891b2', fontWeight: 700, textTransform: 'uppercase' }}>ShiftLock</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#22d3ee', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>{e.moi}</div>
                </div>
                <div style={{ padding: '7px 10px', borderRadius: '8px', background: SEVERITY_CONFIG[e.severity].bg, border: `1px solid ${SEVERITY_CONFIG[e.severity].border}` }}>
                  <div style={{ fontSize: '0.55rem', color: SEVERITY_CONFIG[e.severity].color, fontWeight: 700, textTransform: 'uppercase' }}>Employeur</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>{e.employeur}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div style={{ background: value > 0 ? `${color}10` : 'rgba(255,255,255,0.02)', border: `1px solid ${value > 0 ? `${color}30` : 'rgba(255,255,255,0.06)'}`, borderRadius: '12px', padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>{icon}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: value > 0 ? color : '#334155', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '0.55rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

// ─── OCR via Tesseract.js ─────────────────────────────────────────────────────

declare global { interface Window { Tesseract: any } }

async function loadTesseract(): Promise<boolean> {
  if (window.Tesseract) return true;
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js';
    script.onload = () => resolve(!!window.Tesseract);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function ocrImage(file: File, onProgress: (p: number) => void): Promise<string> {
  const loaded = await loadTesseract();
  if (!loaded) throw new Error('Impossible de charger Tesseract.js');

  const worker = await window.Tesseract.createWorker('fra', 1, {
    logger: (m: any) => {
      if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100));
    },
  });

  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();
}

// ─── PARSER texte OCR ─────────────────────────────────────────────────────────
// Format attendu : lignes avec date DD/MM/YYYY, statut AR/RH, heures, pauses

function parseOCRText(text: string) {
}


// Crée un File-like depuis le texte OCR pour réutiliser le parser existant
async function parseFromOCR(text: string): Promise<{ days: any[]; error?: string }> {
  // Parser directement le texte ligne par ligne
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  function normalizeTime(raw: string): string {
    const m = raw.match(/^(\d{1,2})[h:.](\d{2})$/i);
    if (!m) return '';
    return `${m[1].padStart(2,'0')}:${m[2]}`;
  }

  function parseFrDate(raw: string): string | null {
    const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }

  function extractPauses(text: string) {
    const pauses: Array<{ start: string; end: string }> = [];
    const re = /(\d{1,2}[h:.]\d{2})\s*[-–]\s*(\d{1,2}[h:.]\d{2})/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const ps = normalizeTime(m[1]);
      const pe = normalizeTime(m[2]);
      if (ps && pe) pauses.push({ start: ps, end: pe });
    }
    return pauses;
  }

  const SKIP = ['DECOMPTE', 'Salari', 'Semaine', 'Prévu', 'Total', 'AR :', 'RH :', 'Signatures', 'Employeur', 'permis', 'atteste', 'Edité', 'NonC', 'Amplitude', 'RAC '];
  const days: any[] = [];

  // Merge continuation lines
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

    if (/ RH /i.test(line)) {
      days.push({ date: iso, status: 'RH', pauses: [] });
      continue;
    }

    if (/ AR /i.test(line)) {
      const tteMatch = line.match(/100\s+(\d{1,2}[h:.]\d{2})/i);
      const tte = tteMatch ? normalizeTime(tteMatch[1]) : '';
      const after100 = line.split(/100\s+\d{1,2}[h:.]\d{2}/i)[1] || '';
      const pauses = extractPauses(after100);
      const before100 = line.split('100')[0];
      const timesBefore = (before100.match(/\d{1,2}[h:.]\d{2}/g) || []).map(normalizeTime).filter(Boolean);
      const start = timesBefore[0] || '';
      const end = timesBefore.length >= 2 ? timesBefore[timesBefore.length - 2] : '';
      if (start) days.push({ date: iso, status: 'AR', start, end, pauses, tte });
    }
  }

  return days.length > 0 ? { days } : { days: [], error: 'Aucune donnée reconnue — essaie avec une meilleure photo' };
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

export const MatchView: React.FC<MatchViewProps> = ({ shifts, activePayMonth }) => {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const period = PAY_PERIODS_2026.find(p => p.payMonth === activePayMonth);

  const processPhoto = useCallback(async (file: File) => {
    setState('scanning');
    setProgress(0);
    setProgressLabel('Chargement OCR…');

    try {
      setProgressLabel('Analyse de la photo…');
      const text = await ocrImage(file, p => {
        setProgress(p);
        setProgressLabel(`Lecture du texte… ${p}%`);
      });

      setProgressLabel('Extraction des données…');
      setProgress(98);

      const { days, error: parseError } = await parseFromOCR(text);

      if (parseError || days.length === 0) {
        setError(parseError || 'Aucune donnée reconnue');
        setState('error');
        return;
      }

      const periodDays = period
        ? days.filter((d: any) => d.date >= period.start && d.date <= period.end)
        : days;

      const matchResult = matchShifts(shifts, periodDays);
      setResult(matchResult);
      setState('done');
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l\'analyse');
      setState('error');
    }
  }, [shifts, period]);

  const reset = () => {
    setState('idle');
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const errorsCount = result?.ecarts.reduce((acc, e) => acc + e.ecarts.filter(ec => ec.severity === 'error').length, 0) || 0;
  const warnsCount = result?.ecarts.reduce((acc, e) => acc + e.ecarts.filter(ec => ec.severity === 'warn').length, 0) || 0;

  return (
    <div style={{ padding: '16px', height: '100%', overflowY: 'auto', paddingBottom: '90px' }}>

      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Vérification</div>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f1f5f9' }}>Match</h2>
        {period && (
          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#475569' }}>
            Période : <strong style={{ color: '#94a3b8' }}>{period.label}</strong> · {period.start.split('-').reverse().join('/')} → {period.end.split('-').reverse().join('/')}
          </p>
        )}
      </div>

      {/* IDLE */}
      {(state === 'idle' || state === 'error') && (
        <>
          <button
            onClick={() => photoInputRef.current?.click()}
            style={{
              width: '100%', padding: '36px 20px', borderRadius: '16px', cursor: 'pointer',
              border: '2px dashed rgba(34,211,238,0.3)',
              background: 'rgba(34,211,238,0.03)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ width: '56px', height: '56px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={24} color="#22d3ee" />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '4px' }}>
                Photographier le décompte
              </div>
              <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                Pointez la caméra sur le relevé employeur
              </div>
            </div>
          </button>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={e => { const f = e.target.files?.[0]; if (f) processPhoto(f); e.target.value = ''; }}
            style={{ display: 'none' }}
          />

          {state === 'error' && error && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', marginTop: '12px' }}>
              <XCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '0.6rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Comment ça marche</div>
            {[
              { icon: '📋', text: 'Reçois ton décompte des heures de l\'employeur' },
              { icon: '📸', text: 'Photographie-le directement depuis l\'app' },
              { icon: '⚡', text: 'ShiftLock lit le document et extrait les données' },
              { icon: '🎯', text: 'Seuls les jours avec écarts s\'affichent — le reste est validé ✅' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>{s.icon}</span>
                <span style={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.5 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* SCANNING */}
      {state === 'scanning' && (
        <div style={{ borderRadius: '16px', border: '1px solid rgba(34,211,238,0.3)', background: 'rgba(10,15,30,0.8)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Camera size={15} color="#22d3ee" />
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Analyse en cours…</span>
          </div>
          <div style={{ padding: '20px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>{progressLabel}</span>
              <span style={{ fontSize: '0.7rem', color: '#22d3ee', fontWeight: 700 }}>{progress}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, #22d3ee, #6366f1)', width: `${progress}%`, transition: 'width 0.2s linear', boxShadow: '0 0 8px rgba(34,211,238,0.4)' }} />
            </div>
          </div>
        </div>
      )}

      {/* RÉSULTATS */}
      {state === 'done' && result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <ScoreBadge label="Concordants" value={result.concordants} color="#22c55e" icon="✅" />
            <ScoreBadge label="Warnings" value={warnsCount} color="#f59e0b" icon="⚠️" />
            <ScoreBadge label="Erreurs" value={errorsCount} color="#ef4444" icon="🔴" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem', color: '#334155', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Camera size={11} /> Nouvelle photo
            </button>
          </div>

          {result.ecarts.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#86efac' }}>Relevé conforme</div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '6px' }}>{result.total} journées vérifiées — aucun écart</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                {result.ecarts.length} jour{result.ecarts.length > 1 ? 's' : ''} avec écarts
              </div>
              {result.ecarts.map(ecart => <EcartCard key={ecart.date} ecart={ecart} />)}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default MatchView;
