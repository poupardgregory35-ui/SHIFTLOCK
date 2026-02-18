
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    X, Plus, Trash2, Moon, Clock, MessageSquare,
    Coffee, Mic, MicOff, Check, AlertCircle, Edit3
} from 'lucide-react';
import type { DayShift, DayStatus, Pause, PauseType } from '../types';
import { parseQuickTime, formatDuration, timeToMinutes } from '../utils/calculator';
import { ALLOWANCES, MEAL_WINDOWS } from '../types';

interface BottomSheetProps {
    date: string;
    shift: DayShift;
    onSave: (updates: Partial<DayShift>) => void;
    onClose: () => void;
}

// ─── NLP PARSER INTÉGRÉ ──────────────────────────────────────────────────────

function parseTime(text: string): string | null {
    // "7h", "7h30", "07:30", "17h45"
    const m = text.match(/(\d{1,2})[h:](\d{0,2})/i);
    if (!m) return null;
    const h = m[1].padStart(2, '0');
    const min = (m[2] || '00').padEnd(2, '0');
    if (parseInt(h) > 23 || parseInt(min) > 59) return null;
    return `${h}:${min}`;
}

function extractAllTimes(text: string): Array<{ time: string; pos: number }> {
    const results: Array<{ time: string; pos: number }> = [];
    const regex = /(\d{1,2})[h:](\d{0,2})/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const h = match[1].padStart(2, '0');
        const min = (match[2] || '00').padEnd(2, '0');
        if (parseInt(h) <= 23 && parseInt(min) <= 59) {
            results.push({ time: `${h}:${min}`, pos: match.index });
        }
    }
    return results;
}

function detectPauseType(context: string): PauseType {
    const lower = context.toLowerCase();
    if (/bureau|entreprise|boulot|travail/.test(lower)) return 'ENTREPRISE';
    if (/dehors|ext[eé]rieur|sortie|rue/.test(lower)) return 'EXTERIEUR';
    if (/maison|domicile|chez moi|home/.test(lower)) return 'DOMICILE';
    return 'ENTREPRISE'; // défaut
}

function genId() { return Math.random().toString(36).slice(2, 9); }

interface ParsedVoice {
    start?: string;
    end?: string;
    pauses: Pause[];
    isNight: boolean;
    status: DayStatus;
}

