import React, { useState, useRef, useCallback } from 'react';
import { FileText, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { DayShift } from '../types';
import { loadPDFjs, parseEmployerPDF, matchShifts, type MatchResult, type MatchEcart } from '../utils/matchParser';
import { PAY_PERIODS_2026 } from '../utils/calculator';

interface MatchViewProps {
  shifts: Record<string, DayShift>;
  activePayMonth: string;
}

type State = 'idle' | 'loading' | 'parsing' | 'done' | 'error';

const SEVERITY_CONFIG = {
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: '🔴' },
  warn:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: '🟡' },
};

const ECART_LABELS = {
  debut: 'Heure début', fin: 'Heure fin',
  pause_manquante: 'Pause manquante', pause_employee: 'Pause non reconnue',
  statut: 'Statut journée', tte: 'TTE',
};

function EcartCard({ ecart }: { ecart: MatchEcart }) {
  const [open, setOpen] = useState(false);
  const maxSev = ecart.ecarts.some(e => e.severity === 'error') ? 'error' : 'warn';
  const cfg = SEVERITY_CONFIG[maxSev];
  return (
    <div style={{ border: `1px solid ${cfg.border}`, borderRadius: '12px', background: cfg.bg, marginBottom: '8px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>{cfg.icon}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>{ecart.label}</div>
            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{ecart.ecarts.length} écart{ecart.ecarts.length > 1 ? 's' : ''}</div>
          </div>
        </div>
        {open ? <ChevronUp size={16} color="#475569" /> : <ChevronDown size={16} color="#475569" />}
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {ecart.ecarts.map((e, i) => (
            <div key={i} style={{ marginTop: '10px', paddingTop: '10px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: SEVERITY_CONFIG[e.severity].color, marginBottom: '6px', textTransform: 'uppercase' }}>
                {ECART_LABELS[e.type]} — {e.message}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ padding: '7px 10px', borderRadius: '8px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <div style={{ fontSize: '0.55rem', color: '#0891b2', fontWeight: 700, textTransform: 'uppercase' }}>ShiftLock</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#22d3ee' }}>{e.moi}</div>
                </div>
                <div style={{ padding: '7px 10px', borderRadius: '8px', background: SEVERITY_CONFIG[e.severity].bg, border: `1px solid ${SEVERITY_CONFIG[e.severity].border}` }}>
                  <div style={{ fontSize: '0.55rem', color: SEVERITY_CONFIG[e.severity].color, fontWeight: 700, textTransform: 'uppercase' }}>Employeur</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9' }}>{e.employeur}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const MatchView: React.FC<MatchViewProps> = ({ shifts, activePayMonth }) => {
  const [state, setState] = useState<State>('idle');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const period = PAY_PERIODS_2026.find(p => p.payMonth === activePayMonth);

  const startScan = () => { setScanProgress(0); scanRef.current = setInterval(() => setScanProgress(p => p >= 95 ? 95 : p + 3), 80); };
  const stopScan = () => { if (scanRef.current) clearInterval(scanRef.current); setScanProgress(100); };

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pdf')) { setError('PDF uniquement'); setState('error'); return; }
    setFileName(file.name); setState('loading');
    const loaded = await loadPDFjs();
    if (!loaded) { setError('Impossible de charger PDF.js'); setState('error'); return; }
    setState('parsing'); startScan();
    try {
      const { days, error: parseError } = await parseEmployerPDF(file);
      stopScan();
      if (parseError || days.length === 0) { setError(parseError || 'Aucune donnée extraite'); setState('error'); return; }
      const periodDays = period ? days.filter(d => d.date >= period.start && d.date <= period.end) : days;
      setResult(matchShifts(shifts, periodDays));
      setState('done');
    } catch (e: any) { stopScan(); setError(e.message); setState('error'); }
  }, [shifts, period]);

  const reset = () => { setState('idle'); setResult(null); setError(null); setFileName(''); setScanProgress(0); };
  const errorsCount = result?.ecarts.reduce((acc, e) => acc + e.ecarts.filter(ec => ec.severity === 'error').length, 0) || 0;
  const warnsCount  = result?.ecarts.reduce((acc, e) => acc + e.ecarts.filter(ec => ec.severity === 'warn').length, 0) || 0;

  return (
    <div style={{ padding: '16px', height: '100%', overflowY: 'auto', paddingBottom: '90px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Vérification</div>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f1f5f9' }}>Match</h2>
        {period && <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#475569' }}>
          <strong style={{ color: '#94a3b8' }}>{period.label}</strong> · {period.start.split('-').reverse().join('/')} → {period.end.split('-').reverse().join('/')}
        </p>}
      </div>

      {(state === 'idle' || state === 'error') && (
        <>
          <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? '#6366f1' : 'rgba(99,102,241,0.3)'}`, borderRadius: '16px', padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', marginBottom: '16px' }}>
            <div style={{ width: '52px', height: '52px', margin: '0 auto 14px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} color="#6366f1" />
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '6px' }}>Dépose le relevé employeur</div>
            <div style={{ fontSize: '0.7rem', color: '#475569' }}>PDF "Décompte des Heures"</div>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} style={{ display: 'none' }} />
          {state === 'error' && error && (
            <div style={{ display: 'flex', gap: '8px', padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <XCircle size={15} color="#ef4444" />
              <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>{error}</span>
            </div>
          )}
        </>
      )}

      {(state === 'loading' || state === 'parsing') && (
        <div style={{ borderRadius: '16px', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(10,15,30,0.8)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <FileText size={15} color="#6366f1" />
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{fileName}</span>
          </div>
          <div style={{ padding: '20px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>{state === 'loading' ? 'Chargement PDF.js…' : 'Analyse du décompte…'}</span>
              <span style={{ fontSize: '0.7rem', color: '#22d3ee', fontWeight: 700 }}>{scanProgress}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, #6366f1, #22d3ee)', width: `${scanProgress}%`, transition: 'width 0.08s linear' }} />
            </div>
          </div>
        </div>
      )}

      {state === 'done' && result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {[
              { label: 'Concordants', value: result.concordants, color: '#22c55e', icon: '✅' },
              { label: 'Warnings',    value: warnsCount,         color: '#f59e0b', icon: '⚠️' },
              { label: 'Erreurs',     value: errorsCount,        color: '#ef4444', icon: '🔴' },
            ].map(s => (
              <div key={s.label} style={{ background: s.value > 0 ? `${s.color}10` : 'rgba(255,255,255,0.02)', border: `1px solid ${s.value > 0 ? `${s.color}30` : 'rgba(255,255,255,0.06)'}`, borderRadius: '12px', padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>{s.icon}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: s.value > 0 ? s.color : '#334155' }}>{s.value}</div>
                <div style={{ fontSize: '0.55rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem', color: '#475569', fontWeight: 600 }}>← Nouveau fichier</button>
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
