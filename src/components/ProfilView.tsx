
import React, { useState, useEffect } from 'react';
import { Save, User, Calendar, Briefcase, Trash2, Check, CreditCard, RefreshCw } from 'lucide-react';
import type { UserProfile, Role } from '../types';
import { generateAllCycles } from '../utils/calculator';
import { HOURLY_RATES } from '../types'; // Correct path

interface ProfilViewProps {
    profile: UserProfile;
    shiftsCount: number;
    onUpdateProfile: (updates: Partial<UserProfile>) => void;
    onResetData: () => void;
}

const ROLE_LABELS: Record<Role, string> = {
    N1: 'Niveau 1 — 12,04€/h',
    N2: 'Niveau 2 — 12,16€/h',
    N3: 'Niveau 3 — 12,79€/h',
};

const ProfilView: React.FC<ProfilViewProps> = ({
    profile, shiftsCount, onUpdateProfile, onResetData
}) => {
    const [local, setLocal] = useState<UserProfile>({ ...profile });
    const [saved, setSaved] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Sync state if props change from outside
    useEffect(() => {
        setLocal(profile);
    }, [profile]);

    const hasChanges = JSON.stringify(local) !== JSON.stringify(profile);

    const handleSave = () => {
        onUpdateProfile(local);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    // Preview next few cycles
    const cycles = generateAllCycles(local.rootDate);
    // Pick next 3 cycles from today
    const today = new Date().toISOString().split('T')[0];
    const upcomingCycles = cycles.filter(c => c.end >= today).slice(0, 3);

    return (
        <div style={{ padding: '24px 20px', overflowY: 'auto', height: '100%', maxWidth: '600px', margin: '0 auto' }}>

            {/* ─── HEADER ─── */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '0.65rem', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>
                    Paramètres
                </div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                    Mon Profil
                </h2>
            </div>

            {/* ─── IDENTITY ─── */}
            <Section title="Identité" icon={<User size={16} color="#6366f1" />}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <InputGroup label="Prénom">
                        <input
                            type="text"
                            value={local.firstName}
                            onChange={e => setLocal(p => ({ ...p, firstName: e.target.value }))}
                            placeholder="Ex: Thomas"
                            style={inputStyle}
                        />
                    </InputGroup>
                    <InputGroup label="Nom">
                        <input
                            type="text"
                            value={local.lastName}
                            onChange={e => setLocal(p => ({ ...p, lastName: e.target.value }))}
                            placeholder="Ex: Durand"
                            style={inputStyle}
                        />
                    </InputGroup>
                </div>
                <InputGroup label="Entreprise">
                    <input
                        type="text"
                        value={local.company}
                        onChange={e => setLocal(p => ({ ...p, company: e.target.value }))}
                        placeholder="Ex: Ambulances de l'Ouest"
                        style={inputStyle}
                    />
                </InputGroup>
            </Section>

            {/* ─── JOB SETTINGS ─── */}
            <Section title="Contrat & Salaire" icon={<Briefcase size={16} color="#6366f1" />}>
                {/* Role Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                    <Label>Qualification</Label>
                    {(Object.keys(ROLE_LABELS) as Role[]).map(role => {
                        const isActive = local.role === role;
                        return (
                            <button
                                key={role}
                                onClick={() => setLocal(p => ({ ...p, role }))}
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '12px 14px', borderRadius: '10px',
                                    background: isActive ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
                                    color: isActive ? '#818cf8' : '#64748b',
                                    fontSize: '0.8rem', fontWeight: isActive ? 600 : 400,
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                <span>{ROLE_LABELS[role]}</span>
                                {isActive && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />}
                            </button>
                        );
                    })}
                </div>

                {/* Base Weekly Hours */}
                <InputGroup label="Base Hebdomadaire (heures)">
                    <input
                        type="number"
                        value={local.weeklyBase || 35}
                        onChange={e => setLocal(p => ({ ...p, weeklyBase: Number(e.target.value) }))}
                        style={inputStyle}
                    />
                </InputGroup>
            </Section>

            {/* ─── CYCLE & DATES ─── */}
            <Section title="Calendrier & Cycles" icon={<Calendar size={16} color="#6366f1" />}>
                <InputGroup label="Date de début du tout premier cycle (Lundi)">
                    <input
                        type="date"
                        value={local.rootDate}
                        onChange={e => setLocal(p => ({ ...p, rootDate: e.target.value }))}
                        style={{ ...inputStyle, paddingRight: '10px' }}
                    />
                </InputGroup>

                <div style={{
                    marginTop: '12px', padding: '12px',
                    background: 'rgba(99,102,241,0.05)', borderRadius: '10px',
                    border: '1px dashed rgba(99,102,241,0.2)'
                }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                        Prochains cycles calculés
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {upcomingCycles.map((c, i) => (
                            <div key={i} style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Cycle {i + 1}</span>
                                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {c.start.split('-').reverse().slice(0, 2).join('/')} → {c.end.split('-').reverse().slice(0, 2).join('/')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ─── APP PREFS ─── */}
            <Section title="Préférences" icon={<CreditCard size={16} color="#6366f1" />}>
                <div
                    onClick={() => setLocal(p => ({ ...p, moneyModeEnabled: !p.moneyModeEnabled }))}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px', borderRadius: '12px', cursor: 'pointer',
                        background: local.moneyModeEnabled ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${local.moneyModeEnabled ? 'rgba(34,197,94,0.3)' : 'transparent'}`
                    }}>
                    <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: local.moneyModeEnabled ? '#86efac' : '#e2e8f0' }}>Money Mode</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Afficher les estimations de salaire en euros</div>
                    </div>

                    <div style={{
                        width: '40px', height: '22px', borderRadius: '11px',
                        background: local.moneyModeEnabled ? '#22c55e' : '#1e293b',
                        position: 'relative', transition: 'all 0.2s'
                    }}>
                        <div style={{
                            width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                            position: 'absolute', top: '2px', left: local.moneyModeEnabled ? '20px' : '2px',
                            transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                    </div>
                </div>
            </Section>

            {/* ─── DATA MANAGEMENT ─── */}
            <Section title="Zone de danger" icon={<Trash2 size={16} color="#ef4444" />}>
                {!showResetConfirm ? (
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        style={{
                            width: '100%', padding: '12px', borderRadius: '10px',
                            background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#ef4444', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}>
                        <RefreshCw size={14} /> Réinitialiser toutes les données
                    </button>
                ) : (
                    <div style={{ background: 'rgba(239,68,68,0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <div style={{ fontSize: '0.8rem', color: '#fca5a5', fontWeight: 600, marginBottom: '12px', textAlign: 'center' }}>
                            Êtes-vous sûr ? Cette action effacera {shiftsCount} shift(s) et ne peut pas être annulée.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <button onClick={() => setShowResetConfirm(false)} style={{
                                padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: '#cbd5e1', border: 'none', cursor: 'pointer', fontWeight: 600
                            }}>Annuler</button>
                            <button onClick={() => { onResetData(); setShowResetConfirm(false); }} style={{
                                padding: '10px', borderRadius: '8px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600
                            }}>Confirmer suppression</button>
                        </div>
                    </div>
                )}
            </Section>

            {/* ─── SAVE FAB ─── */}
            <div style={{
                position: 'fixed', bottom: '80px', left: '0', right: '0',
                display: 'flex', justifyContent: 'center', pointerEvents: 'none',
                padding: '0 20px'
            }}>
                <button
                    onClick={handleSave}
                    disabled={!hasChanges}
                    style={{
                        pointerEvents: hasChanges ? 'auto' : 'none',
                        background: saved ? '#22c55e' : (hasChanges ? '#6366f1' : '#1e293b'),
                        color: hasChanges ? 'white' : '#475569',
                        border: 'none',
                        padding: '14px 24px', borderRadius: '30px',
                        fontSize: '0.9rem', fontWeight: 700,
                        boxShadow: hasChanges ? '0 10px 25px -5px rgba(99,102,241,0.5)' : 'none',
                        transform: hasChanges ? 'translateY(0)' : 'translateY(100px)',
                        opacity: hasChanges ? 1 : 0,
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        minWidth: '200px', justifyContent: 'center'
                    }}
                >
                    {saved ? <Check size={18} /> : <Save size={18} />}
                    {saved ? 'Profil mis à jour' : 'Enregistrer'}
                </button>
            </div>

            {/* ─── SPACER ─── */}
            <div style={{ height: '80px' }} />

        </div>
    );
};

// --- Helpers ---

const Section: React.FC<{ title: string, icon: React.ReactNode, children: React.ReactNode }> = ({ title, icon, children }) => (
    <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingLeft: '4px' }}>
            {icon}
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        </div>
        {children}
    </div>
);

const InputGroup: React.FC<{ label: string, children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <Label>{label}</Label>
        {children}
    </div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '6px', fontWeight: 500, paddingLeft: '2px' }}>{children}</div>
);

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: '10px',
    background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f5f9', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s'
};

export default ProfilView;
