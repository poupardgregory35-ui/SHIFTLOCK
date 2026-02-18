import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, RefreshCw, Calendar, Clock, ShieldCheck, Check } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AppState, Role, SalaryLevel } from '../types';
import { SALARY_GRID_2026 } from '../constants';

interface SettingsViewProps {
    state: AppState;
    setRootDate: (date: string) => void;
    setModeCalcul: (mode: 7 | 14 | 42) => void;
    setRole: (role: Role) => void;
    setLevel: (level: SalaryLevel) => void;
    setContractHours: (hours: number) => void;
    resetSettings: () => void;
}

export default function SettingsView({
    state,
    setRootDate,
    setModeCalcul,
    setRole,
    setLevel,
    setContractHours,
    resetSettings
}: SettingsViewProps) {
    const [showSavedContext, setShowSavedContext] = useState(false);

    // Simulation d'un effet "Sauvegardé" à chaque changement de state
    useEffect(() => {
        setShowSavedContext(true);
        const timer = setTimeout(() => setShowSavedContext(false), 2000);
        return () => clearTimeout(timer);
    }, [state]);

    const cycleEndDate = addDays(parseISO(state.rootDate), state.modeCalcul - 1);
    const formattedCycleStart = format(parseISO(state.rootDate), 'EEEE d MMMM yyyy', { locale: fr });
    const formattedCycleEnd = format(cycleEndDate, 'EEEE d MMMM yyyy', { locale: fr });

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>

            {/* Header Premium */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        padding: '0.8rem',
                        borderRadius: '50%',
                        boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)'
                    }}>
                        <SettingsIcon size={24} color="var(--electric-indigo)" />
                    </div>
                    <div>
                        <h2 className="text-gradient" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>Centre de Contrôle</h2>
                        <div className={`text-dim transition-opacity ${showSavedContext ? 'opacity-100' : 'opacity-50'}`} style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {showSavedContext ? <><Check size={12} color="var(--success)" /> Paramètres synchronisés</> : 'Configuration Engine v2.0'}
                        </div>
                    </div>
                </div>
                <button onClick={resetSettings} className="neon-button secondary" style={{ padding: '0.6rem', borderRadius: '50%' }} title="Reset Factory">
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* ANCRE TEMPORELLE */}
            <section>
                <h3 className="section-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <Calendar size={14} /> Ancre Temporelle
                </h3>
                <div className="glass-card">
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700 }}>Date de début de cycle</label>
                    <input
                        type="date"
                        value={state.rootDate}
                        onChange={(e) => setRootDate(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'var(--bg-accent)',
                            border: '1px solid var(--glass-border)',
                            color: 'white',
                            padding: '1.2rem', // Large touch area
                            borderRadius: 'var(--radius-md)',
                            fontSize: '1.1rem',
                            outline: 'none',
                            marginBottom: '1rem'
                        }}
                    />
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--electric-indigo)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>CYCLE ACTUEL CALCULÉ</div>
                        <div style={{ fontSize: '0.9rem', marginTop: '0.3rem' }}>
                            Du <span style={{ color: 'white', fontWeight: 700 }}>{formattedCycleStart}</span> au <span style={{ color: 'white', fontWeight: 700 }}>{formattedCycleEnd}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* MODE DE CALCUL */}
            <section>
                <h3 className="section-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <Clock size={14} /> Mode de Calcul
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {[
                        { mode: 7, label: 'HEBDO', sub: 'Semaine (7j)' },
                        { mode: 14, label: 'STANDARD', sub: 'Quatorzaine (14j)' }
                    ].map((item) => (
                        <button
                            key={item.mode}
                            onClick={() => setModeCalcul(item.mode as any)}
                            className={`glass-card ${state.modeCalcul === item.mode ? 'active-mode' : ''}`}
                            style={{
                                padding: '1rem 0.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: state.modeCalcul === item.mode ? '1px solid var(--neon-orange)' : '1px solid var(--glass-border)',
                                background: state.modeCalcul === item.mode ? 'rgba(255, 140, 0, 0.1)' : 'var(--glass-bg)',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: state.modeCalcul === item.mode ? 'var(--neon-orange)' : 'white' }}>{item.label}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>{item.sub}</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* OBJECTIF CONTRACTUEL */}
            <section>
                <h3 className="section-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <ShieldCheck size={14} /> Objectif Contractuel (Mensuel)
                </h3>
                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: 700 }}>Base Contrat</span>
                        <span className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: 900 }}>{state.contractHours}h</span>
                    </div>
                    <input
                        type="range"
                        min="35"
                        max="200"
                        step="1"
                        value={state.contractHours}
                        onChange={(e) => setContractHours(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--neon-orange)', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        <span>35h</span>
                        <span>152h</span>
                        <span>200h</span>
                    </div>
                </div>
            </section>

            {/* PROFIL PRO */}
            <section>
                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.2rem' }}>
                    <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>Rôle Professionnel</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Définit le taux horaire</div>
                    </div>
                    <select
                        value={state.role}
                        onChange={(e) => setRole(e.target.value as any)}
                        style={{
                            background: 'var(--bg-accent)', border: '1px solid var(--glass-border)',
                            color: 'white', padding: '0.8rem', borderRadius: 'var(--radius-md)', outline: 'none',
                            fontWeight: 700
                        }}
                    >
                        <option value="DEA">DEA (12.79€)</option>
                        <option value="Auxiliaire">Auxiliaire (12.02€)</option>
                    </select>
                </div>
            </section>

        </div>
    );
}
