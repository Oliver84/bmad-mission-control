import * as vscode from 'vscode';
import { WorkflowState } from './types';
import { ProjectInfo } from './WorkflowStateManager';

export class BmadSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'bmad.sidebar';
  private _view?: vscode.WebviewView;
  private _currentState?: WorkflowState;
  private _availableProjects: ProjectInfo[] = [];
  private _currentProjectPath?: string;
  private _onSwitchProject?: (path: string) => void;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'executeCommand':
          await this._injectCommand(message.command);
          break;
        case 'switch-project':
          if (this._onSwitchProject && message.path) {
            this._onSwitchProject(message.path);
          }
          break;
        case 'open-yaml-file':
          // Try to find the file from the workflow state manager or search workspace
          const files = await vscode.workspace.findFiles('**/bmm-workflow-status.yaml', '**/node_modules/**', 1);
          if (files.length > 0) {
            const doc = await vscode.workspace.openTextDocument(files[0]);
            await vscode.window.showTextDocument(doc);
          } else {
            vscode.window.showErrorMessage('Could not find bmm-workflow-status.yaml');
          }
          break;
        case 'open-file':
          if (message.path) {
            try {
              const doc = await vscode.workspace.openTextDocument(message.path);
              await vscode.window.showTextDocument(doc);
            } catch (error) {
              vscode.window.showErrorMessage(`Could not open file: ${message.path}`);
            }
          }
          break;
        case 'create-story':
          if (message.storyId) {
            const command = `/bmad-bmm-workflows-create-story for story ${message.storyId}`;
            await vscode.env.clipboard.writeText(command);
            await vscode.commands.executeCommand('workbench.action.chat.open');
            vscode.window.showInformationMessage('📋 Story command copied! Paste in chat.');
          }
          break;
      }
    });
  }

  private async _injectCommand(command: string) {
    const query = `/${command}`;
    try {
      // Copy to clipboard and open chat (VS Code API limitation - can't inject into webview input)
      await vscode.env.clipboard.writeText(query);
      await vscode.commands.executeCommand('workbench.action.chat.open');
      vscode.window.showInformationMessage(`📋 Copied! Press Cmd+V to paste`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open chat: ${error}`);
    }
  }

  public updateState(state: WorkflowState) {
    this._currentState = state;
    if (this._view) {
      this._view.webview.html = this._getHtmlContent(this._view.webview);
    }
  }

  public setProjects(projects: ProjectInfo[], currentPath: string | null) {
    this._availableProjects = projects;
    this._currentProjectPath = currentPath || undefined;
    if (this._view) {
      this._view.webview.html = this._getHtmlContent(this._view.webview);
    }
  }

  public onSwitchProject(callback: (path: string) => void) {
    this._onSwitchProject = callback;
  }

  private _formatStoryId(id: string): string {
    // Convert 'epic-1' to 'Epic 1' or '1-2-account-management' to 'Account Management'
    if (id.startsWith('epic-')) {
      const num = id.replace('epic-', '');
      return `Epic ${num}`;
    }
    // Extract the name part after the numbers: '1-2-account-management' -> 'Account Management'
    const parts = id.split('-');
    const nameParts = parts.slice(2); // Skip first two number parts
    if (nameParts.length > 0) {
      return nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return id;
  }

  private _getPhaseWrapperClass(status: string): string {
    if (status === 'completed') { return 'completed'; }
    if (status === 'current') { return 'current'; }
    return '';
  }

  private _getPhaseCollapsedClass(status: string): string {
    return status === 'current' ? '' : 'collapsed';
  }

  private _getStatusDotColor(status: string): string {
    if (status === 'completed') { return 'var(--accent-green)'; }
    if (status === 'current') { return 'var(--accent-blue)'; }
    return 'var(--border-color)';
  }

  private _getStatusBadgeText(status: string): string {
    if (status === 'completed') { return 'Done'; }
    if (status === 'current') { return 'Active'; }
    if (status === 'locked') { return 'Pending'; }
    return 'Not Started';
  }

  private _getStatusBadgeClass(status: string): string {
    if (status === 'completed') { return 'completed'; }
    if (status === 'current') { return 'current'; }
    return 'locked';
  }

  private readonly workflowCatalog: Record<string, { command: string; label: string; tooltip: string; phase: 'analysis' | 'planning' | 'solutioning' | 'implementation' }> = {
    // Analysis Phase
    'product-brief': { command: 'bmad-bmm-workflows-create-product-brief', label: 'Create Product Brief', tooltip: 'Generate a comprehensive product brief through guided discovery.', phase: 'analysis' },
    'brainstorming': { command: 'bmad-bmm-workflows-brainstorming', label: 'Brainstorming Session', tooltip: 'Facilitate an interactive brainstorming session to explore ideas.', phase: 'analysis' },
    'brainstorm-project': { command: 'bmad-bmm-workflows-brainstorming', label: 'Brainstorming Session', tooltip: 'Facilitate an interactive brainstorming session to explore ideas.', phase: 'analysis' },
    'research': { command: 'bmad-bmm-workflows-research', label: 'Research', tooltip: 'Conduct market, technical, or domain research using web sources.', phase: 'analysis' },
    'document-project': { command: 'bmad-bmm-workflows-document-project', label: 'Document Project', tooltip: 'Analyze and document an existing codebase.', phase: 'analysis' },

    // Planning Phase
    'prd': { command: 'bmad-bmm-workflows-create-prd', label: 'Create PRD', tooltip: 'Create a detailed Product Requirements Document (PRD).', phase: 'planning' },
    'create-ux-design': { command: 'bmad-bmm-workflows-create-ux-design', label: 'Create UX Design', tooltip: 'Design UX patterns, flows, and look-and-feel.', phase: 'planning' },

    // Solutioning Phase
    'create-architecture': { command: 'bmad-bmm-workflows-create-architecture', label: 'Create Architecture', tooltip: 'Define technical architecture, components, and data models.', phase: 'solutioning' },
    'create-epics-and-stories': { command: 'bmad-bmm-workflows-create-epics-and-stories', label: 'Create Epics & Stories', tooltip: 'Break down requirements into actionable epics and user stories.', phase: 'solutioning' },
    'test-design': { command: 'bmad-bmm-workflows-testarch-test-design', label: 'Test Design', tooltip: 'Plan testing strategy and approach for the solution.', phase: 'solutioning' },
    'validate-architecture': { command: 'bmad-bmm-workflows-validate-architecture', label: 'Validate Architecture', tooltip: 'Review architecture against requirements and best practices.', phase: 'solutioning' },
    'check-implementation-readiness': { command: 'bmad-bmm-workflows-check-implementation-readiness', label: 'Check Readiness', tooltip: 'Validate PRD, Architecture, and Stories before coding.', phase: 'solutioning' },
    'implementation-readiness': { command: 'bmad-bmm-workflows-check-implementation-readiness', label: 'Check Readiness', tooltip: 'Validate PRD, Architecture, and Stories before coding.', phase: 'solutioning' },

    // Implementation Phase
    'sprint-planning': { command: 'bmad-bmm-workflows-sprint-planning', label: 'Sprint Planning', tooltip: 'Generate sprint backlog and tracking file.', phase: 'implementation' },
    'sprint-status': { command: 'bmad-bmm-workflows-sprint-status', label: 'Sprint Status', tooltip: 'Check current sprint progress and risks.', phase: 'implementation' },
    'create-story': { command: 'bmad-bmm-workflows-create-story', label: 'Create Story', tooltip: 'Create the next user story for implementation.', phase: 'implementation' },
    'dev-story': { command: 'bmad-bmm-workflows-dev-story', label: 'Dev Story', tooltip: 'Implement a specific user story with tests.', phase: 'implementation' },
    'quick-dev': { command: 'bmad-bmm-workflows-quick-dev', label: 'Quick Dev (Solo)', tooltip: 'Flexible development loop for smaller tasks (Solo Dev).', phase: 'implementation' },
    'code-review': { command: 'bmad-bmm-workflows-code-review', label: 'Code Review', tooltip: 'Perform adversarial code review on implementation.', phase: 'implementation' },
    'correct-course': { command: 'bmad-bmm-workflows-correct-course', label: 'Correct Course', tooltip: 'Navigate significant changes during a sprint.', phase: 'implementation' },
    'retrospective': { command: 'bmad-bmm-workflows-retrospective', label: 'Retrospective', tooltip: 'Review sprint success and extract lessons learned.', phase: 'implementation' },

    // Special / Test Workflows (Mapping to Solutioning for now)
    'testarch-atdd': { command: 'bmad-bmm-workflows-testarch-atdd', label: 'ATDD / TDD Cycle', tooltip: 'Generate failing acceptance tests before implementation.', phase: 'solutioning' },
    'testarch-automate': { command: 'bmad-bmm-workflows-testarch-automate', label: 'Expand Automation', tooltip: 'Expand test automation coverage.', phase: 'implementation' },
    'testarch-ci': { command: 'bmad-bmm-workflows-testarch-ci', label: 'CI Pipeline', tooltip: 'Scaffold CI/CD quality pipeline.', phase: 'implementation' },
    'testarch-framework': { command: 'bmad-bmm-workflows-testarch-framework', label: 'Test Framework', tooltip: 'Initialize production-ready test framework.', phase: 'solutioning' },
    'testarch-nfr': { command: 'bmad-bmm-workflows-testarch-nfr', label: 'NFR Assessment', tooltip: 'Assess non-functional requirements (performance, security).', phase: 'implementation' },
    'testarch-test-design': { command: 'bmad-bmm-workflows-testarch-test-design', label: 'Test Design', tooltip: 'Plan testing strategy for epics or system.', phase: 'solutioning' },
    'testarch-test-review': { command: 'bmad-bmm-workflows-testarch-test-review', label: 'Test Review', tooltip: 'Review test quality and best practices.', phase: 'implementation' },
    'testarch-trace': { command: 'bmad-bmm-workflows-testarch-trace', label: 'Requirements Trace', tooltip: 'Generate requirements-to-tests traceability matrix.', phase: 'solutioning' },
  };

  private _formatWorkflowKey(key: string): string {
    return key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  private _generatePhaseHtml(
    phaseIndex: number,
    phase: { name: string; status: string; items: Record<string, string> },
    isCurrentPhase: boolean,
    lockMessage?: string
  ): string {
    const wrapperClass = this._getPhaseWrapperClass(phase.status);
    const collapsedClass = this._getPhaseCollapsedClass(phase.status);
    const dotColor = this._getStatusDotColor(phase.status);

    // Status badges
    const badgeText = this._getStatusBadgeText(phase.status);
    const badgeClass = this._getStatusBadgeClass(phase.status);

    // Build workflow buttons from phase items
    interface DisplayWorkflow {
      command: string;
      label: string;
      tooltip: string;
      key: string;
      status: string;
      isPrimary: boolean;
    }

    const workflows: DisplayWorkflow[] = [];
    const processedKeys = new Set<string>();

    // 1. Process items explicitly in the YAML phase
    Object.entries(phase.items).forEach(([key, yamlStatus]) => {
      const catalogItem = this.workflowCatalog[key];
      processedKeys.add(key);

      if (catalogItem) {
        workflows.push({
          ...catalogItem,
          key,
          status: yamlStatus,
          isPrimary: (yamlStatus === 'required' || yamlStatus === 'recommended') && isCurrentPhase
        });
      } else {
        // Workflow not in catalog - still show it from YAML with formatted name
        workflows.push({
          command: key,
          label: this._formatWorkflowKey(key),
          tooltip: `Execute ${key} workflow`,
          key,
          status: yamlStatus,
          isPrimary: (yamlStatus === 'required' || yamlStatus === 'recommended') && isCurrentPhase
        });
      }
    });

    // 2. Find suggestions from catalog matching this phase
    // Map dynamic phase names to catalog categories
    let catalogPhaseKey: string | undefined;
    const lowerName = phase.name.toLowerCase();

    if (lowerName.includes('analysis') || lowerName.includes('discovery') || lowerName.includes('prerequisites')) {
      catalogPhaseKey = 'analysis';
    } else if (lowerName.includes('planning')) {
      catalogPhaseKey = 'planning';
    } else if (lowerName.includes('solutioning')) {
      catalogPhaseKey = 'solutioning';
    } else if (lowerName.includes('implementation') || lowerName.includes('execution')) {
      catalogPhaseKey = 'implementation';
    }

    if (catalogPhaseKey) {
      Object.entries(this.workflowCatalog).forEach(([key, item]) => {
        if (item.phase === catalogPhaseKey && !processedKeys.has(key)) {
          workflows.push({
            ...item,
            key,
            status: 'suggested',
            isPrimary: false
          });
        }
      });
    }

    const renderWorkflowButton = (w: DisplayWorkflow): string => {
      let buttonClass = '';
      let badgeHtml = '';

      if (w.status === 'completed' || w.status === 'done') {
        buttonClass = 'completed';
        badgeHtml = '<span class="status-icon">✓</span>';
      } else if (w.isPrimary) {
        buttonClass = 'primary';
        badgeHtml = '<span class="next-label">Recommended Next</span>';
      } else if (w.status === 'skipped') {
        buttonClass = 'skipped';
        badgeHtml = '<span class="status-label">Skipped</span>';
      } else if (w.status === 'optional' || w.status === 'conditional' || w.status === 'suggested') {
        buttonClass = 'suggested';
      }

      return `
        <button class="${buttonClass}" onclick="executeCommand('${w.command}')" title="${w.tooltip}">
          <span>${w.label}</span>
          ${badgeHtml}
        </button>`;
    };

    // Separate into Planned and Suggested
    const plannedWorkflows = workflows.filter(w => w.status !== 'suggested');
    const suggestedWorkflows = workflows.filter(w => w.status === 'suggested');

    const plannedHtml = plannedWorkflows.length > 0
      ? `<div class="workflow-group">${plannedWorkflows.map(renderWorkflowButton).join('')}</div>`
      : '';

    const suggestedHtml = suggestedWorkflows.length > 0
      ? `<div class="suggestions-section">
          <div class="suggestions-header" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('hidden')">
             <span>Available Tools</span>
             <span class="count">${suggestedWorkflows.length}</span>
          </div>
          <div class="workflow-group suggested-group hidden">
            ${suggestedWorkflows.map(renderWorkflowButton).join('')}
          </div>
        </div>`
      : '';

    const content = phase.status === 'locked' && lockMessage
      ? `<p class="locked-message" style="margin-bottom:12px">${lockMessage}</p>
          <div class="workflow-group locked-content">${plannedWorkflows.map(renderWorkflowButton).join('')}</div>`
      : `${plannedHtml}${suggestedHtml}`;

    if (!plannedHtml && !suggestedHtml) {
      return `
        <div class="phase-wrapper ${wrapperClass}">
          <div class="phase-section ${collapsedClass}" data-phase="${phaseIndex + 1}" data-status="${phase.status}">
            <div class="phase-header" onclick="togglePhase(${phaseIndex + 1})">
              <div class="status-dot" style="background: ${dotColor};"></div>
              <span class="phase-name">${phaseIndex + 1}. ${phase.name}</span>
              <span class="status-badge ${badgeClass}">${badgeText}</span>
              <span class="expand-icon">▼</span>
            </div>
            <div class="phase-content">
              <p class="empty-phase">No workflows defined for this phase.</p>
            </div>
          </div>
        </div>`;
    }

    const phaseId = phaseIndex + 1;
    return `
    <div class="phase-wrapper ${wrapperClass}">
      <div class="phase-section ${collapsedClass}" data-phase="${phaseId}" data-status="${phase.status}">
        <div class="phase-header" onclick="togglePhase(${phaseId})">
          <div class="status-dot" style="background: ${dotColor};"></div>
          <span class="phase-name">${phaseId}. ${phase.name}</span>
          <span class="status-badge ${badgeClass}">${badgeText}</span>
          <span class="expand-icon">▼</span>
        </div>
        <div class="phase-content">
          ${content}
        </div>
      </div>
    </div>`;
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    const projectTypeBadge = this._currentState?.projectType
      ? `<div class="project-badge">
           ${this._currentState.projectType} ${this._currentState.project ? '| ' + this._currentState.project : ''}
         </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BMAD Mission Control</title>
  <style>
    :root {
      --bg-primary: #0d1117; 
      --bg-card: #161b22;
      --bg-hover: #21262d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --border-color: #30363d;
      
      /* Neon / Glow Colors */
      --accent-blue: #58a6ff;
      --accent-blue-glow: rgba(88, 166, 255, 0.4);
      --accent-green: #2ea043;
      --accent-green-glow: rgba(46, 160, 67, 0.4);
      --accent-purple: #bc8cff;
      --accent-purple-glow: rgba(188, 140, 255, 0.4);
      --accent-orange: #d29922;

      --font-family: var(--vscode-font-family);
    }
    
    body {
      padding: 16px;
      color: var(--text-primary);
      font-family: var(--font-family);
      background-color: var(--bg-primary);
      margin: 0;
    }

    /* Header */
    header {
      margin-bottom: 24px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-color);
      text-align: center;
    }
    
    .project-selector {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      margin-bottom: 8px;
    }
    
    .project-selector:hover {
      border-color: var(--accent-green);
    }
    
    .project-selector:focus {
      outline: none;
      border-color: var(--accent-green);
      box-shadow: 0 0 8px var(--accent-green-glow);
    }
    
    /* Install Prompt */
    .install-prompt {
      padding: 24px 16px;
      text-align: center;
    }
    
    .install-prompt h2 {
      font-size: 18px;
      margin-bottom: 12px;
      color: var(--text-primary);
    }
    
    .install-prompt p {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 16px;
    }
    
    .install-steps {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      text-align: left;
    }
    
    .install-steps h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }
    
    .install-steps ol {
      margin: 0 0 12px 20px;
      padding: 0;
      font-size: 12px;
      color: var(--text-primary);
    }
    
    .install-steps li {
      margin-bottom: 6px;
    }
    
    .install-command {
      display: block;
      background: rgba(88, 166, 255, 0.1);
      border: 1px solid rgba(88, 166, 255, 0.3);
      border-radius: 6px;
      padding: 12px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      color: var(--accent-blue);
      margin: 12px 0;
      word-break: break-all;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .install-command:hover {
      background: rgba(88, 166, 255, 0.2);
      box-shadow: 0 0 10px var(--accent-blue-glow);
    }
    
    .install-note {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 8px;
    }
    
    .install-note code {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', monospace;
    }
    
    .install-links {
      margin-top: 16px;
    }
    
    .install-links a {
      color: var(--accent-blue);
      text-decoration: none;
    }
    
    .install-links a:hover {
      text-decoration: underline;
    }
    
    .project-badge {
      font-size: 9px;
      color: var(--accent-blue);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 4px;
      opacity: 0.9;
      text-shadow: 0 0 5px var(--accent-blue-glow);
    }

    /* Phase Structure */
    .phases {
      margin-top: 20px;
    }

    .phase-wrapper {
      position: relative;
      margin-left: 20px; /* Reduced margin */
      margin-right: 12px;
      margin-bottom: 24px;
    }
    
    /* Connecting Rail Line - Running behind the dots */
    .phase-wrapper::before {
      content: '';
      position: absolute;
      left: 17px;   /* Precise center: padding-left 14px + 1/2 dot width 4px - 1px line width/2 */
      top: 22px;    /* Start from the center height of current dot */
      bottom: -32px; /* Extend into the next wrapper to connect */
      width: 2px;
      background: var(--border-color);
      z-index: 1;   /* Behind the dot, but inside the wrapper context */
      opacity: 0.3;
      transition: all 0.3s ease;
    }
    
    .phase-wrapper:last-child::before { 
      display: none; 
    }
    
    /* Colorized Active/Done Rail segments */
    .phase-wrapper.completed::before {
      background: var(--accent-green);
      box-shadow: 0 0 8px var(--accent-green-glow);
      opacity: 0.8;
    }
    .phase-wrapper.current::before {
      background: linear-gradient(to bottom, var(--accent-blue), var(--border-color));
      opacity: 0.8;
      box-shadow: 0 0 5px var(--accent-blue-glow);
    }

    /* Phase Card */
    .phase-section {
      position: relative;
      background: rgba(22, 27, 34, 0.7);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 2;
    }
    
    .phase-section:hover {
      border-color: var(--text-secondary);
      box-shadow: 0 0 15px rgba(255,255,255,0.05);
    }

    .phase-section[data-status="current"] {
      border-color: var(--accent-blue);
      box-shadow: 0 0 15px var(--accent-blue-glow), inset 0 0 20px rgba(88, 166, 255, 0.05);
    }
    
    .phase-section[data-status="completed"] {
      border-color: var(--accent-green);
      box-shadow: 0 0 10px var(--accent-green-glow);
    }
    
    .phase-header {
      display: flex;
      align-items: center;
      padding: 12px 14px;
      cursor: pointer;
      user-select: none;
      position: relative;
      z-index: 3;
    }
    
    .status-dot {
      width: 8px; 
      height: 8px; 
      border-radius: 50%; 
      margin-right: 12px;
      position: relative;
      z-index: 4;
      background: #161b22; /* Cover the line behind */
      border: 2px solid #161b22; /* Extra mask area */
      box-shadow: 0 0 5px rgba(255,255,255,0.2);
    }
    
    .phase-section[data-status="current"] .status-dot {
      box-shadow: 0 0 10px var(--accent-blue);
      border-color: rgba(0, 127, 212, 0.2);
    }
    
    .phase-name {
      flex: 1;
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.5px;
    }

    /* Badges */
    .status-badge {
      font-size: 9px;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-left: 8px;
    }
    
    .status-badge.completed { background: rgba(46, 160, 67, 0.2); color: var(--accent-green); border: 1px solid rgba(46, 160, 67, 0.3); }
    .status-badge.current { background: rgba(88, 166, 255, 0.2); color: var(--accent-blue); border: 1px solid rgba(88, 166, 255, 0.3); box-shadow: 0 0 10px var(--accent-blue-glow); }
    .status-badge.locked { background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid transparent; }

    .expand-icon {
      margin-left: 12px;
      font-size: 10px;
      color: var(--text-secondary);
      transition: transform 0.3s ease;
    }
    .phase-section.collapsed .expand-icon { transform: rotate(-90deg); }

    /* Content */
    .phase-content {
      padding: 16px;
      background: rgba(0,0,0,0.2);
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .phase-section.collapsed .phase-content { display: none; }
    
    .workflow-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* BUTTON STYLES - The Re-Glow */
    button {
      position: relative;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: var(--text-primary);
      padding: 10px 14px;
      border-radius: 6px;
      cursor: pointer;
      text-align: left;
      font-family: var(--font-family);
      font-size: 12px;
      transition: all 0.2s ease;
      display: flex;
      justify-content: space-between;
      align-items: center;
      overflow: hidden;
    }
    
    button:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--text-primary);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    /* Primary / Recommended Buttons */
    button.primary {
      background: linear-gradient(135deg, rgba(88, 166, 255, 0.15), rgba(88, 166, 255, 0.05));
      border: 1px solid rgba(88, 166, 255, 0.4);
      color: #fff;
      font-weight: 500;
    }
    
    button.primary:hover {
      background: linear-gradient(135deg, rgba(88, 166, 255, 0.25), rgba(88, 166, 255, 0.1));
      border-color: var(--accent-blue);
      box-shadow: 0 0 15px var(--accent-blue-glow); /* THE GLOW */
      text-shadow: 0 0 8px var(--accent-blue-glow);
    }
    
    /* Special hover effect for non-primary buttons in current phase */
    .phase-section[data-status="current"] button:not(.primary):hover {
      border-color: var(--accent-blue);
      box-shadow: 0 0 8px var(--accent-blue-glow);
    }

    .next-label {
      font-size: 9px;
      color: var(--accent-green);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: rgba(46, 160, 67, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid rgba(46, 160, 67, 0.3);
    }

    .suggestions-section {
      margin-top: 12px;
      border-top: 1px dashed var(--border-color);
      padding-top: 12px;
    }

    .suggestions-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      cursor: pointer;
      margin-bottom: 8px;
      padding: 0 4px;
    }

    .suggestions-header:hover {
      color: var(--text-primary);
    }

    .suggestions-header .count {
      background: var(--bg-hover);
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 9px;
    }

    .hidden {
      display: none !important;
    }

    .suggested-group {
      opacity: 0.7;
    }

    button.suggested {
      background: rgba(255, 255, 255, 0.02);
      border-style: dashed;
    }

    button.completed {
      border-color: rgba(46, 160, 67, 0.4);
      background: rgba(46, 160, 67, 0.05);
    }

    button.skipped {
      opacity: 0.5;
      text-decoration: line-through;
      color: var(--text-secondary);
    }

    .source-link {
        margin-left: 8px;
        opacity: 0.5;
        cursor: pointer;
        font-family: monospace;
        font-size: 10px;
        transition: all 0.2s ease;
    }
    .source-link:hover {
        opacity: 1;
        color: var(--accent-blue);
        text-shadow: 0 0 5px var(--accent-blue-glow);
    }

    .status-icon {
      color: var(--accent-green);
      font-weight: bold;
    }

    .status-label {
      font-size: 8px;
      text-transform: uppercase;
      opacity: 0.8;
    }

    /* Artifacts Section */
    .artifacts-section {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }
    
    .artifacts-section h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }
    
    .artifacts-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .artifact-link {
      background: rgba(100, 149, 237, 0.15);
      border: 1px solid rgba(100, 149, 237, 0.3);
      color: var(--accent-blue);
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .artifact-link:hover {
      background: rgba(100, 149, 237, 0.25);
      border-color: var(--accent-blue);
      box-shadow: 0 0 8px var(--accent-blue-glow);
    }

    /* Stories Section */
    .stories-section {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }
    
    .stories-section h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }
    
    .stories-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .epic-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      margin-top: 8px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      user-select: none;
    }
    
    .epic-header:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    
    .chevron {
      font-size: 8px;
      margin-left: 8px;
      color: var(--text-secondary);
      transition: transform 0.3s ease;
      width: 10px;
      display: inline-block;
      text-align: center;
    }
    
    .expand-icon {
      transition: transform 0.3s ease;
    }

    .epic-group:not(.expanded) .expand-icon {
      transform: rotate(-90deg);
    }
    
    .epic-group:not(.expanded) .epic-stories {
      display: none;
    }
    
    .epic-group:not(.expanded) .epic-header {
      opacity: 0.8;
    }
    
    .story-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px 6px 20px;
      font-size: 11px;
      color: var(--text-secondary);
    }
    
    .story-item.story-link {
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .story-item.story-link:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
    }
    
    .story-item.backlog-action:hover {
      background: rgba(46, 160, 67, 0.1);
      color: var(--accent-green);
    }
    
    .story-name, .epic-title-group {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .epic-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .epic-name {
      font-weight: 600;
    }

    .epic-count {
      font-size: 10px;
      color: var(--text-secondary);
      font-weight: 400;
      background: rgba(255, 255, 255, 0.05);
      padding: 1px 6px;
      border-radius: 8px;
    }
    
    .story-status {
      font-size: 9px;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-left: 8px;
      flex-shrink: 0;
    }
    
    .status-backlog { background: rgba(128, 128, 128, 0.3); color: #aaa; }
    .status-readyfordev { background: rgba(100, 149, 237, 0.3); color: var(--accent-blue); }
    .status-inprogress { background: rgba(255, 193, 7, 0.3); color: #ffc107; }
    .status-review { background: rgba(156, 39, 176, 0.3); color: #ce93d8; }
    .status-done { background: rgba(76, 175, 80, 0.3); color: var(--accent-green); }
    .status-optional { background: rgba(128, 128, 128, 0.2); color: #888; }

    /* Utilities */
    .utils-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--border-color);
    }
    
    .utils-grid h3 {
      grid-column: 1 / -1;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    
    .utils-grid button {
      justify-content: center;
      text-align: center;
      padding: 12px;
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }

  </style>
  <script>
    const vscode = acquireVsCodeApi();
    
    function togglePhase(phaseId) {
      const section = document.querySelector(\`[data-phase="\${phaseId}"]\`);
      if (section) {
        section.classList.toggle('collapsed');
      }
    }
    
    function executeCommand(command) {
      vscode.postMessage({ type: 'executeCommand', command });
    }
    
    function createStory(storyId) {
      vscode.postMessage({ type: 'create-story', storyId });
    }
    
    function switchProject(path) {
      vscode.postMessage({ type: 'switch-project', path });
    }
    
    function openFile(filePath) {
      vscode.postMessage({ type: 'open-file', path: filePath });
    }
    
    function toggleEpic(epicId) {
      if (!epicId) return;
      const group = document.querySelector(\`[data-epic="\${epicId}"]\`);
      if (group) {
        group.classList.toggle('expanded');
      }
    }
  </script>
</head>
<body>
  <header>
    ${this._availableProjects.length > 1
        ? `<select class="project-selector" onchange="switchProject(this.value)">
           ${this._availableProjects.map(p =>
          `<option value="${p.path}" ${p.path === this._currentProjectPath ? 'selected' : ''}>${p.name}</option>`
        ).join('')}
         </select>`
        : ''}
    ${this._currentState?.projectType
        ? `<div class="project-badge">
           ${this._currentState.projectType} ${this._currentState.project ? '| ' + this._currentState.project : ''}
           <span class="source-link" onclick="vscode.postMessage({type: 'open-yaml-file'})" title="View Source YAML">{}</span>
         </div>`
        : ''}
  </header>
  
  ${this._currentState?.bmadInstalled === false
        ? `<div class="install-prompt">
         <h2>🚀 BMAD Not Installed</h2>
         <p>This extension requires the <strong>BMAD Method</strong> to be installed in your project.</p>
         
         <div class="install-steps">
           <h3>Installation Steps:</h3>
           <ol>
             <li>Open your project directory in terminal</li>
             <li>Run the following command:</li>
           </ol>
           <code class="install-command">npx bmad-method@alpha install</code>
           <p class="install-note">This will create the <code>_bmad</code> directory with all necessary templates and workflows.</p>
         </div>
         
         <div class="install-links">
           <p>Learn more at: <a href="https://github.com/bmad-method" target="_blank">github.com/bmad-method</a></p>
         </div>
       </div>`
        : (this._currentState?.hasStatusFile === false
          ? `<div class="install-prompt">
           <h2>📋 No Workflow Status Found</h2>
           <p>BMAD is installed, but no workflow tracking file was found.</p>
           
           <div class="install-steps">
             <h3>Initialize Workflow Tracking:</h3>
             <p>Run the following command in your AI chat:</p>
             <code class="install-command">/bmad-bmm-workflows-workflow-init</code>
             <p class="install-note">This will create a <code>bmm-workflow-status.yaml</code> file to track your project progress.</p>
           </div>
         </div>`
          : `<div class="phases">
    ${(this._currentState?.phases || []).map((phase, index) =>
            this._generatePhaseHtml(index, phase, index === this._currentState?.currentPhaseIndex)
          ).join('')}
  </div>`)}
  
  ${(this._currentState?.artifacts && this._currentState.artifacts.length > 0)
        ? `<div class="artifacts-section">
         <h3>📄 Artifacts</h3>
         <div class="artifacts-list">
           ${this._currentState.artifacts.map(a =>
          `<button class="artifact-link" onclick="openFile('${a.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" title="${a.path}">
                ${a.name}
              </button>`
        ).join('')}
         </div>
       </div>`
        : ''}
  
  ${(this._currentState?.stories && this._currentState.stories.length > 0)
        ? `<div class="stories-section">
         <h3>📋 Stories</h3>
         <div class="stories-list">
           ${(() => {
          const stories = this._currentState!.stories! || [];
          let html = '';
          let epicIndices: number[] = [];

          // Find all epic indices
          stories.forEach((s, idx) => { if (s.isEpic) epicIndices.push(idx); });

          epicIndices.forEach((epicIdx, i) => {
            const epic = stories[epicIdx];
            const nextEpicIdx = epicIndices[i + 1] || stories.length;
            const epicStories = stories.slice(epicIdx + 1, nextEpicIdx);

            const total = epicStories.length;
            const done = epicStories.filter(s => s.status === 'done').length;
            const statusClass = epic.status.replace(/-/g, '');

            html += `<div class="epic-group" data-epic="${epic.id}">
                 <div class="epic-header" onclick="toggleEpic('${epic.id}')">
                   <div class="epic-title-group">
                     <span class="epic-name">${this._formatStoryId(epic.id)}</span>
                     <span class="epic-count">${done}/${total}</span>
                   </div>
                   <span class="story-status status-${statusClass}">${epic.status}</span>
                   <span class="chevron expand-icon">▼</span>
                 </div>
                 <div class="epic-stories">
                   ${epicStories.map(s => {
              const sClass = s.status.replace(/-/g, '');
              const hasPath = s.path ? true : false;
              const isBacklog = s.status === 'backlog';
              const escapedPath = s.path ? s.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';

              let clickHandler = '';
              let linkClass = '';
              let indicator = '';

              if (hasPath) {
                clickHandler = `onclick="openFile('${escapedPath}')"`;
                linkClass = 'story-link';
                indicator = ' 📄';
              } else if (isBacklog) {
                clickHandler = `onclick="createStory('${s.id}')"`;
                linkClass = 'story-link backlog-action';
                indicator = ' ➕';
              }

              return `<div class="story-item ${linkClass}" ${clickHandler}>
                       <span class="story-name">${this._formatStoryId(s.id)}${indicator}</span>
                       <span class="story-status status-${sClass}">${s.status}</span>
                     </div>`;
            }).join('')}
                 </div>
               </div>`;
          });

          return html;
        })()}
         </div>
       </div>`
        : ''}
  
  <div class="utils-grid">
    <h3>Utils</h3>
    <button onclick="executeCommand('bmad-bmm-workflows-workflow-init')">New Project</button>
    <button onclick="executeCommand('bmad-bmm-workflows-workflow-status')">Status</button>
    <button onclick="executeCommand('bmad-core-workflows-party-mode')">Party Mode</button>
    <button onclick="executeCommand('bmad-bmm-workflows-document-project')">Document</button>
    
    <h3>Diagrams</h3>
    <button onclick="executeCommand('bmad-bmm-workflows-create-excalidraw-diagram')">Arch</button>
    <button onclick="executeCommand('bmad-bmm-workflows-create-excalidraw-dataflow')">Data Flow</button>
    <button onclick="executeCommand('bmad-bmm-workflows-create-excalidraw-wireframe')">Wireframe</button>
    <button onclick="executeCommand('bmad-bmm-workflows-create-excalidraw-flowchart')">Flowchart</button>
  </div>
</body>
</html>`;
  }
}