function parseVocalShift(transcript: string): ParsedVoice {
    const text = transcript.toLowerCase();
    const times = extractAllTimes(text);

    let start: string | undefined;
    let end: string | undefined;
    const pauses: Pause[] = [];

    // Détecter heure de début
    const startMatch = text.match(/commenc[eé é].*?(\d{1,2}[h:]\d{0,2})|d[eé]but.*?(\d{1,2}[h:]\d{0,2})|pris.*?service.*?(\d{1,2}[h:]\d{0,2})/i);
    if (startMatch) {
        start = parseTime(startMatch[0]) || undefined;
    } else if (times.length > 0) {
        start = times[0].time;
    }

    // Détecter heure de fin
    const endMatch = text.match(/fini.*?(\d{1,2}[h:]\d{0,2})|termin[eé ].*?(\d{1,2}[h:]\d{0,2})|jusqu'[aà].*?(\d{1,2}[h:]\d{0,2})/i);
    if (endMatch) {
        end = parseTime(endMatch[0]) || undefined;
    } else if (times.length > 1) {
        end = times[times.length - 1].time;
    }

    // Détecter pauses
    // Pattern "pause de X à Y" ou "coupure de X à Y"
    const pauseRegex = /(?:pause|coupure|rep[ao]s|d[eî]ner|d[eé]jeuner|casse-?cro[uû]te|petit[ -]d[eé]j).*?(\d{1,2}[h:]\d{0,2}).*?[aà].*?(\d{1,2}[h:]\d{0,2})/gi;
    let pauseMatch;
    while ((pauseMatch = pauseRegex.exec(text)) !== null) {
        const pStart = parseTime(pauseMatch[1]);
        const pEnd = parseTime(pauseMatch[2]);
        if (pStart && pEnd) {
            // Contexte autour de la pause pour détecter le type
            const ctx = text.slice(Math.max(0, pauseMatch.index - 20), pauseMatch.index + pauseMatch[0].length + 20);
            pauses.push({
                id: genId(),
                start: pStart,
                end: pEnd,
                type: detectPauseType(ctx),
            });
        }
    }

    // Si pas de pause trouvée mais 3+ heures → pause implicite entre les heures intermédiaires
    if (pauses.length === 0 && times.length >= 3) {
        // Heures du milieu = pauses potentielles
        for (let i = 1; i < times.length - 2; i += 2) {
            const pStart = times[i].time;
            const pEnd = times[i + 1]?.time;
            if (pEnd) {
                pauses.push({ id: genId(), start: pStart, end: pEnd, type: 'ENTREPRISE' });
            }
        }
    }

    // Nuit ?
    const isNight = /nuit|nocturne|minuit/.test(text) ||
        (start ? parseInt(start.split(':')[0]) >= 21 : false) ||
        (end ? parseInt(end.split(':')[0]) <= 7 : false);

    return { start, end, pauses, isNight, status: 'TRAVAIL' };
}

// ─── COMPOSANTS ──────────────────────────────────────────────────────────────

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const DAY_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const STATUS_OPTIONS: { value: DayStatus; label: string; color: string }[] = [
    { value: 'TRAVAIL', label: '🚑 Travail', color: '#22d3ee' },
    { value: 'REPOS', label: '💤 Repos', color: '#94a3b8' },
    { value: 'CP', label: '🏖️ Congé', color: '#a78bfa' },
    { value: 'MALADIE', label: '🤒 Maladie', color: '#f87171' },
    { value: 'FORMATION', label: '📚 Formation', color: '#34d399' },
    { value: 'FERIE', label: '🎉 Férié', color: '#fbbf24' },
];

const PAUSE_TYPES: { value: PauseType; label: string; icon: string }[] = [
    { value: 'ENTREPRISE', label: 'Entreprise', icon: '🏢' },
    { value: 'EXTERIEUR', label: 'Extérieur', icon: '🌳' },
    { value: 'DOMICILE', label: 'Domicile', icon: '🏠' },
];

function TimeInput({ value, onChange, placeholder, label }: {
    value: string; onChange: (v: string) => void; placeholder?: string; label?: string;
}) {
    const [raw, setRaw] = useState(value || '');
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { setRaw(value || ''); }, [value]);

    const handleBlur = () => {
        const parsed = parseQuickTime(raw);
        if (parsed) { setRaw(parsed); onChange(parsed); }
        else if (!raw) onChange('');
    };

    return (
        <div style={{ width: '100%' }}>
            {label && <div style={{ fontSize: '0.6rem', color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>}
            <input
                ref={ref}
                type="text"
                inputMode="numeric"
                value={raw}
                placeholder={placeholder || '--:--'}
                onChange={e => setRaw(e.target.value)}
                onBlur={handleBlur}
                onFocus={() => ref.current?.select()}
                onKeyDown={e => { if (e.key === 'Enter') ref.current?.blur(); }}
                style={{
                    width: '100%', padding: '12px',
                    background: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px', color: '#f1f5f9',
                    fontSize: '1.2rem', fontWeight: 700,
                    textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                    outline: 'none', caretColor: '#22d3ee',
                }}
            />
        </div>
    );
}

// ─── BOTTOM SHEET PRINCIPAL ───────────────────────────────────────────────────

export const BottomSheet: React.FC<BottomSheetProps> = ({ date, shift, onSave, onClose }) => {
    const [local, setLocal] = useState<DayShift>({ ...shift, pauses: [...(shift.pauses || [])] });
    const [visible, setVisible] = useState(false);
    const [mode, setMode] = useState<'voice' | 'manual'>('voice');

    // Voice states
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [parsed, setParsed] = useState<ParsedVoice | null>(null);
    const [voiceError, setVoiceError] = useState<string | null>(null);

    const recognition = useMemo(() => {
        if (!SpeechRecognition) return null;
        const rec = new SpeechRecognition();
        rec.lang = 'fr-FR';
        rec.continuous = false;
        rec.interimResults = true;
        return rec;
    }, []);

    const d = new Date(date + 'T12:00:00');
    const label = `${DAY_FULL[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;

    useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

    useEffect(() => {
        if (!recognition) return;
        recognition.onresult = (event: any) => {
            let t = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                t += event.results[i][0].transcript;
            }
            setTranscript(t);
        };
        recognition.onerror = (event: any) => {
            setVoiceError(event.error === 'not-allowed'
                ? 'Micro non autorisé — vérifie les permissions du navigateur'
                : 'Erreur micro — réessaie');
            setIsListening(false);
        };
        recognition.onend = () => {
            setIsListening(false);
        };
    }, [recognition]);

    // Process transcript when listening stops
    useEffect(() => {
        if (!isListening && transcript) {
            const result = parseVocalShift(transcript);
            if (!result.start && !result.end && result.pauses.length === 0) {
                setVoiceError("Rien compris — précise : 'commencé à 7h, fini à 17h45'");
            } else {
                setParsed(result);
                setVoiceError(null);
            }
        }
    }, [isListening, transcript]);

    const toggleListening = () => {
        if (isListening) {
            recognition?.stop();
        } else {
            setTranscript('');
            setParsed(null);
            setVoiceError(null);
            recognition?.start();
            setIsListening(true);
        }
    };

    const handleVoiceSave = () => {
        if (!parsed) return;
        onSave({
            status: 'TRAVAIL',
            start: parsed.start,
            end: parsed.end,
            pauses: parsed.pauses,
            isNight: parsed.isNight,
        });
        setVisible(false);
        setTimeout(onClose, 280);
    };

    const handleManualSave = () => {
        onSave(local);
        setVisible(false);
        setTimeout(onClose, 280);
    };

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 280);
    };

    // TTE temps réel (mode manuel)
    const startMin = timeToMinutes(local.start || '');
    let endMin = timeToMinutes(local.end || '');
    if (local.start && local.end && endMin <= startMin) endMin += 24 * 60;
    const amplitude = (startMin && local.end) ? Math.max(0, endMin - startMin) : 0;
    const pauseTotal = local.pauses.reduce((acc, p) => {
        if (!p.start || !p.end) return acc;
        const ps = timeToMinutes(p.start);
        let pe = timeToMinutes(p.end);
        if (pe <= ps) pe += 24 * 60;
        return acc + Math.max(0, pe - ps);
    }, 0);
    const tte = Math.max(0, amplitude - pauseTotal);

    const addPause = () => setLocal(prev => ({
        ...prev, pauses: [...prev.pauses, { id: genId(), start: '', end: '', type: 'ENTREPRISE' }]
    }));
    const updatePause = (id: string, updates: Partial<Pause>) =>
        setLocal(prev => ({ ...prev, pauses: prev.pauses.map(p => p.id === id ? { ...p, ...updates } : p) }));
    const removePause = (id: string) =>
        setLocal(prev => ({ ...prev, pauses: prev.pauses.filter(p => p.id !== id) }));

    return (
        <>
            {/* Backdrop */}
            <div onClick={handleClose} style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)', zIndex: 9998,
                opacity: visible ? 1 : 0, transition: 'opacity 0.28s ease',
            }} />

            {/* Sheet */}
            <div style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999,
                background: '#0f172a',
                borderRadius: '24px 24px 0 0',
                maxHeight: '92vh', display: 'flex', flexDirection: 'column',
                transform: visible ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
            }}>
                {/* Scrollable */}
                <div style={{ overflowY: 'auto', padding: '0 20px', flex: 1 }}>

                    {/* Handle + Header */}
                    <div style={{
                        position: 'sticky', top: 0, background: '#0f172a',
                        zIndex: 10, paddingTop: '12px', paddingBottom: '12px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Shift</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9' }}>{label}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {/* Toggle mode */}
                                <button
                                    onClick={() => setMode(m => m === 'voice' ? 'manual' : 'voice')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '6px 12px', borderRadius: '20px',
                                        background: mode === 'voice' ? 'rgba(99,102,241,0.15)' : 'rgba(34,211,238,0.1)',
                                        border: `1px solid ${mode === 'voice' ? 'rgba(99,102,241,0.3)' : 'rgba(34,211,238,0.2)'}`,
                                        color: mode === 'voice' ? '#818cf8' : '#22d3ee',
                                        fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                                    }}
                                >
                                    {mode === 'voice' ? <><Edit3 size={12} /> Manuel</> : <><Mic size={12} /> Vocal</>}
                                </button>
                                <button onClick={handleClose} style={{
                                    background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%',
                                    width: '34px', height: '34px', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', cursor: 'pointer',
                                }}>
                                    <X size={18} color="#64748b" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ─── MODE VOCAL ─── */}
                    {mode === 'voice' && (
                        <div style={{ paddingTop: '32px', paddingBottom: '120px', textAlign: 'center' }}>

                            {/* Bouton micro */}
                            <div style={{ marginBottom: '28px' }}>
                                <button
                                    onClick={toggleListening}
                                    disabled={!SpeechRecognition || isListening}
                                    style={{
                                        width: '96px', height: '96px', borderRadius: '50%',
                                        background: isListening
                                            ? 'radial-gradient(circle, #ef4444, #dc2626)'
                                            : 'radial-gradient(circle, #6366f1, #4f46e5)',
                                        border: 'none', cursor: SpeechRecognition ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto',
                                        boxShadow: isListening
                                            ? '0 0 0 16px rgba(239,68,68,0.1), 0 0 40px rgba(239,68,68,0.3)'
                                            : '0 0 0 12px rgba(99,102,241,0.08), 0 0 30px rgba(99,102,241,0.25)',
                                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        transform: isListening ? 'scale(1.08)' : 'scale(1)',
                                    }}
                                >
                                    {isListening
                                        ? <MicOff size={36} color="white" />
                                        : <Mic size={36} color="white" />
                                    }
                                </button>

                                <div style={{ marginTop: '16px', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                                    {!SpeechRecognition
                                        ? 'Navigateur non compatible'
                                        : isListening
                                            ? '🔴 Écoute en cours…'
                                            : parsed
                                                ? '✅ Dictée analysée'
                                                : 'Appuie et dicte ta journée'
                                    }
                                </div>

                                {!isListening && !parsed && !voiceError && (
                                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#334155', fontStyle: 'italic' }}>
                                        Ex: "Commencé à 7h, pause repas bureau 13h-13h45, fini à 17h45"
                                    </div>
                                )}
                            </div>

                            {/* Transcript */}
                            {transcript && (
                                <div style={{
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '14px', padding: '14px', marginBottom: '16px',
                                    fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'left',
                                }}>
                                    "{transcript}"
                                </div>
                            )}

                            {/* Erreur */}
                            {voiceError && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                                    color: '#f87171', fontSize: '0.75rem', marginBottom: '16px',
                                }}>
                                    <AlertCircle size={14} /> {voiceError}
                                </div>
                            )}

                            {/* Résumé parsé */}
                            {parsed && (
                                <div style={{
                                    background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.2)',
                                    borderRadius: '16px', padding: '16px', textAlign: 'left', marginBottom: '20px',
                                }}>
                                    <div style={{ fontSize: '0.6rem', color: '#22d3ee', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                                        Résumé détecté
                                    </div>

                                    {parsed.start && parsed.end && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#475569' }}>Service</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                                                {parsed.start} → {parsed.end}
                                            </span>
                                        </div>
                                    )}

                                    {parsed.isNight && (
                                        <div style={{ fontSize: '0.7rem', color: '#818cf8', marginBottom: '8px' }}>🌙 Shift de nuit détecté</div>
                                    )}

                                    {parsed.pauses.map((p, i) => (
                                        <div key={i} style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)',
                                            marginTop: '8px',
                                        }}>
                                            <span style={{ fontSize: '0.75rem', color: '#475569' }}>Pause {i + 1} · {p.type}</span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                                                {p.start} → {p.end}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── MODE MANUEL ─── */}
                    {mode === 'manual' && (
                        <div style={{ paddingTop: '20px', paddingBottom: '120px' }}>

                            {/* Statuts */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
                                {STATUS_OPTIONS.map(opt => {
                                    const isActive = local.status === opt.value;
                                    return (
                                        <button key={opt.value} onClick={() => setLocal(p => ({ ...p, status: opt.value }))} style={{
                                            padding: '12px 6px', borderRadius: '12px',
                                            border: `1px solid ${isActive ? opt.color : 'rgba(255,255,255,0.05)'}`,
                                            background: isActive ? `${opt.color}18` : 'rgba(255,255,255,0.02)',
                                            color: isActive ? opt.color : '#64748b',
                                            fontSize: '0.72rem', fontWeight: isActive ? 700 : 400, cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                        }}>
                                            <span style={{ fontSize: '1.1rem' }}>{opt.label.split(' ')[0]}</span>
                                            <span>{opt.label.split(' ').slice(1).join(' ')}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {local.status === 'TRAVAIL' && (
                                <>
                                    {/* Horaires */}
                                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', marginBottom: '16px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                            <TimeInput label="Début" value={local.start || ''} onChange={v => setLocal(p => ({ ...p, start: v }))} placeholder="07:00" />
                                            <TimeInput label="Fin" value={local.end || ''} onChange={v => setLocal(p => ({ ...p, end: v }))} placeholder="17:00" />
                                        </div>

                                        {/* Toggle nuit */}
                                        <div onClick={() => setLocal(p => ({ ...p, isNight: !p.isNight }))} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                                            background: local.isNight ? 'rgba(99,102,241,0.1)' : 'transparent',
                                            border: `1px solid ${local.isNight ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)'}`,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Moon size={15} color={local.isNight ? '#818cf8' : '#334155'} />
                                                <span style={{ fontSize: '0.82rem', color: local.isNight ? '#818cf8' : '#475569' }}>Shift de nuit</span>
                                            </div>
                                            <div style={{ width: '36px', height: '20px', background: local.isNight ? '#6366f1' : '#1e293b', borderRadius: '10px', position: 'relative', transition: 'background 0.2s' }}>
                                                <div style={{ position: 'absolute', top: '2px', left: local.isNight ? '18px' : '2px', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transition: 'left 0.2s' }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* TTE live */}
                                    {tte > 0 && (
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                            background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.15)',
                                            borderRadius: '14px', padding: '14px 0', marginBottom: '16px',
                                        }}>
                                            {[
                                                { label: 'Amplitude', value: formatDuration(amplitude), color: '#94a3b8' },
                                                { label: 'Pauses', value: `-${formatDuration(pauseTotal)}`, color: '#f87171' },
                                                { label: 'TTE', value: formatDuration(tte), color: '#22d3ee' },
                                            ].map((s, i) => (
                                                <div key={i} style={{ textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                                    <div style={{ fontSize: '0.55rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                                                    <div style={{ fontSize: i === 2 ? '1.3rem' : '1rem', fontWeight: 900, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Pauses */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pauses</span>
                                            <button onClick={addPause} style={{
                                                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                                                borderRadius: '8px', padding: '5px 10px',
                                                color: '#818cf8', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                            }}>
                                                <Plus size={12} /> Ajouter
                                            </button>
                                        </div>

                                        {local.pauses.map((pause) => (
                                            <div key={pause.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '8px' }}>
                                                        {(() => {
                                                            const startMin = timeToMinutes(pause.start);
                                                            const isMealTime = MEAL_WINDOWS.some(w => startMin >= w.start && startMin <= w.end);
                                                            const isMeal = pause.isMeal ?? isMealTime;

                                                            if (isMeal) {
                                                                return (
                                                                    <>
                                                                        <button onClick={() => updatePause(pause.id, { type: 'EXTERIEUR' })} style={{
                                                                            padding: '6px 12px', borderRadius: '6px', border: 'none',
                                                                            background: pause.type === 'EXTERIEUR' ? '#22c55e' : 'transparent',
                                                                            color: pause.type === 'EXTERIEUR' ? '#0f172a' : '#64748b',
                                                                            fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                                                                        }}>🍽️ IR {ALLOWANCES.IR}€</button>
                                                                        <button onClick={() => updatePause(pause.id, { type: 'ENTREPRISE' })} style={{
                                                                            padding: '6px 12px', borderRadius: '6px', border: 'none',
                                                                            background: pause.type === 'ENTREPRISE' ? '#818cf8' : 'transparent',
                                                                            color: pause.type === 'ENTREPRISE' ? '#f1f5f9' : '#64748b',
                                                                            fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                                                                        }}>🏢 IRU {ALLOWANCES.IR_REDUIT}€</button>
                                                                    </>
                                                                );
                                                            }
                                                            return PAUSE_TYPES.map(pt => (
                                                                <button key={pt.value} onClick={() => updatePause(pause.id, { type: pt.value })} style={{
                                                                    padding: '4px 8px', borderRadius: '6px', border: 'none',
                                                                    background: pause.type === pt.value ? '#334155' : 'transparent',
                                                                    color: pause.type === pt.value ? '#f1f5f9' : '#475569',
                                                                    fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                                                                }}>{pt.icon} {pt.label}</button>
                                                            ));
                                                        })()}
                                                    </div>
                                                    <button onClick={() => removePause(pause.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                                        <Trash2 size={14} color="#ef4444" />
                                                    </button>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                    <TimeInput value={pause.start} onChange={v => updatePause(pause.id, { start: v })} placeholder="Début" />
                                                    <TimeInput value={pause.end} onChange={v => updatePause(pause.id, { end: v })} placeholder="Fin" />
                                                </div>
                                            </div>
                                        ))}

                                        {local.pauses.length === 0 && (
                                            <div style={{ padding: '16px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px', color: '#1e293b', fontSize: '0.8rem' }}>
                                                Aucune pause
                                            </div>
                                        )}
                                    </div>

                                    {/* Note */}
                                    <textarea value={local.note || ''} onChange={e => setLocal(p => ({ ...p, note: e.target.value }))}
                                        placeholder="Note..." rows={2} style={{
                                            width: '100%', padding: '12px', background: 'rgba(15,23,42,0.6)',
                                            border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px',
                                            color: '#94a3b8', fontSize: '0.85rem', resize: 'none', outline: 'none', fontFamily: 'inherit',
                                        }} />
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── FOOTER ACTIONS ─── */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '14px 20px 28px',
                    background: 'linear-gradient(to top, #0f172a 80%, transparent)',
                    display: 'grid',
                    gridTemplateColumns: parsed && mode === 'voice' ? '1fr 2fr' : '1fr 2fr',
                    gap: '10px',
                }}>
                    <button onClick={handleClose} style={{
                        padding: '15px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)', color: '#64748b',
                        fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                    }}>
                        Annuler
                    </button>

                    {mode === 'voice' ? (
                        <button
                            onClick={parsed ? handleVoiceSave : toggleListening}
                            disabled={isListening || (!SpeechRecognition)}
                            style={{
                                padding: '15px', borderRadius: '14px', border: 'none',
                                background: parsed
                                    ? '#22d3ee'
                                    : isListening
                                        ? 'rgba(239,68,68,0.8)'
                                        : 'rgba(99,102,241,0.8)',
                                color: parsed ? '#0f172a' : 'white',
                                fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                opacity: (!SpeechRecognition) ? 0.4 : 1,
                            }}
                        >
                            {parsed
                                ? <><Check size={18} /> Enregistrer</>
                                : isListening
                                    ? <><MicOff size={18} /> Arrêter</>
                                    : transcript ? <><Mic size={18} /> Réessayer</> : <><Mic size={18} /> Dicter</>
                            }
                        </button>
                    ) : (
                        <button onClick={handleManualSave} style={{
                            padding: '15px', borderRadius: '14px', background: '#22d3ee',
                            border: 'none', color: '#0f172a', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer',
                        }}>
                            Enregistrer
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

export default BottomSheet;
