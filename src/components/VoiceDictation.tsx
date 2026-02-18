
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Mic, MicOff, Check, X, AlertCircle } from 'lucide-react';
import { parseVocalShift } from '../utils/nlpParser';
import { DayShift } from '../types';
import { formatDuration } from '../utils/calculator';

interface VoiceDictationProps {
    onApply: (updates: Partial<DayShift>) => void;
    onClose: () => void;
}

// Check for SpeechRecognition support
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const VoiceDictation: React.FC<VoiceDictationProps> = ({ onApply, onClose }) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [parsed, setParsed] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const recognition = useMemo(() => {
        if (!SpeechRecognition) return null;
        const rec = new SpeechRecognition();
        rec.lang = 'fr-FR';
        rec.continuous = true;
        rec.interimResults = true;
        return rec;
    }, []);

    useEffect(() => {
        if (!recognition) {
            setError("La dictée vocale n'est pas supportée par ce navigateur.");
            return;
        }

        recognition.onresult = (event: any) => {
            let currentTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                currentTranscript += event.results[i][0].transcript;
            }
            setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech Recognition Error', event.error);
            if (event.error === 'not-allowed') {
                setError("Microphone non autorisé. Vérifie tes paramètres.");
            } else {
                setError("Une erreur est survenue lors de l'écoute.");
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };
    }, [recognition]);

    const toggleListening = () => {
        if (isListening) {
            recognition?.stop();
            processTranscript();
        } else {
            setTranscript('');
            setParsed(null);
            setError(null);
            recognition?.start();
            setIsListening(true);
        }
    };

    const processTranscript = () => {
        if (!transcript) return;
        const result = parseVocalShift(transcript);
        setParsed(result);
    };

    const handleApply = () => {
        if (!parsed) return;

        // We only apply the basic shift data. 
        // If locations are missing, the user will be prompted in the UI later or we can handle it here.
        onApply({
            status: parsed.status,
            start: parsed.start,
            end: parsed.end,
            pauses: parsed.pauses.map((p: any) => ({
                ...p,
                // Fallback type if needed
                type: p.type || 'EXTERIEUR'
            })),
            isNight: parsed.isNight
        });
        onClose();
    };

    if (!SpeechRecognition && !error) {
        setError("Désolé, ton navigateur ne supporte pas la reconnaissance vocale.");
    }

    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            padding: '24px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
            marginTop: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <button
                    onClick={toggleListening}
                    style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: isListening ? '#ef4444' : 'var(--accent)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: isListening ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 0 20px rgba(99, 102, 241, 0.4)',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        transform: isListening ? 'scale(1.1)' : 'scale(1)',
                        position: 'relative'
                    }}
                >
                    {isListening ? <MicOff size={32} color="white" /> : <Mic size={32} color="white" />}
                    {isListening && (
                        <div style={{
                            position: 'absolute',
                            inset: '-10px',
                            border: '2px solid #ef4444',
                            borderRadius: '50%',
                            animation: 'pulse 1.5s infinite'
                        }} />
                    )}
                </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>
                    {isListening ? 'À ton écoute...' : transcript ? 'En attente de validation' : 'Appuie pour dicter ta journée'}
                </div>

                {transcript && (
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '12px',
                        borderRadius: '12px',
                        fontStyle: 'italic',
                        color: '#e2e8f0',
                        fontSize: '0.9rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        marginBottom: '16px'
                    }}>
                        "{transcript}"
                    </div>
                )}

                {error && (
                    <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
            </div>

            {parsed && (
                <div style={{ textAlign: 'left', background: 'rgba(34, 211, 238, 0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(34, 211, 238, 0.2)', marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#22d3ee', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
                        Résumé détecté
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {parsed.start && parsed.end && (
                            <div style={{ fontSize: '0.9rem', color: '#f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Service :</span>
                                <span style={{ fontWeight: 700 }}>{parsed.start} — {parsed.end}</span>
                            </div>
                        )}

                        {parsed.pauses.map((p: any, i: number) => (
                            <div key={i} style={{ fontSize: '0.85rem', color: '#f1f5f9', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                                <span style={{ color: '#94a3b8' }}>Pause {i + 1} :</span>
                                <span style={{ fontWeight: 600 }}>
                                    {p.start} → {p.end} ({p.type})
                                </span>
                            </div>
                        ))}

                        {parsed.needsLocationSelection.length > 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                                * Lieu de pause à préciser manuellement
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: parsed ? '1fr 2fr' : '1fr', gap: '12px' }}>
                <button onClick={onClose} style={{
                    padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: 'none', cursor: 'pointer', fontWeight: 600
                }}>
                    {parsed ? 'Annuler' : 'Fermer'}
                </button>
                {parsed && (
                    <button
                        onClick={handleApply}
                        style={{
                            padding: '12px', borderRadius: '12px', background: '#22d3ee', color: '#0f172a', border: 'none', cursor: 'pointer', fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <Check size={18} /> Appliquer au shift
                    </button>
                )}
            </div>

            <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 0.3; }
          100% { transform: scale(1); opacity: 0.8; }
        }
      `}</style>
        </div>
    );
};
