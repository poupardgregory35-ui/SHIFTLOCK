import React from 'react';
import { Moon, Coffee } from 'lucide-react';
import type { DayShift, DayResult } from '../types';
import { formatDuration } from '../utils/calculator';

interface ShiftCardProps {
  shift: DayShift;
  result: DayResult;
  onClick: () => void;
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const STATUS_CONFIG: Record<string, { accent: string; bg: string; border: string }> = {
  TRAVAIL:   { accent: '#22d3ee', bg: 'rgba(34,211,238,0.06)',  border: 'rgba(34,211,238,0.2)' },
  REPOS:     { accent: '#334155', bg: 'rgba(15,23,42,0.4)',     border: 'rgba(51,65,85,0.4)' },
  CP:        { accent: '#a78bfa', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.2)' },
  MALADIE:   { accent: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.2)' },
  FORMATION: { accent: '#34d399', bg: 'rgba(52,211,153,0.06)',  border: 'rgba(52,211,153,0.2)' },
  FERIE:     { accent: '#fbbf24', bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.2)' },
  VIDE:      { accent: '#1e293b', bg: 'transparent',            border: 'rgba(30,41,59,0.8)' },
};

const STATUS_LABEL: Record<string, string> = {
  REPOS: 'Repos', CP: 'Congé payé', MALADIE: 'Arrêt maladie',
  FORMATION: 'Formation', FERIE: 'Jour férié',
};

export const ShiftCard: React.FC<ShiftCardProps> = ({ shift, result, onClick }) => {
  const d = new Date(shift.date + 'T12:00:00');
  const dayName = DAYS[d.getDay()];
  const dayNum = d.getDate();
  const isToday = shift.date === new Date().toISOString().split('T')[0];
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const cfg = STATUS_CONFIG[shift.status] || STATUS_CONFIG.VIDE;
  const isTravail = shift.status === 'TRAVAIL' && !!shift.start;
  const isEmpty = shift.status === 'VIDE';
  const pauses = shift.pauses || [];

  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center',
      minHeight: '64px', background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderLeft: `3px solid ${isTravail ? cfg.accent : cfg.border}`,
      borderRadius: '12px', marginBottom: '6px',
      cursor: 'pointer', textAlign: 'left', padding: '0',
      overflow: 'hidden', opacity: isEmpty ? 0.35 : 1,
    }}>
      <div style={{
        width: '56px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '10px 0',
        borderRight: `1px solid ${cfg.border}`,
        background: isToday ? 'rgba(34,211,238,0.08)' : 'transparent',
      }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: isWeekend ? '#64748b' : '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
          {dayName}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, lineHeight: 1.1, color: isToday ? '#22d3ee' : isWeekend ? '#64748b' : '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
          {dayNum}
        </div>
        {isToday && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22d3ee', marginTop: '2px' }} />}
      </div>

      <div style={{ flex: 1, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
        {isTravail ? (
          <>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{shift.start}</span>
                <span style={{ color: '#334155', fontSize: '0.8rem' }}>–</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{shift.end}</span>
                {shift.isNight && <Moon size={12} color="#818cf8" />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                {pauses.length > 0 && (
                  <span style={{ fontSize: '0.65rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Coffee size={9} />{pauses.length} pause{pauses.length > 1 ? 's' : ''}
                  </span>
                )}
                {result.ir > 0 && <span style={{ fontSize: '0.6rem', color: '#34d399', fontWeight: 700 }}>IR</span>}
                {result.iru > 0 && <span style={{ fontSize: '0.6rem', color: '#a78bfa', fontWeight: 700 }}>IRU</span>}
                {result.isSpecial > 0 && <span style={{ fontSize: '0.6rem', color: '#fbbf24', fontWeight: 700 }}>IS</span>}
              </div>
            </div>
            {result.tte > 0 && (
              <div style={{ flexShrink: 0, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: '10px', padding: '6px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#22d3ee', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{formatDuration(result.tte)}</div>
                <div style={{ fontSize: '0.5rem', color: '#0891b2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>TTE</div>
              </div>
            )}
          </>
        ) : isEmpty ? (
          <span style={{ fontSize: '0.8rem', color: '#1e293b', fontStyle: 'italic' }}>— Appuyer pour saisir</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.accent, flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: cfg.accent }}>{STATUS_LABEL[shift.status] || shift.status}</span>
          </div>
        )}
      </div>
    </button>
  );
};

export default ShiftCard;
