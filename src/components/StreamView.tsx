import React from 'react';
import CycleStream from './CycleStream';
import type { AppState, DayShift, Period } from '../types';

interface StreamViewProps {
    shifts: Record<string, DayShift>;
    profile: Omit<AppState, 'shifts'>;
    cycles: Period[];
    onUpdateShift: (date: string, updates: Partial<DayShift>) => void;
}

export const StreamView: React.FC<StreamViewProps> = ({ shifts, profile, onUpdateShift }) => {
    // Reconstruct AppState for CycleStream
    const state: AppState = {
        ...profile,
        shifts,
    };

    return (
        <CycleStream
            state={state}
            updateShift={onUpdateShift}
        />
    );
};
