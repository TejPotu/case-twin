import { create } from 'zustand';
import { type CaseProfile } from '@/lib/caseProfileTypes';
import { type OrchestratorState, createInitialState } from '@/lib/agenticOrchestrator';

interface DashboardStore {
    // Left panel state
    profile: CaseProfile | null;
    setProfile: (profile: CaseProfile | null) => void;

    // Right panel (Copilot) state
    orchestratorState: OrchestratorState;
    setOrchestratorState: (state: OrchestratorState | ((prev: OrchestratorState) => OrchestratorState)) => void;

    // Reset function
    resetStore: () => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
    profile: null,
    setProfile: (profile) => set({ profile }),

    orchestratorState: createInitialState(),
    setOrchestratorState: (state) => set((prev) => ({
        orchestratorState: typeof state === 'function' ? state(prev.orchestratorState) : state
    })),

    resetStore: () => set({
        profile: null,
        orchestratorState: createInitialState()
    })
}));
