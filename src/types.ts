export interface ArtifactInfo {
    name: string;
    path: string;
    type: 'prd' | 'architecture' | 'epics' | 'ux' | 'sprint' | 'other';
}

export type StoryStatus = 'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'done' | 'optional';

export interface StoryInfo {
    id: string;
    status: StoryStatus;
    isEpic: boolean;
    epicId?: string; // Parent epic ID for stories
    path?: string; // Path to story file if exists
}

export interface WorkflowState {
    project: string;
    projectType?: string;
    fieldType?: string;
    currentPhaseIndex: number; // 0-indexed into phases array
    phases: DynamicPhase[];
    artifacts?: ArtifactInfo[];
    stories?: StoryInfo[];
    bmadInstalled?: boolean; // Whether _bmad directory exists
    hasStatusFile?: boolean; // Whether bmm-workflow-status.yaml exists
}

export interface DynamicPhase {
    name: string; // e.g., "Prerequisites", "Discovery", "Planning"
    status: 'completed' | 'current' | 'locked' | 'not_started';
    items: Record<string, string>; // workflow_key -> status from YAML
}

// Keep for backwards compat with getPhaseStatuses if needed
export interface PhaseStatus {
    id: number;
    name: string;
    status: 'completed' | 'current' | 'locked' | 'not_started';
}
