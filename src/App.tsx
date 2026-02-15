import { useState, useMemo, useEffect } from 'react';
import type { FortnightData, Role } from './types';
import { generateEmptyPeriod, calculatePeriod, parsePlanningText, formatDuration, calculateMonthlyEstimation } from './utils/calculator';
import FortnightGauge from './components/FortnightGauge';
import DayInput from './components/DayInput';
import { Clipboard, Trash2, Download, Upload, Settings, Calculator, X } from 'lucide-react';

const STORAGE_KEY = 'ambupay_28j_v2'; // Changed key to reset old data

const App: React.FC = () => {
  const [periodType, setPeriodType] = useState<'2Q' | '3Q'>('2Q'); // New: period selector
  const [data, setData] = useState<FortnightData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure we have 28 days minimum
      if (parsed.days && parsed.days.length >= 28) return parsed;
    }
    const defaultStart = '2026-01-19'; // Defaulting to the requested Monday
    return {
      role: 'DEA',
      baseRate: 12.79,
      cycleStartDate: defaultStart,
      days: generateEmptyPeriod(defaultStart)
    };
  });

  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [importText, setImportText] = useState('');
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [splashOpacity, setSplashOpacity] = useState(1);

  const [simPeriod, setSimPeriod] = useState({
    start: '2026-01-19',
    end: '2026-02-22' // Full 35 days = 2.5 fortnights (19 Jan to 22 Feb)
  });

  useEffect(() => {
    // Splash screen timer
    const timer = setTimeout(() => {
      setSplashOpacity(0);
      setTimeout(() => setIsSplashVisible(false), 500); // Wait for fade-out
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const skipSplash = () => {
    setSplashOpacity(0);
    setTimeout(() => setIsSplashVisible(false), 300);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const result = useMemo(() => calculatePeriod(data), [data]);

  const handleCycleStartChange = (newDate: string) => {
    const numDays = periodType === '2Q' ? 28 : 42;
    if (confirm(`Changer la date de début ? Cela va régénérer ${numDays} jours.`)) {
      setData({
        ...data,
        cycleStartDate: newDate,
        days: generateEmptyPeriod(newDate, numDays)
      });
    }
  };

  const handlePeriodTypeChange = (type: '2Q' | '3Q') => {
    const numDays = type === '2Q' ? 28 : 42;
    if (confirm(`Passer en mode ${type} (${numDays} jours) ? Les données actuelles seront régénérées.`)) {
      setPeriodType(type);
      setSelectedWeekIndex(0);
      setData({
        ...data,
        days: generateEmptyPeriod(data.cycleStartDate, numDays)
      });
    }
  };

  const updateDay = (index: number, updates: any) => {
    const newDays = [...data.days];
    newDays[index] = { ...newDays[index], ...updates };
    setData({ ...data, days: newDays });
  };

  const handleImport = () => {
    const parsed = parsePlanningText(importText);
    const newDays = [...data.days];
    parsed.forEach((p, i) => {
      if (i < newDays.length) {
        newDays[i] = { ...newDays[i], ...p };
      }
    });
    setData({ ...data, days: newDays });
    setShowImport(false);
    setImportText('');
  };

  const handleExportCSV = () => {
    // CSV Export for Excel/Sheets compatibility
    const headers = ['Date', 'Début', 'Fin', 'Repas', 'TTE', 'Commentaires'];
    const rows = data.days.map((day, idx) => {
      const dayResult = result.dailyResults[idx];
      return [
        day.date,
        day.start || '',
        day.end || '',
        day.breakRepas || 0,
        formatDuration(dayResult?.tte || 0),
        '' // Commentaires column (empty for now)
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shiftlock_planning_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());

        // Skip header line
        const dataLines = lines.slice(1);

        const newDays = [...data.days];
        dataLines.forEach((line, idx) => {
          if (idx >= newDays.length) return;

          const parts = line.split(';').map(p => p.trim());
          if (parts.length >= 4) {
            newDays[idx] = {
              ...newDays[idx],
              start: parts[1] || '',
              end: parts[2] || '',
              breakRepas: parseInt(parts[3]) || 0
            };
          }
        });

        setData({ ...data, days: newDays });
        alert('Planning importé avec succès !');
      } catch (err) {
        alert('Erreur lors de l\'import du fichier CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetAll = () => {
    const numDays = periodType === '2Q' ? 28 : 42;
    if (confirm(`Réinitialiser toute la période de ${numDays} jours ?`)) {
      setData({ ...data, days: generateEmptyPeriod(data.cycleStartDate, numDays) });
    }
  };

  const periodHSValue = result.overtime; // Focused on current cycle for now
  const hsPremium = (data.role === 'DEA' ? 12.79 : 12.02) * 1.25;
  const hsCost = periodHSValue * hsPremium;

  return (
    <div className="app-container">
      {isSplashVisible && (
        <div
          onClick={skipSplash}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'black',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: splashOpacity,
            transition: 'opacity 0.5s ease-out',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', animation: 'scaleUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <img src="/logo.png" alt="SHIFTLOCK" style={{ width: '180px', height: 'auto' }} />
            <div style={{
              fontSize: '1.2rem',
              fontWeight: 900,
              letterSpacing: '0.2em',
              color: 'white',
              textTransform: 'uppercase',
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              opacity: 0,
              animation: 'fadeIn 0.5s ease-out 0.5s forwards'
            }}>
              Pilotage Paie
            </div>
          </div>
        </div>
      )}

      <header style={{ flexDirection: 'column', gap: '1rem', padding: '1.5rem 1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
          <img src="/logo.png" alt="SHIFTLOCK" style={{ height: '40px', marginBottom: '4px' }} />
          <div style={{ fontSize: '0.7rem', color: 'rgba(251, 146, 60, 0.9)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Ta semaine, en un coup d'œil
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="toggle-btn"
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.7rem',
                background: periodType === '2Q' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                border: periodType === '2Q' ? 'none' : '1px solid var(--border)',
                fontWeight: periodType === '2Q' ? 800 : 400
              }}
              onClick={() => handlePeriodTypeChange('2Q')}
            >
              2 Quatorzaines
            </button>
            <button
              className="toggle-btn"
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.7rem',
                background: periodType === '3Q' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                border: periodType === '3Q' ? 'none' : '1px solid var(--border)',
                fontWeight: periodType === '3Q' ? 800 : 400
              }}
              onClick={() => handlePeriodTypeChange('3Q')}
            >
              3 Quatorzaines
            </button>
          </div>
          <button
            className="toggle-btn"
            style={{ padding: '0.4rem', border: 'none', background: showSettings ? 'var(--accent-color)' : 'transparent' }}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={20} color={showSettings ? 'white' : 'var(--text-secondary)'} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
          <div className="input-group" style={{ flex: 1 }}>
            <input
              type="date"
              value={data.cycleStartDate}
              onChange={(e) => handleCycleStartChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
          {/* Left: Weekly Totals */}
          <div style={{
            flex: '0 0 200px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            {Array.from({ length: periodType === '2Q' ? 4 : 6 }).map((_, weekIdx) => {
              const weekDays = data.days.slice(weekIdx * 7, (weekIdx * 7) + 7);
              const weekTTE = weekDays
                .reduce((acc, d, idx) => {
                  const dayRes = result.dailyResults[(weekIdx * 7) + idx];
                  return acc + (dayRes?.tte || 0);
                }, 0);

              const isActive = selectedWeekIndex === weekIdx;

              return (
                <div
                  key={weekIdx}
                  onClick={() => setSelectedWeekIndex(weekIdx)}
                  style={{
                    background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: isActive ? '2px solid var(--accent-color)' : '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>S{weekIdx + 1}</div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isActive ? 'var(--accent-color)' : 'white' }}>
                    {formatDuration(weekTTE)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Current Week Highlight */}
          <div style={{
            flex: 1,
            background: 'rgba(99, 102, 241, 0.15)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--accent-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Semaine sélectionnée</div>
              <div style={{ fontWeight: 900, fontSize: '1.5rem', color: 'white' }}>
                {(() => {
                  const weekDays = data.days.slice(selectedWeekIndex * 7, (selectedWeekIndex * 7) + 7);
                  const weekTTE = weekDays
                    .reduce((acc, d, idx) => {
                      const dayRes = result.dailyResults[(selectedWeekIndex * 7) + idx];
                      return acc + (dayRes?.tte || 0);
                    }, 0);
                  return formatDuration(weekTTE);
                })()}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Heures saisies</div>
            </div>
            <div style={{
              background: 'var(--accent-gradient)',
              color: 'white',
              padding: '0.75rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 900,
              fontSize: '1.8rem'
            }}>
              S{selectedWeekIndex + 1}
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <FortnightGauge current={result.totalTTE} total={140} />

        <div className="card fade-in" style={{ borderLeft: '4px solid var(--orange)', background: 'rgba(251, 146, 60, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ color: 'var(--orange)', marginBottom: '4px' }}>Compteur Paie (Cycle)</h2>
              <div className="value-large" style={{ fontSize: '1.75rem' }}>
                {formatDuration(periodHSValue)} HS
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="value-label">Gain Brut HS</div>
              <div style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--success)' }}>
                {hsCost.toFixed(2)}€
              </div>
            </div>
          </div>
        </div>

        <button
          className="toggle-btn"
          style={{ width: '100%', marginBottom: '1.5rem', background: 'var(--accent-gradient)', color: 'white' }}
          onClick={() => setShowSimulator(true)}
        >
          <Calculator size={18} /> Simuler ma Paie Mensuelle
        </button>

        {showSimulator && (
          <>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.7)',
                zIndex: 9998
              }}
              onClick={() => setShowSimulator(false)}
            />
            <div className="card" style={{
              border: '2px solid var(--success)',
              background: 'var(--bg-primary)',
              position: 'fixed',
              top: '20px',
              right: '20px',
              width: '380px',
              maxHeight: 'calc(100vh - 40px)',
              overflowY: 'auto',
              zIndex: 9999,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ color: 'var(--success)', margin: 0 }}>Simulateur de Paie</h2>
                <button onClick={() => setShowSimulator(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}>
                  <X size={24} />
                </button>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Le système découpe automatiquement votre période en <strong>quatorzaines de 14 jours</strong>.<br />
                Chaque bloc est calculé indépendamment pour les seuils HS (70h et 86h).
              </p>

              <div className="input-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="input-group">
                  <label>Du (Lundi)</label>
                  <input type="date" value={simPeriod.start} onChange={(e) => setSimPeriod({ ...simPeriod, start: e.target.value })} />
                </div>
                <div className="input-group">
                  <label>Au (Dimanche)</label>
                  <input type="date" value={simPeriod.end} onChange={(e) => setSimPeriod({ ...simPeriod, end: e.target.value })} />
                </div>
              </div>

              {(() => {
                const sim = calculateMonthlyEstimation(data, simPeriod.start, simPeriod.end);
                const cycleCount = sim.cycles.length;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-color)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        Période analysée : {cycleCount} quatorzaine{cycleCount > 1 ? 's' : ''} ({cycleCount * 14} jours max)
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <div className="value-label" style={{ marginBottom: '0.75rem' }}>Détail par Quatorzaine (Calcul Étanche)</div>
                      {sim.cycles.map((cycle, idx) => (
                        <div key={idx} style={{ marginBottom: idx < sim.cycles.length - 1 ? '0.75rem' : 0, paddingBottom: idx < sim.cycles.length - 1 ? '0.75rem' : 0, borderBottom: idx < sim.cycles.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: 'white' }}>Quatorzaine {idx + 1}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{formatDuration(cycle.tte)} / 70h</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {cycle.hs25 > 0 && <span className="badge badge-orange" style={{ padding: '0.2rem 0.5rem', fontSize: '0.6rem' }}>+ {formatDuration(cycle.hs25)} @ 25%</span>}
                            {cycle.hs50 > 0 && <span className="badge badge-rose" style={{ padding: '0.2rem 0.5rem', fontSize: '0.6rem' }}>+ {formatDuration(cycle.hs50)} @ 50%</span>}
                            {cycle.hs25 === 0 && cycle.hs50 === 0 && <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Aucune HS</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span color="var(--text-secondary)">Socle Fixe (151.67h)</span>
                      <span style={{ fontWeight: 700 }}>{sim.baseSalary.toFixed(2)}€</span>
                    </div>

                    <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                      <div className="value-label" style={{ fontSize: '0.7rem', marginBottom: '0.5rem' }}>Indemnités & Primes</div>
                      {(() => {
                        const periodDays = data.days.filter(d => d.date >= simPeriod.start && d.date <= simPeriod.end);
                        const irCount = periodDays.filter(d => d.hasMealAllowance).length;
                        const iruCount = periodDays.filter(d => d.hasIRU).length;
                        const sundayCount = periodDays.filter(d => d.hasSundayBonus).length;

                        return (
                          <>
                            {irCount > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>IR Repas (×{irCount})</span>
                                <span style={{ fontWeight: 600 }}>+{(irCount * 15).toFixed(2)}€</span>
                              </div>
                            )}
                            {iruCount > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>IRU (×{iruCount})</span>
                                <span style={{ fontWeight: 600 }}>+{(iruCount * 9).toFixed(2)}€</span>
                              </div>
                            )}
                            {sundayCount > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Dimanches/JF (×{sundayCount})</span>
                                <span style={{ fontWeight: 600 }}>+{(sundayCount * 45).toFixed(2)}€</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                              <span style={{ fontWeight: 700 }}>Total Indemnités</span>
                              <span style={{ fontWeight: 700 }}>{sim.totalAllowances.toFixed(2)}€</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span color="var(--text-secondary)">Heures Sup 25% ({formatDuration(sim.overtimeHours25)})</span>
                      <span style={{ fontWeight: 700, color: 'var(--orange)' }}>+{(sim.overtimeHours25 * (data.role === 'DEA' ? 12.79 : 12.02) * 1.25).toFixed(2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span color="var(--text-secondary)">Heures Sup 50% ({formatDuration(sim.overtimeHours50)})</span>
                      <span style={{ fontWeight: 700, color: 'var(--danger)' }}>+{(sim.overtimeHours50 * (data.role === 'DEA' ? 12.79 : 12.02) * 1.50).toFixed(2)}€</span>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div className="value-label">Salaire Net Estimé</div>
                      <div className="value-large" style={{ color: 'var(--success)', fontSize: '2rem' }}>{sim.estimatedNet.toFixed(2)}€</div>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '1rem' }}>
                      Estimation basée sur un Brut {'->'} Net de 0.78.<br />
                      Heures travaillées sur la période : {formatDuration(sim.totalTTE)}
                    </p>
                  </div>
                );
              })()}
            </div>
          </>
        )}
        {showSettings && (
          <div className="card fade-in" style={{ background: 'var(--bg-accent)', borderColor: 'var(--accent-color)' }}>
            <h2 style={{ color: 'white', marginBottom: '1.25rem' }}>Paramètres & Outils</h2>

            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ color: 'white', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'block' }}>Date de Début du Cycle (Lundi)</label>
              <input
                type="date"
                value={data.cycleStartDate}
                onChange={(e) => handleCycleStartChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'white'
                }}
              />
              <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.5rem', margin: 0 }}>
                {periodType === '2Q' ? 'Période de 28 jours (4 semaines)' : 'Période de 42 jours (6 semaines)'}
              </p>
            </div>

            <h2 style={{ color: 'white', marginBottom: '1rem' }}>Export / Import Planning</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="toggle-btn active"
                style={{ width: '100%', justifyContent: 'center', background: 'var(--success)' }}
                onClick={handleExportCSV}
              >
                <Download size={16} /> Exporter mes données (Excel/Sheets)
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  className="toggle-btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => document.getElementById('csv-import-input')?.click()}
                >
                  <Upload size={16} /> Importer un planning (CSV)
                </button>
                <input
                  id="csv-import-input"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleImportCSV}
                />
              </div>

              <div className="input-group" style={{ marginTop: '1rem' }}>
                <label>Type de contrat</label>
                <select
                  value={data.role}
                  onChange={(e) => setData({ ...data, role: e.target.value as Role })}
                  style={{ width: '100%' }}
                >
                  <option value="DEA">DEA (12.79€/h)</option>
                  <option value="Auxiliaire">Auxiliaire (12.02€/h)</option>
                </select>
              </div>

              <button
                className="toggle-btn"
                style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: '1rem' }}
                onClick={resetAll}
              >
                <Trash2 size={16} /> Vider le cycle actuel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            className="toggle-btn"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => setShowImport(true)}
          >
            <Clipboard size={16} /> Import Planning
          </button>
          <button
            className="toggle-btn"
            style={{ background: 'var(--bg-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={resetAll}
          >
            <Trash2 size={16} color="var(--danger)" />
          </button>
        </div>

        {showImport && (
          <div className="card fade-in" style={{ borderColor: 'var(--accent-color)' }}>
            <h2>Coller Planning</h2>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Ex: 7-19"
              style={{
                width: '100%',
                height: '100px',
                background: 'var(--bg-accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: 'white',
                marginBottom: '1rem',
                fontFamily: 'monospace'
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="toggle-btn active"
                style={{ flex: 1 }}
                onClick={handleImport}
              >
                Appliquer
              </button>
              <button
                className="toggle-btn"
                onClick={() => setShowImport(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {data.days.map((day, i) => {
          const weekIndex = Math.floor(i / 7);
          const isStartOfWeek = i % 7 === 0;
          const isEndOfWeek = i % 7 === 6;
          const isStartOfQ2 = i === 14;

          return (
            <div key={day.date}>
              {isStartOfWeek && (
                <div style={{ marginBottom: '0.75rem', marginTop: i > 0 ? '1.5rem' : '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-accent" style={{ background: 'var(--accent-gradient)', color: 'white' }}>Semaine {weekIndex + 1}</span>
                  {i === 14 && <span className="badge badge-orange">Début Quatorzaine 2</span>}
                </div>
              )}

              <DayInput
                shift={day}
                result={result.dailyResults[i]}
                onChange={(updates) => updateDay(i, updates)}
              />

              {isEndOfWeek && (
                <div className="card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border)', marginBottom: '1.5rem', padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="value-label" style={{ fontSize: '0.65rem' }}>Total Semaine {weekIndex + 1}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Heures saisies</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white' }}>
                        {(() => {
                          const weekDays = data.days.slice(weekIndex * 7, (weekIndex * 7) + 7);
                          const weekTTE = weekDays
                            .reduce((acc, d, idx) => {
                              const dayRes = result.dailyResults[(weekIndex * 7) + idx];
                              return acc + (dayRes?.tte || 0);
                            }, 0);
                          return formatDuration(weekTTE);
                        })()}
                      </div>
                    </div>
                  </div>

                  {i === 13 && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-orange">BILAN QUATORZAINE 1</span>
                        <div style={{ textAlign: 'right' }}>
                          {(() => {
                            const q1Days = result.dailyResults.slice(0, 14);
                            const tte = q1Days.reduce((acc, r) => acc + (r.tte || 0), 0);
                            const hs = Math.max(0, tte - 70);
                            return (
                              <div style={{ fontWeight: 900, color: hs > 0 ? 'var(--orange)' : 'white' }}>
                                {formatDuration(tte)} / 70h {hs > 0 ? `(+${formatDuration(hs)} HS)` : ''}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ height: '100px' }} /> {/* Spacer for sticky bottom */}
      </main>


      <div className="sticky-footer">
        <div>
          <div className="value-label">Total Période</div>
          <div className="value-large" style={{ color: 'white', fontSize: '1.5rem' }}>
            {formatDuration(result.totalTTE)}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            sur 140h objectif
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="value-label">Heures Sup</div>
          <div style={{ fontWeight: 900, fontSize: '1.3rem', color: result.overtime > 0 ? 'var(--orange)' : 'var(--text-secondary)' }}>
            {result.overtime > 0 ? formatDuration(result.overtime) : '0h00'}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            {result.overtime > 0 ? 'Cumulées' : 'Aucune HS'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
