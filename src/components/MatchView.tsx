import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Zap, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
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
    warn: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: '🟡' },
};

const ECART_LABELS = {
    debut: 'Heure début',
    fin: 'Heure fin',
    pause_manquante: 'Pause manquante',
    pause_employee: 'Pause non reconnue',
    statut: 'Statut journée',
    tte: 'TTE',
};

function EcartCard({ ecart, defaultOpen }: { ecart: MatchEcart; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen || false);
    const maxSev = ecart.ecarts.some(e => e.severity === 'error') ? 'error' : 'warn';
    const cfg = SEVERITY_CONFIG[maxSev];

    return (
        <div style={{
            border: `1px solid ${cfg.border}`,
            borderRadius: '12px',
            background: cfg.bg,
            marginBottom: '8px',
            overflow: 'hidden',
        }}>
            {/* En-tête */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem' }}>{cfg.icon}</span>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>
                            {ecart.label}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1px' }}>
                            {ecart.ecarts.length} écart{ecart.ecarts.length > 1 ? 's' : ''} détecté{ecart.ecarts.length > 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
                {open ? <ChevronUp size={16} color="#475569" /> : <ChevronDown size={16} color="#475569" />}
            </button>

            {/* Détails */}
            {open && (
                <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {ecart.ecarts.map((e, i) => (
                        <div key={i} style={{
                            marginTop: '10px',
                            paddingTop: i > 0 ? '10px' : '10px',
                            borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}>
                            <div style={{
                                fontSize: '0.7rem', fontWeight: 700,
                                color: SEVERITY_CONFIG[e.severity].color,
                                marginBottom: '6px',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                            }}>
                                {ECART_LABELS[e.type]} — {e.message}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                <div style={{
                                    padding: '7px 10px', borderRadius: '8px',
                                    background: 'rgba(34,211,238,0.08)',
                                    border: '1px solid rgba(34,211,238,0.2)',
                                }}>
                                    <div style={{ fontSize: '0.55rem', color: '#0891b2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        ShiftLock
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#22d3ee', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
                                        {e.moi}
                                    </div>
                                </div>
                                <div style={{
                                    padding: '7px 10px', borderRadius: '8px',
                                    background: `${SEVERITY_CONFIG[e.severity].bg}`,
                                    border: `1px solid ${SEVERITY_CONFIG[e.severity].border}`,
                                }}>
                                    <div style={{ fontSize: '0.55rem', color: SEVERITY_CONFIG[e.severity].color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Employeur
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
                                        {e.employeur}
                                    </div>
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

    const startScan = () => {
        setScanProgress(0);
        scanRef.current = setInterval(() => {
            setScanProgress(p => p >= 95 ? 95 : p + 3);
        }, 80);
    };
    const stopScan = () => {
        if (scanRef.current) clearInterval(scanRef.current);
        setScanProgress(100);
    };

    const processFile = useCallback(async (file: File) => {
        if (!file.name.endsWith('.pdf')) {
            setError('Seuls les fichiers PDF sont acceptés');
            setState('error');
            return;
        }

        setFileName(file.name);
        setState('loading');

        const loaded = await loadPDFjs();
        if (!loaded) {
            setError('Impossible de charger PDF.js — vérifie ta connexion');
            setState('error');
            return;
        }

        setState('parsing');
        startScan();

        try {
            const { days, error: parseError } = await parseEmployerPDF(file);
            stopScan();

            if (parseError || days.length === 0) {
                setError(parseError || 'Aucune donnée extraite du PDF');
                setState('error');
                return;
            }

            // Filtrer les jours de la période active
            const periodDays = period
                ? days.filter(d => d.date >= period.start && d.date <= period.end)
                : days;

            const matchResult = matchShifts(shifts, periodDays);
            setResult(matchResult);
            setState('done');
        } catch (e: any) {
            stopScan();
            setError(e.message || 'Erreur lors de l\'analyse');
            setState('error');
        }
    }, [shifts, period]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, [processFile]);

    const reset = () => {
        setState('idle');
        setResult(null);
        setError(null);
        setFileName('');
        setScanProgress(0);
    };

    const errorsCount = result?.ecarts.reduce((acc, e) =>
        acc + e.ecarts.filter(ec => ec.severity === 'error').length, 0) || 0;
    const warnsCount = result?.ecarts.reduce((acc, e) =>
        acc + e.ecarts.filter(ec => ec.severity === 'warn').length, 0) || 0;

    return (
        <div style={{ padding: '16px', height: '100%', overflowY: 'auto', paddingBottom: '90px' }}>

            {/* ─── HEADER ─── */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                    Vérification
                </div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f1f5f9' }}>
                    Match
                </h2>
                {period && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#475569' }}>
                        Période : <strong style={{ color: '#94a3b8' }}>{period.label}</strong> · {period.start.split('-').reverse().join('/')} → {period.end.split('-').reverse().join('/')}
                    </p>
                )}
            </div>

            {/* ─── IDLE : DROP ZONE ─── */}
            {(state === 'idle' || state === 'error') && (
                <>
                    <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragOver ? '#6366f1' : 'rgba(99,102,241,0.3)'}`,
                            borderRadius: '16px', padding: '36px 20px',
                            textAlign: 'center', cursor: 'pointer',
                            background: dragOver ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                            transition: 'all 0.2s', marginBottom: '16px',
                        }}
                    >
                        <div style={{
                            width: '52px', height: '52px', margin: '0 auto 14px',
                            background: 'rgba(99,102,241,0.12)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: '14px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <FileText size={22} color="#6366f1" />
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '6px' }}>
                            Dépose le relevé employeur
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#475569' }}>
                            PDF "Décompte des Heures" de l'ERP
                        </div>
                    </div>

                    <input ref={fileInputRef} type="file" accept=".pdf"
                        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
                        style={{ display: 'none' }}
                    />

                    {state === 'error' && error && (
                        <div style={{
                            display: 'flex', gap: '8px', alignItems: 'flex-start',
                            padding: '12px', borderRadius: '10px',
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                        }}>
                            <XCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                            <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>{error}</span>
                        </div>
                    )}

                    {/* Guide */}
                    <div style={{ marginTop: '24px' }}>
                        <div style={{ fontSize: '0.6rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                            Comment ça marche
                        </div>
                        {[
                            { icon: '📄', text: 'Demande à ton employeur le PDF "Décompte des Heures" pour la période actuelle' },
                            { icon: '📂', text: 'Dépose-le ici — ShiftLock extrait automatiquement toutes les données' },
                            { icon: '⚡', text: 'Le comparateur analyse heure par heure, pause par pause' },
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

            {/* ─── PARSING ANIMATION ─── */}
            {(state === 'loading' || state === 'parsing') && (
                <div style={{
                    borderRadius: '16px', border: '1px solid rgba(99,102,241,0.3)',
                    background: 'rgba(10,15,30,0.8)', overflow: 'hidden',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <FileText size={15} color="#6366f1" />
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fileName}
                        </span>
                    </div>

                    {/* Barre de progression */}
                    <div style={{ padding: '20px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#475569' }}>
                                {state === 'loading' ? 'Chargement PDF.js…' : 'Analyse du décompte…'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#22d3ee', fontWeight: 700 }}>{scanProgress}%</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: '4px',
                                background: 'linear-gradient(90deg, #6366f1, #22d3ee)',
                                width: `${scanProgress}%`,
                                transition: 'width 0.08s linear',
                                boxShadow: '0 0 8px rgba(34,211,238,0.4)',
                            }} />
                        </div>
                        <div style={{ marginTop: '12px', fontSize: '0.65rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22d3ee', animation: 'pulse 1s infinite' }} />
                            Extraction colonnes Heu.D / Heu.F / Rep…
                        </div>
                    </div>
                </div>
            )}

            {/* ─── RÉSULTATS ─── */}
            {state === 'done' && result && (
                <>
                    {/* Score */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '8px', marginBottom: '16px',
                    }}>
                        <ScoreBadge
                            label="Concordants"
                            value={result.concordants}
                            color="#22c55e"
                            icon="✅"
                        />
                        <ScoreBadge
                            label="Avertissements"
                            value={warnsCount}
                            color="#f59e0b"
                            icon="⚠️"
                        />
                        <ScoreBadge
                            label="Erreurs"
                            value={errorsCount}
                            color="#ef4444"
                            icon="🔴"
                        />
                    </div>

                    {/* Fichier + reset */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', marginBottom: '16px',
                        background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={13} color="#475569" />
                            <span style={{ fontSize: '0.65rem', color: '#475569', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {fileName}
                            </span>
                        </div>
                        <button onClick={reset} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '0.65rem', color: '#334155', fontWeight: 600,
                        }}>
                            Nouveau
                        </button>
                    </div>

                    {/* Écarts */}
                    {result.ecarts.length === 0 ? (
                        <div style={{
                            padding: '32px 20px', textAlign: 'center',
                            background: 'rgba(34,197,94,0.06)',
                            border: '1px solid rgba(34,197,94,0.2)',
                            borderRadius: '16px',
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#86efac' }}>
                                Relevé conforme
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '6px' }}>
                                {result.total} journées vérifiées — aucun écart détecté
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                                {result.ecarts.length} jour{result.ecarts.length > 1 ? 's' : ''} avec écarts
                            </div>
                            {result.ecarts.map(ecart => (
                                <EcartCard key={ecart.date} ecart={ecart} />
                            ))}
                        </>
                    )}
                </>
            )}
        </div>
    );
};

function ScoreBadge({ label, value, color, icon }: {
    label: string; value: number; color: string; icon: string;
}) {
    return (
        <div style={{
            background: value > 0 ? `${color}10` : 'rgba(255,255,255,0.02)',
            border: `1px solid ${value > 0 ? `${color}30` : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '12px', padding: '10px 8px', textAlign: 'center',
        }}>
            <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>{icon}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: value > 0 ? color : '#334155', fontVariantNumeric: 'tabular-nums' }}>
                {value}
            </div>
            <div style={{ fontSize: '0.55rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
                {label}
            </div>
        </div>
    );
}

export default MatchView;
