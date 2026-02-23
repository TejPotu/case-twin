import { create } from 'zustand';
import { type CaseProfile } from '@/lib/caseProfileTypes';
import { type OrchestratorState, createInitialState } from '@/lib/agenticOrchestrator';

export interface Specialist {
    name: string;
    specialty: string;
    credentials?: string;
    context: string;
    url?: string;
    phone?: string;
}

interface DashboardStore {
    // Left panel state
    profile: CaseProfile | null;
    setProfile: (profile: CaseProfile | null) => void;

    // Right panel (Copilot) state
    orchestratorState: OrchestratorState;
    setOrchestratorState: (state: OrchestratorState | ((prev: OrchestratorState) => OrchestratorState)) => void;

    // Route page specialists state (persists across tab switches)
    extractedSpecialists: Record<string, Specialist[]>;
    setExtractedSpecialists: (hospitalName: string, specialists: Specialist[]) => void;

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

    extractedSpecialists: {},
    setExtractedSpecialists: (hospitalName, specialists) => set((prev) => ({
        extractedSpecialists: {
            ...prev.extractedSpecialists,
            [hospitalName]: specialists
        }
    })),

    resetStore: () => set({
        profile: null,
        orchestratorState: createInitialState(),
        extractedSpecialists: {}
    })
}));
