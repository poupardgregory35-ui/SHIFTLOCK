import React, { useState } from 'react';
import type { UserProfile } from '../types';

interface ProfilViewProps {
  profile: UserProfile;
  shiftsCount: number;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onResetData: () => void;
}

const ROLES = ['DEA', 'AA', 'CONDUCTEUR'];
const LEVELS = [
  { id: 'LEVEL_1', label: 'Échelon 1 — 12,04€/h' },
  { id: 'LEVEL_2', label: 'Échelon 2 — 12,16€/h' },
  { id: 'LEVEL_3', label: 'Échelon 3 — 12,79€/h' },
];

export const ProfilView: React.FC<ProfilViewProps> = ({ profile, shiftsCount, onUpdateProfile, onResetData }) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: '430px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 900, marginBottom: '24px' }}>Profil</h2>

      {/* Rôle */}
      <Section label="Rôle">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {ROLES.map(r => (
            <Chip key={r} label={r} active={profile.role === r} onClick={() => onUpdateProfile({ role: r })} />
          ))}
        </div>
      </Section>

      {/* Échelon */}
      <Section label="Échelon">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {LEVELS.map(l => (
            <Chip key={l.id} label={l.label} active={profile.level === l.id} onClick={() => onUpdateProfile({ level: l.id })} />
          ))}
        </div>
      </Section>

      {/* Date racine */}
      <Section label="Date de début de cycle">
        <input
          type="date"
          value={profile.rootDate}
          onChange={e => onUpdateProfile({ rootDate: e.target.value })}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '10px 12px', color: '#f1f5f9',
            fontSize: '0.9rem', width: '100%', boxSizing: 'border-box',
          }}
        />
      </Section>

      {/* Stats */}
      <Section label="Données">
        <div style={{ color: '#475569', fontSize: '0.85rem' }}>
          {shiftsCount} journée{shiftsCount > 1 ? 's' : ''} enregistrée{shiftsCount > 1 ? 's' : ''}
        </div>
      </Section>

      {/* Reset */}
      <Section label="Réinitialisation">
        {confirmReset ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { onResetData(); setConfirmReset(false); }}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              Confirmer
            </button>
            <button onClick={() => setConfirmReset(false)}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#475569', cursor: 'pointer', fontSize: '0.85rem' }}>
              Annuler
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
            Effacer toutes les données
          </button>
        )}
      </Section>
    </div>
  );
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{label}</div>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 700 : 400,
      background: active ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)'}`,
      color: active ? '#22d3ee' : '#475569',
    }}>
      {label}
    </button>
  );
}

export default ProfilView;
