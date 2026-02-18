import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { Conflict } from '../hooks/useMagicImport';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
    conflicts: Conflict[];
    onResolve: (date: string, choice: 'keep' | 'overwrite') => void;
    onResolveAll: (choice: 'keep' | 'overwrite') => void;
    onClose: () => void;
}

export default function ConflictSolver({ conflicts, onResolve, onResolveAll, onClose }: Props) {
    if (conflicts.length === 0) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pointerEvents: 'none' }}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', pointerEvents: 'auto' }}
                onClick={onClose}
            />

            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{
                    background: 'var(--bg-card)',
                    width: '100%',
                    maxWidth: '600px',
                    borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                    padding: '1.5rem',
                    borderTop: '1px solid var(--glass-border)',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    pointerEvents: 'auto',
                    position: 'relative'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                        width: '60px', height: '60px', borderRadius: '50%',
                        background: 'rgba(234, 179, 8, 0.1)', cursor: 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
                    }}>
                        <AlertTriangle size={30} color="var(--warning)" />
                    </div>
                    <h2 className="text-gradient" style={{ margin: 0, fontSize: '1.5rem' }}>
                        {conflicts.length} Conflit{conflicts.length > 1 ? 's' : ''} Détecté{conflicts.length > 1 ? 's' : ''}
                    </h2>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Le PDF contient des données différentes de votre saisie.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <button
                        onClick={() => onResolveAll('keep')}
                        className="neon-button secondary full-width"
                        style={{ fontSize: '0.8rem' }}
                    >
                        TOUT GARDER (IGNORER PDF)
                    </button>
                    <button
                        onClick={() => onResolveAll('overwrite')}
                        className="neon-button full-width"
                        style={{ fontSize: '0.8rem', background: 'var(--electric-indigo)', borderColor: 'var(--electric-indigo)' }}
                    >
                        TOUT REMPLACER
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {conflicts.map((c) => {
                        const dateObj = parseISO(c.date);
                        return (
                            <div key={c.date} className="glass-card" style={{ padding: '1rem', border: '1px solid var(--warning)' }}>
                                <div style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.8rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                                    {format(dateObj, 'EEEE d MMMM', { locale: fr })}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
                                    {/* EXISTING */}
                                    <div onClick={() => onResolve(c.date, 'keep')} style={{
                                        cursor: 'pointer', padding: '0.8rem', borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.05)', textAlign: 'center',
                                        border: '1px solid var(--glass-border)'
                                    }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>MA VERSION</div>
                                        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                                            {c.existing.start} - {c.existing.end}
                                        </div>
                                    </div>

                                    <ArrowRight size={20} className="text-dim" />

                                    {/* IMPORTED */}
                                    <div onClick={() => onResolve(c.date, 'overwrite')} style={{
                                        cursor: 'pointer', padding: '0.8rem', borderRadius: '12px',
                                        background: 'rgba(99, 102, 241, 0.1)', textAlign: 'center',
                                        border: '1px solid var(--electric-indigo)'
                                    }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--electric-indigo)', marginBottom: '0.3rem' }}>PDF</div>
                                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white' }}>
                                            {c.imported.start} - {c.imported.end}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </div>
    );
}
