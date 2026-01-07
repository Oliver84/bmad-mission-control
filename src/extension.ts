import * as vscode from 'vscode';
import { BmadSidebarProvider } from './BmadSidebarProvider';
import { WorkflowStateManager } from './WorkflowStateManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('BMAD Mission Control is now active!');

    // Register the WebView sidebar provider
    const provider = new BmadSidebarProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('bmad.sidebar', provider)
    );

    // Initialize state manager
    const stateManager = new WorkflowStateManager();

    // Register project switch callback
    provider.onSwitchProject((path) => {
        stateManager.switchProject(path);
    });

    stateManager.initialize((state) => {
        // Push state updates to the WebView
        provider.updateState(state);
        // Also update available projects
        provider.setProjects(
            stateManager.getAvailableProjects(),
            stateManager.getCurrentProjectPath()
        );
    });

    context.subscriptions.push({
        dispose: () => stateManager.dispose()
    });
}

export function deactivate() {
    console.log('BMAD Mission Control deactivated');
}
