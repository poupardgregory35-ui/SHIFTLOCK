
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, X, Zap, Loader2 } from 'lucide-react';
import type { DayShift } from '../types';
import { parsePDFDecompte, loadPDFjs, type ParseResult } from '../utils/importParser';

interface ImportViewProps {
    onImport: (shifts: Record<string, Partial<DayShift>>) => void;
}

type ImportState = 'idle' | 'loading_pdfjs' | 'scanning' | 'done' | 'error';

export const ImportView: React.FC<ImportViewProps> = ({ onImport }) => {
    const [state, setState] = useState<ImportState>('idle');
    const [result, setResult] = useState<ParseResult | null>(null);
    const [fileName, setFileName] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [scanLine, setScanLine] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const startScanAnimation = () => {
        setScanLine(0);
        if (scanInterval.current) clearInterval(scanInterval.current);
        scanInterval.current = setInterval(() => {
            setScanLine(prev => (prev >= 100 ? 0 : prev + 2));
        }, 20);
    };

    const stopScanAnimation = () => {
        if (scanInterval.current) {
            clearInterval(scanInterval.current);
            scanInterval.current = null;
        }
    };

    // Cleanup interval on unmount
    useEffect(() => {
        return () => stopScanAnimation();
    }, []);

    const processFile = useCallback(async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            setState('error');
            setResult({ shifts: {}, matched: 0, total: 0, errors: ['Seuls les fichiers PDF sont acceptés.'] });
            return;
        }

        setFileName(file.name);
        setState('loading_pdfjs');

        try {
            const loaded = await loadPDFjs();
            if (!loaded) {
                setState('error');
                setResult({ shifts: {}, matched: 0, total: 0, errors: ['Impossible de charger le moteur PDF. Vérifiez votre connexion.'] });
                return;
            }

            setState('scanning');
            startScanAnimation();

            // Small delay to let UI update and scan animation start
            await new Promise(r => setTimeout(r, 600));

            const parsed = await parsePDFDecompte(file);
            stopScanAnimation();

            if (parsed.matched === 0 && parsed.shifts && Object.keys(parsed.shifts).length === 0) {
                setResult({ ...parsed, errors: [...parsed.errors, "Aucune donnée trouvée. Vérifiez le format du PDF."] });
                setState('error');
            } else {
                setResult(parsed);
                setState('done');
            }

        } catch (e: any) {
            stopScanAnimation();
            setState('error');
            setResult({ shifts: {}, matched: 0, total: 0, errors: [e.message || 'Erreur inconnue lors du traitement'] });
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, [processFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = '';
    };

    const handleConfirmImport = () => {
        if (!result?.shifts) return;
        onImport(result.shifts);
        reset();
    };

    const reset = () => {
        stopScanAnimation();
        setState('idle');
        setResult(null);
        setFileName('');
    };

    return (
        <div style={{ padding: '24px 20px', height: '100%', overflowY: 'auto' }}>

            {/* ─── HEADER ─── */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '0.65rem', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>
                    Importateur PDF
                </div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                    Décompte des Heures
                </h2>
                <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                    Glissez-déposez votre relevé PDF ici. Nous analyserons automatiquement les horaires, pauses et nuits pour remplir votre planning.
                </p>
            </div>

            {/* ─── DROP ZONE ─── */}
            {(state === 'idle' || state === 'error') && (
                <>
                    <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragOver ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '20px',
                            padding: '48px 24px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: dragOver ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            marginBottom: '24px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{
                            width: '64px', height: '64px', margin: '0 auto 20px',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(34,211,238,0.2) 100%)',
                            borderRadius: '20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(99,102,241,0.3)',
                            boxShadow: '0 8px 32px rgba(99,102,241,0.15)'
                        }}>
                            <Upload size={28} color="#818cf8" />
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '6px' }}>
                            Sélectionner un fichier PDF
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Maximum 10 Mo · Format PDF uniquement
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />

                    {/* Error Display */}
                    {state === 'error' && (
                        <div style={{
                            display: 'flex', gap: '12px', alignItems: 'flex-start',
                            padding: '16px', borderRadius: '16px',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                        }}>
                            <AlertTriangle size={20} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5', marginBottom: '4px' }}>Échec de l'importation</div>
                                <div style={{ fontSize: '0.75rem', color: '#fecaca', lineHeight: 1.4 }}>
                                    {result?.errors?.[0] || 'Une erreur inconnue est survenue.'}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ─── SCANNING ANIMATION ─── */}
            {(state === 'loading_pdfjs' || state === 'scanning') && (
                <div style={{
                    borderRadius: '20px', overflow: 'hidden',
                    border: '1px solid rgba(99,102,241,0.3)',
                    background: '#0f172a',
                    marginBottom: '24px',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
                }}>
                    {/* File Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '16px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: 'rgba(255,255,255,0.02)'
                    }}>
                        <div style={{ background: 'rgba(99,102,241,0.1)', padding: '8px', borderRadius: '8px' }}>
                            <FileText size={18} color="#818cf8" />
                        </div>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fileName}
                        </span>
                    </div>

                    {/* Scanner Visual */}
                    <div style={{ position: 'relative', height: '200px', overflow: 'hidden', background: '#020617' }}>
                        {/* Fake Content Lines */}
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} style={{
                                margin: `${20 + i * 24}px 20px 0`,
                                height: '8px', borderRadius: '4px',
                                background: `rgba(255,255,255,${0.03 + Math.random() * 0.05})`,
                                width: `${40 + Math.random() * 50}%`,
                            }} />
                        ))}

                        {/* Laser Line */}
                        {state === 'scanning' && (
                            <div style={{
                                position: 'absolute', left: 0, right: 0,
                                top: `${scanLine}%`,
                                height: '2px',
                                background: 'linear-gradient(90deg, transparent 0%, #22d3ee 50%, transparent 100%)',
                                boxShadow: '0 0 15px #22d3ee, 0 0 30px rgba(34,211,238,0.4)',
                                transition: 'top 0.02s linear',
                                zIndex: 10
                            }} />
                        )}

                        {/* Init State */}
                        {state === 'loading_pdfjs' && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexDirection: 'column', gap: '12px',
                                background: 'rgba(2, 6, 23, 0.7)',
                                backdropFilter: 'blur(2px)'
                            }}>
                                <Loader2 size={32} color="#6366f1" className="animate-spin" />
                                {/* Note: Ensure global css has animate-spin or use inline style */}
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>Initialisation du moteur...</div>
                            </div>
                        )}
                    </div>

                    {/* Status Bar */}
                    <div style={{
                        padding: '12px 16px',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '0.75rem', color: '#94a3b8',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'rgba(255,255,255,0.02)'
                    }}>
                        {state === 'scanning' && (
                            <>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee' }} />
                                <span>Analyse des tableaux horaires en cours...</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ─── RESULTATS ─── */}
            {state === 'done' && result && (
                <>
                    {/* Success Card */}
                    <div style={{
                        padding: '20px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, rgba(34,211,238,0.05) 0%, rgba(34,211,238,0.02) 100%)',
                        border: '1px solid rgba(34,211,238,0.2)',
                        marginBottom: '24px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
                            <CheckCircle size={24} color="#22d3ee" style={{ marginTop: '2px' }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9' }}>
                                    Analyse terminée
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                                    {fileName}
                                </div>
                            </div>
                            <button
                                onClick={reset}
                                style={{
                                    background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%',
                                    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer'
                                }}>
                                <X size={16} color="#94a3b8" />
                            </button>
                        </div>

                        {/* Stat Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            <StatBox label="Lignes Lues" value={result.total} color="#94a3b8" />
                            <StatBox label="Shifts Trouvés" value={result.matched} color="#22d3ee" highlight />
                            <StatBox
                                label="Confiance"
                                value={result.total > 0 ? `${Math.round(result.matched / Math.max(result.total, 1) * 100)}%` : '—'}
                                color={result.matched / Math.max(result.total, 1) > 0.8 ? '#34d399' : '#f59e0b'}
                            />
                        </div>
                    </div>

                    {/* Preview List */}
                    {Object.entries(result.shifts).length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                                Aperçu des données ({Object.keys(result.shifts).length})
                            </div>
                            <div style={{
                                maxHeight: '240px', overflowY: 'auto',
                                borderRadius: '16px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                background: 'rgba(15, 23, 42, 0.6)',
                            }}>
                                {Object.entries(result.shifts)
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([date, shift]) => (
                                        <div key={date} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '12px 16px',
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            fontSize: '0.8rem',
                                        }}>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <span style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums', width: '80px' }}>
                                                    {date.split('-').reverse().join('/')}
                                                </span>
                                                {shift.status === 'TRAVAIL' ? (
                                                    <span style={{ color: '#f1f5f9', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                        {shift.start} → {shift.end}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>{shift.status}</span>
                                                )}
                                            </div>
                                            {shift.pauses && shift.pauses.length > 0 && (
                                                <div style={{ fontSize: '0.7rem', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {shift.pauses.length} pause{shift.pauses.length > 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                        <button
                            onClick={reset}
                            style={{
                                padding: '16px', borderRadius: '16px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                            }}
                        >
                            Ignorer
                        </button>
                        <button
                            onClick={handleConfirmImport}
                            disabled={result.matched === 0}
                            style={{
                                padding: '16px', borderRadius: '16px',
                                background: result.matched > 0
                                    ? '#22d3ee'
                                    : 'rgba(255,255,255,0.05)',
                                border: 'none',
                                color: result.matched > 0 ? '#0f172a' : '#64748b',
                                fontSize: '0.9rem', fontWeight: 800,
                                cursor: result.matched > 0 ? 'pointer' : 'not-allowed',
                                boxShadow: result.matched > 0 ? '0 4px 20px rgba(34,211,238,0.25)' : 'none',
                                opacity: result.matched > 0 ? 1 : 0.5
                            }}
                        >
                            Confirmer l'importation
                        </button>
                    </div>
                </>
            )}

            {/* ─── INFO ─── */}
            {state === 'idle' && (
                <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
                        Instructions
                    </div>
                    {[
                        { icon: '1', text: 'Récupérez votre "Décompte des Heures" au format PDF.' },
                        { icon: '2', text: 'Déposez le fichier ci-dessus.' },
                        { icon: '3', text: 'Vérifiez les données extraites avant de valider.' },
                    ].map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                            <div style={{
                                width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', flexShrink: 0
                            }}>
                                {step.icon}
                            </div>
                            <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{step.text}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

function StatBox({ label, value, color, highlight = false }: { label: string; value: number | string; color: string; highlight?: boolean }) {
    return (
        <div style={{
            background: highlight ? `${color}10` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${highlight ? `${color}30` : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '16px', padding: '12px', textAlign: 'center',
        }}>
            <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                {label}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {value}
            </div>
        </div>
    );
}

export default ImportView;
