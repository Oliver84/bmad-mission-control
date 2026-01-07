import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { WorkflowState, PhaseStatus, DynamicPhase, ArtifactInfo, StoryInfo, StoryStatus } from './types';

export interface ProjectInfo {
    name: string;
    path: string;
}

export class WorkflowStateManager {
    private state: WorkflowState | null = null;
    private watcher: vscode.FileSystemWatcher | null = null;
    private onStateChange: ((state: WorkflowState) => void) | null = null;
    private availableProjects: ProjectInfo[] = [];
    private currentProjectPath: string | null = null;

    constructor() { }

    public initialize(callback: (state: WorkflowState) => void) {
        this.onStateChange = callback;
        this.detectAllProjects();
        this.loadState();
        this.setupWatcher();
    }

    public getAvailableProjects(): ProjectInfo[] {
        return this.availableProjects;
    }

    public getCurrentProjectPath(): string | null {
        return this.currentProjectPath;
    }

    public switchProject(projectPath: string) {
        this.currentProjectPath = projectPath;
        this.loadStateFromPath(projectPath);
    }

    private detectAllProjects() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        this.availableProjects = [];

        // Search for all bmm-workflow-status.yaml files
        const findFilesRecursive = (dir: string, depth: number = 0): void => {
            if (depth > 5) return; // Limit recursion depth

            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);

                    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        findFilesRecursive(fullPath, depth + 1);
                    } else if (entry.isFile() && (entry.name === 'bmm-workflow-status.yaml' || entry.name === 'workflow-status.yaml')) {
                        // Use parent directory name as project name
                        const projectName = path.basename(path.dirname(fullPath));
                        this.availableProjects.push({
                            name: projectName,
                            path: fullPath
                        });
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        };

        findFilesRecursive(rootPath);
        console.log('Detected projects:', this.availableProjects);
    }

    private loadStateFromPath(yamlPath: string) {
        if (fs.existsSync(yamlPath)) {
            try {
                const content = fs.readFileSync(yamlPath, 'utf8');
                const parsed = yaml.load(content) as any;
                this.state = this.mapYamlToState(parsed);
                console.log(`Loaded state from: ${yamlPath}`, this.state);
            } catch (error) {
                console.error('Error parsing YAML:', error);
                this.state = this.getDefaultState();
            }
        } else {
            this.state = this.getDefaultState();
        }

        if (this.onStateChange && this.state) {
            this.onStateChange(this.state);
        }
    }

    private loadState() {
        // Use first detected project if available
        if (this.availableProjects.length > 0 && !this.currentProjectPath) {
            this.currentProjectPath = this.availableProjects[0].path;
        }

        const yamlPath = this.currentProjectPath || this.findStatusFile();

        if (yamlPath && fs.existsSync(yamlPath)) {
            try {
                const content = fs.readFileSync(yamlPath, 'utf8');
                const parsed = yaml.load(content) as any;

                // Map YAML structure to our state interface
                this.state = this.mapYamlToState(parsed);
                this.currentProjectPath = yamlPath;
                console.log(`Loaded state from: ${yamlPath}`, this.state);
            } catch (error) {
                console.error('Error parsing YAML:', error);
                this.state = this.getDefaultState();
            }
        } else {
            console.log('No status file found, using default state');
            this.state = this.getDefaultState();
        }

        if (this.onStateChange && this.state) {
            this.onStateChange(this.state);
        }
    }

    private findStatusFile(): string | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;

        // Try to read config to find the configured output folder
        const configPath = this.findConfigFile(rootPath);
        let outputFolder = '_bmad-output'; // default

        if (configPath && fs.existsSync(configPath)) {
            try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const config = yaml.load(configContent) as any;
                if (config.output_folder) {
                    outputFolder = config.output_folder;
                }
                if (config.planning_artifacts) {
                    outputFolder = config.planning_artifacts;
                }
            } catch (error) {
                console.log('Could not read config, using defaults');
            }
        }

        // Search multiple possible locations (in order of preference)
        const possiblePaths = [
            // Modern BMAD structure
            path.join(rootPath, outputFolder, 'bmm-workflow-status.yaml'),
            path.join(rootPath, outputFolder, 'workflow-status.yaml'),
            // Legacy locations
            path.join(rootPath, '_bmad-output', 'bmm-workflow-status.yaml'),
            path.join(rootPath, '_bmad-output', 'workflow-status.yaml'),
            path.join(rootPath, 'bmm-workflow-status.yaml'),
            path.join(rootPath, 'workflow-status.yaml'),
            // Older BMAD structures
            path.join(rootPath, '.bmad', 'bmm-workflow-status.yaml'),
            path.join(rootPath, 'docs', 'bmm-workflow-status.yaml'),
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                console.log(`Found status file at: ${p}`);
                return p;
            }
        }

        return null;
    }

    private findConfigFile(rootPath: string): string | null {
        const possibleConfigs = [
            path.join(rootPath, '_bmad', 'bmm', 'config.yaml'),
            path.join(rootPath, '.bmad', 'config.yaml'),
            path.join(rootPath, 'bmad.yaml'),
        ];

        for (const p of possibleConfigs) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
        return null;
    }

    private mapYamlToState(parsed: any): WorkflowState {
        const dynamicPhases: DynamicPhase[] = [];
        let currentPhaseIndex = 0;
        let foundCurrent = false;

        // Build phases dynamically from YAML workflow_status array
        if (parsed.workflow_status && Array.isArray(parsed.workflow_status)) {
            parsed.workflow_status.forEach((phaseBlock: any, index: number) => {
                const phaseName = phaseBlock.phase || `Phase ${index + 1}`;
                const items: Record<string, string> = phaseBlock.items || {};

                // Determine status based on item completion
                const itemValues = Object.values(items);
                const allCompleted = itemValues.length > 0 && itemValues.every(
                    (v: any) => v === 'completed' || v === 'done' || v === 'skipped'
                );
                const hasRequired = itemValues.some((v: any) => v === 'required' || v === 'recommended');

                let status: 'completed' | 'current' | 'locked' | 'not_started' = 'not_started';

                if (allCompleted) {
                    status = 'completed';
                } else if (!foundCurrent && hasRequired) {
                    status = 'current';
                    currentPhaseIndex = index;
                    foundCurrent = true;
                } else if (foundCurrent) {
                    status = 'locked';
                } else {
                    // If no required items and not all completed, mark as current if first incomplete
                    if (!foundCurrent && !allCompleted) {
                        status = 'current';
                        currentPhaseIndex = index;
                        foundCurrent = true;
                    }
                }

                dynamicPhases.push({
                    name: phaseName,
                    status,
                    items,
                });
            });
        } else if (parsed.workflow_items && Array.isArray(parsed.workflow_items)) {
            // HANDLE GREENFIELD STRUCTURE (workflow_items)
            parsed.workflow_items.forEach((phaseBlock: any, index: number) => {
                const phaseName = phaseBlock.name || `Phase ${index + 1}`;

                // Map workflows array to items record
                const items: Record<string, string> = {};
                if (phaseBlock.workflows && Array.isArray(phaseBlock.workflows)) {
                    phaseBlock.workflows.forEach((w: any) => {
                        if (w.id && w.status) {
                            items[w.id] = w.status;
                        }
                    });
                }

                // Map phase status
                let status: 'completed' | 'current' | 'locked' | 'not_started' = 'not_started';
                const yamlStatus = phaseBlock.status?.toLowerCase();

                // Check if all items are completed to override YAML status
                const itemValues = Object.values(items);
                const allCompleted = itemValues.length > 0 && itemValues.every(
                    (v: string) => v === 'completed' || v === 'done' || v === 'skipped'
                );

                if (allCompleted) {
                    status = 'completed';
                } else if (yamlStatus === 'active') {
                    status = 'current';
                } else if (yamlStatus === 'pending') {
                    status = 'locked';
                } else if (yamlStatus === 'completed') {
                    status = 'completed';
                } else if (yamlStatus === 'skipped') {
                    status = 'completed';
                }

                if (status === 'current') {
                    currentPhaseIndex = index;
                }

                dynamicPhases.push({
                    name: phaseName,
                    status,
                    items
                });
            });

        } else {
            // Fallback: Create default phases if no workflow_status found
            dynamicPhases.push(
                { name: 'Analysis', status: 'current', items: {} },
                { name: 'Planning', status: 'locked', items: {} },
                { name: 'Solutioning', status: 'locked', items: {} },
                { name: 'Implementation', status: 'locked', items: {} },
            );
        }

        // Detect artifacts in the same directory as the status file
        const artifacts = this.detectArtifacts();

        // Detect stories from sprint-status.yaml
        const stories = this.detectStories();

        // Check for BMAD installation
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const rootPath = workspaceFolders?.[0]?.uri.fsPath;
        const bmadInstalled = rootPath ? fs.existsSync(path.join(rootPath, '_bmad')) : false;

        return {
            project: parsed.project || parsed.project_name || 'Unknown Project',
            projectType: parsed.project_type,
            fieldType: parsed.field_type,
            currentPhaseIndex,
            phases: dynamicPhases,
            artifacts,
            stories,
            bmadInstalled,
            hasStatusFile: true,
        };
    }

    private detectArtifacts(): ArtifactInfo[] {
        const artifacts: ArtifactInfo[] = [];

        if (!this.currentProjectPath) {
            return artifacts;
        }

        const statusDir = path.dirname(this.currentProjectPath);

        // Also check parent directory (status file might be in a subdirectory)
        const parentDir = path.dirname(statusDir);

        const dirsToCheck = [statusDir, parentDir];

        // Common artifact patterns - expanded to cover all BMAD outputs
        const artifactPatterns: { pattern: RegExp; type: ArtifactInfo['type']; name: string }[] = [
            // Planning artifacts
            { pattern: /prd.*\.md$/i, type: 'prd', name: 'PRD' },
            { pattern: /architecture.*\.md$/i, type: 'architecture', name: 'Architecture' },
            { pattern: /epics.*\.md$/i, type: 'epics', name: 'Epics & Stories' },
            { pattern: /stories.*\.md$/i, type: 'epics', name: 'Stories' },
            { pattern: /ux.*\.md$/i, type: 'ux', name: 'UX Design' },
            { pattern: /sprint.*\.(md|yaml)$/i, type: 'sprint', name: 'Sprint Status' },
            { pattern: /product-brief.*\.md$/i, type: 'other', name: 'Product Brief' },
            { pattern: /tech-spec.*\.md$/i, type: 'other', name: 'Tech Spec' },
            // Discovery/Analysis artifacts
            { pattern: /project-context.*\.md$/i, type: 'other', name: 'Project Context' },
            { pattern: /brownfield.*\.md$/i, type: 'other', name: 'Brownfield Analysis' },
            { pattern: /research.*\.md$/i, type: 'other', name: 'Research' },
            { pattern: /brainstorm.*\.md$/i, type: 'other', name: 'Brainstorming' },
            // Test artifacts
            { pattern: /test-design.*\.md$/i, type: 'other', name: 'Test Design' },
            { pattern: /test-plan.*\.md$/i, type: 'other', name: 'Test Plan' },
            { pattern: /traceability.*\.md$/i, type: 'other', name: 'Traceability' },
        ];

        for (const dir of dirsToCheck) {
            try {
                if (!fs.existsSync(dir)) continue;

                const files = fs.readdirSync(dir);
                for (const file of files) {
                    for (const pattern of artifactPatterns) {
                        if (pattern.pattern.test(file)) {
                            const fullPath = path.join(dir, file);
                            // Avoid duplicates
                            if (!artifacts.some(a => a.path === fullPath)) {
                                artifacts.push({
                                    name: pattern.name,
                                    path: fullPath,
                                    type: pattern.type
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        }

        return artifacts;
    }

    private detectStories(): StoryInfo[] {
        const stories: StoryInfo[] = [];

        if (!this.currentProjectPath) {
            return stories;
        }

        const statusDir = path.dirname(this.currentProjectPath);
        const parentDir = path.dirname(statusDir);
        const dirsToCheck = [statusDir, parentDir];

        // Find root workspace for story file lookup
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const rootPath = workspaceFolders?.[0]?.uri.fsPath || parentDir;

        // Potential story file locations (configurable, but these are common)
        const storyDirs = [
            path.join(rootPath, '_bmad-output', 'stories'),
            path.join(rootPath, '_bmad-output', 'implementation-artifacts', 'stories'),
            path.join(statusDir, 'stories'),
            path.join(parentDir, 'stories'),
        ];

        // Helper to find story file path
        const findStoryFile = (id: string): string | undefined => {
            for (const dir of storyDirs) {
                const filePath = path.join(dir, `${id}.md`);
                if (fs.existsSync(filePath)) {
                    return filePath;
                }
            }
            return undefined;
        };

        // Look for sprint-status.yaml
        for (const dir of dirsToCheck) {
            const possiblePaths = [
                path.join(dir, 'sprint-status.yaml'),
                path.join(dir, 'sprint-status.yml'),
            ];

            for (const sprintPath of possiblePaths) {
                if (fs.existsSync(sprintPath)) {
                    try {
                        const content = fs.readFileSync(sprintPath, 'utf8');
                        const parsed = yaml.load(content) as any;

                        if (parsed?.development_status) {
                            let currentEpicId: string | undefined;

                            for (const [key, status] of Object.entries(parsed.development_status)) {
                                const statusStr = status as string;
                                const isEpic = key.startsWith('epic-') && !key.includes('-retrospective');
                                const isRetro = key.includes('-retrospective');

                                if (isRetro) {
                                    continue; // Skip retrospectives for now
                                }

                                if (isEpic) {
                                    currentEpicId = key;
                                    stories.push({
                                        id: key,
                                        status: this.normalizeStoryStatus(statusStr),
                                        isEpic: true,
                                    });
                                } else {
                                    stories.push({
                                        id: key,
                                        status: this.normalizeStoryStatus(statusStr),
                                        isEpic: false,
                                        epicId: currentEpicId,
                                        path: findStoryFile(key),
                                    });
                                }
                            }
                        }

                        return stories; // Found and parsed, return early
                    } catch (error) {
                        console.error('Error parsing sprint-status.yaml:', error);
                    }
                }
            }
        }

        return stories;
    }

    private normalizeStoryStatus(status: string): StoryStatus {
        const normalized = status.toLowerCase().trim();
        if (['backlog', 'ready-for-dev', 'in-progress', 'review', 'done', 'optional'].includes(normalized)) {
            return normalized as StoryStatus;
        }
        return 'backlog'; // Default fallback
    }

    // Removed extractPhaseRoadmap - items are now directly on DynamicPhase

    private inferPhaseFromWorkflowStatus(workflowStatus: any): 1 | 2 | 3 | 4 {
        // Check for array structure (Phase-based list)
        if (Array.isArray(workflowStatus)) {
            // Find the first phase that has incomplete required items
            // or determine based on what's recently completed.
            // E.g., if 'Implementation' items are starting, we are in 4.

            const allItems = this.flattenWorkflowItems(workflowStatus);
            const keys = Object.keys(allItems);

            if (keys.some(s => s.includes('sprint') || s.includes('dev-story'))) return 4;
            if (keys.some(s => s.includes('architecture') || s.includes('epics'))) return 3;
            if (keys.some(s => s.includes('prd') || s.includes('ux'))) return 2;
            return 1;
        }

        // Modern BMAD structure with workflow_status object
        if (typeof workflowStatus === 'object') {
            const statuses = Object.keys(workflowStatus);

            // Check if we're in implementation (sprint-planning exists)
            if (statuses.some(s => s.includes('sprint') || s.includes('dev-story'))) {
                return 4;
            }
            // Check if we're in solutioning (architecture/epics exist)
            if (statuses.some(s => s.includes('architecture') || s.includes('epics'))) {
                return 3;
            }
            // Check if we're in planning (prd/ux exist)
            if (statuses.some(s => s.includes('prd') || s.includes('ux'))) {
                return 2;
            }
        }
        return 1; // Default to analysis
    }

    private flattenWorkflowItems(workflowStatusArray: any[]): Record<string, string> {
        const items: Record<string, string> = {};
        workflowStatusArray.forEach(phase => {
            if (phase.items && typeof phase.items === 'object') {
                Object.assign(items, phase.items);
            }
        });
        return items;
    }

    private inferPhaseFromLegacyStructure(parsed: any): 1 | 2 | 3 | 4 {
        // Infer from completed artifacts (legacy approach)
        if (parsed.sprint_status || parsed.implementation) {
            return 4;
        }
        if (parsed.architecture || parsed.epics) {
            return 3;
        }
        if (parsed.prd || parsed.ux_design) {
            return 2;
        }
        return 1;
    }

    private extractCompletedWorkflows(parsed: any, phase: string): string[] {
        const completed: string[] = [];

        // Handle array-based workflow_status
        if (parsed.workflow_status && Array.isArray(parsed.workflow_status)) {
            const allItems = this.flattenWorkflowItems(parsed.workflow_status);
            Object.entries(allItems).forEach(([key, value]) => {
                if (value && typeof value === 'string' &&
                    (value === 'completed' || value === 'done' || value === 'skipped')) {
                    completed.push(key);
                }
            });
            return completed;
        }

        if (parsed.workflow_status && typeof parsed.workflow_status === 'object') {
            // Modern object structure
            Object.entries(parsed.workflow_status).forEach(([key, value]) => {
                if (value && typeof value === 'string' && value !== 'required' && value !== 'optional') {
                    completed.push(key);
                }
            });
        } else if (parsed[phase]) {
            // Legacy structure with phase-specific fields
            const phaseData = parsed[phase];
            if (Array.isArray(phaseData?.completedWorkflows)) {
                return phaseData.completedWorkflows;
            }
        }

        return completed;
    }

    private getDefaultState(): WorkflowState {
        // Check for BMAD installation even when no status file exists
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const rootPath = workspaceFolders?.[0]?.uri.fsPath;
        const bmadInstalled = rootPath ? fs.existsSync(path.join(rootPath, '_bmad')) : false;

        return {
            project: 'New Project',
            currentPhaseIndex: 0,
            phases: [
                { name: 'Analysis', status: 'current', items: {} },
                { name: 'Planning', status: 'locked', items: {} },
                { name: 'Solutioning', status: 'locked', items: {} },
                { name: 'Implementation', status: 'locked', items: {} },
            ],
            bmadInstalled,
            hasStatusFile: false,
        };
    }

    private setupWatcher() {
        // Watch for any workflow-status YAML files
        const patterns = [
            '**/bmm-workflow-status.yaml',
            '**/workflow-status.yaml',
        ];

        patterns.forEach(pattern => {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);

            watcher.onDidChange(() => {
                console.log('YAML file changed, reloading state...');
                this.loadState();
            });

            watcher.onDidCreate(() => {
                console.log('YAML file created, loading state...');
                this.loadState();
            });

            if (!this.watcher) {
                this.watcher = watcher;
            }
        });
    }

    public getPhaseStatuses(): PhaseStatus[] {
        if (!this.state) {
            return [];
        }

        return this.state.phases.map((phase, index) => ({
            id: index + 1,
            name: phase.name,
            status: phase.status,
        }));
    }

    public dispose() {
        if (this.watcher) {
            this.watcher.dispose();
        }
    }
}
