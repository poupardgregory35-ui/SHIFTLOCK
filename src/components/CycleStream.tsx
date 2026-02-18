import { useState, useMemo } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { useCycleStream } from '../hooks/useCycleStream';
import type { AppState, DayShift, DailyResult } from '../types';
import CycleHeader from './CycleHeader';
import DayRow from './DayRow';
import ShiftEditor from './ShiftEditor';
import { AnimatePresence } from 'framer-motion';
// import { X, Calendar as CalendarIcon } from 'lucide-react'; // Removing unused
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CycleStreamProps {
    state: AppState;
    updateShift: (date: string, updates: Partial<DayShift>) => void;
}

interface EditingItem {
    date: string;
    shift: DayShift;
    result: DailyResult;
}

export default function CycleStream({ state, updateShift }: CycleStreamProps) {
    const { flatItems, groupCounts, groups } = useCycleStream(state);

    // Find index of today to start there
    const todayISO = new Date().toISOString().split('T')[0];
    const initialIndex = useMemo(() => {
        const idx = flatItems.findIndex(i => i.date === todayISO);
        return idx >= 0 ? idx : 0;
    }, [flatItems, todayISO]);

    const [editingItem, setEditingItem] = useState<EditingItem | null>(null);

    // Helper to update local editing state
    const handleUpdate = (updates: Partial<DayShift>) => {
        if (editingItem) {
            // Immediate update to global state
            updateShift(editingItem.date, updates);

            // Update local state for immediate feedback in the sheet
            setEditingItem(prev => prev ? {
                ...prev,
                shift: { ...prev.shift, ...updates }
            } : null);
        }
    };

    return (
        <>
            <div style={{ height: 'calc(100vh - 120px)', width: '100%' }}>
                <GroupedVirtuoso
                    groupCounts={groupCounts}
                    initialTopMostItemIndex={initialIndex}
                    groupContent={(index) => {
                        const group = groups[index];
                        return <CycleHeader group={group} monthLabel={group.period.monthLabel} />;
                    }}
                    itemContent={(index) => {
                        const item = flatItems[index];
                        const isToday = item.date === todayISO;
                        return (
                            <DayRow
                                date={item.date}
                                shift={item.shift}
                                result={item.result}
                                isToday={isToday}
                                onClick={() => setEditingItem(item)}
                            />
                        );
                    }}
                />
            </div>

            {/* EDIT BOTTOM SHEET */}
            <AnimatePresence>
                {/* EDIT DRAWER (Nouveau ShiftEditor) */}
                <AnimatePresence>
                    {editingItem && (
                        <ShiftEditor
                            isOpen={true}
                            onClose={() => setEditingItem(null)}
                            date={format(parseISO(editingItem.date), 'EEEE d MMMM', { locale: fr })}
                            userLevel={state.level === 'LEVEL_1' ? 1 : state.level === 'LEVEL_2' ? 2 : 3}
                            initialShift={editingItem.shift}
                            onSave={(updates) => {
                                updateShift(editingItem.date, updates);
                                // On pourrait garder ouvert pour feedback, mais le standard est de fermer
                                // setEditingItem(null); // ShiftEditor appelle déjà onClose, mais on peut forcer ici si besoin. 
                                // ShiftEditor calls onClose inside handleSave, so this might be redundant if onClose sets editingItem(null), which it does.
                            }}
                        />
                    )}
                </AnimatePresence>
            </AnimatePresence>
        </>
    );
}
