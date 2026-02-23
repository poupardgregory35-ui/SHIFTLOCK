import React, { useState, useMemo } from 'react';
import { CalendarDays, GitCompare, UserCircle, Palmtree } from 'lucide-react';
import type { TabId } from './types';
import { useAppData } from './hooks/useAppData';
import { generateAllCycles, PAY_PERIODS_2026 } from './utils/calculator';
import { StreamView } from './components/StreamView';
import { MatchView } from './components/MatchView';
import { ProfilView } from './components/ProfilView';

const POSEO_URL = 'https://asa-conges.netlify.app';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('stream');
  const [activePayMonth, setActivePayMonth] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return PAY_PERIODS_2026.find(p => today >= p.start && today <= p.end)?.payMonth || '2026-02';
  });
  const { data, updateProfile, updateShift, importShifts, resetAllData } = useAppData();

  const cycles = useMemo(
    () => generateAllCycles(data.profile.rootDate),
    [data.profile.rootDate]
  );

  const shiftsCount = Object.keys(data.shifts).length;

  const tabs: Array<{ id: TabId | 'conges'; label: string; icon: React.ReactNode; external?: string }> = [
    { id: 'stream', label: 'Planning', icon: <CalendarDays size={20} /> },
    { id: 'import', label: 'Match', icon: <GitCompare size={20} /> },
    { id: 'profil', label: 'Profil', icon: <UserCircle size={20} /> },
    { id: 'conges', label: 'Congés', icon: <Palmtree size={20} />, external: POSEO_URL },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-root)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font)',
      color: 'var(--text-primary)',
      overflow: 'hidden',
    }}>

      {/* HEADER */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-root)',
      }}>
        <img
          src="/logo.png"
          alt="ShiftLock"
          style={{ height: '28px', objectFit: 'contain' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div style={{
          fontSize: '0.6rem',
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          opacity: 0.8,
        }}>
          V3 · The Stream
        </div>
      </div>

      {/* CONTENU */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: activeTab === 'stream' ? 'flex' : 'none',
          flexDirection: 'column',
        }}>
          <StreamView shifts={data.shifts} profile={data.profile} cycles={cycles} onUpdateShift={updateShift} />
        </div>

        <div style={{
          position: 'absolute', inset: 0,
          display: activeTab === 'import' ? 'flex' : 'none',
          flexDirection: 'column',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch' as any,
        }}>
          <MatchView shifts={data.shifts} activePayMonth={activePayMonth} />
        </div>

        <div style={{
          position: 'absolute', inset: 0,
          display: activeTab === 'profil' ? 'flex' : 'none',
          flexDirection: 'column',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch' as any,
        }}>
          <ProfilView
            profile={data.profile}
            shiftsCount={shiftsCount}
            onUpdateProfile={updateProfile}
            onResetData={resetAllData}
          />
        </div>
      </div>

      {/* BOTTOM NAV */}
      <nav style={{
        flexShrink: 0,
        zIndex: 100,
        display: 'flex',
        background: 'var(--bg-nav)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.external) {
                  window.open(tab.external, '_blank');
                } else {
                  setActiveTab(tab.id as TabId);
                }
              }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                padding: '10px 4px 8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'color 0.15s',
                position: 'relative',
                minHeight: '56px',
              }}
            >
              {isActive && !tab.external && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: '20%', right: '20%',
                  height: '2px',
                  background: 'var(--accent-gradient)',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              <span style={{
                display: 'flex',
                opacity: isActive ? 1 : 0.5,
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.15s',
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: '0.58rem',
                fontWeight: isActive ? 700 : 400,
                letterSpacing: '0.02em',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default App;
