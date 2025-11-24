/**
 * Goose Analysis VS Code Extension
 * AI-powered code analysis and explanation
 */

import * as vscode from 'vscode';
import { openAnalysisPanel } from './commands/open-analysis-panel.js';

/**
 * Extension activation
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Goose Analysis extension is now active');

  // Register Analysis Panel command
  const analysisPanelCmd = vscode.commands.registerCommand('gooseAnalysis.openPanel', () =>
    openAnalysisPanel(context)
  );

  context.subscriptions.push(analysisPanelCmd);

  vscode.window.showInformationMessage('Goose Analysis is ready! 🤖');
}

export function deactivate(): void {
  console.log('Goose Analysis extension is now deactivated');
}
