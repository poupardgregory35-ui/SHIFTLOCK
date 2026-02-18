import React from 'react';
import SettingsView from './SettingsView';
import type { AppState } from '../types';

interface ProfilViewProps {
    profile: Omit<AppState, 'shifts'>;
    shiftsCount: number;
    onUpdateProfile: (field: keyof Omit<AppState, 'shifts'>, value: any) => void;
    onResetData: () => void;
}

export const ProfilView: React.FC<ProfilViewProps> = ({ profile, onUpdateProfile, onResetData }) => {
    // Mock full state for SettingsView, or refactor SettingsView to take individual props
    // SettingsView takes individual props for setters, but 'state' prop for values.

    const mockState: AppState = {
        ...profile,
        ...profile,
        shifts: {},
    };

    return (
        <SettingsView
            state={mockState}
            setRootDate={(v) => onUpdateProfile('rootDate', v)}
            setModeCalcul={(v) => onUpdateProfile('modeCalcul', v)}
            setRole={(v) => onUpdateProfile('role', v)}
            setLevel={(v) => onUpdateProfile('level', v)}
            setContractHours={(v) => onUpdateProfile('contractHours', v)}
            resetSettings={onResetData}
        />
    );
};
