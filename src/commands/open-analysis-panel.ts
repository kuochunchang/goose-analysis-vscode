import * as vscode from 'vscode';
import { AnalysisPanel } from '../views/analysis-panel.js';

/**
 * Command to open the analysis panel
 */
export async function openAnalysisPanel(
  context: vscode.ExtensionContext,
  file?: vscode.Uri
): Promise<void> {
  // If no file provided, use active editor
  const targetFile = file || vscode.window.activeTextEditor?.document.uri;

  if (!targetFile) {
    vscode.window.showWarningMessage('No file selected. Please open a file to analyze.');
    return;
  }

  // Check if file is analyzable
  const document = await vscode.workspace.openTextDocument(targetFile);
  const language = document.languageId;
  const { isSupportedLanguage, getSupportedLanguagesList } = await import('../utils/language-support.js');

  if (!isSupportedLanguage(language)) {
    vscode.window.showWarningMessage(
      `File type "${language}" is not supported. Currently only ${getSupportedLanguagesList()} files can be analyzed.`
    );
    return;
  }

  // Create or show the panel
  const extensionUri = context.extensionUri;
  AnalysisPanel.createOrShow(extensionUri, context, targetFile);
}
