
import React, { useState, useMemo } from 'react';
import { CalendarDays, FileUp, UserCircle } from 'lucide-react';
import type { TabId } from './types';
import { useAppData } from './hooks/useAppData';
import { generateAllCycles } from './utils/calculator';
import StreamView from './components/StreamView';
import ImportView from './components/ImportView';
import ProfilView from './components/ProfilView';

// ─── Z-INDEX MAP (documenté pour éviter les conflits) ─────────────────────────
// 1   : contenu normal
// 10  : sticky headers dans StreamView
// 100 : bottom nav
// 9998: backdrop modals/bottom sheet
// 9999: bottom sheet contenu

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('stream');
  const { data, updateProfile, updateShift, importShifts, resetAllData } = useAppData();

  // Cycles générés une seule fois à partir de la date racine
  const cycles = useMemo(
    () => generateAllCycles(data.profile.rootDate),
    [data.profile.rootDate]
  );

  const shiftsCount = Object.keys(data.shifts).length;

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'stream', label: 'Planning', icon: <CalendarDays size={20} /> },
    { id: 'import', label: 'Import PDF', icon: <FileUp size={20} /> },
    { id: 'profil', label: 'Profil', icon: <UserCircle size={20} /> },
  ];

  return (
    // z-index:1 — racine neutre
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-root)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font)',
      color: 'var(--text-primary)',
      overflow: 'hidden',
    }}>

      {/* ─── HEADER APP ─────────────────────────────────────────── */}
      {/* z-index:10 — au-dessus du contenu scroll, sous la nav */}
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
        {/* Logo Fallback Text if Image Fails is Handled via onError */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/logo.png"
            alt="ShiftLock"
            style={{ height: '28px', objectFit: 'contain' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'block';
            }}
          />
          <span style={{ display: 'none', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em', fontSize: '1.1rem' }}>ShiftLock</span>
        </div>

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

      {/* ─── CONTENU PRINCIPAL ──────────────────────────────────── */}
      {/* flex:1 — occupe tout l'espace entre header et nav */}
      {/* overflow:hidden — chaque vue gère son propre scroll */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* STREAM — toujours monté pour conserver l'état de navigation */}
        <div style={{
          position: 'absolute', inset: 0,
          display: activeTab === 'stream' ? 'flex' : 'none',
          flexDirection: 'column',
        }}>
          <StreamView
            shifts={data.shifts}
            profile={data.profile}
            onUpdateShift={updateShift}
          />
        </div>

        {/* IMPORT */}
        <div style={{
          position: 'absolute', inset: 0,
          display: activeTab === 'import' ? 'flex' : 'none',
          flexDirection: 'column',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch' as any,
        }}>
          <ImportView onImport={importShifts} />
        </div>

        {/* PROFIL */}
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

      {/* ─── BOTTOM NAVIGATION ──────────────────────────────────── */}
      {/* z-index:100 — au-dessus de tout le contenu, sous les modals (9998+) */}
      <nav style={{
        flexShrink: 0,
        zIndex: 100,
        display: 'flex',
        background: 'var(--bg-nav)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom)', // iPhone notch
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
                minHeight: '56px', // zone tactile minimum "gros doigts"
              }}
            >
              {/* Indicateur actif */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: '25%', right: '25%',
                  height: '2px',
                  background: 'var(--accent-gradient)',
                  borderRadius: '0 0 4px 4px',
                  boxShadow: '0 0 8px var(--accent)'
                }} />
              )}
              <span style={{
                display: 'flex',
                opacity: isActive ? 1 : 0.5,
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.02em',
                opacity: isActive ? 1 : 0.7
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
