import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';

interface MagicDropzoneProps {
    onFileAccepted: (file: File) => void;
    isProcessing: boolean;
}

export default function MagicDropzone({ onFileAccepted, isProcessing }: MagicDropzoneProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFileAccepted(acceptedFiles[0]);
        }
    }, [onFileAccepted]);

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: false,
        disabled: isProcessing
    });

    return (
        <div className="magic-dropzone-container" style={{ position: 'relative', zIndex: 10 }}>
            <motion.div
                {...getRootProps()}
                initial={{ scale: 1, opacity: 0.9 }}
                animate={{
                    scale: isDragActive ? 1.02 : 1,
                    opacity: 1,
                    borderColor: isDragActive ? 'var(--electric-indigo)' : 'var(--glass-border)',
                    boxShadow: isDragActive ? '0 0 30px rgba(99, 102, 241, 0.4)' : 'none'
                }}
                whileHover={{ scale: 1.01, borderColor: 'var(--electric-indigo)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{
                    background: 'var(--glass-card)',
                    backdropFilter: 'blur(10px)',
                    border: '2px dashed var(--glass-border)',
                    borderRadius: '24px',
                    padding: '2rem',
                    cursor: isProcessing ? 'wait' : 'pointer',
                    textAlign: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                }}
            >
                <input {...getInputProps()} />

                {/* BACKGROUND GLOW */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
                    pointerEvents: 'none'
                }} />

                <AnimatePresence mode='wait'>
                    {isProcessing ? (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{ position: 'relative', zIndex: 2 }}
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                style={{ display: 'inline-block', marginBottom: '1rem' }}
                            >
                                <Sparkles size={48} className="text-gradient" />
                            </motion.div>
                            <h3 className="text-gradient" style={{ margin: 0, fontSize: '1.2rem' }}>ANALYSE INTELLIGENTE...</h3>
                            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-dim)', fontSize: '0.9rem' }}>Décodage de votre planning en cours</p>
                        </motion.div>
                    ) : isDragActive ? (
                        <motion.div
                            key="drag"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            style={{ position: 'relative', zIndex: 2 }}
                        >
                            <div style={{
                                background: 'rgba(99, 102, 241, 0.2)',
                                width: '80px', height: '80px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1rem'
                            }}>
                                <FileUp size={40} color="var(--electric-indigo)" />
                            </div>
                            <h3 style={{ margin: 0, color: 'white' }}>LÂCHEZ LE FICHIER !</h3>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ position: 'relative', zIndex: 2 }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', gap: '1rem' }}>
                                {/* Icons floating */}
                                <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                                    <FileUp size={32} className="text-dim" />
                                </motion.div>
                            </div>
                            <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>Déposez votre Planning PDF</h3>
                            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                                L'IA détectera automatiquement vos horaires.<br />
                                <span style={{ opacity: 0.7 }}>(ou cliquez sur une date pour saisir manuellement)</span>
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

            </motion.div>
        </div>
    );
}
